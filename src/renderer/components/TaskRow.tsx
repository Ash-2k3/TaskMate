import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Clock, AlertCircle } from 'lucide-react';
import { Task } from '../stores/useTaskStore';

interface TaskRowProps {
  task: Task;
  borderClass?: string;
  onComplete: (id: string) => void;
  onClick: (id: string) => void;
}

export default function TaskRow({ task, borderClass, onComplete, onClick }: TaskRowProps) {
  const today = new Date();

  const isOverdue =
    task.due_date !== null &&
    differenceInCalendarDays(today, parseISO(task.due_date)) > 0;

  const daysAgo = isOverdue
    ? differenceInCalendarDays(today, parseISO(task.due_date))
    : 0;

  return (
    <div
      className={`glass glass-hover flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer mb-2 ${borderClass ?? ''}`}
      onClick={() => onClick(task.id)}
    >
      {/* Completion checkbox */}
      <button
        type="button"
        className="w-4 h-4 rounded-full border border-border flex-shrink-0 hover:border-primary hover:bg-primary/10"
        onClick={(e) => {
          e.stopPropagation();
          onComplete(task.id);
        }}
        aria-label="Mark complete"
      />

      {/* Title */}
      <span className="flex-1 text-sm text-foreground">
        {task.title}
      </span>

      {/* Reminder time */}
      {task.reminder_time && !isOverdue && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <Clock className="h-3 w-3" />
          {task.reminder_time}
        </span>
      )}

      {/* Overdue badge */}
      {isOverdue && (
        <span className="flex items-center gap-1 text-xs text-rose-400/80 bg-rose-400/10 rounded-sm px-2 py-0.5">
          <AlertCircle className="h-3 w-3" />
          {daysAgo === 1 ? `1 day ago` : `${daysAgo} days ago`}
        </span>
      )}
    </div>
  );
}
