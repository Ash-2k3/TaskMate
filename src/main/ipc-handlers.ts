import { ipcMain } from 'electron';
import type { DataService } from './data-service';
import { settingsStore } from './settings-store';

export function registerIpcHandlers(dataService: DataService): void {
  // Tasks — stubs returning empty/default data (implemented in Phase 2)
  ipcMain.handle('tasks:getAll', () => []);
  ipcMain.handle('tasks:create', (_event, task) => ({ id: 'stub', ...task }));
  ipcMain.handle('tasks:update', (_event, id, _updates) => ({ id }));
  ipcMain.handle('tasks:delete', (_event, _id) => true);
  ipcMain.handle('tasks:complete', (_event, _id) => true);

  // Reflections — stubs (implemented in Phase 4)
  ipcMain.handle('reflections:get', (_event, _date) => null);
  ipcMain.handle('reflections:save', (_event, _date, _answers) => true);

  // Settings — real implementation using electron-store
  ipcMain.handle('settings:get', () => settingsStore.store);
  ipcMain.handle('settings:update', (_event, updates: Record<string, unknown>) => {
    Object.entries(updates).forEach(([k, v]) => settingsStore.set(k as any, v));
    return true;
  });

  // Suppress unused variable warning — dataService will be used in Phase 2
  void dataService;
}
