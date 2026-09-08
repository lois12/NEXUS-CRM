const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const http = require('http');

let mainWindow;
let tray = null;
let backendProcess = null;
let backendReady = false;
let backendStartTime = null;
let startGeneration = 0;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'server');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'client');
const DB_PATH = path.join(PROJECT_ROOT, 'server', 'nexus.db');
const SETTINGS_PATH = path.join(__dirname, 'launcher-settings.json');
const APP_PORT = 8080;

// ─── Settings ──────────────────────────────────────────────────

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch {}
  return { autoStart: false, minimizeToTray: true };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let settings = loadSettings();

// ─── Helpers ───────────────────────────────────────────────────

function send(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function killProcess(proc) {
  if (!proc) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true }, () => resolve());
      } else {
        proc.kill('SIGTERM');
        setTimeout(resolve, 500);
      }
    } catch {
      try { proc.kill(); } catch {}
      resolve();
    }
  });
}

async function killAll() {
  await killProcess(backendProcess);
  backendProcess = null;
  backendReady = false;
  backendStartTime = null;
  send('backend-status', 'stopped');
}

// ─── DB size ───────────────────────────────────────────────────

function getDbSize() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const stats = fs.statSync(DB_PATH);
      return stats.size;
    }
  } catch {}
  return 0;
}

// ─── Kill process on port ──────────────────────────────────────

function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    exec(`netstat -ano | findstr :${port}`, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) { resolve(false); return; }
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(pid)) pids.add(pid);
      });
      if (pids.size === 0) { resolve(false); return; }
      let killed = 0;
      pids.forEach(pid => {
        exec(`taskkill /PID ${pid} /F`, { windowsHide: true }, () => {
          killed++;
          if (killed === pids.size) resolve(true);
        });
      });
    });
  });
}

// ─── Health check ──────────────────────────────────────────────

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
      req.destroy();
    });
    req.on('error', () => { resolve(false); req.destroy(); });
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

// Robust check: try up to 3 times
async function isServerAlive(port) {
  for (let i = 0; i < 3; i++) {
    if (await checkPort(port)) return true;
    if (i < 2) await new Promise(r => setTimeout(r, 500));
  }
  // Fallback: check if port is occupied at TCP level
  return await isPortOccupied(port);
}

function isPortOccupied(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => { server.close(); resolve(false); });
    server.listen(port, '0.0.0.0');
  });
}

function pollHealth(url, timeout = 60000) {
  return new Promise((resolve) => {
    const start = Date.now();
    let resolved = false;
    const check = () => {
      if (resolved) return;
      const req = http.get(url, (res) => {
        if (resolved) { req.destroy(); return; }
        if (res.statusCode === 200) { resolved = true; resolve(true); }
        else if (Date.now() - start < timeout) setTimeout(check, 1000);
        else { resolved = true; resolve(false); }
        req.destroy();
      });
      req.on('error', () => {
        if (resolved) { req.destroy(); return; }
        if (Date.now() - start < timeout) setTimeout(check, 1000);
        else { resolved = true; resolve(false); }
        req.destroy();
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (resolved) return;
        if (Date.now() - start < timeout) setTimeout(check, 1000);
        else { resolved = true; resolve(false); }
      });
    };
    check();
  });
}

// ─── Run command ───────────────────────────────────────────────

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`[runCommand] ${command} ${args.join(' ')} in ${cwd}`);
    send('backend-log', `[CMD] ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) send('backend-log', text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text && !text.includes('duplicate column')) {
        send('backend-log', text);
      }
    });

    proc.on('close', (code) => {
      console.log(`[runCommand] Exited with code ${code}`);
      resolve(code);
    });

    proc.on('error', (err) => {
      console.error('[runCommand] Error:', err);
      reject(err);
    });
  });
}

// ─── Start server ──────────────────────────────────────────────

async function startBackend() {
  if (backendProcess) {
    send('backend-log', '[SYSTEM] Сервер уже запущен');
    return;
  }

  const gen = ++startGeneration;

  // Check if already running (robust: retry + TCP fallback)
  send('backend-log', '[SYSTEM] Проверка порта ' + APP_PORT + '...');
  const portInUse = await isServerAlive(APP_PORT);
  if (portInUse) {
    send('backend-log', `[SYSTEM] Сервер уже работает на порту ${APP_PORT}`);
    backendReady = true;
    backendStartTime = backendStartTime || Date.now();
    send('backend-status', 'running');
    return;
  }

  // Step 1: Build frontend
  send('backend-status', 'building');
  send('backend-log', '[BUILD] Шаг 1/2: Сборка фронтенда...');
  try {
    const frontendCode = await runCommand('npm', ['run', 'build'], FRONTEND_DIR);
    if (frontendCode !== 0) {
      send('backend-log', `[BUILD] Фронтенд ошибка (код ${frontendCode})`);
      send('backend-status', 'stopped');
      return;
    }
    send('backend-log', '[BUILD] Фронтенд собран ✓');
  } catch (err) {
    send('backend-log', '[BUILD] Ошибка: ' + err.message);
    send('backend-status', 'stopped');
    return;
  }

  // Step 2: Build server
  send('backend-log', '[BUILD] Шаг 2/2: Сборка сервера...');
  try {
    const serverCode = await runCommand('npm', ['run', 'build'], BACKEND_DIR);
    if (serverCode !== 0) {
      send('backend-log', `[BUILD] Сервер ошибка (код ${serverCode})`);
      send('backend-status', 'stopped');
      return;
    }
    send('backend-log', '[BUILD] Сервер собран ✓');
  } catch (err) {
    send('backend-log', '[BUILD] Ошибка: ' + err.message);
    send('backend-status', 'stopped');
    return;
  }

  // Step 3: Start server
  send('backend-status', 'starting');
  send('backend-log', '[START] Запуск сервера на порту ' + APP_PORT + '...');

  backendProcess = spawn('node', ['dist/server.js'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) send('backend-log', text);
  });

  backendProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text && !text.includes('duplicate column')) {
      send('backend-log', text);
    }
  });

  backendProcess.on('close', (code) => {
    send('backend-log', `[SYSTEM] Сервер завершился (код ${code})`);
    backendProcess = null;
    backendReady = false;
    backendStartTime = null;
    send('backend-status', 'stopped');
  });

  backendProcess.on('error', (err) => {
    send('backend-log', 'ERROR: ' + err.message);
    send('backend-status', 'stopped');
  });

  // Wait for server to be ready
  send('backend-log', '[START] Ожидание ответа сервера...');
  const ok = await pollHealth(`http://localhost:${APP_PORT}/api/health`, 30000);
  if (gen !== startGeneration) return; // stale check, ignore
  if (ok) {
    backendReady = true;
    backendStartTime = Date.now();
    send('backend-status', 'running');
    send('backend-log', `[SYSTEM] ✓ NEXUS CRM готов — http://localhost:${APP_PORT}`);
  } else {
    // Server process is running but didn't respond to health check
    if (backendProcess) {
      send('backend-log', '[SYSTEM] Сервер запущен, но не ответил за 30 сек. Проверьте логи.');
      send('backend-status', 'running');
      backendReady = true;
      backendStartTime = Date.now();
    } else {
      send('backend-status', 'stopped');
      send('backend-log', '[SYSTEM] Сервер не ответил за 30 секунд');
    }
  }
}

// ─── System Tray ───────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAapJREFUWEftlr1Ow0AQhb8ZEhAHQIILEOIiiR1R8ABUSEh0fAAfQEWN+AJo+AA6CkRJQ0MHEBqQECI4ACIcAGFm7LF3bSdxhSJYdLL3+83M7toTI3yMEW4AAm8BvAN4KpOJFQET+BPADYBjANuloiwI3AK4tqCrPCuBZwDnAF7LBG0EngCcAXgpE7QReABwCuC9TNBG4B7ACYCPMkEbgTsARwCqZYI2ArcADgHUygRtBG4AHAColwnaCFwD2AfQKBO0EbgCsAegWSZoI3AJYBdAq0zQRuACwA6AdpmgjcA5gG0AnTJBG4EzAJsAumWCNgKnADYAfJYJ2gicAFgH8FUmaCNwDGA79PdpI3AEYAvAd5mgjcAhAANolQnaCBwAWANQLxO0EdgHsArgp0zQRmAPwAqARpmgjcAugBUAzTJBG4FlAEsAWmWCNgJLAJrA/3gBvwAWACyX/4S1CdwBWAy8W30fgXu/34VYAbDgf7f6PgI3fh9LBwDm/S9X30dgye9jKQGY879efR+B5b6PTu8Z9V5Q7w31XtGf0L0X1ntivTfWe+Q/d+kfD/gD+yJuShQDqOcAAAAASUVORK5CYII='
  );
  tray = new Tray(icon);
  tray.setToolTip('NEXUS CRM Launcher');

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Показать', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Запустить NEXUS', click: () => startBackend() },
      { label: 'Остановить NEXUS', click: () => killAll() },
      { type: 'separator' },
      { label: 'Открыть в браузере', click: () => shell.openExternal(`http://localhost:${APP_PORT}`) },
      { type: 'separator' },
      { label: 'Выход', click: () => { killAll(); app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateMenu();
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  return updateMenu;
}

// ─── IPC handlers ──────────────────────────────────────────────

ipcMain.on('start-backend', () => startBackend());

ipcMain.on('start-all', () => {
  console.log('[IPC] start-all received');
  startBackend();
});

ipcMain.on('stop-backend', async () => {
  await killProcess(backendProcess);
  backendProcess = null;
  backendReady = false;
  backendStartTime = null;
  send('backend-status', 'stopped');
});

ipcMain.on('stop-all', async () => await killAll());

ipcMain.on('restart-all', async () => {
  await killAll();
  send('backend-log', '[SYSTEM] РЕСТАРТ...');
  setTimeout(() => {
    startBackend();
  }, 1500);
});

ipcMain.on('open-browser', () => shell.openExternal(`http://localhost:${APP_PORT}`));

ipcMain.on('build-frontend', async () => {
  send('backend-status', 'building');
  send('backend-log', '[BUILD] Сборка фронтенда...');
  try {
    const code = await runCommand('npm', ['run', 'build'], FRONTEND_DIR);
    if (code === 0) {
      send('backend-log', '[BUILD] Фронтенд собран ✓');
    } else {
      send('backend-log', `[BUILD] Фронтенд ошибка (код ${code})`);
    }
  } catch (err) {
    send('backend-log', '[BUILD] Ошибка: ' + err.message);
  }
  send('backend-status', backendReady ? 'running' : 'stopped');
});

ipcMain.on('build-backend', async () => {
  send('backend-status', 'building');
  send('backend-log', '[BUILD] Сборка бэкенда...');
  try {
    const code = await runCommand('npm', ['run', 'build'], BACKEND_DIR);
    if (code === 0) {
      send('backend-log', '[BUILD] Бэкенд собран ✓');
    } else {
      send('backend-log', `[BUILD] Бэкенд ошибка (код ${code})`);
    }
  } catch (err) {
    send('backend-log', '[BUILD] Ошибка: ' + err.message);
  }
  send('backend-status', backendReady ? 'running' : 'stopped');
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', async () => {
  if (settings.minimizeToTray) {
    if (mainWindow) mainWindow.hide();
  } else {
    await killAll();
    if (mainWindow) mainWindow.close();
  }
});

// Settings
ipcMain.on('get-settings', (event) => {
  event.returnValue = settings;
});

ipcMain.on('save-settings', (_, newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettings(settings);
});

// DB size
ipcMain.on('get-db-size', (event) => {
  event.returnValue = getDbSize();
});

// Uptime
ipcMain.on('get-uptime', (event) => {
  event.returnValue = {
    backend: backendStartTime ? Date.now() - backendStartTime : 0,
  };
});

// Kill port
ipcMain.handle('kill-port', async (_, port) => {
  return await killPort(port);
});

// ─── Deploy ────────────────────────────────────────────────────

ipcMain.on('deploy', async () => {
  send('backend-log', '[DEPLOY] === СТАРТ ДЕПЛОЯ ===');
  send('deploy-status', 'running');

  // Step 1: Git add + commit + push
  send('backend-log', '[DEPLOY] Шаг 1/2: Git push...');
  try {
    await runCommand('git', ['add', '.'], PROJECT_ROOT);
    const diffCode = await runCommand('git', ['diff', '--cached', '--quiet'], PROJECT_ROOT);
    if (diffCode === 0) {
      send('backend-log', '[DEPLOY] Нет изменений для коммита');
    } else {
      const commitCode = await runCommand('git', ['commit', '-m', 'deploy: update from launcher'], PROJECT_ROOT);
      if (commitCode !== 0) {
        send('backend-log', `[DEPLOY] Ошибка коммита (код ${commitCode})`);
        send('deploy-status', 'failed');
        return;
      }
    }
    const pushCode = await runCommand('git', ['push', 'origin', 'main'], PROJECT_ROOT);
    if (pushCode !== 0) {
      send('backend-log', `[DEPLOY] Ошибка push (код ${pushCode})`);
      send('deploy-status', 'failed');
      return;
    }
    send('backend-log', '[DEPLOY] Git push ✓');
  } catch (err) {
    send('backend-log', '[DEPLOY] Ошибка git: ' + err.message);
    send('deploy-status', 'failed');
    return;
  }

  // Step 2: SSH deploy on VPS (build + tests happen there)
  send('backend-log', '[DEPLOY] Шаг 2/2: Деплой на VPS...');
  try {
    const sshScript = path.join(PROJECT_ROOT, 'ssh_deploy.py');
    const deployCode = await runCommand('python', [`"${sshScript}"`], PROJECT_ROOT);
    if (deployCode !== 0) {
      send('backend-log', `[DEPLOY] VPS деплой провален (код ${deployCode})`);
      send('deploy-status', 'failed');
      return;
    }
    send('backend-log', '[DEPLOY] VPS деплой ✓');
  } catch (err) {
    send('backend-log', '[DEPLOY] Ошибка SSH: ' + err.message);
    send('deploy-status', 'failed');
    return;
  }

  send('backend-log', '[DEPLOY] === ДЕПЛОЙ ЗАВЕРШЁН ===');
  send('deploy-status', 'success');
});

// Open paths
ipcMain.on('open-uploads', () => {
  const uploadsDir = path.join(PROJECT_ROOT, 'server', 'uploads');
  shell.openPath(uploadsDir);
});

ipcMain.on('open-db', () => {
  shell.showItemInFolder(DB_PATH);
});

ipcMain.on('open-in-editor', () => {
  const editors = ['code', 'cursor'];
  const tryEditor = (i) => {
    if (i >= editors.length) {
      shell.openPath(PROJECT_ROOT);
      return;
    }
    exec(`${editors[i]} "${PROJECT_ROOT}"`, { windowsHide: true }, (err) => {
      if (err) tryEditor(i + 1);
    });
  };
  tryEditor(0);
});

// Export logs
ipcMain.handle('export-logs', async (_, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить логи',
    defaultPath: `nexus-launcher-log-${new Date().toISOString().slice(0,10)}.txt`,
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  }
  return false;
});

// ─── Window ────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 700,
    useContentSize: true,
    resizable: true,
    minWidth: 480,
    minHeight: 520,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    killAll();
    mainWindow = null;
  });
}

// ─── App lifecycle ─────────────────────────────────────────────

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-crash-reporter');

// Suppress Chromium crash dialog
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

app.whenReady().then(async () => {
  createTray();
  createWindow();

  // Register global shortcuts
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  // Auto-start if enabled
  if (settings.autoStart) {
    setTimeout(() => {
      send('auto-start-triggered');
      startBackend();
    }, 1500);
  }

  // Send DB size periodically
  setInterval(() => {
    send('db-size-update', getDbSize());
  }, 5000);

  // Poll server health every 3 seconds
  setInterval(async () => {
    const alive = await isServerAlive(APP_PORT);
    if (alive && !backendReady) {
      backendReady = true;
      backendStartTime = backendStartTime || Date.now();
      send('backend-status', 'running');
      send('backend-log', `[SYSTEM] Сервер обнаружен на порту ${APP_PORT}`);
    } else if (!alive && backendReady && !backendProcess) {
      backendReady = false;
      backendStartTime = null;
      send('backend-status', 'stopped');
      send('backend-log', '[SYSTEM] Сервер недоступен');
    }
  }, 3000);
});

app.on('window-all-closed', () => {
  if (!tray) {
    killAll();
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  killAll();
});
