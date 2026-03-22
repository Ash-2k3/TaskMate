import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useReflectionStore, type ReflectionRecord } from '../stores/useReflectionStore';

const QUESTIONS = [
  'What did you actually finish today?',
  'What slowed you down most today?',
  'What will you protect time for tomorrow?',
];

export default function ReflectionsHistory() {
  const { reflections, isLoading, loadReflections } = useReflectionStore();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    loadReflections();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Reflections</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (reflections.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Reflections</h1>
        <p className="text-muted-foreground">No reflections yet. Your first will appear here after tonight.</p>
      </div>
    );
  }

  const toggleExpand = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reflections</h1>
      <div className="space-y-2">
        {reflections.map((r: ReflectionRecord) => (
          <div key={r.date} className="border rounded-lg">
            <button
              className="w-full text-left px-4 py-3 font-medium hover:bg-muted/50"
              onClick={() => toggleExpand(r.date)}
            >
              {format(parseISO(r.date), 'EEEE, MMMM d')}
            </button>
            {expandedDate === r.date && (
              <div className="px-4 pb-4 space-y-3">
                {[r.q1, r.q2, r.q3].map((answer, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-muted-foreground">{QUESTIONS[i]}</p>
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
