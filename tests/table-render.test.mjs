import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { build } = wranglerRequire('esbuild');
const cache = join(process.cwd(), 'node_modules', '.cache');
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(join(cache, 'velora-table-'));
try {
  const output = join(directory, 'table.cjs');
  await build({ entryPoints: ['components/CasinoTable.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: output, jsx: 'automatic', logLevel: 'silent' });
  const CasinoTable = require(output).default;
  const now = 100000;
  const players = ['Alice', 'Bob'].map((name, i) => ({ id: String(i), name, stack: 1000, bet: 0, folded: false, connected: true, cards: i === 0 ? ['As', 'Ad'] : [null, null] }));
  const table = { id: 'test', name: 'Lounge', capacity: 6, small: 10, big: 20, button: 0, turn: 0, phase: 'preflop', board: [], handId: 'one', version: 1, deadline: now + 4000, pot: 30, payouts: {}, history: [], legal: { call: 20, min: 40, max: 1000, canRaise: true }, seats: players };
  const render = (value, userId = '0') => renderToStaticMarkup(React.createElement(CasinoTable, { table: value, userId, clock: now, toolbar: React.createElement('button', null, 'Back'), actions: React.createElement('button', null, 'Check') }));
  test('preview and 2/5/6/9-seat table states render without client APIs', () => {
    assert.match(render(null), /Your next great hand starts here/);
    for (const capacity of [2, 5, 6, 9]) {
      const html = render({ ...table, capacity });
      assert.match(html, new RegExp(`seats-${capacity}`));
      assert.equal((html.match(/class="casino-seat slot-/g) || []).length, capacity);
      assert.match(html, /time-critical/);
      assert.equal((html.match(/Face-down card/g) || []).length, 2);
    }
  });
  test('showdown highlights five visible cards and keeps final pot after settlement', () => {
    const html = render({ ...table, phase: 'complete', turn: -1, legal: null, pot: 0, payouts: { '0': 400 }, board: ['Ks', 'Qs', 'Js', 'Ts', '2d'] });
    assert.match(html, /FINAL POT/);
    assert.match(html, />400<\/b>/);
    assert.equal((html.match(/, best hand/g) || []).length, 5);
    assert.match(html, /Alice \+400/);
    assert.match(html, /casino-winner-ring/);
    assert.match(html, /casino-winner-rank">ROYAL FLUSH/);
    assert.doesNotMatch(html, /on-turn/);
  });
  test('all payout winners receive an orbit and rank, including different side-pot hands', () => {
    const seats = [{ ...players[0], cards: ['Ah', 'Ad'] }, { ...players[1], cards: ['Kh', 'Kd'] }];
    const html = render({ ...table, seats, phase: 'complete', turn: -1, payouts: { '0': 300, '1': 100 }, board: ['Ac', 'Ks', '2d', '3h', '5c'] });
    assert.equal((html.match(/class="casino-winner-ring"/g) || []).length, 2);
    assert.equal((html.match(/casino-winner-rank">THREE OF A KIND/g) || []).length, 2);
    const folded = render({ ...table, phase: 'complete', turn: -1, payouts: { '1': 30 }, seats: [{ ...players[0], folded: true }, players[1]] });
    assert.match(folded, /casino-winner-rank">WON BY FOLD/);
    assert.equal((folded.match(/Face-down card/g) || []).length, 2);
    assert.doesNotMatch(render(table), /casino-winner-ring/);
  });
  test('player names are escaped; folded cards and duplicate-name action badges stay hidden', () => {
    const seats = players.map(p => ({ ...p, name: '<img src=x>', folded: true }));
    const html = render({ ...table, turn: -1, seats, history: ['<img src=x>: fold'] });
    assert.match(html, /&lt;img src=x&gt;/);
    assert.doesNotMatch(html, /<img src=x>/);
    assert.doesNotMatch(html, /Face-down card/);
    assert.doesNotMatch(html, /casino-action-badge/);
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
