/**
 * main.ts — Electron main process
 *
 * Startup sequence:
 *   1. Show splash window immediately (user sees branding within ~200ms)
 *   2. Init SQLite + register IPC handlers (synchronous, <50ms)
 *   3. Spawn / connect to Next.js server in background (5–15s)
 *   4. Once server is ready → load vendor URL into hidden main window
 *   5. Wait for did-finish-load (page fully rendered)
 *   6. Destroy splash, show main window — clean single transition
 */

import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray } from 'electron';
import path from 'path';
import { initDatabase, setupSQLiteHandlers } from './sqlite-engine';
import { setupPrinterHandlers } from './printer-engine';
import { startNextServer, stopNextServer } from './next-server';

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverPort = 3000;

// ─── Splash window ────────────────────────────────────────────────────────────
function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // Use base64 data URL — plain data:text/html is corrupted by CSS colons/semicolons
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0f172a;display:flex;flex-direction:column;align-items:center;
      justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      color:#f8fafc;-webkit-app-region:drag}
    .brand{font-size:11px;font-weight:700;letter-spacing:4px;color:#ef4444;text-transform:uppercase;margin-bottom:14px}
    .title{font-size:26px;font-weight:800;margin-bottom:6px;color:#f1f5f9}
    .sub{font-size:13px;color:#64748b;margin-bottom:40px}
    .track{width:180px;height:3px;background:#1e293b;border-radius:99px;overflow:hidden}
    .bar{width:40%;height:100%;background:#ef4444;border-radius:99px;animation:s 1.4s ease-in-out infinite}
    @keyframes s{0%{transform:translateX(-200%)}100%{transform:translateX(450%)}}
    .hint{font-size:11px;color:#334155;margin-top:22px}
  </style></head><body>
    <div class="brand">ByteBusiness</div>
    <div class="title">POS Desktop</div>
    <div class="sub">Vendor Dashboard</div>
    <div class="track"><div class="bar"></div></div>
    <div class="hint">Starting server&hellip;</div>
  </body></html>`;

  splashWindow.loadURL(
    `data:text/html;charset=utf-8;base64,${Buffer.from(html).toString('base64')}`,
  );

  splashWindow.once('ready-to-show', () => splashWindow?.show());
  splashWindow.on('closed', () => { splashWindow = null; });
}

function destroySplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy(); // destroy() is instant; close() fires 'close' event and can delay
    splashWindow = null;
  }
}

// ─── Main window ──────────────────────────────────────────────────────────────
async function createMainWindow(): Promise<void> {
  const preloadPath = app.isPackaged
    ? path.join(app.getAppPath(), 'dist-electron', 'preload.js')
    : path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'ByteBusiness POS',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a', // matches splash so there's no white flash
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,
    },
  });

  // Start loading the vendor dashboard (don't await — do it in background)
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/vendor/orders`);

  // did-finish-load fires after the full page DOM is ready (more reliable than ready-to-show
  // for the handoff moment — prevents a gap where splash is gone but main is still blank)
  await new Promise<void>(resolve => {
    mainWindow!.webContents.once('did-finish-load', resolve);
  });

  // Destroy splash first, then show main — single atomic visual transition
  destroySplash();
  mainWindow.show();

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // External links open in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App menu ─────────────────────────────────────────────────────────────────
function buildAppMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' },
        { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
  ]));
}

// ─── System tray (Windows only) ───────────────────────────────────────────────
function setupTray(): void {
  if (process.platform === 'darwin') return;
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
    : path.join(__dirname, '../electron/assets/tray-icon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) return;
    tray = new Tray(icon);
    tray.setToolTip('ByteBusiness POS');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open POS', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('click', () => {
      if (mainWindow) mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
    });
  } catch { /* tray icon is cosmetic — non-fatal */ }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.on('ready', async () => {
  console.log(`\n🖥️  ByteBusiness POS Desktop v${app.getVersion()}`);
  console.log(`   Platform: ${process.platform} | Packaged: ${app.isPackaged}`);
  console.log('─'.repeat(52));

  // 1. Splash — user sees branding immediately
  createSplash();

  // 2. SQLite + IPC (synchronous, <50ms)
  try {
    initDatabase();
    console.log('✅ SQLite ready');
  } catch (err: unknown) {
    console.error('❌ SQLite init failed:', (err as Error).message);
  }
  setupSQLiteHandlers();
  setupPrinterHandlers();
  buildAppMenu();
  setupTray();

  // 3. Start Next.js server (slow part — splash covers it)
  try {
    serverPort = await startNextServer();
  } catch (err: unknown) {
    console.error('❌ Next.js server failed:', (err as Error).message);
    destroySplash();
    dialog.showErrorBox(
      'ByteBusiness POS — Startup Failed',
      `The POS server could not start.\n\n${(err as Error).message}\n\nPlease reinstall the application.`,
    );
    app.quit();
    return;
  }

  // 4. Load main window (hidden behind splash until did-finish-load)
  await createMainWindow();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopNextServer();
  tray?.destroy();
});

// Navigation guard — vendor-only desktop app
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
      if (!isLocal) {
        event.preventDefault();
        shell.openExternal(url);
        return;
      }
      const p = parsed.pathname;
      const ok = p.startsWith('/vendor') || p.startsWith('/api') || p.startsWith('/_next');
      if (!ok) {
        event.preventDefault();
        mainWindow?.loadURL(`http://127.0.0.1:${serverPort}/vendor/orders`);
      }
    } catch {
      event.preventDefault();
    }
  });
});
