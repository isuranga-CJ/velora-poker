'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,RotateCcw} from 'lucide-react';
import CasinoTable from './CasinoTable';
import {act,active,start,view,type Move,type Table,type TableView} from '../game/engine';
import {chooseBotMove,createPractice,PRACTICE_PLAYER} from '../game/practice';

export default function PracticeTable({onExit}:{onExit:()=>void}) {
  const game=useRef<Table|null>(null);
  const [table,setTable]=useState<TableView|null>(null);
  const [clock,setClock]=useState(0);
  const [raise,setRaise]=useState(40);
  const [error,setError]=useState('');
  const publish=useCallback(()=>{
    if(game.current)setTable(structuredClone(view(game.current,PRACTICE_PLAYER)));
  },[]);
  const reset=useCallback(()=>{
    game.current=createPractice();setError('');publish();
  },[publish]);
  useEffect(()=>{
    reset();setClock(Date.now());
    const timer=setInterval(()=>setClock(Date.now()),500);
    return ()=>{clearInterval(timer);game.current=null;};
  },[reset]);
  const commit=useCallback((id:string,move:Move)=>{
    const t=game.current;if(!t)return;
    try {act(t,id,move);setError('');publish();}
    catch(e){setError((e as Error).message);}
  },[publish]);
  useEffect(()=>{
    if(!table||['waiting','complete'].includes(table.phase))return;
    const p=table.seats[table.turn];
    if(!p||p.id===PRACTICE_PLAYER)return;
    const hand=table.handId,version=table.version;
    const timer=setTimeout(()=>{
      const t=game.current;
      if(t&&t.handId===hand&&t.version===version)commit(p.id,chooseBotMove(t));
    },1000);
    return ()=>clearTimeout(timer);
  },[table,commit]);
  useEffect(()=>{
    const t=game.current;
    if(t&&active(t)&&t.deadline<=clock){
      const p=t.seats[t.turn];
      const l=view(t,p.id).legal;
      if(l)commit(p.id,{type:l.call?'fold':'check'});
    }
  },[clock,commit]);
  useEffect(()=>{
    if(table?.legal)setRaise(Math.min(table.legal.min,table.legal.max));
  },[table?.legal?.min,table?.legal?.max,table?.handId,table?.phase]);
  function nextHand(){
    try{if(game.current){start(game.current);publish();}}catch(e){setError((e as Error).message);}
  }
  const legal=table?.legal;
  const running=!!table&&!['waiting','complete'].includes(table.phase);
  const funded=table?.seats.filter(p=>p.stack>0).length||0;
  const me=table?.seats.find(p=>p.id===PRACTICE_PLAYER);
  return <div className="game-page practice-page"><CasinoTable table={table} userId={PRACTICE_PLAYER} clock={clock}
    toolbar={<><button className="casino-tool" onClick={onExit} aria-label="Exit practice"><ArrowLeft size={20}/></button><span className="casino-connection">LOCAL PRACTICE · BOTS</span><button className="casino-tool" onClick={()=>{if(window.confirm('Restart practice with 1,000 chips each? Current practice progress will be cleared.'))reset();}} aria-label="Restart practice"><RotateCcw size={18}/></button></>}
    actions={<div className="actions">{!table?<span>Preparing practice…</span>:!running?<><button className="secondary" onClick={onExit}>Exit</button>{funded>=2&&me&&me.stack>0?<button className="primary" onClick={nextHand}>Deal next hand</button>:<button className="primary" onClick={reset}>New practice</button>}</>:<><button className="fold-button" disabled={!legal} onClick={()=>commit(PRACTICE_PLAYER,{type:'fold'})}>Fold</button><button className="secondary" disabled={!legal} onClick={()=>commit(PRACTICE_PLAYER,{type:legal?.call?'call':'check'})}>{legal?.call?`Call ${legal.call.toLocaleString()}`:'Check'}</button><div className="raise-control"><input aria-label="Practice raise to amount" type="number" step={1} disabled={!legal?.canRaise} min={Math.min(legal?.min||40,legal?.max||40)} max={legal?.max||40} value={raise} onChange={e=>setRaise(Number(e.target.value))}/><button className="primary" disabled={!legal?.canRaise||!Number.isSafeInteger(raise)||raise<Math.min(legal.min,legal.max)||raise>legal.max} onClick={()=>commit(PRACTICE_PLAYER,{type:'raise',amount:raise})}>Raise to</button></div><button className="secondary" disabled={!legal||(!legal.canRaise&&(!me||legal.call!==me.stack))} onClick={()=>commit(PRACTICE_PLAYER,legal?.canRaise?{type:'raise',amount:legal.max}:{type:'call'})}>All-in</button></>}</div>}/>
    <div className="practice-caption" role="status">{running?(legal?'Your turn · choose an action':me?.folded?'You folded · bots are finishing the hand':'Bots are playing…'):'Hand complete · deal again when ready'}</div>
    {error&&<p className="practice-error" role="alert">{error}</p>}
    <details className="history"><summary>Hand activity</summary>{table?.history.map((line,i)=><p key={`${table.handId}-${i}`}>{line}</p>)}</details>
    <p className="game-note">Local practice with four basic bots. No sign-in. Practice chips stay separate from online balances. Refreshing starts a new session. Turns last 30 seconds.</p>
  </div>;
}
