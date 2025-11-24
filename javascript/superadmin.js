/**
 * Superadmin Dashboard JavaScript
 * Simple and clean functionality for superadmin operations
 */

/**
 * Format full name with middle initial
 * @param {string} firstName - First name
 * @param {string} middleName - Middle name (optional)
 * @param {string} lastName - Last name
 * @returns {string} Formatted name (e.g., "John M. Doe" or "John Doe")
 */
function formatFullName(firstName, middleName, lastName) {
    if (!firstName && !lastName) return '';
    
    let name = firstName || '';
    
    if (middleName && middleName.trim()) {
        const middleInitial = middleName.trim().charAt(0).toUpperCase();
        name += ` ${middleInitial}.`;
    }
    
    if (lastName) {
        name += ` ${lastName}`;
    }
    
    return name.trim();
}

// Data Management Modal Functions
function initializeDataManagementModals() {
    // Modal elements
    const backupModal = document.getElementById('backupModal');
    const importDataModal = document.getElementById('importDataModal');
    const clearDataInfoModal = document.getElementById('clearDataInfoModal');
    
    // Buttons
    const openBackupModalBtn = document.getElementById('openBackupModalBtn');
    const openImportDataModalBtn = document.getElementById('openImportDataModalBtn');
    const openClearDataModalBtn = document.getElementById('openClearDataModalBtn');
    const confirmBackupBtn = document.getElementById('confirmBackupBtn');
    const confirmImportDataBtn = document.getElementById('confirmImportDataBtn');
    const finalClearDataBtn = document.getElementById('finalClearDataBtn');
    
    // Close buttons
    const closeBackupModal = document.getElementById('closeBackupModal');
    const closeImportDataModal = document.getElementById('closeImportDataModal');
    const closeClearDataInfoModal = document.getElementById('closeClearDataInfoModal');
    const cancelBackupBtn = document.getElementById('cancelBackupBtn');
    const cancelImportDataBtn = document.getElementById('cancelImportDataBtn');
    const cancelClearDataInfoBtn = document.getElementById('cancelClearDataInfoBtn');
    
    // Confirmation input
    const confirmClearInput = document.getElementById('confirmClearInput');

    console.log('Initializing data management modals...');
    console.log('Backup button found:', !!openBackupModalBtn);
    console.log('Clear data button found:', !!openClearDataModalBtn);

    // Helpers for animated modal
    const openModal = (modal) => {
        if (!modal) return;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // trigger transition
        requestAnimationFrame(() => modal.classList.add('show'));
    };
    const closeModal = (modal) => {
        if (!modal) return;
        modal.classList.remove('show');
        setTimeout(() => { 
            modal.style.display = 'none'; 
            document.body.style.overflow = 'auto';
            
            // Reset clear data confirmation input
            if (modal === clearDataInfoModal && confirmClearInput && finalClearDataBtn) {
                confirmClearInput.value = '';
                finalClearDataBtn.disabled = true;
            }
        }, 200);
    };

    // Open backup modal
    if (openBackupModalBtn) {
        openBackupModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Backup button clicked');
            openModal(backupModal);
        });
    }

    // Open import data modal
    if (openImportDataModalBtn) {
        openImportDataModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Import data button clicked');
            openModal(importDataModal);
            // Reset file input
            const importFileInput = document.getElementById('importFileInput');
            if (importFileInput) {
                importFileInput.value = '';
            }
            const importFilePreview = document.getElementById('importFilePreview');
            if (importFilePreview) {
                importFilePreview.style.display = 'none';
            }
            if (confirmImportDataBtn) {
                confirmImportDataBtn.disabled = true;
            }
        });
    }

    // Add event listener for file input change (backup to inline handler)
    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        // Add event listener directly (works alongside inline handler)
        importFileInput.addEventListener('change', function(e) {
            console.log('File input change event triggered directly');
            const file = e.target.files[0];
            const confirmImportDataBtn = document.getElementById('confirmImportDataBtn');
            
            if (file) {
                const fileName = file.name.toLowerCase();
                const isJson = fileName.endsWith('.json') || file.type === 'application/json';
                
                console.log('Direct handler - File:', fileName, 'Is JSON:', isJson, 'Button:', confirmImportDataBtn);
                
                if (isJson) {
                    if (confirmImportDataBtn) {
                        confirmImportDataBtn.disabled = false;
                        console.log('Button enabled via direct handler');
                    }
                    const importFilePreview = document.getElementById('importFilePreview');
                    const importFileName = document.getElementById('importFileName');
                    if (importFilePreview && importFileName) {
                        importFilePreview.style.display = 'block';
                        importFileName.textContent = file.name;
                    }
                } else {
                    if (confirmImportDataBtn) {
                        confirmImportDataBtn.disabled = true;
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('Invalid file type. Please select a JSON backup file.', 'error');
                    }
                }
            } else {
                if (confirmImportDataBtn) {
                    confirmImportDataBtn.disabled = true;
                }
            }
        });
    }

    // Open clear data info modal
    if (openClearDataModalBtn) {
        openClearDataModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Clear data button clicked');
            openModal(clearDataInfoModal);
        });
    }

    if (closeBackupModal) closeBackupModal.addEventListener('click', () => closeModal(backupModal));
    if (closeImportDataModal) closeImportDataModal.addEventListener('click', () => closeModal(importDataModal));
    if (closeClearDataInfoModal) closeClearDataInfoModal.addEventListener('click', () => closeModal(clearDataInfoModal));
    if (cancelBackupBtn) cancelBackupBtn.addEventListener('click', () => closeModal(backupModal));
    if (cancelImportDataBtn) cancelImportDataBtn.addEventListener('click', () => closeModal(importDataModal));
    if (cancelClearDataInfoBtn) cancelClearDataInfoBtn.addEventListener('click', () => closeModal(clearDataInfoModal));

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === backupModal) closeModal(backupModal);
        if (event.target === importDataModal) closeModal(importDataModal);
        if (event.target === clearDataInfoModal) closeModal(clearDataInfoModal);
    });

    // Import Data functionality
    if (confirmImportDataBtn) {
        confirmImportDataBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const importFileInput = document.getElementById('importFileInput');
            if (!importFileInput || !importFileInput.files || !importFileInput.files[0]) {
                showNotification('Please select a backup file to import', 'error');
                return;
            }

            const file = importFileInput.files[0];
            if (!file.name.endsWith('.json')) {
                showNotification('Invalid file type. Please select a JSON backup file.', 'error');
                return;
            }

            try {
                confirmImportDataBtn.disabled = true;
                confirmImportDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
                
                const fileText = await file.text();
                const backupData = JSON.parse(fileText);
                
                if (!backupData.data) {
                    throw new Error('Invalid backup file format');
                }

                // Import data using API
                const token = localStorage.getItem('authToken');
                console.log('Sending import request to /api/admin/import-data');
                console.log('Token exists:', !!token);
                
                const response = await fetch('/api/admin/import-data', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(backupData.data)
                });

                console.log('Import response status:', response.status, response.statusText);

                if (!response.ok) {
                    let errorMessage = 'Failed to import data';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorData.error || errorMessage;
                        console.error('Import error response:', errorData);
                    } catch (e) {
                        console.error('Failed to parse error response:', e);
                        errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    }
                    throw new Error(errorMessage);
                }

                const result = await response.json();
                
                // Reload all data
                await Promise.all([
                    loadPendingAccounts(),
                    loadUsers(),
                    loadAllAcademicData(),
                    loadDashboardData()
                ]);

                // Reload schedules and classes from localStorage if available
                if (backupData.data['/api/schedule']) {
                    try {
                        localStorage.setItem('schedules', JSON.stringify(backupData.data['/api/schedule']));
                        if (window.loadScheduleFromLocalStorage) {
                            window.loadScheduleFromLocalStorage();
                        }
                    } catch (e) {
                        console.warn('Could not restore schedules:', e);
                    }
                }

                if (backupData.data['/api/users']) {
                    // Extract classes from user data if stored
                    try {
                        const users = backupData.data['/api/users'];
                        // Classes might be stored separately or in user data
                        if (backupData.data.classes) {
                            localStorage.setItem('allClasses', JSON.stringify(backupData.data.classes));
                            if (typeof window.setAllClasses === 'function') {
                                window.setAllClasses(backupData.data.classes);
                            }
                            if (typeof updateClassesCountBadge === 'function') {
                                updateClassesCountBadge();
                            }
                        }
                    } catch (e) {
                        console.warn('Could not restore classes:', e);
                    }
                }

                closeModal(importDataModal);
                showNotification('Data imported successfully! All data has been restored.', 'success');
                
                // Reset file input
                importFileInput.value = '';
                const importFilePreview = document.getElementById('importFilePreview');
                if (importFilePreview) {
                    importFilePreview.style.display = 'none';
                }
            } catch (error) {
                console.error('Import error:', error);
                showNotification(error.message || 'Failed to import data. Please check the backup file format.', 'error');
            } finally {
                confirmImportDataBtn.disabled = false;
                confirmImportDataBtn.innerHTML = '<i class="fas fa-upload"></i> Import Data';
            }
        });
    }

    // Backup functionality
    if (confirmBackupBtn) {
        confirmBackupBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Confirm backup clicked');
            try {
                // Fetch all relevant datasets
                const endpoints = ['/api/users','/api/users/pending','/api/departments','/api/faculty','/api/subjects','/api/courses','/api/strands','/api/rooms','/api/schedule','/api/fixed-schedules'];
                const token = localStorage.getItem('authToken');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                const results = {};
                await Promise.all(endpoints.map(async (ep) => {
                    try {
                        const r = await fetch(ep, { headers });
                        results[ep] = r.ok ? await r.json() : { error: `Failed: ${r.status}` };
                    } catch (e) {
                        results[ep] = { error: e?.message || 'Network error' };
                    }
                }));
                const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: results }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                closeModal(backupModal);
                if (typeof showNotification === 'function') {
                    showNotification('Backup generated successfully', 'success');
                }
            } catch (err) {
                console.error('Backup error', err);
                if (typeof showNotification === 'function') {
                    showNotification('Failed to generate backup', 'error');
                }
            }
        });
    }

    // Clear data confirmation input validation
    if (confirmClearInput && finalClearDataBtn) {
        confirmClearInput.addEventListener('input', () => {
            const isValid = confirmClearInput.value.trim().toUpperCase() === 'CONFIRM';
            finalClearDataBtn.disabled = !isValid;
        });

        finalClearDataBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (finalClearDataBtn.disabled) return;
            console.log('Final clear data clicked');
            try {
                // Call API to clear data (fallback to local cleanup if not available)
                const token = localStorage.getItem('authToken');
                const resp = await fetch('/api/admin/clear-all-data', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                // Regardless of API response, clear client-side caches and UI state
                const keysToClear = [
                    'users', 'pendingUsers', 'departments', 'subjects', 'courses', 'strands', 'rooms',
                    'allClasses', 'facultyAssignments', 'calendarEvents', 'scheduleLastUpdated', 'userData',
                    'fixedSchedules', 'schedules'
                ];
                keysToClear.forEach(k => localStorage.removeItem(k));
                
                // Also clear fixed schedules from calendar if it exists
                if (window.calendar && typeof window.fixedSchedules !== 'undefined' && window.fixedSchedules.loadToCalendar) {
                    const events = window.calendar.getEvents();
                    events.forEach(event => {
                        if (event.extendedProps?.isFixedSchedule) {
                            event.remove();
                        }
                    });
                }
                
                // Clear fixed schedules list display
                const fixedSchedulesList = document.getElementById('fixedSchedulesList');
                if (fixedSchedulesList) {
                    fixedSchedulesList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i><p>No fixed schedules yet. Click "Add New" to create one.</p></div>';
                }
                
                // Purge IndexedDB offline caches and queues
                try {
                    if (window.offlineStorage) {
                        const stores = ['schedules','departments','rooms','subjects','courses','strands','faculty','users','syncQueue','apiCache'];
                        for (const store of stores) {
                            try { await window.offlineStorage.clear(store); } catch(_) {}
                        }
                    } else if ('indexedDB' in window) {
                        // As a last resort, delete the entire DB
                        try {
                            await new Promise((res, rej) => {
                                const req = indexedDB.deleteDatabase('SchedSystemDB');
                                req.onsuccess = () => res();
                                req.onerror = () => res();
                                req.onblocked = () => res();
                            });
                        } catch (_) {}
                    }
                } catch (_) {}
                
                // Clear Service Worker caches
                try {
                    if (window.caches && caches.keys) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                } catch (_) {}
                
                // Unregister service workers to avoid stale repopulation
                try {
                    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map(r => r.unregister()));
                    }
                } catch (_) {}
                
                // Clear calendar UI and in-memory events
                if (window.calendar && typeof window.calendar.removeAllEvents === 'function') {
                    try { window.calendar.removeAllEvents(); } catch(_) {}
                }
                // Clear created classes list and counters
                if (typeof window.resetClasses === 'function') {
                    try { window.resetClasses(); } catch(_) {}
                } else {
                    try { localStorage.removeItem('allClasses'); } catch(_) {}
                    if (typeof updateClassesCountBadge === 'function') {
                        try { updateClassesCountBadge(); } catch(_) {}
                    }
                }
                // Sign out and redirect
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                if (typeof showNotification === 'function') {
                    showNotification('All data cleared. Signing out...', 'success');
                }
                setTimeout(() => { window.location.href = 'login.html'; }, 1200);
            } catch (e) {
                console.error('Clear data error', e);
                if (typeof showNotification === 'function') {
                    showNotification('Failed to clear data', 'error');
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthentication();
    
    // Initialize dashboard
    initializeDashboard();
    
    // Initialize data management modals
    initializeDataManagementModals();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Check if user is authenticated and has superadmin role
 */
function checkAuthentication() {
    const authToken = localStorage.getItem('authToken');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    if (!authToken || userData.role !== 'superadmin') {
        alert('Unauthorized access. Please login with a superadmin account.');
        window.location.href = 'login.html';
        return;
    }
    
    // Update user info in header
    document.getElementById('superadminName').textContent = userData.name || 'Super Admin';
}

// Track last known pending accounts count for notifications
let lastPendingCount = 0;
let pendingAccountsPollInterval = null;

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
    loadDashboardData();
    loadPendingAccounts().then(() => {
        // Start polling for new pending accounts
        startPendingAccountsPolling();
    });
    loadUsers();
    loadDepartments();
    loadFaculty();
    loadSubjects();
    loadCourses();
    loadRooms();
    
    // Initialize search functionality
    initializeSearch();
}

/**
 * Initialize search functionality for all academic management tabs
 */
function initializeSearch() {
    // Store original data for filtering
    window.originalData = {
        departments: [],
        faculty: [],
        subjects: [],
        courses: [],
        rooms: []
    };
    
    // Departments search
    const searchDepartments = document.getElementById('searchDepartments');
    if (searchDepartments) {
        searchDepartments.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTable('departmentsTableBody', window.originalData.departments, searchTerm, (dept) => 
                `${dept.code || ''} ${dept.name || ''} ${dept.description || ''}`.toLowerCase(),
                (filtered) => {
                    const tbody = document.getElementById('departmentsTableBody');
                    if (!tbody) return;
                    tbody.innerHTML = filtered.map(dept => `
                        <tr>
                            <td>${dept.code || ''}</td>
                            <td>${dept.name || ''}</td>
                            <td>${dept.description || 'No description'}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" data-action="edit-department" data-id="${dept.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger" data-action="delete-department" data-id="${dept.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            );
        });
    }
    
    // Faculty search
    const searchFaculty = document.getElementById('searchFaculty');
    if (searchFaculty) {
        searchFaculty.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTable('facultyTableBody', window.originalData.faculty, searchTerm, (fac) => {
                const name = formatFullName(fac.firstName || '', fac.middleName || '', fac.lastName || '') || fac.email || '';
                return `${name} ${fac.email || ''} ${fac.department || ''}`.toLowerCase();
            }, (filtered) => {
                const tbody = document.getElementById('facultyTableBody');
                if (!tbody) return;
                tbody.innerHTML = filtered.map(member => {
                    const isVerified = member.verified === true || member.emailVerified === true;
                    const statusBadge = isVerified 
                        ? `<span style="color: #5cb85c; font-weight: bold;"><i class="fas fa-check-circle"></i> Verified</span>`
                        : `<span style="color: #f0ad4e; font-weight: bold;"><i class="fas fa-clock"></i> Pending</span>`;
                    const verificationButton = isVerified 
                        ? ``
                        : `<button class="btn btn-sm" data-action="send-verification" data-id="${member.id}" data-email="${member.email || ''}" style="background: #e0e7ff; color: #3730a3;">
                                <i class="fas fa-envelope"></i> Send
                            </button>`;
                    const employmentTypeBadge = member.employmentType 
                        ? `<span style="color: #64748b; font-size: 12px; display: block; margin-top: 3px;">
                            <i class="fas fa-briefcase"></i> ${member.employmentType === 'full-time' ? 'Full-time' : 'Part-time'}
                            ${member.mixedTeaching === true ? ' <span style="color: #8b5cf6;">(Mixed Teaching)</span>' : ''}
                           </span>`
                        : '';
                    
                    return `
                    <tr>
                        <td>${formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || ''}</td>
                        <td>${member.email || ''}</td>
                        <td>${member.department || ''}</td>
                        <td>${statusBadge}${employmentTypeBadge}</td>
                        <td>
                            ${verificationButton}
                            <button class="btn btn-sm btn-primary" data-action="edit-faculty" data-id="${member.id}">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" data-action="delete-faculty" data-id="${member.id}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
                }).join('');
            });
        });
    }
    
    // Subjects search
    const searchSubjects = document.getElementById('searchSubjects');
    if (searchSubjects) {
        searchSubjects.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTable('subjectsTableBody', window.originalData.subjects, searchTerm, (sub) => 
                `${sub.code || ''} ${sub.name || ''}`.toLowerCase(),
                (filtered) => {
                    const tbody = document.getElementById('subjectsTableBody');
                    if (!tbody) return;
                    tbody.innerHTML = filtered.map(subject => `
                        <tr>
                            <td>${subject.code || ''}</td>
                            <td>${subject.name || ''}</td>
                            <td>${subject.units || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" data-action="edit-subject" data-id="${subject.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger" data-action="delete-subject" data-id="${subject.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            );
        });
    }
    
    // Courses search
    const searchCourses = document.getElementById('searchCourses');
    if (searchCourses) {
        searchCourses.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTable('coursesTableBody', window.originalData.courses, searchTerm, (course) => 
                `${course.code || ''} ${course.name || ''} ${course.type || ''}`.toLowerCase(),
                (filtered) => {
                    const tbody = document.getElementById('coursesTableBody');
                    if (!tbody) return;
                    tbody.innerHTML = filtered.map(course => `
                        <tr>
                            <td>${course.code || ''}</td>
                            <td>${course.name || ''}</td>
                            <td>${course.type || ''}</td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="
                                        width: 20px; 
                                        height: 20px; 
                                        background-color: ${course.color || '#3b82f6'}; 
                                        border-radius: 4px; 
                                        border: 1px solid #e5e7eb;
                                    "></div>
                                    <span style="font-family: monospace; font-size: 12px; color: #6b7280;">
                                        ${course.color || '#3b82f6'}
                                    </span>
                                </div>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-primary" data-action="edit-course" data-id="${course.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger" data-action="delete-course" data-id="${course.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            );
        });
    }
    
    // Rooms search
    const searchRooms = document.getElementById('searchRooms');
    if (searchRooms) {
        searchRooms.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterTable('roomsTableBody', window.originalData.rooms, searchTerm, (room) => 
                `${room.name || ''} ${room.department || ''} ${room.capacity || ''}`.toLowerCase(),
                (filtered) => {
                    const tbody = document.getElementById('roomsTableBody');
                    if (!tbody) return;
                    tbody.innerHTML = filtered.map(room => {
                        const isExclusive = room.exclusive === true || room.exclusive === 'true' || room.exclusive === 1;
                        const hasPriority = room.priority === true || room.priority === 'true' || room.priority === 1;
                        
                        let priorityStatus = 'Shared';
                        let priorityClass = 'normal';
                        if (isExclusive) {
                            priorityStatus = 'Exclusive';
                            priorityClass = 'priority';
                        } else if (hasPriority) {
                            priorityStatus = 'Priority';
                            priorityClass = 'priority';
                        } else {
                            priorityStatus = 'Shared';
                            priorityClass = 'normal';
                        }
                        
                        let departmentDisplay = room.department || '';
                        if (!departmentDisplay) {
                            if (isExclusive || hasPriority) {
                                departmentDisplay = 'No Department Assigned';
                            } else {
                                departmentDisplay = 'No Room Priority';
                            }
                        }
                        
                        return `
                        <tr>
                            <td>${room.name || ''}</td>
                            <td>${room.capacity || ''}</td>
                            <td>${departmentDisplay}</td>
                            <td>
                                <span class="status-badge ${priorityClass}">
                                    ${priorityStatus}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-primary" data-action="edit-room" data-id="${room.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger" data-action="delete-room" data-id="${room.id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `;
                    }).join('');
                }
            );
        });
    }
}

/**
 * Filter table rows based on search term
 */
function filterTable(tbodyId, data, searchTerm, getSearchText, renderFunction) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    if (!searchTerm) {
        // If no search term, restore original data
        if (data.length > 0 && renderFunction) {
            renderFunction(data);
        }
        return;
    }
    
    const filtered = data.filter(item => getSearchText(item).includes(searchTerm));
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>No results found for "${searchTerm}"</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    if (renderFunction) {
        renderFunction(filtered);
    }
}

/**
 * Start polling for new pending accounts (auto-refresh)
 */
function startPendingAccountsPolling() {
    // Clear any existing interval
    if (pendingAccountsPollInterval) {
        clearInterval(pendingAccountsPollInterval);
    }
    
    // Poll every 5 seconds for new pending accounts
    pendingAccountsPollInterval = setInterval(async () => {
        try {
            const pendingUsers = await fetchData('/api/users/pending');
            const currentCount = pendingUsers ? pendingUsers.length : 0;
            
            // If count increased, show notification and refresh
            if (currentCount > lastPendingCount && lastPendingCount > 0) {
                const newUsers = pendingUsers.slice(0, currentCount - lastPendingCount);
                if (newUsers.length > 0) {
                    const newUser = newUsers[0]; // Get the most recent
                    showNewUserNotification(newUser);
                    // Refresh the list
                    loadPendingAccounts();
                }
            }
            
            // Update count
            lastPendingCount = currentCount;
        } catch (error) {
            console.error('Error polling pending accounts:', error);
        }
    }, 5000); // Poll every 5 seconds
}

/**
 * Show notification modal for new user registration
 */
function showNewUserNotification(user) {
    // Remove any existing notification
    const existing = document.getElementById('newUserNotificationModal');
    if (existing) {
        existing.remove();
    }
    
    const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    
    const modalHTML = `
        <div id="newUserNotificationModal" class="new-user-notification-overlay">
            <div class="new-user-notification-container">
                <div class="new-user-notification-header">
                    <div class="new-user-notification-icon">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <h2>New User Registered</h2>
                    <button class="new-user-notification-close" data-action="close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="new-user-notification-body">
                    <div class="new-user-notification-content">
                        <div class="new-user-notification-main-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <h3>New Account Pending Approval</h3>
                        <p class="new-user-notification-description">
                            <strong>${userName}</strong> has completed email verification and is waiting for your approval.
                        </p>
                        <div class="new-user-notification-info">
                            <p><i class="fas fa-envelope"></i> <strong>Email:</strong> ${user.email}</p>
                            <p><i class="fas fa-calendar"></i> <strong>Registered:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                <div class="new-user-notification-footer">
                    <button class="new-user-notification-btn-secondary" data-action="close">
                        Dismiss
                    </button>
                    <button class="new-user-notification-btn-primary" data-action="view">
                        <i class="fas fa-eye"></i> View Faculty Verification
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById('newUserNotificationModal');
    if (modal) {
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        modal.addEventListener('click', (e) => {
            const target = e.target.closest('button[data-action]');
            if (!target) return;
            
            const action = target.getAttribute('data-action');
            if (action === 'close') {
                closeNewUserNotification();
            } else if (action === 'view') {
                closeNewUserNotification();
                // Switch to pending accounts tab
                const pendingTab = document.querySelector('[data-section="pending-accounts"]');
                if (pendingTab) {
                    pendingTab.click();
                } else {
                    // Fallback: try to find by text content
                    const navLink = document.querySelector('a[href="#pending-accounts"]');
                    if (navLink) {
                        navLink.click();
                    }
                }
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeNewUserNotification();
            }
        });
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeNewUserNotification();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}

/**
 * Close new user notification modal
 */
function closeNewUserNotification() {
    const modal = document.getElementById('newUserNotificationModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (modal && modal.parentNode) {
                modal.remove();
            }
            document.body.style.overflow = 'auto';
        }, 300);
    } else {
        document.body.style.overflow = 'auto';
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', function() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    });
    
    // Refresh buttons
    // Refresh dashboard button removed
    document.getElementById('refreshPendingBtn')?.addEventListener('click', loadPendingAccounts);
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);
    // Search: Pending Accounts
    const pendingSearchInput = document.getElementById('pendingSearchInput');
    const pendingSearchBtn = document.getElementById('pendingSearchBtn');
    if (pendingSearchInput) {
        pendingSearchInput.addEventListener('input', filterPendingAccounts);
        pendingSearchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') filterPendingAccounts();
        });
    }
    if (pendingSearchBtn) {
        pendingSearchBtn.addEventListener('click', filterPendingAccounts);
    }

    // Search: Manage Users
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchBtn = document.getElementById('userSearchBtn');
    if (userSearchInput) {
        userSearchInput.addEventListener('input', filterApprovedUsers);
        userSearchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') filterApprovedUsers();
        });
    }
    if (userSearchBtn) {
        userSearchBtn.addEventListener('click', filterApprovedUsers);
    }
    document.getElementById('refreshAcademicBtn')?.addEventListener('click', loadAllAcademicData);
    document.getElementById('refreshDepartmentsBtn')?.addEventListener('click', loadDepartments);
    document.getElementById('refreshFacultyBtn')?.addEventListener('click', loadFaculty);
    document.getElementById('refreshSubjectsBtn')?.addEventListener('click', loadSubjects);
    document.getElementById('refreshCoursesBtn')?.addEventListener('click', loadCourses);
    document.getElementById('refreshRoomsBtn')?.addEventListener('click', loadRooms);
    
    // Add buttons
    document.getElementById('addDepartmentBtn')?.addEventListener('click', () => showAddModal('department'));
    document.getElementById('addFacultyBtn')?.addEventListener('click', () => showAddModal('faculty'));
    document.getElementById('addSubjectBtn')?.addEventListener('click', () => showAddModal('subject'));
    document.getElementById('addCourseBtn')?.addEventListener('click', () => showAddModal('course'));
    document.getElementById('addRoomBtn')?.addEventListener('click', () => showAddModal('room'));
    
    // Event delegation for all data-action buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-action]')) {
            const button = e.target.closest('[data-action]');
            const action = button.getAttribute('data-action');
            const id = button.getAttribute('data-id');
            
            switch (action) {
                case 'approve':
                    approveUser(id);
                    break;
                case 'reject':
                    rejectUser(id);
                    break;
                case 'edit-user':
                    editUser(id);
                    break;
                case 'delete-user':
                    deleteUser(id);
                    break;
                case 'edit-department':
                    editDepartment(id);
                    break;
                case 'delete-department':
                    deleteDepartment(id);
                    break;
                case 'edit-faculty':
                    editFaculty(id);
                    break;
                case 'delete-faculty':
                    deleteFaculty(id);
                    break;
                case 'restore-faculty':
                    restoreFaculty(id);
                    break;
                case 'send-verification':
                    const email = button.getAttribute('data-email');
                    // Always show modal to enter/confirm email
                    showSendVerificationModal(id, email);
                    break;
                case 'add-email-verification':
                    showAddEmailVerificationModal(id);
                    break;
                case 'edit-subject':
                    editSubject(id);
                    break;
                case 'delete-subject':
                    deleteSubject(id);
                    break;
                case 'edit-course':
                    editCourse(id);
                    break;
                case 'delete-course':
                    deleteCourse(id);
                    break;
                case 'edit-room':
                    editRoom(id);
                    break;
                case 'delete-room':
                    deleteRoom(id);
                    break;
            }
        }
    });

// Data Management Modal Functions - REMOVED DUPLICATE
    // Modal elements
    const backupModal = document.getElementById('backupModal');
    const clearDataInfoModal = document.getElementById('clearDataInfoModal');
    
    // Buttons
    const openBackupModalBtn = document.getElementById('openBackupModalBtn');
    const openClearDataModalBtn = document.getElementById('openClearDataModalBtn');
    const confirmBackupBtn = document.getElementById('confirmBackupBtn');
    const finalClearDataBtn = document.getElementById('finalClearDataBtn');
    
    // Close buttons
    const closeBackupModal = document.getElementById('closeBackupModal');
    const closeClearDataInfoModal = document.getElementById('closeClearDataInfoModal');
    const cancelBackupBtn = document.getElementById('cancelBackupBtn');
    const cancelClearDataInfoBtn = document.getElementById('cancelClearDataInfoBtn');
    
    // Confirmation input
    const confirmClearInput = document.getElementById('confirmClearInput');

    console.log('Initializing data management modals...');
    console.log('Backup button found:', !!openBackupModalBtn);
    console.log('Clear data button found:', !!openClearDataModalBtn);

    // Open backup modal
    if (openBackupModalBtn) {
        openBackupModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Backup button clicked');
            if (backupModal) {
                backupModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        });
    }

    // Open clear data info modal
    if (openClearDataModalBtn) {
        openClearDataModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Clear data button clicked');
            if (clearDataInfoModal) {
                clearDataInfoModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }
        });
    }

    // Close modals
    const closeModal = (modal) => {
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            // Reset clear data confirmation input
            if (modal === clearDataInfoModal && confirmClearInput && finalClearDataBtn) {
                confirmClearInput.value = '';
                finalClearDataBtn.disabled = true;
            }
        }
    };

    if (closeBackupModal) closeBackupModal.addEventListener('click', () => closeModal(backupModal));
    if (closeClearDataInfoModal) closeClearDataInfoModal.addEventListener('click', () => closeModal(clearDataInfoModal));
    if (cancelBackupBtn) cancelBackupBtn.addEventListener('click', () => closeModal(backupModal));
    if (cancelClearDataInfoBtn) cancelClearDataInfoBtn.addEventListener('click', () => closeModal(clearDataInfoModal));

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === backupModal) closeModal(backupModal);
        if (event.target === clearDataInfoModal) closeModal(clearDataInfoModal);
    });

    // Backup functionality and clear data validation - handled in initializeDataManagementModals function above
}

/**
 * Filter rows in Faculty Verification by search term
 */
function filterPendingAccounts() {
    const term = (document.getElementById('pendingSearchInput')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('pendingUsersTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'))
        .filter(r => !r.classList.contains('empty-row'));

    if (rows.length === 0) return;

    let visibleCount = 0;
    rows.forEach(row => {
        const name = (row.cells[0]?.textContent || '').toLowerCase();
        const email = (row.cells[1]?.textContent || '').toLowerCase();
        const dept = (row.cells[2]?.textContent || '').toLowerCase();
        const role = (row.cells[3]?.textContent || '').toLowerCase();
        const requested = (row.cells[4]?.textContent || '').toLowerCase();

        const match = !term ||
            name.includes(term) ||
            email.includes(term) ||
            dept.includes(term) ||
            role.includes(term) ||
            requested.includes(term);

        row.style.display = match ? '' : 'none';
        if (match) visibleCount += 1;
    });

    // Toggle empty state
    const existingEmpty = tbody.querySelector('.empty-state-row');
    if (visibleCount === 0) {
        if (!existingEmpty) {
            const tr = document.createElement('tr');
            tr.className = 'empty-state-row';
            tr.innerHTML = `<td colspan="6" class="empty-state">
                <i class="fas fa-search"></i>
                <p>No faculty verification accounts match your search</p>
            </td>`;
            tbody.appendChild(tr);
        } else {
            existingEmpty.style.display = '';
        }
    } else if (existingEmpty) {
        existingEmpty.style.display = 'none';
    }
}

/**
 * Filter rows in Manage Users by search term
 */
function filterApprovedUsers() {
    const term = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('approvedUsersTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'))
        .filter(r => !r.classList.contains('empty-row'));

    if (rows.length === 0) return;

    let visibleCount = 0;
    rows.forEach(row => {
        const name = (row.cells[0]?.textContent || '').toLowerCase();
        const email = (row.cells[1]?.textContent || '').toLowerCase();
        const dept = (row.cells[2]?.textContent || '').toLowerCase();
        const role = (row.cells[3]?.textContent || '').toLowerCase();
        const status = (row.cells[4]?.textContent || '').toLowerCase();

        const match = !term ||
            name.includes(term) ||
            email.includes(term) ||
            dept.includes(term) ||
            role.includes(term) ||
            status.includes(term);

        row.style.display = match ? '' : 'none';
        if (match) visibleCount += 1;
    });

    // Toggle empty state
    const existingEmpty = tbody.querySelector('.empty-state-row');
    if (visibleCount === 0) {
        if (!existingEmpty) {
            const tr = document.createElement('tr');
            tr.className = 'empty-state-row';
            tr.innerHTML = `<td colspan="6" class="empty-state">
                <i class="fas fa-search"></i>
                <p>No users match your search</p>
            </td>`;
            tbody.appendChild(tr);
        } else {
            existingEmpty.style.display = '';
        }
    } else if (existingEmpty) {
        existingEmpty.style.display = 'none';
    }
}

/**
 * Load dashboard overview data
 */
async function loadDashboardData() {
    try {
        // Load counts for overview cards
        const users = await fetchData('/api/users');
        const departments = await fetchData('/api/departments');
        const faculty = await fetchData('/api/faculty');
        const subjects = await fetchData('/api/subjects');
        const courses = await fetchData('/api/courses');
        const rooms = await fetchData('/api/rooms');
        
        // Filter out hardcoded superadmin account from count
        const filteredUsers = users.filter(user => user.email !== 'superadmin@school.edu');
        
        // Update count displays
        document.getElementById('totalUsersCount').textContent = filteredUsers.length || 0;
        document.getElementById('totalDepartmentsCount').textContent = departments.length || 0;
        document.getElementById('totalFacultyCount').textContent = faculty.length || 0;
        document.getElementById('totalSubjectsCount').textContent = subjects.length || 0;
        document.getElementById('totalCoursesCount').textContent = courses.length || 0;
        document.getElementById('totalRoomsCount').textContent = rooms.length || 0;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

/**
 * Load all academic data at once
 */
async function loadAllAcademicData() {
    try {
        await Promise.all([
            loadDepartments(),
            loadFaculty(),
            loadSubjects(),
            loadCourses(),
            loadRooms()
        ]);
        showNotification('All academic data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error loading academic data:', error);
        showNotification('Failed to load some academic data', 'error');
    }
}

/**
 * Load faculty verification accounts
 */
async function loadPendingAccounts() {
    try {
        const pendingUsers = await fetchData('/api/users/pending');
        console.log('Loaded pending users:', pendingUsers);
        
        // Filter out hardcoded superadmin account
        const filteredPendingUsers = pendingUsers.filter(user => user.email !== 'superadmin@school.edu');
        
        const tbody = document.getElementById('pendingUsersTableBody');
        
        if (!tbody) {
            console.error('Pending users table body not found');
            return;
        }
        
        if (!filteredPendingUsers || filteredPendingUsers.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-clock"></i>
                            <p>No users awaiting verification</p>
                        </div>
                    </td>
                </tr>
            `;
            // Update last known count
            lastPendingCount = 0;
            return;
        }
        
        tbody.innerHTML = filteredPendingUsers.map(user => {
            const displayName = user.name || formatFullName(user.firstName || '', user.middleName || '', user.lastName || '') || user.email;
            return `
            <tr>
                <td>${displayName}</td>
                <td>${user.email || ''}</td>
                <td>${user.department || ''}</td>
                <td>${user.role || ''}</td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
        `;
        }).join('');
        
        // Update last known count
        lastPendingCount = filteredPendingUsers.length;
    } catch (error) {
        console.error('Error loading pending accounts:', error);
        showNotification('Failed to load faculty verification accounts', 'error');
    }
}

/**
 * Load all users
 */
async function loadUsers() {
    try {
        const allUsers = await fetchData('/api/users');
        // Filter to only show approved or denied users (not pending) and exclude hardcoded superadmin
        const users = allUsers.filter(user => {
            // Exclude hardcoded superadmin account
            if (user.email === 'superadmin@school.edu') {
                return false;
            }
            const status = (user.status || '').toLowerCase();
            return status === 'approved' || status === 'denied' || status === 'rejected';
        });
        const tbody = document.getElementById('approvedUsersTableBody');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = users.map(user => {
            const displayName = user.name || formatFullName(user.firstName || '', user.middleName || '', user.lastName || '') || user.email || '';
            const dept = user.department || user.departmentName || '';
            const role = user.role || '';
            const status = (user.status || '').toLowerCase();
            const statusBadgeClass = status === 'approved' || status === 'active' ? 'badge-success' : (status === 'pending' ? 'badge-warning' : 'badge-secondary');
            const statusLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Active';

            return `
            <tr>
                <td>${displayName}</td>
                <td>${user.email || ''}</td>
                <td>${dept}</td>
                <td>${role}</td>
                <td><span class="badge ${statusBadgeClass}">${statusLabel}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-user" data-id="${user.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-user" data-id="${user.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

/**
 * Load departments
 */
async function loadDepartments() {
    try {
        const departments = await fetchData('/api/departments');
        const tbody = document.getElementById('departmentsTableBody');
        
        if (!departments || departments.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">
                        <div class="empty-state">
                            <i class="fas fa-building"></i>
                            <p>No departments found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Store original data for search
        window.originalData.departments = departments;
        
        tbody.innerHTML = departments.map(dept => `
            <tr>
                <td>${dept.code || ''}</td>
                <td>${dept.name || ''}</td>
                <td>${dept.description || 'No description'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-department" data-id="${dept.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-department" data-id="${dept.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading departments:', error);
        showNotification('Failed to load departments', 'error');
    }
}

/**
 * Load faculty
 */
async function loadFaculty() {
    try {
        const faculty = await fetchData('/api/faculty');
        const tbody = document.getElementById('facultyTableBody');
        
        // Filter out superadmin account
        const filteredFaculty = (faculty || []).filter(member => 
            member.email !== 'superadmin@school.edu' &&
            member.role !== 'superadmin' &&
            String(member.role || '').toLowerCase() !== 'superadmin'
        );
        
        // Store original data for search
        window.originalData.faculty = filteredFaculty || [];
        
        if (!filteredFaculty || filteredFaculty.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-user-tie"></i>
                            <p>No faculty found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filteredFaculty.map(member => {
            const isVerified = member.verified === true || member.emailVerified === true;
            const statusBadge = isVerified 
                ? `<span style="color: #5cb85c; font-weight: bold;"><i class="fas fa-check-circle"></i> Verified</span>`
                : `<span style="color: #f0ad4e; font-weight: bold;"><i class="fas fa-clock"></i> Pending</span>`;
            const verificationButton = isVerified 
                ? ``
                : `<button class="btn btn-sm" data-action="send-verification" data-id="${member.id}" data-email="${member.email || ''}" style="background: #e0e7ff; color: #3730a3;">
                        <i class="fas fa-envelope"></i> Send
                    </button>`;
            const employmentTypeBadge = member.employmentType 
                ? `<span style="color: #64748b; font-size: 12px; display: block; margin-top: 3px;">
                    <i class="fas fa-briefcase"></i> ${member.employmentType === 'full-time' ? 'Full-time' : 'Part-time'}
                    ${member.mixedTeaching === true ? ' <span style="color: #8b5cf6;">(Mixed Teaching)</span>' : ''}
                   </span>`
                : '';
            
            return `
            <tr>
                <td>${formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || ''}</td>
                <td>${member.email || ''}</td>
                <td>${member.department || ''}</td>
                <td>${statusBadge}${employmentTypeBadge}</td>
                <td>
                    ${verificationButton}
                    <button class="btn btn-sm btn-primary" data-action="edit-faculty" data-id="${member.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-faculty" data-id="${member.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
        }).join('');
        
        // Also load removed verified faculty
        loadRemovedFaculty();
    } catch (error) {
        console.error('Error loading faculty:', error);
        showNotification('Failed to load faculty', 'error');
    }
}

/**
 * Load removed verified faculty members
 */
async function loadRemovedFaculty() {
    try {
        const removedFaculty = await fetchData('/api/faculty/removed');
        const section = document.getElementById('removedFacultySection');
        const tbody = document.getElementById('removedFacultyTableBody');
        
        if (!removedFaculty || removedFaculty.length === 0) {
            if (section) section.style.display = 'none';
            return;
        }
        
        // Show the section
        if (section) section.style.display = 'block';
        
        tbody.innerHTML = removedFaculty.map(member => {
            return `
            <tr>
                <td>${formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || ''}</td>
                <td>${member.email || 'No email'}</td>
                <td>${member.department || 'Not assigned'}</td>
                <td>
                    <button class="btn btn-sm" data-action="restore-faculty" data-id="${member.id}" style="background: #10b981; color: white;">
                        <i class="fas fa-undo"></i> Restore
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    } catch (error) {
        console.error('Error loading removed faculty:', error);
        // Don't show error notification, just hide the section
        const section = document.getElementById('removedFacultySection');
        if (section) section.style.display = 'none';
    }
}

/**
 * Restore a removed verified faculty member
 */
async function restoreFaculty(id) {
    try {
        // Show modal to select department
        const departments = await fetchData('/api/departments');
        if (!departments || departments.length === 0) {
            showNotification('No departments available. Please create a department first.', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h5 style="margin: 0; color: #1e293b;"><i class="fas fa-undo"></i> Restore Faculty Member</h5>
                    <button type="button" class="close-btn" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #64748b;
                    ">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 20px; color: #374151;">Select a department to restore this verified faculty member:</p>
                    <div>
                        <label for="restoreDepartment" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department <span style="color: red;">*</span></label>
                        <select id="restoreDepartment" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                            box-sizing: border-box;
                        ">
                            <option value="">Select a department...</option>
                            ${departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="
                    padding: 20px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                ">
                    <button type="button" class="btn btn-secondary" id="cancelRestore" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirmRestore" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Restore</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle restore button
        document.getElementById('confirmRestore').addEventListener('click', async () => {
            const departmentId = document.getElementById('restoreDepartment').value;
            if (!departmentId) {
                showNotification('Please select a department', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/faculty', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: id,
                        departmentId: departmentId
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to restore faculty member');
                }
                
                showNotification('Faculty member restored successfully', 'success');
                document.body.removeChild(modal);
                loadFaculty(); // Refresh both lists
                loadRemovedFaculty();
            } catch (error) {
                console.error('Error restoring faculty:', error);
                showNotification(error.message || 'Failed to restore faculty member', 'error');
            }
        });
        
        // Handle cancel button
        document.getElementById('cancelRestore').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Handle close button
        modal.querySelector('.close-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Handle backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    } catch (error) {
        console.error('Error showing restore modal:', error);
        showNotification('Failed to load departments', 'error');
    }
}

/**
 * Load subjects
 */
async function loadSubjects() {
    try {
        console.log('=== LOADING SUBJECTS ===');
        const subjects = await fetchData('/api/subjects');
        console.log('Subjects received:', subjects);
        console.log('Subjects length:', subjects ? subjects.length : 'null');
        
        const tbody = document.getElementById('subjectsTableBody');
        console.log('Table body element:', tbody);
        
        // Store original data for search
        window.originalData.subjects = subjects || [];
        
        if (!subjects || subjects.length === 0) {
            console.log('No subjects found, showing empty state');
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">
                        <div class="empty-state">
                            <i class="fas fa-book"></i>
                            <p>No subjects found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = subjects.map(subject => `
            <tr>
                <td>${subject.code || ''}</td>
                <td>${subject.name || ''}</td>
                <td>${subject.units || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-subject" data-id="${subject.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-subject" data-id="${subject.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading subjects:', error);
        showNotification('Failed to load subjects', 'error');
    }
}

/**
 * Load courses
 */
async function loadCourses() {
    try {
        const courses = await fetchData('/api/courses');
        const tbody = document.getElementById('coursesTableBody');
        
        if (!courses || courses.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-graduation-cap"></i>
                            <p>No courses found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Store original data for search
        window.originalData.courses = courses;
        
        tbody.innerHTML = courses.map(course => `
            <tr>
                <td>${course.code || ''}</td>
                <td>${course.name || ''}</td>
                <td>${course.type || ''}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="
                            width: 20px; 
                            height: 20px; 
                            background-color: ${course.color || '#3b82f6'}; 
                            border-radius: 4px; 
                            border: 1px solid #e5e7eb;
                        "></div>
                        <span style="font-family: monospace; font-size: 12px; color: #6b7280;">
                            ${course.color || '#3b82f6'}
                        </span>
                    </div>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-course" data-id="${course.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-course" data-id="${course.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading courses:', error);
        showNotification('Failed to load courses', 'error');
    }
}

/**
 * Load rooms
 */
async function loadRooms() {
    try {
        // Force fresh data fetch with cache-busting
        const rooms = await fetchData('/api/rooms');
        
        // Log room data for debugging
        console.log('[loadRooms] Loaded rooms:', rooms.length);
        rooms.forEach(room => {
            console.log(`[loadRooms] Room: ${room.name}, priority: ${room.priority}, exclusive: ${room.exclusive}, department: ${room.department || 'none'}`);
        });
        
        const tbody = document.getElementById('roomsTableBody');
        
        // Store original data for search
        window.originalData.rooms = rooms || [];
        
        if (!rooms || rooms.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-door-open"></i>
                            <p>No rooms found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = rooms.map(room => {
            // Determine priority status - handle boolean values properly
            // Check both explicit true and truthy values (in case of string "true")
            const isExclusive = room.exclusive === true || room.exclusive === 'true' || room.exclusive === 1;
            const hasPriority = room.priority === true || room.priority === 'true' || room.priority === 1;
            
            let priorityStatus = 'Shared';
            let priorityClass = 'normal';
            if (isExclusive) {
                priorityStatus = 'Exclusive';
                priorityClass = 'priority';
            } else if (hasPriority) {
                priorityStatus = 'Priority';
                priorityClass = 'priority';
            } else {
                priorityStatus = 'Shared';
                priorityClass = 'normal';
            }
            
            // Department display - show appropriate message based on priority status
            let departmentDisplay = room.department || '';
            if (!departmentDisplay) {
                if (isExclusive || hasPriority) {
                    departmentDisplay = 'No Department Assigned';
                } else {
                    departmentDisplay = 'No Room Priority';
                }
            }
            
            return `
            <tr>
                <td>${room.name || ''}</td>
                <td>${room.capacity || ''}</td>
                <td>${departmentDisplay}</td>
                <td>
                    <span class="status-badge ${priorityClass}">
                        ${priorityStatus}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-room" data-id="${room.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-room" data-id="${room.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    } catch (error) {
        console.error('Error loading rooms:', error);
        showNotification('Failed to load rooms', 'error');
    }
}

/**
 * Generic function to fetch data from API
 */
async function fetchData(endpoint) {
    const authToken = localStorage.getItem('authToken');
    // Bust caches aggressively for API GETs
    try {
        const isApi = typeof endpoint === 'string' && endpoint.startsWith('/api/');
        if (isApi) {
            const sep = endpoint.includes('?') ? '&' : '?';
            endpoint = `${endpoint}${sep}ts=${Date.now()}`;
        }
    } catch (_) {}
    
    try {
        const response = await fetch(endpoint, {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`Endpoint ${endpoint} not found - returning empty array`);
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        // Return empty array for failed requests to prevent UI breaking
        return [];
    }
}

/**
 * Show add modal for different entity types
 */
function showAddModal(entityType) {
    switch (entityType) {
        case 'department':
            showAddDepartmentModal();
            break;
        case 'faculty':
            showAddFacultyModal();
            break;
        case 'subject':
            showAddSubjectModal();
            break;
        case 'course':
            showAddCourseModal();
            break;
        case 'room':
            showAddRoomModal();
            break;
        default:
            showNotification(`Add ${entityType} functionality will be implemented`, 'info');
    }
}

/**
 * Show beautiful notification modal to user
 */
function showNotification(message, type = 'info') {
    const modal = document.getElementById('notificationModal');
    if (!modal) {
        // Fallback to console if modal doesn't exist
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    // Parse message - could be HTML or plain text
    const isHTML = message.includes('<br>') || message.includes('<strong>') || message.includes('<i>');
    
    // Set icon based on type
    const iconMap = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle'
    };
    
    const titleMap = {
        'success': 'Success',
        'error': 'Error',
        'warning': 'Warning',
        'info': 'Information'
    };
    
    const icon = iconMap[type] || iconMap.info;
    const title = titleMap[type] || 'Notification';
    
    // Update modal content
    const notificationContent = modal.querySelector('.notification-content');
    const iconWrapper = modal.querySelector('.notification-icon-wrapper');
    const notificationIcon = modal.querySelector('.notification-icon');
    const notificationTitle = modal.querySelector('.notification-title');
    const notificationText = modal.querySelector('.notification-text');
    
    // Reset classes - add type class to content for border color
    notificationContent.className = 'notification-content ' + type;
    iconWrapper.className = 'notification-icon-wrapper ' + type;
    notificationIcon.className = 'notification-icon ' + icon;
    notificationTitle.textContent = title;
    
    if (isHTML) {
        notificationText.innerHTML = message;
    } else {
        notificationText.textContent = message;
    }
    
    // Reset progress bar
    const progressBar = modal.querySelector('.notification-progress-bar');
    if (progressBar) {
        progressBar.style.transform = 'scaleX(1)';
        progressBar.style.animation = 'none';
        // Force reflow
        progressBar.offsetHeight;
        progressBar.style.animation = 'progressAnimation 4s linear forwards';
    }
    
    // Show modal with animation
    modal.classList.add('show');
    
    // Auto-close after 4 seconds
    const autoCloseTimer = setTimeout(() => {
        hideNotificationModal();
    }, 4000);
    
    // Close button handler
    const closeBtn = modal.querySelector('#closeNotificationModal');
    if (closeBtn) {
        // Remove old listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            hideNotificationModal();
        });
    }
}

/**
 * Hide notification modal
 */
function hideNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

/**
 * Handle import file selection
 */
window.handleImportFileSelect = function(event) {
    console.log('File selection handler called', event);
    const file = event.target.files[0];
    const importFilePreview = document.getElementById('importFilePreview');
    const importFileName = document.getElementById('importFileName');
    const confirmImportDataBtn = document.getElementById('confirmImportDataBtn');
    
    console.log('File selected:', file);
    console.log('Button element:', confirmImportDataBtn);
    
    if (file) {
        const fileName = file.name.toLowerCase();
        const isJson = fileName.endsWith('.json') || file.type === 'application/json';
        
        console.log('File name:', fileName, 'Is JSON:', isJson);
        
        if (isJson) {
            if (importFilePreview && importFileName) {
                importFilePreview.style.display = 'block';
                importFileName.textContent = file.name;
            }
            if (confirmImportDataBtn) {
                confirmImportDataBtn.disabled = false;
                console.log('Button enabled');
            } else {
                console.error('Confirm import button not found!');
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification('Invalid file type. Please select a JSON backup file.', 'error');
            }
            event.target.value = '';
            if (importFilePreview) {
                importFilePreview.style.display = 'none';
            }
            if (confirmImportDataBtn) {
                confirmImportDataBtn.disabled = true;
            }
        }
    } else {
        console.log('No file selected');
        if (importFilePreview) {
            importFilePreview.style.display = 'none';
        }
        if (confirmImportDataBtn) {
            confirmImportDataBtn.disabled = true;
        }
    }
};

/**
 * Show confirmation modal
 */
function showConfirmationModal(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <div style="
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h5 style="margin: 0; color: #1e293b;">${title}</h5>
                    <button type="button" class="close-btn" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #64748b;
                    ">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p style="margin: 0; color: #64748b;">${message}</p>
                </div>
                <div style="
                    padding: 20px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                ">
                    <button type="button" class="btn btn-secondary" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">${cancelText}</button>
                    <button type="button" class="btn btn-danger" id="confirmDelete" style="
                        background: #dc2626;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle confirm button
        document.getElementById('confirmDelete').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
        
        // Handle cancel button
        modal.querySelector('.btn-secondary').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        // Handle close button
        modal.querySelector('.close-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        // Handle backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

/**
 * Show edit user modal
 */
function showEditUserModal(user) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    const displayName = user.name || formatFullName(user.firstName || '', user.middleName || '', user.lastName || '') || user.email || 'User';
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">User Details</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 24px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Name</label>
                    <div style="
                        padding: 12px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 15px;
                        color: #1e293b;
                        font-weight: 500;
                    ">${displayName}</div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Email <span style="color: #ef4444;">*</span></label>
                    <input type="email" id="editUserEmail" value="${user.email || ''}" style="
                        width: 100%;
                        padding: 12px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 15px;
                        color: #1e293b;
                        box-sizing: border-box;
                    " required>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Department</label>
                    <select id="editUserDepartment" style="
                        width: 100%;
                        padding: 12px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 15px;
                        color: #1e293b;
                        box-sizing: border-box;
                    ">
                        <option value="">Not assigned</option>
                    </select>
                </div>
                <div style="margin-bottom: 0;">
                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #374151; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Role <span style="color: #ef4444;">*</span></label>
                    <select id="editUserRole" style="
                        width: 100%;
                        padding: 12px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        font-size: 15px;
                        color: #1e293b;
                        box-sizing: border-box;
                        text-transform: capitalize;
                    " required>
                        <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
                        <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>Superadmin</option>
                    </select>
                </div>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                ">Cancel</button>
                <button type="button" id="saveUserChangesBtn" class="btn btn-primary" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                ">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store user data in modal for save function
    modal.userData = user;
    modal.userId = user.id;
    
    // Load departments into dropdown
    loadDepartmentsForUser(modal, user.departmentId || user.department).then(() => {
        // Set selected department if user has one
        const departmentSelect = modal.querySelector('#editUserDepartment');
        if (departmentSelect && user.department && user.department !== 'Pending Assignment') {
            // Try to find matching department by name or ID
            const options = Array.from(departmentSelect.options);
            const matchingOption = options.find(opt => {
                const optText = opt.textContent.toLowerCase();
                const userDept = (user.department || '').toLowerCase();
                return optText.includes(userDept) || opt.value === user.departmentId;
            });
            if (matchingOption) {
                departmentSelect.value = matchingOption.value;
            }
        }
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle save button
    const saveBtn = modal.querySelector('#saveUserChangesBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveUserChanges(user.id, modal);
        });
    }
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save user changes
 */
async function saveUserChanges(userId, modal) {
    try {
        const email = document.getElementById('editUserEmail').value;
        const departmentSelect = document.getElementById('editUserDepartment');
        const role = document.getElementById('editUserRole').value;
        
        if (!email || !role) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Use the stored user data to preserve the name
        const existingUser = modal.userData;
        if (!existingUser) {
            showNotification('User data not found', 'error');
            return;
        }
        
        // Get department ID and name from selected option
        let departmentId = null;
        let departmentName = '';
        
        if (departmentSelect && departmentSelect.value) {
            departmentId = departmentSelect.value;
            const selectedOption = departmentSelect.options[departmentSelect.selectedIndex];
            // Extract department name from option text (format: "Name (Code)")
            if (selectedOption && selectedOption.textContent) {
                const optionText = selectedOption.textContent.trim();
                // Remove the code part in parentheses if present
                departmentName = optionText.replace(/\s*\([^)]*\)\s*$/, '').trim();
            }
        }
        
        const requestData = {
            name: existingUser.name, // Keep existing name
            email,
            department: departmentName || '',
            departmentId: departmentId || null,
            role
        };
        
        
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error('Server error response:', errorData);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                console.error('Could not parse error response');
            }
            throw new Error(errorMessage);
        }
        
        showNotification('User updated successfully', 'success');
        document.body.removeChild(modal);
        loadUsers(); // Refresh the users list
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Failed to update user', 'error');
    }
}

/**
 * Show add department modal
 */
function showAddDepartmentModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Department</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="addDepartmentForm">
                    <div style="margin-bottom: 20px;">
                        <label for="departmentCode" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department Code</label>
                        <input type="text" id="departmentCode" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                        " placeholder="e.g., CS, IT, ENG">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="departmentName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department Name</label>
                        <input type="text" id="departmentName" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                        " placeholder="e.g., Computer Science">
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveDepartment" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Add Department</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle save button
    document.getElementById('saveDepartment').addEventListener('click', async () => {
        await saveDepartment(modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Show edit department modal
 */
function showEditDepartmentModal(department) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Edit Department</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="editDepartmentForm">
                    <div style="margin-bottom: 20px;">
                        <label for="editDepartmentCode" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department Code</label>
                        <input type="text" id="editDepartmentCode" value="${department.code || ''}" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="editDepartmentName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department Name</label>
                        <input type="text" id="editDepartmentName" value="${department.name || ''}" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveDepartmentChanges" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Color picker functionality for edit modal
    // Handle save button
    document.getElementById('saveDepartmentChanges').addEventListener('click', async () => {
        await saveDepartmentChanges(department.id, modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save new department
 */
async function saveDepartment(modal) {
    try {
        // Get form values before removing modal
        const codeInput = modal.querySelector('#departmentCode');
        const nameInput = modal.querySelector('#departmentName');
        
        if (!codeInput || !nameInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const code = codeInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();
        
        if (!code || !name) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const response = await fetch('/api/departments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Department added successfully', 'success');
        document.body.removeChild(modal);
        loadDepartments(); // Refresh the departments list
    } catch (error) {
        console.error('Error adding department:', error);
        showNotification('Failed to add department', 'error');
    }
}

/**
 * Save department changes
 */
async function saveDepartmentChanges(departmentId, modal) {
    try {
        // Get form values before removing modal
        const codeInput = modal.querySelector('#editDepartmentCode');
        const nameInput = modal.querySelector('#editDepartmentName');
        
        if (!codeInput || !nameInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const code = codeInput.value.trim().toUpperCase();
        const name = nameInput.value.trim();
        
        if (!code || !name) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const response = await fetch(`/api/departments/${departmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Department updated successfully', 'success');
        document.body.removeChild(modal);
        loadDepartments(); // Refresh the departments list
    } catch (error) {
        console.error('Error updating department:', error);
        showNotification('Failed to update department', 'error');
    }
}

/**
 * Show add faculty modal
 */
function showAddFacultyModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 700px;
            width: 90%;
            max-height: 90vh;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Faculty Member</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="
                padding: 20px;
                overflow-y: auto;
                flex: 1;
                max-height: calc(90vh - 140px);
            ">
                <div style="margin-bottom: 20px;">
                    <label for="facultyFirstName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">First Name <span style="color: red;">*</span></label>
                    <input type="text" id="facultyFirstName" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter first name">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="facultyMiddleName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Middle Name <span style="color: #999; font-size: 12px;">(Optional)</span></label>
                    <input type="text" id="facultyMiddleName" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter middle name (optional)">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="facultyLastName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Last Name <span style="color: red;">*</span></label>
                    <input type="text" id="facultyLastName" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter last name">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="facultyEmail" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Email <span style="color: #999; font-size: 12px;">(Optional - for existing teachers)</span></label>
                    <input type="email" id="facultyEmail" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter email (optional)">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="facultyDepartment" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department <span style="color: red;">*</span></label>
                    <select id="facultyDepartment" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                        <option value="">Select Department</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="facultyEmploymentType" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Employment Type <span style="color: red;">*</span></label>
                    <select id="facultyEmploymentType" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                        <option value="">Select Employment Type</option>
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; font-weight: 500; color: #374151;">Teaching Level</label>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="facultyTeachesTertiary" style="
                                width: 18px;
                                height: 18px;
                                cursor: pointer;
                            ">
                            <label for="facultyTeachesTertiary" style="margin: 0; cursor: pointer; color: #374151;">
                                Teaches Tertiary
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="facultyTeachesSHS" style="
                                width: 18px;
                                height: 18px;
                                cursor: pointer;
                            ">
                            <label for="facultyTeachesSHS" style="margin: 0; cursor: pointer; color: #374151;">
                                Teaches SHS
                            </label>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                        <input type="checkbox" id="facultyMixedTeaching" style="
                            width: 18px;
                            height: 18px;
                            cursor: pointer;
                        ">
                        <label for="facultyMixedTeaching" style="margin: 0; cursor: pointer; color: #374151;">
                            Mixed Teaching (teaches both SHS and Tertiary)
                        </label>
                    </div>
                    <small style="color: #64748b; font-size: 12px; display: block; margin-top: 5px;">
                        <strong>Unit Limits:</strong><br>
                        • SHS Teachers: 27 units (no overload)<br>
                        • Tertiary Teachers: 24 units base, unlimited overload<br>
                        • Mixed Teaching: 24 units base, unlimited overload (full-time) or 15 units (part-time)<br>
                        • Part-time: Maximum 15 units
                    </small>
                </div>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                flex-shrink: 0;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveFaculty" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Add Faculty</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load departments
    loadDepartmentsForFaculty(modal);
    
    // Handle mixed teaching checkbox change to disable/enable teaching level checkboxes
    const mixedTeachingCheckbox = modal.querySelector('#facultyMixedTeaching');
    const teachesTertiaryCheckbox = modal.querySelector('#facultyTeachesTertiary');
    const teachesSHSCheckbox = modal.querySelector('#facultyTeachesSHS');
    
    function updateTeachingLevelCheckboxes() {
        const isMixedTeaching = mixedTeachingCheckbox.checked;
        teachesTertiaryCheckbox.disabled = isMixedTeaching;
        teachesSHSCheckbox.disabled = isMixedTeaching;
        
        if (isMixedTeaching) {
            teachesTertiaryCheckbox.checked = false;
            teachesSHSCheckbox.checked = false;
        }
    }
    
    // Make the teaching level checkboxes mutually exclusive (only one can be selected)
    teachesTertiaryCheckbox.addEventListener('change', function() {
        if (this.checked && !mixedTeachingCheckbox.checked) {
            teachesSHSCheckbox.checked = false;
        }
    });
    
    teachesSHSCheckbox.addEventListener('change', function() {
        if (this.checked && !mixedTeachingCheckbox.checked) {
            teachesTertiaryCheckbox.checked = false;
        }
    });
    
    mixedTeachingCheckbox.addEventListener('change', updateTeachingLevelCheckboxes);
    updateTeachingLevelCheckboxes(); // Initialize state
    
    // Handle save button
    document.getElementById('saveFaculty').addEventListener('click', async () => {
        await saveFaculty(modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Load approved users for faculty assignment
 */
async function loadUsersForFaculty(modal) {
    try {
        let users = await fetchData('/api/users');
        const userSelect = modal.querySelector('#facultyUserSelect');
        
        // Filter for approved users who:
        // 1. Are approved
        // 2. Are not admin/superadmin
        // 3. Do not already have a real department assignment (departmentId !== 'pending')
        let approvedUsers = users.filter(user => 
            String(user.status || '').toLowerCase() === 'approved' &&
            String(user.role || '').toLowerCase() !== 'admin' && 
            String(user.role || '').toLowerCase() !== 'superadmin' &&
            (user.departmentId === null || user.departmentId === undefined || String(user.departmentId) === 'pending')
        );

        // Fallback: If empty (due to cache or permissions), try /api/users/approved endpoint
        if (approvedUsers.length === 0) {
            try {
                const approvedEndpoint = '/api/users/approved';
                const approvedOnly = await fetchData(approvedEndpoint);
                if (Array.isArray(approvedOnly) && approvedOnly.length) {
                    users = approvedOnly;
                    approvedUsers = users.filter(user => 
                        String(user.role || '').toLowerCase() !== 'admin' &&
                        String(user.role || '').toLowerCase() !== 'superadmin' &&
                        (user.departmentId === null || user.departmentId === undefined || String(user.departmentId) === 'pending')
                    );
                }
            } catch (_) {}
        }

        // Final retry: short delay then refetch once more in case SW just updated
        if (approvedUsers.length === 0) {
            await new Promise(res => setTimeout(res, 400));
            try {
                const retry = await fetchData('/api/users');
                if (Array.isArray(retry) && retry.length) {
                    approvedUsers = retry.filter(user => 
                        String(user.status || '').toLowerCase() === 'approved' &&
                        String(user.role || '').toLowerCase() !== 'admin' && 
                        String(user.role || '').toLowerCase() !== 'superadmin' &&
                        (user.departmentId === null || user.departmentId === undefined || String(user.departmentId) === 'pending')
                    );
                }
            } catch (_) {}
        }
        
        if (approvedUsers.length > 0) {
            userSelect.innerHTML = '<option value="">Select User</option>' +
                approvedUsers.map(user => `<option value="${user.id}">${user.name || formatFullName(user.firstName || '', user.middleName || '', user.lastName || '')} (${user.email})</option>`).join('');
        } else {
            userSelect.innerHTML = '<option value="">No approved users available</option>';
        }
    } catch (error) {
        console.error('Error loading users for faculty:', error);
        const userSelect = modal.querySelector('#facultyUserSelect');
        userSelect.innerHTML = '<option value="">Error loading users</option>';
    }
}

/**
 * Load departments for user dropdown
 */
async function loadDepartmentsForUser(modal, selectedDepartmentId = null) {
    try {
        const departments = await fetchData('/api/departments');
        const departmentSelect = modal.querySelector('#editUserDepartment');
        
        if (!departmentSelect) {
            console.error('Department select not found in modal');
            return Promise.resolve();
        }
        
        if (departments && departments.length > 0) {
            departmentSelect.innerHTML = '<option value="">Not assigned</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name} (${dept.code})</option>`).join('');
            
            // Set selected department if provided
            if (selectedDepartmentId) {
                const matchingOption = Array.from(departmentSelect.options).find(opt => 
                    opt.value === String(selectedDepartmentId) || 
                    opt.textContent.toLowerCase().includes(String(selectedDepartmentId).toLowerCase())
                );
                if (matchingOption) {
                    departmentSelect.value = matchingOption.value;
                }
            }
        } else {
            departmentSelect.innerHTML = '<option value="">No departments available</option>';
        }
        return Promise.resolve();
    } catch (error) {
        console.error('Error loading departments for user:', error);
        const departmentSelect = modal.querySelector('#editUserDepartment');
        if (departmentSelect) {
            departmentSelect.innerHTML = '<option value="">Error loading departments</option>';
        }
        return Promise.resolve();
    }
}

/**
 * Load departments for faculty dropdown
 */
async function loadDepartmentsForFaculty(modal) {
    try {
        const departments = await fetchData('/api/departments');
        // Try both selectors - for add faculty and edit faculty modals
        const departmentSelect = modal.querySelector('#editFacultyDepartment') || modal.querySelector('#facultyDepartment');
        
        if (!departmentSelect) {
            console.error('Department select not found in modal');
            return;
        }
        
        if (departments && departments.length > 0) {
            departmentSelect.innerHTML = '<option value="">Select Department</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name} (${dept.code})</option>`).join('');
        } else {
            departmentSelect.innerHTML = '<option value="">No departments available</option>';
        }
    } catch (error) {
        console.error('Error loading departments for faculty:', error);
        const departmentSelect = modal.querySelector('#editFacultyDepartment') || modal.querySelector('#facultyDepartment');
        if (departmentSelect) {
            departmentSelect.innerHTML = '<option value="">Error loading departments</option>';
        }
    }
}

/**
 * Save new faculty member (create new faculty)
 */
async function saveFaculty(modal) {
    try {
        // Get form values before removing modal
        const firstNameInput = modal.querySelector('#facultyFirstName');
        const middleNameInput = modal.querySelector('#facultyMiddleName');
        const lastNameInput = modal.querySelector('#facultyLastName');
        const emailInput = modal.querySelector('#facultyEmail');
        const departmentInput = modal.querySelector('#facultyDepartment');
        const employmentTypeInput = modal.querySelector('#facultyEmploymentType');
        const mixedTeachingInput = modal.querySelector('#facultyMixedTeaching');
        const teachesTertiaryInput = modal.querySelector('#facultyTeachesTertiary');
        const teachesSHSInput = modal.querySelector('#facultyTeachesSHS');
        
        if (!firstNameInput || !lastNameInput || !emailInput || !departmentInput || !employmentTypeInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const firstName = firstNameInput.value.trim();
        const middleName = middleNameInput ? middleNameInput.value.trim() : '';
        const lastName = lastNameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase() || null;
        const departmentId = departmentInput.value;
        const employmentType = employmentTypeInput.value;
        const mixedTeaching = mixedTeachingInput ? mixedTeachingInput.checked : false;
        const teachesTertiary = teachesTertiaryInput ? teachesTertiaryInput.checked : false;
        const teachesSHS = teachesSHSInput ? teachesSHSInput.checked : false;
        
        if (!firstName || !lastName || !departmentId || !employmentType) {
            showNotification('Please fill in all required fields (First Name, Last Name, Department, Employment Type)', 'error');
            return;
        }
        
        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email address or leave it empty', 'error');
                return;
            }
        }
        
        const response = await fetch('/api/faculty/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                middleName: middleName || '',
                lastName,
                email,
                departmentId,
                employmentType,
                mixedTeaching,
                teachesTertiary,
                teachesSHS
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Faculty member added successfully', 'success');
        document.body.removeChild(modal);
        loadFaculty(); // Refresh the faculty list
    } catch (error) {
        console.error('Error creating faculty:', error);
        showNotification(error.message || 'Failed to create faculty member', 'error');
    }
}

/**
 * Show edit faculty modal
 */
function showEditFacultyModal(faculty) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 700px;
            width: 90%;
            max-height: 90vh;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            ">
                <h5 style="margin: 0; color: #1e293b;">Update Faculty Assignment</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="
                padding: 20px;
                overflow-y: auto;
                flex: 1;
                max-height: calc(90vh - 140px);
            ">
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyFirstName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">First Name <span style="color: red;">*</span></label>
                    <input type="text" id="editFacultyFirstName" required value="${faculty.firstName || ''}" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter first name">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyMiddleName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Middle Name <span style="color: #999; font-size: 12px;">(Optional)</span></label>
                    <input type="text" id="editFacultyMiddleName" value="${faculty.middleName || ''}" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter middle name (optional)">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyLastName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Last Name <span style="color: red;">*</span></label>
                    <input type="text" id="editFacultyLastName" required value="${faculty.lastName || ''}" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter last name">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyEmail" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Email</label>
                    <input type="email" id="editFacultyEmail" value="${faculty.email || ''}" style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter email">
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyDepartment" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Department <span style="color: red;">*</span></label>
                    <select id="editFacultyDepartment" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                        <option value="">Select Department</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label for="editFacultyEmploymentType" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Employment Type <span style="color: red;">*</span></label>
                    <select id="editFacultyEmploymentType" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                    ">
                        <option value="">Select Employment Type</option>
                        <option value="full-time" ${faculty.employmentType === 'full-time' ? 'selected' : ''}>Full-time</option>
                        <option value="part-time" ${faculty.employmentType === 'part-time' ? 'selected' : ''}>Part-time</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; font-weight: 500; color: #374151;">Teaching Level</label>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="editFacultyTeachesTertiary" ${faculty.teachesTertiary === true ? 'checked' : ''} style="
                                width: 18px;
                                height: 18px;
                                cursor: pointer;
                            ">
                            <label for="editFacultyTeachesTertiary" style="margin: 0; cursor: pointer; color: #374151;">
                                Teaches Tertiary
                            </label>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" id="editFacultyTeachesSHS" ${faculty.teachesSHS === true ? 'checked' : ''} style="
                                width: 18px;
                                height: 18px;
                                cursor: pointer;
                            ">
                            <label for="editFacultyTeachesSHS" style="margin: 0; cursor: pointer; color: #374151;">
                                Teaches SHS
                            </label>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                        <input type="checkbox" id="editFacultyMixedTeaching" ${faculty.mixedTeaching === true ? 'checked' : ''} style="
                            width: 18px;
                            height: 18px;
                            cursor: pointer;
                        ">
                        <label for="editFacultyMixedTeaching" style="margin: 0; cursor: pointer; color: #374151;">
                            Mixed Teaching (teaches both SHS and Tertiary)
                        </label>
                    </div>
                    <small style="color: #64748b; font-size: 12px; display: block; margin-top: 5px;">
                        <strong>Unit Limits:</strong><br>
                        • SHS Teachers: 27 units (no overload)<br>
                        • Tertiary Teachers: 24 units base, unlimited overload<br>
                        • Mixed Teaching: 24 units base, unlimited overload (full-time) or 15 units (part-time)<br>
                        • Part-time: Maximum 15 units
                    </small>
                </div>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                flex-shrink: 0;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveFacultyChanges" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Update Assignment</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load departments into the dropdown
    loadDepartmentsForFaculty(modal);
    
    // Set the selected department
    setTimeout(() => {
        const departmentSelect = modal.querySelector('#editFacultyDepartment');
        if (faculty.departmentId) {
            departmentSelect.value = faculty.departmentId;
        }
    }, 100);
    
    // Handle mixed teaching checkbox change to disable/enable teaching level checkboxes
    const mixedTeachingCheckbox = modal.querySelector('#editFacultyMixedTeaching');
    const teachesTertiaryCheckbox = modal.querySelector('#editFacultyTeachesTertiary');
    const teachesSHSCheckbox = modal.querySelector('#editFacultyTeachesSHS');
    
    function updateTeachingLevelCheckboxes() {
        const isMixedTeaching = mixedTeachingCheckbox.checked;
        teachesTertiaryCheckbox.disabled = isMixedTeaching;
        teachesSHSCheckbox.disabled = isMixedTeaching;
        
        if (isMixedTeaching) {
            teachesTertiaryCheckbox.checked = false;
            teachesSHSCheckbox.checked = false;
        }
    }
    
    // Make the teaching level checkboxes mutually exclusive (only one can be selected)
    teachesTertiaryCheckbox.addEventListener('change', function() {
        if (this.checked && !mixedTeachingCheckbox.checked) {
            teachesSHSCheckbox.checked = false;
        }
    });
    
    teachesSHSCheckbox.addEventListener('change', function() {
        if (this.checked && !mixedTeachingCheckbox.checked) {
            teachesTertiaryCheckbox.checked = false;
        }
    });
    
    mixedTeachingCheckbox.addEventListener('change', updateTeachingLevelCheckboxes);
    updateTeachingLevelCheckboxes(); // Initialize state
    
    // Handle save button
    document.getElementById('saveFacultyChanges').addEventListener('click', async () => {
        await saveFacultyChanges(faculty.id, modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save faculty changes (update department assignment)
 */
async function saveFacultyChanges(facultyId, modal) {
    try {
        // Get form values before removing modal
        const firstNameInput = modal.querySelector('#editFacultyFirstName');
        const middleNameInput = modal.querySelector('#editFacultyMiddleName');
        const lastNameInput = modal.querySelector('#editFacultyLastName');
        const emailInput = modal.querySelector('#editFacultyEmail');
        const departmentInput = modal.querySelector('#editFacultyDepartment');
        const employmentTypeInput = modal.querySelector('#editFacultyEmploymentType');
        const mixedTeachingInput = modal.querySelector('#editFacultyMixedTeaching');
        const teachesTertiaryInput = modal.querySelector('#editFacultyTeachesTertiary');
        const teachesSHSInput = modal.querySelector('#editFacultyTeachesSHS');
        
        if (!firstNameInput || !lastNameInput || !departmentInput || !employmentTypeInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const firstName = firstNameInput.value.trim();
        const middleName = middleNameInput ? middleNameInput.value.trim() : '';
        const lastName = lastNameInput.value.trim();
        const email = emailInput ? emailInput.value.trim() : '';
        const departmentId = departmentInput.value;
        const employmentType = employmentTypeInput.value;
        const mixedTeaching = mixedTeachingInput ? mixedTeachingInput.checked : false;
        const teachesTertiary = teachesTertiaryInput ? teachesTertiaryInput.checked : false;
        const teachesSHS = teachesSHSInput ? teachesSHSInput.checked : false;
        
        if (!firstName || !lastName) {
            showNotification('Please fill in first name and last name', 'error');
            return;
        }
        
        if (!departmentId) {
            showNotification('Please select a department', 'error');
            return;
        }
        
        if (!employmentType) {
            showNotification('Please select an employment type', 'error');
            return;
        }
        
        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email address or leave it empty', 'error');
                return;
            }
        }
        
        const response = await fetch(`/api/faculty/${facultyId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                middleName: middleName || '',
                lastName,
                email: email || null,
                departmentId,
                employmentType,
                mixedTeaching,
                teachesTertiary,
                teachesSHS
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Faculty assignment updated successfully', 'success');
        document.body.removeChild(modal);
        loadFaculty(); // Refresh the faculty list
    } catch (error) {
        console.error('Error updating faculty:', error);
        showNotification('Failed to update faculty assignment', 'error');
    }
}

/**
 * Show add subject modal
 */
function showAddSubjectModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Subject/Course</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="addSubjectForm">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label for="subjectCode" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Subject Area</label>
                            <input type="text" id="subjectCode" required style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., Mathematics, Science, English">
                        </div>
                        <div>
                            <label for="subjectName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Subject Name</label>
                            <input type="text" id="subjectName" required style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., Introduction to Programming">
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="subjectUnits" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Units</label>
                        <input type="number" id="subjectUnits" min="0.5" max="6" step="0.1" value="3" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                        " placeholder="e.g., 1.5, 3.2">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label for="subjectLectureHours" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Lecture Hours</label>
                            <input type="number" id="subjectLectureHours" min="0" max="10" value="0" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., 2">
                        </div>
                        <div>
                            <label for="subjectLabHours" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Laboratory Hours</label>
                            <input type="number" id="subjectLabHours" min="0" max="10" value="0" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., 3">
                        </div>
                    </div>
                    <div style="
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 12px;
                        background: #f8fafc;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Time Split Options</div>
                        <label style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px; color: #0f172a; font-size: 0.9rem;">
                            <input type="checkbox" id="subjectSplitLectureHours" style="width: 16px; height: 16px;">
                            Split lecture hours across two days (requires at least one gap day)
                        </label>
                        <label style="display: flex; gap: 10px; align-items: center; color: #0f172a; font-size: 0.9rem;">
                            <input type="checkbox" id="subjectSplitLabHours" style="width: 16px; height: 16px;">
                            Split laboratory hours across two days (requires at least one gap day)
                        </label>
                        <p style="margin: 8px 0 0; font-size: 0.8rem; color: #475569;">Enable these options if long lecture or lab blocks should be broken into two sessions when generating schedules.</p>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveSubject" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Add Subject</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle save button
    document.getElementById('saveSubject').addEventListener('click', async () => {
        await saveSubject(modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Load programs/strands for subject dropdown (handles both add and edit modals)
 */
async function loadProgramsForSubject(modal) {
    try {
        // Fetch all courses and strands
        const courses = await fetchData('/api/courses');
        const strands = await fetchData('/api/strands');
        
        // Combine courses and strands
        const allPrograms = [...(courses || []), ...(strands || [])];
        
        // Try both selectors - one for add modal, one for edit modal
        const programsSelect = modal.querySelector('#subjectPrograms') || modal.querySelector('#editSubjectPrograms');
        
        if (!programsSelect) {
            console.error('Programs select not found in modal');
            return Promise.resolve();
        }
        
        if (allPrograms && allPrograms.length > 0) {
            programsSelect.innerHTML = allPrograms.map(prog => 
                `<option value="${prog.id || prog.code}">${prog.code || ''} - ${prog.name || ''}</option>`
            ).join('');
        } else {
            programsSelect.innerHTML = '<option value="">No programs/strands available</option>';
        }
        return Promise.resolve();
    } catch (error) {
        console.error('Error loading programs/strands for subject:', error);
        const programsSelect = modal.querySelector('#subjectPrograms') || modal.querySelector('#editSubjectPrograms');
        if (programsSelect) {
            programsSelect.innerHTML = '<option value="">Error loading programs/strands</option>';
        }
        return Promise.resolve();
    }
}

/**
 * Save new subject
 */
async function saveSubject(modal) {
    try {
        // Get form values before removing modal
        const codeInput = modal.querySelector('#subjectCode');
        const nameInput = modal.querySelector('#subjectName');
        const unitsInput = modal.querySelector('#subjectUnits');
        const lectureHoursInput = modal.querySelector('#subjectLectureHours');
        const labHoursInput = modal.querySelector('#subjectLabHours');
        const splitLectureInput = modal.querySelector('#subjectSplitLectureHours');
        const splitLabInput = modal.querySelector('#subjectSplitLabHours');
        
        if (!codeInput || !nameInput || !unitsInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const code = codeInput.value.trim();
        const name = nameInput.value.trim();
        const units = parseFloat(unitsInput.value);
        const lectureHours = lectureHoursInput ? parseInt(lectureHoursInput.value) || 0 : 0;
        const labHours = labHoursInput ? parseInt(labHoursInput.value) || 0 : 0;
        const splitLectureHours = splitLectureInput ? splitLectureInput.checked : false;
        const splitLabHours = splitLabInput ? splitLabInput.checked : false;
        
        if (!code || !name || !units || isNaN(units)) {
            showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }
        
        const response = await fetch('/api/subjects', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name,
                units,
                lectureHours,
                labHours,
                splitLectureHours,
                splitLabHours
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            // Handle specific error cases
            if (response.status === 409) {
                showNotification(`Subject with area "${code}" already exists. Please use a different area.`, 'error');
                return; // Don't close modal, let user fix the area
            }
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Subject added successfully:', result);
        showNotification('Subject added successfully', 'success');
        document.body.removeChild(modal);
        console.log('About to refresh subjects list...');
        loadSubjects(); // Refresh the subjects list
    } catch (error) {
        console.error('Error adding subject:', error);
        showNotification('Failed to add subject', 'error');
    }
}

/**
 * Show edit subject modal
 */
function showEditSubjectModal(subject) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Edit Subject/Course</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="editSubjectForm">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label for="editSubjectCode" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Subject Area</label>
                            <input type="text" id="editSubjectCode" value="${subject.code || ''}" required style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            ">
                        </div>
                        <div>
                            <label for="editSubjectName" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Subject Name</label>
                            <input type="text" id="editSubjectName" value="${subject.name || ''}" required style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            ">
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="editSubjectUnits" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Units</label>
                        <input type="number" id="editSubjectUnits" min="0.5" max="6" step="0.1" value="${subject.units || 3}" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 14px;
                            " placeholder="e.g., 1.5, 3.2">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label for="editSubjectLectureHours" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Lecture Hours</label>
                            <input type="number" id="editSubjectLectureHours" min="0" max="10" value="${subject.lectureHours || 0}" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., 2">
                        </div>
                        <div>
                            <label for="editSubjectLabHours" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Laboratory Hours</label>
                            <input type="number" id="editSubjectLabHours" min="0" max="10" value="${subject.labHours || 0}" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                            " placeholder="e.g., 3">
                        </div>
                    </div>
                    <div style="
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 12px;
                        background: #f8fafc;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Time Split Options</div>
                        <label style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px; color: #0f172a; font-size: 0.9rem;">
                            <input type="checkbox" id="editSubjectSplitLectureHours" ${subject.splitLectureHours ? 'checked' : ''} style="width: 16px; height: 16px;">
                            Split lecture hours across two days (requires at least one gap day)
                        </label>
                        <label style="display: flex; gap: 10px; align-items: center; color: #0f172a; font-size: 0.9rem;">
                            <input type="checkbox" id="editSubjectSplitLabHours" ${subject.splitLabHours ? 'checked' : ''} style="width: 16px; height: 16px;">
                            Split laboratory hours across two days (requires at least one gap day)
                        </label>
                        <p style="margin: 8px 0 0; font-size: 0.8rem; color: #475569;">These settings control whether long lecture or lab blocks are automatically split when generating schedules.</p>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveSubjectChanges" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle save button
    document.getElementById('saveSubjectChanges').addEventListener('click', async () => {
        await saveSubjectChanges(subject.id, modal);
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save subject changes
 */
async function saveSubjectChanges(subjectId, modal) {
    try {
        // Get form values before removing modal
        const codeInput = modal.querySelector('#editSubjectCode');
        const nameInput = modal.querySelector('#editSubjectName');
        const unitsInput = modal.querySelector('#editSubjectUnits');
        const lectureHoursInput = modal.querySelector('#editSubjectLectureHours');
        const labHoursInput = modal.querySelector('#editSubjectLabHours');
        const splitLectureInput = modal.querySelector('#editSubjectSplitLectureHours');
        const splitLabInput = modal.querySelector('#editSubjectSplitLabHours');
        
        if (!codeInput || !nameInput || !unitsInput) {
            showNotification('Form elements not found', 'error');
            return;
        }
        
        const code = codeInput.value.trim();
        const name = nameInput.value.trim();
        const units = parseFloat(unitsInput.value);
        const lectureHours = lectureHoursInput ? parseInt(lectureHoursInput.value) || 0 : 0;
        const labHours = labHoursInput ? parseInt(labHoursInput.value) || 0 : 0;
        const splitLectureHours = splitLectureInput ? splitLectureInput.checked : false;
        const splitLabHours = splitLabInput ? splitLabInput.checked : false;
        
        if (!code || !name || !units || isNaN(units)) {
            showNotification('Please fill in all required fields with valid values', 'error');
            return;
        }
        
        const response = await fetch(`/api/subjects/${subjectId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name,
                units,
                lectureHours,
                labHours,
                splitLectureHours,
                splitLabHours
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Subject updated successfully', 'success');
        document.body.removeChild(modal);
        loadSubjects(); // Refresh the subjects list
    } catch (error) {
        console.error('Error updating subject:', error);
        showNotification('Failed to update subject', 'error');
    }
}

// Function to refresh subjects list and show existing subjects
window.refreshSubjects = async function() {
    console.log('Manually refreshing subjects list...');
    await loadSubjects();
};

// Function to check server subjects directly
window.checkServerSubjects = async function() {
    try {
        const response = await fetch('/api/subjects', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        const subjects = await response.json();
        console.log('Direct server response:', subjects);
        console.log('Number of subjects:', subjects ? subjects.length : 'null');
        return subjects;
    } catch (error) {
        console.error('Error checking server subjects:', error);
        return null;
    }
};

// Force load subjects and show them
window.forceLoadSubjects = async function() {
    console.log('=== FORCE LOADING SUBJECTS ===');
    try {
        const subjects = await fetchData('/api/subjects');
        console.log('Force loaded subjects:', subjects);
        
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) {
            console.error('Table body not found!');
            return;
        }
        
        if (!subjects || subjects.length === 0) {
            console.log('No subjects found in force load');
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4">
                        <div class="empty-state">
                            <i class="fas fa-book"></i>
                            <p>No subjects found</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log('Rendering subjects in table...');
        tbody.innerHTML = subjects.map(subject => `
            <tr>
                <td>${subject.code || ''}</td>
                <td>${subject.name || ''}</td>
                <td>${subject.units || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary" data-action="edit-subject" data-id="${subject.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-subject" data-id="${subject.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `).join('');
        
        console.log('Subjects rendered successfully!');
    } catch (error) {
        console.error('Error in forceLoadSubjects:', error);
    }
};

// Debug function to test subjects loading
window.debugSubjects = async function() {
    console.log('=== DEBUG SUBJECTS ===');
    try {
        const subjects = await fetchData('/api/subjects');
        console.log('Subjects from API:', subjects);
        console.log('Subjects length:', subjects ? subjects.length : 'null/undefined');
        
        const tbody = document.getElementById('subjectsTableBody');
        console.log('Table body element:', tbody);
        
        if (subjects && subjects.length > 0) {
            console.log('Rendering subjects...');
            tbody.innerHTML = subjects.map(subject => `
                <tr>
                    <td>${subject.code || ''}</td>
                    <td>${subject.name || ''}</td>
                    <td>${subject.department || ''}</td>
                    <td>${subject.units || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" data-action="edit-subject" data-id="${subject.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="delete-subject" data-id="${subject.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `).join('');
            console.log('Subjects rendered successfully');
        } else {
            console.log('No subjects found, showing empty state');
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">
                        <div class="empty-state">
                            <i class="fas fa-book"></i>
                            <p>No subjects found</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error in debugSubjects:', error);
    }
};

// Action functions for pending users
async function approveUser(id) {
    console.log('Attempting to approve user with ID:', id);
    try {
        const response = await fetch(`/api/users/${id}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('User approved successfully', 'success');
        // Refresh lists so add-faculty sees the new approved user without hard refresh
        await Promise.all([
            loadPendingAccounts(),
            loadUsers()
        ]);
    } catch (error) {
        console.error('Error approving user:', error);
        showNotification('Failed to approve user', 'error');
    }
}

async function rejectUser(id) {
    console.log('Attempting to reject user with ID:', id);
    // Show confirmation dialog
    const confirmed = await showConfirmationModal(
        'Reject User',
        'Are you sure you want to reject this user? This action cannot be undone.',
        'Reject',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/users/${id}/reject`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('User rejected successfully', 'success');
        loadPendingAccounts(); // Refresh the pending accounts list
    } catch (error) {
        console.error('Error rejecting user:', error);
        showNotification('Failed to reject user', 'error');
    }
}

// Action functions for manage users
async function editUser(id) {
    try {
        // Fetch user data
        const user = await fetchData(`/api/users/${id}`);
        if (!user) {
            showNotification('User not found', 'error');
            return;
        }
        
        
        // Show edit modal (you can implement a modal here)
        showEditUserModal(user);
    } catch (error) {
        console.error('Error loading user:', error);
        showNotification('Failed to load user data', 'error');
    }
}

async function deleteUser(id) {
    // Show confirmation dialog
    const confirmed = await showConfirmationModal(
        'Delete User',
        'Are you sure you want to delete this user? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('User deleted successfully', 'success');
        loadUsers(); // Refresh the users list
        loadFaculty(); // Refresh faculty list (user will be removed if they were faculty)
        loadRemovedFaculty(); // Refresh removed faculty list (user will appear here if they were verified faculty)
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

async function editDepartment(id) {
    try {
        // Fetch department data
        const department = await fetchData(`/api/departments/${id}`);
        if (!department) {
            showNotification('Department not found', 'error');
            return;
        }
        
        // Show edit modal
        showEditDepartmentModal(department);
    } catch (error) {
        console.error('Error loading department:', error);
        showNotification('Failed to load department data', 'error');
    }
}

async function deleteDepartment(id) {
    // Show confirmation dialog
    const confirmed = await showConfirmationModal(
        'Delete Department',
        'Are you sure you want to delete this department? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/departments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Department deleted successfully', 'success');
        loadDepartments(); // Refresh the departments list
    } catch (error) {
        console.error('Error deleting department:', error);
        showNotification('Failed to delete department', 'error');
    }
}

async function editFaculty(id) {
    try {
        // Fetch faculty data
        const faculty = await fetchData(`/api/faculty/${id}`);
        if (!faculty) {
            showNotification('Faculty member not found', 'error');
            return;
        }
        
        // Show edit modal
        showEditFacultyModal(faculty);
    } catch (error) {
        console.error('Error loading faculty:', error);
        showNotification('Failed to load faculty data', 'error');
    }
}

async function deleteFaculty(id) {
    // Show confirmation dialog
    const confirmed = await showConfirmationModal(
        'Delete Faculty Member',
        'Are you sure you want to delete this faculty member? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/faculty/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Faculty member deleted successfully', 'success');
        loadFaculty(); // Refresh the faculty list
    } catch (error) {
        console.error('Error deleting faculty:', error);
        showNotification('Failed to delete faculty member', 'error');
    }
}

/**
 * Show modal to enter email and send verification
 */
function showSendVerificationModal(facultyId, existingEmail = null) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Send Verification Email</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <label for="verificationEmailInput" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Teacher Email <span style="color: red;">*</span></label>
                    <input type="email" id="verificationEmailInput" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter teacher email address" value="${existingEmail || ''}">
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">The teacher will receive a verification link to activate their account.</p>
                </div>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="confirmSendVerification" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Send Verification</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle send button
    document.getElementById('confirmSendVerification').addEventListener('click', async () => {
        const emailInput = modal.querySelector('#verificationEmailInput');
        const email = emailInput.value.trim().toLowerCase();
        
        if (!email) {
            showNotification('Please enter an email address', 'error');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        // Update faculty email if it's different, then send verification
        try {
            // First, update the faculty member's email if needed
            const updateResponse = await fetch(`/api/faculty/${facultyId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(errorData.error || 'Failed to update email');
            }
            
            // Now send verification
            await sendFacultyVerification(facultyId, email);
            document.body.removeChild(modal);
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Failed to send verification', 'error');
        }
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Show modal to add email and send verification (for faculty without email)
 */
function showAddEmailVerificationModal(facultyId) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Email & Send Verification</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <label for="verificationEmail" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">Teacher Email <span style="color: red;">*</span></label>
                    <input type="email" id="verificationEmail" required style="
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 4px;
                        font-size: 14px;
                        box-sizing: border-box;
                    " placeholder="Enter teacher email address">
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">The teacher will receive a verification link to activate their account.</p>
                </div>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="sendVerificationWithEmail" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Send Verification</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle send button
    document.getElementById('sendVerificationWithEmail').addEventListener('click', async () => {
        const emailInput = modal.querySelector('#verificationEmail');
        const email = emailInput.value.trim().toLowerCase();
        
        if (!email) {
            showNotification('Please enter an email address', 'error');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        // Update faculty email first, then send verification
        try {
            // Update the faculty member's email
            const updateResponse = await fetch(`/api/faculty/${facultyId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(errorData.error || 'Failed to update email');
            }
            
            // Now send verification
            await sendFacultyVerification(facultyId, email);
            document.body.removeChild(modal);
        } catch (error) {
            console.error('Error:', error);
            showNotification(error.message || 'Failed to send verification', 'error');
        }
    });
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Send verification email to faculty member
 */
async function sendFacultyVerification(facultyId, email) {
    try {
        const response = await fetch(`/api/faculty/${facultyId}/send-verification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        showNotification(data.message || 'Verification email sent successfully', 'success');
        loadFaculty(); // Refresh the faculty list
    } catch (error) {
        console.error('Error sending verification email:', error);
        showNotification(error.message || 'Failed to send verification email', 'error');
    }
}

async function editSubject(id) {
    try {
        // Fetch subject data
        const subject = await fetchData(`/api/subjects/${id}`);
        if (!subject) {
            showNotification('Subject not found', 'error');
            return;
        }
        
        // Show edit modal
        showEditSubjectModal(subject);
    } catch (error) {
        console.error('Error loading subject:', error);
        showNotification('Failed to load subject data', 'error');
    }
}

async function deleteSubject(id) {
    // Show confirmation dialog
    const confirmed = await showConfirmationModal(
        'Delete Subject',
        'Are you sure you want to delete this subject? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/subjects/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Subject deleted successfully', 'success');
        loadSubjects(); // Refresh the subjects list
    } catch (error) {
        console.error('Error deleting subject:', error);
        showNotification('Failed to delete subject', 'error');
    }
}

async function editCourse(id) {
    try {
        const response = await fetch(`/api/courses/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const course = await response.json();
        showEditCourseModal(course);
    } catch (error) {
        console.error('Error loading course:', error);
        showNotification('Failed to load course details', 'error');
    }
}

async function deleteCourse(id) {
    const confirmed = await showConfirmationModal(
        'Delete Program/Strand',
        'Are you sure you want to delete this program/strand? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/courses/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Program/Strand deleted successfully', 'success');
        loadCourses(); // Refresh the courses list
    } catch (error) {
        console.error('Error deleting course:', error);
        showNotification('Failed to delete program/strand', 'error');
    }
}

async function editRoom(id) {
    try {
        const response = await fetch(`/api/rooms/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const room = await response.json();
        showEditRoomModal(room);
    } catch (error) {
        console.error('Error loading room:', error);
        showNotification('Failed to load room details', 'error');
    }
}

async function deleteRoom(id) {
    const confirmed = await showConfirmationModal(
        'Delete Room',
        'Are you sure you want to delete this room? This action cannot be undone.',
        'Delete',
        'Cancel'
    );
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/api/rooms/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Room deleted successfully', 'success');
        loadRooms(); // Refresh the rooms list
    } catch (error) {
        console.error('Error deleting room:', error);
        showNotification('Failed to delete room', 'error');
    }
}

/**
 * Show add course modal
 */
function showAddCourseModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Program/Strand</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="addCourseForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Code *</label>
                        <input type="text" id="courseCode" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " placeholder="e.g., BSIT, ABM, STEM">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Name *</label>
                        <input type="text" id="courseName" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " placeholder="e.g., Bachelor of Science in Information Technology">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Type *</label>
                        <select id="courseType" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        ">
                            <option value="">Select Type</option>
                            <option value="program">Program</option>
                            <option value="strand">Strand</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="courseColor" style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Color</label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="color" id="courseColor" value="#3b82f6" style="
                                width: 50px;
                                height: 40px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                cursor: pointer;
                            ">
                            <input type="text" id="courseColorText" value="#3b82f6" style="
                                flex: 1;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                                font-family: monospace;
                            " placeholder="#3b82f6">
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="color-preset-course" data-color="#3b82f6" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #3b82f6; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#10b981" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #10b981; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#f59e0b" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #f59e0b; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#ef4444" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #ef4444; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#8b5cf6" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #8b5cf6; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#06b6d4" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #06b6d4; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#84cc16" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #84cc16; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course" data-color="#f97316" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #f97316; cursor: pointer; transition: all 0.2s;
                            "></button>
                        </div>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveCourseBtn" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Program/Strand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Color picker functionality
    const colorInput = modal.querySelector('#courseColor');
    const colorTextInput = modal.querySelector('#courseColorText');
    const colorPresets = modal.querySelectorAll('.color-preset-course');
    
    // Sync color picker with text input
    if (colorInput && colorTextInput) {
        colorInput.addEventListener('input', () => {
            colorTextInput.value = colorInput.value;
        });
        
        colorTextInput.addEventListener('input', () => {
            if (/^#[0-9A-F]{6}$/i.test(colorTextInput.value)) {
                colorInput.value = colorTextInput.value;
            }
        });
    }
    
    // Color preset buttons
    if (colorPresets) {
        colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                if (colorInput) colorInput.value = color;
                if (colorTextInput) colorTextInput.value = color;
                // Update preset selection
                colorPresets.forEach(p => p.style.borderColor = '#e5e7eb');
                preset.style.borderColor = '#3b82f6';
            });
        });
    }
    
    // Handle save button
    document.getElementById('saveCourseBtn').addEventListener('click', () => saveCourse(modal));
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Show edit course modal
 */
function showEditCourseModal(course) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Edit Program/Strand</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="editCourseForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Code *</label>
                        <input type="text" id="editCourseCode" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " value="${course.code || ''}">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Name *</label>
                        <input type="text" id="editCourseName" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " value="${course.name || ''}">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Type *</label>
                        <select id="editCourseType" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        ">
                            <option value="">Select Type</option>
                            <option value="program" ${course.type === 'program' ? 'selected' : ''}>Program</option>
                            <option value="strand" ${course.type === 'strand' ? 'selected' : ''}>Strand</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="editCourseColor" style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Program/Strand Color</label>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="color" id="editCourseColor" value="${course.color || '#3b82f6'}" style="
                                width: 50px;
                                height: 40px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                cursor: pointer;
                            ">
                            <input type="text" id="editCourseColorText" value="${course.color || '#3b82f6'}" style="
                                flex: 1;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 4px;
                                font-size: 14px;
                                font-family: monospace;
                            " placeholder="#3b82f6">
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="color-preset-course-edit" data-color="#3b82f6" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #3b82f6; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#10b981" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #10b981; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#f59e0b" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #f59e0b; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#ef4444" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #ef4444; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#8b5cf6" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #8b5cf6; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#06b6d4" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #06b6d4; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#84cc16" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #84cc16; cursor: pointer; transition: all 0.2s;
                            "></button>
                            <button type="button" class="color-preset-course-edit" data-color="#f97316" style="
                                width: 30px; height: 30px; border-radius: 4px; border: 2px solid #e5e7eb; 
                                background: #f97316; cursor: pointer; transition: all 0.2s;
                            "></button>
                        </div>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveCourseChangesBtn" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Color picker functionality for edit modal
    const colorInput = modal.querySelector('#editCourseColor');
    const colorTextInput = modal.querySelector('#editCourseColorText');
    const colorPresets = modal.querySelectorAll('.color-preset-course-edit');
    
    // Sync color picker with text input
    if (colorInput && colorTextInput) {
        colorInput.addEventListener('input', () => {
            colorTextInput.value = colorInput.value;
        });
        
        colorTextInput.addEventListener('input', () => {
            if (/^#[0-9A-F]{6}$/i.test(colorTextInput.value)) {
                colorInput.value = colorTextInput.value;
            }
        });
    }
    
    // Color preset buttons
    if (colorPresets) {
        colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                if (colorInput) colorInput.value = color;
                if (colorTextInput) colorTextInput.value = color;
                // Update preset selection
                colorPresets.forEach(p => p.style.borderColor = '#e5e7eb');
                preset.style.borderColor = '#3b82f6';
            });
        });
        
        // Highlight current color preset
        const currentColor = course.color || '#3b82f6';
        colorPresets.forEach(preset => {
            if (preset.dataset.color === currentColor) {
                preset.style.borderColor = '#3b82f6';
            }
        });
    }
    
    // Handle save button
    document.getElementById('saveCourseChangesBtn').addEventListener('click', () => saveCourseChanges(course.id, modal, course));
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save new course
 */
async function saveCourse(modal) {
    try {
        const code = modal.querySelector('#courseCode').value.trim();
        const name = modal.querySelector('#courseName').value.trim();
        const type = modal.querySelector('#courseType').value;
        const colorInput = modal.querySelector('#courseColor');
        const color = colorInput ? colorInput.value.trim() : '#3b82f6';
        
        if (!code || !name || !type) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const response = await fetch('/api/courses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name,
                type,
                color
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 409) {
                showNotification(`Program/Strand with code "${code}" already exists. Please use a different code.`, 'error');
                return;
            }
            const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
            showNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        }
        
        showNotification('Program/Strand added successfully', 'success');
        document.body.removeChild(modal);
        loadCourses(); // Refresh the courses list
    } catch (error) {
        console.error('Error adding course:', error);
        // Error notification is already shown above if response was not ok
        if (!error.message || !error.message.includes('HTTP error')) {
            showNotification('Failed to add program/strand', 'error');
        }
    }
}

/**
 * Save course changes
 */
async function saveCourseChanges(courseId, modal, course) {
    try {
        const code = modal.querySelector('#editCourseCode').value.trim();
        const name = modal.querySelector('#editCourseName').value.trim();
        const type = modal.querySelector('#editCourseType').value;
        const colorInput = modal.querySelector('#editCourseColor');
        const color = colorInput ? colorInput.value.trim() : '#3b82f6';
        
        // Get departmentId from the original course object (optional)
        const departmentId = course?.departmentId || null;
        
        if (!code || !name || !type) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        const response = await fetch(`/api/courses/${courseId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                name,
                type,
                departmentId: departmentId || null,
                color
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 409) {
                showNotification(`Program/Strand with code "${code}" already exists. Please use a different code.`, 'error');
                return;
            }
            const errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
            showNotification(errorMessage, 'error');
            throw new Error(errorMessage);
        }
        
        showNotification('Program/Strand updated successfully', 'success');
        document.body.removeChild(modal);
        loadCourses(); // Refresh the courses list
    } catch (error) {
        console.error('Error updating course:', error);
        // Error notification is already shown above if response was not ok
        if (!error.message || !error.message.includes('HTTP error')) {
            showNotification('Failed to update program/strand', 'error');
        }
    }
}

/**
 * Show add room modal
 */
function showAddRoomModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Add Room</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="addRoomForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Room Name *</label>
                        <input type="text" id="roomName" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " placeholder="e.g., Room 101, Lab A, Conference Room">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Capacity *</label>
                        <input type="number" id="roomCapacity" required min="1" style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " placeholder="e.g., 30, 50, 100">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #374151; cursor: pointer;">
                            <input type="checkbox" id="roomPriority" style="
                                width: 16px;
                                height: 16px;
                                cursor: pointer;
                            ">
                            Enable Room Priority
                        </label>
                        <p style="margin: 5px 0 0 24px; font-size: 12px; color: #6b7280;">
                            When checked, you can set department-specific room settings
                        </p>
                    </div>
                    <div id="prioritySettings" style="margin-bottom: 20px; display: none;">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Department *</label>
                            <select id="roomDepartment" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 6px;
                                font-size: 14px;
                            ">
                                <option value="">Select Department</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #374151; cursor: pointer;">
                                <input type="checkbox" id="roomExclusive" style="
                                    width: 16px;
                                    height: 16px;
                                    cursor: pointer;
                                ">
                                Room Department Exclusive
                            </label>
                            <p style="margin: 5px 0 0 24px; font-size: 12px; color: #6b7280;">
                                When checked, this room will be exclusively used by the selected department
                            </p>
                        </div>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveRoomBtn" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Room</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load departments into dropdown
    loadDepartmentsForRoom(modal);
    
    // Handle priority checkbox toggle
    const priorityCheckbox = modal.querySelector('#roomPriority');
    const prioritySettings = modal.querySelector('#prioritySettings');
    const departmentSelect = modal.querySelector('#roomDepartment');
    
    const exclusiveCheckbox = modal.querySelector('#roomExclusive');
    
    priorityCheckbox.addEventListener('change', function() {
        if (this.checked) {
            prioritySettings.style.display = 'block';
            departmentSelect.required = true;
        } else {
            prioritySettings.style.display = 'none';
            departmentSelect.required = false;
            departmentSelect.value = '';
            if (exclusiveCheckbox) exclusiveCheckbox.checked = false;
        }
    });
    
    // When exclusive is checked, automatically enable priority
    if (exclusiveCheckbox) {
        exclusiveCheckbox.addEventListener('change', function() {
            if (this.checked && !priorityCheckbox.checked) {
                priorityCheckbox.checked = true;
                prioritySettings.style.display = 'block';
                departmentSelect.required = true;
            }
        });
    }
    
    // Handle save button
    document.getElementById('saveRoomBtn').addEventListener('click', () => saveRoom(modal));
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Show edit room modal
 */
function showEditRoomModal(room) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
            <div style="
                padding: 20px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h5 style="margin: 0; color: #1e293b;">Edit Room</h5>
                <button type="button" class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="padding: 20px;">
                <form id="editRoomForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Room Name *</label>
                        <input type="text" id="editRoomName" required style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " value="${room.name || ''}">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Capacity *</label>
                        <input type="number" id="editRoomCapacity" required min="1" style="
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            font-size: 14px;
                        " value="${room.capacity || ''}">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #374151; cursor: pointer;">
                            <input type="checkbox" id="editRoomPriority" style="
                                width: 16px;
                                height: 16px;
                                cursor: pointer;
                            " ${(room.priority === true || room.priority === 'true' || room.priority === 1) ? 'checked' : ''}>
                            Enable Room Priority
                        </label>
                        <p style="margin: 5px 0 0 24px; font-size: 12px; color: #6b7280;">
                            When checked, you can set department-specific room settings
                        </p>
                    </div>
                    <div id="editPrioritySettings" style="margin-bottom: 20px; ${(room.priority === true || room.priority === 'true' || room.priority === 1) ? 'display: block;' : 'display: none;'}">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: #374151;">Department *</label>
                            <select id="editRoomDepartment" style="
                                width: 100%;
                                padding: 8px 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 6px;
                                font-size: 14px;
                            ">
                                <option value="">Select Department</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #374151; cursor: pointer;">
                                <input type="checkbox" id="editRoomExclusive" style="
                                    width: 16px;
                                    height: 16px;
                                    cursor: pointer;
                                " ${(room.exclusive === true || room.exclusive === 'true' || room.exclusive === 1) ? 'checked' : ''}>
                                Room Department Exclusive
                            </label>
                            <p style="margin: 5px 0 0 24px; font-size: 12px; color: #6b7280;">
                                When checked, this room will be exclusively used by the selected department
                            </p>
                        </div>
                    </div>
                </form>
            </div>
            <div style="
                padding: 20px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            ">
                <button type="button" class="btn btn-secondary" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveRoomChangesBtn" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load departments into dropdown and set current selection
    loadDepartmentsForRoom(modal, room.departmentId).then(() => {
        // Set department dropdown value after departments are loaded
        const editDepartmentSelect = modal.querySelector('#editRoomDepartment');
        if (editDepartmentSelect) {
            // Try to set by ID first, then by matching department name
            if (room.departmentId) {
                editDepartmentSelect.value = room.departmentId;
            } else if (room.department) {
                // Try to find by department name
                const options = Array.from(editDepartmentSelect.options);
                const matchingOption = options.find(opt => 
                    opt.textContent === room.department || opt.value === room.department
                );
                if (matchingOption) {
                    editDepartmentSelect.value = matchingOption.value;
                }
            }
        }
    });
    
    // Handle priority checkbox toggle for edit modal
    const editPriorityCheckbox = modal.querySelector('#editRoomPriority');
    const editPrioritySettings = modal.querySelector('#editPrioritySettings');
    const editDepartmentSelect = modal.querySelector('#editRoomDepartment');
    const editExclusiveCheckbox = modal.querySelector('#editRoomExclusive');
    
    // Ensure checkboxes are properly set based on room data
    const hasPriority = room.priority === true || room.priority === 'true' || room.priority === 1;
    const isExclusive = room.exclusive === true || room.exclusive === 'true' || room.exclusive === 1;
    
    if (editPriorityCheckbox) {
        editPriorityCheckbox.checked = hasPriority;
    }
    if (editExclusiveCheckbox) {
        editExclusiveCheckbox.checked = isExclusive;
    }
    
    // Show/hide priority settings based on current state
    if (editPrioritySettings) {
        editPrioritySettings.style.display = hasPriority ? 'block' : 'none';
    }
    if (editDepartmentSelect) {
        editDepartmentSelect.required = hasPriority;
    }
    
    editPriorityCheckbox.addEventListener('change', function() {
        if (this.checked) {
            if (editPrioritySettings) editPrioritySettings.style.display = 'block';
            if (editDepartmentSelect) editDepartmentSelect.required = true;
        } else {
            if (editPrioritySettings) editPrioritySettings.style.display = 'none';
            if (editDepartmentSelect) {
                editDepartmentSelect.required = false;
                editDepartmentSelect.value = '';
            }
            if (editExclusiveCheckbox) editExclusiveCheckbox.checked = false;
        }
    });
    
    // When exclusive is checked, automatically enable priority
    if (editExclusiveCheckbox) {
        editExclusiveCheckbox.addEventListener('change', function() {
            if (this.checked && !editPriorityCheckbox.checked) {
                editPriorityCheckbox.checked = true;
                if (editPrioritySettings) editPrioritySettings.style.display = 'block';
                if (editDepartmentSelect) editDepartmentSelect.required = true;
            }
        });
    }
    
    // Handle save button
    document.getElementById('saveRoomChangesBtn').addEventListener('click', () => saveRoomChanges(room.id, modal));
    
    // Handle cancel button
    modal.querySelector('.btn-secondary').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle close button
    modal.querySelector('.close-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

/**
 * Save new room
 */
async function saveRoom(modal) {
    try {
        const name = (modal.querySelector('#roomName').value || '').trim();
        const capacityInput = modal.querySelector('#roomCapacity').value;
        const capacity = Number.parseInt(capacityInput, 10);
        const priorityCheckbox = modal.querySelector('#roomPriority');
        const exclusiveCheckbox = modal.querySelector('#roomExclusive');
        const priority = priorityCheckbox ? priorityCheckbox.checked : false;
        const exclusive = exclusiveCheckbox ? exclusiveCheckbox.checked : false;
        // If exclusive is checked, priority must also be enabled
        const finalPriority = priority || exclusive;
        const departmentId = finalPriority ? modal.querySelector('#roomDepartment').value : null;
        
        if (!name) {
            showNotification('Please enter a room name', 'error');
            return;
        }
        if (!Number.isFinite(capacity)) {
            showNotification('Please enter a valid numeric capacity', 'error');
            return;
        }
        
        if (finalPriority && !departmentId) {
            showNotification('Please select a department when priority or exclusive is enabled', 'error');
            return;
        }
        
        if (capacity < 1) {
            showNotification('Capacity must be at least 1', 'error');
            return;
        }
        
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                capacity: Number(capacity),
                departmentId,
                priority: finalPriority,
                exclusive: exclusive && finalPriority // Only set exclusive if priority is enabled
            })
        });
        
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (_) {}
            if (response.status === 409) {
                showNotification(`Room with name "${name}" already exists. Please use a different name.`, 'error');
                return;
            }
            throw new Error(errorMsg);
        }
        
        showNotification('Room added successfully', 'success');
        document.body.removeChild(modal);
        // Force refresh rooms list with cache-busting
        await loadRooms();
    } catch (error) {
        console.error('Error adding room:', error);
        showNotification(error.message || 'Failed to add room', 'error');
    }
}

/**
 * Save room changes
 */
async function saveRoomChanges(roomId, modal) {
    try {
        const name = modal.querySelector('#editRoomName').value.trim();
        const capacity = parseInt(modal.querySelector('#editRoomCapacity').value);
        const priorityCheckbox = modal.querySelector('#editRoomPriority');
        const exclusiveCheckbox = modal.querySelector('#editRoomExclusive');
        const priority = priorityCheckbox ? priorityCheckbox.checked : false;
        const exclusive = exclusiveCheckbox ? exclusiveCheckbox.checked : false;
        // If exclusive is checked, priority must also be enabled
        const finalPriority = priority || exclusive;
        const departmentSelect = modal.querySelector('#editRoomDepartment');
        const departmentId = finalPriority && departmentSelect ? departmentSelect.value : null;
        
        if (!name || !capacity) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (finalPriority && !departmentId) {
            showNotification('Please select a department when priority or exclusive is enabled', 'error');
            return;
        }
        
        if (capacity < 1) {
            showNotification('Capacity must be at least 1', 'error');
            return;
        }
        
        const response = await fetch(`/api/rooms/${roomId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                capacity,
                departmentId,
                priority: finalPriority,
                exclusive: exclusive && finalPriority // Only set exclusive if priority is enabled
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 409) {
                showNotification(`Room with name "${name}" already exists. Please use a different name.`, 'error');
                return;
            }
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        showNotification('Room updated successfully', 'success');
        document.body.removeChild(modal);
        // Force refresh rooms list with cache-busting
        await loadRooms();
    } catch (error) {
        console.error('Error updating room:', error);
        showNotification('Failed to update room', 'error');
    }
}

/**
 * Load departments for course dropdown
 */
async function loadDepartmentsForCourse(modal) {
    try {
        const departments = await fetchData('/api/departments');
        // Try both add and edit department selects
        const departmentSelect = modal.querySelector('#courseDepartment') || modal.querySelector('#editCourseDepartment');
        
        if (!departmentSelect) {
            console.error('Department select not found in modal');
            return;
        }
        
        if (departments && departments.length > 0) {
            const currentValue = departmentSelect.value; // Preserve current selection
            departmentSelect.innerHTML = '<option value="">Select Department</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name} (${dept.code})</option>`).join('');
            if (currentValue) {
                departmentSelect.value = currentValue; // Restore selection
            }
        } else {
            departmentSelect.innerHTML = '<option value="">No departments available</option>';
        }
    } catch (error) {
        console.error('Error loading departments for course:', error);
        const departmentSelect = modal.querySelector('#courseDepartment') || modal.querySelector('#editCourseDepartment');
        if (departmentSelect) {
        departmentSelect.innerHTML = '<option value="">Error loading departments</option>';
        }
    }
}

/**
 * Load departments for room dropdown
 */
async function loadDepartmentsForRoom(modal, selectedDepartmentId = null) {
    try {
        const departments = await fetchData('/api/departments');
        const dropdown = modal.querySelector('#roomDepartment') || modal.querySelector('#editRoomDepartment');
        
        if (!dropdown) return;
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select Department</option>';
        
        if (departments && departments.length > 0) {
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = dept.name;
                if (selectedDepartmentId && dept.id === selectedDepartmentId) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading departments for room:', error);
    }
}