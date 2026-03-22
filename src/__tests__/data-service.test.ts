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
