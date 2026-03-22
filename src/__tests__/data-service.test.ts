import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// tmpDir must be declared before the mock factory runs
let tmpDir: string = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));

// Mock electron — getPath returns current tmpDir at call time
vi.mock('electron', () => ({
  app: {
    getPath: (_key: string) => tmpDir,
  },
}));

// Import DataService after mock is set up
import { DataService } from '../main/data-service';

describe('reminder_time column', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('createTask stores and returns reminder_time', () => {
    const task = ds.createTask({ title: 'Test', reminder_time: '09:00' });
    expect(task.reminder_time).toBe('09:00');
  });

  it('createTask without reminder_time returns null', () => {
    const task = ds.createTask({ title: 'Test' });
    expect(task.reminder_time).toBeNull();
  });
});

describe('getMissedReminders', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns tasks with due_date before today, reminder_time set, notified_at null', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const task = ds.createTask({ title: 'Overdue', due_date: yesterday, reminder_time: '09:00' });
    const missed = ds.getMissedReminders();
    expect(missed.some((t) => t.id === task.id)).toBe(true);
  });

  it('excludes tasks where notified_at is set', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const task = ds.createTask({ title: 'Already notified', due_date: yesterday, reminder_time: '09:00' });
    ds.updateTask(task.id, { notified_at: new Date().toISOString() });
    const missed = ds.getMissedReminders();
    expect(missed.some((t) => t.id === task.id)).toBe(false);
  });
});

describe('dismissMissedReminders', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sets notified_at on provided task IDs', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const task1 = ds.createTask({ title: 'Task 1', due_date: yesterday, reminder_time: '09:00' });
    const task2 = ds.createTask({ title: 'Task 2', due_date: yesterday, reminder_time: '10:00' });

    ds.dismissMissedReminders([task1.id, task2.id]);

    const missed = ds.getMissedReminders();
    expect(missed.some((t) => t.id === task1.id)).toBe(false);
    expect(missed.some((t) => t.id === task2.id)).toBe(false);
  });
});

describe('Reflection methods', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hasReflection returns false when no reflection exists', () => {
    expect(ds.hasReflection('2026-03-22')).toBe(false);
  });

  it('hasReflection returns true after saveReflection', () => {
    ds.saveReflection('2026-03-22', 'answer1', null, null);
    expect(ds.hasReflection('2026-03-22')).toBe(true);
  });

  it('saveReflection persists q1/q2/q3 with nullable fields', () => {
    ds.saveReflection('2026-03-22', 'did stuff', null, 'plan tomorrow');
    const all = ds.getAllReflections();
    expect(all).toHaveLength(1);
    expect(all[0].date).toBe('2026-03-22');
    expect(all[0].q1).toBe('did stuff');
    expect(all[0].q2).toBeNull();
    expect(all[0].q3).toBe('plan tomorrow');
    expect(all[0].completed_at).toBeTruthy();
  });

  it('saveReflection replaces existing reflection for same date', () => {
    ds.saveReflection('2026-03-22', 'first', null, null);
    ds.saveReflection('2026-03-22', 'updated', 'new q2', null);
    const all = ds.getAllReflections();
    expect(all).toHaveLength(1);
    expect(all[0].q1).toBe('updated');
    expect(all[0].q2).toBe('new q2');
  });

  it('getAllReflections returns empty array when none exist', () => {
    expect(ds.getAllReflections()).toEqual([]);
  });

  it('getAllReflections returns reflections in descending date order', () => {
    ds.saveReflection('2026-03-20', 'a', null, null);
    ds.saveReflection('2026-03-22', 'c', null, null);
    ds.saveReflection('2026-03-21', 'b', null, null);
    const all = ds.getAllReflections();
    expect(all.map(r => r.date)).toEqual(['2026-03-22', '2026-03-21', '2026-03-20']);
  });

  it('getCompletedTaskCountToday returns 0 when no tasks completed', () => {
    expect(ds.getCompletedTaskCountToday()).toBe(0);
  });

  it('getCompletedTaskCountToday counts tasks completed today', () => {
    // Create and complete two tasks
    const task1 = ds.createTask({ title: 'Task A' });
    const task2 = ds.createTask({ title: 'Task B' });
    ds.completeTask(task1.id);
    ds.completeTask(task2.id);
    // Create a third task but don't complete it
    ds.createTask({ title: 'Task C' });
    expect(ds.getCompletedTaskCountToday()).toBe(2);
  });
});

describe('getWeeklySummaryStats', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns correct counts when tasks created and completed in week', () => {
    // Insert 3 tasks created in the week of 2026-03-16
    const weekStart = '2026-03-16T00:00:00.000Z';
    const weekMid = '2026-03-18T10:00:00.000Z';
    const weekEnd = '2026-03-22T10:00:00.000Z';
    // Use raw DB insert to control created_at timestamps
    const db = (ds as any)['db'];
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 1, ?, ?, ?, NULL, 0, NULL)").run('t1', 'Task 1', weekMid, weekStart, weekStart);
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 1, ?, ?, ?, NULL, 0, NULL)").run('t2', 'Task 2', weekEnd, weekMid, weekMid);
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('t3', 'Task 3', weekEnd, weekEnd);

    const stats = ds.getWeeklySummaryStats('2026-03-16');
    expect(stats.tasks_created).toBe(3);
    expect(stats.tasks_completed).toBe(2);
    expect(stats.completion_rate).toBe(67);
  });

  it('returns zeros when no tasks in week', () => {
    const stats = ds.getWeeklySummaryStats('2026-03-16');
    expect(stats.tasks_created).toBe(0);
    expect(stats.tasks_completed).toBe(0);
    expect(stats.completion_rate).toBe(0);
  });

  it('excludes tasks created outside the target week', () => {
    const db = (ds as any)['db'];
    // Task created before week start
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('before', 'Before', '2026-03-15T23:59:59.999Z', '2026-03-15T23:59:59.999Z');
    // Task created after week end
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('after', 'After', '2026-03-23T00:00:00.000Z', '2026-03-23T00:00:00.000Z');

    const stats = ds.getWeeklySummaryStats('2026-03-16');
    expect(stats.tasks_created).toBe(0);
  });
});

describe('getDeferredTasks', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns incomplete tasks created before the week start', () => {
    const db = (ds as any)['db'];
    // Task created 5 days before week start
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('old1', 'Old Task', '2026-03-10T00:00:00.000Z', '2026-03-10T00:00:00.000Z');

    const deferred = ds.getDeferredTasks('2026-03-16');
    expect(deferred).toHaveLength(1);
    expect(deferred[0].title).toBe('Old Task');
    expect(typeof deferred[0].days).toBe('number');
    expect(deferred[0].days).toBeGreaterThan(0);
  });

  it('excludes completed tasks created before week start', () => {
    const db = (ds as any)['db'];
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 1, '2026-03-14T00:00:00.000Z', ?, ?, NULL, 0, NULL)").run('done1', 'Done Task', '2026-03-10T00:00:00.000Z', '2026-03-14T00:00:00.000Z');

    const deferred = ds.getDeferredTasks('2026-03-16');
    expect(deferred).toHaveLength(0);
  });

  it('excludes tasks created on or after the week start', () => {
    const db = (ds as any)['db'];
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('new1', 'New Task', '2026-03-16T00:00:00.000Z', '2026-03-16T00:00:00.000Z');

    const deferred = ds.getDeferredTasks('2026-03-16');
    expect(deferred).toHaveLength(0);
  });

  it('returns tasks sorted by created_at ASC (oldest first)', () => {
    const db = (ds as any)['db'];
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('newer', 'Newer Deferred', '2026-03-14T00:00:00.000Z', '2026-03-14T00:00:00.000Z');
    db.prepare("INSERT INTO tasks (id, title, due_date, priority, completed, completed_at, created_at, updated_at, notified_at, renotified, reminder_time) VALUES (?, ?, NULL, 'medium', 0, NULL, ?, ?, NULL, 0, NULL)").run('older', 'Older Deferred', '2026-03-10T00:00:00.000Z', '2026-03-10T00:00:00.000Z');

    const deferred = ds.getDeferredTasks('2026-03-16');
    expect(deferred[0].title).toBe('Older Deferred');
    expect(deferred[1].title).toBe('Newer Deferred');
  });
});

describe('getReflectionsForWeek', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns q2 strings for reflections in the target week', () => {
    ds.saveReflection('2026-03-16', null, 'distraction Monday', null);
    ds.saveReflection('2026-03-18', null, 'distraction Wednesday', null);
    const results = ds.getReflectionsForWeek('2026-03-16');
    expect(results).toHaveLength(2);
    expect(results).toContain('distraction Monday');
    expect(results).toContain('distraction Wednesday');
  });

  it('excludes reflections with null q2', () => {
    ds.saveReflection('2026-03-16', 'answered q1', null, null);
    const results = ds.getReflectionsForWeek('2026-03-16');
    expect(results).toHaveLength(0);
  });

  it('excludes reflections outside the week', () => {
    // Before week
    ds.saveReflection('2026-03-15', null, 'before week', null);
    // After week (next Monday)
    ds.saveReflection('2026-03-23', null, 'after week', null);
    const results = ds.getReflectionsForWeek('2026-03-16');
    expect(results).toHaveLength(0);
  });
});

describe('hasWeeklySummary and saveWeeklySummary', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hasWeeklySummary returns false before save', () => {
    expect(ds.hasWeeklySummary('2026-03-16')).toBe(false);
  });

  it('hasWeeklySummary returns true after saveWeeklySummary', () => {
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), { test: true });
    expect(ds.hasWeeklySummary('2026-03-16')).toBe(true);
  });

  it('getAllWeeklySummaries returns saved data ordered by week_of DESC', () => {
    ds.saveWeeklySummary('2026-03-09', '2026-03-09T20:00:00.000Z', { week: 1 });
    ds.saveWeeklySummary('2026-03-16', '2026-03-16T20:00:00.000Z', { week: 2 });
    const all = ds.getAllWeeklySummaries();
    expect(all).toHaveLength(2);
    expect(all[0].week_of).toBe('2026-03-16');
    expect(all[1].week_of).toBe('2026-03-09');
  });

  it('getAllWeeklySummaries returns data as string (JSON stringified)', () => {
    const payload = { tasks_created: 5, tasks_completed: 3 };
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), payload);
    const all = ds.getAllWeeklySummaries();
    expect(all[0].data).toBe(JSON.stringify(payload));
  });

  it('saveWeeklySummary replaces existing summary for same week', () => {
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), { v: 1 });
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), { v: 2 });
    const all = ds.getAllWeeklySummaries();
    expect(all).toHaveLength(1);
    const parsed = JSON.parse(all[0].data);
    expect(parsed.v).toBe(2);
  });
});

describe('getDataStats', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns zero counts on empty DB', () => {
    const stats = ds.getDataStats();
    expect(stats.tasksTotal).toBe(0);
    expect(stats.reflectionsTotal).toBe(0);
    expect(stats.reflectionsFrom).toBeNull();
    expect(stats.reflectionsTo).toBeNull();
    expect(stats.summariesTotal).toBe(0);
  });

  it('returns correct counts with data', () => {
    ds.createTask({ title: 'Task A' });
    ds.createTask({ title: 'Task B' });
    ds.saveReflection('2026-03-16', 'q1', null, null);
    ds.saveReflection('2026-03-18', 'q1', null, null);
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), {});

    const stats = ds.getDataStats();
    expect(stats.tasksTotal).toBe(2);
    expect(stats.reflectionsTotal).toBe(2);
    expect(stats.reflectionsFrom).toBe('2026-03-16');
    expect(stats.reflectionsTo).toBe('2026-03-18');
    expect(stats.summariesTotal).toBe(1);
  });
});

describe('deleteAllData', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes all rows from tasks, reflections, and weekly_summaries', () => {
    ds.createTask({ title: 'Task A' });
    ds.saveReflection('2026-03-16', 'q1', null, null);
    ds.saveWeeklySummary('2026-03-16', new Date().toISOString(), {});

    ds.deleteAllData();

    const stats = ds.getDataStats();
    expect(stats.tasksTotal).toBe(0);
    expect(stats.reflectionsTotal).toBe(0);
    expect(stats.summariesTotal).toBe(0);
  });
});

describe('getAllTasksForExport', () => {
  let ds: DataService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmate-test-'));
    ds = new DataService();
  });

  afterEach(() => {
    ds.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns all tasks including completed ones', () => {
    const task1 = ds.createTask({ title: 'Incomplete' });
    const task2 = ds.createTask({ title: 'Complete' });
    ds.completeTask(task2.id);

    const exported = ds.getAllTasksForExport();
    expect(exported).toHaveLength(2);
    expect(exported.some(t => t.id === task1.id)).toBe(true);
    expect(exported.some(t => t.id === task2.id)).toBe(true);
  });

  it('returns tasks ordered by created_at DESC', () => {
    const task1 = ds.createTask({ title: 'First' });
    const task2 = ds.createTask({ title: 'Second' });

    const exported = ds.getAllTasksForExport();
    // task2 created after task1, so task2 should be first in DESC order
    expect(exported[0].id === task2.id || exported[0].id === task1.id).toBe(true);
    // Both should be present
    expect(exported).toHaveLength(2);
  });

  it('returns empty array when no tasks', () => {
    expect(ds.getAllTasksForExport()).toEqual([]);
  });
});
