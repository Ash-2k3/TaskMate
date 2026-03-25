import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Info, CalendarCheck, BookOpen, BarChart2 } from 'lucide-react';
import { useTaskStore } from './stores/useTaskStore';
import { useReflectionStore } from './stores/useReflectionStore';
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

  useEffect(() => {
    const handler = () => setReflectionOpen(true);
    window.addEventListener('open-reflection-modal', handler);
    return () => window.removeEventListener('open-reflection-modal', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-14">
      {/* Orb 1 — cyan, top-right */}
      <div
        style={{
          position: 'fixed',
          top: '-100px',
          right: '-100px',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Orb 2 — indigo, bottom-left */}
      <div
        style={{
          position: 'fixed',
          bottom: '-80px',
          left: '-80px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Content layer — z-10 above orbs */}
      <div className="relative z-10">
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
          onClose={() => {
            setReflectionOpen(false);
            useReflectionStore.getState().checkHasToday();
          }}
        />
      </div>
      {showNavBar && (
        <nav className="fixed bottom-0 left-0 right-0 glass z-20">
          <div className="flex">
            {/* Today tab */}
            <button
              className={`relative flex-1 py-2 text-center ${
                location.pathname === '/' ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/')}
            >
              <span className="flex flex-col items-center gap-0.5">
                <CalendarCheck className="h-5 w-5" />
                <span className="text-[11px] font-medium">Today</span>
              </span>
              {location.pathname === '/' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}
                />
              )}
            </button>

            {/* Reflections tab */}
            <button
              className={`relative flex-1 py-2 text-center ${
                location.pathname === '/reflections' ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/reflections')}
            >
              <span className="flex flex-col items-center gap-0.5">
                <BookOpen className="h-5 w-5" />
                <span className="text-[11px] font-medium">Reflections</span>
              </span>
              {location.pathname === '/reflections' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}
                />
              )}
            </button>

            {/* Summary tab */}
            <button
              className={`relative flex-1 py-2 text-center ${
                location.pathname === '/summary' ? 'text-primary' : 'text-muted-foreground'
              }`}
              onClick={() => navigate('/summary')}
            >
              <span className="flex flex-col items-center gap-0.5">
                <BarChart2 className="h-5 w-5" />
                <span className="text-[11px] font-medium">Summary</span>
              </span>
              {location.pathname === '/summary' && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}
                />
              )}
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
