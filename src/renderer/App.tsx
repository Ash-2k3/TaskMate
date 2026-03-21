import React from 'react';

function App() {
  const ipcReady = typeof window !== 'undefined' && !!(window as any).taskmate;
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>TaskMate</h1>
      <p>Foundation loaded.</p>
      <p>IPC bridge: {ipcReady ? 'connected' : 'not yet connected'}</p>
    </div>
  );
}

export default App;
