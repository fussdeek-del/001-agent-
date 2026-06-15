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


class SlackAIAgen {
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
            apiKey: process.env.OPENAI_API_KEY,
    }
}