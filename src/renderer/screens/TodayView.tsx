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

  const visibleTasks = tasks.slice(0, 7);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border">
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

      {/* Task list */}
      <div className="mx-6">
        {!isLoading && tasks.length === 0 && <EmptyState />}
        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={(id) => completeTask(id)}
            onClick={(id) => navigate(`/edit/${id}`)}
          />
        ))}
      </div>
    </div>
  );
}
