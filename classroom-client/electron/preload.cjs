const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDeviceSerial: () => ipcRenderer.invoke('get-device-serial'),
  exitFullscreen: () => ipcRenderer.invoke('exit-fullscreen'),
});