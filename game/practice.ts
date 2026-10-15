import {newTable,seat,start,legal,type Table,type Move} from './engine.ts';
import {randomInt} from './random.ts';
import {handLabel} from '../lib/hand-label.ts';
export const PRACTICE_PLAYER='practice-you';
export function createPractice():Table {
  const t=newTable('local-practice','Practice · 4 basic bots',5);
  seat(t,PRACTICE_PLAYER,'You',1000);
  ['Amber','Kai','Nova','Leo'].forEach((name,i)=>seat(t,`practice-bot-${i}`,`${name} · BOT`,1000));
  start(t);
  return t;
}
/** Basic training policy; only its own cards, public board and legal amounts affect play. */
export function chooseBotMove(t:Table,roll=randomInt(100)):Move {
  const p=t.seats[t.turn];
  const l=p&&legal(t,p.id);
  if(!l)throw Error('No legal bot turn');
  const label=handLabel([...p.cards,...t.board]);
  const made=label!=='HIGH CARD'&&label!=='WAITING';
  if(l.canRaise&&roll<(made?18:6))return {type:'raise',amount:Math.min(l.min,l.max)};
  if(l.call&&roll>=(made?95:l.call>p.stack*.25?55:85))return {type:'fold'};
  return {type:l.call?'call':'check'};
}
