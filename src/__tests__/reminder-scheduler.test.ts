import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the mock tick function that cron schedule() registers
let mockTickFn: (() => void) | null = null;

// Capture the mock notification constructor calls
const MockNotificationInstances: Array<{
  title: string;
  body: string;
  handlers: Record<string, () => void>;
  show: ReturnType<typeof vi.fn>;
}> = [];

class MockNotification {
  title: string;
  body: string;
  handlers: Record<string, () => void> = {};
  show = vi.fn();

  constructor(opts: { title: string; body: string }) {
    this.title = opts.title;
    this.body = opts.body;
    MockNotificationInstances.push(this);
  }

  on(event: string, handler: () => void) {
    this.handlers[event] = handler;
  }
}

const mockPowerMonitorHandlers: Record<string, () => void> = {};

vi.mock('electron', () => ({
  Notification: MockNotification,
  powerMonitor: {
    on: vi.fn((event: string, handler: () => void) => {
      mockPowerMonitorHandlers[event] = handler;
    }),
  },
}));

vi.mock('node-cron', () => ({
  schedule: vi.fn((_expr: string, fn: () => void) => {
    mockTickFn = fn;
    return { stop: vi.fn() };
  }),
}));

// Create mock DataService
const mockGetTasksDueForReminder = vi.fn();
const mockGetTasksDueForRenotification = vi.fn();
const mockUpdateTask = vi.fn();

const mockDataService = {
  getTasksDueForReminder: mockGetTasksDueForReminder,
  getTasksDueForRenotification: mockGetTasksDueForRenotification,
  updateTask: mockUpdateTask,
};

// Create mock getMainWindow
const mockShow = vi.fn();
const mockFocus = vi.fn();
const mockGetMainWindow = vi.fn(() => ({ show: mockShow, focus: mockFocus }));

// Helper: build a minimal Task object
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    title: 'Buy milk',
    due_date: '2024-01-15',
    priority: 'medium',
    completed: 0,
    completed_at: null,
    created_at: '2024-01-15T08:00:00.000Z',
    updated_at: '2024-01-15T08:00:00.000Z',
    notified_at: null,
    renotified: 0,
    reminder_time: '09:00',
    ...overrides,
  };
}

describe('scheduler tick', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForReminder.mockReset();
    mockGetTasksDueForRenotification.mockReset();
    mockUpdateTask.mockReset();
    mockTickFn = null;
  });

  it('fires notification for task due at current HH:MM', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:00:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([makeTask()]);
    mockGetTasksDueForRenotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    expect(mockTickFn).toBeDefined();
    mockTickFn!();

    // Notification was created with correct title and body
    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.title).toBe('TaskMate Reminder');
    expect(notif.body).toBe('Buy milk');
    expect(notif.show).toHaveBeenCalled();

    // updateTask called with notified_at
    expect(mockUpdateTask).toHaveBeenCalledWith('1', {
      notified_at: expect.any(String),
    });
  });

  it('does not fire if no tasks due', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:00:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBe(0);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});

describe('re-notification', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForReminder.mockReset();
    mockGetTasksDueForRenotification.mockReset();
    mockUpdateTask.mockReset();
    mockTickFn = null;
  });

  it('fires re-notification 10 min after notified_at', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:10:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([
      makeTask({ notified_at: '2024-01-15T09:00:00.000Z', renotified: 0 }),
    ]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.body).toBe('Still incomplete \u2014 Buy milk');
    expect(mockUpdateTask).toHaveBeenCalledWith('1', { renotified: 1 });
  });

  it('suppresses re-notification at 20:30', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    // At 20:30, time is NOT < '20:30', so re-notification is suppressed
    const fakeNow = new Date('2024-01-15T20:30:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBe(0);
  });

  it('fires re-notification at 20:29', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T20:29:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([
      makeTask({ notified_at: '2024-01-15T10:00:00.000Z', renotified: 0 }),
    ]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.body).toBe('Still incomplete \u2014 Buy milk');
  });

  it('does not re-fire task with renotified=1', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:15:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([]);
    // getTasksDueForRenotification returns empty because DataService filters renotified=1
    mockGetTasksDueForRenotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBe(0);
  });
});

describe('notification click', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForReminder.mockReset();
    mockGetTasksDueForRenotification.mockReset();
    mockUpdateTask.mockReset();
    mockShow.mockReset();
    mockFocus.mockReset();
    mockTickFn = null;
  });

  it('calls mainWindow.show() and mainWindow.focus() on click', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:00:00.000Z');
    mockGetTasksDueForReminder.mockReturnValue([makeTask()]);
    mockGetTasksDueForRenotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, {
      getNow: () => fakeNow,
    });

    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.handlers['click']).toBeDefined();

    // Trigger the click handler
    notif.handlers['click']();

    expect(mockShow).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });
});
