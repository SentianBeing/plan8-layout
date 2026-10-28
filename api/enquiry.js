/**
 * Vercel Serverless Function: Enquiry Handler
 * Endpoint: POST /api/enquiry
 *
 * Receives customer leads, validates them, logs to Vercel logs,
 * and optionally forwards them to a Webhook (Slack, Discord, Zapier, Make, n8n, Google Sheets).
 */
export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { plot, name, phone, message, project, page } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Your name is required.' });
    }

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid phone number with at least 10 digits.' });
    }

    const lead = {
      project: project || 'Plan-8 Layout',
      plot: plot ? Number(plot) : null,
      name: name.trim(),
      phone: String(phone).trim(),
      message: message ? String(message).trim() : '',
      page: page || '',
      receivedAt: new Date().toISOString()
    };

    console.log('[NEW LEAD RECEIVED]', JSON.stringify(lead, null, 2));

    // Optional Webhook notification (e.g. Slack, Discord, Zapier, Telegram, Google Sheets)
    // To enable, configure WEBHOOK_URL in your Vercel Project Settings > Environment Variables
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🏡 *New Lead for ${lead.project}*\n*Name:* ${lead.name}\n*Phone:* ${lead.phone}\n*Plot:* ${lead.plot ? `#${lead.plot}` : 'General Enquiry'}\n*Message:* ${lead.message || 'None'}\n*Time:* ${lead.receivedAt}`,
            ...lead
          })
        });
      } catch (webhookErr) {
        console.error('[WEBHOOK NOTIFICATION FAILED]', webhookErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Enquiry received successfully',
      data: {
        name: lead.name,
        plot: lead.plot,
        receivedAt: lead.receivedAt
      }
    });
  } catch (err) {
    console.error('[API ENQUIRY ERROR]', err);
    return res.status(500).json({ error: 'Internal server error while processing your enquiry.' });
  }
}
