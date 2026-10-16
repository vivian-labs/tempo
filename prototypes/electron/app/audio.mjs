// Original procedural audio: short noise attack + inharmonic metal resonances.
// No sampled or third-party audio assets.
export class MechanicalAudio {
 constructor(){this.ctx=null;this.enabled=false;this.volume=.35;this.tone='steel';this.last=0;this.alarming=false;this.alarmTimer=null;}
 async unlock(){this.ctx??=new AudioContext({latencyHint:'interactive'});if(this.ctx.state==='suspended')await this.ctx.resume();}
 click({at,force=false,kind='tick',strength=1}={}){
  if(!this.ctx||this.ctx.state!=='running'||(!this.enabled&&!force)||this.volume===0)return;
  const c=this.ctx,t=at??c.currentTime+.004;
  const duration=kind==='flip'?.085:.036;
  const g=c.createGain();g.gain.value=this.volume*strength*.6;g.connect(c.destination);
  const n=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),d=n.getChannelData(0);
  for(let i=0;i<d.length;i++){const x=i/c.sampleRate;d[i]=(Math.random()*2-1)*Math.exp(-x/(kind==='flip'?.012:.0035));}
  const src=c.createBufferSource();src.buffer=n;
  const filter=c.createBiquadFilter();filter.type='highpass';filter.frequency.value=this.tone==='wood'?1000:this.tone==='ceramic'?2800:4400;
  src.connect(filter);filter.connect(g);src.start(t);src.stop(t+duration);
  const base=this.tone==='wood'?930:this.tone==='ceramic'?2300:3900;
  [1,1.49,2.21].forEach((ratio,i)=>{
   const osc=c.createOscillator(),e=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(base*ratio+(this.last++%2)*35,t);
   e.gain.setValueAtTime(.0001,t);e.gain.exponentialRampToValueAtTime((kind==='flip'?.075:.11)/(i+1),t+.001);
   e.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(e);e.connect(g);osc.start(t);osc.stop(t+duration+.005);
  });
  if(kind==='flip'){
   const o=c.createOscillator(),e=c.createGain();o.frequency.setValueAtTime(230,t+.035);o.frequency.exponentialRampToValueAtTime(100,t+.075);
   e.gain.setValueAtTime(.12,t+.035);e.gain.exponentialRampToValueAtTime(.0001,t+.08);o.connect(e);e.connect(g);o.start(t+.035);o.stop(t+.09);
  }
  setTimeout(()=>g.disconnect(),Math.max(100,(t-c.currentTime+duration+.1)*1000));
 }
 preview(){this.click({force:true});if(this.ctx)this.click({force:true,at:this.ctx.currentTime+.5,kind:'flip'});}
 ring(){
  if(this.alarming)return;this.alarming=true;
  // An alarm is audible independently of optional ticking, respecting volume.
  const burst=()=>{
   if(!this.ctx||this.ctx.state!=='running')return;
   const c=this.ctx,t=c.currentTime;
   for(let i=0;i<4;i++){
    this.click({force:true,at:t+i*.16,strength:1.4});
    [1780,2830].forEach(f=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,t+i*.16);g.gain.exponentialRampToValueAtTime(Math.max(.0001,this.volume*.09),t+i*.16+.003);g.gain.exponentialRampToValueAtTime(.0001,t+i*.16+.13);o.connect(g);g.connect(c.destination);o.start(t+i*.16);o.stop(t+i*.16+.15);});
   }
  };
  burst();this.alarmTimer=setInterval(burst,1600);
  this.safetyTimer=setTimeout(()=>this.stop(),60000);
 }
 stop(){clearInterval(this.alarmTimer);clearTimeout(this.safetyTimer);this.alarming=false;}
}
