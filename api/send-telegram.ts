
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { chatId, message } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ error: 'Missing chatId or message' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown', // Optional: Allows bold/italic text
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Telegram API Error:', data);
      return res.status(500).json({ error: 'Failed to send Telegram message', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Telegram Fetch Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
