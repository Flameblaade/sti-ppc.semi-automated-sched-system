// Offline UI Indicator and Management
class OfflineUI {
  constructor() {
    this.indicator = null;
    this.statusBar = null;
    this.init();
  }

  init() {
    // Create offline indicator
    this.createOfflineIndicator();
    
    // Create status bar for sync status
    this.createStatusBar();
    
    // Listen for connection status changes
    window.addEventListener('connectionStatusChange', (e) => {
      this.updateUI(e.detail.online);
    });

    // Initial update
    this.updateUI(navigator.onLine);
    
    // Periodic status update
    setInterval(() => {
      this.updateSyncStatus();
    }, 5000);
  }

  createOfflineIndicator() {
    // Create indicator element
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className = 'offline-indicator';
    indicator.innerHTML = `
      <i class="fas fa-wifi"></i>
      <span>You're offline</span>
    `;
    
    // Add to body
    document.body.appendChild(indicator);
    this.indicator = indicator;
  }

  createStatusBar() {
    // Create status bar element
    const statusBar = document.createElement('div');
    statusBar.id = 'sync-status-bar';
    statusBar.className = 'sync-status-bar';
    statusBar.innerHTML = `
      <div class="sync-status-content">
        <span class="sync-status-text">
          <i class="fas fa-sync"></i>
          <span id="sync-status-text">Syncing...</span>
        </span>
        <button id="sync-status-close" class="sync-status-close" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(statusBar);
    this.statusBar = statusBar;
    
    // Close button handler
    const closeBtn = statusBar.querySelector('#sync-status-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideStatusBar();
      });
    }
  }

  updateUI(isOnline) {
    if (this.indicator) {
      if (isOnline) {
        this.indicator.classList.remove('offline');
        this.indicator.classList.add('online');
        this.indicator.innerHTML = `
          <i class="fas fa-wifi"></i>
          <span>You're online</span>
        `;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          this.indicator.classList.remove('show');
        }, 3000);
      } else {
        this.indicator.classList.remove('online');
        this.indicator.classList.add('offline');
        this.indicator.classList.add('show');
        this.indicator.innerHTML = `
          <i class="fas fa-wifi-slash"></i>
          <span>You're offline - Working in offline mode</span>
        `;
      }
    }
  }

  async updateSyncStatus() {
    if (!window.offlineSync) return;
    
    try {
      const status = await window.offlineSync.getSyncStatus();
      const statusText = this.statusBar.querySelector('#sync-status-text');
      
      if (status.pending > 0 && status.isOnline) {
        this.showStatusBar(`${status.pending} action${status.pending > 1 ? 's' : ''} pending sync`);
      } else if (status.pending > 0 && !status.isOnline) {
        this.showStatusBar(`${status.pending} action${status.pending > 1 ? 's' : ''} queued (offline)`);
      } else if (status.failed > 0) {
        this.showStatusBar(`${status.failed} action${status.failed > 1 ? 's' : ''} failed to sync`, 'error');
      } else {
        this.hideStatusBar();
      }
    } catch (error) {
      console.error('[OfflineUI] Error updating sync status:', error);
    }
  }

  showStatusBar(message, type = 'info') {
    if (!this.statusBar) return;
    
    const statusText = this.statusBar.querySelector('#sync-status-text');
    if (statusText) {
      statusText.textContent = message;
    }
    
    this.statusBar.className = `sync-status-bar sync-status-${type} show`;
  }

  hideStatusBar() {
    if (this.statusBar) {
      this.statusBar.classList.remove('show');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.offlineUI = new OfflineUI();
  });
} else {
  window.offlineUI = new OfflineUI();
}

