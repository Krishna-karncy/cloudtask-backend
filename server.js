const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const APP_NAME = process.env.APP_NAME || 'cloudtask-backend';

// Enable CORS for Tier 1 Frontend (CloudFront, S3 or local development)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin === '*' ? '*' : allowedOrigin.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 1. Health check endpoint (Tier 2 & Tier 3 status)
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbTime = null;

  try {
    const dbRes = await pool.query('SELECT NOW() as current_time');
    dbStatus = 'connected';
    dbTime = dbRes.rows[0].current_time;
  } catch (err) {
    dbStatus = 'error: ' + err.message;
  }

  res.status(200).json({
    service: APP_NAME,
    tier: 'Tier 2 (Application Layer)',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      tier: 'Tier 3 (Database Layer)',
      status: dbStatus,
      time: dbTime
    }
  });
});

// 2. GET all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
    res.status(200).json({
      count: rows.length,
      tasks: rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

// 3. POST create task
app.post('/api/tasks', async (req, res) => {
  const { title, description, status, priority } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  try {
    const query = `
      INSERT INTO tasks (title, description, status, priority, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [title, description || '', status || 'pending', priority || 'medium'];
    const { rows } = await pool.query(query, values);

    res.status(201).json({
      message: 'Task created successfully',
      task: rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// 4. PUT update task status / priority
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { status, priority, title, description } = req.body;

  try {
    const query = `
      UPDATE tasks
      SET 
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;
    const values = [status, priority, title, description, id];
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({
      message: 'Task updated successfully yahooo!',
      task: rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

// 5. DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully', id: Number(id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Tier 2 Backend] Server running on http://localhost:${PORT}`);
});
