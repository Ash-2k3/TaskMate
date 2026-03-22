import { describe, it, vi } from 'vitest';

vi.mock('electron', () => ({
  Notification: class {
    title = '';
    body = '';
    show() {}
  },
  powerMonitor: {
    on: vi.fn(),
  },
}));

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
  schedule: vi.fn(),
}));

describe('scheduler tick', () => {
  it.todo('fires notification for due task at matching HH:MM');
});

describe('re-notification', () => {
  it.todo('fires re-notification 10 min after notified_at');
  it.todo('suppresses re-notification at or after 20:30');
});

describe('startup catch-up', () => {
  it.todo('skips tasks with existing notified_at');
});
