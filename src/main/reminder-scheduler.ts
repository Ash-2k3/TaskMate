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
let reflectionFiredToday: string | null = null; // prevents per-minute re-fires after 22:00
let summaryGeneratedThisWeek: string | null = null;

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(newH)}:${pad(newM)}`; // may exceed "23:59" — intentional for string comparison
}

export function initScheduler(
  dataService: DataService,
  getMainWindow: () => BrowserWindow | null,
  options: SchedulerOptions = {}
): void {
  const getNow = options.getNow ?? (() => new Date());

  function focusWindow() {
    const win = getMainWindow();
    if (win) { win.show(); win.focus(); }
  }

  function makeNotification(body: string, clickable = true): Notification {
    const notif = new Notification({ title: 'DayCap', body });
    if (clickable) notif.on('click', focusWindow);
    return notif;
  }

  function tick(): void {
    const now = getNow();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // 1. 30-min pre-notification
    const thirtyAheadHHMM = addMinutes(currentHHMM, 30);
    const preTasks = dataService.getTasksDueForPreNotification(todayDate, currentHHMM, thirtyAheadHHMM);
    for (const task of preTasks) {
      makeNotification(`${task.title} is due in 30 minutes \u23F0`).show();
      dataService.updateTask(task.id, { pre_notified: 1 });
    }

    // 2. Due-time notification
    const dueTasks = dataService.getTasksDueForDueNotification(todayDate, currentHHMM);
    for (const task of dueTasks) {
      makeNotification(`${task.title} is due now \u{1F6A8}`).show();
      dataService.updateTask(task.id, { notified_at: now.toISOString() });
    }

    // 3. Overdue nudges — up to 3 times, hourly, no time cutoff
    const overdueTasks = dataService.getTasksDueForOverdueNotification(todayDate);
    for (const task of overdueTasks) {
      const newCount = task.renotified + 1;
      makeNotification(`Still pending (${newCount}/3): ${task.title} \u{1F4A1}`).show();
      dataService.updateTask(task.id, {
        renotified: newCount,
        overdue_last_notified_at: now.toISOString(),
      });
    }

    // 4. Reflection trigger at 10 PM
    if (currentHHMM >= '22:00') {
      const hasReflection = dataService.hasReflection(todayDate);
      if (!hasReflection) {
        const snoozeUntil = settingsStore.get('snoozeUntil');
        const snoozePassed = !snoozeUntil || new Date(snoozeUntil) <= now;
        if (snoozePassed && reflectionFiredToday !== todayDate) {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            const reflectionNotif = new Notification({
              title: 'DayCap',
              body: 'Time to reflect on your day \u{1F319}',
            });
            reflectionNotif.on('click', () => {
              if (win && !win.isDestroyed()) { win.show(); win.focus(); }
            });
            reflectionNotif.show();
            win.webContents.send('prompt:reflection');
            reflectionFiredToday = todayDate;
          }
        }
      }
    }

    // 5. Weekly summary trigger at Sunday 8 PM
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

          new Notification({
            title: 'DayCap',
            body: 'Your weekly summary is ready',
          }).show();
        }
      }
    }
  }

  cronTask = schedule('* * * * *', tick, { noOverlap: true });

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
