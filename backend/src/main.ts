import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { CryptoTraceContextService } from './crypto/services/crypto-trace-context.service';

async function bootstrap() {
  // TLS is terminated at the nginx reverse proxy — backend uses plain HTTP internally
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Cookie parser
  app.use(cookieParser());

  const traceContext = app.get(CryptoTraceContextService);

  app.use((req: any, _res: any, next: () => void) => {
    const actionId = String(req.headers['x-action-id'] || randomUUID());
    const actionName = `${req.method} ${req.originalUrl || req.url}`;

    // Setup crypto trace context with userId from JWT if available
    traceContext.runWithContext(actionId, actionName, () => {
      const userId = req.user?.sub;
      if (userId) {
        traceContext.setUserId(userId);
      }
      return next();
    });
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  const corsOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3002',
    ...(process.env.ENABLE_CRYPTO_MONITOR === 'true' && process.env.MONITOR_URL
      ? [process.env.MONITOR_URL]
      : []),
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api`);
}
bootstrap();
