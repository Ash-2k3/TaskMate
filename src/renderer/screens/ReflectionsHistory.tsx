import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useReflectionStore, type ReflectionRecord } from '../stores/useReflectionStore';
import { Button } from '../components/ui/button';

const QUESTIONS = [
  'What did you actually finish today?',
  'What slowed you down most today?',
  'What will you protect time for tomorrow?',
];

const today = new Date().toISOString().split('T')[0];

export default function ReflectionsHistory() {
  const { reflections, isLoading, loadReflections } = useReflectionStore();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    loadReflections();
  }, []);

  if (isLoading) {
    return (
      <div className="px-0 pt-6">
        <h1 className="text-2xl font-semibold mb-6 px-6">Reflections</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (reflections.length === 0) {
    return (
      <div className="px-0 pt-6">
        <h1 className="text-2xl font-semibold mb-6 px-6">Reflections</h1>
        <p className="text-muted-foreground">No reflections yet. Your first will appear here after tonight.</p>
      </div>
    );
  }

  const toggleExpand = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-semibold mb-4 px-6">Reflections</h1>
      <div className="glass rounded-2xl overflow-hidden mx-4">
        {reflections.map((r: ReflectionRecord) => (
          <div key={r.date} className="border-b border-white/10">
            <div className="flex items-center">
              <button
                className="flex-1 text-left px-4 py-3 font-medium hover:bg-white/5 transition-glass"
                onClick={() => toggleExpand(r.date)}
              >
                {format(parseISO(r.date), 'EEEE, MMMM d')}
              </button>
              {r.date === today && r.q1 === null && r.q2 === null && r.q3 === null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2 text-xs text-muted-foreground"
                  onClick={() => window.dispatchEvent(new Event('open-reflection-modal'))}
                >
                  Write reflection
                </Button>
              )}
            </div>
            {expandedDate === r.date && (
              <div className="px-4 pb-3 space-y-3">
                {[r.q1, r.q2, r.q3].map((answer, i) => (
                  <div key={i}>
                    <p className="text-sm text-muted-foreground">{QUESTIONS[i]}</p>
                    <p className="text-sm mt-1">{answer ?? '\u2014'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
