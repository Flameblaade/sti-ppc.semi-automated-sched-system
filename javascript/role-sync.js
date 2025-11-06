// Role Synchronization Utility
// Checks periodically if the user's role has changed on the server
// and updates localStorage accordingly

(function() {
    'use strict';
    
    let roleCheckInterval = null;
    let currentRole = null;
    let currentUserId = null;
    
    /**
     * Get current user's role from server
     */
    async function fetchCurrentUserRole() {
        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                return null;
            }
            
            // Get user ID from localStorage (fallback to email if ID not available)
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            let userId = userData.id;
            
            // If no ID, try to find user by email via API
            if (!userId && userData.email) {
                // Try to get all users and find matching email
                try {
                    const allUsersResponse = await fetch('/api/users', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (allUsersResponse.ok) {
                        const allUsers = await allUsersResponse.json();
                        const matchingUser = allUsers.find(u => u.email === userData.email);
                        if (matchingUser) {
                            userId = matchingUser.id;
                        }
                    }
                } catch (e) {
                    console.warn('Could not fetch user list for ID lookup:', e);
                }
            }
            
            if (!userId) {
                console.warn('No user ID available for role sync');
                return null;
            }
            
            // Fetch current user data from server
            const response = await fetch(`/api/users/${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // If 401, token might be expired
                if (response.status === 401) {
                    console.log('Token expired, stopping role sync');
                    stopRoleSync();
                    return null;
                }
                // If 403, might not have permission (try alternative approach)
                if (response.status === 403) {
                    console.warn('Permission denied for user lookup');
                    return null;
                }
                return null;
            }
            
            const user = await response.json();
            return {
                id: user.id,
                role: user.role,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                department: user.department
            };
        } catch (error) {
            console.error('Error fetching current user role:', error);
            return null;
        }
    }
    
    /**
     * Check if role has changed and update if needed
     */
    async function checkRoleChange() {
        const serverUser = await fetchCurrentUserRole();
        
        if (!serverUser) {
            return false; // Return false if couldn't fetch
        }
        
        const localUserData = JSON.parse(localStorage.getItem('userData') || '{}');
        const localRole = (localUserData.role || 'user').toLowerCase().trim();
        const serverRole = (serverUser.role || 'user').toLowerCase().trim();
        
        // Check if role has changed (case-insensitive comparison)
        if (localRole !== serverRole) {
            console.log(`Role change detected: ${localRole} -> ${serverRole}`);
            
            // Update localStorage with new user data IMMEDIATELY
            const updatedUserData = {
                ...localUserData,
                id: serverUser.id, // Ensure ID is preserved
                role: serverRole, // Use the server role exactly as returned
                email: serverUser.email,
                firstName: serverUser.firstName,
                lastName: serverUser.lastName,
                department: serverUser.department
            };
            
            localStorage.setItem('userData', JSON.stringify(updatedUserData));
            console.log('LocalStorage updated with new role:', serverRole);
            
            // If demoting (higher to lower role), refresh immediately
            // Role hierarchy: superadmin > admin > faculty > user
            const roleHierarchy = { 'superadmin': 4, 'admin': 3, 'faculty': 2, 'user': 1 };
            const localRoleLevel = roleHierarchy[localRole] || 1;
            const serverRoleLevel = roleHierarchy[serverRole] || 1;
            
            const isDemotion = serverRoleLevel < localRoleLevel;
            
            if (isDemotion) {
                // For demotions, refresh immediately to enforce permission changes
                console.log('Demotion detected - refreshing page immediately');
                
                // Stop checking since we're about to reload
                stopRoleSync();
                
                // Refresh immediately for demotions
                window.location.reload();
                return true;
            } else {
                // For promotions, show notification first
                if (typeof showNotification === 'function') {
                    showNotification(`Your role has been updated to ${serverRole.charAt(0).toUpperCase() + serverRole.slice(1)}. Page will refresh.`, 'info');
                } else {
                    alert(`Your role has been updated to ${serverRole}. Page will refresh.`);
                }
                
                // Refresh the page after a short delay to show the notification
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
                // Stop checking since we're about to reload
                stopRoleSync();
                return true;
            }
        }
        
        // Also update other user data if changed (but don't reload for those)
        if (localUserData.email !== serverUser.email || 
            localUserData.firstName !== serverUser.firstName ||
            localUserData.lastName !== serverUser.lastName ||
            localUserData.department !== serverUser.department) {
            
            const updatedUserData = {
                ...localUserData,
                email: serverUser.email,
                firstName: serverUser.firstName,
                lastName: serverUser.lastName,
                department: serverUser.department
            };
            
            localStorage.setItem('userData', JSON.stringify(updatedUserData));
            
            // Update UI without reload if updateUserInfo function exists
            if (typeof updateUserInfo === 'function') {
                updateUserInfo();
            }
        }
        
        return false; // No role change
    }
    
    /**
     * Start role synchronization
     */
    function startRoleSync(intervalMs = 5000) {
        // Don't start if already running
        if (roleCheckInterval) {
            return;
        }
        
        // Get initial role
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        currentRole = userData.role || 'user';
        currentUserId = userData.id;
        
        // Check immediately
        checkRoleChange();
        
        // Then check periodically
        roleCheckInterval = setInterval(checkRoleChange, intervalMs);
        
        console.log('Role synchronization started (checking every', intervalMs, 'ms)');
    }
    
    /**
     * Stop role synchronization
     */
    function stopRoleSync() {
        if (roleCheckInterval) {
            clearInterval(roleCheckInterval);
            roleCheckInterval = null;
            console.log('Role synchronization stopped');
        }
    }
    
    /**
     * Initialize role sync - DISABLED: Users must log out and log back in to see role changes
     */
    async function initializeRoleSync() {
        // Role sync disabled - users must log out and log back in to see role changes
        return;
        
        // Below code is disabled but kept for future reference:
        /*
        const authToken = localStorage.getItem('authToken');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (!authToken || !userData.id) {
            return;
        }
        
        // IMMEDIATELY check role on page load (before any permission checks)
        await checkRoleChange();
        
        // Then start periodic checking
        startRoleSync(5000);
        */
    }

    // Role sync disabled - do not start automatically
    // initializeRoleSync();

    // Also ensure it runs when DOM is ready as backup
    // DISABLED - removed automatic role checking
    
    // Clean up on page unload
    window.addEventListener('beforeunload', stopRoleSync);
    
    // Export functions for manual control
    window.roleSync = {
        start: startRoleSync,
        stop: stopRoleSync,
        check: checkRoleChange
    };
})();

