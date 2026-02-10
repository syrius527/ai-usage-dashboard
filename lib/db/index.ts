import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');

function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function createDatabase() {
  ensureDataDir();
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  return sqlite;
}

const sqlite = createDatabase();

export const db = drizzle(sqlite, { schema });

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token_encrypted TEXT NOT NULL,
      token_hint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected', 'error', 'expired')),
      last_error TEXT,
      last_sync_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS usage_cache (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      five_hour_utilization REAL,
      five_hour_resets_at INTEGER,
      seven_day_utilization REAL,
      seven_day_resets_at INTEGER,
      seven_day_opus_utilization REAL,
      seven_day_opus_resets_at INTEGER,
      fetched_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_cache_account ON usage_cache(account_id)
  `);
}

initializeDatabase();
