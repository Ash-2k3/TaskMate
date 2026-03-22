import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the mock tick function that cron schedule() registers
let mockTickFn: (() => void) | null = null;

// Mock keyword-extractor (used by weekly summary trigger)
vi.mock('../main/keyword-extractor', () => ({
  extractTopKeyword: vi.fn().mockReturnValue('focus'),
}));

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

// Mock settings-store for reflection trigger tests
const mockSettingsGet = vi.fn();
const mockSettingsSet = vi.fn();
vi.mock('../main/settings-store', () => ({
  settingsStore: {
    get: mockSettingsGet,
    set: mockSettingsSet,
  },
}));

// Create mock DataService
const mockGetTasksDueForReminder = vi.fn();
const mockGetTasksDueForRenotification = vi.fn();
const mockUpdateTask = vi.fn();
const mockHasReflection = vi.fn();
const mockHasWeeklySummary = vi.fn().mockReturnValue(false);
const mockGetWeeklySummaryStats = vi.fn().mockReturnValue({ tasks_created: 5, tasks_completed: 3, completion_rate: 60 });
const mockGetDeferredTasks = vi.fn().mockReturnValue([]);
const mockGetReflectionsForWeek = vi.fn().mockReturnValue([]);
const mockSaveWeeklySummary = vi.fn();

const mockDataService = {
  getTasksDueForReminder: mockGetTasksDueForReminder,
  getTasksDueForRenotification: mockGetTasksDueForRenotification,
  updateTask: mockUpdateTask,
  hasReflection: mockHasReflection,
  hasWeeklySummary: mockHasWeeklySummary,
  getWeeklySummaryStats: mockGetWeeklySummaryStats,
  getDeferredTasks: mockGetDeferredTasks,
  getReflectionsForWeek: mockGetReflectionsForWeek,
  saveWeeklySummary: mockSaveWeeklySummary,
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
    mockHasReflection.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockSettingsGet.mockReturnValue(null); // no snooze by default
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
    mockHasReflection.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockSettingsGet.mockReturnValue(null);
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
    mockHasReflection.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockShow.mockReset();
    mockFocus.mockReset();
    mockTickFn = null;
  });

  it('calls mainWindow.show() and mainWindow.focus() on click (notification)', async () => {
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

describe('reflection trigger', () => {
  const mockSend = vi.fn();
  const mockReflectionWindow = vi.fn(() => ({
    isDestroyed: () => false,
    webContents: { send: mockSend },
  }));

  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([]);
    mockHasReflection.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockSend.mockReset();
    mockTickFn = null;
  });

  it('sends prompt:reflection at 21:00 when no reflection saved', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 21, 0, 0); // local 21:00

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not send prompt:reflection before 21:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 20, 59, 0); // local 20:59

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not send prompt:reflection if already saved today', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(true);
    const fakeNow = new Date(2024, 0, 15, 21, 5, 0); // local 21:05

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not re-fire on second tick (once-per-day guard)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 21, 1, 0); // local 21:01

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();
    mockTickFn!(); // second tick — same date

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('does not send when snoozeUntil is in the future', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 21, 5, 0); // local 21:05
    const snoozeUntil = new Date(2024, 0, 15, 21, 35, 0).toISOString(); // local 21:35
    mockSettingsGet.mockReturnValue(snoozeUntil);

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });
});

describe('weekly summary trigger', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForReminder.mockReturnValue([]);
    mockGetTasksDueForRenotification.mockReturnValue([]);
    mockHasReflection.mockReturnValue(false);
    mockSettingsGet.mockReturnValue(null);
    mockHasWeeklySummary.mockReset();
    mockHasWeeklySummary.mockReturnValue(false);
    mockGetWeeklySummaryStats.mockReturnValue({ tasks_created: 5, tasks_completed: 3, completion_rate: 60 });
    mockGetDeferredTasks.mockReturnValue([]);
    mockGetReflectionsForWeek.mockReturnValue([]);
    mockSaveWeeklySummary.mockReset();
    mockTickFn = null;
  });

  it('generates summary and fires notification on Sunday at 20:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    // Sunday 2024-01-14 at 20:00 local (new Date(year, month, day, hour, minute, second))
    const fakeNow = new Date(2024, 0, 14, 20, 0, 0); // Sunday Jan 14 2024, 20:00 local

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).toHaveBeenCalledTimes(1);
    const summaryNotif = MockNotificationInstances.find(
      (n) => n.title === 'TaskMate' && n.body === 'Your weekly summary is ready'
    );
    expect(summaryNotif).toBeDefined();
    expect(summaryNotif!.show).toHaveBeenCalled();
  });

  it('does not regenerate summary on second tick same Sunday (module-level guard)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    const fakeNow = new Date(2024, 0, 14, 20, 1, 0); // Sunday Jan 14, 20:01

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();
    mockTickFn!(); // second tick same Sunday

    expect(mockSaveWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it('does not generate summary when DB guard says already exists (app restart case)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasWeeklySummary.mockReturnValue(true); // DB already has summary
    const fakeNow = new Date(2024, 0, 14, 20, 0, 0); // Sunday Jan 14, 20:00

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });

  it('does not generate summary on Monday at 20:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    const fakeNow = new Date(2024, 0, 15, 20, 0, 0); // Monday Jan 15, 20:00

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });

  it('does not generate summary on Sunday before 20:00 (19:59)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    const fakeNow = new Date(2024, 0, 14, 19, 59, 0); // Sunday Jan 14, 19:59

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });
});
