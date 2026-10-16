const MINUTE=60000, MAX=24*60*MINUTE;
export function parseDuration(text) {
 const s=String(text).trim(); if(!/^\d{1,4}(?::\d{1,2}){0,2}$/.test(s))return null;
 const a=s.split(':').map(Number); if(a.slice(1).some(x=>x>59))return null;
 const seconds=a.length===1?a[0]*60:a.length===2?a[0]*60+a[1]:a[0]*3600+a[1]*60+a[2];
 return seconds>0&&seconds*1000<=MAX?seconds*1000:null;
}
export function formatDuration(ms, forceHours=false) {
 const s=Math.max(0,Math.ceil(ms/1000)), pad=n=>String(n).padStart(2,'0');
 return (s>=3600||forceHours?[pad(Math.floor(s/3600))]:[]).concat([pad(Math.floor(s/60)%60),pad(s%60)]).join(':');
}
function validTime(s){return typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);}
export function nextAlarmAt(time, now=Date.now()) {
 if(!validTime(time))return null;
 const d=new Date(now),[h,m]=time.split(':').map(Number); d.setHours(h,m,0,0);
 if(d.getTime()<=now)d.setDate(d.getDate()+1);
 return d.getTime();
}
export class Instrument {
 constructor(saved={}) {
  const s=saved&&typeof saved==='object'?saved:{};
  this.state={version:1,mode:['clock','timer','alarm'].includes(s.mode)?s.mode:'timer',view:s.view==='flip'?'flip':'dial',
   timer:{duration:25*MINUTE,remaining:25*MINUTE,deadline:null,status:'idle'},
   alarm:{time:'09:00',enabled:false,nextAt:null,snoozeAt:null},
   settings:{sound:false,volume:0.35,tone:'steel',theme:'dark',step:true,urgency:true,hideChrome:false}};
  const t=s.timer;
  if(t&&Number.isFinite(t.duration)&&t.duration>0&&t.duration<=MAX){
   this.state.timer.duration=t.duration;
   this.state.timer.remaining=Number.isFinite(t.remaining)?Math.max(0,Math.min(t.duration,t.remaining)):t.duration;
   this.state.timer.status=['idle','paused','running','finished'].includes(t.status)?t.status:'idle';
   if(t.status==='running'&&Number.isFinite(t.deadline)&&t.deadline>0)this.state.timer.deadline=t.deadline;
   else if(t.status==='running')this.state.timer.status='paused';
  }
  const a=s.alarm;
  if(a&&validTime(a.time)){
   this.state.alarm={time:a.time,enabled:a.enabled===true,nextAt:Number.isFinite(a.nextAt)?a.nextAt:null,snoozeAt:Number.isFinite(a.snoozeAt)?a.snoozeAt:null};
   if(a.enabled&&!this.state.alarm.nextAt)this.state.alarm.nextAt=nextAlarmAt(a.time);
  }
  const p=s.settings;
  if(p&&typeof p==='object'){
   for(const key of ['step','urgency','hideChrome'])if(typeof p[key]==='boolean')this.state.settings[key]=p[key];
   if(Number.isFinite(p.volume)&&p.volume>=0&&p.volume<=1){this.state.settings.volume=p.volume;this.state.settings.sound=p.sound===true;}
   if(['steel','ceramic','wood'].includes(p.tone))this.state.settings.tone=p.tone;
   if(['dark','light'].includes(p.theme))this.state.settings.theme=p.theme;
  }
 }
 remaining(now=Date.now()){const t=this.state.timer;return t.status==='running'?Math.max(0,t.deadline-now):t.remaining;}
 setDuration(ms){if(!Number.isFinite(ms)||ms<=0||ms>MAX)return false;this.state.timer={duration:ms,remaining:ms,deadline:null,status:'idle'};return true;}
 start(now=Date.now()){const t=this.state.timer;if(t.status==='running')return;if(t.status==='finished'||t.remaining<=0)t.remaining=t.duration;t.deadline=now+t.remaining;t.status='running';}
 pause(now=Date.now()){const t=this.state.timer;if(t.status==='running'){t.remaining=this.remaining(now);t.status='paused';t.deadline=null;}}
 reset(){const t=this.state.timer;t.remaining=t.duration;t.deadline=null;t.status='idle';}
 setAlarm(time,enabled,now=Date.now()){if(!validTime(time))return false;this.state.alarm={time,enabled:!!enabled,nextAt:enabled?nextAlarmAt(time,now):null,snoozeAt:null};return true;}
 snooze(now=Date.now()){this.state.alarm.snoozeAt=now+5*MINUTE;}
 update(now=Date.now()){
  const events=[],t=this.state.timer,a=this.state.alarm;
  if(t.status==='running'&&this.remaining(now)<=0){t.status='finished';t.remaining=0;t.deadline=null;events.push({type:'timer'});}
  if(a.enabled&&a.nextAt&&now>=a.nextAt){const late=now-a.nextAt;a.nextAt=nextAlarmAt(a.time,now);if(late<24*60*MINUTE)events.push({type:'alarm'});}
  if(a.snoozeAt&&now>=a.snoozeAt){a.snoozeAt=null;events.push({type:'snooze'});}
  return events;
 }
}
