import { create } from 'zustand';

export interface ReflectionRecord {
  date: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  completed_at: string;
}

interface ReflectionStore {
  reflections: ReflectionRecord[];
  isLoading: boolean;
  loadReflections: () => Promise<void>;
  saveReflection: (date: string, q1: string | null, q2: string | null, q3: string | null) => Promise<void>;
  hasToday: boolean;
  checkHasToday: () => Promise<void>;
}

export const useReflectionStore = create<ReflectionStore>((set) => ({
  reflections: [],
  isLoading: false,
  hasToday: false,

  loadReflections: async () => {
    set({ isLoading: true });
    const reflections = await window.taskmate.getReflections();
    const today = new Date().toISOString().split('T')[0];
    const hasToday = reflections.some((r: ReflectionRecord) => r.date === today);
    set({ reflections, isLoading: false, hasToday });
  },

  saveReflection: async (date, q1, q2, q3) => {
    await window.taskmate.saveReflection(date, q1, q2, q3);
    const reflections = await window.taskmate.getReflections();
    const today = new Date().toISOString().split('T')[0];
    const hasToday = reflections.some((r: ReflectionRecord) => r.date === today);
    set({ reflections, hasToday });
  },

  checkHasToday: async () => {
    const hasToday = await window.taskmate.hasReflectionToday();
    set({ hasToday });
  },
}));
