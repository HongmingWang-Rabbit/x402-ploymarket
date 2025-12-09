import Fastify from 'fastify';
import { registerCors } from './plugins/cors.js';
import { registerSwagger } from './plugins/swagger.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: false, // We use our own logger
  });

  // Register plugins
  await registerCors(app);

  if (config.isDev) {
    await registerSwagger(app);
  }

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await registerRoutes(app);

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info({ signal }, 'Received shutdown signal');
      await app.close();
      process.exit(0);
    });
  });

  return app;
}
