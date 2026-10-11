import {useState} from 'react';
import {api} from '../../src/services/api';
import {button, input, panel, Notice, useResource} from './ui';

interface Identity {address: string | null; alias: string | null; displayName: string; receivingActive: boolean}
interface Received {provider_email_id: string; inquiry_id: string | null; sender: string; subject: string; body: string; created_at: string}

export function WorkspaceEmailIdentity() {
  const identity = useResource<Identity>('/api/workspace/email-identity');
  const inbox = useResource<{messages: Received[]}>('/api/workspace/inbox');
  const [editing, setEditing] = useState(false);
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/api/workspace/email-identity/change', {alias, confirmed: true});
      identity.refresh(); setEditing(false); setMessage('Workspace address changed. The old address still receives replies to earlier conversations.');
    } catch (problem) {setError(problem instanceof Error ? problem.message : 'Address change failed.');}
    finally {setBusy(false);}
  };
  return <div className="space-y-5">
    <section className={`${panel} space-y-3`}>
      <h2 className="font-semibold">Workspace email address</h2>
      {identity.error && <Notice error>{identity.error}</Notice>}
      {identity.data && <>
        <p className="text-sm text-text-primary">{identity.data.displayName} &lt;{identity.data.address}&gt;</p>
        <p className="text-sm text-text-secondary">{identity.data.receivingActive
          ? 'Replies to this address appear in your NodalX inbox below.'
          : 'This address is reserved for your workspace. Email sending from it will be available after receiving is verified.'}</p>
        <p className="text-xs text-text-secondary">You can keep using NodalX without setting up an email provider. If your business owns a custom domain, sending from your own domain may be offered later after domain verification. Your current workspace address remains available in the meantime.</p>
        {!editing ? <button className={button} onClick={() => {setAlias(identity.data?.alias || ''); setEditing(true);}}>Change address</button> :
          <div className="space-y-3 border-t border-border pt-3">
            <label htmlFor="workspace-email-alias" className="block text-sm">New address name</label>
            <div className="flex flex-wrap items-center gap-2"><input id="workspace-email-alias" className={input} value={alias} maxLength={30} onChange={event => setAlias(event.target.value.toLowerCase())} /><span className="text-sm text-text-secondary">@reply.nodalx.in</span></div>
            <p className="text-sm text-text-secondary">Leads who received mail at the old address can still reply there. Older conversations will not move to the new address. You can change this once every 24 hours.</p>
            <div className="flex gap-2"><button className={button} disabled={busy} onClick={change}>{busy ? 'Saving…' : 'Confirm address change'}</button><button className={button} disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
          </div>}
      </>}
      {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    </section>
    <section className={`${panel} space-y-3`}>
      <div className="flex items-center justify-between"><h2 className="font-semibold">Received replies</h2><button className={button} onClick={inbox.refresh}>Refresh</button></div>
      {inbox.error && <Notice error>{inbox.error}</Notice>}
      {!inbox.data?.messages.length && <p className="text-sm text-text-secondary">No received replies yet.</p>}
      <ul className="divide-y divide-border">{inbox.data?.messages.map(item => <li key={item.provider_email_id} className="space-y-1 py-3 text-sm"><p className="font-medium">{item.subject || '(No subject)'}</p><p className="text-text-secondary">From {item.sender} · {new Date(item.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap break-words text-text-primary">{item.body}</p>{item.inquiry_id && <p className="text-xs text-text-secondary">Matched to inquiry {item.inquiry_id}</p>}</li>)}</ul>
    </section>
  </div>;
}
