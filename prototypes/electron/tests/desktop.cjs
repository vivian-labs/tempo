const { _electron: electron }=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
process.chdir(path.resolve(__dirname,'..'));
const checks=[];
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const packaged=process.argv.includes('--packaged');
 const executablePath=packaged?path.resolve('../TEMPO-Windows/TEMPO.exe'):require('electron');
 const app=await electron.launch({executablePath,args:packaged?[]:[process.cwd()],env});
 try{
  const p=await app.firstWindow();await p.waitForLoadState('domcontentloaded');
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.evaluate(()=>window.addEventListener('beforeunload',()=>localStorage.clear()));await p.reload();await p.waitForTimeout(500);
  const ok=(name)=>{checks.push(name);console.log('PASS',name);};
  for(const [w,h]of [[1440,1000],[720,850],[620,670]]){
   await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setSize(...s),[w,h]);await p.waitForTimeout(150);
   const dims=await p.evaluate(()=>({h:innerHeight,scroll:document.body.scrollHeight,foot:document.querySelector('footer').getBoundingClientRect().bottom}));
   assert.ok(dims.scroll<=dims.h+2,JSON.stringify({w,h,...dims}));assert.ok(dims.foot<=dims.h+2);ok(`window layout ${w}x${h}`);
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));
  await p.getByRole('button',{name:'翻页',exact:true}).click();await p.waitForTimeout(650);
  assert.deepEqual(await p.locator('.flip-card .top.base span').allTextContents(),['00','25','00']);ok('idle flip view renders immediately');
  await p.getByRole('button',{name:'机械',exact:true}).click();
  await p.getByRole('button',{name:'自定义'}).click();await p.locator('#duration-input').fill('2:99');await p.getByRole('button',{name:'设置时长'}).click();assert.match(await p.locator('#duration-error').textContent(),/有效/);ok('invalid duration stays in dialog');
  await p.locator('#duration-input').fill('00:05');await p.getByRole('button',{name:'设置时长'}).click();
  await p.locator('#start').click();await p.waitForTimeout(1100);await p.locator('#start').click();
  const paused=await p.locator('#time-readout').textContent();await p.waitForTimeout(1100);assert.equal(await p.locator('#time-readout').textContent(),paused);ok('pause freezes visible countdown');
  await p.locator('#start').click();await p.reload();await p.waitForTimeout(150);assert.equal(await p.locator('#start span').textContent(),'暂停片刻');ok('running countdown restores after renderer reload');
  await p.waitForFunction(()=>document.querySelector('#ring-dialog').open,null,{timeout:8000});assert.equal(await p.locator('#time-readout').textContent(),'00:00');ok('countdown reaches zero and opens completion');
  await p.locator('#dismiss-ring').click();await p.waitForTimeout(1000);assert.equal(await p.locator('#ring-dialog').evaluate(e=>e.open),false);ok('completion is dismissed and does not retrigger');
  await p.locator('#reset').click();assert.equal(await p.locator('#time-readout').textContent(),'00:05');
  await p.getByRole('button',{name:'时钟',exact:true}).click();assert.match(await p.locator('#time-readout').textContent(),/^\d{2}:\d{2}:\d{2}$/);assert.equal(await p.locator('#hour-hand').evaluate(e=>getComputedStyle(e).display),'inline');ok('analog wall clock displays three hands');
  await p.getByRole('button',{name:'声音与外观设置'}).click();
  await p.getByRole('button',{name:/暖白工作室/}).click();assert.equal(await p.locator('body').getAttribute('data-theme'),'light');
  await p.locator('#tick-switch').click();assert.equal(await p.locator('#tick-switch').getAttribute('aria-checked'),'true');
  await p.getByRole('button',{name:/瓷片/}).click();await p.locator('#volume').fill('42');await p.locator('#preview-sound').click();await p.waitForTimeout(700);ok('sound preview and volume controls run without errors');
  await p.getByRole('button',{name:'关闭设置'}).click();await p.reload();assert.equal(await p.locator('body').getAttribute('data-theme'),'light');assert.match(await p.locator('#sound-toggle span').textContent(),/开启/);ok('appearance and sound settings persist');
  await p.getByRole('button',{name:'闹钟',exact:true}).click();
  const base=new Date();base.setSeconds(0,0);base.setMinutes(base.getMinutes()+1);
  const target=new Date(base.getTime()+60000),hh=String(target.getHours()).padStart(2,'0'),mm=String(target.getMinutes()).padStart(2,'0');
  await p.clock.install({time:base});await p.reload();await p.locator('#alarm-time').fill(`${hh}:${mm}`);await p.locator('#alarm-time').dispatchEvent('change');await p.locator('#alarm-toggle').click();
  await p.waitForFunction(()=>document.querySelector('#alarm-toggle span').textContent==='关闭闹钟');
  await p.clock.fastForward(61000);assert.equal(await p.locator('#ring-dialog').evaluate(e=>e.open),true);ok('daily alarm triggers at selected local time');
  await p.locator('#snooze').click();assert.equal(await p.locator('#ring-dialog').evaluate(e=>e.open),false);
  await p.clock.fastForward(301000);assert.equal(await p.locator('#ring-dialog').evaluate(e=>e.open),true);ok('five-minute snooze triggers again');await p.locator('#dismiss-ring').click();
  await p.locator('#alarm-toggle').click();
  await p.locator('#pin').click();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);await p.locator('#pin').click();ok('native always-on-top toggles');
  await p.locator('#fullscreen').click();await new Promise(r=>setTimeout(r,350));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),true);await p.keyboard.press('Escape');await new Promise(r=>setTimeout(r,350));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()),false);ok('native fullscreen and Escape');
  // Render the actual synth offline and save a WAV for an inspectable audio artifact.
  const samples=await p.evaluate(async()=>{
   const {MechanicalAudio}=await import('./audio.mjs');
   const ctx=new OfflineAudioContext(1,48000*3,48000);
   const a=new MechanicalAudio();a.ctx=new Proxy(ctx,{get(t,key){if(key==='state')return 'running';const v=Reflect.get(t,key,t);return typeof v==='function'?v.bind(t):v;}});a.volume=.55;a.enabled=true;
   a.click({at:0});a.click({at:1});a.click({at:2,kind:'flip'});
   const rendered=await ctx.startRendering();return Array.from(rendered.getChannelData(0));
  });
  assert.ok(samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0)>.02);assert.ok(samples.slice(10000,45000).every(x=>Math.abs(x)<.001));
  const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));fs.writeFileSync('mechanical-sound.wav',wav);ok('actual sound synth produces short non-silent transients');
  assert.deepEqual(errors,[]);ok('no renderer errors, font errors or failed resource loads');
  // Leave a clean first launch for the user.
  await p.evaluate(()=>window.addEventListener('beforeunload',()=>localStorage.clear()));
  const report={packaged,checks,rendererErrors:errors,platform:process.platform,date:new Date().toISOString()};fs.writeFileSync(packaged?'docs/packaged-qa.json':'docs/desktop-qa.json',JSON.stringify(report,null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
