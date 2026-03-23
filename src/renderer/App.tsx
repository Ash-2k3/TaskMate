import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTaskStore } from './stores/useTaskStore';
import TodayView from './screens/TodayView';
import AddTask from './screens/AddTask';
import EditTask from './screens/EditTask';
import ReflectionModal from './components/ReflectionModal';
import ReflectionsHistory from './screens/ReflectionsHistory';
import WeeklySummary from './screens/WeeklySummary';
import Settings from './screens/Settings';

function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const showNavBar = ['/', '/reflections', '/summary'].includes(location.pathname);

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
    <div className="min-h-screen bg-background text-foreground pb-14">
      <Routes>
        <Route path="/" element={<TodayView />} />
        <Route path="/add" element={<AddTask />} />
        <Route path="/edit/:id" element={<EditTask />} />
        <Route path="/reflections" element={<ReflectionsHistory />} />
        <Route path="/summary" element={<WeeklySummary />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <ReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
      />
      {showNavBar && (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card">
          <div className="flex">
            <button
              className={`flex-1 py-3 text-ui font-medium text-center ${
                location.pathname === '/' ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/')}
            >
              Today
            </button>
            <button
              className={`flex-1 py-3 text-ui font-medium text-center ${
                location.pathname === '/reflections' ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/reflections')}
            >
              Reflections
            </button>
            <button
              className={`flex-1 py-3 text-ui font-medium text-center ${
                location.pathname === '/summary' ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/summary')}
            >
              Summary
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
