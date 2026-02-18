
const CACHE_NAME = 'eduadmin-pro-v6'; // Bump version
const OFFLINE_URL = '/index.html';

// Assets that must be cached immediately
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.json'
];

// Map Dexie Table Names to API Collection Names
const TABLE_MAPPING = {
  'users': 'eduadmin_users',
  'classes': 'eduadmin_classes',
  'students': 'eduadmin_students',
  'attendanceRecords': 'eduadmin_attendance',
  'scopeMaterials': 'eduadmin_materials',
  'assessmentScores': 'eduadmin_scores',
  'teachingJournals': 'eduadmin_journals',
  'teachingSchedules': 'eduadmin_schedules',
  'logs': 'eduadmin_logs',
  'emailConfig': 'eduadmin_email_config',
  'masterSubjects': 'eduadmin_master_subjects',
  'tickets': 'eduadmin_tickets',
  'violations': 'eduadmin_bk_violations',
  'achievements': 'eduadmin_bk_achievements',
  'counselingSessions': 'eduadmin_bk_counseling',
  'whatsappConfigs': 'eduadmin_wa_configs',
  'notifications': 'eduadmin_notifications',
  'systemSettings': 'eduadmin_system_settings'
};

// Install Event: Cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests & Non-GET requests -> Network Only
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  // 2. Navigation Requests (HTML) -> Stale-While-Revalidate
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts) -> Cache First
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          // Cache the new asset if valid
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }
});

// --- BACKGROUND SYNC IMPLEMENTATION ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Sync event triggered: sync-data');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // 1. Open IndexedDB directly
    const db = await openDatabase('EduAdminDB');
    if (!db) return;

    // 2. Iterate all mapped tables
    const tableNames = Object.keys(TABLE_MAPPING);
    
    for (const tableName of tableNames) {
      const collectionName = TABLE_MAPPING[tableName];
      const unsyncedItems = await getUnsyncedItems(db, tableName);

      if (unsyncedItems.length > 0) {
        console.log(`[SW] Syncing ${unsyncedItems.length} items for table ${tableName}`);
        
        // 3. Push to API
        try {
          const response = await fetch('/api/turso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'push', 
              collection: collectionName, 
              items: unsyncedItems,
              force: false 
            })
          });

          if (response.ok) {
            // 4. Update items as synced in IDB
            await markItemsAsSynced(db, tableName, unsyncedItems);
            console.log(`[SW] Synced ${tableName} successfully.`);
          } else {
            console.warn(`[SW] Failed to sync ${tableName}: ${response.statusText}`);
          }
        } catch (err) {
          console.error(`[SW] API Error syncing ${tableName}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background Sync Error:', error);
  }
}

// --- IDB HELPERS (Raw IDB API) ---

function openDatabase(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => {
        console.warn("[SW] Failed to open DB inside Service Worker");
        resolve(null);
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

function getUnsyncedItems(db, storeName) {
  return new Promise((resolve) => {
    // Check if store exists (version might have changed)
    if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
    }

    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const items = [];
    
    // We scan all items since we might not have an index on isSynced depending on Dexie config
    // For performance in larger DBs, an index on 'isSynced' would be better
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        // Check for isSynced: false (or 0)
        const val = cursor.value;
        if (val.isSynced === false || val.isSynced === 0) {
            items.push(val);
        }
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    
    request.onerror = () => resolve([]);
  });
}

function markItemsAsSynced(db, storeName, items) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
        resolve();
        return;
    }

    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    items.forEach(item => {
      // Create clone and update flag
      const updated = { ...item, isSynced: true };
      store.put(updated);
    });

    transaction.oncomplete = () => {
        // Optional: Notify clients to refresh UI
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE', table: storeName }));
        });
        resolve();
    };
    transaction.onerror = () => reject();
  });
}
