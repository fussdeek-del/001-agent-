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
    debug: (msg ...args) => console.log('[DEBUG]', ${msg}', ...args)
}