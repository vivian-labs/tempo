const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('tempoDesktop',Object.freeze({
 action:action=>['fullscreen','pin','exit-fullscreen'].includes(action)?ipcRenderer.invoke('window-action',action):Promise.resolve(false),
 awake:value=>ipcRenderer.send('awake',!!value),
 attention:()=>ipcRenderer.send('attention'),
 onWindow:fn=>ipcRenderer.on('window-state',(_e,value)=>fn(value)),
 onResume:fn=>ipcRenderer.on('system-resume',()=>fn()),
 platform:process.platform
}));
