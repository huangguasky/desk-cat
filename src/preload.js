const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  beginDrag: (x, y) => ipcRenderer.send('pet:drag-begin', { x, y }),
  dragTo: (x, y) => ipcRenderer.send('pet:drag-move', { x, y }),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  showContextMenu: () => ipcRenderer.send('pet:context-menu'),
  onCommand: (listener) => {
    const handler = (_event, command) => listener(command);
    ipcRenderer.on('pet:command', handler);
    return () => ipcRenderer.removeListener('pet:command', handler);
  },
});
