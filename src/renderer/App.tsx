import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTaskStore } from './stores/useTaskStore';
import TodayView from './screens/TodayView';
import AddTask from './screens/AddTask';
import EditTask from './screens/EditTask';
import ReflectionModal from './components/ReflectionModal';
import ReflectionsHistory from './screens/ReflectionsHistory';

function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const showNavBar = location.pathname === '/' || location.pathname === '/reflections';

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
      </Routes>
      <ReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
      />
      {showNavBar && (
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background">
          <div className="flex">
            <button
              className={`flex-1 py-3 text-sm font-medium text-center ${
                location.pathname === '/' ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/')}
            >
              Today
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium text-center ${
                location.pathname === '/reflections' ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/reflections')}
            >
              Reflections
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
