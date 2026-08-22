import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import { requestContextMiddleware } from "./request-context.middleware.js";
import { loggingMiddleware } from "./logging.middleware.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.use(loggingMiddleware);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
