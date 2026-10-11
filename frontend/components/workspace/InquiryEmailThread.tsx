import {button, Notice, useResource} from './ui';

interface Sent {id: string; subject: string; state: string; sentAt: number | null}
interface Received {provider_email_id: string; sender: string; subject: string; body: string; created_at: string}

export function InquiryEmailThread({id}: {id: string}) {
  const resource = useResource<{emails: Sent[]; received: Received[]}>(`/api/workspace/inquiries/${encodeURIComponent(id)}/emails`);
  return <section className="space-y-3 border-t border-border pt-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Email conversation</h3><button className={button} onClick={resource.refresh}>Refresh</button></div>
    {resource.error && <Notice error>{resource.error}</Notice>}
    {!resource.data?.emails.length && !resource.data?.received.length && <p className="text-sm text-text-secondary">No email activity recorded for this inquiry.</p>}
    <ul className="space-y-3">{resource.data?.received.map(item => <li key={item.provider_email_id} className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">Reply from {item.sender}</p><p className="text-text-secondary">{item.subject} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.body}</p></li>)}
      {resource.data?.emails.map(item => <li key={item.id} className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">Sent: {item.subject}</p><p className="text-text-secondary">{item.state} · {item.sentAt ? new Date(item.sentAt).toLocaleString() : 'Not sent'}</p></li>)}</ul>
  </section>;
}
