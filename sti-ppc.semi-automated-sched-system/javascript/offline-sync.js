// Offline Sync Manager - handles syncing queued actions when back online
class OfflineSync {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncing = false;
    this.syncInterval = null;
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('[OfflineSync] Network connection restored');
      this.isOnline = true;
      this.syncPendingActions();
      this.updateOnlineStatus();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineSync] Network connection lost');
      this.isOnline = false;
      this.updateOnlineStatus();
    });

    // Start periodic sync check (every 30 seconds when online)
    this.startPeriodicSync();

    // Initial sync if online
    if (this.isOnline) {
      setTimeout(() => this.syncPendingActions(), 2000);
    }
  }

  updateOnlineStatus() {
    const event = new CustomEvent('connectionStatusChange', {
      detail: { online: this.isOnline }
    });
    window.dispatchEvent(event);
  }

  startPeriodicSync() {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncing) {
        this.syncPendingActions();
      }
    }, 30000);
  }

  async syncPendingActions() {
    if (this.syncing || !this.isOnline) {
      return;
    }

    this.syncing = true;
    console.log('[OfflineSync] Starting sync of pending actions...');

    try {
      const pendingActions = await window.offlineStorage.getSyncQueue('pending');
      console.log(`[OfflineSync] Found ${pendingActions.length} pending actions`);

      if (pendingActions.length === 0) {
        this.syncing = false;
        return;
      }

      // Process actions in sequence
      for (const action of pendingActions) {
        try {
          // Ensure action has an id
          if (!action.id) {
            console.warn('[OfflineSync] Action missing ID, skipping:', action);
            continue;
          }

          await this.processAction(action);
          
          // Mark as completed
          await window.offlineStorage.updateSyncQueueItem(action.id, { 
            status: 'completed',
            completedAt: Date.now()
          });
          
          console.log(`[OfflineSync] ✓ Synced action: ${action.method} ${action.url}`);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[OfflineSync] ✗ Failed to sync action ${action.id}:`, error);
          
          // Get current retry count
          const currentRetries = action.retries || 0;
          const newRetries = currentRetries + 1;
          
          // If max retries exceeded, mark as failed
          if (newRetries >= 5) {
            await window.offlineStorage.updateSyncQueueItem(action.id, {
              status: 'failed',
              error: error.message,
              failedAt: Date.now(),
              retries: newRetries
            });
            console.error(`[OfflineSync] Action ${action.id} failed after ${newRetries} retries`);
          } else {
            // Update retry count
            await window.offlineStorage.updateSyncQueueItem(action.id, {
              retries: newRetries
            });
          }
        }
      }

      // Clean up old completed/failed items (older than 7 days)
      await this.cleanupOldQueueItems();
      
    } catch (error) {
      console.error('[OfflineSync] Error during sync:', error);
    } finally {
      this.syncing = false;
      console.log('[OfflineSync] Sync completed');
    }
  }

  async processAction(action) {
    const authToken = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...(action.headers || {})
    };

    const options = {
      method: action.method,
      headers: headers,
      body: action.body ? JSON.stringify(action.body) : undefined
    };

    const response = await fetch(action.url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async cleanupOldQueueItems() {
    try {
      const allItems = await window.offlineStorage.get('syncQueue');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      const itemsToDelete = allItems.filter(item => 
        (item.status === 'completed' || item.status === 'failed') &&
        item.timestamp < sevenDaysAgo
      );

      for (const item of itemsToDelete) {
        await window.offlineStorage.removeFromSyncQueue(item.id);
      }

      if (itemsToDelete.length > 0) {
        console.log(`[OfflineSync] Cleaned up ${itemsToDelete.length} old queue items`);
      }
    } catch (error) {
      console.error('[OfflineSync] Error cleaning up queue items:', error);
    }
  }

  // Add action to queue (called by fetchWithAuth when offline)
  async queueAction(method, url, body = null, headers = {}) {
    const action = {
      method,
      url,
      body,
      headers
    };

    await window.offlineStorage.addToSyncQueue(action);
    console.log(`[OfflineSync] Queued action: ${method} ${url}`);
    
    // Show notification
    if (window.showNotification) {
      window.showNotification(
        'Action queued for sync when connection is restored',
        'info'
      );
    }
  }

  // Get sync status
  async getSyncStatus() {
    const pending = await window.offlineStorage.getSyncQueue('pending');
    const completed = await window.offlineStorage.getSyncQueue('completed');
    const failed = await window.offlineStorage.getSyncQueue('failed');
    
    return {
      pending: pending.length,
      completed: completed.length,
      failed: failed.length,
      isOnline: this.isOnline,
      syncing: this.syncing
    };
  }
}

// Create global instance
window.offlineSync = new OfflineSync();

