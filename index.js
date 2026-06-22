// index.js
import bolt from '@slack/bolt';
const { App } = bolt;
import { WebClient } from '@slack/web-api';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { 
  initDatabase, 
  saveMemberAnalysis, 
  markAsSentToSlack, 
  closeDatabase 
} from './db.js'; [1, 3]

// Load environment variables
dotenv.config(); [4]

// Simple logger utility
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err),
  debug: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`);
    }
  }
}; [2, 4]

class SlackAIAgent {
  constructor() {
    // Initialize Express
    this.app = express(); [2]

    // Initialize Slack Bolt App (Socket Mode)
    this.slack = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: process.env.SLACK_APP_TOKEN
    }); [5]

    // Standalone Web Client for direct API calls
    this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN); [5]

    // Initialize LangChain OpenAI
    this.openai = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0.3,
      apiKey: process.env.OPENAI_API_KEY
    }); [6]

    this.setupSlackEvents();
    this.setupExpress(); [6]
  }

  setupSlackEvents() {
    // Listen for new members joining the workspace
    this.slack.event('team_join', async ({ event }) => {
      try {
        log.info(`New member joined: ${event.user.real_name || event.user.name}`);
        const userInfo = await this.getUserInfo(event.user.id);
        await this.analyzeAndPostMember(userInfo);
      } catch (error) {
        log.error('Error processing team_join', error);
      }
    }); [7, 8]

    // Listen for members joining a specific channel
    this.slack.event('member_joined_channel', async ({ event }) => {
      try {
        // Only process public channels (type C)
        if (event.channel_type === 'C') {
          log.info(`Member ${event.user} joined channel ${event.channel}`);
          const userInfo = await this.getUserInfo(event.user);
          await this.analyzeAndPostMember(userInfo);
        }
      } catch (error) {
        log.error('Error processing member_joined_channel', error);
      }
    }); [8, 9]

    this.slack.error(async (error) => {
      log.error('Slack error', error);
    }); [10]
  }

  setupExpress() {
    this.app.use(express.json()); [10]

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    }); [11]

    // Test endpoint (Development only)
    if (process.env.NODE_ENV === 'development') {
      this.app.post('/test-analyze-member', async (req, res) => {
        try {
          const { memberInfo } = req.body;
          if (!memberInfo) {
            return res.status(400).json({ error: 'memberInfo is required' });
          }
          const analysis = await this.analyzeAndPostMember(memberInfo);
          res.json({ success: true, analysis, timestamp: new Date().toISOString() });
        } catch (error) {
          log.error('Test analysis error', error);
          res.status(500).json({ error: 'Analysis failed' });
        }
      });
    } [11, 12]

    // Global Error Handler
    this.app.use((err, req, res, next) => {
      log.error('Express error', err);
      res.status(500).json({ error: 'Internal server error' });
    }); [12, 13]
  }

  async getUserInfo(userId) {
    const result = await this.webClient.users.info({ user: userId });
    const user = result.user;

    // Normalize user object
    return {
      id: user.id,
      name: user.real_name || user.name,
      username: user.name,
      email: user.profile?.email,
      title: user.profile?.title,
      timeZone: user.tz,
      firstName: user.profile?.first_name,
      lastName: user.profile?.last_name,
      statusText: user.profile?.status_text
    };
  } [13, 14]

  async analyzeAndPostMember(memberInfo) {
    let analysisId = null;
    try {
      log.info(`Processing member: ${memberInfo.name}`);

      // Step 1: Research
      const researchData = await this.doBasicResearch(memberInfo); [15, 16]

      // Step 2: AI Analysis
      const analysis = await this.analyzeWithAI(memberInfo, researchData); [16]

      // Step 3: Save to Database
      analysisId = await saveMemberAnalysis(memberInfo, analysis, researchData); [16]

      // Step 4: Post to Slack
      await this.postAnalysisToChannel(memberInfo, analysis, researchData); [17]

      // Step 5: Mark as sent in DB
      if (analysisId) {
        await markAsSentToSlack(analysisId);
      } [17]

      return analysis;
    } catch (error) {
      log.error(`Error processing ${memberInfo.name}`, error);
      if (analysisId) {
        log.error(`Analysis ${analysisId} saved to DB but failed Slack post`);
      }
      throw error;
    }
  } [15, 18]

  async doBasicResearch(memberInfo) {
    const results = [];
    try {
      // Check for non-personal company email
      if (memberInfo.email && !this.isPersonalEmail(memberInfo.email)) {
        const domain = memberInfo.email.split('@')[19];
        const companyInfo = await this.getCompanyInfo(domain);
        if (companyInfo) results.push(companyInfo);
      }

      // Search GitHub
      if (memberInfo.name) {
        const githubInfo = await this.getHubInfo(memberInfo.name);
        if (githubInfo) results.push(githubInfo);
      }
    } catch (error) {
      log.error('Basic research error', error);
    }
    return results;
  } [17, 20, 21]

  async getCompanyInfo(domain) {
    try {
      const response = await axios.get(`https://${domain}`, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const titleMatch = response.data.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[19] : `Company: ${domain}`;

      return {
        url: `https://${domain}`,
        title: title,
        content: `Company website for ${domain}`,
        type: 'company'
      };
    } catch (error) {
      log.error(`Could not fetch ${domain}`, error);
      return null;
    }
  } [22-24]

  async getHubInfo(name) {
    try {
      const response = await axios.get(`https://api.github.com/search/users?q=${encodeURIComponent(name)}`, {
        timeout: 5000
      });
      if (response.data.items?.length > 0) {
        const user = response.data.items;
        return {
          url: user.html_url,
          title: `GitHub User: ${user.login}`,
          content: `${user.login} public repos`,
          type: 'github'
        };
      }
    } catch (error) {
      log.debug(`GitHub search error: ${error.message}`);
    }
    return null;
  } [24, 25]

  async analyzeWithAI(memberInfo, researchData) {
    const prompt = ChatPromptTemplate.fromTemplate(`
      Analyze this new community member for fit with our commercial product.
      Company: {company_name}
      Product: {company_product}
      
      Member Name: {name}
      Email: {email}
      Title: {title}
      Research Data: {research}
      
      Provide a JSON response with:
      - fitScore (0-100)
      - insights (array of 3-5 observations)
      - recommendations (array of 2-4 suggestions)
    `); [26, 27]

    try {
      const researchSummary = researchData.length > 0 
        ? researchData.map(d => `${d.title}: ${d.content}`).join('\n')
        : "Limited research data available"; [28]

      const chain = prompt.pipe(this.openai);
      const result = await chain.invoke({
        company_name: process.env.COMPANY_NAME || "Your Company",
        company_product: process.env.COMPANY_PRODUCT || "Your Product",
        name: memberInfo.name,
        email: memberInfo.email || "not provided",
        title: memberInfo.title || "not provided",
        research: researchSummary
      }); [28, 29]

      // Clean markdown from GPT response
      const cleanedResponse = result.content.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(cleanedResponse); [29, 30]

      return {
        fitScore: Math.min(100, Math.max(0, analysis.fitScore)),
        insights: Array.isArray(analysis.insights) ? analysis.insights : ["Analysis completed"],
        recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : ["Follow-up recommended"]
      }; [30, 31]
    } catch (error) {
      log.error('AI analysis error', error);
      return { fitScore: 50, insights: ["Unable to complete full analysis"], recommendations: ["Manual review"] };
    }
  } [27]

  async postAnalysisToChannel(memberInfo, analysis, researchData) {
    const color = analysis.fitScore >= 80 ? '#2eb886' // green
                : analysis.fitScore >= 60 ? '#f2c744' // yellow
                : analysis.fitScore >= 40 ? '#e67e22' // orange
                : '#e74c3c'; // red [31, 32]

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: `🔍 New Member: ${memberInfo.name}` }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Fit Score:* ${analysis.fitScore}/100` },
          { type: "mrkdwn", text: `*Email:* ${memberInfo.email || 'Not provided'}` },
          { type: "mrkdwn", text: `*Title:* ${memberInfo.title || 'Not provided'}` }
        ]
      }
    ]; [32, 33]

    if (analysis.insights.length > 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Insights:*\n${analysis.insights.map(i => `• ${i}`).join('\n')}` }
      });
    } [33, 34]

    if (analysis.recommendations.length > 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Recommendations:*\n${analysis.recommendations.map(r => `• ${r}`).join('\n')}` }
      });
    } [34]

    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `Analyzed at: ${new Date().toISOString()}` }]
    }); [34]

    await this.webClient.chat.postMessage({
      channel: process.env.SLACK_PRIVATE_CHANNEL_ID,
      text: `New member analysis for ${memberInfo.name}`,
      blocks: blocks
    }); [35]

    log.info(`Analysis posted to channel for ${memberInfo.name}`);
  } [35, 36]

  isPersonalEmail(email) {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    const domain = email.split('@')[19]?.toLowerCase();
    return personalDomains.includes(domain);
  } [36, 37]

  async start() {
    try {
      log.info('Initializing database...');
      await initDatabase(); [37, 38]

      const port = process.env.PORT || 3000;
      this.server = this.app.listen(port, () => {
        log.info(`Express server running on port ${port}`);
      }); [38]

      await this.slack.start();
      log.info('Slackbot connected');
      log.info('Slack AI Agent is up and running');
    } catch (error) {
      log.error('Failed to start', error);
      process.exit(1);
    }
  } [38]

  async stop() {
    try {
      log.info('Shutting down...');
      await this.slack.stop();
      if (this.server) {
        await new Promise(resolve => this.server.close(resolve));
      }
      await closeDatabase();
      log.info('Stopped successfully');
      process.exit(0);
    } catch (error) {
      log.error('Shutdown error', error);
      process.exit(1);
    }
  } [39]
}

// Instantiate and start the agent
const agent = new SlackAIAgent();
agent.start().catch(err => {
  console.error('Startup failed', err);
  process.exit(1);
}); [39, 40]

// Graceful shutdown listeners
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop()); [39]

export default agent; [40]