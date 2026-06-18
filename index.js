// @ts-nocheck

import dotenv from 'dotenv';
import SlackAIAgent from './db.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize and start the agent
const agent = new SlackAIAgent();

agent.start(PORT).catch((error) => {
    console.error('Failed to start agent:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});