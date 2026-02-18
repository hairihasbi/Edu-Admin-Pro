
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { WhatsAppBroadcastSchema } from './_schemas.js'; // Import Validation

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- VALIDATION LAYER (ZOD) ---
  const parseResult = WhatsAppBroadcastSchema.safeParse(req.body);
  if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid Request Format', details: parseResult.error.format() });
  }

  const { config, recipients, message } = parseResult.data;

  let successCount = 0;
  let failCount = 0;

  // Default URL: https://scan.flowkirim.com/api/whatsapp/messages/text
  const baseUrl = config.baseUrl || 'https://scan.flowkirim.com/api/whatsapp/messages/text';

  // Iterate sequentially to avoid rate limiting
  for (const recipient of recipients) {
    if (!recipient.phone) {
        failCount++;
        continue;
    }

    // Replace variables in template
    const personalizedMessage = message.replace('{{name}}', recipient.name);

    // Sanitize phone number (Ensure it starts with 62, remove + or 0)
    let phone = recipient.phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    if (!phone.startsWith('62')) phone = '62' + phone;

    try {
        let payload: any = {};

        // Construct Payload based on Provider
        if (config.provider === 'FLOWKIRIM') {
            // FlowKirim Specific Format
            payload = {
                device_id: config.deviceId, 
                to: `${phone}@s.whatsapp.net`, // Requires @s.whatsapp.net suffix
                message: personalizedMessage
            };
        } else {
            // Generic / Fonnte Fallback
            payload = {
                target: phone,
                to: phone,
                phone: phone,
                message: personalizedMessage,
                text: personalizedMessage,
                device_id: config.deviceId
            };
        }

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        // FlowKirim returns 200 OK with success: true inside body usually, 
        // but fetch.ok checks 200-299 status code.
        if (response.ok) {
            const responseData = await response.json();
            // Check specific provider success flag if needed
            if (config.provider === 'FLOWKIRIM' && responseData.success === false) {
                 console.error(`WA API Logic Error for ${phone}:`, responseData);
                 failCount++;
            } else {
                 successCount++;
            }
        } else {
            console.error(`WA Send Failed for ${phone}:`, await response.text());
            failCount++;
        }
    } catch (e) {
        console.error(`WA Connection Error for ${phone}:`, e);
        failCount++;
    }
    
    // Slight delay to be nice to the API
    await new Promise(r => setTimeout(r, 500));
  }

  return res.status(200).json({ success: successCount, failed: failCount });
}
