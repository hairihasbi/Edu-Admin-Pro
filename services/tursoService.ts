
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
    // 1. Intercept 401 (Unauthorized) - Session Expired / User Deleted
    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            // Dispatch event for App.tsx to handle logout
            window.dispatchEvent(new CustomEvent('auth-error'));
        }
        throw new Error("Sesi kadaluarsa atau tidak valid. Silakan login ulang.");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
            // Include details if available
            const details = data.details ? ` (${typeof data.details === 'object' ? JSON.stringify(data.details) : data.details})` : '';
            throw new Error((data.error || data.message || `API Error: ${response.status}`) + details);
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

  // 2. Batching Logic (Chunk size 10 to prevent Vercel Timeout)
  // Vercel serverless functions have a default timeout (e.g., 10s or 60s).
  // Large batches with sequential DB writes in the backend can exceed this.
  const BATCH_SIZE = 10;
  
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
          // Note: 401 is now handled inside handleApiResponse, but specific conflict 409 logic remains here if needed before parse
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
        // 401 handled inside handleApiResponse
        if (!response.ok && response.status !== 401) throw new Error(response.statusText);
        return await handleApiResponse(response);
    }, 1, 500);

    const { rows } = data;
    
    // DEBUG LOG
    if (rows && rows.length > 0) {
        console.log(`[Turso] Pulled ${rows.length} items for ${collection}`);
    }

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
      // FIX: Ensure ID is strictly a string to prevent type mismatch during findIndex
      const safeId = String(id);
      
      const localIndex = mergedItems.findIndex(i => String(i.id) === safeId);
      
      // FIX 1: Handle Deletion
      // If remote has deleted flag, remove it locally
      if (remote.data.deleted) {
          if (localIndex !== -1) {
              // Item exists locally, remove it
              mergedItems.splice(localIndex, 1);
              hasChanges = true;
          }
          return; // Skip adding
      }

      // CRITICAL FIX 2: Ensure ID is present in the object spread
      const safeRemoteData = { ...remote.data, id: safeId, isSynced: true };

      if (localIndex === -1) {
        // Item new (remote only)
        mergedItems.push(safeRemoteData);
        hasChanges = true;
      } else {
        // Item exists locally, check version OR timestamp
        const local = mergedItems[localIndex];
        const remoteVer = remote.version || 1;
        const localVer = local.version || 1;
        
        // FIX 3: Timestamp based conflict resolution
        // If versions are equal, but remote timestamp is NEWER, trust remote.
        // This solves "stuck version" issues where edits happen but version didn't increment.
        const remoteTime = remote.updated_at || 0;
        const localTime = local.lastModified || 0;

        if (remoteVer > localVer || (remoteVer === localVer && remoteTime > localTime)) {
          mergedItems[localIndex] = safeRemoteData;
          hasChanges = true;
        } 
      }
    });

    return { items: mergedItems, hasChanges };
  } catch (e) {
    console.error(`Pull Error (${collection}):`, e);
    // Don't swallow auth errors if possible, but keep app stable
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
