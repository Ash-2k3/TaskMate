import Store from 'electron-store';

interface Settings {
  reflectionTime: string;
  minimizeToTray: boolean;
  openAtLogin: boolean;
  theme: 'system' | 'light' | 'dark';
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  timezone: string;
  lastSeenReflectionDate: string | null;
  hasLaunched: boolean;
  snoozeUntil: string | null;
}

export const settingsStore = new Store<Settings>({
  name: 'settings',
  schema: {
    reflectionTime: { type: 'string', default: '21:00' },
    minimizeToTray: { type: 'boolean', default: true },
    openAtLogin: { type: 'boolean', default: true },
    theme: { type: 'string', enum: ['system', 'light', 'dark'], default: 'system' },
    windowBounds: { default: null },
    timezone: { type: 'string', default: Intl.DateTimeFormat().resolvedOptions().timeZone },
    lastSeenReflectionDate: { default: null },
    hasLaunched: { type: 'boolean', default: false },
    snoozeUntil: { default: null },
  },
  migrations: {
    '0.1.0': (_store) => {
      // Initial schema — establishes migration pattern
    },
  },
});
