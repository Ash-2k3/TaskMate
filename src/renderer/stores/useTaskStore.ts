import { create } from 'zustand';

export interface Task {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: 0 | 1;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  reminder_time: string | null;  // HH:MM 24h — Phase 3
}

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  loadTasks: () => Promise<void>;
  createTask: (input: { title: string; due_date?: string | null; priority?: 'low' | 'medium' | 'high'; reminder_time?: string | null }) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'due_date' | 'priority' | 'reminder_time'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  isLoading: false,

  loadTasks: async () => {
    set({ isLoading: true });
    const tasks = await window.taskmate.getTasks();
    set({ tasks, isLoading: false });
  },

  createTask: async (input) => {
    const task = await window.taskmate.createTask(input);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  updateTask: async (id, updates) => {
    const updated = await window.taskmate.updateTask(id, updates);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTask: async (id) => {
    await window.taskmate.deleteTask(id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  completeTask: async (id) => {
    await window.taskmate.completeTask(id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },
}));
