import test from 'node:test';
import assert from 'node:assert/strict';
import {pokerSoundEvents} from '../lib/poker-sounds.ts';
import {createPractice,PRACTICE_PLAYER} from '../game/practice.ts';
import {act,view,legal,active} from '../game/engine.ts';
test('sound events distinguish dealing, bets, folds, turn and payout without replaying a snapshot',()=>{
 const t=createPractice();let prior=structuredClone(view(t,PRACTICE_PLAYER));
 assert.deepEqual(pokerSoundEvents(null,prior,PRACTICE_PLAYER),['deal']);
 assert.deepEqual(pokerSoundEvents(prior,prior,PRACTICE_PLAYER),[]);
 act(t,t.seats[t.turn].id,{type:'call'});
 let after=structuredClone(view(t,PRACTICE_PLAYER));assert.ok(pokerSoundEvents(prior,after,PRACTICE_PLAYER).includes('chips'));prior=after;
 act(t,t.seats[t.turn].id,{type:'fold'});
 after=structuredClone(view(t,PRACTICE_PLAYER));assert.ok(pokerSoundEvents(prior,after,PRACTICE_PLAYER).includes('fold'));
 let sawFlop=false,sawTurn=false;
 while(active(t)){
  prior=structuredClone(view(t,PRACTICE_PLAYER));const p=t.seats[t.turn];const l=legal(t,p.id)!;act(t,p.id,{type:l.call?'call':'check'});after=structuredClone(view(t,PRACTICE_PLAYER));
  const events=pokerSoundEvents(prior,after,PRACTICE_PLAYER);if(events.includes('flop'))sawFlop=true;if(events.includes('turn'))sawTurn=true;
 }
 assert.ok(sawFlop);assert.ok(sawTurn);
 assert.ok(pokerSoundEvents(prior,after,PRACTICE_PLAYER).includes((after.payouts[PRACTICE_PLAYER]||0)>0?'win':'finish'));
 assert.deepEqual(pokerSoundEvents(after,after,PRACTICE_PLAYER),[]);
});
test('sound cues still detect actions after the public activity list reaches its cap',()=>{
 const t=createPractice();const before=structuredClone(view(t,PRACTICE_PLAYER));before.history=Array.from({length:20},(_,i)=>`Player ${i}: check`);
 const after=structuredClone(before);after.history=[...before.history.slice(1),'Amber · BOT: raise 40'];after.version++;
 assert.deepEqual(pokerSoundEvents(before,after,PRACTICE_PLAYER),['chips']);
});
