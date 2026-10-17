import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('tailwindcss/package.json'))('postcss');

test('portrait-only declarations cannot select native fullscreen or expanded fallback', async () => {
  const css = postcss.parse(await readFile('app/casino-portrait.css', 'utf8'));
  let overrides = 0;
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    if (rule.selector === '.casino-portrait-felt') {
      assert.equal(rule.nodes[0].prop, 'display'); assert.equal(rule.nodes[0].value, 'none'); return;
    }
    assert.equal(rule.parent.name, 'media');
    assert.match(rule.parent.params, /orientation:portrait/);
    for (const selector of rule.selectors) {
      assert.match(selector, /\.casino-stage(?:\.seats-\d+)?:not\(:fullscreen\):not\(\.casino-theater\)/);
      overrides++;
    }
  });
  assert.ok(overrides > 30);
});
