import test from 'node:test';
import assert from 'node:assert/strict';
import {handLabel} from '../lib/hand-label.ts';
test('table hand label uses the best visible hand without treating hidden cards as known',()=>{
  assert.equal(handLabel([null,null]),'WAITING');
  assert.equal(handLabel(['As','Ad']),'ONE PAIR');
  assert.equal(handLabel(['Ts','2d']),'HIGH CARD');
  assert.equal(handLabel(['As','2s','3s','4s','5s','Kh','Kd']),'STRAIGHT FLUSH');
  assert.equal(handLabel(['Ah','Ad','Ac','Ks','Kd','2s','3c']),'FULL HOUSE');
  assert.equal(handLabel(['Ah','Ad','Ks','Kd','2s']),'TWO PAIR');
});
