import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Task } from '../stores/useTaskStore';

interface TaskRowProps {
  task: Task;
  onComplete: (id: string) => void;
  onClick: (id: string) => void;
}

export default function TaskRow({ task, onComplete, onClick }: TaskRowProps) {
  const today = new Date();

  const isOverdue =
    task.due_date !== null &&
    differenceInCalendarDays(today, parseISO(task.due_date)) > 0;

  const daysAgo = isOverdue
    ? differenceInCalendarDays(today, parseISO(task.due_date))
    : 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-background border-b border-border cursor-pointer hover:bg-muted/40"
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
      <span
        className={[
          'flex-1 text-sm',
          task.priority === 'high' ? 'font-semibold text-foreground' : 'font-normal',
          task.priority === 'low' ? 'text-muted-foreground' : 'text-foreground',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {task.title}
      </span>

      {/* Overdue badge */}
      {isOverdue && (
        <span className="text-xs text-muted-foreground bg-muted/70 rounded-sm px-2 py-0.5">
          {daysAgo === 1 ? `1 day ago` : `${daysAgo} days ago`}
        </span>
      )}
    </div>
  );
}
