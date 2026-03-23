import { create } from 'zustand';

export interface WeeklySummaryRecord {
  week_of: string;
  generated_at: string;
  data: string; // JSON string
}

export interface WeeklySummaryData {
  week_of: string;
  tasks_created: number;
  tasks_completed: number;
  completion_rate: number;
  deferred_tasks: Array<{ title: string; days: number }>;
  recurring_topic: string | null;
}

interface WeeklySummaryStore {
  summaries: WeeklySummaryRecord[];
  isLoading: boolean;
  loadSummaries: () => Promise<void>;
}

export const useWeeklySummaryStore = create<WeeklySummaryStore>((set) => ({
  summaries: [],
  isLoading: false,
  loadSummaries: async () => {
    set({ isLoading: true });
    const summaries = await window.taskmate.getAllWeeklySummaries();
    set({ summaries, isLoading: false });
  },
}));
