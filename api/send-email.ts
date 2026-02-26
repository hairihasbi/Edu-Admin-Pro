
// api/send-email.ts
// This file assumes a Node.js environment on Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

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
  const port = parseInt(String(config.smtpPort), 10); // Ensure port is a number
  
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: port,
    secure: port === 465, // true for 465, false for other ports
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { user, config } = req.body;

  if (!user || !config || !config.isActive) {
    return res.status(400).json({ error: 'Missing user data or email config is inactive' });
  }

  const subject = `Selamat! Akun Guru Anda Telah Disetujui`;
  
  // Professional HTML Template
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #2563eb; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">Selamat Datang di EduAdmin Pro</h2>
      </div>
      <div style="padding: 30px;">
        <p>Halo <strong>${user.fullName}</strong>,</p>
        <p>Selamat! Pendaftaran akun guru Anda di <strong>${user.schoolName}</strong> telah disetujui oleh Administrator.</p>
        <p>Anda sekarang dapat masuk ke aplikasi EduAdmin Pro menggunakan username dan password yang Anda buat saat pendaftaran.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${req.headers.origin || 'https://www.eduadmin.my.id'}/login" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Masuk ke Aplikasi</a>
        </div>
        
        <p style="font-size: 14px; color: #666;">Jika tombol di atas tidak berfungsi, silakan salin dan tempel tautan berikut ke browser Anda:</p>
        <p style="font-size: 14px; color: #2563eb;">${req.headers.origin || 'https://www.eduadmin.my.id'}/login</p>
      </div>
      <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #888;">
        <p>Email ini dikirim secara otomatis oleh sistem EduAdmin Pro.<br/>${config.fromName}</p>
      </div>
    </div>
  `;

  // Determine method:
  // 1. If config.method is 'API', use API.
  // 2. If config.method is 'SMTP', use SMTP.
  // 3. If config.method is undefined/null (legacy), check if apiKey exists -> API, else SMTP.
  
  let method = 'SMTP';
  if (config.method === 'API') {
      method = 'API';
  } else if (config.method === 'SMTP') {
      method = 'SMTP';
  } else if (config.apiKey) {
      method = 'API';
  }

  try {
    console.log(`Sending approval email to ${user.email} using ${method} (${method === 'API' ? config.provider : 'SMTP Host: ' + config.smtpHost})`);
    
    if (method === 'API') {
      if (!config.apiKey) throw new Error("API Key is missing for API method");

      if (config.provider === 'MAILERSEND') {
        await sendMailerSend(config, user.email, subject, html);
      } else if (config.provider === 'BREVO') {
        await sendBrevo(config, user.email, subject, html);
      } else {
        throw new Error(`Unknown or Missing API Provider: ${config.provider}`);
      }
    } else {
      // SMTP Logic
      if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
          throw new Error("SMTP Configuration incomplete (Host, User, or Pass missing)");
      }
      await sendSMTP(config, user.email, subject, html);
    }
    
    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email Sending Error:', error);
    // Return the specific error message to the frontend for debugging
    return res.status(500).json({ error: `Email Failed: ${error.message}` });
  }
}
