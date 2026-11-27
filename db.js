const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const isLocalhost = (process.env.DB_HOST === '127.0.0.1' || process.env.DB_HOST === 'localhost');
const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cloud_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const initDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('[Tier 3 DB] Connected to PostgreSQL pool (SSL:', !isLocalhost, ').');

    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default tasks if empty
    const { rowCount } = await client.query('SELECT 1 FROM tasks LIMIT 1');
    if (rowCount === 0) {
      await client.query(`
        INSERT INTO tasks (title, description, status, priority) VALUES
        ('Deploy Tier 3 (RDS)', 'Launch private PostgreSQL database in AWS RDS', 'completed', 'high'),
        ('Deploy Tier 2 (EC2)', 'Deploy Node.js Express API on EC2 behind Nginx', 'in-progress', 'high'),
        ('Deploy Tier 1 (S3/CloudFront)', 'Host React SPA on AWS S3 and distribute via CloudFront CDN', 'pending', 'high'),
        ('Setup CI/CD Pipeline', 'Automate testing and deployment with GitHub Actions', 'pending', 'medium');
      `);
      console.log('[Tier 3 DB] Seeded initial cloud tasks.');
    }

    client.release();
  } catch (err) {
    console.warn('[Tier 3 DB] Database connection deferred:', err.message);
  }
};

initDatabase();

module.exports = pool;
