import { Instrument, parseDuration, formatDuration } from './engine.mjs';
import { MechanicalAudio } from './audio.mjs';
const $=id=>document.getElementById(id),$$=s=>[...document.querySelectorAll(s)];
let saved={};try{saved=JSON.parse(localStorage.getItem('tempo.v1')||'{}')}catch{}
const instrument=new Instrument(saved), s=instrument.state, audio=new MechanicalAudio(), desktop=window.tempoDesktop;
let lastSecond=null,flipValues=[],wasAwake=false,fullscreen=false,toastTimer,hideTimer,dragging=false,ringType=null,drawerPreviousFocus=null;
const pad=n=>String(n).padStart(2,'0');
const svgNS='http://www.w3.org/2000/svg';
function node(name,attrs,text){const e=document.createElementNS(svgNS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function save(){try{localStorage.setItem('tempo.v1',JSON.stringify(s));}catch{toast('设置暂时无法保存');}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);}
function audioSettings(){Object.assign(audio,{enabled:s.settings.sound,volume:s.settings.volume,tone:s.settings.tone});}
function syncSettings(){
 document.body.dataset.theme=s.settings.theme;
 $('volume').value=Math.round(s.settings.volume*100);$('volume-value').textContent=$('volume').value+'%';
 for(const [id,key]of [['tick-switch','sound'],['step-switch','step'],['urgency-switch','urgency'],['hide-switch','hideChrome']])$(id).setAttribute('aria-checked',s.settings[key]);
 $$('[data-tone]').forEach(b=>b.classList.toggle('selected',b.dataset.tone===s.settings.tone));
 $$('button[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===s.settings.theme));
 $('sound-toggle').classList.toggle('enabled',s.settings.sound);
 $('sound-toggle').querySelector('use').setAttribute('href',s.settings.sound?'#i-sound':'#i-mute');
 $('sound-toggle').querySelector('span').textContent='机械声 · '+(s.settings.sound?'开启':'关闭');
 $('sound-toggle').setAttribute('aria-label',s.settings.sound?'关闭机械滴答声':'开启机械滴答声');
 audioSettings();
}
function renderDialScale(){
 const isClock=s.mode!=='timer',max=isClock?12:scaleMinutes();
 $('dial-ticks').replaceChildren();$('dial-numbers').replaceChildren();$('subdial-ticks').replaceChildren();
 for(let i=0;i<60;i++){
  const major=i%5===0,a=i*Math.PI/30,r=major?252:262;
  $('dial-ticks').append(node('line',{x1:300+Math.sin(a)*r,y1:300-Math.cos(a)*r,x2:300+Math.sin(a)*273,y2:300-Math.cos(a)*273,stroke:major?'#384638':'#78806b','stroke-width':major?2.7:1.3}));
  if(major){const text=isClock?(i===0?'12':String(i/5)):(i===0?'0':String(Math.round(i/60*max)));$('dial-numbers').append(node('text',{x:300+Math.sin(a)*220,y:300-Math.cos(a)*220,class:'tick-number'+(i===0?' zero':'')},text));}
 }
 for(let i=0;i<20;i++){const a=i*Math.PI/10;$('subdial-ticks').append(node('line',{x1:300+Math.sin(a)*30,y1:391-Math.cos(a)*30,x2:300+Math.sin(a)*33,y2:391-Math.cos(a)*33,stroke:'#8d977c','stroke-width':i%5===0?1.4:.6}));}
 $('face-caption').textContent=isClock?'LOCAL TIME / MECHANICAL':max>60?'COUNTDOWN / '+max+' MIN':'COUNTDOWN / MINUTES';
 $('dial-scale').textContent=isClock?'12 HOUR · PRECISION DIAL':max+' MIN · PRECISION DIAL';
 $('dial').setAttribute('aria-label',isClock?'机械指针时钟':'机械倒计时，拖动或用方向键设置时长');
}
function scaleMinutes(){const m=s.timer.duration/60000;return m<=60?60:m<=120?120:m<=360?360:1440;}
function setMode(mode){
 s.mode=mode;document.body.dataset.mode=mode;
 $$('button[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode);});
 for(const m of ['timer','clock','alarm'])$(m+'-controls').hidden=m!==mode;
 const texts={timer:['让每一刻，有分量。','机械倒计时','旋转指针，给此刻<br>一个明确的期限。','MECHANICAL COUNTDOWN'],clock:['让时间，慢慢走。','机械时钟','一秒，一次落点。<br>时间有自己的步调。','MECHANICAL CLOCK'],alarm:['为下一刻，定个约。','每日闹钟','在约定的时刻，<br>清晰地提醒自己。','DAILY ALARM']};
 const t=texts[mode];$('heading').textContent=t[0];$('instrument-name').textContent=t[1];$('instrument-description').innerHTML=t[2];$('footer-mode').textContent=t[3];
 $('alarm-time').value=s.alarm.time;
 $('alarm-toggle').querySelector('span').textContent=s.alarm.enabled?'关闭闹钟':'开启闹钟';
 $('alarm-toggle').classList.toggle('armed',s.alarm.enabled);
 renderDialScale();flipValues=[];lastSecond=null;save();render(Date.now());
}
function setView(view){s.view=view;document.body.dataset.view=view;$('dial-object').hidden=view!=='dial';$('flip-object').hidden=view!=='flip';$$('button[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view);});flipValues=[];lastSecond=null;save();render(Date.now());}
function setDuration(ms){instrument.setDuration(ms);renderDialScale();$$('[data-minutes]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.minutes)*60000===ms));save();lastSecond=null;render(Date.now());}
async function unlock(){try{await audio.unlock();}catch{toast('音频设备暂时不可用');}}
async function toggleTimer(){if(s.mode!=='timer')return;await unlock();if(s.timer.status==='running')instrument.pause();else instrument.start();audio.click({kind:'flip',strength:.7});lastSecond=null;save();render(Date.now());}
function sectorPath(ratio){
 if(ratio<=0)return '';const r=244;
 if(ratio>=.999999)return `M300 56 A244 244 0 1 1 299.999 56 Z`;
 const a=ratio*2*Math.PI,x=300+Math.sin(a)*r,y=300-Math.cos(a)*r;
 return `M300 300 L300 56 A244 244 0 ${ratio>.5?1:0} 1 ${x} ${y} Z`;
}
function flipParts(){
 if($('flip-units').children.length)return;
 ['HOURS','MINUTES','SECONDS'].forEach(label=>{
 const u=document.createElement('div');u.className='flip-unit';
 const card=document.createElement('div');card.className='flip-card';
 for(const cls of ['top base','bottom base','top overlay','bottom overlay']){const h=document.createElement('div');h.className='flap '+cls;const txt=document.createElement('span');txt.textContent='00';h.append(txt);card.append(h);}
 const l=document.createElement('span');l.className='unit-label';l.textContent=label;u.append(card,l);$('flip-units').append(u);
 });
}
function updateFlip(values){
 flipParts();const cards=$$('.flip-card');let changes=0;
 values.forEach((v,i)=>{
  if(v===flipValues[i])return;
  const c=cards[i],old=flipValues[i]??v;c.classList.remove('flipping');
  c.querySelector('.top.base span').textContent=v;c.querySelector('.bottom.base span').textContent=old;
  c.querySelector('.top.overlay span').textContent=old;c.querySelector('.bottom.overlay span').textContent=v;
  if(flipValues[i]!==undefined&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){void c.offsetHeight;c.classList.add('flipping');changes++;}
  clearTimeout(c.finish);c.finish=setTimeout(()=>{c.querySelector('.bottom.base span').textContent=v;c.classList.remove('flipping');},570);
  flipValues[i]=v;
 });
 return changes;
}
function render(now){
 const d=new Date(now),remaining=instrument.remaining(now),running=s.timer.status==='running',clock=s.mode!=='timer';
 const scale=scaleMinutes()*60000,ratio=Math.min(1,remaining/scale),progress=remaining/s.timer.duration;
 const sec=s.settings.step?d.getSeconds():d.getSeconds()+d.getMilliseconds()/1000;
 const timeSec=s.settings.step?Math.ceil(remaining/1000):remaining/1000;
 let angle=clock?sec*6:timeSec/(scale/1000)*360;
 $('hour-hand').style.display=clock?'':'none';$('minute-hand').style.display=clock?'':'none';
 $('hour-hand').style.transform=`rotate(${(d.getHours()%12+d.getMinutes()/60)*30}deg)`;
 $('minute-hand').style.transform=`rotate(${(d.getMinutes()+sec/60)*6}deg)`;
 $('timer-hand').style.transform=`rotate(${angle}deg)`;
 $('subdial-hand').style.transform=`rotate(${(clock?sec:timeSec%60)*6}deg)`;
 $('time-sector').setAttribute('d',sectorPath(ratio));
 const secondKey=clock?Math.floor(now/1000):Math.ceil(remaining/1000);
 if(secondKey!==lastSecond){
  const newSecond=lastSecond!==null;
  lastSecond=secondKey;
  let display,values;
  if(s.mode==='clock'){values=[pad(d.getHours()),pad(d.getMinutes()),pad(d.getSeconds())];display=values.join(':');}
  else if(s.mode==='alarm'){values=[...s.alarm.time.split(':'),'00'];display=s.alarm.time;}
  else {display=formatDuration(remaining);values=formatDuration(remaining,true).split(':');}
  $('time-readout').textContent=display;
  if(s.view==='flip')updateFlip(values);
  if(newSecond&&s.mode!=='alarm'&&(clock||running))audio.click({kind:s.view==='flip'?'flip':'tick',strength:s.settings.urgency&&remaining<60000&&!clock?1.25:1});
 }
 const warning=s.settings.urgency&&s.mode==='timer'&&running&&progress<=.2;
 const urgent=s.settings.urgency&&s.mode==='timer'&&running&&remaining<=60000;
 document.body.classList.toggle('running',s.mode==='timer'&&running);document.body.classList.toggle('warning',warning);document.body.classList.toggle('urgent',urgent);
 let badge,status,caption,statusNumber,statusText;
 if(s.mode==='clock'){
  badge='此刻，当下';status='LOCAL TIME';caption=d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});statusNumber=pad(d.getHours())+'<span>hour</span>';statusText='时间不语，<br>但始终向前。';
 }else if(s.mode==='alarm'){
  badge=s.alarm.enabled?'每日提醒已开启':'闹钟未开启';status=s.alarm.enabled?'ALARM ARMED':'ALARM OFF';
  caption=s.alarm.snoozeAt?'稍后提醒 · '+new Date(s.alarm.snoozeAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):s.alarm.enabled?'下次响铃 · '+new Date(s.alarm.nextAt).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'保持应用运行，约定的提醒才会响起。';
  statusNumber=s.alarm.time.replace(':','<span>:</span>');statusText=s.alarm.enabled?'约定已记下。<br>请保持应用运行。':'选择时刻，<br>再开启闹钟。';
 }else {
  const labels={idle:'准备就绪',running:urgent?'最后一分钟':warning?'时间正在收紧':'专注进行中',paused:'已暂停',finished:'时间到了'};
  badge=labels[s.timer.status];status=running?(urgent?'MAKE IT COUNT':'TIME IS MOVING'):s.timer.status==='paused'?'PAUSED':'READY WHEN YOU ARE';
  caption=running?urgent?'每一秒，都在靠近终点。':'此刻，只做这一件事。':s.timer.status==='paused'?'短暂停留，随时继续。':s.timer.status==='finished'?'这一刻，告一段落。':'留给重要的事，一段完整的时间。';
  statusNumber=Math.ceil(remaining/60000)+'<span>min</span>';statusText=running?`已流逝 ${Math.floor((1-progress)*100)}%<br>让注意力，回到此刻。`:s.timer.status==='paused'?'指针暂歇，<br>时间为你保留。':'时间正在等待<br>你的开始。';
 }
 $('state-badge').querySelector('span').textContent=badge;$('status-label').textContent=status;$('readout-caption').textContent=caption;$('status-number').innerHTML=statusNumber;$('status-description').innerHTML=statusText;
 $('mini-meter-fill').style.width=(clock?d.getMinutes()/60:progress)*100+'%';
 $('start').querySelector('span').textContent=running?'暂停片刻':s.timer.status==='paused'?'继续专注':s.timer.status==='finished'?'再来一轮':'开始专注';
 $('start').querySelector('use').setAttribute('href',running?'#i-pause':'#i-play');
 $('flip-date').textContent=d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
 $('local-date').textContent=d.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
 const awake=running||fullscreen;if(awake!==wasAwake){desktop?.awake(awake);wasAwake=awake;}
}
function ring(event){
 ringType=event.type;audio.ring();desktop?.attention();
 document.body.classList.remove('immersed');document.body.classList.add('ringing');
 $('ring-title').textContent=event.type==='timer'?'时间到了。':'约定的时刻，到了。';
 $('ring-message').textContent=event.type==='timer'?'这一刻，告一段落。':'给此刻，一个回应。';
 $('snooze').hidden=event.type==='timer';if(!$('ring-dialog').open)$('ring-dialog').showModal();
}
function dismiss(){audio.stop();document.body.classList.remove('ringing');$('ring-dialog').close();ringType=null;save();}
let lastVisual=0;
function loop(ts){if(ts-lastVisual>33){lastVisual=ts;render(Date.now());}requestAnimationFrame(loop);}
setInterval(()=>{const events=instrument.update();if(events.length){save();events.forEach(ring);render(Date.now());}},100);
async function toggleFullscreen(){
 if(desktop){await desktop.action('fullscreen');return;}
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前环境暂不支持全屏');}
}
function openSettings(){drawerPreviousFocus=document.activeElement;$('settings-drawer').hidden=false;$('drawer-backdrop').hidden=false;document.body.classList.remove('immersed');$('settings-close').focus();}
function closeSettings(){$('settings-drawer').hidden=true;$('drawer-backdrop').hidden=true;drawerPreviousFocus?.focus();}
function interaction(){document.body.classList.remove('immersed');clearTimeout(hideTimer);if(s.settings.hideChrome)hideTimer=setTimeout(()=>{if($('settings-drawer').hidden&&!document.querySelector('dialog[open]'))document.body.classList.add('immersed');},4500);}
$$('button[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$$('button[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('[data-minutes]').forEach(b=>b.addEventListener('click',()=>{if(s.timer.status==='running'){toast('请先暂停，再修改时长');return;}setDuration(Number(b.dataset.minutes)*60000);}));
$('start').addEventListener('click',toggleTimer);
$('reset').addEventListener('click',()=>{instrument.reset();save();lastSecond=null;render(Date.now());});
$('fullscreen').addEventListener('click',toggleFullscreen);
$('pin').addEventListener('click',async()=>{if(!desktop)return toast('置顶功能请使用桌面版');const pinned=await desktop.action('pin');$('pin').classList.toggle('active',pinned);toast(pinned?'窗口已置顶':'已取消置顶');});
$('settings-open').addEventListener('click',openSettings);$('settings-close').addEventListener('click',closeSettings);$('drawer-backdrop').addEventListener('click',closeSettings);
async function toggleSound(){await unlock();s.settings.sound=!s.settings.sound;syncSettings();save();if(s.settings.sound)audio.click();}
$('sound-toggle').addEventListener('click',toggleSound);$('tick-switch').addEventListener('click',toggleSound);
for(const [id,key]of [['step-switch','step'],['urgency-switch','urgency'],['hide-switch','hideChrome']])$(id).addEventListener('click',()=>{s.settings[key]=!s.settings[key];syncSettings();save();interaction();});
$('volume').addEventListener('input',()=>{s.settings.volume=Number($('volume').value)/100;syncSettings();save();});
$('volume').addEventListener('change',async()=>{await unlock();audio.click({force:true});});
$$('[data-tone]').forEach(b=>b.addEventListener('click',async()=>{s.settings.tone=b.dataset.tone;syncSettings();save();await unlock();audio.preview();}));
$$('button[data-theme]').forEach(b=>b.addEventListener('click',()=>{s.settings.theme=b.dataset.theme;syncSettings();save();}));
$('preview-sound').addEventListener('click',async()=>{await unlock();audio.preview();});
$('custom-duration').addEventListener('click',()=>{
 if(s.timer.status==='running')return toast('请先暂停，再修改时长');
 $('duration-input').value=formatDuration(s.timer.duration);$('duration-error').textContent='';$('duration-dialog').showModal();$('duration-input').select();
});
$('duration-form').addEventListener('submit',e=>{e.preventDefault();const ms=parseDuration($('duration-input').value);if(ms===null){$('duration-error').textContent='请输入有效时长，范围为 1 秒至 24 小时。';return;}setDuration(ms);$('duration-dialog').close();});
$('duration-cancel').addEventListener('click',()=>$('duration-dialog').close());
$('alarm-time').addEventListener('change',()=>{if(instrument.setAlarm($('alarm-time').value,s.alarm.enabled)){save();setMode('alarm');}});
$('alarm-toggle').addEventListener('click',async()=>{await unlock();if(instrument.setAlarm($('alarm-time').value,!s.alarm.enabled)){save();setMode('alarm');toast(s.alarm.enabled?'每日闹钟已开启，请保持应用运行':'闹钟已关闭');}});
$('dismiss-ring').addEventListener('click',dismiss);
$('snooze').addEventListener('click',()=>{instrument.snooze();dismiss();toast('5 分钟后再次提醒');});
$('ring-dialog').addEventListener('cancel',e=>{e.preventDefault();dismiss();});
function dragSet(e){
 const rect=$('dial').getBoundingClientRect(),x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2;
 let angle=Math.atan2(x,-y);if(angle<0)angle+=2*Math.PI;
 const seconds=Math.max(15,Math.round(angle/(2*Math.PI)*scaleMinutes()*60/15)*15);setDuration(seconds*1000);
}
$('dial').addEventListener('pointerdown',e=>{if(s.mode!=='timer'||e.button!==0)return;if(s.timer.status==='running')return toast('请先暂停，再旋转指针');dragging=true;$('dial').classList.add('dragging');$('dial').setPointerCapture(e.pointerId);dragSet(e);});
$('dial').addEventListener('pointermove',e=>{if(dragging)dragSet(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('dial').addEventListener(event,()=>{dragging=false;$('dial').classList.remove('dragging');});
$('dial').addEventListener('keydown',e=>{if(s.mode==='timer'&&s.timer.status!=='running'&&['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();const dir=['ArrowRight','ArrowUp'].includes(e.key)?1:-1;setDuration(Math.max(15000,Math.min(86400000,s.timer.duration+dir*60000)));}});
document.addEventListener('keydown',e=>{
 interaction();
 if(!$('settings-drawer').hidden&&e.key==='Tab'){
  const els=[...$('settings-drawer').querySelectorAll('button,input')],first=els[0],last=els.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;
 }
 if(e.key==='Escape'){
  if(!$('settings-drawer').hidden){closeSettings();return;}
  if(!document.querySelector('dialog[open]')){if(desktop)desktop.action('exit-fullscreen');else if(document.fullscreenElement)document.exitFullscreen();}return;
 }
 if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||document.querySelector('dialog[open]')||!$('settings-drawer').hidden||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;
 switch(e.key.toLowerCase()){
  case ' ':e.preventDefault();toggleTimer();break;
  case 'r':if(s.mode==='timer')$('reset').click();break;
  case 'f':e.preventDefault();toggleFullscreen();break;
  case 'm':toggleSound();break;
  case 'p':$('pin').click();break;
  case '1':setView('dial');break;case '2':setView('flip');break;
  case ',':openSettings();break;
 }
});
document.addEventListener('pointermove',interaction,{passive:true});document.addEventListener('pointerdown',interaction,{passive:true});
document.addEventListener('fullscreenchange',()=>{fullscreen=!!document.fullscreenElement;$('fullscreen').classList.toggle('active',fullscreen);render(Date.now());});
desktop?.onWindow(v=>{fullscreen=v.fullscreen;$('fullscreen').classList.toggle('active',fullscreen);render(Date.now());});
desktop?.onResume(()=>{lastSecond=null;const events=instrument.update();events.forEach(ring);save();render(Date.now());});
window.addEventListener('beforeunload',()=>{save();audio.stop();});
document.addEventListener('pointerdown',()=>{if(!audio.ctx)unlock();},{once:true});
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();setMode('timer');});
syncSettings();setMode(s.mode);setView(s.view);interaction();
if(s.settings.sound||s.alarm.enabled||s.timer.status==='running')unlock();
requestAnimationFrame(loop);
