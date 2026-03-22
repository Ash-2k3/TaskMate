import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useTaskStore } from '../stores/useTaskStore';
import { Button } from '@/components/ui/button';
import TaskRow from '../components/TaskRow';
import EmptyState from '../components/EmptyState';

export default function TodayView() {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const isLoading = useTaskStore((s) => s.isLoading);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const completeTask = useTaskStore((s) => s.completeTask);

  useEffect(() => {
    loadTasks();
  }, []);

  const visibleTasks = tasks.slice(0, 7);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Today</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <Button variant="default" onClick={() => navigate('/add')}>
          + Add Task
        </Button>
      </div>

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
