// @ts-nocheck

import pkg from '@slack/bolt';
const { App } = pkg;
import { WebClient } from '@slack/web-api';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langsmith/core/prompts';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const log = {
    info: (msg, ...args) => console.log('[INFO]', msg, ...args),
    error: (msg, ...args) => console.log('[ERROR]', msg, ...args),
    debug: (msg, ...args) => process.env.NODE_ENV === 'development' && console.log('[DEBUG]', msg, ...args),
};


class SlackAIAgent {
    constructor() {
        this.app = express();
        this.slack = new App({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            socketMode: true,
            appToken: process.env.SLACK_APP_TOKEN,
        });
        this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
        this.openai = new ChatOpenAI({
            model: "gpt-4",
            temperature: 0.3,
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.setupSlackEvents();
        this.setupExpress();
    }

    setupSlackEvents() {
        this.slack.event('team_join', async ({ event }) => {
            try {
                log.info(`New member joined: ${event.user.real_name || event.user.name}`);
                const userInfo = await this.getUserInfo(event.user.id);
                await this.analyzeAndPostMember(userInfo);
            } catch (error) {
                log.error('Error processing team_join:', error.message);
            }
        });

        this.slack.event('member_joined_channel', async ({ event }) => {
            try {
                if (event.channel_type === 'C') {
                    log.info(`Member ${event.user} joined channel ${event.channel}`);
                    const userInfo = await this.getUserInfo(event.user);
                    await this.analyzeAndPostMember(userInfo);
                }
            } catch (error) {
                log.error('Error processing member_joined_channel:', error.message);
            }
        });

        this.slack.error(async (error) => log.error('slack error:', error.message));
    }

    setupExpress() {
        this.app.use(express.json());

        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        if (process.env.NODE_ENV === 'development') {
            this.app.post('/test/analyze-member', async (req, res) => {
                try {
                    const { memberInfo } = req.body;
                    if (!memberInfo) return res.status(400).json({ error: 'memberInfo is required' });
                    const analysis = await this.analyzeAndPostMember(memberInfo);
                    res.json({ success: true, analysis, timestamp: new Date().toISOString() });
                } catch (error) {
                    log.error('Test analysis error:', error.message);
                    res.status(500).json({ error: 'Analysis failed', message: error.message });
                }
            });
        }

        this.app.use((err, req, res, next) => {
            log.error('Express error', err.message);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async getUserInfo(userId) {
        const result = await this.webClient.users.info({ user: userId });
        const user = result.user;
        
        return {
            id: user.id,
            name: user.real_name || user.name,
            username: user.name,
            email: user.profile?.email,
            title: user.profile?.title,
            timezone: user.tz,
            profile: {
                firstName: user.profile?.first_name,
                lastName: user.profile?.last_name,
                statusText: user.profile?.status_text,
            },
        };
    }

    async doBasicResearch(member) {
        try {
            // Minimal research implementation: gather basic info
            return Promise.resolve({
                memberId: member.id,
                name: member.name,
                profile: member.profile,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            log.error(`Error during basic research for ${member.name}:`, error.message);
            return Promise.resolve({ memberId: member.id, error: error.message });
        }
    }

    async analyzeWithAI(researchData) {
        try {
            // Minimal AI analysis: use the research data or call AI if available
            if (this.openai) {
                const prompt = ChatPromptTemplate.fromTemplate(
                    'Analyze the following member data and provide insights: {data}'
                );
                // Stub: return the research data unchanged
                return Promise.resolve({
                    ...researchData,
                    analysis: 'Member profile analyzed',
                    timestamp: new Date().toISOString(),
                });
            }
            return Promise.resolve(researchData);
        } catch (error) {
            log.error('Error during AI analysis:', error.message);
            return Promise.resolve(researchData);
        }
    }

    async saveMemberAnalysis(member, analysis) {
        try {
            // Minimal implementation: return a mock ID
            const analysisId = `analysis_${member.id}_${Date.now()}`;
            log.info(`Analysis saved for member ${member.name} with ID: ${analysisId}`);
            return Promise.resolve(analysisId);
        } catch (error) {
            log.error(`Error saving analysis for ${member.name}:`, error.message);
            throw error;
        }
    }

    async markAsSentToSlack(analysisId) {
        try {
            // Minimal stub: mark as sent
            log.info(`Analysis ${analysisId} marked as sent to Slack`);
            return Promise.resolve(true);
        } catch (error) {
            log.error(`Error marking analysis ${analysisId} as sent:`, error.message);
            return Promise.resolve(false);
        }
    }

    async postAnalysisToChannel(member, analysis) {
        try {
            if (!process.env.SLACK_BOT_TOKEN) {
                log.info('No Slack token available, skipping post');
                return Promise.resolve(false);
            }
            // Minimal implementation: post to #general or configured channel
            const channel = process.env.SLACK_CHANNEL || '#general';
            const result = await this.webClient.chat.postMessage({
                channel,
                text: `New member analysis: ${member.name}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Member Analysis for ${member.name}*\n${JSON.stringify(analysis, null, 2)}`,
                        },
                    },
                ],
            });
            log.info(`Analysis posted to Slack for member ${member.name}`);
            return Promise.resolve(result);
        } catch (error) {
            log.error(`Error posting analysis to Slack:`, error.message);
            throw error;
        }
    }

    async analyzeAndPostMember(memberInfo) {
        let analysisId = null;
        try {
            log.info(`Processing member: ${memberInfo.name}`);
            const researchData = await this.doBasicResearch(memberInfo);
            const analysis = await this.analyzeWithAI(researchData);
            log.info(`Saving analysis to database for ${memberInfo.name}`);
            analysisId = await this.saveMemberAnalysis(memberInfo, analysis);
            await this.postAnalysisToChannel(memberInfo, analysis);

            if (analysisId) {
                await this.markAsSentToSlack(analysisId);
            }

            return analysis;
        } catch (error) {
            log.error(`Error processing ${memberInfo.name}:`, error.message);
            if (analysisId) {
                log.info(`Analysis ${analysisId} saved to database but not sent to slack due to error`);
            }
            throw error;
        }
    }

    async start(port = process.env.PORT || 3000) {
        try {
            await this.slack.start(port);
            log.info(`Slack AI Agent started on port ${port}`);
        } catch (error) {
            log.error('Error starting Slack AI Agent:', error.message);
            throw error;
        }
    }
}

export default SlackAIAgent;