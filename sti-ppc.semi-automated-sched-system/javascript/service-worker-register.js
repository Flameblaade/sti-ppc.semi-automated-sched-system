// Service Worker Registration with automatic updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[Service Worker] Registered successfully:', registration.scope);
        
        // Immediately check for updates on every page load
        registration.update().catch(err => {
          console.log('[Service Worker] Update check failed (normal if offline):', err);
        });
        
        // Check for updates periodically
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60000); // Check every minute
        
        // Handle new service worker installation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('[Service Worker] New version found, installing...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New service worker available, activate it immediately
                console.log('[Service Worker] New version installed, activating...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                
                // Reload page to use new service worker (optional - can be removed for seamless updates)
                // window.location.reload();
              } else {
                // First time installation
                console.log('[Service Worker] Service Worker installed for the first time');
              }
            }
          });
        });
        
        // Listen for controller change (new SW has taken control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('[Service Worker] New service worker activated');
          // Optionally reload to ensure all scripts use new version
          // For seamless updates, we don't reload - JavaScript files use network-first anyway
        });
      })
      .catch((error) => {
        console.error('[Service Worker] Registration failed:', error);
      });
    
    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[Service Worker] Message received:', event.data);
    });
  });
}

