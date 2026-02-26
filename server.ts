import express from 'express';
import { createServer as createViteServer } from 'vite';
// @ts-ignore
import tursoHandler from './api/turso';
// @ts-ignore
import dokuHandler from './api/doku';
// @ts-ignore
import sendEmailHandler from './api/send-email';

async function startServer() {
    const app = express();
    const PORT = 3000;

    // Middleware to parse JSON bodies
    app.use(express.json());

    // API Routes
    app.all('/api/turso', async (req, res) => {
        try {
            await tursoHandler(req as any, res as any);
        } catch (e) {
            console.error("Turso Handler Error:", e);
            if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.all('/api/doku', async (req, res) => {
        try {
            await dokuHandler(req as any, res as any);
        } catch (e) {
            console.error("DOKU Handler Error:", e);
            if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.all('/api/send-email', async (req, res) => {
        try {
            await sendEmailHandler(req as any, res as any);
        } catch (e) {
            console.error("Send Email Handler Error:", e);
            if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // Vite Middleware for Development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static('dist'));
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
