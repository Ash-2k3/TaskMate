export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <h2 className="text-lg font-semibold text-foreground">
        All clear — nothing left for today.
      </h2>
      <p className="text-sm text-muted-foreground mt-2">
        Add a task above to get started.
      </p>
    </div>
  );
}
