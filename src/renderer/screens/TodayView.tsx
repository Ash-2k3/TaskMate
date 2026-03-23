import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useTaskStore } from '../stores/useTaskStore';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import TaskRow from '../components/TaskRow';
import EmptyState from '../components/EmptyState';

export default function TodayView() {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const isLoading = useTaskStore((s) => s.isLoading);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const completeTask = useTaskStore((s) => s.completeTask);

  const [missedTasks, setMissedTasks] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    async function checkMissedReminders() {
      const missed = await window.taskmate.getMissedReminders();
      if (missed.length > 0) {
        setMissedTasks(missed.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title })));
      }
    }
    checkMissedReminders();
  }, []);

  async function handleDismissMissed() {
    const ids = missedTasks.map((t) => t.id);
    await window.taskmate.dismissMissedReminders(ids);
    setMissedTasks([]);
  }

  const PRIORITY_CONFIG = {
    high:   { label: 'High',   labelClass: 'text-rose-400',  borderClass: 'border-l-2 border-rose-400/60'  },
    medium: { label: 'Medium', labelClass: 'text-amber-400', borderClass: 'border-l-2 border-amber-400/60' },
    low:    { label: 'Low',    labelClass: 'text-sky-400/80', borderClass: 'border-l-2 border-sky-400/40'  },
  } as const;

  const grouped = (['high', 'medium', 'low'] as const).map((p) => ({
    priority: p,
    tasks: tasks.filter((t) => t.priority === p),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass rounded-2xl flex items-start justify-between mx-4 mt-4 mb-0 px-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Today</h1>
          <p className="text-ui text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded"
            aria-label="Settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
          <Button variant="default" onClick={() => navigate('/add')}>
            + Add Task
          </Button>
        </div>
      </div>

      {/* Catch-up banner for missed reminders (per D-21, D-22) */}
      {missedTasks.length > 0 && (
        <div className="mx-6 mb-4 flex items-start justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-700 dark:bg-yellow-950">
          <p className="text-yellow-800 dark:text-yellow-200">
            Missed reminders: {missedTasks.map((t) => t.title).join(', ')}
          </p>
          <button
            type="button"
            onClick={handleDismissMissed}
            className="ml-4 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 cursor-pointer font-medium"
            aria-label="Dismiss missed reminders"
          >
            ×
          </button>
        </div>
      )}

      {/* Task list grouped by priority */}
      <div className="px-4 pt-2">
        {!isLoading && tasks.length === 0 && <EmptyState />}
        {grouped.map(({ priority, tasks: group }) => {
          const cfg = PRIORITY_CONFIG[priority];
          return (
            <div key={priority} className="mb-1">
              <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
                <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.labelClass}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-muted-foreground/60">{group.length}</span>
              </div>
              {group.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  borderClass={cfg.borderClass}
                  onComplete={(id) => completeTask(id)}
                  onClick={(id) => navigate(`/edit/${id}`)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
