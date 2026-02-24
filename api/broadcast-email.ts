
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { EmailBroadcastSchema } from './_schemas.js';

// --- HELPER FUNCTIONS (Isolated Scope) ---

// Helper for MailerSend API
async function sendMailerSend(config: any, to: string, subject: string, html: string) {
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      from: { email: config.fromEmail, name: config.fromName },
      to: [{ email: to }],
      subject: subject,
      html: html
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MailerSend Error: ${errorText}`);
  }
  return true;
}

// Helper for Brevo API (SMTP API)
async function sendBrevo(config: any, to: string, subject: string, html: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey
    },
    body: JSON.stringify({
      sender: { email: config.fromEmail, name: config.fromName },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo Error: ${errorText}`);
  }
  return true;
}

// Helper for SMTP (Nodemailer)
async function sendSMTP(config: any, to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, 
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: to,
    subject: subject,
    html: html,
  });
  return true;
}

// --- MAIN HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Validate Payload
  const parseResult = EmailBroadcastSchema.safeParse(req.body);
  if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid Request Format', details: parseResult.error.format() });
  }

  const { config, recipients, subject, content } = parseResult.data;

  if (!config.isActive) {
      return res.status(400).json({ error: 'Konfigurasi Email tidak aktif.' });
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  // Iterate recipients (Sequential to avoid rate limits on free tiers)
  for (const recipient of recipients) {
      // Basic personalization
      const personalizedHtml = content
        .replace(/{{name}}/g, recipient.name)
        .replace(/\n/g, '<br/>'); // Convert newlines to BR for basic HTML support

      // Wrapper HTML for professional look
      const finalHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${personalizedHtml}
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">
                Email ini dikirim melalui sistem EduAdmin Pro.<br/>
                ${config.fromName}
            </p>
        </div>
      `;

      try {
          if (config.method === 'API') {
              if (config.provider === 'MAILERSEND') {
                  await sendMailerSend(config, recipient.email, subject, finalHtml);
              } else if (config.provider === 'BREVO') {
                  await sendBrevo(config, recipient.email, subject, finalHtml);
              }
          } else {
              await sendSMTP(config, recipient.email, subject, finalHtml);
          }
          successCount++;
      } catch (error: any) {
          console.error(`Email fail for ${recipient.email}:`, error);
          failCount++;
          errors.push(`${recipient.email}: ${error.message}`);
      }

      // Small delay to be polite to SMTP servers
      await new Promise(r => setTimeout(r, 500));
  }

  // If ALL failed
  if (failCount > 0 && successCount === 0) {
      return res.status(500).json({ 
          success: 0, 
          failed: failCount, 
          errors: errors,
          error: errors[0] // Return first error
      });
  }

  return res.status(200).json({ 
      success: successCount, 
      failed: failCount, 
      errors 
  });
}
