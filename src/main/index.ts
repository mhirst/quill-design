import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { config } from 'dotenv';
import { registerIpcHandlers } from './ipc-handlers';
import { initProviderConfig } from './key-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

function loadEnv() {
  // 1. Dev: project root
  config({ path: path.join(process.cwd(), '.env') });
  // 2. Production: extraResource lands in process.resourcesPath
  if (!process.env.ANTHROPIC_API_KEY) {
    config({ path: path.join(process.resourcesPath, '.env') });
  }
  // 3. Fallback: userData (user can place .env here manually)
  if (!process.env.ANTHROPIC_API_KEY) {
    config({ path: path.join(app.getPath('userData'), '.env') });
  }
}

function createWindow() {
  loadEnv();
  // Load provider config — migrates legacy Anthropic key if needed,
  // and sets process.env.ANTHROPIC_API_KEY for the Anthropic SDK path
  initProviderConfig();

  const iconPath = path.join(
    app.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'assets'),
    process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  );

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    center: true,
    show: false,
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#141414',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // webSecurity must be false in production so file:// assets load from asar
      webSecurity: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
    },
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Log renderer load failures
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`Renderer failed to load: ${code} ${desc} ${url}`);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  registerIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
  app.setName('Quill');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
