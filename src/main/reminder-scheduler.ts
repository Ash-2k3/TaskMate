import { Notification, powerMonitor } from 'electron';
import { schedule, type ScheduledTask } from 'node-cron';
import type { DataService } from './data-service';
import type { BrowserWindow } from 'electron';
import { settingsStore } from './settings-store';
import { isSunday, startOfWeek } from 'date-fns';
import { extractTopKeyword } from './keyword-extractor';

interface SchedulerOptions {
  getNow?: () => Date;
}

let cronTask: ScheduledTask | null = null;
let reflectionFiredToday: string | null = null; // prevents per-minute re-fires after 21:00
let summaryGeneratedThisWeek: string | null = null;

export function initScheduler(
  dataService: DataService,
  getMainWindow: () => BrowserWindow | null,
  options: SchedulerOptions = {}
): void {
  const getNow = options.getNow ?? (() => new Date());

  function tick(): void {
    const now = getNow();
    // Use local time — due_date and reminder_time are set from local UI inputs
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // 1. Fire initial notifications (per D-09)
    const dueTasks = dataService.getTasksDueForReminder(todayDate, currentHHMM);
    for (const task of dueTasks) {
      const notification = new Notification({
        title: 'TaskMate',
        body: `Hey, ${task.title} is waiting on you \u{1F440}`,
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
          title: 'TaskMate',
          body: `Still pending: ${task.title} \u2014 you've got this \u{1F4AA}`,
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

    // 3. Reflection trigger at 9 PM (per D-07, D-08, D-11)
    if (currentHHMM >= '21:00') {
      const hasReflection = dataService.hasReflection(todayDate);
      if (!hasReflection) {
        const snoozeUntil = settingsStore.get('snoozeUntil');
        const snoozePassed = !snoozeUntil || new Date(snoozeUntil) <= now;
        if (snoozePassed && reflectionFiredToday !== todayDate) {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            // New system notification for reflection (D-43)
            const reflectionNotif = new Notification({
              title: 'TaskMate',
              body: 'Time to reflect on your day \u{1F319}',
            });
            reflectionNotif.on('click', () => {
              if (win && !win.isDestroyed()) {
                win.show();
                win.focus();
              }
            });
            reflectionNotif.show();
            // Existing IPC message
            win.webContents.send('prompt:reflection');
            reflectionFiredToday = todayDate; // fire at most once per day per D-11
          }
        }
      }
    }

    // 4. Weekly summary trigger at Sunday 8 PM (per D-01, D-02)
    if (currentHHMM >= '20:00') {
      if (isSunday(now)) {
        const monday = startOfWeek(now, { weekStartsOn: 1 });
        const weekOf = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;

        if (summaryGeneratedThisWeek !== weekOf && !dataService.hasWeeklySummary(weekOf)) {
          const stats = dataService.getWeeklySummaryStats(weekOf);
          const deferredTasks = dataService.getDeferredTasks(weekOf);
          const q2Texts = dataService.getReflectionsForWeek(weekOf);
          const recurringTopic = extractTopKeyword(q2Texts);

          const payload = {
            week_of: weekOf,
            tasks_created: stats.tasks_created,
            tasks_completed: stats.tasks_completed,
            completion_rate: stats.completion_rate,
            deferred_tasks: deferredTasks,
            recurring_topic: recurringTopic,
          };

          dataService.saveWeeklySummary(weekOf, now.toISOString(), payload);
          summaryGeneratedThisWeek = weekOf;

          // Fire notification (per D-03) — no click handler
          new Notification({
            title: 'TaskMate',
            body: 'Your week in review is ready \u2014 see how you did \u2728',
          }).show();
        }
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
