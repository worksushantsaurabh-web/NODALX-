import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveApiOrigin} from './apiOrigin.ts';

test('same-origin configuration uses the current preview rather than a fixed deployment', () => {
  for (const origin of ['https://preview-one.vercel.app', 'https://preview-two.vercel.app']) {
    assert.equal(resolveApiOrigin('same-origin', origin), origin);
    assert.equal(new URL(`${resolveApiOrigin('same-origin', origin)}/api/user/profile`).origin, origin);
  }
});

test('empty and whitespace settings preserve the same-origin default', () => {
  for (const configuration of [undefined, '', '  ', ' same-origin ']) {
    assert.equal(resolveApiOrigin(configuration, 'http://127.0.0.1:5173'), 'http://127.0.0.1:5173');
  }
});

test('explicit API endpoints retain backward compatibility', () => {
  for (const endpoint of ['http://127.0.0.1:8788', 'https://api.example.test']) {
    assert.equal(resolveApiOrigin(endpoint, 'https://preview.vercel.app'), endpoint);
  }
});
