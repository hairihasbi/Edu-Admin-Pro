
// services/telegramService.ts

const ADMIN_CHAT_ID = import.meta.env.VITE_TELEGRAM_ADMIN_CHAT_ID;

export const sendTelegramMessage = async (chatId: string, message: string) => {
    try {
        const response = await fetch('/api/send-telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatId, message }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to send Telegram message:', errorData);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error sending Telegram message:', error);
        return false;
    }
};

export const notifyAdminNewRegistration = async (teacherName: string, schoolName: string) => {
    const message = `🔔 *Pendaftaran Guru Baru*\n\n👤 Nama: ${teacherName}\n🏫 Sekolah: ${schoolName}\n\nMohon segera verifikasi di menu Manajemen Guru.`;
    return await sendTelegramMessage(ADMIN_CHAT_ID, message);
};
