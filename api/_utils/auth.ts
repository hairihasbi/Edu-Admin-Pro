
import type { VercelRequest } from '@vercel/node';
import { createClient } from "@libsql/client/web";

export interface AuthResult {
  userId: string;
  role: string;
  username: string;
}

const cleanEnv = (val: string | undefined) => {
    if (!val) return "";
    return val.replace(/^["']|["']$/g, '').trim();
};

export async function authorize(req: VercelRequest, allowedRoles: string[] = []): Promise<AuthResult> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing or Invalid Authorization Header' };
  }

  const userId = authHeader.split(' ')[1];
  if (!userId) {
    throw { status: 401, message: 'Token not found' };
  }

  let rawUrl = cleanEnv(process.env.TURSO_DB_URL);
  const authToken = cleanEnv(process.env.TURSO_AUTH_TOKEN);

  if (rawUrl && rawUrl.startsWith('libsql://')) {
      rawUrl = rawUrl.replace('libsql://', 'https://');
  }

  if (!rawUrl || !authToken) {
    throw { status: 500, message: 'Database configuration missing' };
  }

  // Inject fetch for Vercel environment
  const client = createClient({ 
      url: rawUrl, 
      authToken: authToken,
      // @ts-ignore
      fetch: fetch 
  });

  try {
    const result = await client.execute({
      sql: "SELECT id, username, role, status FROM users WHERE id = ?",
      args: [userId]
    });

    if (result.rows.length === 0) {
      throw { status: 401, message: 'User not found or invalid token' };
    }

    const user = result.rows[0];

    if (user.status !== 'ACTIVE') {
      throw { status: 403, message: 'Account is not active' };
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as string)) {
      throw { status: 403, message: `Access denied. Required role: ${allowedRoles.join(', ')}` };
    }

    return {
      userId: user.id as string,
      role: user.role as string,
      username: user.username as string
    };

  } catch (e: any) {
    if (e.status) throw e;
    console.error("Auth Middleware Error:", e);
    throw { status: 500, message: 'Internal Server Error during Authentication' };
  } finally {
    client.close();
  }
}
