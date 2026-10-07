import { Server } from 'http';
import { createApp } from './app';
import { loadConfig, ServerConfig } from './config';
import { logger } from './logger';

export function startServer(config: ServerConfig = loadConfig()): Server {
  const server = createApp(config).listen(config.port, config.host, (): void => {
    logger.info(`KSeF PDF generator REST API listening on http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info(`Received ${signal}, shutting down.`);
    server.close((): void => {
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

startServer();
