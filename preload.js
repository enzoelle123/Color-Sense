const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('colorSenseAPI', {
  // Preferências locais
  getPreferences:  ()       => ipcRenderer.invoke('get-preferences'),
  savePreferences: (prefs)  => ipcRenderer.invoke('save-preferences', prefs),
  toggleOverlay:   (enabled)=> ipcRenderer.invoke('toggle-overlay', enabled),
  setFilterType:   (type)   => ipcRenderer.invoke('set-filter-type', type),
  onApplyFilter:   (cb)     => ipcRenderer.on('apply-filter', (_, data) => cb(data)),
  removeApplyFilter: ()     => ipcRenderer.removeAllListeners('apply-filter'),

  // Auth
  signUp:     (data)  => ipcRenderer.invoke('auth:sign-up', data),
  signIn:     (data)  => ipcRenderer.invoke('auth:sign-in', data),
  signOut:    ()      => ipcRenderer.invoke('auth:sign-out'),
  getSession: ()      => ipcRenderer.invoke('auth:get-session'),
  getUser:    ()      => ipcRenderer.invoke('auth:get-user'),

  // Perfis
  getProfiles:      ()           => ipcRenderer.invoke('profiles:get-all'),
  createProfile:    (data)       => ipcRenderer.invoke('profiles:create', data),
  updateProfile:    (id, fields) => ipcRenderer.invoke('profiles:update', id, fields),
  deleteProfile:    (id)         => ipcRenderer.invoke('profiles:delete', id),
  addPatternRule:   (pid, data)  => ipcRenderer.invoke('profiles:add-rule', pid, data),
  deletePatternRule:(id)         => ipcRenderer.invoke('profiles:delete-rule', id),

  // Renderer → main: login concluído
  notifyAuthSuccess: () => ipcRenderer.send('auth:success'),

  // Main → renderer
  onAuthChange: (cb) => ipcRenderer.on('auth:changed', (_, data) => cb(data))
});
