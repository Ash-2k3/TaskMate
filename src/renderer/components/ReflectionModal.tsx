import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { useReflectionStore } from '../stores/useReflectionStore';

interface ReflectionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ReflectionModal({ open, onClose }: ReflectionModalProps) {
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (open) {
      window.taskmate.getCompletedCountToday().then((count: number) => setCompletedCount(count));
      setQ1('');
      setQ2('');
      setQ3('');
    }
  }, [open]);

  const questions = [
    `You finished ${completedCount} task${completedCount !== 1 ? 's' : ''} today. What else did you actually finish, even if it wasn't on your list?`,
    'What slowed you down most today, and was it avoidable?',
    "What is the one thing you'll protect time for tomorrow?",
  ];

  const answeredCount = [q1, q2, q3].filter((s) => s.trim().length > 0).length;
  const canSave = answeredCount >= 1;

  const handleSave = async () => {
    const today = new Date().toISOString().split('T')[0];
    const toNull = (s: string) => s.trim() || null;
    await useReflectionStore.getState().saveReflection(today, toNull(q1), toNull(q2), toNull(q3));
    await window.taskmate.updateSettings({ snoozeUntil: null });
    onClose();
  };

  const handleSnooze = async () => {
    const snoozeUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await window.taskmate.updateSettings({ snoozeUntil });
    onClose();
  };

  const handleFinishDay = async () => {
    const today = new Date().toISOString().split('T')[0];
    await useReflectionStore.getState().saveReflection(today, null, null, null);
    await window.taskmate.updateSettings({ snoozeUntil: null });
    onClose();
  };

  const values = [q1, q2, q3];
  const setters = [setQ1, setQ2, setQ3];

  return (
    <Dialog open={open} modal={true}>
      <DialogContent
        className="sm:max-w-lg glass border-white/10 bg-transparent"
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Daily Reflection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {questions.map((question, i) => (
            <div key={i} className="space-y-2">
              <label className="text-ui font-medium">{question}</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={values[i]}
                onChange={(e) => setters[i](e.target.value)}
                placeholder="Type your reflection..."
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSnooze}>
              Snooze 30 min
            </Button>
            <Button variant="ghost" onClick={handleFinishDay}>
              Finish the day
            </Button>
          </div>
          <Button onClick={handleSave} disabled={!canSave}>
            Save ({answeredCount}/3 answered)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
