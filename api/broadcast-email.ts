
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { EmailBroadcastSchema } from './_schemas.js';

// --- HELPER FUNCTIONS (Isolated Scope) ---

// Helper for MailerSend API
export async function sendMailerSend(config: any, to: string, subject: string, html: string) {
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
    let errorMessage = errorText;
    try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
    } catch (e) {
        // Keep original text if not JSON
    }
    throw new Error(`MailerSend Error: ${errorMessage}`);
  }
  return true;
}

// Helper for Brevo API (SMTP API)
export async function sendBrevo(config: any, to: string, subject: string, html: string) {
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
    let errorMessage = errorText;
    try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
            errorMessage = errorJson.message;
            if (errorMessage.includes('unrecognised IP address')) {
                errorMessage = `IP Address server (${errorMessage.match(/\d+\.\d+\.\d+\.\d+/)?.[0] || 'ini'}) belum diizinkan di Brevo. Silakan nonaktifkan 'Authorized IPs' atau tambahkan IP tersebut di dashboard Brevo (Security > Authorized IPs).`;
            }
        }
    } catch (e) {
        // Keep original text if not JSON
    }
    throw new Error(`Brevo Error: ${errorMessage}`);
  }
  return true;
}

// Helper for SMTP (Nodemailer)
export async function sendSMTP(config: any, to: string, subject: string, html: string) {
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

  const { config, recipients, subject, content, type, userData, paymentData, resetData } = parseResult.data;

  if (!config.isActive) {
      return res.status(400).json({ error: 'Konfigurasi Email tidak aktif.' });
  }

  let finalSubject = subject;
  let finalContent = content;

  // --- LOGIC KHUSUS BERDASARKAN TIPE ---
  if (type === 'USER_APPROVAL') {
    if (!userData) {
      return res.status(400).json({ error: 'Data user tidak ditemukan untuk tipe USER_APPROVAL' });
    }
    // Override subject & content for specific notification
    finalSubject = `Selamat Datang di EduAdmin Pro - Akun Anda Telah Aktif`;
    finalContent = `
      <h2>Halo ${userData.fullName},</h2>
      <p>Selamat! Akun Anda telah disetujui oleh Administrator.</p>
      <p>Berikut adalah detail login Anda:</p>
      <table style="background: #f4f4f4; padding: 15px; border-radius: 5px; width: 100%;">
        <tr>
          <td style="width: 100px; font-weight: bold;">Username:</td>
          <td>${userData.username}</td>
        </tr>
        ${userData.password ? `
        <tr>
          <td style="font-weight: bold;">Password:</td>
          <td>${userData.password}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="font-weight: bold;">Login URL:</td>
          <td><a href="${userData.loginUrl}">${userData.loginUrl}</a></td>
        </tr>
      </table>
      <p>Harap segera mengganti password Anda setelah login pertama kali.</p>
    `;
  } else if (type === 'PAYMENT_RECEIPT') {
    if (!paymentData) {
      return res.status(400).json({ error: 'Data pembayaran tidak ditemukan untuk tipe PAYMENT_RECEIPT' });
    }
    finalSubject = `Bukti Pembayaran Donasi - ${paymentData.invoiceNumber}`;
    finalContent = `
      <h2>Terima Kasih atas Donasi Anda!</h2>
      <p>Pembayaran Anda telah kami terima dengan detail sebagai berikut:</p>
      <table style="background: #f4f4f4; padding: 15px; border-radius: 5px; width: 100%;">
        <tr>
          <td style="width: 120px; font-weight: bold;">No. Invoice:</td>
          <td>${paymentData.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Tanggal:</td>
          <td>${paymentData.paymentDate}</td>
        </tr>
        <tr>
          <td style="font-weight: bold;">Jumlah:</td>
          <td>Rp ${paymentData.amount.toLocaleString('id-ID')}</td>
        </tr>
        ${paymentData.paymentMethod ? `
        <tr>
          <td style="font-weight: bold;">Metode:</td>
          <td>${paymentData.paymentMethod}</td>
        </tr>
        ` : ''}
      </table>
      <p>Dukungan Anda sangat berarti bagi pengembangan aplikasi ini.</p>
    `;
  } else if (type === 'RESET_PASSWORD') {
    if (!resetData) {
      return res.status(400).json({ error: 'Data reset tidak ditemukan untuk tipe RESET_PASSWORD' });
    }
    finalSubject = `Permintaan Reset Password - EduAdmin Pro`;
    finalContent = `
      <h2>Reset Password</h2>
      <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
      <p>Silakan klik tombol di bawah ini untuk membuat password baru:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetData.resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </div>
      <p>Link ini akan kedaluwarsa pada: ${resetData.expiryTime}</p>
      <p style="font-size: 12px; color: #666;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `;
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  // Iterate recipients (Sequential to avoid rate limits on free tiers)
  for (const recipient of recipients) {
      // Basic personalization (Only applies if content is not overridden by specific types, or if we want to support {{name}} in templates too)
      // For specific types, we already constructed the HTML, but we can still replace {{name}} if it exists in the template (though we used userData.fullName above)
      
      let personalizedHtml = finalContent;
      
      // Only do replacement if it's a BROADCAST or if the template uses it
      if (type === 'BROADCAST') {
         personalizedHtml = finalContent
          .replace(/{{name}}/g, recipient.name)
          .replace(/\n/g, '<br/>');
      }

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
                  await sendMailerSend(config, recipient.email, finalSubject, finalHtml);
              } else if (config.provider === 'BREVO') {
                  await sendBrevo(config, recipient.email, finalSubject, finalHtml);
              }
          } else {
              await sendSMTP(config, recipient.email, finalSubject, finalHtml);
          }
          successCount++;
      } catch (error: any) {
          console.error(`Email fail for ${recipient.email}:`, error);
          failCount++;
          // Enhance error message for MailerSend limit
          let msg = error.message;
          if (msg.includes('trial account unique recipients limit')) {
             msg += ' (Solusi: Upgrade akun MailerSend Anda atau gunakan SMTP/Provider lain)';
          }
          errors.push(`${recipient.email}: ${msg}`);
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
