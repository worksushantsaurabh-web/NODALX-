// Versioned candidate contract for a future reviewed model service.
// The current processing worker does not persist this packet yet.
const enums = {
  intent: ['sales','booking','reschedule','cancellation','support','complaint','refund','billing','spam','other','outbound_prospect'],
  urgency: ['low','normal','high'],
  next_action: ['send_quote','confirm_availability','reschedule_booking','process_cancellation','provide_support','escalate_to_human','review_refund','check_billing','ignore','ask_clarification','draft_outreach','research_prospect','stop_outreach'],
  lead_priority: ['hot','warm','cold','not_lead','unknown'],
  prospect_fit: ['not_applicable','strong','possible','poor','unknown'],
  category: ['pre_sales','scheduling','customer_service','finance','noise','prospecting','clarification'],
};
const classificationKeys=[...Object.keys(enums),'summary','evidence','follow_up_draft'];
const sourceTypes=new Set(['customer_message','customer_history','prospect_record','product_knowledge']);
const sha256=/^[a-f0-9]{64}$/;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
}

export function validateNodalxV3Packet(packet) {
  if (!exactKeys(packet,['schema_version','classification','evidence_sources','review_reasons','needs_review','recipe']) ||
    packet.schema_version !== 'nodalx-v3' || packet.needs_review !== true ||
    JSON.stringify(packet).length > 16000) throw new Error('Invalid NodalX analysis packet.');
  const value=packet.classification;
  if (!exactKeys(value,classificationKeys)) throw new Error('Invalid NodalX classification shape.');
  for (const [key,options] of Object.entries(enums)) {
    if (!options.includes(value[key])) throw new Error('Invalid NodalX classification value.');
  }
  if (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 1000 ||
    typeof value.follow_up_draft !== 'string' || value.follow_up_draft.length > 1000 ||
    !Array.isArray(value.evidence) || value.evidence.length > 3 ||
    !value.evidence.every(item => typeof item === 'string' && item.trim() && item.length <= 220)) {
    throw new Error('Invalid NodalX classification text.');
  }
  if (!Array.isArray(packet.evidence_sources) || packet.evidence_sources.length !== value.evidence.length ||
    !packet.evidence_sources.every((item,index) => exactKeys(item,['text','source_type','source_id']) &&
      item.text === value.evidence[index] && sourceTypes.has(item.source_type) &&
      (item.source_id === null || typeof item.source_id === 'string' && item.source_id.length <= 80))) {
    throw new Error('Invalid NodalX evidence references.');
  }
  if (!Array.isArray(packet.review_reasons) || packet.review_reasons.length > 16 ||
    !packet.review_reasons.every(item => typeof item === 'string' && /^[a-z_]{1,80}$/.test(item))) {
    throw new Error('Invalid NodalX review reasons.');
  }
  if (!exactKeys(packet.recipe,['model_sha256','prompt_sha256','wrapper_sha256']) ||
    !Object.values(packet.recipe).every(value => typeof value === 'string' && sha256.test(value))) {
    throw new Error('Invalid NodalX recipe provenance.');
  }
  if (['stop_outreach','ignore','research_prospect'].includes(value.next_action) && value.follow_up_draft) {
    throw new Error('Suppressed NodalX action cannot contain a draft.');
  }
  return packet;
}

export function validateReviewDecision(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('Invalid review decision.');
  }
  if (!['accepted', 'edited', 'dismissed'].includes(decision.decision)) {
    throw new Error('Invalid review decision value.');
  }
  if (decision.notes !== undefined && (typeof decision.notes !== 'string' || decision.notes.length > 1000)) {
    throw new Error('Invalid review decision notes.');
  }
  if (decision.applied_action !== undefined && (typeof decision.applied_action !== 'string' || decision.applied_action.length > 200)) {
    throw new Error('Invalid applied action.');
  }
  if (decision.edited_draft !== undefined && (typeof decision.edited_draft !== 'string' || decision.edited_draft.length > 1000)) {
    throw new Error('Invalid edited draft.');
  }
  if (decision.edited_classification !== undefined && (typeof decision.edited_classification !== 'object' || Array.isArray(decision.edited_classification))) {
    throw new Error('Invalid edited classification.');
  }
  if (decision.reviewed_at !== undefined && (typeof decision.reviewed_at !== 'string' || isNaN(Date.parse(decision.reviewed_at)))) {
    throw new Error('Invalid review timestamp.');
  }
  return decision;
}

export function buildCorrectionRecord({
  inquiryId,
  analysisPacket,
  reviewDecision,
  reviewerId = null,
}) {
  if (!inquiryId || !analysisPacket || !reviewDecision) {
    throw new Error('Missing required arguments for correction record.');
  }
  validateNodalxV3Packet(analysisPacket);
  validateReviewDecision(reviewDecision);

  const correction = {};
  if (reviewDecision.applied_action) {
    correction.suggested_action = reviewDecision.applied_action;
  }
  if (reviewDecision.edited_draft !== undefined) {
    correction.follow_up_draft = reviewDecision.edited_draft;
  }
  if (reviewDecision.edited_classification && typeof reviewDecision.edited_classification === 'object') {
    Object.assign(correction, reviewDecision.edited_classification);
  }

  const fallbackReason = reviewDecision.decision === 'accepted' ? 'accepted_as_recommended'
    : reviewDecision.decision === 'dismissed' ? 'rejected_by_operator' : 'corrected_by_operator';
  return {
    inquiry_id: String(inquiryId),
    model_version: analysisPacket.recipe?.model_sha256?.slice(0, 16) || 'nodalx-v3',
    prompt_version: analysisPacket.recipe?.prompt_sha256?.slice(0, 16) || 'nodalx-prompt-v3',
    recipe: analysisPacket.recipe,
    prediction: analysisPacket.classification,
    correction: Object.keys(correction).length ? correction : null,
    reason: reviewDecision.notes || fallbackReason,
    review_status: reviewDecision.decision === 'dismissed' ? 'rejected' : 'approved',
    reviewer_id: reviewerId ? String(reviewerId) : null,
    reviewed_at: reviewDecision.reviewed_at || new Date().toISOString(),
  };
}
