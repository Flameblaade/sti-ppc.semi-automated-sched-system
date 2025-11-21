// FullCalendar Test Initialization + Data Loading Functions from index.html

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

// Function to get the auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Function to make authenticated fetch requests with offline support
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...(options.headers || {})
    };

    const isOffline = !navigator.onLine;
    const isReadRequest = !options.method || options.method === 'GET';

    // Handle offline mode
    if (isOffline) {
        // For GET requests, try to get from cache
        if (isReadRequest) {
            try {
                if (window.offlineStorage) {
                    // Try IndexedDB cache first
                    const cachedData = await window.offlineStorage.getCachedAPIResponse(url);
                    if (cachedData) {
                        console.log('[fetchWithAuth] Serving from offline cache:', url);
                        return new Response(JSON.stringify(cachedData), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
                
                // Try Service Worker cache
                const cache = await caches.open('sched-system-api-v1');
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    console.log('[fetchWithAuth] Serving from service worker cache:', url);
                    return cachedResponse;
                }
            } catch (cacheError) {
                console.warn('[fetchWithAuth] Cache lookup failed:', cacheError);
            }
        } else {
            // For write requests (POST, PUT, DELETE), queue for later sync
            if (window.offlineSync) {
                await window.offlineSync.queueAction(
                    options.method || 'POST',
                    url,
                    options.body ? JSON.parse(options.body) : null,
                    headers
                );
                
                // Return a mock success response
                return new Response(JSON.stringify({ 
                    message: 'Action queued for sync when connection is restored',
                    queued: true 
                }), {
                    status: 202,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token might be expired or invalid, redirect to login
            window.location.href = 'login.html';
            return null;
        }

        // Cache successful GET responses for offline use
        if (response.ok && isReadRequest && window.offlineStorage) {
            try {
                const data = await response.clone().json();
                await window.offlineStorage.cacheAPIResponse(url, data);
            } catch (e) {
                // Ignore caching errors
                console.warn('[fetchWithAuth] Failed to cache response:', e);
            }
        }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        
        // If offline and we have cached data, return it
        if (isOffline && isReadRequest) {
            try {
                if (window.offlineStorage) {
                    const cachedData = await window.offlineStorage.getCachedAPIResponse(url);
                    if (cachedData) {
                        console.log('[fetchWithAuth] Using cached data after fetch error:', url);
                        return new Response(JSON.stringify(cachedData), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch (cacheError) {
                console.warn('[fetchWithAuth] Cache fallback failed:', cacheError);
            }
        }
        
        throw error;
    }
}

// Function to load departments (server first, fallback to localStorage 'departments')
async function loadDepartments() {
    const departmentSelect = document.getElementById('departmentSelect');
    try {
        let departments = [];
        try {
            const response = await fetchWithAuth('/api/departments');
            if (response && response.ok) {
                departments = await response.json();
            }
        } catch (e) {
            // ignore, will fallback
        }
        if (!Array.isArray(departments) || departments.length === 0) {
            departments = JSON.parse(localStorage.getItem('departments') || '[]');
        }

        // Store departments globally for color lookup
        window.departments = departments;
        
        // Also save to localStorage for persistence
        try {
            localStorage.setItem('departments', JSON.stringify(departments));
        } catch (e) {
            console.warn('Could not save departments to localStorage:', e);
        }

        // Clear and populate
        if (departmentSelect) {
            departmentSelect.innerHTML = '<option value="" selected disabled>Select Department</option>';
            (departments || []).forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.code || dept.id; // Use code as value (matches the form)
                option.textContent = dept.code || dept.name;
                option.dataset.deptId = dept.id;
                departmentSelect.appendChild(option);
            });
            departmentSelect.disabled = (departments || []).length === 0;
            if ((departments || []).length === 0) {
                departmentSelect.innerHTML = '<option value="" selected disabled>No departments available</option>';
            }
        }
        
        console.log('Loaded departments:', departments.length, departments);
    } catch (error) {
        console.error('Error loading departments:', error);
        if (departmentSelect) {
            departmentSelect.innerHTML = '<option value="" selected disabled>Error loading departments</option>';
            departmentSelect.disabled = true;
        }
    }
}

// Helper function to resolve department ID from code or malformed ID
function resolveDepartmentId(departmentIdOrCode) {
    if (!departmentIdOrCode) return null;
    
    // Clean up malformed values like "IT:1" - extract the part before colon
    let cleaned = String(departmentIdOrCode).trim();
    if (cleaned.includes(':')) {
        cleaned = cleaned.split(':')[0];
    }
    
    // Try to resolve from departments list
    try {
        const depts = JSON.parse(localStorage.getItem('departments') || '[]');
        const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
        const dept = depts.find(d => 
            eq(d.id, cleaned) || 
            eq(d.code, cleaned) ||
            eq(d.id, departmentIdOrCode) || 
            eq(d.code, departmentIdOrCode)
        );
        return dept?.id || cleaned;
    } catch (e) {
        console.warn('Error resolving department ID:', e);
        return cleaned;
    }
}

// Function to load faculty by department (server first, fallback to localStorage users/facultyAssignments)
async function loadFaculty(departmentIdOrCode) {
    const facultySelect = document.getElementById('facultySelect');
    const subjectSelect = document.getElementById('subjectSelect');
    
    // Reset dependent selects
    facultySelect.innerHTML = '<option value="" selected disabled>Loading faculty...</option>';
    facultySelect.disabled = true;
    subjectSelect.innerHTML = '<option value="" selected disabled>Select Faculty First</option>';
    subjectSelect.disabled = true;
    
    if (!departmentIdOrCode) return;
    
    try {
        let faculty = [];
        
        // First, resolve department ID from code if needed
        const depts = JSON.parse(localStorage.getItem('departments') || '[]');
        const eq = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase();
        const dept = depts.find(d => eq(d.id, departmentIdOrCode) || eq(d.code, departmentIdOrCode));
        const actualDeptId = dept?.id || departmentIdOrCode; // Use ID for API call
        
        console.log('Loading faculty for department:', departmentIdOrCode, 'resolved to ID:', actualDeptId);
        
        try {
            // Try API with the actual department ID
            const response = await fetchWithAuth(`/api/faculty?departmentId=${encodeURIComponent(actualDeptId)}`);
            if (response && response.ok) {
                faculty = await response.json();
                // Filter out superadmin account
                faculty = faculty.filter(f => 
                    f.email !== 'superadmin@school.edu' && 
                    f.role !== 'superadmin' && 
                    String(f.role || '').toLowerCase() !== 'superadmin'
                );
                console.log('Loaded faculty from API:', faculty.length);
            }
        } catch (e) {
            console.warn('API call failed, using fallback:', e);
        }

        if (!Array.isArray(faculty) || faculty.length === 0) {
            // Build from localStorage users with departmentId match
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const assignments = JSON.parse(localStorage.getItem('facultyAssignments') || '[]');
            
            // Create set of all possible department identifiers (ID, code, name)
            const deptIdCandidates = new Set([
                String(actualDeptId),
                String(dept?.id),
                String(dept?.code),
                String(dept?.name),
                String(departmentIdOrCode)
            ].filter(Boolean).map(s=>s.toLowerCase()));

            console.log('Department ID candidates for matching:', Array.from(deptIdCandidates));

            const localFaculty = [];
            // From users - match by departmentId (which is the ID stored on users)
            users.filter(u => {
                // Exclude superadmin account
                if (u.email === 'superadmin@school.edu' || 
                    u.role === 'superadmin' || 
                    String(u.role || '').toLowerCase() === 'superadmin') {
                    return false;
                }
                // Check if user has a departmentId assigned (faculty assignment)
                const hasDeptId = u.departmentId != null && u.departmentId !== '';
                // Also check if role is faculty (though assignment via departmentId is the key)
                return hasDeptId;
            }).forEach(u => {
                // Match by departmentId (ID stored on user) against our candidates
                const userDeptId = String(u.departmentId || '').toLowerCase();
                const userDeptName = String(u.department || '').toLowerCase();
                const matches = deptIdCandidates.has(userDeptId) || 
                              (userDeptName && depts.some(d => 
                                  eq(d.id, actualDeptId) && eq(d.name, userDeptName)
                              ));
                
                if (matches) {
                    localFaculty.push({ 
                        id: u.id, 
                        name: formatFullName(u.firstName || '', u.middleName || '', u.lastName || '') || u.email || 'Faculty', 
                        email: u.email 
                    });
                }
            });
            
            // From assignments
            assignments.forEach(a => {
                const assignmentDeptId = String(a.departmentId || '').toLowerCase();
                if (deptIdCandidates.has(assignmentDeptId)) {
                    localFaculty.push({ 
                        id: a.userId, 
                        name: formatFullName(a.firstName || '', a.middleName || '', a.lastName || '') || a.email || 'Faculty', 
                        email: a.email 
                    });
                }
            });
            
            // Deduplicate by id/email
            const seen = new Set();
            faculty = localFaculty.filter(f => {
                const key = String(f.id||'') + '|' + String((f.email||'').toLowerCase());
                if (seen.has(key)) return false; 
                seen.add(key); 
                return true;
            });
            
            console.log('Loaded faculty from localStorage:', faculty.length, faculty);
        }

        // Filter out superadmin account before populating dropdown
        faculty = (faculty || []).filter(f => 
            f.email !== 'superadmin@school.edu' && 
            f.role !== 'superadmin' && 
            String(f.role || '').toLowerCase() !== 'superadmin'
        );
        
        // Update faculty select
        facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty</option>';
        faculty.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            // tolerate different shapes
            const display = f.name || formatFullName(f.firstName || '', f.middleName || '', f.lastName || '') || f.email || 'Faculty';
            option.textContent = display;
            if (f.email) option.dataset.email = f.email;
            facultySelect.appendChild(option);
        });
        
        // Only enable if faculty are available
        if ((faculty||[]).length > 0) {
            facultySelect.disabled = false;
        } else {
            facultySelect.disabled = true;
            facultySelect.innerHTML = '<option value="" selected disabled>No faculty available</option>';
        }
    } catch (error) {
        console.error('Error loading faculty:', error);
        facultySelect.innerHTML = '<option value="" selected disabled>Error loading faculty</option>';
        facultySelect.disabled = true;
    }
}

// Function to load subjects by department (aligns with Entity Management)
async function loadSubjects(facultyId) {
    const subjectSelect = document.getElementById('subjectSelect');
    
    // Reset subject select
    subjectSelect.innerHTML = '<option value="" selected disabled>Loading subjects...</option>';
    subjectSelect.disabled = true;
    
    const departmentValue = document.getElementById('departmentSelect')?.value;
    if (!departmentValue) return;
    
    // Resolve department to get actual ID
    const eq = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase();
    const depts = JSON.parse(localStorage.getItem('departments') || '[]');
    const dept = depts.find(d => eq(d.id, departmentValue) || eq(d.code, departmentValue));
    const departmentId = dept?.id || departmentValue; // Use resolved ID, fallback to value
    
    try {
        let subjects = [];
        try {
            // Use resolved department ID for API call
            const response = await fetchWithAuth(`/api/subjects?departmentId=${encodeURIComponent(departmentId)}`);
            if (response && response.ok) {
                subjects = await response.json();
            }
        } catch (e) { /* ignore */ }

        if (!Array.isArray(subjects) || !subjects.length) {
            // Fallback to localStorage
            const allSubjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            
            // Resolve to actual department ID and code (dept already resolved above)
            const resolvedDeptId = dept?.id || null;
            const resolvedDeptCode = dept?.code || null;
            
            console.log('Filtering subjects for department:', departmentValue, 'Resolved ID:', resolvedDeptId, 'Resolved Code:', resolvedDeptCode);
            
            // Strict matching function - only match by departmentId or department code field
            const matchesDept = (obj) => {
                if (!obj) return false;
                
                // Primary check: match by departmentId (the ID field)
                if (resolvedDeptId) {
                    const objDeptId = String(obj.departmentId || '').toLowerCase();
                    if (objDeptId && eq(objDeptId, resolvedDeptId)) {
                        console.log(`Matched subject "${obj.code || obj.name}" by departmentId: ${obj.departmentId}`);
                        return true;
                    }
                }
                
                // Secondary check: match by department code if departmentId doesn't match
                if (resolvedDeptCode) {
                    // Check departmentCode or deptCode fields (if they exist)
                    const objDeptCode = String(obj.departmentCode || obj.deptCode || '').toLowerCase();
                    if (objDeptCode && eq(objDeptCode, resolvedDeptCode)) {
                        console.log(`Matched subject "${obj.code || obj.name}" by departmentCode: ${objDeptCode}`);
                        return true;
                    }
                }
                
                return false;
            };
            
            const filteredSubjects = allSubjects.filter(s => matchesDept(s));
            console.log(`Filtered subjects: ${filteredSubjects.length} of ${allSubjects.length} match department`);
            subjects = filteredSubjects;
        }

        // Populate subjects only
        subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject/Course</option>';
        (subjects||[]).forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id || sub.code;
            opt.textContent = `${sub.code || ''} ${sub.name ? '- ' + sub.name : ''}`.trim();
            opt.dataset.kind = 'subject';
            subjectSelect.appendChild(opt);
        });

        subjectSelect.disabled = (subjectSelect.options.length <= 1);
        if (subjectSelect.options.length <= 1) {
            subjectSelect.innerHTML = '<option value="" selected disabled>No subjects available</option>';
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        subjectSelect.innerHTML = '<option value="" selected disabled>Error loading subjects</option>';
        subjectSelect.disabled = true;
    }
}

// Function to load programs/strands by department (courses + strands)
async function loadPrograms() {
    const programSelect = document.getElementById('programSelect');
    
    // Reset program select
    programSelect.innerHTML = '<option value="" selected disabled>Loading programs/strands...</option>';
    programSelect.disabled = true;
    
    const departmentValue = document.getElementById('departmentSelect')?.value;
    if (!departmentValue) return;
    
    // Resolve department to get actual ID
    const eq = (a,b) => String(a||'').toLowerCase() === String(b||'').toLowerCase();
    const depts = JSON.parse(localStorage.getItem('departments') || '[]');
    const dept = depts.find(d => eq(d.id, departmentValue) || eq(d.code, departmentValue));
    const departmentId = dept?.id || departmentValue; // Use resolved ID, fallback to value
    
    try {
        let courses = [];
        let strands = [];
        try {
            // Use resolved department ID for API call
            const respCourses = await fetchWithAuth(`/api/courses?departmentId=${encodeURIComponent(departmentId)}`);
            if (respCourses && respCourses.ok) {
                courses = await respCourses.json();
            }
        } catch (e2) { /* ignore */ }
        try {
            // Use resolved department ID for API call
            const respStrands = await fetchWithAuth(`/api/strands?departmentId=${encodeURIComponent(departmentId)}`);
            if (respStrands && respStrands.ok) {
                strands = await respStrands.json();
            }
        } catch (e3) { /* ignore */ }

        // Fallback to localStorage if API didn't return results
        if ((!Array.isArray(courses) || !courses.length) || (!Array.isArray(strands) || !strands.length)) {
            const allCourses = JSON.parse(localStorage.getItem('courses') || '[]');
            const allStrands = JSON.parse(localStorage.getItem('strands') || '[]');
            
            // Resolve to actual department ID and code (dept already resolved above)
            const resolvedDeptId = dept?.id || null;
            const resolvedDeptCode = dept?.code || null;
            
            console.log('Filtering programs/strands for department:', departmentValue, 'Resolved ID:', resolvedDeptId, 'Resolved Code:', resolvedDeptCode);
            
            // Strict matching function - only match by departmentId or department code field
            const matchesDept = (obj) => {
                if (!obj) return false;
                
                // Primary check: match by departmentId (the ID field)
                if (resolvedDeptId) {
                    const objDeptId = String(obj.departmentId || '').toLowerCase();
                    if (objDeptId && eq(objDeptId, resolvedDeptId)) {
                        console.log(`Matched program/strand "${obj.code || obj.name}" by departmentId: ${obj.departmentId}`);
                        return true;
                    }
                }
                
                // Secondary check: match by department code if departmentId doesn't match
                if (resolvedDeptCode) {
                    // Check departmentCode or deptCode fields (if they exist)
                    const objDeptCode = String(obj.departmentCode || obj.deptCode || '').toLowerCase();
                    if (objDeptCode && eq(objDeptCode, resolvedDeptCode)) {
                        console.log(`Matched program/strand "${obj.code || obj.name}" by departmentCode: ${objDeptCode}`);
                        return true;
                    }
                }
                
                return false;
            };
            
            // Filter courses and strands independently
            if (!Array.isArray(courses) || !courses.length) {
                const filteredCourses = allCourses.filter(c => matchesDept(c));
                console.log(`Filtered courses: ${filteredCourses.length} of ${allCourses.length} match department`);
                courses = filteredCourses;
            }
            if (!Array.isArray(strands) || !strands.length) {
                const filteredStrands = allStrands.filter(s => matchesDept(s));
                console.log(`Filtered strands: ${filteredStrands.length} of ${allStrands.length} match department`);
                strands = filteredStrands;
            }
        }

        // Populate combined programs (courses + strands)
        programSelect.innerHTML = '<option value="" selected disabled>Select Program/Strand</option>';
        (courses||[]).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id || c.code;
            opt.textContent = `${c.code || ''} ${c.name ? '- ' + c.name : ''}`.trim();
            opt.dataset.kind = c.type || 'course';
            programSelect.appendChild(opt);
        });
        (strands||[]).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id || s.code;
            opt.textContent = `${s.code || ''} ${s.name ? '- ' + s.name : ''}`.trim();
            opt.dataset.kind = s.type || 'strand';
            programSelect.appendChild(opt);
        });

        programSelect.disabled = (programSelect.options.length <= 1);
        if (programSelect.options.length <= 1) {
            programSelect.innerHTML = '<option value="" selected disabled>No programs/strands available</option>';
        }
    } catch (error) {
        console.error('Error loading programs/strands:', error);
        programSelect.innerHTML = '<option value="" selected disabled>Error loading programs/strands</option>';
        programSelect.disabled = true;
    }
}

// Function to update user info based on authentication
function updateUserInfo() {
    console.log('=== updateUserInfo() called ===');
    const authToken = localStorage.getItem('authToken');
    const userInfo = localStorage.getItem('userData') || localStorage.getItem('userInfo');
    
    console.log('Auth token exists:', !!authToken);
    console.log('User info exists:', !!userInfo);
    console.log('User info raw:', userInfo);
    
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    const superadminDashboardBtn = document.getElementById('superadminDashboardBtn');
    const adminDashboardBtn = document.getElementById('adminDashboardBtn');
    const userDashboardBtn = document.getElementById('userDashboardBtn');
    
    console.log('Button elements found:');
    console.log('- superadminDashboardBtn:', !!superadminDashboardBtn);
    console.log('- adminDashboardBtn:', !!adminDashboardBtn);
    console.log('- userDashboardBtn:', !!userDashboardBtn);
    
    // Hide all dashboard buttons by default using class
    if (superadminDashboardBtn) {
        superadminDashboardBtn.classList.add('hidden');
        superadminDashboardBtn.style.display = 'none';
    }
    if (adminDashboardBtn) {
        adminDashboardBtn.classList.add('hidden');
        adminDashboardBtn.style.display = 'none';
    }
    if (userDashboardBtn) {
        userDashboardBtn.classList.add('hidden');
        userDashboardBtn.style.display = 'none';
    }
    
    if (authToken && userInfo) {
        try {
            const user = JSON.parse(userInfo);
            const role = user.role || 'user';
            
            console.log('Parsed user data:', user);
            console.log('User role:', role);
            
            if (userNameEl) {
                userNameEl.textContent = user.name || formatFullName(user.firstName || '', user.middleName || '', user.lastName || '') || user.email || 'User';
            }
            if (userRoleEl) {
                userRoleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                // Apply appropriate badge class based on role
                if (role.toLowerCase() === 'superadmin') {
                    userRoleEl.className = 'role-badge superadmin-badge';
                } else if (role.toLowerCase() === 'admin') {
                    userRoleEl.className = 'role-badge admin-badge';
                } else {
                    userRoleEl.className = 'role-badge user-badge';
                }
                
                // Show appropriate dashboard button based on role
                if (role.toLowerCase() === 'superadmin') {
                    if (superadminDashboardBtn) {
                        superadminDashboardBtn.classList.remove('hidden');
                        superadminDashboardBtn.style.display = 'inline-flex';
                        superadminDashboardBtn.style.visibility = 'visible';
                        console.log('✓ Showing superadmin dashboard button');
                    }
                } else if (role.toLowerCase() === 'admin') {
                    console.log('Admin role detected, attempting to show admin dashboard button');
                    if (adminDashboardBtn) {
                        // Remove hidden class and force display
                        adminDashboardBtn.classList.remove('hidden');
                        adminDashboardBtn.style.display = 'inline-flex';
                        adminDashboardBtn.style.visibility = 'visible';
                        adminDashboardBtn.style.opacity = '1';
                        console.log('✓ Admin dashboard button displayed');
                        console.log('Button computed style display:', window.getComputedStyle(adminDashboardBtn).display);
                        console.log('Button element:', adminDashboardBtn);
                        console.log('Button classes:', adminDashboardBtn.className);
                        
                        // Force it visible again after a micro-delay
                        setTimeout(function() {
                            adminDashboardBtn.classList.remove('hidden');
                            adminDashboardBtn.style.display = 'inline-flex';
                            adminDashboardBtn.style.visibility = 'visible';
                            console.log('Button re-displayed after timeout');
                        }, 50);
                    } else {
                        console.error('✗ Admin dashboard button element not found in DOM!');
                    }
                } else {
                    // Regular user
                    if (userDashboardBtn) {
                        userDashboardBtn.classList.remove('hidden');
                        userDashboardBtn.style.display = 'inline-flex';
                        userDashboardBtn.style.visibility = 'visible';
                        console.log('✓ Showing user dashboard button');
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing user info:', error);
        }
    } else {
        console.log('No auth token or user info found');
        // Default user info
        if (userNameEl) userNameEl.textContent = 'User';
        if (userRoleEl) {
            userRoleEl.textContent = 'User';
            userRoleEl.className = 'role-badge user-badge';
        }
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize FullCalendar
    const calendarEl = document.getElementById('calendar');
    
    if (calendarEl && typeof FullCalendar !== 'undefined') {
        // Get user role for permissions
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.role || 'user';
        const isAdmin = userRole === 'admin' || userRole === 'superadmin';
        const isSuperAdmin = userRole === 'superadmin';
        const isUser = userRole === 'user';
        
        // Hide filter panel for non-superadmin users
        const filterPanel = document.querySelector('.filter-panel');
        if (filterPanel) {
            if (!isSuperAdmin) {
                filterPanel.style.display = 'none';
            } else {
                filterPanel.style.display = 'block';
            }
        }
        
        // Hide/disable form panel and action buttons for regular users
        if (isUser) {
            const leftColumn = document.querySelector('.left-column');
            if (leftColumn) {
                // Hide the entire left column for users
                leftColumn.style.display = 'none';
            }
            
            // Make right column take full width when left column is hidden
            const rightColumn = document.querySelector('.right-column');
            if (rightColumn) {
                rightColumn.style.flex = '1 1 100%';
                rightColumn.style.maxWidth = '100%';
            }
            
            // Fixed schedules will be loaded by loadScheduleFromLocalStorage
            // No need to load them here as it's handled in main.js
            
            const generateScheduleBtn = document.getElementById('generateScheduleBtn');
            if (generateScheduleBtn) {
                generateScheduleBtn.style.display = 'none';
            }
            
            const clearScheduleBtn = document.getElementById('clearScheduleBtn');
            if (clearScheduleBtn) {
                clearScheduleBtn.style.display = 'none';
            }
            
            // Hide room change functionality in event details modal
            const eventRoomSelect = document.getElementById('eventRoomSelect');
            const saveRoomBtn = document.getElementById('saveRoomBtn');
            const roomChangeLabel = eventRoomSelect?.parentElement?.querySelector('label');
            
            if (eventRoomSelect) {
                eventRoomSelect.parentElement.style.display = 'none';
            }
            if (saveRoomBtn) {
                saveRoomBtn.style.display = 'none';
            }
        }
        
        // Initialize calendar with timeGridWeek view (Monday-Saturday only, with navigation buttons)
        // Ensure calendar shows the correct Monday-Saturday week
        // If today is Sunday, show next week (Monday-Saturday)
        // Otherwise, show this week (Monday-Saturday)
        const todayForCalendar = new Date();
        todayForCalendar.setHours(12, 0, 0, 0); // Set to noon to ensure correct week calculation
        
        // If today is Sunday, move to Monday (next week)
        if (todayForCalendar.getDay() === 0) {
            // Sunday - show next week (Monday)
            todayForCalendar.setDate(todayForCalendar.getDate() + 1);
        }
        
        window.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            initialDate: todayForCalendar, // Show the Monday-Saturday week
            headerToolbar: false, // No navigation buttons - always show current week
            slotMinTime: '07:00:00',
            slotMaxTime: '21:00:00',
            slotDuration: '00:15:00',
            slotLabelInterval: '00:15:00',
            slotLabelFormat: {
                hour: 'numeric',
                minute: '2-digit',
                omitZeroMinute: false,
                meridiem: 'short'
            },
            allDaySlot: false,
            weekends: true,
            hiddenDays: [0], // Hide Sunday (0 = Sunday, 1 = Monday, etc.)
            editable: isAdmin,
            droppable: isAdmin,
            selectable: isAdmin,
            eventDurationEditable: isAdmin, // Allow resizing events (lengthening/shortening)
            eventStartEditable: isAdmin, // Allow moving events
            eventResizableFromStart: isAdmin, // Allow resizing from start time
            height: 'auto',
            contentHeight: 'auto',
            dayHeaderFormat: {
                weekday: 'long' // Shows full day names like "Monday"
            },
            // Ensure only week view is available (no month/day views)
            views: {
                timeGridWeek: {
                    dayHeaderFormat: { weekday: 'long' }
                }
            },
            // Handle when events are dropped onto the calendar
            eventReceive: function(info) {
                // Ensure the department color is applied when event is dropped
                const event = info.event;
                const deptColor = event.extendedProps?.departmentColor || 
                                (event.backgroundColor) || 
                                '#6b7280';
                
                console.log('Event received, applying department color:', deptColor);
                
                // Set the event color
                event.setProp('backgroundColor', deptColor);
                event.setProp('borderColor', deptColor);
                
                // Apply color to DOM element
                setTimeout(() => {
                    const eventEl = info.event.el;
                    if (eventEl) {
                        eventEl.style.backgroundColor = deptColor;
                        eventEl.style.borderColor = deptColor;
                        eventEl.style.opacity = '1';
                        
                        const mainEl = eventEl.querySelector('.fc-event-main');
                        if (mainEl) {
                            mainEl.style.backgroundColor = deptColor;
                            mainEl.style.borderColor = deptColor;
                        }
                        
                        console.log('Applied department color to dropped event:', deptColor);
                    }
                }, 50);

                // After receive, block if the drop creates a conflict
                if (typeof window.wouldCreateScheduleConflict === 'function') {
                    const hasConflict = window.wouldCreateScheduleConflict(event, event.id);
                    if (hasConflict) {
                        // Remove the received event to prevent merging/combining
                        try { info.revert && info.revert(); } catch(_) {}
                        try { event.remove(); } catch(_) {}
                        console.log('Event receive reverted due to conflict');
                        return;
                    }
                }
            },
            // Handle when events are moved
            eventDrop: function(info) {
                const event = info.event;
                
                // Prevent fixed schedules from being moved
                if (event.extendedProps?.isFixedSchedule) {
                    info.revert();
                    if (typeof showNotification === 'function') {
                        showNotification('Fixed schedules cannot be moved or modified.', 'error');
                    }
                    return;
                }
                
                // Check for conflicts BEFORE proceeding
                if (typeof window.wouldCreateScheduleConflict === 'function') {
                    const hasConflict = window.wouldCreateScheduleConflict(event, event.id);
                    if (hasConflict) {
                        info.revert();
                        console.log('Event drop reverted due to conflict');
                        return; // Don't proceed with saving or updating
                    }
                }
                
                // IMMEDIATELY check for and remove any duplicates that might have been created
                const allEvents = window.calendar.getEvents();
                const originalClassId = event.extendedProps?.originalClassId;
                
                if (originalClassId) {
                    // Find all events with the same originalClassId
                    const sameClassEvents = allEvents.filter(e => 
                        e.extendedProps?.originalClassId === originalClassId
                    );
                    
                    // If there are multiple events for the same class, keep only the one we just moved
                    if (sameClassEvents.length > 1) {
                        console.log(`Found ${sameClassEvents.length} events for class ${originalClassId}, removing duplicates`);
                        sameClassEvents.forEach(duplicateEvent => {
                            // Keep the event we just moved (the one in info.event)
                            if (duplicateEvent.id !== event.id) {
                                console.log('Removing duplicate event:', duplicateEvent.title);
                                duplicateEvent.remove();
                            }
                        });
                    }
                }
                
                // Update the dayOfWeek based on the new date where event was dropped
                if (event.start) {
                    const newDate = new Date(event.start);
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const newDayOfWeek = dayNames[newDate.getDay()];
                    
                    // Update the extendedProps with the new day of week
                    event.setExtendedProp('dayOfWeek', newDayOfWeek);
                    
                    console.log('Event moved to:', newDayOfWeek, 'at', newDate.toDateString());
                }
                
                // Maintain department color when event is moved
                const deptColor = event.extendedProps?.departmentColor || event.backgroundColor;
                
                if (deptColor) {
                    setTimeout(() => {
                        const eventEl = event.el;
                        if (eventEl) {
                            eventEl.style.backgroundColor = deptColor;
                            eventEl.style.borderColor = deptColor;
                            
                            const mainEl = eventEl.querySelector('.fc-event-main');
                            if (mainEl) {
                                mainEl.style.backgroundColor = deptColor;
                                mainEl.style.borderColor = deptColor;
                            }
                        }
                    }, 50);
                }
                
                // Save schedule immediately when event is moved (for real-time updates)
                if (isAdmin && typeof window.saveScheduleToLocalStorage === 'function') {
                    // Set flags to prevent conflicts and reloads
                    if (window.isCurrentlySaving !== undefined) {
                        window.isCurrentlySaving = true;
                    }
                    window.isDraggingEvent = true; // Flag to track dragging state
                    
                    setTimeout(() => {
                        console.log('Event moved, saving schedule with updated dayOfWeek and date...');
                        
                        // Get event count before save
                        const eventsBeforeSave = window.calendar.getEvents();
                        console.log('Events before save:', eventsBeforeSave.length);
                        
                        window.saveScheduleToLocalStorage().then(() => {
                            // Verify no duplicates were created
                            const eventsAfterSave = window.calendar.getEvents();
                            console.log('Events after save:', eventsAfterSave.length);
                            
                            if (eventsAfterSave.length > eventsBeforeSave.length) {
                                console.warn('WARNING: Event count increased after save - possible duplicate!');
                                // Remove duplicates
                                const seen = new Set();
                                const uniqueEvents = [];
                                eventsAfterSave.forEach(evt => {
                                    const key = `${evt.extendedProps?.originalClassId}-${evt.extendedProps?.dayOfWeek}-${evt.start?.toTimeString().substring(0, 5)}`;
                                    if (!seen.has(key) || !evt.extendedProps?.originalClassId) {
                                        seen.add(key);
                                        uniqueEvents.push(evt);
                                    } else {
                                        console.log('Removing duplicate event:', evt.title);
                                        evt.remove();
                                    }
                                });
                            }
                            
                            
                            // Clear flags after a delay
                            setTimeout(() => {
                                if (window.isCurrentlySaving !== undefined) {
                                    window.isCurrentlySaving = false;
                                }
                                window.isDraggingEvent = false;
                            }, 1500);
                        });
                    }, 300);
                }
            },
            // Handle when events are resized (lengthened/shortened)
            eventResize: function(info) {
                const event = info.event;
                
                // Prevent fixed schedules from being resized
                if (event.extendedProps?.isFixedSchedule) {
                    info.revert();
                    if (typeof showNotification === 'function') {
                        showNotification('Fixed schedules cannot be resized or modified.', 'error');
                    }
                    return;
                }
                
                // Check for conflicts BEFORE proceeding
                if (typeof window.wouldCreateScheduleConflict === 'function') {
                    const hasConflict = window.wouldCreateScheduleConflict(event, event.id);
                    if (hasConflict) {
                        info.revert();
                        console.log('Event resize reverted due to conflict');
                        return; // Don't proceed with saving or updating
                    }
                }
                
                console.log('Event resized:', event.title, 'New duration:', {
                    start: event.start,
                    end: event.end,
                    duration: event.end ? (event.end - event.start) / (1000 * 60 * 60) : null // Duration in hours
                });
                
                // Update duration in extendedProps
                if (event.start && event.end) {
                    const durationHours = (event.end - event.start) / (1000 * 60 * 60);
                    event.setExtendedProp('duration', durationHours);
                    event.setExtendedProp('unitLoad', durationHours); // Also update unitLoad if it exists
                    console.log('Updated duration to:', durationHours, 'hours');
                }
                
                // Maintain department color when event is resized
                const deptColor = event.extendedProps?.departmentColor || event.backgroundColor;
                
                if (deptColor) {
                    setTimeout(() => {
                        const eventEl = event.el;
                        if (eventEl) {
                            eventEl.style.backgroundColor = deptColor;
                            eventEl.style.borderColor = deptColor;
                            
                            const mainEl = eventEl.querySelector('.fc-event-main');
                            if (mainEl) {
                                mainEl.style.backgroundColor = deptColor;
                                mainEl.style.borderColor = deptColor;
                            }
                        }
                    }, 50);
                }
                
                // Save schedule immediately when event is resized (for real-time updates)
                if (isAdmin && typeof window.saveScheduleToLocalStorage === 'function') {
                    // Set flags to prevent conflicts and reloads
                    if (window.isCurrentlySaving !== undefined) {
                        window.isCurrentlySaving = true;
                    }
                    window.isResizingEvent = true; // Flag to track resizing state
                    
                    setTimeout(() => {
                        console.log('Event resized, saving schedule with updated duration...');
                        
                        // Get event count before save
                        const eventsBeforeSave = window.calendar.getEvents();
                        console.log('Events before save:', eventsBeforeSave.length);
                        
                        window.saveScheduleToLocalStorage().then(() => {
                            // Verify no duplicates were created
                            const eventsAfterSave = window.calendar.getEvents();
                            console.log('Events after save:', eventsAfterSave.length);
                            
                            if (eventsAfterSave.length > eventsBeforeSave.length) {
                                console.warn('WARNING: Event count increased after save - possible duplicate!');
                                // Remove duplicates
                                const seen = new Set();
                                eventsAfterSave.forEach(evt => {
                                    const key = `${evt.extendedProps?.originalClassId}-${evt.extendedProps?.dayOfWeek}-${evt.start?.toTimeString().substring(0, 5)}`;
                                    if (!seen.has(key) || !evt.extendedProps?.originalClassId) {
                                        seen.add(key);
                                    } else {
                                        console.log('Removing duplicate event:', evt.title);
                                        evt.remove();
                                    }
                                });
                            }
                            
                            // Clear flags after a delay
                            setTimeout(() => {
                                if (window.isCurrentlySaving !== undefined) {
                                    window.isCurrentlySaving = false;
                                }
                                window.isResizingEvent = false;
                            }, 1500);
                            
                            // Show notification
                            if (typeof showNotification === 'function') {
                                const duration = event.end ? ((event.end - event.start) / (1000 * 60 * 60)).toFixed(1) : 'N/A';
                                showNotification(`Event duration updated to ${duration} hours`, 'success');
                            }
                        }).catch(error => {
                            console.error('Error saving schedule after resize:', error);
                            if (typeof showNotification === 'function') {
                                showNotification('Failed to save schedule update', 'error');
                            }
                            
                            // Clear flags even on error
                            setTimeout(() => {
                                if (window.isCurrentlySaving !== undefined) {
                                    window.isCurrentlySaving = false;
                                }
                                window.isResizingEvent = false;
                            }, 500);
                        });
                    }, 300);
                }
            },
            // Custom event content to show detailed information
            eventContent: function(arg) {
                const event = arg.event;
                const extendedProps = event.extendedProps || {};
                
                // Extract event details
                const subject = extendedProps.subject || event.title || '';
                const department = extendedProps.department || extendedProps.course || '';
                const teacher = extendedProps.faculty || '';
                const room = extendedProps.room || '';
                
                // Format time
                let timeStr = '';
                if (event.start) {
                    const start = new Date(event.start);
                    const end = new Date(event.end || event.start);
                    const startHours = start.getHours();
                    const startMinutes = start.getMinutes();
                    const endHours = end.getHours();
                    const endMinutes = end.getMinutes();
                    
                    const formatTime = (hours, minutes) => {
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                        return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
                    };
                    
                    timeStr = `${formatTime(startHours, startMinutes)} - ${formatTime(endHours, endMinutes)}`;
                }
                
                // Create HTML content
                const content = document.createElement('div');
                content.style.cssText = 'padding: 4px 6px; font-size: 11px; line-height: 1.3;';
                
                let html = `<div style="font-weight: 600; margin-bottom: 2px;">${subject}</div>`;
                
                if (timeStr) {
                    html += `<div style="font-size: 10px; opacity: 0.9;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${timeStr}</div>`;
                }
                
                if (department) {
                    html += `<div style="font-size: 10px; opacity: 0.9;"><i class="fas fa-building" style="margin-right: 4px;"></i>${department}</div>`;
                }
                
                if (teacher) {
                    html += `<div style="font-size: 10px; opacity: 0.9;"><i class="fas fa-chalkboard-teacher" style="margin-right: 4px;"></i>${teacher}</div>`;
                }
                
                if (room) {
                    html += `<div style="font-size: 10px; opacity: 0.9;"><i class="fas fa-door-open" style="margin-right: 4px;"></i>${room}</div>`;
                }
                
                content.innerHTML = html;
                
                return { domNodes: [content] };
            },
            // Handle event click to show details and allow room editing
            eventClick: function(info) {
                const event = info.event;
                const extendedProps = event.extendedProps || {};
                
                // Extract event details
                const subject = extendedProps.subject || event.title || '';
                const department = extendedProps.department || extendedProps.course || '';
                const departmentId = extendedProps.departmentId || null;
                const teacher = extendedProps.faculty || '';
                const currentRoom = extendedProps.room || '';
                const currentRoomId = extendedProps.roomId || '';
                const classType = extendedProps.classType || '';
                const course = extendedProps.course || '';
                
                // Format time
                let timeStr = '';
                let dayOfWeek = '';
                if (event.start) {
                    const start = new Date(event.start);
                    const end = new Date(event.end || event.start);
                    const startHours = start.getHours();
                    const startMinutes = start.getMinutes();
                    const endHours = end.getHours();
                    const endMinutes = end.getMinutes();
                    
                    const formatTime = (hours, minutes) => {
                        const period = hours >= 12 ? 'PM' : 'AM';
                        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                        return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
                    };
                    
                    timeStr = `${formatTime(startHours, startMinutes)} - ${formatTime(endHours, endMinutes)}`;
                    
                    // Get day of week
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    dayOfWeek = dayNames[start.getDay()];
                }
                
                // Show event details modal (room editing disabled for regular users)
                showEventDetailsModal({
                    eventId: event.id,
                    subject,
                    time: timeStr,
                    day: dayOfWeek,
                    department,
                    departmentId, // Include departmentId for proper room filtering
                    teacher,
                    currentRoom,
                    currentRoomId,
                    classType,
                    course,
                    startTime: event.start ? event.start.toTimeString().substring(0, 5) : '',
                    endTime: event.end ? event.end.toTimeString().substring(0, 5) : '',
                    eventDate: event.start ? new Date(event.start) : null,
                    allowEdit: isAdmin // Pass permission flag
                });
            }
        });
        
        // Render the calendar
        window.calendar.render();
        console.log('FullCalendar initialized with timeGridWeek (Monday-Saturday, always current week)');
        
        // Load schedule after calendar is rendered (for all users)
        setTimeout(() => {
            if (typeof window.loadScheduleFromLocalStorage === 'function') {
                window.loadScheduleFromLocalStorage();
            }
            
            // Fixed schedules will be loaded by loadScheduleFromLocalStorage, no need to load here
            // This prevents duplicate loading and blinking
        }, 500);
        
        // Make variable accessible globally for eventDrop handler
        window.isCurrentlySaving = false;
    } else {
        console.error('FullCalendar library not loaded or calendar element not found');
    }
    
    // Update user info
    updateUserInfo();
    
    // Ensure faculty dropdown starts disabled
    const facultySelect = document.getElementById('facultySelect');
    if (facultySelect) {
        facultySelect.disabled = true;
        facultySelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
    }
    
    // Load departments when the page loads
    loadDepartments();
    
    // Handle department change: load faculty, reset and load programs/strands, and load subjects
    const deptSel = document.getElementById('departmentSelect');
    const facSel = document.getElementById('facultySelect');
    const subjSel = document.getElementById('subjectSelect');
    const progSel = document.getElementById('programSelect');
    
    if (deptSel) {
        deptSel.addEventListener('change', function() {
            const val = this.value;
            if (val) {
                loadFaculty(val);
                // reset dependent selects
                if (facSel) { 
                    facSel.innerHTML = '<option value="" selected disabled>Loading faculty...</option>'; 
                    facSel.disabled = true; 
                }
                if (subjSel) { 
                    subjSel.innerHTML = '<option value="" selected disabled>Loading subjects...</option>'; 
                    subjSel.disabled = true; 
                }
                if (progSel) { 
                    progSel.innerHTML = '<option value="" selected disabled>Loading programs/strands...</option>'; 
                    progSel.disabled = true; 
                }
                // load programs and subjects for the selected department
                loadPrograms();
                // Load subjects for the department (pass null for facultyId to load all subjects for the department)
                loadSubjects(null);
            } else {
                // No department selected, disable all dependent selects
                if (facSel) { 
                    facSel.innerHTML = '<option value="" selected disabled>Select Department First</option>'; 
                    facSel.disabled = true; 
                }
                if (subjSel) { 
                    subjSel.innerHTML = '<option value="" selected disabled>Select Department First</option>'; 
                    subjSel.disabled = true; 
                }
                if (progSel) { 
                    progSel.innerHTML = '<option value="" selected disabled>Select Department First</option>'; 
                    progSel.disabled = true; 
                }
            }
        });
    }
    
    // Handle faculty change: load subjects for the department (can refine by faculty if needed)
    if (facSel) {
        facSel.addEventListener('change', function() {
            // Still load subjects filtered by department (faculty selection doesn't change subject filtering)
            loadSubjects(this.value);
            // Hide subject details when faculty changes
            const subjectDetails = document.getElementById('subjectDetails');
            if (subjectDetails) {
                subjectDetails.style.display = 'none';
            }
        });
    }
    
    // Handle subject change: show subject details (lecture and lab hours)
    if (subjSel) {
        subjSel.addEventListener('change', function() {
            const subjectId = this.value;
            const subjectDetails = document.getElementById('subjectDetails');
            const subjectDetailsContent = document.getElementById('subjectDetailsContent');
            
            if (!subjectId || !subjectDetails || !subjectDetailsContent) {
                if (subjectDetails) {
                    subjectDetails.style.display = 'none';
                }
                return;
            }
            
            // Get subject data
            try {
                const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
                const subject = subjects.find(s => s.id === subjectId || s.code === subjectId);
                
                if (subject) {
                    const lectureHours = subject.lectureHours || 0;
                    const labHours = subject.labHours || 0;
                    const units = subject.units || 0;
                    
                    let detailsHtml = '';
                    if (lectureHours > 0 || labHours > 0) {
                        detailsHtml = '<div style="line-height: 1.6;">';
                        if (lectureHours > 0) {
                            detailsHtml += `<div><i class="fas fa-book"></i> <strong>Lecture:</strong> ${lectureHours} hour${lectureHours !== 1 ? 's' : ''}</div>`;
                        }
                        if (labHours > 0) {
                            detailsHtml += `<div><i class="fas fa-flask"></i> <strong>Laboratory:</strong> ${labHours} hour${labHours !== 1 ? 's' : ''}</div>`;
                        }
                        if (units > 0) {
                            detailsHtml += `<div style="margin-top: 5px; font-size: 0.85rem; color: #777;"><i class="fas fa-info"></i> Units: ${units}</div>`;
                        }
                        detailsHtml += '</div>';
                    } else {
                        detailsHtml = '<div style="color: #777; font-style: italic;">No lecture or laboratory hours specified</div>';
                    }
                    
                    subjectDetailsContent.innerHTML = detailsHtml;
                    subjectDetails.style.display = 'block';
                } else {
                    subjectDetails.style.display = 'none';
                }
            } catch (e) {
                console.warn('Could not load subject details:', e);
                subjectDetails.style.display = 'none';
            }
        });
    }
    
    // Function to show event details modal
    async function showEventDetailsModal(eventData) {
        const modal = document.getElementById('eventDetailsModal');
        if (!modal) return;
        
        // Check if user can edit (admin or superadmin)
        const canEdit = eventData.allowEdit !== false; // Default to true if not specified, but check user role
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.role || 'user';
        const isAdmin = userRole === 'admin' || userRole === 'superadmin';
        const allowEdit = canEdit && isAdmin;
        
        // Populate modal with event details
        document.getElementById('eventDetailSubject').textContent = eventData.subject || 'N/A';
        document.getElementById('eventDetailTime').textContent = eventData.time || 'N/A';
        document.getElementById('eventDetailDay').textContent = eventData.day || 'N/A';
        document.getElementById('eventDetailDepartment').textContent = eventData.department || 'N/A';
        document.getElementById('eventDetailTeacher').textContent = eventData.teacher || 'N/A';
        document.getElementById('eventDetailRoom').textContent = eventData.currentRoom || 'N/A';
        
        // Display class type (Lecture or Laboratory)
        const classType = eventData.classType || '';
        const typeDisplay = classType ? (classType.charAt(0).toUpperCase() + classType.slice(1)) : 'N/A';
        const eventDetailType = document.getElementById('eventDetailType');
        if (eventDetailType) {
            eventDetailType.textContent = typeDisplay;
        }
        
        // Load faculty for the dropdown (only if user can edit)
        const facultySelectContainer = document.getElementById('eventFacultySelect')?.parentElement;
        const facultySelect = document.getElementById('eventFacultySelect');
        const saveFacultyBtn = document.getElementById('saveFacultyBtn');
        
        // Load rooms for the dropdown (only if user can edit)
        const roomSelectContainer = document.getElementById('eventRoomSelect')?.parentElement;
        const roomSelect = document.getElementById('eventRoomSelect');
        const saveRoomBtn = document.getElementById('saveRoomBtn');
        const deleteEventBtn = document.getElementById('deleteEventBtn');
        
        // Load verified faculty members for assignment
        if (allowEdit && facultySelect && eventData.departmentId) {
            facultySelect.innerHTML = '<option value="">Loading faculty...</option>';
            facultySelect.disabled = true;
            
            try {
                // Resolve department ID properly (handle codes, IDs, or malformed values)
                const resolvedDeptId = resolveDepartmentId(eventData.departmentId);
                if (!resolvedDeptId) {
                    console.warn('Could not resolve department ID:', eventData.departmentId);
                    facultySelect.innerHTML = '<option value="">No department found</option>';
                    facultySelect.disabled = false;
                    return;
                }
                
                // Load faculty for the event's department
                const response = await fetchWithAuth(`/api/faculty?departmentId=${encodeURIComponent(resolvedDeptId)}`);
                if (response && response.ok) {
                    const faculty = await response.json();
                    
                    // Filter to only verified faculty and exclude superadmin
                    const verifiedFaculty = faculty.filter(f => 
                        f.verified === true &&
                        f.email !== 'superadmin@school.edu' &&
                        f.role !== 'superadmin' &&
                        String(f.role || '').toLowerCase() !== 'superadmin'
                    );
                    
                    facultySelect.innerHTML = '<option value="">Select a faculty member...</option>';
                    
                    if (verifiedFaculty.length > 0) {
                        verifiedFaculty.forEach(member => {
                            const option = document.createElement('option');
                            option.value = member.id;
                            const name = formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || 'Faculty';
                            option.textContent = name;
                            
                            // Mark current faculty as selected
                            const currentFacultyId = eventData.eventId ? (() => {
                                const calendar = window.calendar;
                                if (calendar) {
                                    const event = calendar.getEventById(eventData.eventId);
                                    if (event && event.extendedProps) {
                                        return event.extendedProps.facultyId;
                                    }
                                }
                                return null;
                            })() : null;
                            
                            if (member.id === currentFacultyId) {
                                option.selected = true;
                            }
                            
                            facultySelect.appendChild(option);
                        });
                    } else {
                        facultySelect.innerHTML = '<option value="">No verified faculty available</option>';
                    }
                    
                    facultySelect.disabled = false;
                }
            } catch (error) {
                console.error('Error loading faculty:', error);
                if (facultySelect) {
                    facultySelect.innerHTML = '<option value="">Error loading faculty</option>';
                }
            }
        } else {
            // Hide faculty editing for regular users or if no department
            if (facultySelectContainer) {
                facultySelectContainer.style.display = allowEdit ? 'block' : 'none';
            }
            if (saveFacultyBtn) {
                saveFacultyBtn.style.display = allowEdit ? '' : 'none';
            }
        }
        
        if (allowEdit && roomSelect) {
            roomSelect.innerHTML = '<option value="">Loading rooms...</option>';
            roomSelect.disabled = true;
        
        try {
            // Load rooms from API or localStorage
            let rooms = [];
            try {
                const response = await fetchWithAuth('/api/rooms');
                if (response && response.ok) {
                    rooms = await response.json();
                }
            } catch (e) {
                // Fallback to localStorage
                const savedRooms = localStorage.getItem('rooms');
                if (savedRooms) {
                    rooms = JSON.parse(savedRooms);
                }
            }
            
            // If rooms still empty, use window.rooms if available
            if (!rooms || rooms.length === 0) {
                rooms = window.rooms || [];
            }
            
            // Filter compatible rooms based on classType, course, and department exclusivity/priority
            let compatibleRooms = filterCompatibleRooms(rooms, eventData.classType, eventData.course, eventData.department, eventData.departmentId);
            
            // Populate room select
            roomSelect.innerHTML = '<option value="">Select a room...</option>';
            
            compatibleRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = `${room.name || room.id}${room.capacity ? ` (Capacity: ${room.capacity})` : ''}`;
                
                // Mark current room as selected
                if (room.id === eventData.currentRoomId || room.name === eventData.currentRoom) {
                    option.selected = true;
                }
                
                // Mark occupied rooms (check if room is occupied at this time)
                if (isRoomOccupiedForEvent(room.id, eventData.eventDate, eventData.startTime, eventData.endTime, eventData.eventId)) {
                    option.textContent += ' (Occupied)';
                    option.disabled = true;
                    option.style.color = '#999';
                }
                
                roomSelect.appendChild(option);
            });
            
            roomSelect.disabled = false;
        } catch (error) {
            console.error('Error loading rooms:', error);
            if (roomSelect) {
                roomSelect.innerHTML = '<option value="">Error loading rooms</option>';
            }
        }
        } else {
            // Hide room editing for regular users
            if (roomSelectContainer) {
                roomSelectContainer.style.display = 'none';
            }
            if (saveRoomBtn) {
                saveRoomBtn.style.display = 'none';
            }
        }
        
        // Store event ID for handlers
        if (roomSelect) roomSelect.dataset.eventId = eventData.eventId || '';
        if (facultySelect) facultySelect.dataset.eventId = eventData.eventId || '';
        
        // Handle save faculty button
        if (saveFacultyBtn && allowEdit) {
            saveFacultyBtn.onclick = async function() {
                try {
                    const calendar = window.calendar;
                    const eventId = eventData.eventId;
                    if (!calendar || !eventId || !facultySelect) return;
                    
                    const selectedFacultyId = facultySelect.value;
                    if (!selectedFacultyId) {
                        if (typeof showNotification === 'function') {
                            showNotification('Please select a faculty member', 'error');
                        }
                        return;
                    }
                    
                    const event = calendar.getEventById(eventId);
                    if (!event) return;
                    
                    // Resolve department ID properly (handle codes, IDs, or malformed values)
                    const resolvedDeptId = resolveDepartmentId(eventData.departmentId);
                    if (!resolvedDeptId) {
                        console.warn('Could not resolve department ID:', eventData.departmentId);
                        if (typeof showNotification === 'function') {
                            showNotification('Could not resolve department ID', 'error');
                        }
                        return;
                    }
                    
                    // Get faculty member details
                    const response = await fetchWithAuth(`/api/faculty?departmentId=${encodeURIComponent(resolvedDeptId)}`);
                    if (response && response.ok) {
                        const faculty = await response.json();
                        const selectedFaculty = faculty.find(f => f.id === selectedFacultyId);
                        
                        if (selectedFaculty) {
                            const facultyName = formatFullName(selectedFaculty.firstName || '', selectedFaculty.middleName || '', selectedFaculty.lastName || '') || selectedFaculty.email || 'Faculty';
                            
                            // Update the event
                            event.setExtendedProp('facultyId', selectedFacultyId);
                            event.setExtendedProp('faculty', facultyName);
                            
                            // Update the display in the modal
                            const teacherElement = document.getElementById('eventDetailTeacher');
                            if (teacherElement) {
                                teacherElement.textContent = facultyName;
                            }
                            
                            // Save to server
                            if (typeof window.saveScheduleToLocalStorage === 'function') {
                                await window.saveScheduleToLocalStorage();
                            }
                            
                            if (typeof showNotification === 'function') {
                                showNotification('Faculty assigned successfully!', 'success');
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error assigning faculty:', error);
                    if (typeof showNotification === 'function') {
                        showNotification('Failed to assign faculty', 'error');
                    }
                }
            };
        }
        
        if (deleteEventBtn) {
            // Only show delete button for superadmin users
            const isSuperAdmin = userRole === 'superadmin';
            if (!isSuperAdmin) {
                deleteEventBtn.style.display = 'none';
            } else {
                deleteEventBtn.style.display = '';
                deleteEventBtn.dataset.eventId = eventData.eventId || '';
                // Bind a fresh click handler scoped to this event
                deleteEventBtn.onclick = async function() {
                    try {
                        const calendar = window.calendar;
                        const idToDelete = eventData.eventId;
                        if (!calendar || !idToDelete) return;
                        const evt = calendar.getEventById(idToDelete);
                        if (!evt) return;
                        evt.remove();
                        if (typeof window.saveScheduleToLocalStorage === 'function') {
                            await window.saveScheduleToLocalStorage();
                        }
                        const modalEl = document.getElementById('eventDetailsModal');
                        if (modalEl) {
                            modalEl.style.display = 'none';
                            document.body.style.overflow = 'auto';
                        }
                        if (typeof showNotification === 'function') {
                            showNotification('Schedule deleted from timetable.', 'success');
                        }
                    } catch (e) {
                        console.error('Delete event failed:', e);
                        if (typeof showNotification === 'function') {
                            showNotification('Failed to delete schedule.', 'error');
                        }
                    }
                };
            }
        }
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Add animation
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
    
    // Function to filter compatible rooms
    function filterCompatibleRooms(rooms, classType, course, eventDepartmentName, eventDepartmentId) {
        if (!rooms || rooms.length === 0) return [];
        
        let compatible = [...rooms];

        const sameDept = (room) => {
            // More robust department matching
            const rDeptId = room.departmentId ? String(room.departmentId).trim() : '';
            const rDept = room.department ? String(room.department).trim() : '';
            const eDeptId = eventDepartmentId ? String(eventDepartmentId).trim() : '';
            const eDept = eventDepartmentName ? String(eventDepartmentName).trim() : '';
            
            // Match by ID first (most reliable)
            if (rDeptId && eDeptId && rDeptId === eDeptId) {
                return true;
            }
            
            // Match by name (case-insensitive)
            if (rDept && eDept && rDept.toLowerCase() === eDept.toLowerCase()) {
                return true;
            }
            
            // Also try matching room department name to event department ID
            // (in case department name is stored but we're comparing with ID)
            if (rDept && eDeptId) {
                // Try to match by loading departments from localStorage
                try {
                    const departments = JSON.parse(localStorage.getItem('departments') || '[]');
                    const dept = departments.find(d => String(d.id).trim() === eDeptId);
                    if (dept && (String(dept.name).toLowerCase() === rDept.toLowerCase() || 
                                 String(dept.code).toLowerCase() === rDept.toLowerCase())) {
                        return true;
                    }
                } catch (e) {
                    console.warn('Error loading departments for matching:', e);
                }
            }
            
            return false;
        };

        // Enforce exclusivity: exclude rooms exclusive to another department
        // IMPORTANT: If a room is marked exclusive, it can ONLY be used by its assigned department
        compatible = compatible.filter(room => {
            // Check if room is exclusive (handle boolean values)
            const isExclusive = room.exclusive === true || room.exclusive === 'true' || room.exclusive === 1;
            
            if (isExclusive) {
                // Room is exclusive - only allow if it matches the event's department
                const matches = sameDept(room);
                if (!matches) {
                    console.log(`[Room Filter] Excluding exclusive room "${room.name || room.id}" - belongs to different department`);
                }
                return matches;
            }
            // Room is not exclusive - available to all departments
            return true;
        });
        
        // Apply specific rules based on course and class type
        // IMPORTANT: Use the filtered 'compatible' array (which already excludes exclusive rooms)
        if (course === 'BSIT' && classType === 'laboratory') {
            // BSIT lab classes - prefer rooms with 'CL' in name or ID
            const priorityRooms = compatible.filter(r => 
                (r.id && r.id.includes('CL')) || 
                (r.name && (r.name.includes('CL') || r.name.includes('Computer') || r.name.includes('Lab')))
            );
            const otherRooms = compatible.filter(r => 
                !priorityRooms.includes(r)
            );
            if (priorityRooms.length > 0) {
                compatible = [...priorityRooms, ...otherRooms];
            }
        } else if (course === 'BSHM' && classType === 'laboratory') {
            // BSHM lab classes - prefer rooms with 'KITCHEN' or 'DINING' in name
            const kitchenRoom = compatible.find(r => 
                (r.id && r.id.includes('KITCHEN')) || 
                (r.name && (r.name.includes('Kitchen') || r.name.includes('kitchen')))
            );
            const diningRoom = compatible.find(r => 
                (r.id && r.id.includes('DINING')) || 
                (r.name && (r.name.includes('Dining') || r.name.includes('dining')))
            );
            const otherRooms = compatible.filter(r => 
                r !== kitchenRoom && r !== diningRoom
            );
            const priorityRooms = [kitchenRoom, diningRoom].filter(Boolean);
            if (priorityRooms.length > 0) {
                compatible = [...priorityRooms, ...otherRooms];
            }
        }

        // Department priority ordering: rooms with priority for this department first
        const deptPriority = compatible.filter(r => r.priority && sameDept(r));
        const others = compatible.filter(r => !(r.priority && sameDept(r)));
        if (deptPriority.length > 0) {
            compatible = [...deptPriority, ...others];
        } else {
            compatible = [...others];
        }
        
        return compatible;
    }
    
    // Function to check if room is occupied for a specific event
    function isRoomOccupiedForEvent(roomId, eventDate, startTime, endTime, currentEventId) {
        const calendar = window.calendar;
        if (!calendar || !eventDate || !startTime || !endTime) return false;
        
        const events = calendar.getEvents();
        
        // Convert times to minutes for comparison
        const convertTimeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        
        const start = convertTimeToMinutes(startTime);
        const end = convertTimeToMinutes(endTime);
        
        // Format event date for comparison
        const targetDate = new Date(eventDate);
        
        for (const event of events) {
            // Skip the current event
            if (event.id === currentEventId) continue;
            
            // Check if event uses this room
            if (event.extendedProps?.roomId === roomId) {
                if (event.start) {
                    const eventDate = new Date(event.start);
                    const sameDate = targetDate.getFullYear() === eventDate.getFullYear() &&
                                   targetDate.getMonth() === eventDate.getMonth() &&
                                   targetDate.getDate() === eventDate.getDate();
                    
                    if (sameDate) {
                        const eventStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                        const eventEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                        
                        // Check for overlap
                        if (start < eventEnd && eventStart < end) {
                            return true; // Room is occupied
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    // Handle save room button
    const saveRoomBtn = document.getElementById('saveRoomBtn');
    const deleteEventBtn = document.getElementById('deleteEventBtn');
    if (saveRoomBtn) {
        saveRoomBtn.addEventListener('click', async function() {
            const roomSelect = document.getElementById('eventRoomSelect');
            const eventId = roomSelect?.dataset.eventId;
            
            if (!eventId || !roomSelect?.value) {
                alert('Please select a room');
                return;
            }
            
            const calendar = window.calendar;
            if (!calendar) {
                alert('Calendar not available');
                return;
            }
            
            const event = calendar.getEventById(eventId);
            if (!event) {
                alert('Event not found');
                return;
            }
            
            // Get selected room details
            const selectedOption = roomSelect.options[roomSelect.selectedIndex];
            const newRoomId = roomSelect.value;
            const newRoomName = selectedOption.textContent.replace(' (Occupied)', '').replace(/ \(Capacity: \d+\)/, '').trim();
            
            // Check if room is occupied (skip if it's the current room)
            if (selectedOption.disabled && event.extendedProps?.roomId !== newRoomId) {
                if (typeof showNotification === 'function') {
                    showNotification('This room is occupied at this time. Please select a different room.', 'error');
                } else {
                    alert('This room is occupied at this time. Please select a different room.');
                }
                return;
            }
            
            // Validate that the selected room is not exclusive to another department
            try {
                // Get all rooms
                let allRooms = [];
                try {
                    const response = await fetchWithAuth('/api/rooms');
                    if (response && response.ok) {
                        allRooms = await response.json();
                    }
                } catch (e) {
                    const savedRooms = localStorage.getItem('rooms');
                    if (savedRooms) {
                        allRooms = JSON.parse(savedRooms);
                    }
                }
                
                if (!allRooms || allRooms.length === 0) {
                    allRooms = window.rooms || [];
                }
                
                const selectedRoom = allRooms.find(r => String(r.id) === String(newRoomId));
                if (selectedRoom) {
                    const isExclusive = selectedRoom.exclusive === true || selectedRoom.exclusive === 'true' || selectedRoom.exclusive === 1;
                    if (isExclusive) {
                        // Get event department info
                        const eventDeptId = event.extendedProps?.departmentId;
                        const eventDeptName = event.extendedProps?.department || event.extendedProps?.course;
                        
                        // Check if room belongs to event's department
                        const roomDeptId = selectedRoom.departmentId ? String(selectedRoom.departmentId).trim() : '';
                        const roomDeptName = selectedRoom.department ? String(selectedRoom.department).trim() : '';
                        const eventDeptIdStr = eventDeptId ? String(eventDeptId).trim() : '';
                        const eventDeptNameStr = eventDeptName ? String(eventDeptName).trim() : '';
                        
                        let matches = false;
                        if (roomDeptId && eventDeptIdStr && roomDeptId === eventDeptIdStr) {
                            matches = true;
                        } else if (roomDeptName && eventDeptNameStr && roomDeptName.toLowerCase() === eventDeptNameStr.toLowerCase()) {
                            matches = true;
                        }
                        
                        if (!matches) {
                            const roomName = selectedRoom.name || newRoomId;
                            const deptName = roomDeptName || 'another department';
                            if (typeof showNotification === 'function') {
                                showNotification(`Cannot change to room "${roomName}" - it is exclusive to ${deptName}.`, 'error');
                            } else {
                                alert(`Cannot change to room "${roomName}" - it is exclusive to ${deptName}.`);
                            }
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error('Error validating room exclusivity:', error);
                // Continue if validation fails (don't block the user)
            }
            
            // Update event extended properties
            event.setExtendedProp('roomId', newRoomId);
            event.setExtendedProp('room', newRoomName);
            
            // Update the displayed room in the modal
            document.getElementById('eventDetailRoom').textContent = newRoomName;
            
            // Force re-render to update the event content
            event.setProp('title', event.extendedProps.subject || event.title);
            
            // Save to server
            if (typeof window.saveScheduleToLocalStorage === 'function') {
                await window.saveScheduleToLocalStorage();
            }
            
            // Show success notification
            if (typeof showNotification === 'function') {
                showNotification('Room updated successfully!', 'success');
            } else {
                alert('Room updated successfully!');
            }
        });
    }

    // Delete selected event from the timetable
    if (deleteEventBtn) {
        deleteEventBtn.addEventListener('click', async function() {
            const eventId = this?.dataset?.eventId || document.getElementById('eventRoomSelect')?.dataset?.eventId;
            const calendar = window.calendar;
            if (!calendar || !eventId) return;

            const evt = calendar.getEventById(eventId);
            if (evt) {
                try {
                    evt.remove();
                    if (typeof window.saveScheduleToLocalStorage === 'function') {
                        await window.saveScheduleToLocalStorage();
                    }
                    // Close modal
                    const modal = document.getElementById('eventDetailsModal');
                    if (modal) {
                        modal.style.display = 'none';
                        document.body.style.overflow = 'auto';
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('Schedule deleted from timetable.', 'success');
                    }
                } catch (e) {
                    console.error('Failed to delete event:', e);
                    if (typeof showNotification === 'function') {
                        showNotification('Failed to delete schedule.', 'error');
                    }
                }
            }
        });
    }
    
    // Handle modal close buttons
    document.querySelectorAll('[data-close-modal="eventDetailsModal"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = document.getElementById('eventDetailsModal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // Close modal when clicking outside
    const eventDetailsModal = document.getElementById('eventDetailsModal');
    if (eventDetailsModal) {
        eventDetailsModal.addEventListener('click', function(e) {
            if (e.target === eventDetailsModal) {
                eventDetailsModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Resilient event delegation for Delete Schedule button to avoid stale bindings
    document.addEventListener('click', async function(e) {
        const btn = e.target?.closest && e.target.closest('#deleteEventBtn');
        if (!btn) return;
        e.preventDefault();
        try {
            const calendar = window.calendar;
            const idFromBtn = btn.dataset?.eventId;
            const idFromSelect = document.getElementById('eventRoomSelect')?.dataset?.eventId;
            const eventId = idFromBtn || idFromSelect;
            if (!calendar || !eventId) return;
            const evt = calendar.getEventById(eventId);
            if (!evt) return;
            evt.remove();
            if (typeof window.saveScheduleToLocalStorage === 'function') {
                await window.saveScheduleToLocalStorage();
            }
            const modalEl = document.getElementById('eventDetailsModal');
            if (modalEl) {
                modalEl.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            if (typeof showNotification === 'function') {
                showNotification('Schedule deleted from timetable.', 'success');
            }
        } catch (err) {
            console.error('Delegated delete failed:', err);
            if (typeof showNotification === 'function') {
                showNotification('Failed to delete schedule.', 'error');
            }
        }
    });
    
    // Handle clear classes button
    const clearClassesBtn = document.getElementById('clearClassesBtn');
    if (clearClassesBtn) {
        clearClassesBtn.addEventListener('click', function() {
            // Check if there are any classes to clear
                const classesList = document.getElementById('createdClasses');
            const classItems = classesList ? classesList.querySelectorAll('.class-item') : [];
            const hasClasses = (window.allClasses && window.allClasses.length > 0) || classItems.length > 0;
            
            if (!hasClasses) {
                // Show notification instead of alert
                if (typeof showNotification === 'function') {
                    showNotification('No classes to clear.', 'info');
                }
                        return;
                    }
                    
            // Check if window.showClearClassesConfirmation exists (from main.js)
            if (typeof window.showClearClassesConfirmation === 'function') {
                window.showClearClassesConfirmation();
            } else {
                // Show confirmation modal
                const clearClassesModal = document.getElementById('clearClassesModal');
                if (clearClassesModal) {
                    // Reset modal state
                    const confirmInput = document.getElementById('confirmClearClassesInput');
                    const confirmBtn = document.getElementById('confirmClearClassesBtn');
                    const errorMsg = document.getElementById('confirmClearClassesError');
                    
                    if (confirmInput) confirmInput.value = '';
                    if (confirmBtn) confirmBtn.disabled = true;
                    if (errorMsg) errorMsg.style.display = 'none';
                    
                    // Show modal
                    clearClassesModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                    
                    // Focus on input
                    setTimeout(() => {
                        if (confirmInput) confirmInput.focus();
                    }, 100);
                }
            }
        });
    }
    
    // ========== FILTER SYSTEM ==========
    // Initialize filter functionality (only for superadmin)
    function initializeFilters() {
        // Check if user is superadmin
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.role || 'user';
        const isSuperAdmin = userRole === 'superadmin';
        
        if (!isSuperAdmin) {
            console.log('Filter system is only available for superadmin');
            return;
        }
        
        const filterDepartment = document.getElementById('filterDepartment');
        const filterFaculty = document.getElementById('filterFaculty');
        const filterRoom = document.getElementById('filterRoom');
        const filterCourse = document.getElementById('filterCourse');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        const filterStatus = document.getElementById('filterStatus');
        
        if (!filterDepartment || !filterFaculty || !filterRoom || !filterCourse) {
            console.warn('Filter elements not found');
            return;
        }
        
        // Load filter options from calendar events
        function loadFilterOptions() {
            const calendar = window.calendar;
            if (!calendar) return;
            
            const events = calendar.getEvents();
            const departments = new Set();
            const faculties = new Set();
            const rooms = new Set();
            const courses = new Set();
            
            // Get departments list to resolve IDs to names
            const deptsList = window.departments || JSON.parse(localStorage.getItem('departments') || '[]');
            
            events.forEach(event => {
                const props = event.extendedProps || {};
                
                // Skip fixed schedules
                if (props.isFixedSchedule) return;
                
                // For departments, prefer department name, but resolve departmentId if needed
                if (props.department) {
                    departments.add(props.department);
                } else if (props.departmentId) {
                    // Try to resolve departmentId to department name
                    const dept = deptsList.find(d => String(d.id) === String(props.departmentId) || String(d.code) === String(props.departmentId));
                    if (dept && dept.name) {
                        departments.add(dept.name);
                    } else if (dept && dept.code) {
                        departments.add(dept.code);
                    } else {
                        // Fallback: use departmentId only if we can't resolve it
                        // But try to avoid adding raw IDs like "dept1", "dept2"
                        const deptIdStr = String(props.departmentId);
                        if (!deptIdStr.match(/^dept\d+$/i)) {
                            departments.add(deptIdStr);
                        }
                    }
                }
                
                if (props.faculty) faculties.add(props.faculty);
                if (props.room) rooms.add(props.room);
                if (props.course) courses.add(props.course);
            });
            
            // Populate department filter
            const deptOptions = filterDepartment.querySelectorAll('option:not(:first-child)');
            deptOptions.forEach(opt => opt.remove());
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                filterDepartment.appendChild(option);
            });
            
            // Populate faculty filter
            const facOptions = filterFaculty.querySelectorAll('option:not(:first-child)');
            facOptions.forEach(opt => opt.remove());
            faculties.forEach(fac => {
                const option = document.createElement('option');
                option.value = fac;
                option.textContent = fac;
                filterFaculty.appendChild(option);
            });
            
            // Populate room filter
            const roomOptions = filterRoom.querySelectorAll('option:not(:first-child)');
            roomOptions.forEach(opt => opt.remove());
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room;
                option.textContent = room;
                filterRoom.appendChild(option);
            });
            
            // Populate course filter
            const courseOptions = filterCourse.querySelectorAll('option:not(:first-child)');
            courseOptions.forEach(opt => opt.remove());
            courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                filterCourse.appendChild(option);
            });
        }
        
        // Apply filters to calendar events
        function applyFilters() {
            const calendar = window.calendar;
            if (!calendar) return;
            
            const selectedDept = filterDepartment.value;
            const selectedFaculty = filterFaculty.value;
            const selectedRoom = filterRoom.value;
            const selectedCourse = filterCourse.value;
            
            const events = calendar.getEvents();
            let visibleCount = 0;
            let totalCount = 0;
            
            events.forEach(event => {
                const props = event.extendedProps || {};
                
                // Always show fixed schedules
                if (props.isFixedSchedule) {
                    event.setProp('classNames', (event.classNames || []).filter(c => c !== 'filtered-out'));
                    if (event.el) {
                        event.el.classList.remove('filtered-out');
                        event.el.style.display = '';
                    }
                    return;
                }
                
                totalCount++;
                
                // Check if event matches all selected filters
                let matches = true;
                
                if (selectedDept) {
                    const deptMatch = props.department === selectedDept || 
                                     props.departmentId === selectedDept ||
                                     String(props.department || '').toLowerCase() === String(selectedDept).toLowerCase();
                    if (!deptMatch) matches = false;
                }
                
                if (selectedFaculty && matches) {
                    const facMatch = props.faculty === selectedFaculty ||
                                    String(props.faculty || '').toLowerCase() === String(selectedFaculty).toLowerCase();
                    if (!facMatch) matches = false;
                }
                
                if (selectedRoom && matches) {
                    const roomMatch = props.room === selectedRoom ||
                                     props.roomId === selectedRoom ||
                                     String(props.room || '').toLowerCase() === String(selectedRoom).toLowerCase();
                    if (!roomMatch) matches = false;
                }
                
                if (selectedCourse && matches) {
                    const courseMatch = props.course === selectedCourse ||
                                      props.courseId === selectedCourse ||
                                      String(props.course || '').toLowerCase() === String(selectedCourse).toLowerCase();
                    if (!courseMatch) matches = false;
                }
                
                // Show or hide event using CSS class
                if (matches) {
                    event.setProp('classNames', (event.classNames || []).filter(c => c !== 'filtered-out'));
                    if (event.el) {
                        event.el.classList.remove('filtered-out');
                        event.el.style.display = '';
                    }
                    visibleCount++;
                } else {
                    const classNames = event.classNames || [];
                    if (!classNames.includes('filtered-out')) {
                        event.setProp('classNames', [...classNames, 'filtered-out']);
                    }
                    if (event.el) {
                        event.el.classList.add('filtered-out');
                        event.el.style.display = 'none';
                    }
                }
            });
            
            // Update filter status
            if (filterStatus) {
                const hasFilters = selectedDept || selectedFaculty || selectedRoom || selectedCourse;
                if (hasFilters) {
                    const filterParts = [];
                    if (selectedDept) filterParts.push(`Department: ${selectedDept}`);
                    if (selectedFaculty) filterParts.push(`Faculty: ${selectedFaculty}`);
                    if (selectedRoom) filterParts.push(`Room: ${selectedRoom}`);
                    if (selectedCourse) filterParts.push(`Course: ${selectedCourse}`);
                    filterStatus.textContent = `Showing ${visibleCount} of ${totalCount} schedules (${filterParts.join(', ')})`;
                } else {
                    filterStatus.textContent = `Showing all ${totalCount} schedules`;
                }
            }
        }
        
        // Clear all filters
        function clearFilters() {
            filterDepartment.value = '';
            filterFaculty.value = '';
            filterRoom.value = '';
            filterCourse.value = '';
            applyFilters();
            updateFilterVisuals();
        }
        
        // Add visual feedback for active filters
        function updateFilterVisuals() {
            const filters = [
                { element: filterDepartment, labelId: 'filterDepartment' },
                { element: filterFaculty, labelId: 'filterFaculty' },
                { element: filterRoom, labelId: 'filterRoom' },
                { element: filterCourse, labelId: 'filterCourse' }
            ];
            
            filters.forEach(({ element, labelId }) => {
                if (element) {
                    const label = document.querySelector(`label[for="${labelId}"]`);
                    if (element.value) {
                        element.classList.add('filter-active');
                        if (label && label.querySelector('span')) {
                            label.querySelector('span').style.color = '#1A609B';
                        }
                    } else {
                        element.classList.remove('filter-active');
                        if (label && label.querySelector('span')) {
                            label.querySelector('span').style.color = '';
                        }
                    }
                }
            });
        }
        
        // Event listeners
        filterDepartment.addEventListener('change', () => {
            updateFilterVisuals();
            applyFilters();
        });
        filterFaculty.addEventListener('change', () => {
            updateFilterVisuals();
            applyFilters();
        });
        filterRoom.addEventListener('change', () => {
            updateFilterVisuals();
            applyFilters();
        });
        filterCourse.addEventListener('change', () => {
            updateFilterVisuals();
            applyFilters();
        });
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                clearFilters();
                updateFilterVisuals();
            });
        }
        
        // Load filter options when calendar events change
        const originalAddEvent = calendar.addEvent.bind(calendar);
        calendar.addEvent = function(...args) {
            const result = originalAddEvent(...args);
            setTimeout(loadFilterOptions, 100);
            setTimeout(applyFilters, 100);
            return result;
        };
        
        // Monitor for event changes
        const observer = new MutationObserver(() => {
            setTimeout(loadFilterOptions, 500);
            setTimeout(applyFilters, 500);
        });
        
        // Initial load
        setTimeout(() => {
            loadFilterOptions();
            applyFilters();
            updateFilterVisuals();
        }, 1000);
        
        // Re-load filters when schedule is loaded
        if (window.loadScheduleFromLocalStorage) {
            const originalLoad = window.loadScheduleFromLocalStorage;
            window.loadScheduleFromLocalStorage = function(...args) {
                const result = originalLoad.apply(this, args);
                setTimeout(() => {
                    loadFilterOptions();
                    applyFilters();
                }, 1500);
                return result;
            };
        }
    }
    
    // Initialize filters after calendar is ready
    setTimeout(() => {
        initializeFilters();
    }, 1500);
    
    // Initialize unassigned schedules functionality
    initializeUnassignedSchedules();
});

/**
 * Initialize unassigned schedules functionality
 */
function initializeUnassignedSchedules() {
    const unassignedPanel = document.getElementById('unassignedSchedulesPanel');
    const assignFacultySelect = document.getElementById('assignFacultySelect');
    const assignSchedulesBtn = document.getElementById('assignSchedulesBtn');
    const unassignedSchedulesList = document.getElementById('unassignedSchedulesList');
    const unassignedCountBadge = document.getElementById('unassignedCountBadge');
    const searchInput = document.getElementById('searchUnassignedSchedules');
    
    // Store all schedules for filtering
    let allUnassignedSchedules = [];
    
    if (!unassignedPanel || !assignFacultySelect || !assignSchedulesBtn || !unassignedSchedulesList) {
        return; // Elements not found, skip initialization
    }
    
    // Load unassigned schedules on page load
    loadUnassignedSchedules();
    
    // Load faculty members for assignment dropdown
    loadFacultyForAssignment();
    
    // Handle search input
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterUnassignedSchedules(this.value);
        });
    }
    
    // Handle faculty selection change
    assignFacultySelect.addEventListener('change', function() {
        assignSchedulesBtn.disabled = !this.value;
        updateSelectedSchedules();
    });
    
    // Handle assign button click
    assignSchedulesBtn.addEventListener('click', async function() {
        const facultyId = assignFacultySelect.value;
        if (!facultyId) {
            if (typeof showNotification === 'function') {
                showNotification('Please select a faculty member', 'error');
            } else {
                alert('Please select a faculty member');
            }
            return;
        }
        
        const selectedCheckboxes = unassignedSchedulesList.querySelectorAll('input[type="checkbox"]:checked');
        if (selectedCheckboxes.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification('Please select at least one schedule to assign', 'error');
            } else {
                alert('Please select at least one schedule to assign');
            }
            return;
        }
        
        const scheduleIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/schedule/assign-faculty', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    scheduleIds,
                    facultyId
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to assign schedules');
            }
            
            const result = await response.json();
            if (typeof showNotification === 'function') {
                showNotification(result.message || 'Schedules assigned successfully', 'success');
            } else {
                alert(result.message || 'Schedules assigned successfully');
            }
            
            // Clear search input
            if (searchInput) {
                searchInput.value = '';
            }
            
            // Reload unassigned schedules and refresh calendar
            loadUnassignedSchedules();
            if (window.loadScheduleFromLocalStorage) {
                window.loadScheduleFromLocalStorage();
            }
        } catch (error) {
            console.error('Error assigning schedules:', error);
            if (typeof showNotification === 'function') {
                showNotification(error.message || 'Failed to assign schedules', 'error');
            } else {
                alert(error.message || 'Failed to assign schedules');
            }
        }
    });
    
    /**
     * Load unassigned schedules
     */
    async function loadUnassignedSchedules() {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetchWithAuth('/api/schedule/unassigned', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response || !response.ok) {
                throw new Error('Failed to fetch unassigned schedules');
            }
            
            const unassignedSchedules = await response.json();
            
            // Update badge
            if (unassignedCountBadge) {
                unassignedCountBadge.textContent = unassignedSchedules.length;
            }
            
            // Store all unassigned schedules for filtering
            allUnassignedSchedules = unassignedSchedules;
            
            // Check if there are any schedules at all (to determine if panel should show)
            // We need to fetch the full schedule to check if any schedules exist
            let totalSchedulesCount = 0;
            try {
                const scheduleResponse = await fetchWithAuth('/api/schedule', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                if (scheduleResponse && scheduleResponse.ok) {
                    const allSchedules = await scheduleResponse.json();
                    totalSchedulesCount = Array.isArray(allSchedules) ? allSchedules.length : 0;
                }
            } catch (e) {
                console.warn('Could not fetch total schedule count:', e);
            }
            
            // Check user role - always show panel for admins/superadmins
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userRole = userData.role || 'user';
            const isAdmin = userRole === 'admin' || userRole === 'superadmin';
            
            // Show panel if:
            // 1. There are unassigned schedules, OR
            // 2. There are any schedules at all (even if all assigned), OR
            // 3. User is admin/superadmin (always show for them)
            if (unassignedSchedules.length > 0 || totalSchedulesCount > 0 || isAdmin) {
                unassignedPanel.style.display = 'block';
            } else {
                unassignedPanel.style.display = 'none';
                return;
            }
            
            // Display schedules (apply search filter if any)
            const searchTerm = searchInput ? searchInput.value : '';
            displayUnassignedSchedules(unassignedSchedules, searchTerm);
            
        } catch (error) {
            console.error('Error loading unassigned schedules:', error);
            unassignedPanel.style.display = 'none';
        }
    }
    
    /**
     * Display unassigned schedules with optional search filter
     */
    function displayUnassignedSchedules(schedules, searchTerm = '') {
        // Filter schedules based on search term
        const filteredSchedules = searchTerm.trim() 
            ? schedules.filter(schedule => {
                const extendedProps = schedule.extendedProps || {};
                const subject = (extendedProps.subject || schedule.title || '').toLowerCase();
                const department = (extendedProps.department || extendedProps.course || '').toLowerCase();
                const day = (extendedProps.dayOfWeek || (schedule.start ? new Date(schedule.start).toLocaleDateString('en-US', { weekday: 'long' }) : '')).toLowerCase();
                const startTime = schedule.start ? new Date(schedule.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                const endTime = schedule.end ? new Date(schedule.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                const room = (extendedProps.room || '').toLowerCase();
                const searchLower = searchTerm.toLowerCase();
                
                return subject.includes(searchLower) ||
                       department.includes(searchLower) ||
                       day.includes(searchLower) ||
                       startTime.includes(searchLower) ||
                       endTime.includes(searchLower) ||
                       room.includes(searchLower);
            })
            : schedules;
        
        // Display schedules
        if (filteredSchedules.length === 0) {
            unassignedSchedulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>${searchTerm.trim() ? 'No schedules match your search' : 'No unassigned schedules'}</p>
                </div>
            `;
            return;
        }
        
        unassignedSchedulesList.innerHTML = filteredSchedules.map(schedule => {
                const extendedProps = schedule.extendedProps || {};
                const subject = extendedProps.subject || schedule.title || 'Unknown Subject';
                const department = extendedProps.department || extendedProps.course || 'Unknown Department';
                const day = extendedProps.dayOfWeek || (schedule.start ? new Date(schedule.start).toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown Day');
                const startTime = schedule.start ? new Date(schedule.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                const endTime = schedule.end ? new Date(schedule.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                const room = extendedProps.room || 'No room';
                
                return `
                    <div style="padding: 10px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" value="${schedule.id}" style="cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1e293b;">${subject}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">
                                <span><i class="fas fa-building"></i> ${department}</span> | 
                                <span><i class="fas fa-calendar-day"></i> ${day}</span> | 
                                <span><i class="fas fa-clock"></i> ${startTime} - ${endTime}</span> | 
                                <span><i class="fas fa-door-open"></i> ${room}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
        // Add select all checkbox
        const selectAllHtml = `
            <div style="padding: 10px; border-bottom: 2px solid #e0e0e0; background: #f8fafc;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 500;">
                    <input type="checkbox" id="selectAllUnassigned" style="cursor: pointer;">
                    <span>Select All (${filteredSchedules.length} shown)</span>
                </label>
            </div>
        `;
        unassignedSchedulesList.innerHTML = selectAllHtml + unassignedSchedulesList.innerHTML;
        
        // Handle select all
        const selectAllCheckbox = document.getElementById('selectAllUnassigned');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                const checkboxes = unassignedSchedulesList.querySelectorAll('input[type="checkbox"]:not(#selectAllUnassigned)');
                checkboxes.forEach(cb => cb.checked = this.checked);
                updateSelectedSchedules();
            });
        }
        
        // Handle individual checkbox changes
        unassignedSchedulesList.querySelectorAll('input[type="checkbox"]:not(#selectAllUnassigned)').forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedSchedules);
        });
    }
    
    /**
     * Filter unassigned schedules based on search term
     */
    function filterUnassignedSchedules(searchTerm) {
        displayUnassignedSchedules(allUnassignedSchedules, searchTerm);
    }
    
    /**
     * Update selected schedules count and button state
     */
    function updateSelectedSchedules() {
        const selectedCheckboxes = unassignedSchedulesList.querySelectorAll('input[type="checkbox"]:not(#selectAllUnassigned):checked');
        const facultyId = assignFacultySelect.value;
        assignSchedulesBtn.disabled = !facultyId || selectedCheckboxes.length === 0;
        
        if (selectedCheckboxes.length > 0) {
            assignSchedulesBtn.textContent = `Assign ${selectedCheckboxes.length} Schedule(s)`;
        } else {
            assignSchedulesBtn.textContent = 'Assign Selected Schedules';
        }
    }
    
    /**
     * Load faculty members for assignment dropdown
     */
    async function loadFacultyForAssignment() {
        try {
            const deptSelect = document.getElementById('departmentSelect');
            if (!deptSelect || !deptSelect.value) {
                // Load all faculty if no department selected
                const response = await fetchWithAuth('/api/faculty');
                if (response && response.ok) {
                    const faculty = await response.json();
                    // Filter out superadmin
                    const filteredFaculty = faculty.filter(f => 
                        f.email !== 'superadmin@school.edu' &&
                        f.role !== 'superadmin' &&
                        String(f.role || '').toLowerCase() !== 'superadmin'
                    );
                    populateFacultyAssignmentDropdown(filteredFaculty);
                }
            } else {
                // Load faculty for selected department
                if (typeof loadFaculty === 'function') {
                    const faculty = await loadFacultyForDept(deptSelect.value);
                    // Filter out superadmin
                    const filteredFaculty = (faculty || []).filter(f => 
                        f.email !== 'superadmin@school.edu' &&
                        f.role !== 'superadmin' &&
                        String(f.role || '').toLowerCase() !== 'superadmin'
                    );
                    populateFacultyAssignmentDropdown(filteredFaculty);
                }
            }
        } catch (error) {
            console.error('Error loading faculty for assignment:', error);
        }
    }
    
    /**
     * Load faculty for a specific department
     */
    async function loadFacultyForDept(departmentId) {
        try {
            // Resolve department ID properly (handle codes, IDs, or malformed values)
            const resolvedDeptId = resolveDepartmentId(departmentId);
            if (!resolvedDeptId) {
                console.warn('Could not resolve department ID:', departmentId);
                return [];
            }
            
            const response = await fetchWithAuth(`/api/faculty?departmentId=${encodeURIComponent(resolvedDeptId)}`);
            if (response && response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Error loading faculty for department:', error);
        }
        return [];
    }
    
    /**
     * Populate faculty assignment dropdown
     */
    function populateFacultyAssignmentDropdown(faculty) {
        assignFacultySelect.innerHTML = '<option value="">Select Faculty Member</option>';
        
        // Filter out superadmin account
        const filteredFaculty = (faculty || []).filter(member => 
            member.email !== 'superadmin@school.edu' &&
            member.role !== 'superadmin' &&
            String(member.role || '').toLowerCase() !== 'superadmin'
        );
        
        if (filteredFaculty.length > 0) {
            filteredFaculty.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                const name = formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || 'Faculty';
                option.textContent = `${name}${member.department ? ' - ' + member.department : ''}`;
                assignFacultySelect.appendChild(option);
            });
        }
    }
    
    // Reload unassigned schedules when department changes
    const deptSelect = document.getElementById('departmentSelect');
    if (deptSelect) {
        deptSelect.addEventListener('change', function() {
            loadFacultyForAssignment();
            loadUnassignedSchedules();
        });
    }
    
    // Reload unassigned schedules periodically (every 30 seconds)
    setInterval(() => {
        loadUnassignedSchedules();
    }, 30000);
}
