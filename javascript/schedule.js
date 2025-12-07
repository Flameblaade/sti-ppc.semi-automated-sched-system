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

// Helper function to get course/strand code from event extendedProps or classData
function getCourseCodeFromEvent(extendedProps) {
    const courseId = extendedProps.courseId || extendedProps.programId || '';
    const courseName = extendedProps.course || extendedProps.department || '';
    
    if (!courseId && !courseName) {
        return 'N/A';
    }
    
    // If courseId exists, try to look up the code
    if (courseId) {
        try {
            const courses = JSON.parse(localStorage.getItem('courses') || '[]');
            const strands = JSON.parse(localStorage.getItem('strands') || '[]');
            const allPrograms = [...courses, ...strands];
            
            // Find the program/strand by ID or code
            const program = allPrograms.find(p => 
                p.id === courseId || 
                p.code === courseId ||
                String(p.id) === String(courseId)
            );
            
            if (program && program.code) {
                return program.code;
            }
            
            // If courseId is actually the code itself, return it
            return courseId;
        } catch (e) {
            console.warn('Error getting course code from event:', e);
        }
    }
    
    // If no courseId, try to extract code from course name (format: "CODE - Name")
    if (courseName && courseName.includes(' - ')) {
        return courseName.split(' - ')[0];
    }
    
    // Fallback: return course name or N/A
    return courseName || 'N/A';
}

// Helper function to remove department from faculty name
function cleanFacultyName(facultyName) {
    if (!facultyName) return 'N/A';
    // Remove department suffix if present (format: "Name - Department" or "Name - Department Department")
    let cleaned = facultyName.replace(/\s*-\s*[^-]+(?:\s+Department)?\s*$/i, '').trim();
    // Remove "(Optional for Superadmin)" text if present
    cleaned = cleaned.replace(/\s*\(Optional for Superadmin\)/gi, '').trim();
    return cleaned || 'N/A';
}

// Helper function to get department code from event extendedProps or classData
function getDepartmentCodeFromEvent(extendedProps) {
    const departmentId = extendedProps.departmentId || '';
    const departmentName = extendedProps.department || '';
    
    if (!departmentId && !departmentName) {
        return 'N/A';
    }
    
    // If departmentId exists, try to look up the code
    if (departmentId) {
        try {
            const departments = JSON.parse(localStorage.getItem('departments') || '[]');
            
            // Find the department by ID or code
            const department = departments.find(d => 
                d.id === departmentId || 
                d.code === departmentId ||
                String(d.id) === String(departmentId)
            );
            
            if (department && department.code) {
                return department.code;
            }
            
            // If departmentId is actually the code itself, return it
            return departmentId;
        } catch (e) {
            console.warn('Error getting department code from event:', e);
        }
    }
    
    // If no departmentId, try to extract code from department name (format: "CODE - Name")
    if (departmentName && departmentName.includes(' - ')) {
        return departmentName.split(' - ')[0];
    }
    
    // Fallback: return department name or N/A
    return departmentName || 'N/A';
}

// Function to load ALL faculty (not filtered by department) - for program-based selection
async function loadAllFaculty() {
    const facultySelect = document.getElementById('facultySelect');
    
    if (!facultySelect) {
        console.warn('facultySelect element not found');
        return;
    }
    
    // Reset faculty select - show loading state
    if (window.choicesInstances && window.choicesInstances['facultySelect']) {
        window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'Loading faculty...', disabled: true}], 'value', 'label', true);
    } else {
        facultySelect.innerHTML = '<option value="" selected disabled>Loading faculty...</option>';
    }
    facultySelect.disabled = true;
    
    try {
        let faculty = [];
        
        // Try to fetch ALL faculty from API (no department filter)
        try {
            const response = await fetchWithAuth(`/api/faculty`);
            if (response && response.ok) {
                faculty = await response.json();
                // Filter out superadmin account
                faculty = faculty.filter(f => 
                    f.email !== 'superadmin@school.edu' && 
                    f.role !== 'superadmin' && 
                    String(f.role || '').toLowerCase() !== 'superadmin'
                );
                console.log('Loaded all faculty from API:', faculty.length);
            }
        } catch (e) {
            console.warn('API call failed, using fallback:', e);
        }

        if (!Array.isArray(faculty) || faculty.length === 0) {
            // Build from localStorage - get ALL users with departmentId (faculty)
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const assignments = JSON.parse(localStorage.getItem('facultyAssignments') || '[]');
            
            const localFaculty = [];
            
            // From users - get all faculty (any department)
            users.filter(u => {
                // Exclude superadmin account
                if (u.email === 'superadmin@school.edu' || 
                    u.role === 'superadmin' || 
                    String(u.role || '').toLowerCase() === 'superadmin') {
                    return false;
                }
                // Check if user has a departmentId assigned (faculty assignment)
                return u.departmentId != null && u.departmentId !== '';
            }).forEach(u => {
                localFaculty.push({ 
                    id: u.id, 
                    name: formatFullName(u.firstName || '', u.middleName || '', u.lastName || '') || u.email || 'Faculty', 
                    email: u.email,
                    department: u.department || '',
                    departmentId: u.departmentId || ''
                });
            });
            
            // From assignments
            assignments.forEach(a => {
                localFaculty.push({ 
                    id: a.userId, 
                    name: formatFullName(a.firstName || '', a.middleName || '', a.lastName || '') || a.email || 'Faculty', 
                    email: a.email,
                    department: a.department || '',
                    departmentId: a.departmentId || ''
                });
            });
            
            // Deduplicate by id/email
            const seen = new Set();
            faculty = localFaculty.filter(f => {
                const key = String(f.id||'') + '|' + String((f.email||'').toLowerCase());
                if (seen.has(key)) return false; 
                seen.add(key); 
                return true;
            });
            
            console.log('Loaded all faculty from localStorage:', faculty.length);
        }

        // Filter out superadmin account before populating dropdown
        faculty = (faculty || []).filter(f => 
            f.email !== 'superadmin@school.edu' && 
            f.role !== 'superadmin' && 
            String(f.role || '').toLowerCase() !== 'superadmin'
        );
        
        // Prepare options for Choices.js (faculty name with department)
        const facultyOptions = faculty.map(f => {
            const facultyName = f.name || formatFullName(f.firstName || '', f.middleName || '', f.lastName || '') || f.email || 'Faculty';
            // Include department in display: "Name (Department)"
            const displayLabel = f.department 
                ? `${facultyName} (${f.department})`
                : facultyName;
            return {
                value: f.id,
                label: displayLabel,
                customProperties: {
                    email: f.email || '',
                    department: f.department || '',
                    departmentId: f.departmentId || ''
                }
            };
        });
        
        // Update Choices.js instance if available
        if (window.choicesInstances && window.choicesInstances['facultySelect']) {
            if (facultyOptions.length > 0) {
                // Add placeholder option first
                const optionsWithPlaceholder = [
                    {value: '', label: 'Select Faculty Member', disabled: true},
                    ...facultyOptions
                ];
                window.choicesInstances['facultySelect'].setChoices(optionsWithPlaceholder, 'value', 'label', true);
                // Enable both the underlying select and the Choices.js instance
                facultySelect.disabled = false;
                if (typeof window.choicesInstances['facultySelect'].enable === 'function') {
                    window.choicesInstances['facultySelect'].enable();
                }
                // Reset to placeholder after setting choices
                try {
                    window.choicesInstances['facultySelect'].setValue([]);
                    window.choicesInstances['facultySelect'].setChoiceByValue('');
                } catch (e) {
                    console.warn('Error resetting facultySelect to placeholder:', e);
                }
                console.log('Faculty dropdown enabled with', facultyOptions.length, 'faculty members');
            } else {
                window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'No faculty available', disabled: true}], 'value', 'label', true);
                facultySelect.disabled = true;
                if (typeof window.choicesInstances['facultySelect'].disable === 'function') {
                    window.choicesInstances['facultySelect'].disable();
                }
            }
        } else {
            // Fallback: populate normally if Choices not initialized
            facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty Member</option>';
            faculty.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                const facultyName = f.name || formatFullName(f.firstName || '', f.middleName || '', f.lastName || '') || f.email || 'Faculty';
                // Include department in display: "Name (Department)"
                const display = f.department 
                    ? `${facultyName} (${f.department})`
                    : facultyName;
                option.textContent = display;
                if (f.email) option.dataset.email = f.email;
                if (f.department) option.dataset.department = f.department;
                if (f.departmentId) option.dataset.departmentId = f.departmentId;
                facultySelect.appendChild(option);
            });
            
            if ((faculty||[]).length > 0) {
                facultySelect.disabled = false;
                // Reset to placeholder (first option)
                facultySelect.value = '';
                console.log('Faculty dropdown enabled (native) with', faculty.length, 'faculty members');
            } else {
                facultySelect.disabled = true;
                facultySelect.innerHTML = '<option value="" selected disabled>No faculty available</option>';
            }
        }
    } catch (error) {
        console.error('Error loading faculty:', error);
        if (window.choicesInstances && window.choicesInstances['facultySelect']) {
            window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'Error loading faculty', disabled: true}], 'value', 'label', true);
            facultySelect.disabled = true;
            if (typeof window.choicesInstances['facultySelect'].disable === 'function') {
                window.choicesInstances['facultySelect'].disable();
            }
        } else {
            facultySelect.innerHTML = '<option value="" selected disabled>Error loading faculty</option>';
            facultySelect.disabled = true;
        }
    }
}

// Function to load faculty by department (server first, fallback to localStorage users/facultyAssignments)
// Kept for backward compatibility but not used in main form flow
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
        
        // Prepare options for Choices.js (faculty name with department)
        const facultyOptions = faculty.map(f => {
            const facultyName = f.name || formatFullName(f.firstName || '', f.middleName || '', f.lastName || '') || f.email || 'Faculty';
            // Include department in display: "Name (Department)"
            const displayLabel = f.department 
                ? `${facultyName} (${f.department})`
                : facultyName;
            return {
                value: f.id,
                label: displayLabel,
                customProperties: {
                    email: f.email || '',
                    department: f.department || '',
                    departmentId: f.departmentId || ''
                }
            };
        });
        
        // Update Choices.js instance if available
        if (window.choicesInstances && window.choicesInstances['facultySelect']) {
            if (facultyOptions.length > 0) {
                window.choicesInstances['facultySelect'].setChoices(facultyOptions, 'value', 'label', true);
                facultySelect.disabled = false;
            } else {
                window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'No faculty available', disabled: true}], 'value', 'label', true);
                facultySelect.disabled = true;
            }
        } else {
            // Fallback: populate normally if Choices not initialized
            facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty</option>';
            faculty.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                const facultyName = f.name || formatFullName(f.firstName || '', f.middleName || '', f.lastName || '') || f.email || 'Faculty';
                // Include department in display: "Name (Department)"
                const display = f.department 
                    ? `${facultyName} (${f.department})`
                    : facultyName;
                option.textContent = display;
                if (f.email) option.dataset.email = f.email;
                if (f.department) option.dataset.department = f.department;
                if (f.departmentId) option.dataset.departmentId = f.departmentId;
                facultySelect.appendChild(option);
            });
            
            if ((faculty||[]).length > 0) {
                facultySelect.disabled = false;
            } else {
                facultySelect.disabled = true;
                facultySelect.innerHTML = '<option value="" selected disabled>No faculty available</option>';
            }
        }
    } catch (error) {
        console.error('Error loading faculty:', error);
        facultySelect.innerHTML = '<option value="" selected disabled>Error loading faculty</option>';
        facultySelect.disabled = true;
    }
}

// Function to load ALL subjects (no filtering by program/strand)
// This allows users to see and select any subject freely
async function loadSubjects(programId) {
    const subjectSelect = document.getElementById('subjectSelect');
    
    // Reset subject select
    subjectSelect.innerHTML = '<option value="" selected disabled>Loading subjects...</option>';
    subjectSelect.disabled = true;
    
    try {
        let subjects = [];
        let loadedFromApi = false;
        try {
            // Fetch ALL subjects from API (no programId filter)
            const response = await fetchWithAuth(`/api/subjects`);
            if (response && response.ok) {
                subjects = await response.json();
                console.log(`Loaded ${subjects.length} subjects from API`);
                loadedFromApi = true;
            }
        } catch (e) { 
            console.log('API call failed, using localStorage fallback:', e);
        }

        // If API didn't return subjects, try localStorage
        if (!Array.isArray(subjects) || !subjects.length) {
            // Fallback to localStorage
            subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            console.log(`Loaded ${subjects.length} subjects from localStorage`);
            loadedFromApi = false;
        }

        // Persist freshest subject data so other modules (e.g., unit validation) read correct units
        if (loadedFromApi && Array.isArray(subjects)) {
            try {
                localStorage.setItem('subjects', JSON.stringify(subjects));
                console.log('Subjects cached to localStorage for unit syncing');
            } catch (storageError) {
                console.warn('Unable to cache subjects in localStorage:', storageError);
            }
        }

        // Prepare options for Choices.js
        const subjectOptions = subjects.map(sub => ({
            value: sub.id || sub.code,
            label: `${sub.code || ''} ${sub.name ? '- ' + sub.name : ''}`.trim(),
            customProperties: {
                kind: 'subject'
            }
        }));
        
        // Update Choices.js instance if available
        if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
            if (subjectOptions.length > 0) {
                // Add placeholder option at the beginning
                const optionsWithPlaceholder = [
                    {value: '', label: 'Select Subject/Course', disabled: true},
                    ...subjectOptions
                ];
                window.choicesInstances['subjectSelect'].setChoices(optionsWithPlaceholder, 'value', 'label', true);
                // Enable both the underlying select and the Choices.js instance
                subjectSelect.disabled = false;
                if (typeof window.choicesInstances['subjectSelect'].enable === 'function') {
                    window.choicesInstances['subjectSelect'].enable();
                }
                // Reset to placeholder after setting choices
                try {
                    window.choicesInstances['subjectSelect'].setValue([]);
                    window.choicesInstances['subjectSelect'].setChoiceByValue('');
                } catch (e) {
                    console.warn('Error resetting subjectSelect to placeholder:', e);
                }
                console.log('Subject dropdown enabled with', subjectOptions.length, 'subjects');
            } else {
                window.choicesInstances['subjectSelect'].setChoices([{value: '', label: 'No subjects available', disabled: true}], 'value', 'label', true);
                subjectSelect.disabled = true;
                if (typeof window.choicesInstances['subjectSelect'].disable === 'function') {
                    window.choicesInstances['subjectSelect'].disable();
                }
            }
        } else {
            // Fallback: populate normally if Choices not initialized
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
            } else {
                // Reset to placeholder (first option)
                subjectSelect.value = '';
            }
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
            window.choicesInstances['subjectSelect'].setChoices([{value: '', label: 'Error loading subjects', disabled: true}], 'value', 'label', true);
            subjectSelect.disabled = true;
            if (typeof window.choicesInstances['subjectSelect'].disable === 'function') {
                window.choicesInstances['subjectSelect'].disable();
            }
        } else {
            subjectSelect.innerHTML = '<option value="" selected disabled>Error loading subjects</option>';
            subjectSelect.disabled = true;
        }
    }
}

// Function to load ALL programs/strands (for when Program/Strand is selected first)
async function loadAllPrograms() {
    const programSelect = document.getElementById('programSelect');
    
    if (!programSelect) {
        console.warn('programSelect element not found');
        return;
    }
    
    // Reset program select
    if (window.choicesInstances && window.choicesInstances['programSelect']) {
        window.choicesInstances['programSelect'].setChoices([{value: '', label: 'Loading programs/strands...', disabled: true}], 'value', 'label', true);
    } else {
        programSelect.innerHTML = '<option value="" selected disabled>Loading programs/strands...</option>';
    }
    programSelect.disabled = true;
    
    try {
        let courses = [];
        let strands = [];
        
        // Try to fetch all courses and strands from API
        try {
            const respCourses = await fetchWithAuth(`/api/courses`);
            if (respCourses && respCourses.ok) {
                courses = await respCourses.json();
                console.log('Loaded courses from API:', courses.length);
                // Store courses in localStorage and global for color lookup
                if (Array.isArray(courses) && courses.length > 0) {
                    localStorage.setItem('courses', JSON.stringify(courses));
                    window.courses = courses;
                }
            }
        } catch (e) { 
            console.log('API call for courses failed, using localStorage:', e);
        }
        
        try {
            const respStrands = await fetchWithAuth(`/api/strands`);
            if (respStrands && respStrands.ok) {
                strands = await respStrands.json();
                console.log('Loaded strands from API:', strands.length);
            }
        } catch (e) { 
            console.log('API call for strands failed, using localStorage:', e);
        }

        // Fallback to localStorage if API didn't return results
        if (!Array.isArray(courses) || !courses.length) {
            courses = JSON.parse(localStorage.getItem('courses') || '[]');
            console.log('Loaded courses from localStorage:', courses.length);
        }
        if (!Array.isArray(strands) || !strands.length) {
            strands = JSON.parse(localStorage.getItem('strands') || '[]');
            console.log('Loaded strands from localStorage:', strands.length);
        }

        // Prepare options for Choices.js
        const programOptions = [];
        
        (courses||[]).forEach(c => {
            programOptions.push({
                value: c.id || c.code,
                label: `${c.code || ''} ${c.name ? '- ' + c.name : ''}`.trim(),
                customProperties: {
                    kind: c.type || 'course',
                    departmentId: c.departmentId || ''
                }
            });
        });
        
        (strands||[]).forEach(s => {
            programOptions.push({
                value: s.id || s.code,
                label: `${s.code || ''} ${s.name ? '- ' + s.name : ''}`.trim(),
                customProperties: {
                    kind: s.type || 'strand',
                    departmentId: s.departmentId || ''
                }
            });
        });

        console.log('Total program options prepared:', programOptions.length);
        
        if (programOptions.length === 0) {
            console.warn('No programs/strands found');
            if (window.choicesInstances && window.choicesInstances['programSelect']) {
                window.choicesInstances['programSelect'].setChoices([{value: '', label: 'No programs/strands available', disabled: true}], 'value', 'label', true);
            } else {
                programSelect.innerHTML = '<option value="" selected disabled>No programs/strands available</option>';
            }
            programSelect.disabled = true;
        } else {
            // Update Choices.js instance if available
            if (window.choicesInstances && window.choicesInstances['programSelect']) {
                // Add placeholder option first
                const optionsWithPlaceholder = [
                    {value: '', label: 'Select Program/Strand', disabled: true},
                    ...programOptions
                ];
                window.choicesInstances['programSelect'].setChoices(optionsWithPlaceholder, 'value', 'label', true);
                programSelect.disabled = false;
                console.log('Programs loaded into Choices.js dropdown');
            } else {
                // Fallback: populate normally if Choices not initialized
                programSelect.innerHTML = '<option value="" selected disabled>Select Program/Strand</option>';
                programOptions.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    option.dataset.kind = opt.customProperties.kind;
                    option.dataset.departmentId = opt.customProperties.departmentId;
                    programSelect.appendChild(option);
                });
                programSelect.disabled = false;
                console.log('Programs loaded into native dropdown');
            }
        }
    } catch (error) {
        console.error('Error loading programs:', error);
        if (window.choicesInstances && window.choicesInstances['programSelect']) {
            window.choicesInstances['programSelect'].setChoices([{value: '', label: 'Error loading programs/strands', disabled: true}], 'value', 'label', true);
        } else {
            programSelect.innerHTML = '<option value="" selected disabled>Error loading programs/strands</option>';
        }
        programSelect.disabled = true;
    }
}

// Function to load programs/strands by department (courses + strands) - kept for backward compatibility
async function loadPrograms() {
    const programSelect = document.getElementById('programSelect');
    
    if (!programSelect) return;
    
    // Department is no longer required - just call loadAllPrograms instead
    // This function is kept for backward compatibility
    await loadAllPrograms();
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
            slotMaxTime: '21:15:00',
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
            // Add utilization percentage to day headers
            dayHeaderDidMount: function(info) {
                updateDayUtilization(info.el, info.date);
            },
            // Handle when events are dropped onto the calendar
            eventReceive: function(info) {
                // Ensure the course/department color is applied when event is dropped
                const event = info.event;
                const isMerged = event.extendedProps?.isMerged || false;
                
                // Get color - prioritize course color, then department color, then existing color
                let deptColor;
                if (isMerged) {
                    deptColor = '#000000';
                } else if (event.extendedProps?.departmentColor) {
                    deptColor = event.extendedProps.departmentColor;
                } else if (event.backgroundColor) {
                    deptColor = event.backgroundColor;
                } else {
                    // Use getDepartmentColorForClass if available (from main.js)
                    if (typeof window.getDepartmentColorForClass === 'function') {
                        deptColor = window.getDepartmentColorForClass({
                            course: event.extendedProps?.course || '',
                            courseId: event.extendedProps?.courseId || event.extendedProps?.programId,
                            department: event.extendedProps?.department || '',
                            departmentId: event.extendedProps?.departmentId
                        });
                    } else {
                        deptColor = '#6b7280'; // Default gray
                    }
                }
                
                console.log('Event received, applying color:', deptColor, isMerged ? '[MERGED]' : '');
                
                // Set the event color
                event.setProp('backgroundColor', deptColor);
                event.setProp('borderColor', deptColor);
                event.setProp('textColor', '#ffffff');
                
                // Update extendedProps to store the color for future reference
                if (!isMerged) {
                    event.setExtendedProp('departmentColor', deptColor);
                }
                
                // Add merged class if needed
                if (isMerged) {
                    event.setProp('classNames', [
                        ...(event.classNames || []),
                        'merged-class-event'
                    ]);
                }
                
                // Apply color to DOM element
                setTimeout(() => {
                    const eventEl = info.event.el;
                    if (eventEl) {
                        eventEl.style.backgroundColor = deptColor;
                        eventEl.style.borderColor = deptColor;
                        eventEl.style.color = '#ffffff';
                        eventEl.style.opacity = '1';
                        
                        const mainEl = eventEl.querySelector('.fc-event-main');
                        if (mainEl) {
                            mainEl.style.backgroundColor = deptColor;
                            mainEl.style.borderColor = deptColor;
                            mainEl.style.color = '#ffffff';
                        }
                        
                        // Ensure text is readable
                        const titleEl = eventEl.querySelector('.fc-event-title');
                        if (titleEl) {
                            titleEl.style.color = '#ffffff';
                            titleEl.style.fontWeight = '500';
                        }
                        
                        console.log('Applied color to dropped event:', deptColor, isMerged ? '[MERGED]' : '');
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
                
                // Update room utilization
                if (typeof window.updateAllDayUtilizations === 'function') {
                    setTimeout(() => window.updateAllDayUtilizations(), 100);
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
                            
                            // Show notification for successful update
                            if (typeof window.showNotification === 'function') {
                                const subjectName = event.extendedProps?.subject || event.title || 'Class';
                                const dayName = event.extendedProps?.dayOfWeek || 'Unknown';
                                const timeStr = event.start ? event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                                window.showNotification(`Class time updated successfully! ${subjectName} - ${dayName} at ${timeStr}`, 'success');
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
                
                // Update room utilization
                if (typeof window.updateAllDayUtilizations === 'function') {
                    setTimeout(() => window.updateAllDayUtilizations(), 100);
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
                            
                            // Show notification for successful update
                            if (typeof window.showNotification === 'function') {
                                const subjectName = event.extendedProps?.subject || event.title || 'Class';
                                const duration = event.end ? ((event.end - event.start) / (1000 * 60 * 60)).toFixed(1) : 'N/A';
                                window.showNotification(`Class time updated successfully! ${subjectName} - Duration: ${duration} hours`, 'success');
                            }
                            
                            // Clear flags after a delay
                            setTimeout(() => {
                                if (window.isCurrentlySaving !== undefined) {
                                    window.isCurrentlySaving = false;
                                }
                                window.isResizingEvent = false;
                            }, 1500);
                            
                            // Update room utilization
                            if (typeof window.updateAllDayUtilizations === 'function') {
                                setTimeout(() => window.updateAllDayUtilizations(), 100);
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
            // Display order: 1. Subject name as title, 2. Type, 3. Course/strand, 4. Room, 5. Faculty, 6. Time
            eventContent: function(arg) {
                const event = arg.event;
                const extendedProps = event.extendedProps || {};
                
                // Extract event details
                const subject = extendedProps.subject || event.title || '';
                const classType = extendedProps.classType || '';
                const course = extendedProps.course || extendedProps.department || '';
                const room = extendedProps.room || '';
                const teacher = extendedProps.faculty || '';
                
                // Check if this is a merged class
                const isMerged = extendedProps.isMerged || false;
                const mergedClassIds = extendedProps.mergedClassIds || [];
                
                // Get merged strands information (codes only)
                let mergedStrandsInfo = '';
                if (isMerged && mergedClassIds.length > 0) {
                    // Try to get merged strands from window.allClasses if available
                    if (window.allClasses && Array.isArray(window.allClasses)) {
                        const mergedClasses = window.allClasses.filter(c => c && mergedClassIds.includes(c.id));
                        // Get codes for merged classes
                        const mergedStrandCodes = mergedClasses.map(c => {
                            const code = getCourseCodeFromEvent({
                                courseId: c.courseId,
                                course: c.course,
                                department: c.department
                            });
                            return code;
                        }).filter(Boolean);
                        
                        if (mergedStrandCodes.length > 0) {
                            // Include the current class's strand/course code in the list
                            const currentStrandCode = getCourseCodeFromEvent(extendedProps);
                            const allStrandCodes = [currentStrandCode, ...mergedStrandCodes].filter(Boolean);
                            const uniqueStrandCodes = [...new Set(allStrandCodes)];
                            mergedStrandsInfo = uniqueStrandCodes.join(', ');
                        }
                    }
                    
                    // Fallback: extract from event title if available
                    if (!mergedStrandsInfo && event.title) {
                        const mergedMatch = event.title.match(/\[MERGED:\s*(.+?)\]/i);
                        if (mergedMatch && mergedMatch[1]) {
                            mergedStrandsInfo = mergedMatch[1].trim();
                        }
                    }
                }
                
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
                content.style.cssText = 'padding: 4px 6px; font-size: 11px; line-height: 1.3; overflow: hidden; word-wrap: break-word; word-break: break-word; white-space: normal; max-height: 100%;';
                
                // Clean subject title (remove [MERGED: ...] if present, we'll show it separately)
                let cleanSubject = subject.replace(/\s*\[MERGED:.*?\]/gi, '').trim();
                
                // Truncate long subject names to prevent overflow
                const maxSubjectLength = 30;
                const displaySubject = cleanSubject.length > maxSubjectLength 
                    ? cleanSubject.substring(0, maxSubjectLength) + '...' 
                    : cleanSubject;
                
                // Build HTML in the requested order:
                // 1. Subject name as title
                let html = `<div style="font-weight: 600; margin-bottom: 2px; word-wrap: break-word; overflow-wrap: break-word;">${displaySubject}</div>`;
                
                // Show merged strands prominently if merged
                if (mergedStrandsInfo) {
                    html += `<div style="font-size: 9px; font-weight: 600; color: #ffffff; background-color: rgba(255, 255, 255, 0.25); padding: 2px 4px; border-radius: 3px; margin-bottom: 3px; display: inline-block; word-wrap: break-word; max-width: 100%;"><i class="fas fa-link" style="margin-right: 3px; font-size: 0.8em;"></i>Merged: ${mergedStrandsInfo}</div>`;
                }
                
                // 2. Type (lecture or laboratory)
                if (classType) {
                    const typeDisplay = classType.charAt(0).toUpperCase() + classType.slice(1);
                    html += `<div style="font-size: 10px; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word;"><i class="fas fa-graduation-cap" style="margin-right: 4px;"></i>${typeDisplay}</div>`;
                }
                
                // 3. Course/strand (code only, not name)
                const displayCourse = mergedStrandsInfo || getCourseCodeFromEvent(extendedProps);
                if (displayCourse && displayCourse !== 'N/A') {
                    html += `<div style="font-size: 10px; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word;"><i class="fas fa-building" style="margin-right: 4px;"></i>${displayCourse}</div>`;
                }
                
                // 4. Room
                if (room) {
                    html += `<div style="font-size: 10px; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word;"><i class="fas fa-door-open" style="margin-right: 4px;"></i>${room}</div>`;
                }
                
                // 5. Faculty (clean name - remove department if present)
                if (teacher) {
                    const cleanTeacher = cleanFacultyName(teacher);
                    html += `<div style="font-size: 10px; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word;"><i class="fas fa-chalkboard-teacher" style="margin-right: 4px;"></i>${cleanTeacher}</div>`;
                }
                
                // 6. Time
                if (timeStr) {
                    html += `<div style="font-size: 10px; opacity: 0.9; word-wrap: break-word; overflow-wrap: break-word;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${timeStr}</div>`;
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
                const loadResult = window.loadScheduleFromLocalStorage();
                // Handle both promise and non-promise returns
                if (loadResult && typeof loadResult.then === 'function') {
                    loadResult.then(() => {
                        // Update room utilization after schedule loads
                        if (typeof window.updateAllDayUtilizations === 'function') {
                            setTimeout(() => window.updateAllDayUtilizations(), 500);
                        }
                    }).catch(() => {
                        // Still update even if load fails
                        if (typeof window.updateAllDayUtilizations === 'function') {
                            setTimeout(() => window.updateAllDayUtilizations(), 500);
                        }
                    });
                } else {
                    // Not a promise, just update after a delay
                    setTimeout(() => {
                        if (typeof window.updateAllDayUtilizations === 'function') {
                            window.updateAllDayUtilizations();
                        }
                    }, 1000);
                }
            }
            
            // Fixed schedules will be loaded by loadScheduleFromLocalStorage, no need to load here
            // This prevents duplicate loading and blinking
        }, 500);
        
        // Make variable accessible globally for eventDrop handler
        window.isCurrentlySaving = false;
    } else {
        console.error('FullCalendar library not loaded or calendar element not found');
    }
    
    // ========== ROOM UTILIZATION CALCULATION ==========
    /**
     * Calculate room utilization for a specific day
     * @param {Date} date - The date to calculate utilization for
     * @returns {number} - Utilization percentage (0-100)
     */
    function calculateDayUtilization(date) {
        const calendar = window.calendar;
        if (!calendar) return 100;
        
        // Time range: 7 AM to 9 PM (21:00)
        const startHour = 7;
        const endHour = 21;
        const slotDurationMinutes = 15; // 15-minute blocks
        
        // Calculate total time slots
        const totalHours = endHour - startHour; // 14 hours
        const totalSlots = (totalHours * 60) / slotDurationMinutes; // 56 slots
        const percentagePerSlot = 100 / totalSlots; // ~1.785% per slot
        
        // Get all events for this day
        const dayStart = new Date(date);
        dayStart.setHours(startHour, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(endHour, 0, 0, 0);
        
        // Get all events that overlap with this day
        const allEvents = calendar.getEvents();
        const dayEvents = allEvents.filter(event => {
            // Skip fixed schedules - only count actual classes
            if (event.extendedProps?.isFixedSchedule) return false;
            
            const eventStart = event.start;
            const eventEnd = event.end;
            
            if (!eventStart || !eventEnd) return false;
            
            // Check if event overlaps with the day (7 AM to 9 PM)
            return eventStart < dayEnd && eventEnd > dayStart;
        });
        
        // If no classes exist for this day, return 100% (no subtraction)
        if (dayEvents.length === 0) {
            return 100;
        }
        
        // Find the earliest class start time and latest class end time
        let earliestStart = null;
        let latestEnd = null;
        
        dayEvents.forEach(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            if (!earliestStart || eventStart < earliestStart) {
                earliestStart = eventStart;
            }
            if (!latestEnd || eventEnd > latestEnd) {
                latestEnd = eventEnd;
            }
        });
        
        // Convert to minutes from 7 AM
        const earliestStartMinutes = (earliestStart.getHours() - startHour) * 60 + earliestStart.getMinutes();
        const latestEndMinutes = (latestEnd.getHours() - startHour) * 60 + latestEnd.getMinutes();
        
        // Clamp to valid range (7 AM - 9 PM)
        const firstClassSlot = Math.max(0, Math.floor(earliestStartMinutes / slotDurationMinutes));
        const lastClassSlot = Math.min(totalSlots - 1, Math.floor((latestEndMinutes - 1) / slotDurationMinutes));
        
        // Create a set of occupied time slots (only between first and last class)
        const occupiedSlots = new Set();
        
        dayEvents.forEach(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            
            // Clamp event times to 7 AM - 9 PM range
            const slotStart = Math.max(
                (eventStart.getHours() - startHour) * 60 + eventStart.getMinutes(),
                0
            );
            const slotEnd = Math.min(
                (eventEnd.getHours() - startHour) * 60 + eventEnd.getMinutes(),
                totalHours * 60
            );
            
            // Mark all 15-minute slots covered by this event as occupied
            for (let minutes = slotStart; minutes < slotEnd; minutes += slotDurationMinutes) {
                const slotIndex = Math.floor(minutes / slotDurationMinutes);
                if (slotIndex >= 0 && slotIndex < totalSlots) {
                    occupiedSlots.add(slotIndex);
                }
            }
        });
        
        // Calculate utilization: Start at 100%, subtract for:
        // 1. Empty slots from 7 AM until the first class starts
        // 2. Empty slots between classes (gaps)
        // Don't subtract for time after the last class ends
        
        // Count empty slots from 7 AM (slot 0) until first class starts
        const emptySlotsBeforeFirstClass = firstClassSlot;
        
        // Count empty slots between first and last class
        const totalSlotsBetweenClasses = lastClassSlot - firstClassSlot + 1;
        const occupiedSlotsBetweenClasses = Array.from(occupiedSlots).filter(slot => 
            slot >= firstClassSlot && slot <= lastClassSlot
        ).length;
        const emptySlotsBetweenClasses = totalSlotsBetweenClasses - occupiedSlotsBetweenClasses;
        
        // Total empty slots to subtract: before first class + gaps between classes
        const totalEmptySlots = emptySlotsBeforeFirstClass + emptySlotsBetweenClasses;
        
        // Subtract for empty slots before first class and gaps between classes
        const utilization = 100 - (totalEmptySlots * percentagePerSlot);
        
        // Ensure utilization doesn't go below 0
        return Math.max(0, Math.round(utilization * 100) / 100); // Round to 2 decimal places
    }
    
    /**
     * Update the utilization percentage display for a day header
     * @param {HTMLElement} headerEl - The day header element
     * @param {Date} date - The date for this day
     */
    function updateDayUtilization(headerEl, date) {
        if (!headerEl || !date) return;
        
        const utilization = calculateDayUtilization(date);
        
        // Remove existing utilization display if any
        const existingUtil = headerEl.querySelector('.day-utilization');
        if (existingUtil) {
            existingUtil.remove();
        }
        
        // Create utilization display element
        const utilEl = document.createElement('div');
        utilEl.className = 'day-utilization';
        utilEl.style.cssText = `
            font-size: 0.75rem;
            font-weight: 600;
            color: ${utilization >= 80 ? '#059669' : utilization >= 50 ? '#f59e0b' : '#ef4444'};
            margin-top: 2px;
            opacity: 0.9;
        `;
        utilEl.textContent = `${utilization}%`;
        
        // Append to header
        headerEl.appendChild(utilEl);
    }
    
    /**
     * Update utilization for all visible day headers
     */
    function updateAllDayUtilizations() {
        const calendar = window.calendar;
        if (!calendar) return;
        
        // Get the current view's date range
        const view = calendar.view;
        if (!view) return;
        
        // Get all day headers
        const dayHeaders = document.querySelectorAll('.fc-col-header-cell');
        dayHeaders.forEach(header => {
            // Get the date from the header's data attribute or text
            const headerText = header.textContent.trim();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayIndex = dayNames.findIndex(day => headerText.includes(day));
            
            if (dayIndex !== -1) {
                // Get the date for this day of the week in the current view
                const viewStart = view.activeStart;
                const currentDay = viewStart.getDay();
                const daysToAdd = (dayIndex - currentDay + 7) % 7;
                const targetDate = new Date(viewStart);
                targetDate.setDate(viewStart.getDate() + daysToAdd);
                
                updateDayUtilization(header, targetDate);
            }
        });
    }
    
    // Make updateAllDayUtilizations globally accessible
    window.updateAllDayUtilizations = updateAllDayUtilizations;
    
    // Update utilization when events change
    if (window.calendar) {
        // Update after calendar renders
        setTimeout(() => {
            updateAllDayUtilizations();
        }, 1000);
        
        // Update when events are added, removed, or modified
        const originalAddEvent = window.calendar.addEvent.bind(window.calendar);
        window.calendar.addEvent = function(...args) {
            const result = originalAddEvent(...args);
            setTimeout(() => updateAllDayUtilizations(), 100);
            return result;
        };
        
        const originalRemoveEvent = window.calendar.getEventById ? 
            (function() {
                const original = window.calendar.getEventById.bind(window.calendar);
                return function(id) {
                    const event = original(id);
                    if (event && event.remove) {
                        const originalRemove = event.remove.bind(event);
                        event.remove = function() {
                            const result = originalRemove();
                            setTimeout(() => updateAllDayUtilizations(), 100);
                            return result;
                        };
                    }
                    return event;
                };
            })() : null;
    }
    
    // Update user info
    updateUserInfo();
    
    // Ensure faculty dropdown starts disabled (will be enabled when program is selected)
    const facultySelect = document.getElementById('facultySelect');
    if (facultySelect) {
        facultySelect.disabled = true;
        if (window.choicesInstances && window.choicesInstances['facultySelect']) {
            window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'Select Program/Strand First', disabled: true}], 'value', 'label', true);
        } else {
            facultySelect.innerHTML = '<option value="" selected disabled>Select Program/Strand First</option>';
        }
    }
    
    // Store Choices.js instances for dynamic updates
    window.choicesInstances = {};
    
    // Initialize Choices.js for searchable dropdowns
    function initSearchableSelect(selectId, options = {}) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return null;
        
        // Destroy existing instance if any
        if (window.choicesInstances[selectId]) {
            window.choicesInstances[selectId].destroy();
        }
        
        // Default options for Choices.js
        const defaultOptions = {
            searchEnabled: true,
            searchChoices: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: selectElement.options[0]?.text || 'Select...',
            searchPlaceholderValue: 'Type to search...',
            shouldSort: true,
            ...options
        };
        
        // Create new Choices instance
        const choices = new Choices(selectElement, defaultOptions);
        window.choicesInstances[selectId] = choices;
        
        return choices;
    }
    
    // Update Choices.js instance when options change
    function updateSearchableSelect(selectId, newOptions = []) {
        const choices = window.choicesInstances[selectId];
        if (!choices) {
            // Initialize if not already initialized
            return initSearchableSelect(selectId);
        }
        
        // Clear existing choices
        choices.clearChoices();
        
        // Add new options
        if (newOptions.length > 0) {
            choices.setChoices(newOptions, 'value', 'label', true);
        }
        
        return choices;
    }
    
    // Initialize all searchable selects after page loads, then load programs
    setTimeout(() => {
        initSearchableSelect('programSelect', {
            placeholderValue: 'Select Program/Strand'
        });
        initSearchableSelect('facultySelect', {
            placeholderValue: 'Select Faculty Member'
        });
        initSearchableSelect('subjectSelect', {
            placeholderValue: 'Select Subject/Course'
        });
        
        // Load ALL programs/strands after Choices.js is initialized (Program/Strand is now first in the form)
        loadAllPrograms();
        
        // Subject select should be disabled initially until program is selected
        const subjectSelect = document.getElementById('subjectSelect');
        if (subjectSelect) {
            if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
                window.choicesInstances['subjectSelect'].setChoices(
                    [{value: '', label: 'Select Program/Strand First', disabled: true}], 
                    'value', 
                    'label', 
                    true
                );
                if (typeof window.choicesInstances['subjectSelect'].disable === 'function') {
                    window.choicesInstances['subjectSelect'].disable();
                }
            } else {
                subjectSelect.innerHTML = '<option value="" selected disabled>Select Program/Strand First</option>';
            }
            subjectSelect.disabled = true;
        }
    }, 100);
    
    // Load departments when the page loads
    loadDepartments();
    
    // Get form elements
    const deptSel = document.getElementById('departmentSelect');
    const facSel = document.getElementById('facultySelect');
    const subjSel = document.getElementById('subjectSelect');
    const progSel = document.getElementById('programSelect');
    
    // Handle program/strand change (FIRST in the form flow)
    // Note: With Choices.js, we need to listen to the actual select element, not the Choices wrapper
    if (progSel) {
        // Listen to both native change and Choices.js change events
        progSel.addEventListener('change', function() {
            const programId = this.value;
            // Get departmentId from Choices.js custom properties or dataset
            let programDeptId = '';
            if (window.choicesInstances && window.choicesInstances['programSelect']) {
                try {
                    const selectedValue = window.choicesInstances['programSelect'].getValue(true);
                    const valueToFind = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
                    if (valueToFind) {
                        // Safely access store.choices - check if store exists first
                        const choicesInstance = window.choicesInstances['programSelect'];
                        if (choicesInstance.store && choicesInstance.store.choices) {
                            const choice = choicesInstance.store.choices.find(c => c.value === valueToFind);
                            programDeptId = choice?.customProperties?.departmentId || '';
                        }
                    }
                } catch (e) {
                    console.warn('Error accessing Choices.js store:', e);
                }
            }
            // Fallback to dataset if not found in Choices
            if (!programDeptId) {
                const selectedOption = this.options[this.selectedIndex];
                programDeptId = selectedOption?.dataset?.departmentId || '';
            }
            
            if (programId) {
                // Load ALL faculty (not filtered by department) when program is selected
                // This enables the faculty dropdown immediately after program selection
                loadAllFaculty().then(() => {
                    console.log('Faculty loaded after program selection');
                }).catch(err => {
                    console.error('Error loading faculty:', err);
                });
                
                // Load ALL subjects (no filtering by program) and enable subject select
                loadSubjects(programId).then(() => {
                    // Enable subject select after loading
                    if (subjSel) {
                        subjSel.disabled = false;
                        if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
                            if (typeof window.choicesInstances['subjectSelect'].enable === 'function') {
                                window.choicesInstances['subjectSelect'].enable();
                            }
                        }
                    }
                });
            } else {
                // No program selected - disable and reset subject dropdown
                if (subjSel) {
                    if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
                        window.choicesInstances['subjectSelect'].setChoices(
                            [{value: '', label: 'Select Program/Strand First', disabled: true}], 
                            'value', 
                            'label', 
                            true
                        );
                        if (typeof window.choicesInstances['subjectSelect'].disable === 'function') {
                            window.choicesInstances['subjectSelect'].disable();
                        }
                    } else {
                        subjSel.innerHTML = '<option value="" selected disabled>Select Program/Strand First</option>';
                    }
                    subjSel.disabled = true;
                }
                
                // Reset faculty dropdown (still requires program selection)
                if (facSel) {
                    if (window.choicesInstances && window.choicesInstances['facultySelect']) {
                        window.choicesInstances['facultySelect'].setChoices([{value: '', label: 'Select Program/Strand First', disabled: true}], 'value', 'label', true);
                    } else {
                        facSel.innerHTML = '<option value="" selected disabled>Select Program/Strand First</option>';
                    }
                    facSel.disabled = true;
                }
            }
        });
    }
    
    // Department is no longer used - removed dependency
    
    // Handle faculty change: hide subject details and ensure subject dropdown is enabled
    if (facSel) {
        facSel.addEventListener('change', function() {
            // Hide subject details when faculty changes
            const subjectDetails = document.getElementById('subjectDetails');
            if (subjectDetails) {
                subjectDetails.style.display = 'none';
            }
            
            // Ensure subject dropdown is enabled (subjects are independent of program)
            const subjectSelect = document.getElementById('subjectSelect');
            if (subjectSelect) {
                // If subjects were already loaded, make sure dropdown is enabled
                if (subjectSelect.options.length > 1) {
                    subjectSelect.disabled = false;
                    if (window.choicesInstances && window.choicesInstances['subjectSelect']) {
                        if (typeof window.choicesInstances['subjectSelect'].enable === 'function') {
                            window.choicesInstances['subjectSelect'].enable();
                        }
                    }
                } else {
                    // Load subjects if not already loaded
                    loadSubjects();
                }
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
        
        // Populate modal with event details in the requested order:
        // 1. Subject name as title
        // 2. Type (lecture or laboratory)
        // 3. Course/strand
        // 4. Room
        // 5. Faculty
        // 6. Time
        
        // Subject as title (in the modal body, not header)
        const eventDetailSubject = document.getElementById('eventDetailSubject');
        if (eventDetailSubject) {
            eventDetailSubject.textContent = eventData.subject || 'N/A';
        }
        
        // Type (Lecture or Laboratory)
        const classType = eventData.classType || '';
        const typeDisplay = classType ? (classType.charAt(0).toUpperCase() + classType.slice(1)) : 'N/A';
        const eventDetailType = document.getElementById('eventDetailType');
        if (eventDetailType) {
            eventDetailType.textContent = typeDisplay;
        }
        
        // Course/Strand - get from event if available
        const eventDetailCourse = document.getElementById('eventDetailCourse');
        if (eventDetailCourse) {
            // Try course first, then department
            let course = eventData.course || '';
            if (!course && eventData.eventId) {
                // Try to get from the actual event
                const calendar = window.calendar;
                if (calendar) {
                    const event = calendar.getEventById(eventData.eventId);
                    if (event && event.extendedProps) {
                        course = event.extendedProps.course || event.extendedProps.department || '';
                    }
                }
            }
            // Fallback to department if course not found
            if (!course) {
                course = eventData.department || 'N/A';
            }
            eventDetailCourse.textContent = course;
        }
        
        // Room
        const eventDetailRoom = document.getElementById('eventDetailRoom');
        if (eventDetailRoom) {
            eventDetailRoom.textContent = eventData.currentRoom || 'N/A';
        }
        
        // Faculty
        const eventDetailTeacher = document.getElementById('eventDetailTeacher');
        if (eventDetailTeacher) {
            eventDetailTeacher.textContent = eventData.teacher || 'Not assigned';
        }
        
        // Time
        const eventDetailTime = document.getElementById('eventDetailTime');
        if (eventDetailTime) {
            eventDetailTime.textContent = eventData.time || 'N/A';
        }
        
        // Update faculty label to show current faculty
        const facultyLabel = document.querySelector('label[for="eventFacultySelect"]');
        if (facultyLabel) {
            const currentTeacher = eventData.teacher || 'Not assigned';
            facultyLabel.innerHTML = `<i class="fas fa-user-check"></i> Assign Faculty Member (Current: ${currentTeacher}):`;
        }
        
        // Load faculty for the dropdown (only if user can edit)
        const facultySelectContainer = document.getElementById('eventFacultySelect')?.parentElement;
        const facultySelect = document.getElementById('eventFacultySelect');
        const saveFacultyBtn = document.getElementById('saveFacultyBtn');
        
        // Load rooms for the dropdown (only if user can edit)
        const roomSelectContainer = document.getElementById('eventRoomSelect')?.parentElement;
        const roomSelect = document.getElementById('eventRoomSelect');
        const saveRoomBtn = document.getElementById('saveRoomBtn');
        const swapRoomsBtn = document.getElementById('swapRoomsBtn');
        const deleteEventBtn = document.getElementById('deleteEventBtn');
        
        // Load faculty members for assignment (mirror faculty tab list, include pending users)
        if (allowEdit && facultySelect) {
            facultySelect.innerHTML = '<option value="">Loading faculty...</option>';
            facultySelect.disabled = true;
            
            try {
                // Load ALL faculty from API (no department filter) - same as faculty tab
                const response = await fetchWithAuth(`/api/faculty`);
                if (response && response.ok) {
                    const faculty = await response.json();
                    
                    // Allow both verified and pending users while still hiding the superadmin account
                    let availableFaculty = Array.isArray(faculty) ? faculty.filter(f => 
                        f &&
                        f.email !== 'superadmin@school.edu' &&
                        f.role !== 'superadmin' &&
                        String(f.role || '').toLowerCase() !== 'superadmin'
                    ) : [];

                    facultySelect.innerHTML = '<option value="">Select a faculty member...</option>';
                    
                    if (availableFaculty.length > 0) {
                        // Get current faculty ID for selection
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
                        
                        availableFaculty.forEach(member => {
                            const option = document.createElement('option');
                            const optionValue = member.id || member.userId || member._id || member.email;
                            if (!optionValue) {
                                return;
                            }
                            option.value = optionValue;
                            const name = formatFullName(member.firstName || '', member.middleName || '', member.lastName || '') || member.email || 'Faculty';
                            // Display faculty name only (no department)
                            option.textContent = name;
                            
                            // Mark current faculty as selected
                            if (optionValue === currentFacultyId) {
                                option.selected = true;
                            }
                            
                            facultySelect.appendChild(option);
                        });
                    } else {
                        facultySelect.innerHTML = '<option value="">No faculty records available</option>';
                    }
                    
                    facultySelect.disabled = false;
                } else {
                    // Handle case where response is null or not ok
                    console.warn('Failed to load faculty. Response:', response);
                    if (facultySelect) {
                        facultySelect.innerHTML = '<option value="">Error loading faculty</option>';
                        facultySelect.disabled = false;
                    }
                }
            } catch (error) {
                console.error('Error loading faculty:', error);
                if (facultySelect) {
                    facultySelect.innerHTML = '<option value="">Error loading faculty</option>';
                    facultySelect.disabled = false;
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
        
        // Show/hide swap rooms button based on edit permissions
        if (swapRoomsBtn) {
            swapRoomsBtn.style.display = allowEdit ? '' : 'none';
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
                    
                    // Get faculty member details - fetch all faculty (no department filter needed)
                    // This matches how the dropdown is populated
                    const response = await fetchWithAuth(`/api/faculty`);
                    if (response && response.ok) {
                        const faculty = await response.json();
                        // Find the selected faculty by ID, userId, _id, or email (matching the dropdown logic)
                        const selectedFaculty = faculty.find(f => 
                            f && (
                                f.id === selectedFacultyId || 
                                f.userId === selectedFacultyId || 
                                f._id === selectedFacultyId || 
                                f.email === selectedFacultyId
                            )
                        );
                        
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
                            
                            // Update the faculty label to show the new faculty
                            const facultyLabel = document.querySelector('label[for="eventFacultySelect"]');
                            if (facultyLabel) {
                                facultyLabel.innerHTML = `<i class="fas fa-user-check"></i> Assign Faculty Member (Current: ${facultyName}):`;
                            }
                            
                            // Save to server
                            if (typeof window.saveScheduleToLocalStorage === 'function') {
                                await window.saveScheduleToLocalStorage();
                            }
                            
                            if (typeof showNotification === 'function') {
                                showNotification('Faculty assigned successfully!', 'success');
                            }
                        } else {
                            if (typeof showNotification === 'function') {
                                showNotification('Selected faculty member not found', 'error');
                            }
                        }
                    } else {
                        if (typeof showNotification === 'function') {
                            showNotification('Failed to load faculty information', 'error');
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
        modal.scrollTop = 0;
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
        
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
        
        // Check for required filter elements (filterDepartment is optional)
        if (!filterFaculty || !filterRoom || !filterCourse) {
            console.warn('Filter elements not found - some filters may not be available');
            // Don't return early, continue with available filters
            if (!filterFaculty && !filterRoom && !filterCourse) {
                return; // Only return if none of the main filters exist
            }
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
            
            // Populate department filter (if it exists)
            if (filterDepartment) {
                const deptOptions = filterDepartment.querySelectorAll('option:not(:first-child)');
                deptOptions.forEach(opt => opt.remove());
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept;
                    option.textContent = dept;
                    filterDepartment.appendChild(option);
                });
            }
            
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
            
            const selectedDept = filterDepartment ? filterDepartment.value : '';
            const selectedFaculty = filterFaculty ? filterFaculty.value : '';
            const selectedRoom = filterRoom ? filterRoom.value : '';
            const selectedCourse = filterCourse ? filterCourse.value : '';
            
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
            if (filterDepartment) filterDepartment.value = '';
            if (filterFaculty) filterFaculty.value = '';
            if (filterRoom) filterRoom.value = '';
            if (filterCourse) filterCourse.value = '';
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
            ].filter(f => f.element !== null); // Only include existing filters
            
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
        if (filterDepartment) {
            filterDepartment.addEventListener('change', () => {
                updateFilterVisuals();
                applyFilters();
            });
        }
        if (filterFaculty) {
            filterFaculty.addEventListener('change', () => {
                updateFilterVisuals();
                applyFilters();
            });
        }
        if (filterRoom) {
            filterRoom.addEventListener('change', () => {
                updateFilterVisuals();
                applyFilters();
            });
        }
        if (filterCourse) {
            filterCourse.addEventListener('change', () => {
                updateFilterVisuals();
                applyFilters();
            });
        }
        
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
                throw new Error(error.error || error.message || 'Failed to assign schedules');
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
            
            // Filter out fixed schedules (they don't require faculty members)
            const nonFixedSchedules = unassignedSchedules.filter(schedule => {
                const extendedProps = schedule.extendedProps || {};
                return !extendedProps.isFixedSchedule;
            });
            
            // Update badge with filtered count
            if (unassignedCountBadge) {
                unassignedCountBadge.textContent = nonFixedSchedules.length;
            }
            
            // Store all unassigned schedules for filtering (excluding fixed schedules)
            allUnassignedSchedules = nonFixedSchedules;
            
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
            displayUnassignedSchedules(nonFixedSchedules, searchTerm);
            
        } catch (error) {
            console.error('Error loading unassigned schedules:', error);
            unassignedPanel.style.display = 'none';
        }
    }
    
    /**
     * Display unassigned schedules with optional search filter
     */
    function displayUnassignedSchedules(schedules, searchTerm = '') {
        // First, filter out fixed schedules (they don't require faculty members)
        const nonFixedSchedules = schedules.filter(schedule => {
            const extendedProps = schedule.extendedProps || {};
            return !extendedProps.isFixedSchedule;
        });
        
        // Then filter schedules based on search term
        const filteredSchedules = searchTerm.trim() 
            ? nonFixedSchedules.filter(schedule => {
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
            : nonFixedSchedules;
        
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
                // Display faculty name only (no department)
                option.textContent = name;
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
    
    // ========== SWAP ROOMS FUNCTIONALITY ==========
    
    // Function to find events at the same time slot
    function findEventsAtSameTime(currentEvent) {
        const calendar = window.calendar;
        if (!calendar || !currentEvent) {
            console.log('[Swap Rooms] Calendar or event not available');
            return [];
        }
        
        const allEvents = calendar.getEvents();
        const sameTimeEvents = [];
        
        // Get current event's time information
        const currentStart = currentEvent.start;
        const currentEnd = currentEvent.end;
        const currentEventId = currentEvent.id;
        
        if (!currentStart || !currentEnd) {
            console.log('[Swap Rooms] Current event missing start/end times');
            return [];
        }
        
        // Convert to time strings for comparison (HH:MM format)
        // Handle both Date objects and date strings
        const getTimeString = (date) => {
            if (!date) return null;
            try {
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return null;
                const hours = d.getHours().toString().padStart(2, '0');
                const minutes = d.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            } catch (e) {
                console.warn('[Swap Rooms] Error parsing date:', date, e);
                return null;
            }
        };
        
        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const getDayOfWeek = (date) => {
            if (!date) return null;
            try {
                const d = date instanceof Date ? date : new Date(date);
                if (isNaN(d.getTime())) return null;
                return d.getDay();
            } catch (e) {
                console.warn('[Swap Rooms] Error getting day of week:', date, e);
                return null;
            }
        };
        
        const currentStartTime = getTimeString(currentStart);
        const currentEndTime = getTimeString(currentEnd);
        const currentDay = getDayOfWeek(currentStart);
        
        if (!currentStartTime || !currentEndTime || currentDay === null) {
            console.log('[Swap Rooms] Invalid current event times:', {
                currentStartTime,
                currentEndTime,
                currentDay
            });
            return [];
        }
        
        console.log('[Swap Rooms] Looking for events matching:');
        console.log('  Current Event ID:', currentEventId);
        console.log('  Current Day:', currentDay, '(' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay] + ')');
        console.log('  Current Start Time:', currentStartTime);
        console.log('  Current End Time:', currentEndTime);
        console.log('  Current Start Date:', currentStart);
        console.log('  Current End Date:', currentEnd);
        console.log('  Total Events:', allEvents.length);
        
        // Find events at the same time slot (same day of week, same start and end time)
        let checkedCount = 0;
        let skippedCount = 0;
        allEvents.forEach(event => {
            // Skip the current event and fixed schedules
            if (event.id === currentEventId) {
                skippedCount++;
                return;
            }
            if (event.extendedProps?.isFixedSchedule) {
                skippedCount++;
                return;
            }
            
            if (event.start && event.end) {
                checkedCount++;
                const eventStartTime = getTimeString(event.start);
                const eventEndTime = getTimeString(event.end);
                const eventDay = getDayOfWeek(event.start);
                
                // Skip if we couldn't parse the event times
                if (!eventStartTime || !eventEndTime || eventDay === null) {
                    console.log('[Swap Rooms] Skipping event - invalid times:', {
                        id: event.id,
                        subject: event.extendedProps?.subject || event.title,
                        start: event.start,
                        end: event.end
                    });
                    return;
                }
                
                // Log all events being checked for debugging
                const dayMatch = eventDay === currentDay;
                const startTimeMatch = eventStartTime === currentStartTime;
                const endTimeMatch = eventEndTime === currentEndTime;
                const allMatch = dayMatch && startTimeMatch && endTimeMatch;
                
                console.log('[Swap Rooms] Checking event:');
                console.log('  ID:', event.id);
                console.log('  Subject:', event.extendedProps?.subject || event.title);
                console.log('  Day:', eventDay, '(' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][eventDay] + ')', dayMatch ? '✓' : '✗');
                console.log('  Start Time:', eventStartTime, startTimeMatch ? '✓' : '✗', '(looking for:', currentStartTime + ')');
                console.log('  End Time:', eventEndTime, endTimeMatch ? '✓' : '✗', '(looking for:', currentEndTime + ')');
                console.log('  Room:', event.extendedProps?.room, '(ID:', event.extendedProps?.roomId + ')');
                console.log('  Event Start Date:', event.start);
                console.log('  Event End Date:', event.end);
                console.log('  MATCH:', allMatch ? 'YES ✓' : 'NO ✗');
                console.log('  ---');
                
                // Check if same day of week and overlapping time slots
                // Convert times to minutes for easier comparison
                const timeToMinutes = (timeStr) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                };
                
                const currentStartMinutes = timeToMinutes(currentStartTime);
                const currentEndMinutes = timeToMinutes(currentEndTime);
                const eventStartMinutes = timeToMinutes(eventStartTime);
                const eventEndMinutes = timeToMinutes(eventEndTime);
                
                // Check if times overlap (events share the same time slot)
                const timesOverlap = (currentStartMinutes < eventEndMinutes && currentEndMinutes > eventStartMinutes);
                
                // Check if same day of week and times overlap
                if (eventDay === currentDay && timesOverlap) {
                    console.log('[Swap Rooms] ✓ MATCH FOUND (overlapping times):');
                    console.log('  ID:', event.id);
                    console.log('  Subject:', event.extendedProps?.subject || event.title);
                    console.log('  Day:', eventDay + ' (' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][eventDay] + ')', '✓');
                    console.log('  Time:', eventStartTime + '-' + eventEndTime, '(overlaps with:', currentStartTime + '-' + currentEndTime + ')');
                    console.log('  Room:', event.extendedProps?.room, '(ID:', event.extendedProps?.roomId + ')');
                    sameTimeEvents.push(event);
                }
            } else {
                console.log('[Swap Rooms] Skipping event - missing start/end:', {
                    id: event.id,
                    subject: event.extendedProps?.subject || event.title,
                    hasStart: !!event.start,
                    hasEnd: !!event.end
                });
            }
        });
        
        console.log('[Swap Rooms] Summary:');
        console.log('  Total Events:', allEvents.length);
        console.log('  Checked:', checkedCount);
        console.log('  Skipped:', skippedCount);
        console.log('  Matches Found:', sameTimeEvents.length);
        if (sameTimeEvents.length > 0) {
            console.log('  Matching Events:');
            sameTimeEvents.forEach((evt, idx) => {
                console.log(`    ${idx + 1}. ${evt.extendedProps?.subject || evt.title} - Room: ${evt.extendedProps?.room}`);
            });
        }
        
        return sameTimeEvents;
    }
    
    // Function to show swap rooms modal
    function showSwapRoomsModal(currentEventData) {
        const swapModal = document.getElementById('swapRoomsModal');
        const currentEventInfo = document.getElementById('currentEventInfo');
        const swapEventsList = document.getElementById('swapEventsList');
        const swapEventsEmpty = document.getElementById('swapEventsEmpty');
        const confirmSwapBtn = document.getElementById('confirmSwapRoomsBtn');
        
        if (!swapModal || !currentEventInfo || !swapEventsList) return;
        
        const calendar = window.calendar;
        if (!calendar) return;
        
        const currentEvent = calendar.getEventById(currentEventData.eventId);
        if (!currentEvent) return;
        
        // Populate current event info
        const currentRoom = currentEvent.extendedProps?.room || 'N/A';
        const currentSubject = currentEvent.extendedProps?.subject || currentEvent.title || 'N/A';
        const currentTime = currentEventData.time || 'N/A';
        const currentDay = currentEventData.day || 'N/A';
        
        // Get actual times from event for display
        const actualStartTime = currentEvent.start ? 
            currentEvent.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }) : '';
        const actualEndTime = currentEvent.end ? 
            currentEvent.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }) : '';
        const actualDayOfWeek = currentEvent.start ? 
            ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentEvent.start.getDay()] : '';
        
        currentEventInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong style="color: #333;">${currentSubject}</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">
                        <i class="fas fa-calendar-day"></i> ${currentDay} | 
                        <i class="fas fa-clock"></i> ${currentTime} | 
                        <i class="fas fa-door-open"></i> ${currentRoom}
                    </span>
                    ${actualStartTime && actualEndTime ? `<br><span style="color: #94a3b8; font-size: 0.8rem; font-style: italic;">Searching for: ${actualDayOfWeek} ${actualStartTime}-${actualEndTime}</span>` : ''}
                </div>
            </div>
        `;
        
        // Find events at the same time
        const sameTimeEvents = findEventsAtSameTime(currentEvent);
        
        console.log('[Swap Rooms] Current event details for search:');
        console.log('  Subject:', currentSubject);
        console.log('  Day:', actualDayOfWeek, '(day index:', currentEvent.start ? currentEvent.start.getDay() : 'N/A', ')');
        console.log('  Time:', actualStartTime + '-' + actualEndTime);
        console.log('  Room:', currentRoom);
        
        // Clear and populate swap events list
        swapEventsList.innerHTML = '';
        swapEventsEmpty.style.display = 'none';
        
        if (sameTimeEvents.length === 0) {
            swapEventsList.style.display = 'none';
            swapEventsEmpty.style.display = 'block';
            confirmSwapBtn.disabled = true;
        } else {
            swapEventsList.style.display = 'block';
            confirmSwapBtn.disabled = true;
            
            sameTimeEvents.forEach((event, index) => {
                const eventRoom = event.extendedProps?.room || 'N/A';
                const eventRoomId = event.extendedProps?.roomId || '';
                const eventSubject = event.extendedProps?.subject || event.title || 'N/A';
                const eventTeacher = event.extendedProps?.faculty || 'Not assigned';
                const eventDept = event.extendedProps?.department || 'N/A';
                
                // Skip if same room (no point swapping)
                if (eventRoomId === currentEvent.extendedProps?.roomId) {
                    return;
                }
                
                const eventItem = document.createElement('div');
                eventItem.className = 'swap-event-item';
                eventItem.style.cssText = `
                    padding: 12px;
                    margin-bottom: 10px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: white;
                `;
                
                eventItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <strong style="color: #333; display: block; margin-bottom: 5px;">${eventSubject}</strong>
                            <span style="color: #666; font-size: 0.85rem; display: block; margin-bottom: 3px;">
                                <i class="fas fa-building"></i> ${eventDept} | 
                                <i class="fas fa-chalkboard-teacher"></i> ${eventTeacher}
                            </span>
                            <span style="color: #667eea; font-size: 0.9rem; font-weight: 600;">
                                <i class="fas fa-door-open"></i> ${eventRoom}
                            </span>
                        </div>
                        <div style="margin-left: 15px;">
                            <i class="fas fa-check-circle" style="color: #667eea; font-size: 1.5rem; display: none;"></i>
                        </div>
                    </div>
                `;
                
                // Add click handler
                eventItem.addEventListener('click', function() {
                    // Remove selection from other items
                    swapEventsList.querySelectorAll('.swap-event-item').forEach(item => {
                        item.style.borderColor = '#e0e0e0';
                        item.style.background = 'white';
                        item.querySelector('.fa-check-circle').style.display = 'none';
                    });
                    
                    // Select this item
                    this.style.borderColor = '#667eea';
                    this.style.background = '#f0f7ff';
                    this.querySelector('.fa-check-circle').style.display = 'block';
                    
                    // Enable swap button
                    confirmSwapBtn.disabled = false;
                    confirmSwapBtn.dataset.swapEventId = event.id;
                });
                
                swapEventsList.appendChild(eventItem);
            });
            
            // If no valid events (all have same room), show empty message
            if (swapEventsList.children.length === 0) {
                swapEventsList.style.display = 'none';
                swapEventsEmpty.style.display = 'block';
                swapEventsEmpty.innerHTML = `
                    <i class="fas fa-info-circle"></i> 
                    No other classes with different rooms found at this time slot.
                `;
            }
        }
        
        // Show modal
        swapModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Handle swap rooms button click
    const swapRoomsBtn = document.getElementById('swapRoomsBtn');
    if (swapRoomsBtn) {
        swapRoomsBtn.addEventListener('click', function() {
            const eventDetailsModal = document.getElementById('eventDetailsModal');
            const roomSelect = document.getElementById('eventRoomSelect');
            const eventId = roomSelect?.dataset.eventId;
            
            if (!eventId) {
                if (typeof showNotification === 'function') {
                    showNotification('Event ID not found', 'error');
                }
                return;
            }
            
            const calendar = window.calendar;
            if (!calendar) return;
            
            const event = calendar.getEventById(eventId);
            if (!event) return;
            
            // Get event data
            const eventData = {
                eventId: event.id,
                subject: event.extendedProps?.subject || event.title,
                day: event.start ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][event.start.getDay()] : 'N/A',
                time: event.start && event.end ? 
                    `${event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${event.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : 'N/A',
                currentRoom: event.extendedProps?.room || 'N/A',
                currentRoomId: event.extendedProps?.roomId
            };
            
            // Close event details modal
            if (eventDetailsModal) {
                eventDetailsModal.style.display = 'none';
            }
            
            // Show swap rooms modal
            showSwapRoomsModal(eventData);
        });
    }
    
    // Handle confirm swap rooms button
    const confirmSwapRoomsBtn = document.getElementById('confirmSwapRoomsBtn');
    if (confirmSwapRoomsBtn) {
        confirmSwapRoomsBtn.addEventListener('click', async function() {
            const swapModal = document.getElementById('swapRoomsModal');
            const roomSelect = document.getElementById('eventRoomSelect');
            const currentEventId = roomSelect?.dataset.eventId;
            const swapEventId = this.dataset.swapEventId;
            
            if (!currentEventId || !swapEventId) {
                if (typeof showNotification === 'function') {
                    showNotification('Please select a class to swap with', 'error');
                }
                return;
            }
            
            const calendar = window.calendar;
            if (!calendar) return;
            
            const currentEvent = calendar.getEventById(currentEventId);
            const swapEvent = calendar.getEventById(swapEventId);
            
            if (!currentEvent || !swapEvent) {
                if (typeof showNotification === 'function') {
                    showNotification('One or both events not found', 'error');
                }
                return;
            }
            
            // Get room information
            const currentRoomId = currentEvent.extendedProps?.roomId;
            const currentRoomName = currentEvent.extendedProps?.room || 'N/A';
            const swapRoomId = swapEvent.extendedProps?.roomId;
            const swapRoomName = swapEvent.extendedProps?.room || 'N/A';
            
            // Validate that rooms are different
            if (currentRoomId === swapRoomId) {
                if (typeof showNotification === 'function') {
                    showNotification('Both classes are in the same room. No swap needed.', 'info');
                }
                return;
            }
            
            // Validate room compatibility for both events
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
                
                // Check if swap room is compatible with current event
                const swapRoomObj = allRooms.find(r => String(r.id) === String(swapRoomId));
                if (swapRoomObj) {
                    const isExclusive = swapRoomObj.exclusive === true || swapRoomObj.exclusive === 'true' || swapRoomObj.exclusive === 1;
                    if (isExclusive) {
                        const currentEventDeptId = currentEvent.extendedProps?.departmentId;
                        const swapRoomDeptId = swapRoomObj.departmentId ? String(swapRoomObj.departmentId).trim() : '';
                        const currentEventDeptIdStr = currentEventDeptId ? String(currentEventDeptId).trim() : '';
                        
                        if (swapRoomDeptId && currentEventDeptIdStr && swapRoomDeptId !== currentEventDeptIdStr) {
                            if (typeof showNotification === 'function') {
                                showNotification(`Cannot swap: Room "${swapRoomName}" is exclusive to another department.`, 'error');
                            }
                            return;
                        }
                    }
                }
                
                // Check if current room is compatible with swap event
                const currentRoomObj = allRooms.find(r => String(r.id) === String(currentRoomId));
                if (currentRoomObj) {
                    const isExclusive = currentRoomObj.exclusive === true || currentRoomObj.exclusive === 'true' || currentRoomObj.exclusive === 1;
                    if (isExclusive) {
                        const swapEventDeptId = swapEvent.extendedProps?.departmentId;
                        const currentRoomDeptId = currentRoomObj.departmentId ? String(currentRoomObj.departmentId).trim() : '';
                        const swapEventDeptIdStr = swapEventDeptId ? String(swapEventDeptId).trim() : '';
                        
                        if (currentRoomDeptId && swapEventDeptIdStr && currentRoomDeptId !== swapEventDeptIdStr) {
                            if (typeof showNotification === 'function') {
                                showNotification(`Cannot swap: Room "${currentRoomName}" is exclusive to another department.`, 'error');
                            }
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error('Error validating room compatibility:', error);
                // Continue with swap if validation fails (don't block the user)
            }
            
            // Perform the swap
            try {
                // Swap the rooms
                currentEvent.setExtendedProp('roomId', swapRoomId);
                currentEvent.setExtendedProp('room', swapRoomName);
                swapEvent.setExtendedProp('roomId', currentRoomId);
                swapEvent.setExtendedProp('room', currentRoomName);
                
                // Force re-render
                currentEvent.setProp('title', currentEvent.extendedProps.subject || currentEvent.title);
                swapEvent.setProp('title', swapEvent.extendedProps.subject || swapEvent.title);
                
                // Save to server
                if (typeof window.saveScheduleToLocalStorage === 'function') {
                    await window.saveScheduleToLocalStorage();
                }
                
                // Close modal
                if (swapModal) {
                    swapModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
                
                // Show success notification
                if (typeof showNotification === 'function') {
                    showNotification(`Rooms swapped successfully! "${currentRoomName}" ↔ "${swapRoomName}"`, 'success');
                }
            } catch (error) {
                console.error('Error swapping rooms:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Failed to swap rooms', 'error');
                }
            }
        });
    }
    
    // Handle cancel swap rooms button
    const cancelSwapRoomsBtn = document.getElementById('cancelSwapRoomsBtn');
    if (cancelSwapRoomsBtn) {
        cancelSwapRoomsBtn.addEventListener('click', function() {
            const swapModal = document.getElementById('swapRoomsModal');
            if (swapModal) {
                swapModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
    
    // Handle swap rooms modal close button
    document.querySelectorAll('[data-close-modal="swapRoomsModal"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const swapModal = document.getElementById('swapRoomsModal');
            if (swapModal) {
                swapModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // Close swap rooms modal when clicking outside
    const swapRoomsModal = document.getElementById('swapRoomsModal');
    if (swapRoomsModal) {
        swapRoomsModal.addEventListener('click', function(e) {
            if (e.target === swapRoomsModal) {
                swapRoomsModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
}
