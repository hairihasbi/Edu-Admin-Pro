
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

  // FlowKirim Session Handling
  let flowKirimSessionId = '';
  if (config.provider === 'FLOWKIRIM') {
      try {
          const urlObj = new URL(config.baseUrl || 'https://scan.flowkirim.com');
          const host = urlObj.origin; 
          const sessionUrl = `${host}/api/whatsapp/sessions/${config.deviceId}`;

          const sessionRes = await fetch(sessionUrl, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${config.apiKey}`,
                  'Content-Type': 'application/json'
              }
          });

          if (sessionRes.ok) {
              const sessionData = await sessionRes.json();
              flowKirimSessionId = sessionData.data?.id || sessionData.id;
          }
      } catch (error) {
          console.error("FlowKirim Init Error:", error);
      }
  }

  // --- BROADCAST LOOP ---
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

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
        let fetchUrl = config.baseUrl;
        let headers: any = {
            'Content-Type': 'application/json'
        };
        let bodyPayload: any = {};

        // --- PROVIDER SPECIFIC LOGIC ---
        if (config.provider === 'FONNTE') {
            // FONNTE Logic
            // URL: https://api.fonnte.com/send
            // Header: Authorization: TOKEN
            fetchUrl = config.baseUrl || 'https://api.fonnte.com/send';
            headers['Authorization'] = config.apiKey; // Fonnte uses Authorization header directly
            bodyPayload = {
                target: phone,
                message: personalizedMessage,
                countryCode: '62' // Optional but good practice
            };
        } else if (config.provider === 'FLOWKIRIM') {
            // FLOWKIRIM Logic
            headers['Authorization'] = `Bearer ${config.apiKey}`;
            bodyPayload = {
                session_id: flowKirimSessionId, 
                to: `${phone}@s.whatsapp.net`, 
                message: personalizedMessage
            };
        } else {
            // GENERIC Logic
            headers['Authorization'] = `Bearer ${config.apiKey}`;
            bodyPayload = {
                target: phone,
                phone: phone,
                message: personalizedMessage,
                text: personalizedMessage
            };
        }

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyPayload)
        });

        const responseText = await response.text();
        
        if (response.ok) {
            // Parse JSON safely
            try {
                const responseData = JSON.parse(responseText);
                // Fonnte returns { status: true/false, detail: ... }
                if (config.provider === 'FONNTE' && responseData.status === false) {
                     console.error(`Fonnte Logic Error for ${phone}:`, responseData);
                     failCount++;
                     errors.push(`${recipient.name}: ${responseData.reason || 'Fonnte Error'}`);
                } else {
                     successCount++;
                }
            } catch {
                // If text response but OK status, assume success
                successCount++;
            }
        } else {
            // Handle HTTP Errors
            console.error(`WA Send Failed for ${phone}: ${response.status} - ${responseText}`);
            failCount++;
            errors.push(`${recipient.name}: HTTP ${response.status}`);
        }
    } catch (e: any) {
        console.error(`WA Connection Error for ${phone}:`, e);
        failCount++;
        errors.push(`${recipient.name}: Connection Error`);
    }
    
    // Slight delay to be polite to the API (especially free tier)
    await new Promise(r => setTimeout(r, 1000));
  }

  return res.status(200).json({ success: successCount, failed: failCount, errors });
}
