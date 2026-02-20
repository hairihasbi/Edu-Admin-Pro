
// Service ini sekarang bertindak sebagai Proxy ke API Backend (/api/turso)
// Tidak ada lagi direct connection dari browser ke DB untuk keamanan token.

// Helper to get current User ID from LocalStorage
const getCurrentUserId = (): string | null => {
    try {
        const userStr = localStorage.getItem('eduadmin_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.id || null;
        }
    } catch {
        // Ignore JSON errors
    }
    return null;
};

// Helper to get Authorization Header
const getAuthHeader = () => {
    const userId = getCurrentUserId();
    return userId ? { 'Authorization': `Bearer ${userId}` } : {};
};

// --- NEW: Helper to safely parse API responses ---
const handleApiResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || `API Error: ${response.status}`);
        }
        return data;
    } else {
        // Handle non-JSON response (likely HTML error page or 404 fallback)
        const text = await response.text();
        if (text.trim().startsWith("<!DOCTYPE html>")) {
             // Try to parse title from HTML error
             const titleMatch = text.match(/<title>(.*?)<\/title>/i);
             const errorTitle = titleMatch ? titleMatch[1] : "Unknown Server Error";
             throw new Error(`Server Error (${response.status}): ${errorTitle}. Cek Koneksi / Vercel Logs.`);
        }
        throw new Error(`Server Error (${response.status}): ${text.substring(0, 100)}...`);
    }
};

const retryFetch = async (fn: () => Promise<any>, retries = 2, delayMs = 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return retryFetch(fn, retries - 1, delayMs);
        }
        throw error;
    }
};

export const initTurso = async () => {
  // Offline Guard
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  
  try {
    // Retry init logic to handle cold starts
    await retryFetch(async () => {
        const response = await fetch('/api/turso', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              ...getAuthHeader() // Add Auth
          } as HeadersInit,
          body: JSON.stringify({ 
              action: 'init',
              userId: getCurrentUserId()
          })
        });
        await handleApiResponse(response);
    });
    return true;
  } catch (e: any) {
    console.warn("Turso Init Warning (API):", e.message);
    return false;
  }
};

// NEW: Manual Initialize Trigger (Admin only)
// Now accepts optional credentials to override ENV vars
export const initializeDatabaseRemote = async (dbUrl?: string, dbToken?: string): Promise<{success: boolean, message: string}> => {
    try {
        const payload: any = { action: 'init' };
        if (dbUrl && dbToken) {
            payload.dbUrl = dbUrl;
            payload.dbToken = dbToken;
        }

        const response = await fetch('/api/turso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Public endpoint, no auth needed for init bootstrapping
            body: JSON.stringify(payload)
        });
        
        const data = await handleApiResponse(response);
        return { success: true, message: data.message || "Database berhasil diinisialisasi." };
    } catch (e: any) {
        return { success: false, message: e.message || "Gagal inisialisasi." };
    }
};

// NEW: Test Custom Connection Config
export const testConnectionConfig = async (dbUrl: string, dbToken: string): Promise<{success: boolean, message: string}> => {
    try {
        const response = await fetch('/api/turso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'check',
                dbUrl,
                dbToken
            })
        });
        
        const data = await handleApiResponse(response);
        return { success: true, message: "Koneksi Berhasil! URL & Token Valid." };
    } catch (e: any) {
        return { success: false, message: `Koneksi Gagal: ${e.message}` };
    }
};

// Push Local Data to Turso via API with Batching (Fix 504 Timeout)
export const pushToTurso = async (collection: string, items: any[], force: boolean = false) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error("OFFLINE: Cannot push to Turso");
  }

  // 1. Filter items needing sync
  const itemsToPush = force ? items : items.filter(item => !item.isSynced || !item.lastModified);
  
  if (itemsToPush.length === 0) return;

  // 2. Batching Logic (Chunk size 50 to prevent Vercel Timeout)
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < itemsToPush.length; i += BATCH_SIZE) {
      const batch = itemsToPush.slice(i, i + BATCH_SIZE);
      
      try {
          const response = await fetch('/api/turso', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeader() // Add Auth
            } as HeadersInit,
            body: JSON.stringify({ 
              action: 'push', 
              collection, 
              items: batch,
              force, 
              userId: getCurrentUserId()
            })
          });

          // Special Handling for Auth/Conflict before generic JSON parse
          if (response.status === 401 || response.status === 403) {
              throw new Error(`Unauthorized: ${response.statusText}`);
          }

          if (response.status === 409) {
              const data = await response.json();
              throw new Error(`CONFLICT:${data.itemId}`);
          }

          await handleApiResponse(response);
          
      } catch (error: any) {
          console.error(`Batch push failed for ${collection} (items ${i} to ${i + BATCH_SIZE}):`, error);
          throw error; // Re-throw to stop sync process and alert user
      }
  }
};

// Pull Remote Data from Turso via API
export const pullFromTurso = async (collection: string, localItems: any[]): Promise<{items: any[], hasChanges: boolean}> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { items: localItems, hasChanges: false };
  }

  try {
    // Wrap in retry to handle cold starts on pulls
    const data = await retryFetch(async () => {
        const response = await fetch('/api/turso', {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              ...getAuthHeader() // Add Auth
          } as HeadersInit,
          body: JSON.stringify({ 
              action: 'pull', 
              collection,
              userId: getCurrentUserId()
          })
        });
        if (!response.ok) throw new Error(response.statusText);
        return await handleApiResponse(response);
    }, 1, 500);

    const { rows } = data;
    
    if (!rows || !Array.isArray(rows)) {
        return { items: localItems, hasChanges: false };
    }

    const remoteMap = new Map();
    rows.forEach((row: any) => {
      remoteMap.set(row.id, {
        data: row.data,
        updated_at: row.updated_at,
        version: row.version || 1
      });
    });

    let hasChanges = false;
    const mergedItems = [...localItems];

    remoteMap.forEach((remote, id) => {
      const localIndex = mergedItems.findIndex(i => i.id === id);
      
      // CRITICAL FIX: Ensure ID is present in the object spread
      // Dexie requires the Primary Key field (id) to be present in the object being saved.
      const safeRemoteData = { ...remote.data, id: id, isSynced: true };

      if (localIndex === -1) {
        mergedItems.push(safeRemoteData);
        hasChanges = true;
      } else {
        const local = mergedItems[localIndex];
        const remoteVer = remote.version || 1;
        const localVer = local.version || 1;

        if (remoteVer > localVer) {
          mergedItems[localIndex] = safeRemoteData;
          hasChanges = true;
        } 
      }
    });

    return { items: mergedItems, hasChanges };
  } catch (e) {
    console.error(`Pull Error (${collection}):`, e);
    return { items: localItems, hasChanges: false };
  }
};

export const checkConnection = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    
    try {
        const response = await fetch('/api/turso', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeader() // Add Auth
            } as HeadersInit,
            body: JSON.stringify({ 
                action: 'check',
                userId: getCurrentUserId()
            })
        });
        
        await handleApiResponse(response);
        return true;
    } catch (e) {
        // Silent fail
        return false;
    }
};
