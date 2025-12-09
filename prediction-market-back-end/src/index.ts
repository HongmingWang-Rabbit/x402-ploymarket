import { buildApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initDatabase } from './db/init.js';

async function main() {
  try {
    // Initialize database (creates tables if needed)
    await initDatabase();

    const app = await buildApp();

    await app.listen({ port: config.port, host: '0.0.0.0' });

    logger.info(
      { port: config.port, env: config.nodeEnv },
      'Server started successfully'
    );

    if (config.isDev) {
      logger.info(`Swagger docs available at http://localhost:${config.port}/docs`);
    }
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
