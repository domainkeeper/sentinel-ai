import "dotenv/config";
import { loadConfig } from "./config/env.js";
import { openDatabase } from "./db/connection.js";
import { createApp } from "./app.js";

async function main() {
  const config = loadConfig();

  const db = openDatabase({ databasePath: config.databasePath });
  const { app, scheduler, agents } = createApp(db, config);

  // Recover persisted scheduling state so autonomous cycles resume after a restart.
  scheduler.recover(agents.listAll());

  const server = app.listen(config.port, () => {
    console.log(`[sentinel-ai] API listening on http://localhost:${config.port} (${config.env})`);
    // Start the scheduler only after the server is listening.
    scheduler.start();
  });

  const shutdown = async () => {
    console.log("[sentinel-ai] shutting down...");
    await scheduler.stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("[sentinel-ai] failed to start:", err);
  process.exit(1);
});