import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNodalxV3Packet, validateReviewDecision, buildCorrectionRecord} from '../server/nodalx-v3-result.mjs';

const hash='a'.repeat(64);
const candidate={schema_version:'nodalx-v3',needs_review:true,
  classification:{intent:'sales',urgency:'normal',next_action:'send_quote',lead_priority:'warm',
    prospect_fit:'not_applicable',category:'pre_sales',summary:'Requests a quote.',
    evidence:['Please send a quote.'],follow_up_draft:'What service date should we check?'},
  evidence_sources:[{text:'Please send a quote.',source_type:'customer_message',source_id:null}],
  review_reasons:[],recipe:{model_sha256:hash,prompt_sha256:hash,wrapper_sha256:hash}};

test('versioned result retains action, draft, evidence source, review state and recipe', () => {
  assert.equal(validateNodalxV3Packet(candidate),candidate);
});

test('versioned result rejects unsupported content and unsafe action/draft combinations', () => {
  const variants=[
    {...candidate,needs_review:false},
    {...candidate,classification:{...candidate.classification,next_action:'stop_outreach'}},
    {...candidate,classification:{...candidate.classification,intent:'unknown_intent'}},
    {...candidate,evidence_sources:[{...candidate.evidence_sources[0],source_type:'assistant'}]},
    {...candidate,recipe:{...candidate.recipe,model_sha256:'not-a-hash'}},
    {...candidate,classification:{...candidate.classification,fit_score:99}},
  ];
  for (const value of variants) assert.throws(() => validateNodalxV3Packet(value));
});

test('human review decision validates accepted, edited, and dismissed states', () => {
  const valid = {decision: 'accepted', notes: 'Looks good', reviewed_at: new Date().toISOString()};
  assert.equal(validateReviewDecision(valid), valid);
  const edited = {decision: 'edited', applied_action: 'send_quote', edited_draft: 'Custom draft', notes: 'Adjusted scope'};
  assert.equal(validateReviewDecision(edited), edited);
  const dismissed = {decision: 'dismissed', notes: 'Model misclassified emergency'};
  assert.equal(validateReviewDecision(dismissed), dismissed);

  assert.throws(() => validateReviewDecision({decision: 'auto_apply'}), /Invalid review decision value/);
  assert.throws(() => validateReviewDecision({decision: 'accepted', notes: 'x'.repeat(1001)}), /Invalid review decision notes/);
  assert.throws(() => validateReviewDecision({decision: 'accepted', reviewed_at: 'not-a-date'}), /Invalid review timestamp/);
});

test('buildCorrectionRecord formats training feedback rows matching continuous improvement rubric', () => {
  const record = buildCorrectionRecord({
    inquiryId: 'inq-123',
    analysisPacket: candidate,
    reviewDecision: {
      decision: 'edited',
      applied_action: 'send_quote',
      edited_draft: 'What size sign would you like quoted?',
      notes: 'Customer did not specify dimensions',
      reviewed_at: '2026-10-10T12:00:00.000Z',
    },
    reviewerId: 'user-operator-1',
  });

  assert.equal(record.inquiry_id, 'inq-123');
  assert.equal(record.review_status, 'approved');
  assert.equal(record.reviewer_id, 'user-operator-1');
  assert.equal(record.reason, 'Customer did not specify dimensions');
  assert.deepEqual(record.correction, {
    suggested_action: 'send_quote',
    follow_up_draft: 'What size sign would you like quoted?',
  });
  assert.equal(record.prediction, candidate.classification);
  assert.equal(record.recipe, candidate.recipe);

  const dismissed = buildCorrectionRecord({
    inquiryId: 'inq-456',
    analysisPacket: candidate,
    reviewDecision: {decision: 'dismissed', notes: 'Wrong classification'},
  });
  assert.equal(dismissed.review_status, 'rejected');
  assert.equal(dismissed.correction, null);
  assert.equal(dismissed.reviewer_id, null);

  // With no operator notes the reason must still distinguish the three
  // outcomes, because a training curator filters on review_status/reason.
  const fallbacks = ['accepted', 'edited', 'dismissed'].map(decision => buildCorrectionRecord({
    inquiryId: 'inq-789',
    analysisPacket: candidate,
    reviewDecision: {decision},
  }));
  assert.deepEqual(fallbacks.map(record => record.reason), [
    'accepted_as_recommended', 'corrected_by_operator', 'rejected_by_operator',
  ]);
  assert.deepEqual(fallbacks.map(record => record.review_status), [
    'approved', 'approved', 'rejected',
  ]);
});
