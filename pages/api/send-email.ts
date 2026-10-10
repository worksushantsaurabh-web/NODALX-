import { Resend } from 'resend';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Please use POST.',
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'RESEND_API_KEY environment variable is not configured.',
    });
  }

  try {
    const { to, subject, message, html } = req.body || {};

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipientList: string[] = Array.isArray(to) ? to : (typeof to === 'string' ? [to] : []);

    if (recipientList.length === 0 || recipientList.some(email => typeof email !== 'string' || !emailPattern.test(email.trim()))) {
      return res.status(400).json({
        success: false,
        error: 'A valid "to" email address is required.',
      });
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty "subject" is required.',
      });
    }

    const content = message || html;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty "message" or "html" body is required.',
      });
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
      return res.status(502).json({
        success: false,
        error: error.message || 'Email delivery failed.',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
}
