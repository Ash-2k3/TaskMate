import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useWeeklySummaryStore, type WeeklySummaryData } from '../stores/useWeeklySummaryStore';

export default function WeeklySummary() {
  const { summaries, isLoading, loadSummaries } = useWeeklySummaryStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadSummaries();
  }, []);

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <h1 className="text-2xl font-semibold mb-4">Summary</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="px-6 py-6">
        <h1 className="text-2xl font-semibold mb-4">Summary</h1>
        <p className="text-muted-foreground">No summary yet. Your first will appear this Sunday evening.</p>
      </div>
    );
  }

  const record = summaries[selectedIndex];
  let data: WeeklySummaryData;
  try {
    data = JSON.parse(record.data);
  } catch {
    data = { week_of: record.week_of, tasks_created: 0, tasks_completed: 0, completion_rate: 0, deferred_tasks: [], recurring_topic: null };
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6">
        <h1 className="text-2xl font-semibold mb-4">Summary</h1>

        {/* Past week selector (per D-25) */}
        {summaries.length > 1 && (
          <select
            className="appearance-none font-sans text-ui text-muted-foreground bg-transparent border border-white/10 rounded px-2 py-1 mb-6 cursor-pointer"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {summaries.map((s, i) => (
              <option key={s.week_of} value={i}>
                Week of {format(parseISO(s.week_of), 'MMMM d')}
              </option>
            ))}
          </select>
        )}

        {/* Week of heading (per D-27) */}
        <h2 className="text-base font-medium mb-6">
          Week of {format(parseISO(data.week_of), 'MMMM d')}
        </h2>

        {/* This week section (per D-26) */}
        <div className="glass rounded-2xl p-4 mb-4">
          <h3 className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This week</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Created</span>
              <span className="text-sm font-medium">{data.tasks_created} tasks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Completed</span>
              <span className="text-sm font-medium">{data.tasks_completed} tasks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Rate</span>
              <span className="text-sm font-medium">{data.completion_rate}%</span>
            </div>
          </div>
        </div>

        {/* Still waiting section (per D-07, D-08, D-26) */}
        <div className="glass rounded-2xl p-4 mb-4">
          <h3 className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Still waiting</h3>
          {data.deferred_tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing carried over — great week.</p>
          ) : (
            <ul className="space-y-1">
              {data.deferred_tasks.map((task, i) => (
                <li key={i} className="text-sm">
                  {'\u2022'} {task.title} ({task.days} days)
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recurring topic section (per D-17, D-26) */}
        <div className="glass rounded-2xl p-4 mb-4">
          <h3 className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recurring topic</h3>
          <p className="text-sm">{data.recurring_topic ?? '\u2014'}</p>
        </div>
      </div>
    </div>
  );
}
