import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '@/stores/useTaskStore';
import { DatePicker } from '@/components/DatePicker';
import { TimePicker } from '@/components/TimePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function AddTask() {
  const navigate = useNavigate();
  const createTask = useTaskStore((s) => s.createTask);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [titleError, setTitleError] = useState(false);
  const [reminderTime, setReminderTime] = useState<string | null>(null);

  function handleDueDateChange(value: string | null) {
    setDueDate(value);
    if (value === null) {
      setReminderTime(null); // per D-02: no due date = no reminder
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    await createTask({ title: title.trim(), due_date: dueDate, priority, reminder_time: reminderTime });
    navigate('/');
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    if (titleError && e.target.value.trim()) {
      setTitleError(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-ui text-muted-foreground cursor-pointer mb-4 hover:text-foreground"
      >
        <span className="text-base leading-none">←</span><span>Today</span>
      </button>

      {/* Screen title */}
      <h1 className="text-2xl font-semibold mb-6">Add Task</h1>

      {/* Form */}
      <div className="glass rounded-2xl p-6">
      <div className="space-y-4">
        {/* Title field */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Task
          </label>
          <Input
            value={title}
            onChange={handleTitleChange}
            placeholder="What needs to get done?"
          />
          {titleError && (
            <p className="text-xs text-destructive mt-1">
              Task title is required.
            </p>
          )}
        </div>

        {/* Due date field */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Due date
          </label>
          <DatePicker value={dueDate} onChange={handleDueDateChange} />
        </div>

        {/* Reminder time field — per D-01, D-02 */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Reminder time
          </label>
          <TimePicker value={reminderTime} onChange={setReminderTime} disabled={!dueDate} />
          {!dueDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Set a due date first to enable reminders.
            </p>
          )}
        </div>

        {/* Priority field */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Priority
          </label>
          <ToggleGroup
            type="single"
            value={priority}
            onValueChange={(val) => {
              if (val) setPriority(val as 'low' | 'medium' | 'high');
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="low">Low</ToggleGroupItem>
            <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
            <ToggleGroupItem value="high">High</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Save button */}
        <Button className="w-full" onClick={handleSave}>
          Save Task
        </Button>
      </div>
      </div>
    </div>
  );
}
