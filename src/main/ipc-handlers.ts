import { ipcMain, dialog } from 'electron';
import fs from 'fs';
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
  ipcMain.handle('tasks:getMissedReminders', () => dataService.getMissedReminders());
  ipcMain.handle('tasks:dismissMissedReminders', (_event, ids: string[]) => dataService.dismissMissedReminders(ids));

  // Reflections — real implementation (Phase 4)
  ipcMain.handle('reflections:getAll', () => dataService.getAllReflections());
  ipcMain.handle('reflections:save', (_event, date: string, q1: string | null, q2: string | null, q3: string | null) => {
    dataService.saveReflection(date, q1, q2, q3);
    return true;
  });
  ipcMain.handle('reflections:hasToday', () => {
    const today = new Date().toISOString().split('T')[0];
    return dataService.hasReflection(today);
  });
  ipcMain.handle('reflections:getCompletedCountToday', () => dataService.getCompletedTaskCountToday());

  // Settings — real implementation using electron-store
  ipcMain.handle('settings:get', () => settingsStore.store);
  ipcMain.handle('settings:update', (_event, updates: Record<string, unknown>) => {
    Object.entries(updates).forEach(([k, v]) => settingsStore.set(k as any, v));
    return true;
  });

  // Weekly Summaries — Phase 5
  ipcMain.handle('summary:getAll', () => dataService.getAllWeeklySummaries());

  // Data management — Phase 5 Settings screen
  ipcMain.handle('data:getStats', () => dataService.getDataStats());

  ipcMain.handle('data:export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'taskmate-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false };

    const tasks = dataService.getAllTasksForExport();
    const reflections = dataService.getAllReflections();
    const summaries = dataService.getAllWeeklySummaries();
    fs.writeFileSync(filePath, JSON.stringify({ tasks, reflections, summaries }, null, 2), 'utf8');
    return { success: true, filePath };
  });

  ipcMain.handle('data:deleteAll', () => {
    dataService.deleteAllData();
    return true;
  });
}
