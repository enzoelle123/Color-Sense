// Carrega .env manualmente — dotenv v17+ quebra o require do Electron
const fs = require('fs');
const envFile = require('path').join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
}

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, desktopCapturer } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { getPreferences, savePreferences } = require('./src/store/preferences');
const { SIMULATION_MATRICES, CORRECTION_MATRICES } = require('./src/algorithms/colorFilters');
const { signUp, signIn, signOut, getSession, getUser } = require('./src/store/auth');
const { getScenes, createScene, updateScene, deleteScene, addPatternRule, updatePatternRule, deletePatternRule } = require('./src/store/sceneStore');

let mainWindow    = null;
let tray          = null;
let colorDaemon   = null;
let daemonReady   = false;
let pendingCommand = null;
let appQuitting   = false;
let overlayWindow = null;
let cachedRules   = [];

// Modo Criador — simulação de daltonismo para designers/devs.
// Em memória (ferramenta transitória, não persiste entre sessões).
let simulationActive = false;
let simulationType   = 'protanopia';

app.setAppUserModelId('com.colorsense.app');

// Instância única — se o app já está aberto, foca a janela existente
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

let authWindow = null;

function createAuthWindow() {
  authWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    title: 'ColorSense — Entrar',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  authWindow.loadFile(path.join(__dirname, 'src', 'auth', 'auth.html'));
  authWindow.setMenuBarVisibility(false);

  // Após login bem-sucedido, abre o painel principal
  ipcMain.once('auth:success', () => {
    authWindow.close();
    authWindow = null;
    createMainWindow();
    applyCurrentFilter();
    refreshActiveRules();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
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

// ── Overlay Window ────────────────────────────────────────────────────────────

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    x: 0, y: 0, width, height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'ui', 'overlay-preload.js')
    }
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  // Proteção de captura desligada: o filtro aparece em prints e compartilhamento de tela.
  overlayWindow.setContentProtection(false);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, 'src', 'ui', 'overlay.html'));

  // Garante que o overlay receba as regras mesmo após reload/startup
  overlayWindow.webContents.on('did-finish-load', () => syncOverlay());
}

// Recarrega do Supabase as regras da cena ativa e empurra para o overlay
async function refreshActiveRules() {
  const prefs = getPreferences();

  if (!prefs.activeSceneId) {
    cachedRules = [];
  } else {
    try {
      const { supabase } = require('./src/store/supabase');
      const { data } = await supabase
        .from('pattern_rules')
        .select('*')
        .eq('scene_id', prefs.activeSceneId);
      cachedRules = data || [];
    } catch (err) {
      console.error('[Overlay] erro ao carregar regras:', err.message);
      cachedRules = [];
    }
  }

  syncOverlay();
}

// Padrões visuais seguem o toggle universal: só aparecem com o filtro ativo.
// Durante a simulação (modo Criador) ficam ocultos para não poluir a tela.
function syncOverlay() {
  if (!overlayWindow) return;
  const prefs = getPreferences();
  if (!simulationActive && prefs.filterActive && cachedRules.length) {
    overlayWindow.webContents.send('overlay-rules', cachedRules);
  } else {
    overlayWindow.webContents.send('overlay-clear');
  }
}

// O overlay captura a tela via getUserMedia (stream contínuo, acelerado por GPU).
// Aqui só fornecemos o id da fonte de captura.
ipcMain.handle('overlay:get-source', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 }
  });
  return sources.length ? sources[0].id : null;
});

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
  // A simulação (modo Criador) tem prioridade sobre o filtro de correção:
  // o designer quer ver a tela exatamente como um daltônico veria.
  if (simulationActive) {
    const sim = SIMULATION_MATRICES[simulationType];
    sendToDaemon(sim ? { action: 'apply', matrix: sim.matrix } : { action: 'clear' });
    return;
  }

  const prefs = getPreferences();

  if (!prefs.filterActive || prefs.filterType === 'normal') {
    sendToDaemon({ action: 'clear' });
  } else {
    const filter = CORRECTION_MATRICES[prefs.filterType];
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
        syncOverlay();
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
  syncOverlay();
  tray.setContextMenu(buildTrayMenu());
  return getPreferences();
});

ipcMain.handle('toggle-overlay', (_, enabled) => {
  savePreferences({ filterActive: enabled });
  applyCurrentFilter();
  syncOverlay();
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

// ── IPC: Criador (simulação de daltonismo) ────────────────────────────────────

ipcMain.handle('sim:get-state', () => ({ active: simulationActive, type: simulationType }));

ipcMain.handle('sim:toggle', (_, enabled) => {
  simulationActive = enabled;
  applyCurrentFilter();
  syncOverlay();
  tray.setContextMenu(buildTrayMenu());
  return { active: simulationActive, type: simulationType };
});

ipcMain.handle('sim:set-type', (_, type) => {
  simulationType = type;
  if (simulationActive) applyCurrentFilter();
  return { active: simulationActive, type: simulationType };
});

// ── IPC: Auth ────────────────────────────────────────────────────────────────

ipcMain.handle('auth:sign-up',     (_, data)        => signUp(data));
ipcMain.handle('auth:sign-in',     (_, data)        => signIn(data));
ipcMain.handle('auth:sign-out', async () => {
  await signOut();
  savePreferences({ activeSceneId: null, filterActive: false });
  cachedRules = [];
  simulationActive = false;
  syncOverlay();
  applyCurrentFilter();
  if (mainWindow) { mainWindow.destroy(); mainWindow = null; }
  createAuthWindow();
});
ipcMain.handle('auth:get-session', ()               => getSession());
ipcMain.handle('auth:get-user',    ()               => getUser());

// ── IPC: Cenas ────────────────────────────────────────────────────────────────

ipcMain.handle('scenes:get-all', ()              => getScenes());
ipcMain.handle('scenes:create',  (_, data)       => createScene(data));
ipcMain.handle('scenes:update',  (_, id, fields) => updateScene(id, fields));
ipcMain.handle('scenes:delete',  (_, id)         => deleteScene(id));

ipcMain.handle('scenes:add-rule', async (_, sceneId, data) => {
  const rule = await addPatternRule(sceneId, data);
  // Se a regra pertence à cena ativa, aplica imediatamente
  if (getPreferences().activeSceneId === sceneId) await refreshActiveRules();
  return rule;
});

ipcMain.handle('scenes:update-rule', async (_, id, data) => {
  const rule = await updatePatternRule(id, data);
  await refreshActiveRules();
  return rule;
});

ipcMain.handle('scenes:delete-rule', async (_, id) => {
  await deletePatternRule(id);
  await refreshActiveRules();
});

ipcMain.handle('scenes:activate', (_, sceneId, filterType, rules) => {
  // Ativar uma cena liga o filtro automaticamente
  savePreferences({ activeSceneId: sceneId, filterType, filterActive: true });
  cachedRules = rules || [];
  applyCurrentFilter();
  syncOverlay();
  tray.setContextMenu(buildTrayMenu());
  if (mainWindow) mainWindow.webContents.send('apply-filter', { type: filterType, active: true });
  return getPreferences();
});

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const session = await getSession();

  createTray();
  startColorDaemon();
  createOverlayWindow();

  if (session) {
    await refreshActiveRules();
    createMainWindow();
    applyCurrentFilter();
  } else {
    createAuthWindow();
  }
});

app.on('before-quit', () => {
  appQuitting = true;
  stopColorDaemon();
});

app.on('window-all-closed', () => {});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});
