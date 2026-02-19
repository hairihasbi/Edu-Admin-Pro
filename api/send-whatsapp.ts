
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

  // Default URL for sending messages
  const baseUrl = config.baseUrl || 'https://scan.flowkirim.com/api/whatsapp/messages/text';
  let flowKirimSessionId = '';

  // --- STEP 1: SPECIFIC FLOWKIRIM PRE-CHECK (GET SESSION) ---
  if (config.provider === 'FLOWKIRIM') {
      try {
          // Construct Session URL: Extract origin (e.g., https://scan.flowkirim.com) and append session endpoint
          const urlObj = new URL(baseUrl);
          const host = urlObj.origin; 
          const sessionUrl = `${host}/api/whatsapp/sessions/${config.deviceId}`;

          console.log(`[FlowKirim] Fetching session from: ${sessionUrl}`);

          const sessionRes = await fetch(sessionUrl, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${config.apiKey}`,
                  'Content-Type': 'application/json'
              }
          });

          if (!sessionRes.ok) {
              const errText = await sessionRes.text();
              console.error(`[FlowKirim] Session Fetch Failed: ${sessionRes.status}`, errText);
              return res.status(500).json({ 
                  error: 'Gagal mengambil sesi WhatsApp aktif.', 
                  details: `FlowKirim Error: ${sessionRes.statusText}` 
              });
          }

          const sessionData = await sessionRes.json();
          // Try to extract ID from standard response formats (data.id or direct id)
          flowKirimSessionId = sessionData.data?.id || sessionData.id;

          if (!flowKirimSessionId) {
              return res.status(500).json({ error: 'Session ID tidak ditemukan pada respon Provider.' });
          }
          
          console.log(`[FlowKirim] Active Session ID: ${flowKirimSessionId}`);

      } catch (error: any) {
          console.error("FlowKirim Init Error:", error);
          return res.status(500).json({ 
              error: 'Gagal menghubungkan ke FlowKirim.', 
              details: error.message 
          });
      }
  }

  // --- STEP 2: BROADCAST LOOP ---
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
        let payload: any = {};

        // Construct Payload based on Provider
        if (config.provider === 'FLOWKIRIM') {
            // New FlowKirim Logic: Use session_id fetched above
            payload = {
                session_id: flowKirimSessionId, 
                to: `${phone}@s.whatsapp.net`, // Requires suffix
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

        if (response.ok) {
            const responseData = await response.json();
            // Check logical success flag inside JSON if available
            // FlowKirim usually returns success: true
            if (responseData.status === false || responseData.success === false) {
                 console.error(`WA API Logic Error for ${phone}:`, responseData);
                 failCount++;
                 errors.push(`${recipient.name}: ${responseData.message || 'Gagal mengirim (Logic Error)'}`);
            } else {
                 successCount++;
            }
        } else {
            // Handle non-200 responses (including HTML error pages from Laravel/Nginx)
            const text = await response.text();
            let errorDetails = `HTTP ${response.status}`;

            if (text.includes("<!DOCTYPE html>")) {
                // Try to grab title from HTML error
                const titleMatch = text.match(/<title>(.*?)<\/title>/i);
                if (titleMatch) {
                     errorDetails += ` - Server Error: ${titleMatch[1].trim()}`;
                } else {
                     errorDetails += " - Unknown HTML Error";
                }
            } else {
                try {
                    const jsonErr = JSON.parse(text);
                    errorDetails += ` - ${jsonErr.message || JSON.stringify(jsonErr)}`;
                } catch {
                    errorDetails += ` - ${text.substring(0, 50)}`;
                }
            }
            
            console.error(`WA Send Failed for ${phone}: ${errorDetails}`);
            failCount++;
            errors.push(`${recipient.name}: ${errorDetails}`);
        }
    } catch (e: any) {
        console.error(`WA Connection Error for ${phone}:`, e);
        failCount++;
        errors.push(`${recipient.name}: Connection Error (${e.message})`);
    }
    
    // Slight delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }

  return res.status(200).json({ success: successCount, failed: failCount, errors });
}
