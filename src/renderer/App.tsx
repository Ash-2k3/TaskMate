import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTaskStore } from './stores/useTaskStore';
import TodayView from './screens/TodayView';

function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<TodayView />} />
      </Routes>
    </div>
  );
}

export default App;
