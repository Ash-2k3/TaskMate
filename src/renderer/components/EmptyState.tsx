import { Sparkles } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="glass rounded-2xl px-4 py-8 mx-4 mt-4 flex flex-col items-center text-center gap-2">
      <Sparkles className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">All clear — nothing left for today.</p>
      <p className="text-ui text-muted-foreground/60">Add a task to get started.</p>
    </div>
  );
}
