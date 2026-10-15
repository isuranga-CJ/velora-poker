'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {TableView} from '../game/engine';
import {PokerAudio,pokerSoundEvents} from '../lib/poker-sounds';
export function usePokerAudio(table:TableView|null,userId:string|undefined,clock:number){
  const [enabled,setEnabled]=useState(true),[volume,setVolume]=useState(.65),[ready,setReady]=useState(false),[error,setError]=useState('');
  const player=useRef<PokerAudio|null>(null),previous=useRef<TableView|null>(null),lastTick=useRef(''),hasUnlocked=useRef(false);
  const enabledRef=useRef(true),volumeRef=useRef(.65);
  useEffect(()=>{
    try{const stored=JSON.parse(localStorage.getItem('velora-audio-v1')||'null');
      if(stored){enabledRef.current=stored.enabled!==false;setEnabled(enabledRef.current);if(typeof stored.volume==='number'&&Number.isFinite(stored.volume)){volumeRef.current=Math.max(0,Math.min(1,stored.volume));setVolume(volumeRef.current);}}}catch{}
    return ()=>{player.current?.close();player.current=null;};
  },[]);
  const save=()=>{try{localStorage.setItem('velora-audio-v1',JSON.stringify({enabled:enabledRef.current,volume:volumeRef.current}));}catch{}};
  const unlock=useCallback(async()=>{
    if(!enabledRef.current)return;
    try{player.current??=new PokerAudio();const running=await player.current.unlock(volumeRef.current);setReady(running);if(running&&!hasUnlocked.current){hasUnlocked.current=true;player.current.play('turn');}setError('');}
    catch(e){setReady(false);setError((e as Error).message);}
  },[]);
  function toggle(){
    const next=!enabledRef.current;enabledRef.current=next;setEnabled(next);save();
    if(next)void unlock();
    else player.current?.setVolume(0);
  }
  function changeVolume(value:number){
    volumeRef.current=Math.max(0,Math.min(1,value));setVolume(volumeRef.current);save();
    player.current?.setVolume(enabledRef.current?volumeRef.current:0);
  }
  useEffect(()=>{
    const sounds=pokerSoundEvents(previous.current,table,userId);previous.current=table;
    if(enabled&&ready)for(const sound of sounds)player.current?.play(sound);
  },[table,userId,enabled,ready]);
  useEffect(()=>{
    if(!table?.legal||!enabled||!ready)return;
    const seconds=Math.ceil((table.deadline-clock)/1000),key=`${table.handId}:${table.deadline}:${seconds}`;
    if(seconds>0&&seconds<=5&&lastTick.current!==key){lastTick.current=key;player.current?.play('tick');}
  },[table,clock,enabled,ready]);
  return {enabled,volume,ready,error,unlock,toggle,changeVolume};
}
