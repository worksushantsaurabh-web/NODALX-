import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseInquiryPage, appendInquiryPage} from './inquiryDesk.ts';

test('overlapping server pages preserve locally saved inquiry status', () => {
  const first = parseInquiryPage({records: [{id: 'first', status: 'Contacted'}], nextCursor: 'cursor'});
  const next = parseInquiryPage({records: [{id: 'first', status: 'Pending'}, {id: 'second', status: 'Qualified'}], nextCursor: null});
  const merged = appendInquiryPage(first.records, next.records);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].status, 'Contacted');
  assert.equal(merged[1].id, 'second');
});

test('an incompatible or failed endpoint is not presented as an empty inbox', () => {
  for (const value of [[], null, {records: [], nextCursor: 3}, {records: 'bad', nextCursor: null}]) {
    assert.throws(() => parseInquiryPage(value));
  }
  assert.deepEqual(parseInquiryPage({records: [], nextCursor: null}), {records: [], skipped: 0, nextCursor: null});
});
