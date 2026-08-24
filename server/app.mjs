import express from 'express';
import { createApiRouter } from './api.mjs';

export function createApiApplication(store, { uploadDirectory } = {}) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use('/api/v1', createApiRouter(store, { uploadDirectory }));
  return app;
}
