import { contextBridge, ipcRenderer } from 'electron';

export const taskmateAPI = {
  // Tasks — stubbed in Phase 1, implemented in Phase 2
  getTasks: () => ipcRenderer.invoke('tasks:getAll'),
  createTask: (task: unknown) => ipcRenderer.invoke('tasks:create', task),
  updateTask: (id: string, updates: unknown) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  completeTask: (id: string) => ipcRenderer.invoke('tasks:complete', id),
  getMissedReminders: () => ipcRenderer.invoke('tasks:getMissedReminders'),
  dismissMissedReminders: (ids: string[]) => ipcRenderer.invoke('tasks:dismissMissedReminders', ids),

  // Reflections — Phase 4 real API
  getReflections: () => ipcRenderer.invoke('reflections:getAll'),
  saveReflection: (date: string, q1: string | null, q2: string | null, q3: string | null) => ipcRenderer.invoke('reflections:save', date, q1, q2, q3),
  hasReflectionToday: () => ipcRenderer.invoke('reflections:hasToday'),
  getCompletedCountToday: () => ipcRenderer.invoke('reflections:getCompletedCountToday'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: unknown) => ipcRenderer.invoke('settings:update', updates),

  // Weekly Summaries — Phase 5
  getAllWeeklySummaries: () => ipcRenderer.invoke('summary:getAll'),

  // Data management — Phase 5 Settings screen
  getDataStats: () => ipcRenderer.invoke('data:getStats'),
  exportData: () => ipcRenderer.invoke('data:export'),
  deleteAllData: () => ipcRenderer.invoke('data:deleteAll'),

  // Main -> Renderer push events (listeners with cleanup)
  onReflectionPrompt: (cb: () => void) => {
    ipcRenderer.on('prompt:reflection', cb);
    return () => ipcRenderer.removeListener('prompt:reflection', cb);
  },
};

contextBridge.exposeInMainWorld('taskmate', taskmateAPI);
