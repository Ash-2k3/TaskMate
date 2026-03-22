import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTaskStore } from './stores/useTaskStore';
import TodayView from './screens/TodayView';
import AddTask from './screens/AddTask';
import EditTask from './screens/EditTask';
import ReflectionModal from './components/ReflectionModal';

function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    const cleanup = window.taskmate.onReflectionPrompt(() => {
      setReflectionOpen(true);
    });
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/" element={<TodayView />} />
        <Route path="/add" element={<AddTask />} />
        <Route path="/edit/:id" element={<EditTask />} />
      </Routes>
      <ReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
      />
    </div>
  );
}

export default App;
