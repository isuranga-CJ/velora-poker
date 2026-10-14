'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { TableView } from '../game/engine';
import { handLabel } from '../lib/hand-label';

const five = [[50,76],[22,67],[10,40],[23,18],[90,40]];
function positions(count: number) {
  if (count === 5) return five;
  if (count === 6) return [[50,76],[23,67],[10,43],[23,23],[77,23],[90,43]];
  if (count === 9) return [[50,77],[28,74],[11,61],[8,41],[23,24],[77,24],[92,41],[89,61],[72,74]];
  if (count === 2) return [[50,76],[18,30]];
  return Array.from({length:count},(_,i) => {
    const angle=i/count*Math.PI*2;
    return [50-Math.sin(angle)*39,48+Math.cos(angle)*29];
  });
}
function Card({card,index}:{card:string|null;index:number}) {
  const suit=card?{s:'♠',h:'♥',d:'♦',c:'♣'}[card[1]]:null;
  return <span className={`casino-card ${card?'face':'back'} ${card&&'hd'.includes(card[1])?'red':''}`} style={{'--card-index':index} as CSSProperties} aria-label={card?`${card[0]==='T'?'10':card[0]} ${suit}`:'Face-down card'}>
    {card&&<><b>{card[0]==='T'?'10':card[0]}</b><small>{suit}</small><i>{suit}</i></>}
  </span>;
}
function Chips({amount}:{amount:number}) {
  return <span className="casino-wager" aria-label={`${amount.toLocaleString()} chips bet`}><span className="casino-chip-stack">{[0,1,2,3].map(i=><i key={i}/>)}</span><b>◉ {amount.toLocaleString()}</b></span>;
}
export default function CasinoTable({table,userId,clock,toolbar,actions}:{table:TableView|null;userId?:string;clock:number;toolbar:ReactNode;actions:ReactNode}) {
  const count=table?.capacity||5;
  const myIndex=table?.seats.findIndex(p=>p.id===userId)??-1;
  const me=myIndex>=0?table?.seats[myIndex]:undefined;
  const coords=positions(count);
  const payouts=table?.phase==='complete'?Object.entries(table.payouts).filter(([,n])=>n>0):[];
  return <section className="casino-view" aria-label="Poker table">
    <div className="casino-stage">
      <div className="casino-room-art"/>
      <div className="casino-toolbar">{toolbar}</div>
      <div className="casino-table-title"><b>{table?.name||'VELORA LOUNGE'}</b><span>{table?`${table.small} / ${table.big} · ${table.phase}`:'TABLE PREVIEW · 5 SEATS'}</span></div>
      <div className="casino-pot" aria-live="polite"><span>◉</span><b>{(table?.pot||0).toLocaleString()}</b><small>{payouts.length?'HAND COMPLETE':'TOTAL POT'}</small></div>
      <div className="casino-board" aria-label="Community cards">{table?.board.map((c,i)=><Card key={`${table.handId}-${i}-${c}`} card={c} index={i}/>)}</div>
      {coords.map(([x,y],slot)=>{
        const index=myIndex>=0?(slot+myIndex)%count:slot;
        const p=table?.seats[index];
        const current=!!p&&table?.turn===index;
        const mine=!!p&&p.id===userId;
        const seconds=current?Math.max(0,Math.ceil(((table?.deadline||0)-clock)/1000)):0;
        return <div key={p?.id||`empty-${slot}`} className={`casino-seat slot-${slot} ${mine?'is-me':''} ${current?'on-turn':''} ${p?.folded?'is-folded':''} ${!p?'is-empty':''}`} style={{left:`${x}%`,top:`${y}%`,'--seat-hue':(index*61+210)%360,'--turn-progress':`${seconds/30*100}%`} as CSSProperties}>
          <span className="casino-player-name">{p?p.name+(mine?' · YOU':''):'OPEN SEAT'}</span>
          <div className="casino-avatar">{p?<span>{p.name.slice(0,2).toUpperCase()}</span>:<span>+</span>}{table?.button===index&&p&&<b className="casino-dealer-button" title="Dealer button">D</b>}</div>
          {p&&<><div className="casino-player-cards">{!p.folded&&p.cards.map((c,i)=><Card key={`${table?.handId}-${p.id}-${i}-${c}`} card={c} index={i}/>)}</div><b className="casino-balance">◉ {p.stack.toLocaleString()}</b><span className="casino-player-status">{p.folded?'FOLDED':!p.connected?'OFFLINE':current?`${seconds}s · YOUR TURN`.replace('YOUR',mine?'YOUR':'PLAYER'):p.stack===0?'ALL-IN':''}</span>{p.bet>0&&<Chips amount={p.bet}/>}</>}
        </div>;
      })}
      {me&&!me.folded&&me.cards.length>0&&<div className="casino-hand-label"><b>{handLabel([...me.cards,...(table?.board||[])])}</b><small>CURRENT HAND</small></div>}
      {payouts.length>0&&<div className="casino-result" role="status">{payouts.map(([id,n])=>`${table?.seats.find(p=>p.id===id)?.name||'Player'} +${n.toLocaleString()}`).join(' · ')}</div>}
      {!table&&<div className="casino-preview-note">Room preview · Join a connected table to play</div>}
      <div className="casino-action-dock">{actions}</div>
    </div>
    <p className="casino-rotate-note">Rotate your phone for the full table view.</p>
  </section>;
}
