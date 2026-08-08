import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AppConfig } from "../config/env.js";
import { createSchema } from "./schema.js";

/**
 * Open a SQLite database with the Sentinel AI schema applied.
 *
 * Uses Node's built-in `node:sqlite` (DatabaseSync) — a synchronous,
 * zero-dependency driver. This avoids native module compilation issues
 * on Windows and keeps the hackathon footprint small.
 *
 * File-backed databases are created in the configured directory.
 * Passing ":memory:" yields an in-memory database (used by tests).
 */
export function openDatabase(config: Pick<AppConfig, "databasePath">): DatabaseSync {
  if (config.databasePath !== ":memory:") {
    const absolute = resolve(config.databasePath);
    mkdirSync(dirname(absolute), { recursive: true });
  }

  const db = new DatabaseSync(config.databasePath);
  // Reduce I/O stalls; WAL is optional for :memory: but harmless.
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {
    // WAL mode is not supported for in-memory databases; ignore.
  }

  createSchema(db);
  return db;
}