import test from 'node:test';
import assert from 'node:assert/strict';
import {createPractice,chooseBotMove,PRACTICE_PLAYER} from '../game/practice.ts';
import {active,act,legal,view,start} from '../game/engine.ts';
import {randomInt} from '../game/random.ts';
test('practice plays many complete hands with legal bot actions and conserves a separate chip pool',()=>{
  for(let run=0;run<50;run++){
    const t=createPractice();assert.equal(t.seats.length,5);
    assert.equal(t.seats.filter(p=>p.name.endsWith('BOT')).length,4);
    let steps=0;
    while(active(t)){
      assert.ok(steps++<300);
      const p=t.seats[t.turn];const l=legal(t,p.id)!;
      act(t,p.id,p.id===PRACTICE_PLAYER?{type:l.call?'call':'check'}:chooseBotMove(t,(run*7+steps*13)%100));
      assert.equal(t.seats.reduce((s,p)=>s+p.stack+p.total,0),5000);
    }
    if(t.seats.filter(p=>p.stack>0).length>=2){const button=t.button;start(t);assert.notEqual(t.button,button);}
  }
});
test('practice view hides bot cards and bot policy ignores opponents private cards',()=>{
  const t=createPractice();const visible=view(t,PRACTICE_PLAYER);
  assert.equal(visible.seats[0].cards.filter(Boolean).length,2);
  assert.ok(visible.seats.slice(1).every(p=>p.cards.every(c=>c===null)));
  const clone=structuredClone(t);
  clone.seats.forEach((p,i)=>{if(i!==clone.turn)p.cards=['As','Ad'];});
  for(let roll=0;roll<100;roll++)assert.deepEqual(chooseBotMove(t,roll),chooseBotMove(clone,roll));
});
test('shared secure random integer helper enforces range and rejects invalid bounds',()=>{
  for(const max of [1,2,3,52,100])for(let n=0;n<100;n++){
    const v=randomInt(max);assert.ok(Number.isInteger(v)&&v>=0&&v<max);
  }
  for(const max of [0,-1,1.5,NaN,Infinity,0x100000000])assert.throws(()=>randomInt(max));
});
