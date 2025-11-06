// Check user role and adjust UI accordingly
document.addEventListener('DOMContentLoaded', function() {
    // Get user role from localStorage or session
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userRole = userData.role || 'user';
    
    console.log('User role detected:', userRole);
    
    // Apply role-based permissions
    if (userRole === 'user') {
        console.log('Applying view-only mode for user');
        makeViewOnly();
    } else if (userRole === 'admin') {
        console.log('Applying admin mode with approval requirements');
        makeAdminMode();
    } else if (userRole === 'superadmin') {
        console.log('Applying superadmin mode with full access');
        makeSuperAdminMode();
    }
});

function makeViewOnly() {
    // Hide all action buttons and forms
    const elementsToHide = [
        // Buttons
        '.btn',
        'button',
        '.action-buttons',
        '.form-actions',
        
        // Form elements
        'form',
        'input',
        'select',
        'textarea',
        
        // Specific elements by class
        '.compact-form',
        '.form-header',
        '.form-container',
        '.add-class-form',
        '.form-actions',
        
        // Specific elements by ID
        '#exportExcelBtn',
        '#addClassBtn',
        '#generateScheduleBtn',
        '#clearAllBtn',
        '#saveScheduleBtn',
        '#addNewClass',
        '.fc-addEventButton-button', // FullCalendar add event button
        '.fc-toolbar-chunk:last-child' // FullCalendar action buttons
    ];

    // Hide elements
    elementsToHide.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (el && !el.classList.contains('view-only')) {
                el.style.display = 'none';
            }
        });
    });

    // Disable any remaining interactive elements
    const interactiveElements = document.querySelectorAll(
        'button, input, select, textarea, [tabindex], [role="button"], [onclick]'
    );
    
    interactiveElements.forEach(el => {
        if (el && !el.classList.contains('view-only')) {
            el.disabled = true;
            el.style.pointerEvents = 'none';
            el.style.cursor = 'not-allowed';
            el.style.opacity = '0.7';
            
            // Remove click handlers
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
        }
    });
    
    // Update UI text
    document.title = 'View Schedule - Read Only';
    const headers = document.querySelectorAll('h1, h2, h3, .panel-title');
    headers.forEach(header => {
        if (header) {
            header.textContent = header.textContent
                .replace('Add New Class', 'View Schedule')
                .replace('Create Schedule', 'View Schedule')
                .replace('Manage', 'View');
        }
    });
    
    // Disable FullCalendar interactions but keep calendar visible
    if (window.calendar) {
        window.calendar.setOption('editable', false);
        window.calendar.setOption('selectable', false);
        window.calendar.setOption('droppable', false);
        window.calendar.setOption('eventResizableFromStart', false);
        window.calendar.setOption('eventStartEditable', false);
        window.calendar.setOption('eventDurationEditable', false);
        window.calendar.setOption('eventResourceEditable', false);
    }
    
    // Ensure schedule is loaded for users to view
    function loadScheduleForUser() {
        console.log('loadScheduleForUser called');
        console.log('Calendar exists:', !!window.calendar);
        console.log('loadScheduleFromLocalStorage exists:', typeof window.loadScheduleFromLocalStorage === 'function');
        
        if (window.calendar && typeof window.loadScheduleFromLocalStorage === 'function') {
            console.log('Loading schedule for user view...');
            // Clear any existing events first
            window.calendar.removeAllEvents();
            // Load the schedule
            window.loadScheduleFromLocalStorage();
        } else {
            console.log('Calendar or loadScheduleFromLocalStorage not ready, retrying...');
            setTimeout(loadScheduleForUser, 500);
        }
    }
    
    // Start trying to load the schedule with multiple attempts
    setTimeout(loadScheduleForUser, 1000);
    setTimeout(loadScheduleForUser, 2000);
    setTimeout(loadScheduleForUser, 3000);
    
    // Listen for schedule updates
    window.addEventListener('scheduleUpdated', function(event) {
        console.log('Schedule updated event received, reloading for user view...');
        if (window.calendar && typeof window.loadScheduleFromLocalStorage === 'function') {
            // Clear existing events first
            window.calendar.removeAllEvents();
            // Reload the global schedule
            window.loadScheduleFromLocalStorage();
        }
    });
    
    // Add a banner indicating view-only mode
    const banner = document.createElement('div');
    banner.style.cssText = `
        background-color: #f8f9fa;
        color: #6c757d;
        text-align: center;
        padding: 10px;
        border-bottom: 1px solid #dee2e6;
        font-size: 14px;
        position: sticky;
        top: 0;
        z-index: 1000;
    `;
    banner.textContent = 'View Only Mode - You have read-only access to the schedule';
    document.body.insertBefore(banner, document.body.firstChild);
}

function makeAdminMode() {
    // Admin can create classes and generate schedules, but changes need approval
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Add approval notification banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        background-color: #fff3cd;
        color: #856404;
        text-align: center;
        padding: 10px;
        border-bottom: 1px solid #ffeaa7;
        font-size: 14px;
        position: sticky;
        top: 0;
        z-index: 1000;
    `;
    banner.innerHTML = 'Admin Mode - Your changes will require superadmin approval';
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Enable all functionality but add approval workflow
    enableAdminFeatures();
}

function makeSuperAdminMode() {
    // Superadmin has full access to everything
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Add superadmin notification banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        background-color: #d1ecf1;
        color: #0c5460;
        text-align: center;
        padding: 10px;
        border-bottom: 1px solid #bee5eb;
        font-size: 14px;
        position: sticky;
        top: 0;
        z-index: 1000;
    `;
    banner.innerHTML = 'Superadmin Mode - Full system access';
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Enable all functionality
    enableSuperAdminFeatures();
}

function enableAdminFeatures() {
    // Admin can create classes and generate schedules
    // Add approval workflow for admin actions
    console.log('Admin features enabled');
    
    // Override class creation to require approval
    overrideAdminClassCreation();
    overrideAdminScheduleGeneration();
}

function overrideAdminClassCreation() {
    // Find the submit button and add approval workflow
    const submitBtn = document.getElementById('submitScheduleBtn');
    if (submitBtn) {
        // Remove existing event listeners
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        
        // Add new event listener with approval workflow
        newSubmitBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show approval confirmation
            if (confirm('Your class creation will require superadmin approval. Continue?')) {
                // Proceed with class creation
                createClassWithApproval();
            }
        });
    }
}

function overrideAdminScheduleGeneration() {
    // Find the generate schedule button and add approval workflow
    const generateBtn = document.getElementById('generateScheduleBtn');
    if (generateBtn) {
        // Remove existing event listeners
        const newGenerateBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
        
        // Add new event listener with approval workflow
        newGenerateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show approval confirmation
            if (confirm('Your schedule generation will require superadmin approval. Continue?')) {
                // Proceed with schedule generation
                generateScheduleWithApproval();
            }
        });
    }
}

function createClassWithApproval() {
    // This would normally create the class, but for now just show a message
    showNotification('Class creation submitted for superadmin approval', 'info');
    
    // In a real implementation, this would:
    // 1. Create a pending approval request
    // 2. Send notification to superadmin
    // 3. Store the request in a pending approvals database
}

function generateScheduleWithApproval() {
    // This would normally generate the schedule, but for now just show a message
    showNotification('Schedule generation submitted for superadmin approval', 'info');
    
    // In a real implementation, this would:
    // 1. Create a pending approval request
    // 2. Send notification to superadmin
    // 3. Store the request in a pending approvals database
}

function enableSuperAdminFeatures() {
    // Superadmin has full access
    console.log('Superadmin features enabled');
}
