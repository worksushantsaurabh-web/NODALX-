import React, {useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {api} from '../../src/services/api';
import {button, panel, Notice, PageTitle, useResource} from './ui';

interface KeyResult {active: boolean; keyPreview: string | null; apiKey?: string}

export default function WorkspacePipeline({compact = false}: {compact?: boolean}) {
  const {user} = useAuth();
  const resource = useResource<KeyResult>('/api/workspace/key');
  const [keyState, setKeyState] = useState({uid: '', value: ''});
  const key = keyState.uid === user?.uid ? keyState.value : '';
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = `${window.location.origin}/api/inquiries`;
  const snippet = [
    `curl '${endpoint}' \\`,
    "  -H 'Content-Type: application/json' \\",
    "  -H 'X-API-Key: YOUR_WORKSPACE_KEY' \\",
    "  -H 'Idempotency-Key: UNIQUE_REQUEST_ID' \\",
    '  -d \'{"name":"Jane Doe","email":"jane@example.com","company":"Example","message":"Request a consultation"}\'',
  ].join('\n');

  const manage = async (operation: 'create' | 'rotate' | 'revoke') => {
    const ownerUid = user?.uid || '';
    setBusy(true); setError(''); setMessage('');
    try {
      const result = operation === 'revoke'
        ? await api.delete<KeyResult>('/api/workspace/key')
        : await api.post<KeyResult>(operation === 'rotate' ? '/api/workspace/key/rotate' : '/api/onboarding/generate-key', {});
      setKeyState({uid: ownerUid, value: result.apiKey || ''});
      setConfirm(null);
      setMessage(operation === 'revoke' ? 'Workspace key revoked. Existing records remain available.' : result.apiKey ? 'Save this key now. It will not be returned again.' : 'A key already exists. Use your saved key or rotate it.');
      resource.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not update the workspace key.');
    } finally {setBusy(false);}
  };

  return <div className="space-y-6">
    {!compact && <PageTitle title="Connect pipeline" description="Send inquiries from your server or automation platform into your workspace." />}
    <section className={`${panel} space-y-4`}>
      <h2 className="font-semibold">Workspace API key</h2>
      <p className="text-sm leading-relaxed text-text-secondary">Keep this key in your server or automation tool. It identifies your workspace and does not change subscription access. Never embed it in public website code.</p>
      {resource.error && <Notice error>{resource.error}</Notice>}
      {resource.data?.active && <p className="break-all font-mono text-sm">Active key: {resource.data.keyPreview}</p>}
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={busy || resource.loading || !!resource.error} onClick={() => resource.data?.active ? setConfirm('rotate') : void manage('create')}>{busy ? 'Updating…' : resource.data?.active ? 'Rotate key' : 'Create key'}</button>
        {resource.data?.active && <button className={button} disabled={busy} onClick={() => setConfirm('revoke')}>Revoke key</button>}
      </div>
      {confirm && <div className="space-y-3 rounded-lg border border-border-strong bg-bg p-4">
        <p className="text-sm">{confirm === 'rotate' ? 'Rotating stops the existing key immediately. Update every server or automation that uses it with the new key.' : 'Revoking stops inquiry intake through this key. Existing inquiries stay readable.'}</p>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => void manage(confirm)}>Confirm {confirm === 'rotate' ? 'rotation' : 'revocation'}</button><button className={button} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>
      </div>}
      {key && <div className="space-y-3"><p className="text-xs text-text-secondary">One-time key. Store it securely before leaving this page.</p><code className="block select-all break-all rounded-lg border border-border bg-bg p-3 text-sm">{key}</code><button className={button} onClick={async () => {try {await navigator.clipboard.writeText(key); setMessage('Workspace key copied.');} catch {setError('Clipboard access failed. Select the key above and copy it manually.');}}}>Copy key</button></div>}
    </section>
    <section className={`${panel} space-y-4`}>
      <h2 className="font-semibold">Send an inquiry</h2><p className="break-all font-mono text-xs">{endpoint}</p>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-bg p-4 text-xs leading-relaxed"><code>{snippet}</code></pre>
      <p className="text-sm text-text-secondary">A successful response confirms the inquiry was stored. Classification runs in a background job. Reuse the same Idempotency-Key when retrying the same submission.</p>
      <p className="break-all text-xs text-text-secondary">Workspace webhook: {window.location.origin}/api/webhook/{user?.uid}</p>
    </section>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
  </div>;
}
