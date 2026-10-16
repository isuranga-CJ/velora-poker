import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import React from 'react';

// Exercise actual React reconciliation without a browser or a simulated game.
const require = createRequire(import.meta.url);
const fiberRequire = createRequire(require.resolve('@react-three/fiber/package.json'));
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const cache = join(process.cwd(), 'node_modules', '.cache');
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(join(cache, 'velora-lifecycle-'));
try {
  const output = join(directory, 'table.cjs');
  await wranglerRequire('esbuild').build({ entryPoints: ['components/CasinoTable.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: output, jsx: 'automatic', logLevel: 'silent' });
  const CasinoTable = require(output).default;
  await test('winner banner and revealed cards keep the same host nodes across clock ticks', () => {
    const previousDocument = globalThis.document;
    globalThis.document = { addEventListener() {}, removeEventListener() {}, fullscreenElement: null };
    const errors = [], warnings = [], created = [];
    const oldError = console.error;
    console.error = (...args) => warnings.push(args.join(' '));
    const context = {};
    const append = (parent, child) => { const at = parent.children.indexOf(child); if (at >= 0) parent.children.splice(at, 1); parent.children.push(child); };
    const remove = (parent, child) => { const at = parent.children.indexOf(child); if (at >= 0) parent.children.splice(at, 1); };
    const insert = (parent, child, before) => { remove(parent, child); parent.children.splice(parent.children.indexOf(before), 0, child); };
    const renderer = fiberRequire('react-reconciler')({
      isPrimaryRenderer: false, supportsMutation: true, supportsPersistence: false, supportsHydration: false, warnsIfNotActing: false,
      getRootHostContext: () => context, getChildHostContext: () => context,
      createInstance: (type, props) => { const node = { type, props, children: [] }; created.push(node); return node; },
      createTextInstance: text => ({ text }), getPublicInstance: node => node,
      appendInitialChild: append, appendChild: append, appendChildToContainer: append,
      removeChild: remove, removeChildFromContainer: remove, insertBefore: insert, insertInContainerBefore: insert,
      commitUpdate: (node, type, oldProps, props) => { node.props = props; },
      commitTextUpdate: (node, oldText, text) => { node.text = text; },
      finalizeInitialChildren: () => false, shouldSetTextContent: () => false,
      prepareForCommit: () => null, resetAfterCommit() {}, clearContainer: node => { node.children = []; },
      scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
      detachDeletedInstance() {}, setCurrentUpdatePriority() {}, getCurrentUpdatePriority: () => 32, resolveUpdatePriority: () => 32,
      maySuspendCommit: () => false, NotPendingTransition: null, HostTransitionContext: React.createContext(null),
      resetFormInstance() {}, requestPostPaintCallback() {}, shouldAttemptEagerTransition: () => false,
    });
    const container = { children: [] };
    const root = renderer.createContainer(container, 1, null, false, null, '', e => errors.push(e), e => errors.push(e), e => errors.push(e), null);
    const table = { id: 'test', name: 'Lounge', capacity: 2, small: 10, big: 20, button: 0, turn: 0, phase: 'river', board: ['Ts', 'Js', 'Qs', '2d', '3h'], handId: 'one', version: 1, deadline: 30000, pot: 200, payouts: {}, history: [], legal: null, seats: [
      { id: 'a', name: 'Alice', stack: 900, bet: 0, folded: false, connected: true, cards: ['As', 'Ks'] },
      { id: 'b', name: 'Bob', stack: 900, bet: 0, folded: false, connected: true, cards: [null, null] },
    ] };
    const update = (value, clock) => { renderer.updateContainerSync(React.createElement(CasinoTable, { table: value, clock, userId: 'a', toolbar: null, actions: null }), root, null, null); renderer.flushSyncWork(); renderer.flushPassiveEffects(); renderer.flushSyncWork(); };
    const find = (name, node = container) => [node, ...(node.children || []).flatMap(n => find(name, n))].filter(n => n.props?.className === name);
    try {
      update(table, 1000);
      const shells = find('casino-card-shell');
      const complete = { ...table, phase: 'complete', turn: -1, deadline: 0, payouts: { a: 200 }, seats: [table.seats[0], { ...table.seats[1], cards: ['9h', '9d'] }] };
      update(complete, 2000);
      const banner = find('casino-result')[0];
      assert.ok(banner);
      for (let clock = 2500; clock < 7000; clock += 500) {
        update(complete, clock);
        assert.equal(find('casino-result').length, 1);
        assert.equal(find('casino-result')[0], banner, 'clock update remounted the winner banner');
        assert.deepEqual(find('casino-card-shell'), shells, 'showdown remounted card slots');
      }
      assert.equal(created.filter(n => n.props.className === 'casino-result').length, 1);
      update({ ...table, handId: 'next-hand' }, 8000);
      assert.equal(find('casino-result').length, 0);
      assert.equal(find('casino-winner-ring').length, 0);
      assert.deepEqual(errors, []);
      assert.equal(warnings.filter(s => /same key/.test(s)).length, 0, warnings.join('\n'));
    } finally {
      renderer.updateContainerSync(null, root, null, null); renderer.flushSyncWork(); renderer.flushPassiveEffects();
      console.error = oldError; globalThis.document = previousDocument;
    }
  });
} finally { await rm(directory, { recursive: true, force: true }); }
