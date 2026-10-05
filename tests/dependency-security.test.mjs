import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

test('the Firebase gRPC override and lockfile retain the reviewed security patch', () => {
  const manifest = JSON.parse(readFileSync(new URL('../frontend/package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../frontend/package-lock.json', import.meta.url), 'utf8'));
  assert.equal(manifest.overrides['@firebase/firestore']['@grpc/grpc-js'], '1.14.5');
  const packages = Object.entries(lock.packages).filter(([path]) => path.endsWith('/@grpc/grpc-js'));
  assert.ok(packages.length > 0);
  for (const [, dependency] of packages) assert.equal(dependency.version, '1.14.5');
});
