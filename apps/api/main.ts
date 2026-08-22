import "reflect-metadata";
import { createApp } from "./create-app.js";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
