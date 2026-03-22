import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { DataService } from './data-service';
import { settingsStore } from './settings-store';
import { registerIpcHandlers } from './ipc-handlers';
import { initTray, setupWindowCloseHandler } from './tray';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Forge-injected constants for Vite integration
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Module-level dataService for lifecycle management (before-quit handler)
let dataService: DataService;

// Module-level mainWindow for tray integration
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Set Windows App User Model ID early (must be before window creation)
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.taskmate.app');
  }

  // Create the browser window with security baseline
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false, // Prevent white flash — show only when ready
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show window only when content is ready (prevents white screen flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  // Open DevTools in dev mode only — never in packaged builds
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// This method will be called when Electron has finished initialization
// and is ready to create browser windows.
app.whenReady().then(() => {
  // Initialize persistence layer (plan 01-02)
  dataService = new DataService();

  // Register IPC handlers before window loads so first renderer invokes succeed
  registerIpcHandlers(dataService);

  // First-launch: seed example tasks
  const isFirstLaunch = !settingsStore.get('hasLaunched');
  if (isFirstLaunch) {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    dataService.createTask({ title: 'Try completing a task', priority: 'high', due_date: today });
    dataService.createTask({ title: 'Add your first real task', priority: 'medium' });
    dataService.createTask({ title: 'Review your day at 9 PM', priority: 'low' });
    settingsStore.set('hasLaunched', true);
  }

  createWindow();

  // Initialize system tray (FOUND-02)
  initTray(() => mainWindow);
  setupWindowCloseHandler(mainWindow!);

  // Register login item (FOUND-03)
  const openAtLogin = settingsStore.get('openAtLogin');
  app.setLoginItemSettings({ openAtLogin });

  app.on('activate', () => {
    // macOS: show the window when dock icon is clicked
    if (mainWindow) {
      if (process.platform === 'darwin') app.dock.show();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

// Do NOT quit — tray keeps app alive (FOUND-02)
// On all platforms, the tray context menu handles quitting
app.on('window-all-closed', () => {
  // Intentionally empty — tray keeps the app alive
});

// SOLE before-quit handler: sets app.isQuitting flag and closes DataService
// This is the ONLY place in the entire app where before-quit is registered.
app.on('before-quit', () => {
  app.isQuitting = true;
  dataService?.close();
});
