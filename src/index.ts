import "dotenv/config";
import { loadConfig } from "./config/env.js";
import { openDatabase } from "./db/connection.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();

  const db = openDatabase({ databasePath: config.databasePath });
  const { app } = createApp(db, config);

  const server = app.listen(config.port, () => {
    console.log(`[sentinel-ai] API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = () => {
    console.log("[sentinel-ai] shutting down...");
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[sentinel-ai] failed to start:", err);
  process.exit(1);
});