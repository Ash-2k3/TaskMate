import { Notification, powerMonitor } from 'electron';
import { schedule, type ScheduledTask } from 'node-cron';
import type { DataService } from './data-service';
import type { BrowserWindow } from 'electron';

interface SchedulerOptions {
  getNow?: () => Date;
}

let cronTask: ScheduledTask | null = null;

export function initScheduler(
  dataService: DataService,
  getMainWindow: () => BrowserWindow | null,
  options: SchedulerOptions = {}
): void {
  const getNow = options.getNow ?? (() => new Date());

  function tick(): void {
    const now = getNow();
    const todayDate = now.toISOString().split('T')[0];
    // Use UTC time to match ISO date strings stored in DB (consistent with toISOString())
    const currentHHMM = now.toISOString().slice(11, 16); // "HH:MM" in UTC

    // 1. Fire initial notifications (per D-09)
    const dueTasks = dataService.getTasksDueForReminder(todayDate, currentHHMM);
    for (const task of dueTasks) {
      const notification = new Notification({
        title: 'TaskMate Reminder',   // per D-12
        body: task.title,             // per D-12
      });
      notification.on('click', () => {  // per D-15
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      });
      notification.show();
      dataService.updateTask(task.id, { notified_at: now.toISOString() });
    }

    // 2. Fire re-notifications (per D-16, D-17, D-18)
    // Suppressed at or after 20:30 (lexicographic string comparison is safe for HH:MM)
    if (currentHHMM < '20:30') {
      const renotifyTasks = dataService.getTasksDueForRenotification(todayDate, currentHHMM);
      for (const task of renotifyTasks) {
        const notification = new Notification({
          title: 'TaskMate Reminder',                    // per D-13
          body: `Still incomplete \u2014 ${task.title}`, // per D-13
        });
        notification.on('click', () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          }
        });
        notification.show();
        dataService.updateTask(task.id, { renotified: 1 });
      }
    }
  }

  // Per-minute cron job (per D-08); noOverlap prevents tick re-entrance
  cronTask = schedule('* * * * *', tick, { noOverlap: true });

  // powerMonitor resume event (per D-10) — triggers immediate re-evaluation after sleep
  powerMonitor.on('resume', () => {
    tick();
  });
}

export function stopScheduler(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
