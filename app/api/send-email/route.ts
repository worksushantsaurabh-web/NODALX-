import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY environment variable is not configured.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Request body must be a JSON object.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { to, subject, message, html } = body;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipientList: string[] = Array.isArray(to) ? to : (typeof to === 'string' ? [to] : []);

    if (recipientList.length === 0 || recipientList.some(email => typeof email !== 'string' || !emailPattern.test(email.trim()))) {
      return new Response(
        JSON.stringify({ success: false, error: 'A valid "to" email address is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'A non-empty "subject" is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const content = message || html;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'A non-empty "message" or "html" body is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: 'NodalX Support <support@nodalx.in>',
      to: recipientList.map(email => email.trim()),
      subject: subject.trim(),
      text: message ? String(message).trim() : undefined,
      html: html ? String(html).trim() : (message ? `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.5;">${String(message).trim()}</div>` : undefined),
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Email delivery failed.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
