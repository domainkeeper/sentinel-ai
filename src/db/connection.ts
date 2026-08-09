import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AppConfig } from "../config/env.js";
import { createSchema } from "./schema.js";

export function openDatabase(
  config: Pick<AppConfig, "databasePath">,
): DatabaseSync {
  const databasePath = config.databasePath;

  if (databasePath === ":memory:") {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    createSchema(db);
    return db;
  }

  const absolutePath = resolve(databasePath);

  mkdirSync(dirname(absolutePath), { recursive: true });

  console.log(`[database] opening SQLite at ${absolutePath}`);

  const db = new DatabaseSync(absolutePath);

  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
  } catch {
    // Ignore unsupported pragmas.
  }

  createSchema(db);
  return db;
}
