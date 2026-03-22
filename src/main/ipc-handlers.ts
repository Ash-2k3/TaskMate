import { ipcMain } from 'electron';
import type { DataService } from './data-service';
import type { CreateTaskInput, UpdateTaskInput } from './data-service';
import { settingsStore } from './settings-store';

export function registerIpcHandlers(dataService: DataService): void {
  // Tasks — wired to DataService
  ipcMain.handle('tasks:getAll', () => dataService.getAllTasks());
  ipcMain.handle('tasks:create', (_event, task: CreateTaskInput) => dataService.createTask(task));
  ipcMain.handle('tasks:update', (_event, id: string, updates: UpdateTaskInput) => dataService.updateTask(id, updates));
  ipcMain.handle('tasks:delete', (_event, id: string) => dataService.deleteTask(id));
  ipcMain.handle('tasks:complete', (_event, id: string) => dataService.completeTask(id));

  // Reflections — stubs (implemented in Phase 4)
  ipcMain.handle('reflections:get', (_event, _date) => null);
  ipcMain.handle('reflections:save', (_event, _date, _answers) => true);

  // Settings — real implementation using electron-store
  ipcMain.handle('settings:get', () => settingsStore.store);
  ipcMain.handle('settings:update', (_event, updates: Record<string, unknown>) => {
    Object.entries(updates).forEach(([k, v]) => settingsStore.set(k as any, v));
    return true;
  });
}
