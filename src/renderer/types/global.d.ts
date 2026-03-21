import type { taskmateAPI } from '../../preload/preload';

declare global {
  interface Window {
    taskmate: typeof taskmateAPI;
  }
}

export {};
