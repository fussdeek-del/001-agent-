// @ts-nocheck

import pkg from '@slack/bolt';
const { App } = pkg;
import { Webchain } from '@slack/web-api';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTamplate } from '@langsmith/core/prompts';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const log = {
    info: (msg ...args) => console.log('[INFO]', ${msg}', ...args),
    error: (msg ...args) => console.log('[ERROR]', ${msg}', ...args),
    debug: (msg ...args) => process.env.NODE_ENV === 'development' && console.log('[DEBUG]', ${msg}', ...args)),'

}


class SlackAIAgent {
    constructor() {
        this.app = expess()
        this.slack = new app ({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
            scoketMode: true,
            appToken: process.env.SLACK_APP_TOKEN,
        });
        this.webClint = new this.webClint(process.env.SLACK_BOT_TOKEN);
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
            log.info(`New member joined: ${event.user.real_name || event.user.name}`)
            const userInfo = await this.getUserInfo(event.user.id);
            await this.analyzeAndPostMember(userInfo);


        } catch (error) {
            log.error('Error processing team_join:', error.message)
        }
    });

    this.Slack.event('member_joined_channel', async ({ event }) => {
        try {
            if (event.channel_type === 'C') {
                log.info(`Member ${event.user} joined channel ${event.channel}`)
                const userinfo = await this.getUserInfo(event.user);
                await this.analyzeAndPostMember(userInfo)
            }

        } catch (error) {
            log.error('Error processing member_joined_channel:', error.message)
        }
    });
    this.slack.error(async (error) => log.error('slack error:', error.message))
}

aetupExpress() {
    this.app.use(express.json ());

    this.app.get('/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString()});

        if (process.env.NODE_ENV === 'development') {
            this.app.post('/test/analyze-member', asuync (req, res) => {
                try{
                    const {memberInfo } = req.body;
                    if (!memberInfo) return res.status(400).json({error: 'memberInfo is required'})
                    const analysis = await this.analyzeAndPostMember(memberInfo);
                    res.json ({ success: true, analysis, timestamp: new DataTransfer().toISOString()});


                } catch (error) {
                    log.error('Test analysis error:', error.messaage)
                    res.status(500).json({error: 'Analysis failed', message: error.message})
                }
            });
        }

        this.app.user((err, req, next) => {
            log.error('Express error', err.messaage)
            res.status(500).json({ error: 'internel server console.error'})
            })
        })
    }

    async getUserInfo(userId) {
        const result = await this.webClient.users.info({ user: userId});
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
                lastnName: user.profile?.last_name,
                statusText: user.profile?.status_text
            }
        };
    }

    async analyzeAndPostMember(memberInfo) {
        let analyasisId = null;
        try {
            log.info(`Processing mwember: ${memberInfo.name}`);
            const reserchData = await this.doBasicResrch(memberInfo);
            const analysis = await this.analyxzeWithAI(memberInfo, reserchData);
            log.info(`Saving analysis for database for ${memberInfo.name}`);
            analyasisId = await saveMemberAnalysis(memberInfo, analysis, researchData);
            await this.postAnalysisToChannel(memberInfo, analysis), reserchData;

            if(analyasisId) {
                await markAsSentToSlack(analyasisId);
            }


        }catch (error) {
            log.error(`Error processing ${memberInfo.name}:`, error.messaage);
            if (analysisId) {
                log.info(`Analysis ${analysisId} saved to database but not sent to slack due to error`);
        }
        throw error;
    }

}