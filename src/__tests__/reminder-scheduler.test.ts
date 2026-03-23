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
const mockGetTasksDueForPreNotification = vi.fn();
const mockGetTasksDueForDueNotification = vi.fn();
const mockGetTasksDueForOverdueNotification = vi.fn();
const mockUpdateTask = vi.fn();
const mockHasReflection = vi.fn();
const mockHasWeeklySummary = vi.fn().mockReturnValue(false);
const mockGetWeeklySummaryStats = vi.fn().mockReturnValue({ tasks_created: 5, tasks_completed: 3, completion_rate: 60 });
const mockGetDeferredTasks = vi.fn().mockReturnValue([]);
const mockGetReflectionsForWeek = vi.fn().mockReturnValue([]);
const mockSaveWeeklySummary = vi.fn();

const mockDataService = {
  getTasksDueForPreNotification: mockGetTasksDueForPreNotification,
  getTasksDueForDueNotification: mockGetTasksDueForDueNotification,
  getTasksDueForOverdueNotification: mockGetTasksDueForOverdueNotification,
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
    pre_notified: 0,
    notified_at: null,
    renotified: 0,
    overdue_last_notified_at: null,
    reminder_time: '09:00',
    ...overrides,
  };
}

describe('scheduler tick — pre-notification (30min before)', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReset();
    mockGetTasksDueForDueNotification.mockReset();
    mockGetTasksDueForOverdueNotification.mockReset();
    mockUpdateTask.mockReset();
    mockHasReflection.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockTickFn = null;
  });

  it('fires pre-notification and sets pre_notified=1', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    // Current 08:30 → task due at 09:00 (30 min ahead)
    const fakeNow = new Date('2024-01-15T08:30:00.000Z');
    mockGetTasksDueForPreNotification.mockReturnValue([makeTask()]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.title).toBe('TaskMate');
    expect(notif.body).toContain('due in 30 minutes');
    expect(notif.show).toHaveBeenCalled();
    expect(mockUpdateTask).toHaveBeenCalledWith('1', { pre_notified: 1 });
  });

  it('does not fire if no tasks due for pre-notification', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T08:30:00.000Z');
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBe(0);
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});

describe('scheduler tick — due-time notification', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReset();
    mockGetTasksDueForDueNotification.mockReset();
    mockGetTasksDueForOverdueNotification.mockReset();
    mockUpdateTask.mockReset();
    mockHasReflection.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockTickFn = null;
  });

  it('fires due-time notification and sets notified_at', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:00:00.000Z');
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([makeTask()]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.body).toContain('due now');
    expect(notif.show).toHaveBeenCalled();
    expect(mockUpdateTask).toHaveBeenCalledWith('1', { notified_at: expect.any(String) });
  });
});

describe('scheduler tick — overdue nudges', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReset();
    mockGetTasksDueForDueNotification.mockReset();
    mockGetTasksDueForOverdueNotification.mockReset();
    mockUpdateTask.mockReset();
    mockHasReflection.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockTickFn = null;
  });

  it('fires first overdue nudge (renotified 0→1)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T10:00:00.000Z');
    const overdueTask = makeTask({ notified_at: '2024-01-15T09:00:00.000Z', renotified: 0 });
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([overdueTask]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.body).toContain('1/3');
    expect(mockUpdateTask).toHaveBeenCalledWith('1', {
      renotified: 1,
      overdue_last_notified_at: expect.any(String),
    });
  });

  it('fires third overdue nudge (renotified 2→3)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T12:00:00.000Z');
    const overdueTask = makeTask({
      notified_at: '2024-01-15T09:00:00.000Z',
      renotified: 2,
      overdue_last_notified_at: '2024-01-15T11:00:00.000Z',
    });
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([overdueTask]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    const notif = MockNotificationInstances[0];
    expect(notif.body).toContain('3/3');
    expect(mockUpdateTask).toHaveBeenCalledWith('1', {
      renotified: 3,
      overdue_last_notified_at: expect.any(String),
    });
  });

  it('does not fire overdue nudges after 10 PM (no cutoff — fires at any hour)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    // 23:00 — should still fire (no cutoff in new design)
    const fakeNow = new Date('2024-01-15T23:00:00.000Z');
    const overdueTask = makeTask({ notified_at: '2024-01-15T09:00:00.000Z', renotified: 0 });
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([overdueTask]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
  });
});

describe('notification click handler', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReset();
    mockGetTasksDueForDueNotification.mockReset();
    mockGetTasksDueForOverdueNotification.mockReset();
    mockUpdateTask.mockReset();
    mockHasReflection.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockShow.mockReset();
    mockFocus.mockReset();
    mockTickFn = null;
  });

  it('calls mainWindow.show() and mainWindow.focus() on click', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');

    const fakeNow = new Date('2024-01-15T09:00:00.000Z');
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([makeTask()]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(MockNotificationInstances.length).toBeGreaterThanOrEqual(1);
    const notif = MockNotificationInstances[0];
    expect(notif.handlers['click']).toBeDefined();
    notif.handlers['click']();

    expect(mockShow).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });
});

describe('reflection trigger', () => {
  const mockSend = vi.fn();
  const mockReflectionShow = vi.fn();
  const mockReflectionFocus = vi.fn();
  const mockReflectionWindow = vi.fn(() => ({
    isDestroyed: () => false,
    show: mockReflectionShow,
    focus: mockReflectionFocus,
    webContents: { send: mockSend },
  }));

  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);
    mockHasReflection.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockSettingsGet.mockReturnValue(null);
    mockSend.mockReset();
    mockReflectionShow.mockReset();
    mockReflectionFocus.mockReset();
    mockTickFn = null;
  });

  it('sends prompt:reflection at 22:00 when no reflection saved', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 22, 0, 0); // local 22:00

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not send prompt:reflection before 22:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 21, 59, 0); // local 21:59

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not send prompt:reflection if already saved today', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(true);
    const fakeNow = new Date(2024, 0, 15, 22, 5, 0); // local 22:05

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });

  it('does not re-fire on second tick (once-per-day guard)', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 22, 1, 0); // local 22:01

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();
    mockTickFn!(); // second tick — same date

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('does not send when snoozeUntil is in the future', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 22, 5, 0); // local 22:05
    const snoozeUntil = new Date(2024, 0, 15, 22, 35, 0).toISOString(); // local 22:35
    mockSettingsGet.mockReturnValue(snoozeUntil);

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSend).not.toHaveBeenCalledWith('prompt:reflection');
  });

  it('creates reflection notification with body "Time to reflect on your day \u{1F319}"', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 22, 0, 0); // local 22:00

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    const reflectionNotif = MockNotificationInstances.find(
      (n) => n.title === 'TaskMate' && n.body === 'Time to reflect on your day \u{1F319}'
    );
    expect(reflectionNotif).toBeDefined();
    expect(reflectionNotif!.show).toHaveBeenCalled();
  });

  it('calls win.show() and win.focus() when the reflection notification is clicked', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasReflection.mockReturnValue(false);
    const fakeNow = new Date(2024, 0, 15, 22, 0, 0); // local 22:00

    initScheduler(mockDataService as never, mockReflectionWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    const reflectionNotif = MockNotificationInstances.find(
      (n) => n.title === 'TaskMate' && n.body === 'Time to reflect on your day \u{1F319}'
    );
    expect(reflectionNotif).toBeDefined();
    expect(reflectionNotif!.handlers['click']).toBeDefined();

    reflectionNotif!.handlers['click']();

    expect(mockReflectionShow).toHaveBeenCalled();
    expect(mockReflectionFocus).toHaveBeenCalled();
  });
});

describe('weekly summary trigger', () => {
  beforeEach(() => {
    vi.resetModules();
    MockNotificationInstances.length = 0;
    mockGetTasksDueForPreNotification.mockReturnValue([]);
    mockGetTasksDueForDueNotification.mockReturnValue([]);
    mockGetTasksDueForOverdueNotification.mockReturnValue([]);
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
    // Sunday 2024-01-14 at 20:00 local
    const fakeNow = new Date(2024, 0, 14, 20, 0, 0);

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
    const fakeNow = new Date(2024, 0, 14, 20, 1, 0);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();
    mockTickFn!();

    expect(mockSaveWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it('does not generate summary when DB guard says already exists', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    mockHasWeeklySummary.mockReturnValue(true);
    const fakeNow = new Date(2024, 0, 14, 20, 0, 0);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });

  it('does not generate summary on Monday at 20:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    const fakeNow = new Date(2024, 0, 15, 20, 0, 0); // Monday

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });

  it('does not generate summary on Sunday before 20:00', async () => {
    const { initScheduler } = await import('../main/reminder-scheduler');
    const fakeNow = new Date(2024, 0, 14, 19, 59, 0);

    initScheduler(mockDataService as never, mockGetMainWindow as never, { getNow: () => fakeNow });
    mockTickFn!();

    expect(mockSaveWeeklySummary).not.toHaveBeenCalled();
  });
});
