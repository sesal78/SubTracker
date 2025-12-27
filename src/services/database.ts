import * as SQLite from 'expo-sqlite';
import { Category } from '../types';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'streaming', name: 'Streaming', icon: 'play-circle', color: '#E50914' },
  { id: 'software', name: 'Software', icon: 'laptop', color: '#0078D4' },
  { id: 'fitness', name: 'Fitness', icon: 'dumbbell', color: '#4CAF50' },
  { id: 'gaming', name: 'Gaming', icon: 'gamepad-variant', color: '#9C27B0' },
  { id: 'music', name: 'Music', icon: 'music', color: '#1DB954' },
  { id: 'news', name: 'News & Media', icon: 'newspaper', color: '#FF9800' },
  { id: 'storage', name: 'Cloud Storage', icon: 'cloud', color: '#2196F3' },
  { id: 'utilities', name: 'Utilities', icon: 'flash', color: '#FFC107' },
  { id: 'other', name: 'Other', icon: 'dots-horizontal', color: '#607D8B' },
];

let db: SQLite.SQLiteDatabase;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('subtracker.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      billing_cycle TEXT NOT NULL,
      next_billing_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      category_id TEXT DEFAULT 'other',
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      reminder_days TEXT DEFAULT '[3]',
      notification_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.icon, cat.color]
    );
  }

  await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_currency', 'USD')");
  await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_reminder_days', '[3]')");
  await db.runAsync("INSERT OR IGNORE INTO settings (key, value) VALUES ('notifications_enabled', 'true')");
}

export function getDatabase() {
  return db;
}

export async function executeSql<T>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  return db.getAllAsync<T>(sql, params);
}

export async function runSql(
  sql: string,
  params: (string | number | null)[] = []
): Promise<void> {
  await db.runAsync(sql, params);
}
