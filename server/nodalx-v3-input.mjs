// Prepare the smallest v3 model input from a database processing snapshot.
// Verified facts must be provided by the server; customer text never supplies them.
export function toNodalxV3Input(snapshot, trusted = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
    typeof snapshot.message !== 'string' || !snapshot.message.trim() || snapshot.message.length > 4000) {
    throw new Error('Invalid NodalX model message.');
  }
  const criteria = snapshot.criteria;
  if (criteria != null && (typeof criteria !== 'string' || criteria.length > 4000)) {
    throw new Error('Invalid NodalX qualification criteria.');
  }
  const context = {};
  if (criteria?.trim()) context.qualification_criteria = criteria;
  if (trusted.knowledge !== undefined) {
    if (!Array.isArray(trusted.knowledge) || trusted.knowledge.length > 10 ||
      !trusted.knowledge.every(item => typeof item?.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(item.id) &&
        typeof item.text === 'string' && item.text.length > 0 && item.text.length <= 500)) {
      throw new Error('Invalid verified model knowledge.');
    }
    context.knowledge = trusted.knowledge.map(item => ({id:item.id,text:item.text}));
  }
  if (trusted.history !== undefined) {
    if (!Array.isArray(trusted.history) || trusted.history.length > 8 ||
      !trusted.history.every(item => item?.role === 'customer' && typeof item.text === 'string' &&
        item.text.length > 0 && item.text.length <= 500)) {
      throw new Error('Invalid verified customer history.');
    }
    context.history = trusted.history.map(item => ({role:'customer',text:item.text}));
  }
  if (trusted.verified_state !== undefined) {
    const state=trusted.verified_state;
    if (!state || typeof state !== 'object' || Array.isArray(state) ||
      Object.keys(state).some(key => !['inquiry_saved','analysis_status'].includes(key)) ||
      (state.inquiry_saved !== undefined && typeof state.inquiry_saved !== 'boolean') ||
      (state.analysis_status !== undefined && !['queued','processing','completed','failed'].includes(state.analysis_status))) {
      throw new Error('Invalid verified model state.');
    }
    context.verified_state={...state};
  }
  const input={task:'inbound', message:snapshot.message, context};
  if (JSON.stringify(input).length > 4000) throw new Error('NodalX model input exceeds its tested limit.');
  return input;
}
