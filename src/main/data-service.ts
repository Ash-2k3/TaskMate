import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export interface Task {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: 0 | 1;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  notified_at: string | null;
  renotified: 0 | 1;
  reminder_time: string | null;  // HH:MM 24h format — Phase 3
}

export interface CreateTaskInput {
  title: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  reminder_time?: string | null;  // per D-06
}

export interface UpdateTaskInput {
  title?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  reminder_time?: string | null;    // per D-06
  notified_at?: string | null;      // per D-07
  renotified?: 0 | 1;              // per D-07
}

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
        fs.copyFileSync(dbPath, backupPath);
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

    // Phase 3 migration: add reminder_time column (safe to run multiple times)
    const columns = this.db.pragma('table_info(tasks)') as Array<{ name: string }>;
    const hasReminderTime = columns.some(c => c.name === 'reminder_time');
    if (!hasReminderTime) {
      this.db.exec('ALTER TABLE tasks ADD COLUMN reminder_time TEXT');
    }
  }

  close(): void {
    this.db.close();
  }

  getAllTasks(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
      ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at ASC
    `);
    return stmt.all() as Task[];
  }

  createTask(input: CreateTaskInput): Task {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = input.priority ?? 'medium';
    const due_date = input.due_date ?? null;
    const reminder_time = input.reminder_time ?? null;

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time)
      VALUES (?, ?, ?, ?, 0, NULL, ?, ?, NULL, 0, ?)
    `);
    stmt.run(id, input.title, due_date, priority, now, now, reminder_time);

    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
    return row;
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.due_date);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.reminder_time !== undefined) {
      fields.push('reminder_time = ?');
      values.push(updates.reminder_time);
    }
    if (updates.notified_at !== undefined) {
      fields.push('notified_at = ?');
      values.push(updates.notified_at);
    }
    if (updates.renotified !== undefined) {
      fields.push('renotified = ?');
      values.push(updates.renotified);
    }

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    if (result.changes === 0) return null;

    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
  }

  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  completeTask(id: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?
    `);
    const result = stmt.run(now, now, id);
    return result.changes > 0;
  }

  getTaskCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    return row.count;
  }

  getMissedReminders(): Task[] {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
        AND due_date < ?
        AND reminder_time IS NOT NULL
        AND notified_at IS NULL
    `);
    return stmt.all(today) as Task[];
  }

  dismissMissedReminders(ids: string[]): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE tasks SET notified_at = ?, updated_at = ? WHERE id = ?');
    const transaction = this.db.transaction((taskIds: string[]) => {
      for (const id of taskIds) {
        stmt.run(now, now, id);
      }
    });
    transaction(ids);
  }

  getTasksDueForReminder(todayDate: string, currentHHMM: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
        AND due_date = ?
        AND reminder_time IS NOT NULL
        AND reminder_time <= ?
        AND notified_at IS NULL
    `);
    return stmt.all(todayDate, currentHHMM) as Task[];
  }

  getTasksDueForRenotification(todayDate: string, cutoffTime: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
        AND due_date = ?
        AND notified_at IS NOT NULL
        AND renotified = 0
        AND datetime(notified_at, '+10 minutes') <= datetime('now')
        AND ? < '20:30'
    `);
    return stmt.all(todayDate, cutoffTime) as Task[];
  }

  // Phase 4 — Reflection methods

  hasReflection(dateStr: string): boolean {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM reflections WHERE date = ?").get(dateStr) as { count: number };
    return row.count > 0;
  }

  getCompletedTaskCountToday(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND date(completed_at) = date('now', 'localtime')").get() as { count: number };
    return row.count;
  }

  saveReflection(date: string, q1: string | null, q2: string | null, q3: string | null): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare("INSERT OR REPLACE INTO reflections (date, q1, q2, q3, completed_at) VALUES (?, ?, ?, ?, ?)");
    stmt.run(date, q1, q2, q3, now);
  }

  getAllReflections(): Array<{ date: string; q1: string | null; q2: string | null; q3: string | null; completed_at: string }> {
    const stmt = this.db.prepare("SELECT * FROM reflections ORDER BY date DESC");
    return stmt.all() as Array<{ date: string; q1: string | null; q2: string | null; q3: string | null; completed_at: string }>;
  }
}
