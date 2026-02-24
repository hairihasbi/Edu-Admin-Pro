
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { WhatsAppBroadcastSchema } from './_schemas.js'; // Import Validation

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- VALIDATION LAYER (ZOD) ---
  const parseResult = WhatsAppBroadcastSchema.safeParse(req.body);
  if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid Request Format (Zod)', details: parseResult.error.format() });
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
          } else {
              const errText = await sessionRes.text();
              return res.status(400).json({ error: `Gagal inisialisasi FlowKirim: ${sessionRes.statusText}. Detail: ${errText.substring(0, 100)}` });
          }
      } catch (error: any) {
          console.error("FlowKirim Init Error:", error);
          return res.status(500).json({ error: `Koneksi FlowKirim Error: ${error.message}` });
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
                // Fonnte returns { status: true/false, detail: ... } or { status: true, ... }
                if (config.provider === 'FONNTE') {
                    if (responseData.status === false) {
                        console.error(`Fonnte Logic Error for ${phone}:`, responseData);
                        failCount++;
                        // Capture reason from Fonnte (usually 'reason' or 'detail')
                        const reason = responseData.reason || responseData.detail || 'Fonnte menolak request';
                        errors.push(`${recipient.name}: ${reason}`);
                    } else {
                        successCount++;
                    }
                } else {
                     // Assume success for other providers if HTTP 200
                     successCount++;
                }
            } catch {
                // If text response but OK status, assume success
                successCount++;
            }
        } else {
            // Handle HTTP Errors (Non-200)
            console.error(`WA Send Failed for ${phone}: ${response.status} - ${responseText}`);
            failCount++;
            // Try to extract readable error from HTML/Text response
            let errorDetail = responseText.substring(0, 150); // Limit length
            if (errorDetail.includes("<!DOCTYPE html>")) errorDetail = "Halaman Error HTML (Cek URL)";
            
            errors.push(`${recipient.name}: HTTP ${response.status} - ${errorDetail}`);
        }
    } catch (e: any) {
        console.error(`WA Connection Error for ${phone}:`, e);
        failCount++;
        errors.push(`${recipient.name}: Network/Fetch Error (${e.message})`);
    }
    
    // Slight delay to be polite to the API (especially free tier)
    await new Promise(r => setTimeout(r, 1000));
  }

  // If ALL failed, return 400 or 500 to trigger 'status: error' on frontend
  // This allows the frontend to show the first error message clearly
  if (failCount > 0 && successCount === 0) {
      return res.status(500).json({ 
          success: 0, 
          failed: failCount, 
          errors: errors,
          error: errors[0] // Return first error as main error message
      });
  }

  return res.status(200).json({ success: successCount, failed: failCount, errors });
}
