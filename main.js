const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { getPreferences, savePreferences } = require('./src/store/preferences');
const { FILTER_TYPES } = require('./src/algorithms/colorFilters');

let mainWindow = null;
let tray = null;
let colorDaemon = null;
let daemonReady = false;
let pendingCommand = null;
let appQuitting = false;

app.setAppUserModelId('com.colorsense.app');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    resizable: false,
    show: false,
    title: 'ColorSense',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!appQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Color Daemon (Windows Magnification API) ─────────────────────────────────

function startColorDaemon() {
  if (colorDaemon) return;

  const scriptPath = path.join(__dirname, 'src', 'native', 'colorDaemon.ps1');

  colorDaemon = spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NonInteractive',
    '-WindowStyle', 'Hidden',
    '-File', scriptPath
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

  let buf = '';

  colorDaemon.stdout.on('data', (data) => {
    buf += data.toString();
    const lines = buf.split('\n');
    buf = lines.pop();

    lines.forEach(line => {
      line = line.trim();
      if (line === 'READY') {
        daemonReady = true;
        if (pendingCommand) {
          _sendToDaemon(pendingCommand);
          pendingCommand = null;
        }
      } else if (line.startsWith('ERROR:')) {
        console.error('[ColorDaemon]', line);
      }
    });
  });

  colorDaemon.stderr.on('data', (d) => console.error('[ColorDaemon stderr]', d.toString()));

  colorDaemon.on('exit', (code) => {
    colorDaemon = null;
    daemonReady = false;
    if (!appQuitting && code !== 0) {
      console.error('[ColorDaemon] exited unexpectedly with code', code);
    }
  });
}

function _sendToDaemon(command) {
  try {
    colorDaemon.stdin.write(JSON.stringify(command) + '\n');
  } catch (err) {
    console.error('[ColorDaemon] write error:', err);
  }
}

function sendToDaemon(command) {
  if (!colorDaemon) {
    startColorDaemon();
    pendingCommand = command;
    return;
  }
  if (!daemonReady) {
    pendingCommand = command;
    return;
  }
  _sendToDaemon(command);
}

function stopColorDaemon() {
  if (!colorDaemon) return;
  try {
    _sendToDaemon({ action: 'exit' });
    setTimeout(() => { if (colorDaemon) colorDaemon.kill(); }, 1000);
  } catch (_) {
    colorDaemon.kill();
  }
}

// ── Filter Logic ─────────────────────────────────────────────────────────────

function applyCurrentFilter() {
  const prefs = getPreferences();

  if (!prefs.filterActive || prefs.filterType === 'normal') {
    sendToDaemon({ action: 'clear' });
  } else {
    const filter = FILTER_TYPES[prefs.filterType];
    if (filter) {
      sendToDaemon({ action: 'apply', matrix: filter.matrix });
    }
  }
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function buildTrayMenu() {
  const prefs = getPreferences();
  const typeLabels = {
    normal: 'Normal', protanopia: 'Protanopia', protanomalia: 'Protanomalia',
    deuteranopia: 'Deuteranopia', deuteranomalia: 'Deuteranomalia',
    tritanopia: 'Tritanopia', tritanomalia: 'Tritanomalia', achromatopsia: 'Acromatopsia'
  };

  return Menu.buildFromTemplate([
    { label: 'ColorSense', enabled: false },
    { type: 'separator' },
    { label: 'Abrir Painel', click: () => { mainWindow.show(); mainWindow.focus(); } },
    {
      label: 'Filtro Ativo',
      type: 'checkbox',
      checked: prefs.filterActive,
      click: (item) => {
        savePreferences({ filterActive: item.checked });
        applyCurrentFilter();
        tray.setContextMenu(buildTrayMenu());
        if (mainWindow) mainWindow.webContents.send('apply-filter', { type: prefs.filterType, active: item.checked });
      }
    },
    { type: 'separator' },
    {
      label: 'Tipo de Daltonismo',
      submenu: Object.keys(typeLabels).map(type => ({
        label: typeLabels[type],
        type: 'radio',
        checked: prefs.filterType === type,
        click: () => {
          savePreferences({ filterType: type });
          applyCurrentFilter();
          tray.setContextMenu(buildTrayMenu());
          if (mainWindow) mainWindow.webContents.send('apply-filter', { type, active: getPreferences().filterActive });
        }
      }))
    },
    { type: 'separator' },
    { label: 'Sair', click: () => { appQuitting = true; app.quit(); } }
  ]);
}

function createTray() {
  let icon;
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icons', 'tray.png'));
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('ColorSense');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-preferences', () => getPreferences());

ipcMain.handle('save-preferences', (_, prefs) => {
  savePreferences(prefs);
  applyCurrentFilter();
  tray.setContextMenu(buildTrayMenu());
  return getPreferences();
});

ipcMain.handle('toggle-overlay', (_, enabled) => {
  savePreferences({ filterActive: enabled });
  applyCurrentFilter();
  tray.setContextMenu(buildTrayMenu());
  return getPreferences();
});

ipcMain.handle('set-filter-type', (_, type) => {
  savePreferences({ filterType: type });
  applyCurrentFilter();
  tray.setContextMenu(buildTrayMenu());
  if (mainWindow) mainWindow.webContents.send('apply-filter', { type, active: getPreferences().filterActive });
  return getPreferences();
});

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  startColorDaemon();
  applyCurrentFilter();
});

app.on('before-quit', () => {
  appQuitting = true;
  stopColorDaemon();
});

app.on('window-all-closed', () => {});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
