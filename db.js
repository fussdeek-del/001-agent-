// db.js
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

// Load environment variables from .env file [2]
dotenv.config();

// Create a connection pool [2]
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Allow SSL without certificate verification [2]
  },
  max: 20, // Maximum number of clients in the pool [2]
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds [2]
  connectionTimeoutMillis: 2000 // Fail if connection takes longer than 2 seconds [2]
});

// Event listener for new connections [3]
pool.on('connect', () => {
  console.log('database connected');
});

// Event listener for unexpected errors from idle clients [3]
pool.on('error', (err) => {
  console.error('unexpected database error', err);
});

// Function to initialize the database table and indexes [3]
export async function initDatabase() {
  const client = await pool.connect(); // Acquire a client from the pool [3]
  try {
    // Create member_analysis table if it doesn't exist [3, 4]
    await client.query(`
      CREATE TABLE IF NOT EXISTS member_analysis (
        id SERIAL PRIMARY KEY,
        member_id TEXT,
        member_name TEXT,
        member_email TEXT,
        member_title TEXT,
        member_time_zone TEXT,
        fit_score INTEGER,
        insights JSONB,
        recommendations JSONB,
        research_data JSONB,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_to_slack BOOLEAN DEFAULT FALSE,
        sent_to_slack_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for efficient lookups [5]
    await client.query('CREATE INDEX IF NOT EXISTS idx_member_id ON member_analysis(member_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analyzed_at ON member_analysis(analyzed_at);');

    console.log('database schema initialized');
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    client.release(); // Always release the client back to the pool [3]
  }
}

// Function to save analysis results to the database [5]
export async function saveMemberAnalysis(memberInfo, analysis, researchData) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO member_analysis (
        member_id, member_name, member_email, member_title, 
        member_time_zone, fit_score, insights, 
        recommendations, research_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    
    // Use parameterized queries to prevent SQL injection [5, 6]
    const values = [
      memberInfo.id || null,
      memberInfo.name,
      memberInfo.email || null,
      memberInfo.title || null,
      memberInfo.timeZone || null,
      analysis.fitScore,
      JSON.stringify(analysis.insights), // Serialize arrays to JSON strings [6]
      JSON.stringify(analysis.recommendations),
      JSON.stringify(researchData)
    ];

    const result = await client.query(query, values);
    const analysisId = result.rows.id;
    console.log(`Analysis saved to database with ID: ${analysisId}`);
    return analysisId;
  } catch (error) {
    console.error('fail to save analysis to database', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to update record when Slack post succeeds [7]
export async function markAsSentToSlack(analysisId) {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE member_analysis 
      SET sent_to_slack = true, 
          sent_to_slack_at = CURRENT_TIMESTAMP, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [analysisId]);
  } catch (error) {
    console.error('failed to mark as sent to Slack', error);
    throw error;
  } finally {
    client.release();
  }
}

// Function to gracefully close the connection pool [8]
export async function closeDatabase() {
  await pool.end();
  console.log('database connection pool closed');
}

// Export the pool as default [8]
export default pool;