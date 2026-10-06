import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3101);
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED ??
    (process.env.NODE_ENV === 'production' ? 'false' : 'true');

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (swaggerEnabled === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Projet individuel 26 - Catalog Service')
      .setDescription(
        'Microservice propriétaire des annonces, de la modération et des médias.',
      )
      .setVersion('0.2.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
      .build();

    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
