import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/stores/useTaskStore';

interface DataStats {
  tasksTotal: number;
  reflectionsTotal: number;
  reflectionsFrom: string | null;
  reflectionsTo: string | null;
  summariesTotal: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await window.taskmate.getDataStats();
      setStats(data);
    }
    load();
  }, []);

  async function handleExport() {
    const result = await window.taskmate.exportData();
    if (result.success) {
      setExportStatus('Exported successfully');
    } else {
      setExportStatus(null);
    }
  }

  async function handleDeleteAll() {
    await window.taskmate.deleteAllData();
    await loadTasks();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-6">
        {/* Back button — same pattern as AddTask/EditTask */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-ui text-muted-foreground hover:text-foreground mb-4 cursor-pointer"
        >
          <span className="text-base leading-none">&larr;</span><span>Today</span>
        </button>

        <h1 className="text-2xl font-semibold mb-6">Settings</h1>

        {/* Record counts (per D-29) */}
        {stats && (
          <div className="space-y-2 mb-8">
            <p className="text-ui">
              {stats.tasksTotal} tasks total
            </p>
            <p className="text-ui">
              {stats.reflectionsTotal} reflections
              {stats.reflectionsFrom && stats.reflectionsTo && (
                <span className="text-muted-foreground"> (from {stats.reflectionsFrom} to {stats.reflectionsTo})</span>
              )}
            </p>
            <p className="text-ui">
              {stats.summariesTotal} weekly summaries
            </p>
          </div>
        )}

        {/* Export (per D-30) */}
        <div className="mb-6">
          <Button variant="outline" onClick={handleExport}>
            Export all data
          </Button>
          {exportStatus && (
            <p className="text-sm text-muted-foreground mt-2">{exportStatus}</p>
          )}
        </div>

        {/* Delete all (per D-31) — inline confirmation */}
        <div className="border-t border-border pt-6">
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              Delete all data
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDeleteAll}>
                  Yes, delete everything
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
