// FullCalendar Test Initialization + Data Loading Functions from index.html

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
                        name: `${u.firstName||''} ${u.lastName||''}`.trim() || u.email || 'Faculty', 
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
                        name: `${a.firstName||''} ${a.lastName||''}`.trim() || a.email || 'Faculty', 
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

        // Update faculty select
        facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty</option>';
        (faculty||[]).forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            // tolerate different shapes
            const display = f.name || `${f.firstName||''} ${f.lastName||''}`.trim() || f.email || 'Faculty';
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
                userNameEl.textContent = user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email) || 'User';
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
        const isUser = userRole === 'user';
        
        // Hide/disable form panel and action buttons for regular users
        if (isUser) {
            const leftColumn = document.querySelector('.left-column');
            if (leftColumn) {
                leftColumn.style.display = 'none';
            }
            
            // Make right column take full width when left column is hidden
            const rightColumn = document.querySelector('.right-column');
            if (rightColumn) {
                rightColumn.style.flex = '1 1 100%';
                rightColumn.style.maxWidth = '100%';
            }
            
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
        
        // Load rooms for the dropdown (only if user can edit)
        const roomSelectContainer = document.getElementById('eventRoomSelect')?.parentElement;
        const roomSelect = document.getElementById('eventRoomSelect');
        const saveRoomBtn = document.getElementById('saveRoomBtn');
        const deleteEventBtn = document.getElementById('deleteEventBtn');
        
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
});
