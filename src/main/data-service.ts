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
}

export interface CreateTaskInput {
  title: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateTaskInput {
  title?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
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

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified)
      VALUES (?, ?, ?, ?, 0, NULL, ?, ?, NULL, 0)
    `);
    stmt.run(id, input.title, due_date, priority, now, now);

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
}
