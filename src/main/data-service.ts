import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export class DataService {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'taskmate.db');

    this.db = new Database(dbPath);

    // CRITICAL: WAL mode FIRST, before any other operation
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Backup before schema init (safe even on first run — skips if no file)
    this.createBackup();

    this.initSchema();
  }

  private createBackup(): void {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'taskmate.db');
    const backupPath = path.join(userDataPath, 'taskmate.db.backup');
    try {
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
        this.db.backup(backupPath);
      }
    } catch (err) {
      console.error('Backup failed (non-fatal):', err);
    }
  }

  private initSchema(): void {
    this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          due_date TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          notified_at TEXT,
          renotified INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS reflections (
          date TEXT PRIMARY KEY,
          q1 TEXT,
          q2 TEXT,
          q3 TEXT,
          completed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weekly_summaries (
          week_of TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          data TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
      `);
    })();
  }

  close(): void {
    this.db.close();
  }
}
