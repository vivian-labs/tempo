const {app,BrowserWindow,ipcMain,Menu,powerSaveBlocker,powerMonitor,screen}=require('electron');
const path=require('node:path');
let win,blocker=null;
app.setName('TEMPO');
app.setAppUserModelId('studio.tempo.instrument');
const lock=app.requestSingleInstanceLock();
if(!lock)app.quit();
else {
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(()=>{
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform==='darwin'?[{label:'TEMPO',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'quit'}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]:[]));
  function create(){
   win=new BrowserWindow({width:1440,height:1000,minWidth:620,minHeight:670,backgroundColor:'#141615',title:'TEMPO',autoHideMenuBar:true,
    icon:path.join(__dirname,'app','icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
   win.loadFile('app/index.html');
   win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   win.webContents.on('will-navigate',(e)=>e.preventDefault());
   win.on('closed',()=>{win=null;setAwake(false);});
   win.on('enter-full-screen',()=>win.webContents.send('window-state',{fullscreen:true}));
   win.on('leave-full-screen',()=>win.webContents.send('window-state',{fullscreen:false}));
  }
  create();
  app.on('activate',()=>{if(!win)create();else win.show();});
  ipcMain.handle('window-action',(e,action)=>{
   if(!win||e.sender!==win.webContents)return;
   if(action==='fullscreen'){win.setFullScreen(!win.isFullScreen());return win.isFullScreen();}
   if(action==='pin'){win.setAlwaysOnTop(!win.isAlwaysOnTop());return win.isAlwaysOnTop();}
   if(action==='exit-fullscreen'){win.setFullScreen(false);return false;}
  });
  ipcMain.on('awake',(e,value)=>{if(win&&e.sender===win.webContents)setAwake(value===true);});
  ipcMain.on('attention',e=>{if(win&&e.sender===win.webContents){win.flashFrame(true);if(process.platform==='darwin')app.dock.bounce('informational');}});
  powerMonitor.on('resume',()=>win?.webContents.send('system-resume'));
 });
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
function setAwake(yes){
 if(yes&&blocker===null)blocker=powerSaveBlocker.start('prevent-display-sleep');
 if(!yes&&blocker!==null){powerSaveBlocker.stop(blocker);blocker=null;}
}
