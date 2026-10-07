import express, { Express, RequestHandler } from 'express';
import { loadConfig, ServerConfig } from './config';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import { createHealthRouter } from './routes/health.route';
import { createPdfRouter } from './routes/pdf.routes';

export const API_PREFIX = '/api/v1';

const securityHeaders: RequestHandler = (_req, res, next): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
};

export function createApp(config: ServerConfig = loadConfig()): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.use(createHealthRouter());
  app.use(API_PREFIX, createHealthRouter());
  app.use(API_PREFIX, createPdfRouter(config));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
