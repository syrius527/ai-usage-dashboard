import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  agentType: text('agent_type', { enum: ['claude-code', 'codex', 'gemini-cli', 'cursor', 'other'] })
    .notNull()
    .default('claude-code'),
  plan: text('plan'),
  tokenEncrypted: text('token_encrypted').notNull(),
  tokenHint: text('token_hint').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['connected', 'error', 'expired'] })
    .notNull()
    .default('connected'),
  lastError: text('last_error'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const usageCache = sqliteTable('usage_cache', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),

  fiveHourUtilization: real('five_hour_utilization'),
  fiveHourResetsAt: integer('five_hour_resets_at', { mode: 'timestamp' }),

  sevenDayUtilization: real('seven_day_utilization'),
  sevenDayResetsAt: integer('seven_day_resets_at', { mode: 'timestamp' }),

  sevenDayOpusUtilization: real('seven_day_opus_utilization'),
  sevenDayOpusResetsAt: integer('seven_day_opus_resets_at', { mode: 'timestamp' }),

  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull(),
});

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type UsageCacheRow = typeof usageCache.$inferSelect;
export type NewUsageCacheRow = typeof usageCache.$inferInsert;
