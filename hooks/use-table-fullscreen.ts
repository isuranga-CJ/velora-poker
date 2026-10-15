'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
export function useTableFullscreen(){
  const ref=useRef<HTMLDivElement>(null);
  const [native,setNative]=useState(false),[theater,setTheater]=useState(false),[message,setMessage]=useState('');
  const locked=useRef(false);
  const unlockOrientation=useCallback(()=>{if(locked.current){screen.orientation?.unlock?.();locked.current=false;}},[]);
  useEffect(()=>{
    const change=()=>{const value=document.fullscreenElement===ref.current;setNative(value);if(!value)unlockOrientation();};
    document.addEventListener('fullscreenchange',change);
    return ()=>{document.removeEventListener('fullscreenchange',change);unlockOrientation();};
  },[unlockOrientation]);
  useEffect(()=>{
    if(!theater)return;
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setTheater(false);};document.addEventListener('keydown',escape);
    return ()=>{document.body.style.overflow=old;document.removeEventListener('keydown',escape);};
  },[theater]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timer);},[message]);
  async function toggle(){
    if(theater){setTheater(false);return;}
    if(document.fullscreenElement===ref.current){try{await document.exitFullscreen();}catch{setMessage('Use your browser back button to exit full screen.');}return;}
    const node=ref.current;if(!node)return;
    try{
      if(!node.requestFullscreen)throw Error('Fullscreen unavailable');
      await node.requestFullscreen({navigationUI:'hide'});
      setNative(document.fullscreenElement===node);
      const orientation=screen.orientation as ScreenOrientation&{lock?:(value:string)=>Promise<void>};
      try{if(orientation?.lock){await orientation.lock('landscape');locked.current=true;}}catch{/* Rotation remains user controlled where locking is unsupported. */}
    }catch{setTheater(true);setMessage('Expanded table view. For native full screen, open in Chrome.');}
  }
  return {ref,expanded:native||theater,theater,toggle,message};
}
