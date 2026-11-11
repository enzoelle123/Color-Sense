const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('seletor', {
  aoReceberRetrato: (cb) => ipcRenderer.on('picker:retrato', (_, dataUrl) => cb(dataUrl)),
  escolher:         (hex) => ipcRenderer.send('picker:escolhido', hex)
});
