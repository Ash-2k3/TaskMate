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
  pre_notified: 0 | 1;                   // 30-min-before notification fired
  notified_at: string | null;             // due-time notification timestamp
  renotified: number;                     // overdue notification count (0–3)
  overdue_last_notified_at: string | null; // timestamp of last overdue notification
  reminder_time: string | null;           // HH:MM 24h format — Phase 3
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
  reminder_time?: string | null;
  pre_notified?: 0 | 1;
  notified_at?: string | null;
  renotified?: number;                     // overdue count 0–3
  overdue_last_notified_at?: string | null;
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
          pre_notified INTEGER NOT NULL DEFAULT 0,
          notified_at TEXT,
          renotified INTEGER NOT NULL DEFAULT 0,
          overdue_last_notified_at TEXT
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

    // Migrations — safe to run multiple times
    const columns = this.db.pragma('table_info(tasks)') as Array<{ name: string }>;
    const colNames = columns.map(c => c.name);
    if (!colNames.includes('reminder_time')) {
      this.db.exec('ALTER TABLE tasks ADD COLUMN reminder_time TEXT');
    }
    if (!colNames.includes('pre_notified')) {
      this.db.exec('ALTER TABLE tasks ADD COLUMN pre_notified INTEGER NOT NULL DEFAULT 0');
    }
    if (!colNames.includes('overdue_last_notified_at')) {
      this.db.exec('ALTER TABLE tasks ADD COLUMN overdue_last_notified_at TEXT');
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
      INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, pre_notified, notified_at, renotified, overdue_last_notified_at, reminder_time)
      VALUES (?, ?, ?, ?, 0, NULL, ?, ?, 0, NULL, 0, NULL, ?)
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
    if (updates.pre_notified !== undefined) {
      fields.push('pre_notified = ?');
      values.push(updates.pre_notified);
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
    if (updates.overdue_last_notified_at !== undefined) {
      fields.push('overdue_last_notified_at = ?');
      values.push(updates.overdue_last_notified_at);
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

  // Tasks to notify 30 min before their reminder_time (pre-notification)
  // thirtyAheadHHMM = currentHHMM + 30min (may exceed "23:59" as string, which is fine for comparison)
  getTasksDueForPreNotification(todayDate: string, currentHHMM: string, thirtyAheadHHMM: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
        AND due_date = ?
        AND reminder_time IS NOT NULL
        AND pre_notified = 0
        AND notified_at IS NULL
        AND reminder_time > ?
        AND reminder_time <= ?
    `);
    return stmt.all(todayDate, currentHHMM, thirtyAheadHHMM) as Task[];
  }

  // Tasks whose due time has arrived (fire "due now" notification)
  getTasksDueForDueNotification(todayDate: string, currentHHMM: string): Task[] {
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

  // Tasks past due, needing hourly overdue nudges (up to 3 times)
  getTasksDueForOverdueNotification(todayDate: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE completed = 0
        AND due_date = ?
        AND notified_at IS NOT NULL
        AND renotified < 3
        AND (
          (renotified = 0 AND datetime(notified_at, '+1 hour') <= datetime('now'))
          OR
          (renotified > 0 AND overdue_last_notified_at IS NOT NULL
            AND datetime(overdue_last_notified_at, '+1 hour') <= datetime('now'))
        )
    `);
    return stmt.all(todayDate) as Task[];
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

  // Phase 5 — Weekly Summary methods

  private getWeekEnd(weekOf: string): string {
    const d = new Date(weekOf + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().split('T')[0];
  }

  getWeeklySummaryStats(weekOf: string): { tasks_created: number; tasks_completed: number; completion_rate: number } {
    const weekStart = weekOf + 'T00:00:00.000Z';
    const weekEnd = this.getWeekEnd(weekOf) + 'T00:00:00.000Z';

    const createdRow = this.db.prepare(
      'SELECT COUNT(*) as c FROM tasks WHERE created_at >= ? AND created_at < ?'
    ).get(weekStart, weekEnd) as { c: number };

    const completedRow = this.db.prepare(
      'SELECT COUNT(*) as c FROM tasks WHERE completed = 1 AND completed_at >= ? AND completed_at < ?'
    ).get(weekStart, weekEnd) as { c: number };

    const tasks_created = createdRow.c;
    const tasks_completed = completedRow.c;
    const completion_rate = tasks_created === 0 ? 0 : Math.round((tasks_completed / tasks_created) * 100);

    return { tasks_created, tasks_completed, completion_rate };
  }

  getDeferredTasks(weekOf: string): Array<{ title: string; days: number }> {
    const weekStart = weekOf + 'T00:00:00.000Z';
    const rows = this.db.prepare(
      'SELECT title, created_at FROM tasks WHERE completed = 0 AND created_at < ? ORDER BY created_at ASC'
    ).all(weekStart) as Array<{ title: string; created_at: string }>;

    return rows.map(row => ({
      title: row.title,
      days: Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000),
    }));
  }

  getReflectionsForWeek(weekOf: string): string[] {
    const weekEnd = this.getWeekEnd(weekOf);
    const rows = this.db.prepare(
      'SELECT q2 FROM reflections WHERE date >= ? AND date < ?'
    ).all(weekOf, weekEnd) as Array<{ q2: string | null }>;

    return rows.filter(r => r.q2 !== null).map(r => r.q2 as string);
  }

  hasWeeklySummary(weekOf: string): boolean {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM weekly_summaries WHERE week_of = ?'
    ).get(weekOf) as { count: number };
    return row.count > 0;
  }

  saveWeeklySummary(weekOf: string, generatedAt: string, payload: object): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO weekly_summaries (week_of, generated_at, data) VALUES (?, ?, ?)'
    ).run(weekOf, generatedAt, JSON.stringify(payload));
  }

  getAllWeeklySummaries(): Array<{ week_of: string; generated_at: string; data: string }> {
    return this.db.prepare(
      'SELECT * FROM weekly_summaries ORDER BY week_of DESC'
    ).all() as Array<{ week_of: string; generated_at: string; data: string }>;
  }

  getDataStats(): {
    tasksTotal: number;
    reflectionsTotal: number;
    reflectionsFrom: string | null;
    reflectionsTo: string | null;
    summariesTotal: number;
  } {
    const tasksRow = this.db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number };
    const reflRow = this.db.prepare(
      'SELECT COUNT(*) as c, MIN(date) as from_d, MAX(date) as to_d FROM reflections'
    ).get() as { c: number; from_d: string | null; to_d: string | null };
    const summRow = this.db.prepare('SELECT COUNT(*) as c FROM weekly_summaries').get() as { c: number };

    return {
      tasksTotal: tasksRow.c,
      reflectionsTotal: reflRow.c,
      reflectionsFrom: reflRow.from_d,
      reflectionsTo: reflRow.to_d,
      summariesTotal: summRow.c,
    };
  }

  deleteAllData(): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM tasks').run();
      this.db.prepare('DELETE FROM reflections').run();
      this.db.prepare('DELETE FROM weekly_summaries').run();
    })();
  }

  getAllTasksForExport(): Task[] {
    return this.db.prepare(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    ).all() as Task[];
  }
}
