import type {TableView} from '../game/engine';
export type PokerSound='deal'|'flop'|'card'|'chips'|'check'|'fold'|'turn'|'tick'|'win'|'finish';
export function pokerSoundEvents(before:TableView|null,after:TableView|null,userId?:string):PokerSound[]{
  if(!after)return [];
  const result:PokerSound[]=[];
  const fresh=!!after.handId&&before?.handId!==after.handId;
  if(fresh&&after.phase!=='complete')result.push('deal');
  else if(before&&after.board.length>before.board.length)result.push(after.board.length-before.board.length>=3?'flop':'card');
  if(!fresh&&before&&(after.history.length>before.history.length||after.history.join('\n')!==before.history.join('\n'))){
    const move=after.history.at(-1)?.match(/: (fold|check|call|raise)(?: \d+)?$/)?.[1];
    if(move==='fold')result.push('fold');
    else if(move==='check')result.push('check');
    else if(move==='raise'||move==='call')result.push('chips');
  }
  if(after.phase==='complete'&&(before?.phase!=='complete'||fresh))result.push(userId&&(after.payouts[userId]||0)>0?'win':'finish');
  if(after.legal&&(!before?.legal||fresh))result.push('turn');
  return result;
}
/** Original synthesized effects, with no external sound downloads. */
export class PokerAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  async unlock(volume:number){
    const Audio=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Audio)throw Error('Game audio is unavailable in this browser.');
    if(!this.context||this.context.state==='closed'){
      this.context=new Audio();this.master=this.context.createGain();
      const compressor=this.context.createDynamicsCompressor();
      compressor.threshold.value=-16;compressor.ratio.value=5;
      this.master.connect(compressor);compressor.connect(this.context.destination);
    }
    this.setVolume(volume);await this.context.resume();
    return this.context.state==='running';
  }
  setVolume(volume:number){if(this.master&&this.context)this.master.gain.setTargetAtTime(Math.max(0,Math.min(1,volume)),this.context.currentTime,.015);}
  private tone(frequency:number,delay:number,duration:number,gain=.12,type:OscillatorType='sine',end?:number){
    const ctx=this.context;if(!ctx||!this.master)return;
    const osc=ctx.createOscillator(),envelope=ctx.createGain(),at=ctx.currentTime+delay;
    osc.type=type;osc.frequency.setValueAtTime(frequency,at);
    if(end)osc.frequency.exponentialRampToValueAtTime(end,at+duration);
    envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(gain,at+.006);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(envelope);envelope.connect(this.master);osc.start(at);osc.stop(at+duration+.02);
    osc.onended=()=>{osc.disconnect();envelope.disconnect();};
  }
  private noise(delay:number,duration:number,frequency:number,gain=.2){
    const ctx=this.context;if(!ctx||!this.master)return;
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain(),at=ctx.currentTime+delay;
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;
    envelope.gain.setValueAtTime(gain,at);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(envelope);envelope.connect(this.master);source.start(at);
    source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};
  }
  play(sound:PokerSound){
    if(this.context?.state!=='running')return;
    if(sound==='deal'||sound==='flop'||sound==='card'){
      const count=sound==='deal'?5:sound==='flop'?3:1;
      for(let i=0;i<count;i++){this.noise(i*.075,.12,2300,.35);this.tone(190,i*.075+.04,.06,.06,'triangle',100);}
    }else if(sound==='chips'){
      [0,.055,.11,.16].forEach((at,i)=>{this.tone(2100+i*260,at,.065,.095,'triangle');this.noise(at,.045,3600,.15);});
    }else if(sound==='check'){
      this.tone(190,0,.08,.22,'sine',75);this.tone(190,.11,.08,.18,'sine',75);
    }else if(sound==='fold')this.noise(0,.22,1000,.3);
    else if(sound==='turn'){this.tone(660,0,.15,.14);this.tone(990,.13,.22,.12);}
    else if(sound==='tick')this.tone(820,0,.065,.09);
    else if(sound==='win')[523.25,659.25,783.99,1046.5].forEach((hz,i)=>this.tone(hz,i*.12,.45,.14,'triangle'));
    else if(sound==='finish'){this.tone(390,0,.16,.09);this.tone(520,.12,.23,.08);}
  }
  close(){const ctx=this.context;this.context=null;this.master=null;if(ctx&&ctx.state!=='closed')void ctx.close().catch(()=>{});}
}
