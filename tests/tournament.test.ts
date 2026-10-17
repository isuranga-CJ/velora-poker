import test from 'node:test';
import assert from 'node:assert/strict';
import { act, active, legal, newTable, seat, start } from '../game/engine.ts';
import { CUP_BLINDS, CUP_LEVEL_MS, CUP_STACK, newCup, registerCup, unregisterCup, beginCup, dealCup, settleCup, assertCupChips, cupView } from '../game/tournament.ts';
function fixture(n=6) { const c=newCup('p0',1000),t=newTable('cup','Friends Cup'); for(let i=0;i<n;i++)registerCup(c,'p'+i,'Player '+i); const online=new Set(c.entries.map(p=>p.id)); return {c,t,online}; }
test('Cup registration is bounded, unique, withdrawable and frozen on start',()=>{
 const {c,t,online}=fixture();assert.throws(()=>registerCup(c,'p0','Copy'),/Already/);assert.throws(()=>registerCup(c,'p6','Extra'),/full/);unregisterCup(c,'p5');assert.equal(c.entries.length,5);registerCup(c,'p5','Back');
 assert.throws(()=>beginCup(c,t,'p1',online,1000),/host/);online.delete('p1');assert.throws(()=>beginCup(c,t,'p0',online,1000),/online/);online.add('p1');beginCup(c,t,'p0',online,1000);
 assert.throws(()=>registerCup(c,'p6','Late'),/closed/);assert.throws(()=>unregisterCup(c,'p0'),/closed/);assert.throws(()=>beginCup(c,t,'p0',online,1000),/already/);assertCupChips(c,t);assert.equal(t.seats.length,6);assert.equal(t.seats.reduce((n,p)=>n+p.stack+p.total,0),30000);assert.equal(t.big,50);
});
test('Cup requires two ready entrants; cash buy-in limits remain unchanged',()=>{
 const {c,t,online}=fixture(1);assert.throws(()=>beginCup(c,t,'p0',online),/two/);assert.throws(()=>seat(newTable('cash','cash'),'x','X',CUP_STACK),/Buy-in/);
});
test('Blind escalation applies between hands, never halfway through a hand',()=>{
 const {c,t,online}=fixture(2);beginCup(c,t,'p0',online,1000);assert.throws(()=>dealCup(c,t,1000+CUP_LEVEL_MS*2),/already/);assert.equal(t.big,50);
 act(t,t.seats[t.turn].id,{type:'fold'});settleCup(c,t,1000+CUP_LEVEL_MS*2);dealCup(c,t,1000+CUP_LEVEL_MS*2);assert.equal(t.big,150);assert.equal(c.level,2);assertCupChips(c,t);
});
test('Disconnected tournament players post blinds; ordinary tables require connected players',()=>{
 const {c,t,online}=fixture(2);beginCup(c,t,'p0',online,1000);act(t,t.seats[t.turn].id,{type:'fold'});t.seats.forEach(p=>p.connected=false);
 assert.throws(()=>start(t),/connected/);dealCup(c,t,1000+CUP_LEVEL_MS);assert.equal(t.seats.filter(p=>p.cards.length===2).length,2);assert.equal(t.seats.reduce((n,p)=>n+p.total,0),150);assert.ok(t.seats.every(p=>!p.connected));assertCupChips(c,t);
});
test('Simultaneous eliminations rank by pre-hand stack, with equal-stack ties; settlement is idempotent',()=>{
 const {c,t,online}=fixture(5);beginCup(c,t,'p0',online,1000);t.phase='complete';t.seats.forEach(p=>{p.bet=0;p.total=0;p.stack=p.id==='p0'?25000:0});c.handStacks={p0:5000,p1:3000,p2:2000,p3:2000,p4:1000};
 settleCup(c,t,2000);assert.equal(c.status,'complete');assert.deepEqual(Object.fromEntries(c.entries.map(p=>[p.id,p.rank])),{p0:1,p1:2,p2:3,p3:3,p4:5});const saved=JSON.stringify(c);settleCup(c,t,3000);assert.equal(JSON.stringify(c),saved);assertCupChips(c,t);assert.throws(()=>dealCup(c,t,4000),/not running/);
});
test('Tournament chip conservation guard rejects corruption',()=>{
 const {c,t,online}=fixture(2);beginCup(c,t,'p0',online,1000);t.seats[0].stack++;assert.throws(()=>assertCupChips(c,t),/integrity/);
});
test('Whole six-player Cups reach a sole champion without rebuys or lost chips, including JSON persistence',()=>{
 for(let run=0;run<8;run++) {
 let {c,t,online}=fixture();beginCup(c,t,'p0',online,1000);let actions=0,hands=0;
 while(c.status==='running') {
 while(active(t)) { assert.ok(actions++<1000);const p=t.seats[t.turn],l=legal(t,p.id)!;act(t,p.id,l.canRaise?{type:'raise',amount:l.max}:{type:l.call?'call':'check'});assertCupChips(c,t); }
 settleCup(c,t,1000+hands*CUP_LEVEL_MS);assert.ok(++hands<100);if(c.status==='running'){c=JSON.parse(JSON.stringify(c));t=JSON.parse(JSON.stringify(t));dealCup(c,t,1000+hands*CUP_LEVEL_MS);}
 }
 assert.equal(c.entries.filter(p=>p.rank===1).length,1);assert.ok(c.entries.every(p=>p.rank));assert.equal(t.seats.filter(p=>p.stack>0).length,1);assert.equal(t.seats.reduce((n,p)=>n+p.stack,0),30000);
 }
});
test('Public Cup view contains roster and results without cards, deck or internal hand stacks',()=>{
 const {c,t,online}=fixture(2);beginCup(c,t,'p0',online,1000);const v=cupView(c,t,online);assert.equal(v.nextLevelAt,1000+CUP_LEVEL_MS);assert.equal(v.totalChips,10000);assert.ok(!('handStacks' in v));assert.ok(!('cards' in v.entries[0]));assert.ok(!('deck' in v));assert.equal(CUP_BLINDS.length,14);
});
