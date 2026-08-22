import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db';
import apiRouter, { handleHealthCheck } from './server/routes';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();

  // Basic security and parsing middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root health check endpoint for Render/uptime monitors (GET /health)
  app.get('/health', handleHealthCheck);

  // Mount API router
  app.use('/api', apiRouter);

  // Initialize PostgreSQL database and create table if not exists
  initDatabase().catch((err) => {
    console.error('Initial database setup failed:', err.message);
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Backend server listening on http://${HOST}:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📲 Device register: POST http://localhost:${PORT}/api/devices/register`);
    console.log(`🔗 Link user: POST http://localhost:${PORT}/api/devices/link-user`);
    console.log(`🐙 GitHub token exchange: POST http://localhost:${PORT}/api/github/exchange-token`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
