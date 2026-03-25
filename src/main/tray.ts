import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function initTray(getMainWindow: () => BrowserWindow | null): void {
  // Dev: load from src/assets; Packaged: load from resources
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
    : path.join(app.getAppPath(), 'src', 'assets', 'tray-icon.png');

  const icon = nativeImage.createFromPath(iconPath);
  // macOS: set as template image for proper dark/light mode rendering
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('DayCap');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open DayCap',
      click: () => {
        const win = getMainWindow();
        if (win) {
          if (process.platform === 'darwin') app.dock.show();
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit DayCap',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // macOS: single click opens window
  tray.on('click', () => {
    const win = getMainWindow();
    if (win) {
      if (process.platform === 'darwin') app.dock.show();
      win.show();
      win.focus();
    }
  });

  // Windows: double-click opens window
  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) { win.show(); win.focus(); }
  });
}

// CRITICAL: intercept window close to hide instead of quit (per FOUND-02)
// Uses win.hide() ONLY — never app.hide() (macOS bug, Pitfall 6)
export function setupWindowCloseHandler(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
      // macOS: hide dock icon when window is hidden to tray
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });
}
