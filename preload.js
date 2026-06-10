const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('colorSenseAPI', {
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (prefs) => ipcRenderer.invoke('save-preferences', prefs),
  toggleOverlay: (enabled) => ipcRenderer.invoke('toggle-overlay', enabled),
  setFilterType: (type) => ipcRenderer.invoke('set-filter-type', type),
  onApplyFilter: (callback) => ipcRenderer.on('apply-filter', (_, data) => callback(data)),
  removeApplyFilter: () => ipcRenderer.removeAllListeners('apply-filter')
});
