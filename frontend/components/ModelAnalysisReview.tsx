import React, { useState } from 'react';
import { Inquiry } from '../pages/inquiryDesk';
import { Check, ShieldAlert, FileText, ChevronDown, ChevronUp, Sparkles, XCircle, Edit3 } from 'lucide-react';

interface ModelAnalysisReviewProps {
  inquiry: Inquiry;
  onReviewSubmitted: () => void;
  onApplyDraft?: (draft: string) => void;
  apiRequest: (path: string, options?: RequestInit) => Promise<unknown>;
  disabled?: boolean;
}

export function ModelAnalysisReview({
  inquiry,
  onReviewSubmitted,
  onApplyDraft,
  apiRequest,
  disabled = false,
}: ModelAnalysisReviewProps) {
  const packet = inquiry.analysis_packet;
  const existingDecision = inquiry.review_decision;

  const [isEditing, setIsEditing] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<'accepted' | 'edited' | 'dismissed'>('accepted');
  const [reviewNotes, setReviewNotes] = useState('');
  const [editedDraft, setEditedDraft] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!packet) return null;

  const { classification, evidence_sources, review_reasons, recipe } = packet;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    try {
      const decisionPayload: {
        decision: 'accepted' | 'edited' | 'dismissed';
        notes?: string;
        reviewed_at: string;
        edited_draft?: string;
      } = {
        decision: selectedDecision,
        reviewed_at: new Date().toISOString(),
      };
      if (reviewNotes.trim()) decisionPayload.notes = reviewNotes.trim();
      if (selectedDecision === 'edited' && editedDraft.trim()) {
        decisionPayload.edited_draft = editedDraft.trim();
      }

      await apiRequest(`/api/workspace/inquiries/${encodeURIComponent(inquiry.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_decision: decisionPayload }),
      });
      setIsEditing(false);
      onReviewSubmitted();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save review decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const buttonStyle = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50';

  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            AI Model Analysis ({packet.schema_version})
          </h3>
        </div>
        {existingDecision && !isEditing ? (
          <span className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
            <Check className="h-3 w-3 text-accent" aria-hidden="true" />
            Reviewed: {existingDecision.decision}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-accent bg-bg px-2 py-0.5 text-xs font-medium text-accent">
            Needs Human Review
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-text-secondary">Intent</dt>
          <dd className="font-medium text-text-primary capitalize">{classification.intent}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Urgency</dt>
          <dd className="font-medium text-text-primary capitalize">{classification.urgency}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Recommended action</dt>
          <dd className="font-medium text-text-primary">{classification.next_action.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Lead priority</dt>
          <dd className="font-medium text-text-primary capitalize">{classification.lead_priority.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Category</dt>
          <dd className="font-medium text-text-primary capitalize">{classification.category.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Prospect fit</dt>
          <dd className="font-medium text-text-primary capitalize">{classification.prospect_fit.replaceAll('_', ' ')}</dd>
        </div>
      </dl>

      {review_reasons.length > 0 && (
        <div className="rounded border border-border bg-bg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <ShieldAlert className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span>Review Flags ({review_reasons.length})</span>
          </div>
          <ul className="list-inside list-disc text-xs text-text-secondary space-y-0.5">
            {review_reasons.map(reason => (
              <li key={reason}>{reason.replaceAll('_', ' ')}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Proposed Follow-up Draft</h4>
        {classification.follow_up_draft ? (
          <div className="mt-1.5 rounded border border-border bg-bg p-3 text-xs leading-relaxed text-text-primary">
            <p className="whitespace-pre-wrap">{classification.follow_up_draft}</p>
            {onApplyDraft && (
              <button
                type="button"
                onClick={() => onApplyDraft(classification.follow_up_draft)}
                className="mt-2 text-xs font-medium text-accent hover:underline"
              >
                Use this draft in reply composer
              </button>
            )}
          </div>
        ) : (
          <p className="mt-1.5 text-xs italic text-text-secondary">
            Draft withheld for human review due to policy checks or ungrounded details.
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Cited Evidence & Provenance ({evidence_sources.length})</span>
          {showEvidence ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showEvidence && (
          <div className="mt-2 space-y-2 rounded border border-border bg-bg p-3 text-xs">
            <div>
              <p className="font-semibold text-text-secondary">Evidence citations:</p>
              {evidence_sources.length ? (
                <ul className="mt-1 list-inside list-disc space-y-1 text-text-primary">
                  {evidence_sources.map((item, idx) => (
                    <li key={idx} className="break-words">
                      “{item.text}” <span className="text-text-secondary">({item.source_type.replaceAll('_', ' ')})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-secondary italic">No evidence cited.</p>
              )}
            </div>
            <div className="border-t border-border pt-2 text-[11px] text-text-secondary">
              <p>Model SHA: {recipe.model_sha256.slice(0, 16)}…</p>
              <p>Prompt SHA: {recipe.prompt_sha256.slice(0, 16)}…</p>
              <p>Wrapper SHA: {recipe.wrapper_sha256.slice(0, 16)}…</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3">
        {existingDecision && !isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs">
                <span className="font-semibold text-text-primary">Human Decision: </span>
                <span className="capitalize text-text-secondary">{existingDecision.decision}</span>
                {existingDecision.reviewed_at && (
                  <span className="text-text-secondary">
                    {' · '}
                    {new Date(existingDecision.reviewed_at).toLocaleString()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDecision(existingDecision.decision);
                  setReviewNotes(existingDecision.notes || '');
                  setEditedDraft(existingDecision.edited_draft || '');
                  setIsEditing(true);
                }}
                disabled={disabled}
                className={buttonStyle}
              >
                <Edit3 className="h-3 w-3" aria-hidden="true" />
                Change review
              </button>
            </div>
            {existingDecision.notes && (
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Notes: </span>
                {existingDecision.notes}
              </p>
            )}
            {existingDecision.edited_draft && (
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Edited Draft: </span>
                {existingDecision.edited_draft}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Record Human Review
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDecision('accepted')}
                className={`${buttonStyle} ${selectedDecision === 'accepted' ? '!border-accent bg-surface-hover' : ''}`}
              >
                <Check className="h-3 w-3 text-accent" aria-hidden="true" />
                Accept recommendation
              </button>
              <button
                type="button"
                onClick={() => setSelectedDecision('edited')}
                className={`${buttonStyle} ${selectedDecision === 'edited' ? '!border-accent bg-surface-hover' : ''}`}
              >
                <Edit3 className="h-3 w-3" aria-hidden="true" />
                Edit recommendation
              </button>
              <button
                type="button"
                onClick={() => setSelectedDecision('dismissed')}
                className={`${buttonStyle} ${selectedDecision === 'dismissed' ? '!border-accent bg-surface-hover' : ''}`}
              >
                <XCircle className="h-3 w-3 text-text-secondary" aria-hidden="true" />
                Dismiss recommendation
              </button>
            </div>

            {selectedDecision === 'edited' && (
              <label className="block text-xs font-medium text-text-secondary">
                Edited draft / next action
                <textarea
                  value={editedDraft}
                  onChange={e => setEditedDraft(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Enter human-revised draft or action..."
                  className="mt-1 w-full rounded border border-border bg-bg p-2 text-xs text-text-primary"
                />
              </label>
            )}

            <label className="block text-xs font-medium text-text-secondary">
              Operator notes (optional)
              <input
                type="text"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                maxLength={1000}
                placeholder="Reason or context for this review decision..."
                className="mt-1 w-full rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
            </label>

            {errorMessage && (
              <p className="text-xs font-medium text-accent">{errorMessage}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || disabled}
                className={`${buttonStyle} !bg-accent !text-[#fff]`}
              >
                {submitting ? 'Saving review…' : 'Save review decision'}
              </button>
              {existingDecision && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={buttonStyle}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
