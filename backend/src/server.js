import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import aiRoutes from './routes/aiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Resilient CORS configuration
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or wildcard origins
    if (!origin || allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In cloud deployments (Render, Vercel preview), allow dynamic origin
      callback(null, true);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'actify-backend',
    environment: config.nodeEnv,
    geminiConfigured: Boolean(config.geminiApiKey),
    timestamp: new Date().toISOString(),
  });
});

// AI endpoints
app.use('/api/ai', aiRoutes);

// Static frontend serving if dist directory exists (e.g., Render unified web service deploy)
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving static frontend from: ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(config.port, () => {
  console.log(`🚀 Actify Backend running on http://localhost:${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
});

export default app;
