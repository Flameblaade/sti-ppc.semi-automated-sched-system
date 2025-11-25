// Offline Storage Manager using IndexedDB
class OfflineStorage {
  constructor() {
    this.dbName = 'SchedSystemDB';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[OfflineStorage] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineStorage] IndexedDB opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Object stores for different data types
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('departments')) {
          db.createObjectStore('departments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          db.createObjectStore('subjects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('strands')) {
          db.createObjectStore('strands', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('faculty')) {
          db.createObjectStore('faculty', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('apiCache')) {
          const apiStore = db.createObjectStore('apiCache', { keyPath: 'url' });
          apiStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('[OfflineStorage] IndexedDB structure created');
      };
    });
  }

  // Generic save method
  async save(storeName, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      if (Array.isArray(data)) {
        // Save multiple items
        const promises = data.map(item => {
          return new Promise((res, rej) => {
            const request = store.put(item);
            request.onsuccess = () => res();
            request.onerror = () => rej(request.error);
          });
        });
        Promise.all(promises)
          .then(() => {
            console.log(`[OfflineStorage] Saved ${data.length} items to ${storeName}`);
            resolve();
          })
          .catch(reject);
      } else {
        // Save single item
        const request = store.put(data);
        request.onsuccess = () => {
          console.log(`[OfflineStorage] Saved item to ${storeName}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      }
    });
  }

  // Generic get method
  async get(storeName, key = null) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      if (key === null) {
        // Get all items
        const request = store.getAll();
        request.onsuccess = () => {
          console.log(`[OfflineStorage] Retrieved ${request.result.length} items from ${storeName}`);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      } else {
        // Get single item
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    });
  }

  // Generic delete method
  async delete(storeName, key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        console.log(`[OfflineStorage] Deleted item from ${storeName}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear a store
  async clear(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log(`[OfflineStorage] Cleared ${storeName}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Save schedule
  async saveSchedule(schedules) {
    return this.save('schedules', Array.isArray(schedules) ? schedules : [schedules]);
  }

  // Get schedule
  async getSchedule() {
    return this.get('schedules');
  }

  // Save API response cache
  async cacheAPIResponse(url, data) {
    const cacheItem = {
      url: url,
      data: data,
      timestamp: Date.now()
    };
    return this.save('apiCache', cacheItem);
  }

  // Get cached API response
  async getCachedAPIResponse(url, maxAge = 3600000) { // Default 1 hour
    const cached = await this.get('apiCache', url);
    if (cached && (Date.now() - cached.timestamp < maxAge)) {
      return cached.data;
    }
    return null;
  }

  // Add to sync queue
  async addToSyncQueue(action) {
    if (!this.db) await this.init();
    
    const queueItem = {
      method: action.method,
      url: action.url,
      body: action.body,
      headers: action.headers,
      timestamp: Date.now(),
      status: 'pending',
      retries: 0
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(queueItem);
      
      request.onsuccess = () => {
        queueItem.id = request.result;
        console.log('[OfflineStorage] Added to sync queue:', queueItem);
        resolve(queueItem);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get sync queue
  async getSyncQueue(status = 'pending') {
    const allItems = await this.get('syncQueue');
    return allItems.filter(item => item.status === status);
  }

  // Update sync queue item
  async updateSyncQueueItem(id, updates) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          Object.assign(item, updates);
          const putRequest = store.put(item);
          putRequest.onsuccess = () => {
            console.log(`[OfflineStorage] Updated sync queue item ${id}`);
            resolve(item);
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          console.warn(`[OfflineStorage] Item ${id} not found in sync queue`);
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Remove from sync queue
  async removeFromSyncQueue(id) {
    return this.delete('syncQueue', id);
  }
}

// Create global instance
window.offlineStorage = new OfflineStorage();

// Initialize on load
if (typeof window !== 'undefined') {
  window.offlineStorage.init().catch(err => {
    console.error('[OfflineStorage] Initialization failed:', err);
  });
}

