
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
  const errors: string[] = [];

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
                 errors.push(`${recipient.name}: ${responseData.message || 'Unknown logic error'}`);
            } else {
                 successCount++;
            }
        } else {
            // Handle non-200 responses (including HTML error pages from Laravel/Nginx)
            const contentType = response.headers.get("content-type");
            let errorDetails = `HTTP ${response.status}`;

            if (contentType && contentType.includes("application/json")) {
                const jsonErr = await response.json();
                errorDetails += ` - ${JSON.stringify(jsonErr)}`;
            } else {
                const text = await response.text();
                if (text.includes("<!DOCTYPE html>")) {
                    const titleMatch = text.match(/<title>(.*?)<\/title>/i);
                    // Extract Laravel exception message if possible
                    const exceptionMatch = text.match(/class="exception-message[^>]*>(.*?)<\/span>/s) || text.match(/<h1 class="break-long-words exception-message">(.*?)<\/h1>/);
                    
                    if (exceptionMatch) {
                         errorDetails += ` - Server Error: ${exceptionMatch[1].trim()}`;
                    } else if (titleMatch) {
                         errorDetails += ` - HTML Error: ${titleMatch[1].trim()}`;
                    } else {
                         errorDetails += " - Unknown HTML Error";
                    }
                } else {
                    errorDetails += ` - ${text.substring(0, 100)}`;
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
    
    // Slight delay to be nice to the API
    await new Promise(r => setTimeout(r, 500));
  }

  return res.status(200).json({ success: successCount, failed: failCount, errors });
}
