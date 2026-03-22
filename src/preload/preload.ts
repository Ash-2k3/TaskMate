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

  // Reflections — stubbed in Phase 1
  getReflection: (date: string) => ipcRenderer.invoke('reflections:get', date),
  saveReflection: (date: string, answers: unknown) => ipcRenderer.invoke('reflections:save', date, answers),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: unknown) => ipcRenderer.invoke('settings:update', updates),

  // Main -> Renderer push events (listeners with cleanup)
  onReflectionPrompt: (cb: () => void) => {
    ipcRenderer.on('prompt:reflection', cb);
    return () => ipcRenderer.removeListener('prompt:reflection', cb);
  },
};

contextBridge.exposeInMainWorld('taskmate', taskmateAPI);
