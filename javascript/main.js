// Define notification and conflict detection functions at top level so they're available immediately
(function() {
    // Simple notification function that works on index.html
    if (typeof window.showNotification !== 'function') {
        window.showNotification = function(message, type = 'info') {
            // Remove existing notifications first
            const existing = document.querySelectorAll('.custom-notification');
            existing.forEach(n => n.remove());
            
            const notification = document.createElement('div');
            notification.className = `custom-notification notification-${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                max-width: 450px;
                word-wrap: break-word;
                animation: slideInRight 0.3s ease;
                font-size: 14px;
                line-height: 1.5;
            `;
            
            // Set background color based on type
            if (type === 'error') {
                notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                notification.style.color = 'white';
            } else if (type === 'success') {
                notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                notification.style.color = 'white';
            } else if (type === 'warning') {
                notification.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                notification.style.color = 'white';
            } else {
                notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
                notification.style.color = 'white';
            }
            
            notification.innerHTML = message;
            
            document.body.appendChild(notification);
            
            // Auto-remove after longer duration for errors (5 seconds) or regular (3 seconds)
            const duration = type === 'error' ? 5000 : 3000;
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        };
        
        // Add CSS animations if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Comprehensive conflict check: faculty overlap, room overlap, and room exclusivity
    // Works with both eventData objects and FullCalendar event objects
    window.wouldCreateScheduleConflict = function(eventOrData, excludeEventId = null) {
        try {
            const calendar = window.calendar;
            if (!calendar) {
                console.warn('Calendar not available for conflict check');
                return false;
            }
            
            // Extract data from event object or eventData
            const eventId = eventOrData.id || excludeEventId;
            const startTime = eventOrData.start || (eventOrData.startTime ? new Date(eventOrData.startTime) : null);
            const endTime = eventOrData.end || (eventOrData.endTime ? new Date(eventOrData.endTime) : null);
            const extendedProps = eventOrData.extendedProps || eventOrData;
            
            if (!startTime || !endTime) {
                console.warn('Invalid time data for conflict check');
                return false;
            }
            
            const newStart = startTime instanceof Date ? startTime : new Date(startTime);
            const newEnd = endTime instanceof Date ? endTime : new Date(endTime);
            const newRoomId = extendedProps.roomId;
            const newFaculty = extendedProps.faculty;
            const newSubject = extendedProps.subject || eventOrData.title || '';
            const newDeptId = extendedProps.departmentId;
            const newDeptName = extendedProps.department;

            // Enforce room exclusivity first
            const roomsList = (window.rooms && Array.isArray(window.rooms)) ? window.rooms : (function(){
                try { const saved = localStorage.getItem('rooms'); return saved ? JSON.parse(saved) : []; } catch(_) { return []; }
            })();
            const roomObj = roomsList.find(r => String(r.id) === String(newRoomId));
            if (roomObj && roomObj.exclusive) {
                const sameDept = (idA, idB, nameA, nameB) => {
                    if (idA && idB) return String(idA) === String(idB);
                    if (nameA && nameB) return String(nameA).toLowerCase() === String(nameB).toLowerCase();
                    return false;
                };
                const allowed = sameDept(roomObj.departmentId, newDeptId, roomObj.department, newDeptName);
                if (!allowed) {
                    const roomName = roomObj.name || roomObj.id || 'This room';
                    const deptName = roomObj.department || 'another department';
                    if (typeof showNotification === 'function') {
                        showNotification(`Conflict: ${roomName} is exclusive to ${deptName}. Cannot schedule ${newSubject || 'this class'} here.`, 'error');
                    } else {
                        console.error(`Conflict: Room ${roomName} is exclusive to ${deptName}`);
                    }
                    return true; // block
                }
            }

            // Check against existing events for time overlap
            const overlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
            const existing = calendar.getEvents();
            let conflictDetails = [];
            
            for (const evt of existing) {
                // Only compare events on the same date
                if (!evt.start || !evt.end) continue;
                if (evt.id === eventId) continue; // Skip the event being moved/resized
                const eStart = new Date(evt.start);
                const eEnd = new Date(evt.end);
                const sameDay = eStart.toDateString() === newStart.toDateString();
                if (!sameDay) continue;
                if (!overlap(newStart, newEnd, eStart, eEnd)) continue;

                const eRoomId = evt.extendedProps?.roomId;
                const eFaculty = evt.extendedProps?.faculty;
                const eSubject = evt.extendedProps?.subject || evt.title || '';
                const eRoomName = evt.extendedProps?.room || '';

                // Check if subject is the same (prevent merging same subject at same time)
                const sameSubject = newSubject && eSubject && String(newSubject).trim().toLowerCase() === String(eSubject).trim().toLowerCase();
                
                // Check if room is the same
                const sameRoom = eRoomId && newRoomId && String(eRoomId) === String(newRoomId);
                // Check if faculty is the same
                const sameFaculty = eFaculty && newFaculty && String(eFaculty) === String(newFaculty);

                const timeStr = `${eStart.toTimeString().substring(0, 5)} - ${eEnd.toTimeString().substring(0, 5)}`;

                // Block on any conflict: same subject OR same teacher OR same room
                if (sameSubject) {
                    conflictDetails.push(`Conflict: Subject "${eSubject}" is already scheduled at ${timeStr}.`);
                } else if (sameFaculty) {
                    conflictDetails.push(`Conflict: Teacher "${eFaculty}" is already occupied at ${timeStr}.`);
                } else if (sameRoom) {
                    conflictDetails.push(`Conflict: Room "${eRoomName || newRoomId}" is already occupied at ${timeStr}.`);
                }
            }
            
            if (conflictDetails.length > 0) {
                // Format conflict message for better readability
                const conflictMsg = `Schedule Conflict Detected:<br>${conflictDetails.join('<br>')}<br><br><strong>Cannot schedule "${newSubject || 'this class'}" at this time.</strong>`;
                if (typeof showNotification === 'function') {
                    showNotification(conflictMsg, 'error');
                } else {
                    console.error('Schedule Conflict:', conflictDetails.join('; '));
                }
                return true;
            }
            
            return false;
        } catch (e) {
            console.warn('Conflict check failed, proceeding without blocking:', e);
            return false;
        }
    };
    
    console.log('Conflict detection function initialized');
})();

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // Initialize allClasses array at the very beginning
    let allClasses = [];
    window.allClasses = allClasses;
    
    // Expose a safe global reset/setter to keep state in sync across files
    window.resetClasses = function() {
        allClasses = [];
        window.allClasses = allClasses;
        if (typeof saveClassesToLocalStorage === 'function') {
            try { saveClassesToLocalStorage(); } catch (e) { console.warn('saveClassesToLocalStorage failed', e); }
        }
        if (typeof updateClassesCountBadge === 'function') {
            try { updateClassesCountBadge(); } catch (e) { console.warn('updateClassesCountBadge failed', e); }
        }
    };

    window.setAllClasses = function(newClasses) {
        allClasses = Array.isArray(newClasses) ? newClasses.slice() : [];
        window.allClasses = allClasses;
        if (typeof saveClassesToLocalStorage === 'function') {
            try { saveClassesToLocalStorage(); } catch (e) { console.warn('saveClassesToLocalStorage failed', e); }
        }
        if (typeof updateClassesCountBadge === 'function') {
            try { updateClassesCountBadge(); } catch (e) { console.warn('updateClassesCountBadge failed', e); }
        }
    };
    
    // Check authentication and redirect if needed
    checkAuthAndRedirect();
    
    // Set up event color observer
    setupEventColorObserver();
    
    // Debug check for calendar element
    const calendarEl = document.getElementById('calendar');
    console.log('Calendar element exists:', !!calendarEl);
    console.log('Current page URL:', window.location.href);
    console.log('Document title:', document.title);
    
    // Only initialize calendar if the element exists (not on superadmin dashboard)
    if (!calendarEl) {
        console.log('No calendar element found - likely on superadmin dashboard or wrong page');
        console.log('Available elements with "calendar" in ID:', document.querySelectorAll('[id*="calendar"]'));
        return;
    }    // Initialize empty subjects by department (to be created by superadmin)
    let subjectsByDepartment = {};
      // Initialize empty rooms (to be created by superadmin)
    let rooms = [];
    
    // Load rooms from server
    async function loadRooms() {
        try {
            const authToken = localStorage.getItem('authToken');
            console.log('Auth token exists:', !!authToken);
            console.log('Auth token value:', authToken ? 'Present' : 'Missing');
            
            if (!authToken) {
                console.error('No authentication token found');
                showNotification('Please log in to access room data', 'error');
                return;
            }
            
            const response = await fetch('/api/rooms', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            console.log('Room API response status:', response.status);
            
            if (response.ok) {
                const roomsData = await response.json();
                rooms = roomsData;
                window.rooms = rooms; // Update global reference
                initializeRoomUsageCount(); // Initialize room usage counts
                console.log('Loaded rooms:', rooms.length);
            } else {
                console.error('Failed to load rooms:', response.statusText);
                if (response.status === 401) {
                    showNotification('Authentication expired. Please log in again.', 'error');
                } else {
                    showNotification('Failed to load rooms. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            showNotification('Error loading rooms. Please check your connection.', 'error');
        }
    }
    
    // Load rooms when page loads
    loadRooms();

    // Define days of the week for the calendar in correct order
    const days = [
        { id: 'Monday', title: 'Monday' },
        { id: 'Tuesday', title: 'Tuesday' },
        { id: 'Wednesday', title: 'Wednesday' },
        { id: 'Thursday', title: 'Thursday' },
        { id: 'Friday', title: 'Friday' },
        { id: 'Saturday', title: 'Saturday' }
    ];
    
    // allClasses is already initialized at the top of the file

    // Initialize faculty members list - empty at first
    let facultyMembers = [];
    
    // Load faculty members from localStorage if any exist
    if (localStorage.getItem('facultyMembers')) {
        try {
            facultyMembers = JSON.parse(localStorage.getItem('facultyMembers'));
            console.log('Loaded faculty members:', facultyMembers.length);
        } catch (e) {
            console.error('Error loading faculty members from localStorage:', e);
            facultyMembers = [];
        }
    }

    // Time slots for auto scheduling (7:00 AM to 7:30 PM in 30-minute increments)
    const timeSlots = generateTimeSlots();

    // Initialize room usage counts
    const roomUsageCount = {};
    window.roomUsageCount = roomUsageCount;
    window.rooms = rooms;
    
    // Function to initialize room usage counts
    function initializeRoomUsageCount() {
        if (rooms && rooms.length > 0) {
            rooms.forEach(room => {
                roomUsageCount[room.id] = 0;
            });
        }
    }    
    // Calendar initialization is now handled in index.html

    // Form is now always visible - no toggle functionality needed
    const formContainer = document.getElementById('formContainer');
    
    // Ensure form container is always visible
    if (formContainer) {
        formContainer.style.display = 'block';
    }
    
    // Form elements
    const departmentSelect = document.getElementById('departmentSelect');
    const facultySelect = document.getElementById('facultySelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const submitScheduleBtn = document.getElementById('submitScheduleBtn');
    const resetFormBtn = document.getElementById('clearFormBtn');
    
    // Faculty form elements
    const addFacultyLink = document.getElementById('addFacultyLink');
    const addFacultyModal = document.getElementById('addFacultyModal');
    const saveFacultyBtn = document.getElementById('saveFacultyBtn');
    const cancelFacultyBtn = document.getElementById('cancelFacultyBtn');
    const facultyFirstName = document.getElementById('facultyFirstName');
    const facultyMiddleName = document.getElementById('facultyMiddleName');
    const facultyLastName = document.getElementById('facultyLastName');
    const facultyDepartment = document.getElementById('facultyDepartment');
    
    // Populate faculty dropdown with saved members
    populateFacultyDropdown();

    // Department change handler - directly connect department to subjects
    if (departmentSelect) {
        departmentSelect.addEventListener('change', function() {
            const selectedDepartment = this.value;
            
            // Update subject dropdown based on department
            if (selectedDepartment && subjectSelect) {
                // Enable subject dropdown
                subjectSelect.disabled = false;
                
                // Clear and populate subject dropdown
                subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                
                // Add subject options for selected department
                if (subjectsByDepartment[selectedDepartment] && Array.isArray(subjectsByDepartment[selectedDepartment])) {
                    subjectsByDepartment[selectedDepartment].forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    option.dataset.course = selectedDepartment;
                    subjectSelect.appendChild(option);
                    });
                }
            } else if (subjectSelect) {
                // Disable subject dropdown if no department is selected
                subjectSelect.disabled = true;
                subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
            }
            
            // Filter faculty dropdown based on selected department
            if (facultySelect) {
                // Get currently selected faculty if any
                const currentFaculty = facultySelect.value;
                
                // Rebuild faculty dropdown
                facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty Member</option>';
                
                // Filter and add faculty options for selected department
                const filteredFaculty = selectedDepartment ? 
                    facultyMembers.filter(f => f.department === selectedDepartment) : 
                    facultyMembers;
                
                if (filteredFaculty.length > 0) {
                    console.log('Faculty members for department', selectedDepartment, ':', filteredFaculty.length);
                    
                    filteredFaculty.forEach(faculty => {
                        const option = document.createElement('option');
                        option.value = faculty.id;
                        option.textContent = faculty.fullName;
                        facultySelect.appendChild(option);
                    });
                    
                    // Enable the faculty select
                    facultySelect.disabled = false;
                } else {
                    console.log('No faculty members found for department:', selectedDepartment);
                    // Add a message that there are no faculty members yet
                    const option = document.createElement('option');
                    option.value = "";
                    option.textContent = "No faculty members for this department";
                    option.disabled = true;
                    facultySelect.appendChild(option);
                    
                    // Keep the faculty select disabled when no options available
                    facultySelect.disabled = true;
                }
                
                // Try to restore previous selection
                if (currentFaculty) {
                    facultySelect.value = currentFaculty;
                }
            }
        });
    }
      // Entity management moved to superadmin.html
    // Faculty link handlers disabled - management moved to superadmin dashboard
    if (addFacultyLink) {
        addFacultyLink.style.display = 'none';
    }
    
    // Manage Faculty link handler - disabled as management moved to superadmin
    const manageFacultyLink = document.getElementById('manageFacultyLink');
    if (manageFacultyLink) {
        manageFacultyLink.style.display = 'none';
    }
    
    // Function to populate the faculty list in the manage faculty modal
    function populateFacultyManagerList() {
        const facultyList = document.getElementById('facultyList');
        if (!facultyList) return;
        
        // Clear the list
        facultyList.innerHTML = '';
        
        if (facultyMembers.length === 0) {
            // Show a message if there are no faculty members
            facultyList.innerHTML = '<div class="no-faculty">No faculty members added yet.</div>';
            return;
        }
        
        // Group faculty members by department
        const facultyByDepartment = {};
        
        facultyMembers.forEach(faculty => {
            if (!facultyByDepartment[faculty.department]) {
                facultyByDepartment[faculty.department] = [];
            }
            facultyByDepartment[faculty.department].push(faculty);
        });
        
        // Create sections for each department
        for (const department in facultyByDepartment) {
            if (facultyByDepartment.hasOwnProperty(department)) {
                const departmentSection = document.createElement('div');
                departmentSection.className = 'faculty-department-section';
                
                // Create a heading for the department
                const heading = document.createElement('h3');
                heading.textContent = department;
                departmentSection.appendChild(heading);
                
                // Create a list for the faculty members
                const list = document.createElement('ul');
                list.className = 'faculty-list';
                
                // Add faculty members to the list
                facultyByDepartment[department].forEach(faculty => {
                    const listItem = document.createElement('li');
                    listItem.className = 'faculty-item';
                    
                    // Create the faculty name element
                    const nameEl = document.createElement('span');
                    nameEl.className = 'faculty-name';
                    nameEl.textContent = `${faculty.firstName} ${faculty.lastName}`;
                    
                    // Create the remove button
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-faculty-btn';
                    removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
                    removeBtn.dataset.id = faculty.id;
                    
                    // Add event listener to the remove button
                    removeBtn.addEventListener('click', function() {
                        removeFacultyMember(faculty.id);
                    });
                    
                    // Add elements to the list item
                    listItem.appendChild(nameEl);
                    listItem.appendChild(removeBtn);
                    
                    // Add the list item to the list
                    list.appendChild(listItem);
                });
                
                // Add the list to the department section
                departmentSection.appendChild(list);
                
                // Add the department section to the faculty list
                facultyList.appendChild(departmentSection);
            }
        }
    }
    
    // Function to remove a faculty member
    function removeFacultyMember(id) {
        // Find the faculty member
        const faculty = facultyMembers.find(f => f.id === id);
        if (!faculty) return;
        
        // Get the name for the notification
        const facultyName = `${faculty.firstName} ${faculty.lastName}`;
        
        // Remove from the array
        facultyMembers = facultyMembers.filter(f => f.id !== id);
        
        // Save to localStorage
        try {
            localStorage.setItem('facultyMembers', JSON.stringify(facultyMembers));
        } catch (e) {
            console.error('Error saving faculty members to localStorage:', e);
        }
        
        // Update the faculty dropdown
        populateFacultyDropdown();
        
        // Update the faculty list in the manage faculty modal
        populateFacultyManagerList();
        
        // Show notification
        showNotification(`Faculty member ${facultyName} has been removed.`, 'success');
    }
    
    // Save Faculty button handler
    if (saveFacultyBtn) {
        saveFacultyBtn.addEventListener('click', function() {
            // Basic validation
            if (!facultyFirstName || !facultyFirstName.value.trim()) {
                facultyFirstName.parentElement.classList.add('error');
                return;
            } else {
                facultyFirstName.parentElement.classList.remove('error');
            }
            
            if (!facultyLastName || !facultyLastName.value.trim()) {
                facultyLastName.parentElement.classList.add('error');
                return;
            } else {
                facultyLastName.parentElement.classList.remove('error');
            }
            
            if (!facultyDepartment || !facultyDepartment.value) {
                facultyDepartment.parentElement.classList.add('error');
                return;
            } else {
                facultyDepartment.parentElement.classList.remove('error');
            }
            
            // Create new faculty member
            const newFaculty = {
                id: 'faculty_' + Date.now(),
                firstName: facultyFirstName.value.trim(),
                middleName: facultyMiddleName ? facultyMiddleName.value.trim() : '',
                lastName: facultyLastName.value.trim(),
                department: facultyDepartment.value,
                fullName: formatFacultyName(
                    facultyFirstName.value.trim(),
                    facultyMiddleName ? facultyMiddleName.value.trim() : '',
                    facultyLastName.value.trim(),
                    facultyDepartment.value
                )
            };
            
            // Add to faculty members array
            facultyMembers.push(newFaculty);
            
            // Save to localStorage
            try {
                localStorage.setItem('facultyMembers', JSON.stringify(facultyMembers));
            } catch (e) {
                console.error('Error saving faculty members to localStorage:', e);
            }
            
            // Update faculty dropdown
            populateFacultyDropdown();
            
            // Select the newly added faculty member
            if (facultySelect) {
                facultySelect.value = newFaculty.id;
            }
            
            // Hide modal
            hideModal('addFacultyModal');
            
            // Show notification
            showNotification('Faculty member added successfully!', 'success');
        });
    }
    
    // Cancel Faculty button handler
    if (cancelFacultyBtn) {
        cancelFacultyBtn.addEventListener('click', function() {
            hideModal('addFacultyModal');
        });
    }
    
    // Hide classtype field for superadmin
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userRole = userData.role || 'user';
    const classTypeGroup = document.getElementById('classTypeGroup');
    if (classTypeGroup && userRole === 'superadmin') {
        classTypeGroup.style.display = 'none';
    }
    
    // Prevent form submission
    const scheduleForm = document.getElementById('scheduleForm');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Form submission prevented');
        });
    }
    
    // Submit button handler - creates a class based on form selections
    if (submitScheduleBtn) {
        submitScheduleBtn.addEventListener('click', async function(e) {
            e.preventDefault(); // Prevent form submission
            console.log('Submit button clicked');
            
            // Check user role permissions
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userRole = userData.role || 'user';
            
            if (userRole === 'user') {
                showNotification('Access denied. Only admins and superadmins can create classes.', 'error');
                return;
            }
            
            // Validate form selections
            if (!validateForm()) {
                console.log('Form validation failed');
                return;
            }
            console.log('Form validation passed');
              // Get selected values
            const selectedDepartment = departmentSelect.value; // This is the department code
            const selectedFacultyId = facultySelect.value;
            const selectedFacultyName = facultySelect.options[facultySelect.selectedIndex]?.text || 'Unknown Faculty';
            const selectedSubjectId = subjectSelect.value;
            const selectedSubjectName = subjectSelect.options[subjectSelect.selectedIndex]?.text || 'Unknown Subject';
            const programSelect = document.getElementById('programSelect');
            const selectedProgram = programSelect?.value ? programSelect.options[programSelect.selectedIndex]?.text : selectedDepartment;
            
            // Get department ID from the select option data attribute if available
            const deptOption = departmentSelect.options[departmentSelect.selectedIndex];
            const departmentId = deptOption?.dataset?.deptId || selectedDepartment;
            
            // Get subject data to find lecture/lab hours (for ALL users)
            let lectureHours = 0;
            let labHours = 0;
            let classType = 'lecture';
            let subjectCode = '';
            let subjectName = selectedSubjectName;
            
            // Try to get subject data to find lecture/lab hours
            try {
                let subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
                
                // If no subjects in localStorage, try to fetch from API
                if (!subjects || subjects.length === 0) {
                    try {
                        // Use fetchWithAuth if available, otherwise use regular fetch
                        const fetchFn = typeof fetchWithAuth !== 'undefined' ? fetchWithAuth : fetch;
                        const authToken = localStorage.getItem('authToken');
                        const response = await fetchFn('/api/subjects', {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (response && response.ok) {
                            subjects = await response.json();
                            if (subjects && subjects.length > 0) {
                                localStorage.setItem('subjects', JSON.stringify(subjects));
                            }
                        }
                    } catch (apiError) {
                        console.warn('Could not fetch subjects from API:', apiError);
                    }
                }
                
                // Try multiple ways to find the subject
                let subject = subjects.find(s => s.id === selectedSubjectId || s.code === selectedSubjectId);
                
                // If not found by ID/code, try by name
                if (!subject) {
                    subject = subjects.find(s => s.name === selectedSubjectName);
                }
                
                if (subject) {
                    subjectCode = subject.code || '';
                    subjectName = subject.name || selectedSubjectName;
                    lectureHours = parseInt(subject.lectureHours) || 0;
                    labHours = parseInt(subject.labHours) || 0;
                    
                    console.log('Subject data loaded:', {
                        code: subjectCode,
                        name: subjectName,
                        lectureHours: lectureHours,
                        labHours: labHours
                    });
                } else {
                    console.warn('Subject not found in data. Selected ID:', selectedSubjectId, 'Selected Name:', selectedSubjectName);
                }
            } catch (e) {
                console.warn('Could not load subject data for lecture/lab hours:', e);
            }
            
            // If no hours from subject data, use classType selection (for non-superadmin) or default
            if (lectureHours === 0 && labHours === 0) {
                if (userRole !== 'superadmin') {
                    const classTypeRadio = document.querySelector('input[name="classType"]:checked');
                    classType = classTypeRadio ? classTypeRadio.value : 'lecture';
                    const unitLoad = "3"; // Default unit load
                    lectureHours = classType === 'lecture' ? parseFloat(unitLoad) : 0;
                    labHours = classType === 'laboratory' ? parseFloat(unitLoad) : 0;
                } else {
                    // Default to lecture if no hours specified for superadmin
                    lectureHours = 3;
                }
            }
            
            // Create ONE class with both lecture and lab hours (if any)
            // The generation logic will split it into separate schedules if both hours exist
            const unitLoad = lectureHours > 0 ? lectureHours : (labHours > 0 ? labHours : 3);
            const classData = {
                id: 'class-' + Date.now(),
                subject: subjectName,
                subjectCode: subjectCode,
                subjectId: selectedSubjectId,
                unitLoad: unitLoad, // Default unit load (will be overridden during generation if both hours exist)
                classType: lectureHours > 0 && labHours > 0 ? 'mixed' : (lectureHours > 0 ? 'lecture' : (labHours > 0 ? 'laboratory' : classType)),
                lectureHours: lectureHours,
                labHours: labHours,
                course: selectedProgram || selectedDepartment,
                courseId: programSelect?.value || selectedDepartment,
                faculty: selectedFacultyName,
                facultyId: selectedFacultyId,
                department: selectedDepartment,
                departmentId: departmentId
            };
            allClasses.push(classData);
            addClassToList(classData);
            console.log('Class created with lecture hours:', lectureHours, 'lab hours:', labHours);
            
            window.allClasses = allClasses;
            console.log('Classes added to allClasses array. Total:', allClasses.length);
            
            // Update classes count badge
            updateClassesCountBadge();
            
            // Reset form fields but keep department selection
            resetFormFieldsPartial();
            
            // Show notification
            showNotification('Class added to list! Click "Generate Schedule" to add to timetable.', 'success');
        });
    }
    
    // Reset button handler - resets all form fields
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', function() {
            resetFormFieldsFull();
            showNotification('Form reset', 'info');
        });
    }
    
    // Button handlers for generate, clear and print
    const generateBtn = document.getElementById('generateScheduleBtn');
    const clearBtn = document.getElementById('clearScheduleBtn');
    const printBtn = document.getElementById('printScheduleBtn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            generateSchedule();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            try {
                const classesList = document.getElementById('createdClasses');
                const classItems = classesList ? classesList.querySelectorAll('.class-item') : [];
                if (typeof clearAllClasses === 'function' && classesList) {
                    clearAllClasses(classesList, classItems);
                } else {
                    // Fallback: remove list items and events
                    if (classItems && classItems.forEach) classItems.forEach(item => item.remove());
                    if (window.calendar && typeof window.calendar.removeAllEvents === 'function') {
                        window.calendar.removeAllEvents();
                    }
                    window.allClasses = [];
                }
                if (typeof saveClassesToLocalStorage === 'function') saveClassesToLocalStorage();
                if (typeof updateGenerateScheduleButtonState === 'function') updateGenerateScheduleButtonState();
                if (typeof showNotification === 'function') showNotification('All schedules and classes cleared.', 'success');
            } catch (e) {
                console.error('Error clearing schedule:', e);
                if (typeof showNotification === 'function') showNotification('Failed to clear schedule', 'error');
            }
        });
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            printSchedule();
        });
    }

    // Helper Functions
    // Note: wouldCreateScheduleConflict is defined at the top level for immediate availability
    
    // Format faculty name
    function formatFacultyName(firstName, middleName, lastName, department) {
        let name = `${firstName} `;
        
        if (middleName) {
            name += `${middleName.charAt(0)}. `;
        }
        
        name += `${lastName} (${department})`;
        
        return name;
    }
    
    // Populate faculty dropdown
    function populateFacultyDropdown() {
        if (!facultySelect) return;
        
        console.log('Populating faculty dropdown with', facultyMembers.length, 'faculty members');
        
        // Clear dropdown
        facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty Member</option>';
        
        // Filter by current department if one is selected
        let filteredFaculty = facultyMembers;
        
        if (departmentSelect && departmentSelect.value) {
            filteredFaculty = facultyMembers.filter(f => f.department === departmentSelect.value);
        }
        
        // Add faculty options
        if (filteredFaculty.length > 0) {
            filteredFaculty.forEach(faculty => {
                const option = document.createElement('option');
                option.value = faculty.id;
                option.textContent = faculty.fullName;
                option.dataset.email = faculty.email || '';
                facultySelect.appendChild(option);
            });
            
            // Enable the faculty select
            facultySelect.disabled = false;
        } else {
            console.log('No faculty members available to populate dropdown');
            // Keep dropdown disabled when no faculty available
            facultySelect.disabled = true;
        }
    }
      // Validate form fields
    function validateForm() {
        let isValid = true;
        
        if (departmentSelect && !departmentSelect.value) {
            departmentSelect.parentElement.classList.add('error');
            isValid = false;
        } else if (departmentSelect) {
            departmentSelect.parentElement.classList.remove('error');
        }
        
        if (facultySelect && !facultySelect.value) {
            facultySelect.parentElement.classList.add('error');
            isValid = false;
        } else if (facultySelect) {
            facultySelect.parentElement.classList.remove('error');
        }
        
        if (subjectSelect && !subjectSelect.value) {
            subjectSelect.parentElement.classList.add('error');
            isValid = false;
        } else if (subjectSelect) {
            subjectSelect.parentElement.classList.remove('error');
        }
        
        // Unit load removed; value is defined by subject/course and handled server-side
        
        return isValid;
    }
      // Reset form fields but keep department selection
    function resetFormFieldsPartial() {
        // Keep department selection
        const programSelect = document.getElementById('programSelect');
        
        // Reset faculty select - reload it using the department
        if (facultySelect && departmentSelect && departmentSelect.value) {
            const selectedDepartment = departmentSelect.value;
            // Reload faculty for the selected department
            if (typeof loadFaculty === 'function') {
                loadFaculty(selectedDepartment);
            } else {
                // Fallback: just reset to initial state
                facultySelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
                facultySelect.disabled = true;
            }
        } else if (facultySelect) {
            facultySelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
            facultySelect.disabled = true;
        }
        
        // Reset subject select
        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="" selected disabled>Select Faculty First</option>';
            subjectSelect.disabled = true;
        }
        
        // Reset program select - reload it using the department
        if (programSelect && departmentSelect && departmentSelect.value) {
            // Reload programs for the selected department
            if (typeof loadPrograms === 'function') {
                loadPrograms();
            } else {
                // Fallback: just reset to initial state
                programSelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
                programSelect.disabled = true;
            }
        } else if (programSelect) {
            programSelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
            programSelect.disabled = true;
        }
        
        // Reset class type to default (lecture)
        const classTypeRadio = document.querySelector('input[name="classType"][value="lecture"]');
        if (classTypeRadio) classTypeRadio.checked = true;
        
        // Remove any error indications
        document.querySelectorAll('.form-group.error').forEach(group => {
            group.classList.remove('error');
        });
    }
      // Reset all form fields
    function resetFormFieldsFull() {
        if (departmentSelect) {
            // Reset department dropdown
            departmentSelect.value = '';
        }
        
        if (facultySelect) {
            // Reset and disable faculty dropdown
            facultySelect.innerHTML = '<option value="" selected disabled>Select Department First</option>';
            facultySelect.disabled = true;
        }
        
        if (subjectSelect) {
            // Reset and disable subject dropdown
            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
            subjectSelect.disabled = true;
        }
        
        // Unit load removed from form
        
        // Reset class type to default (lecture)
        const classTypeRadio = document.querySelector('input[name="classType"][value="lecture"]');
        if (classTypeRadio) classTypeRadio.checked = true;
        
        // Remove any error indications
        document.querySelectorAll('.form-group.error').forEach(group => {
            group.classList.remove('error');
        });
    }
    
    // Add class to the list
    function addClassToList(classData) {
        const classesList = document.getElementById('createdClasses');
        if (!classesList) return;
        
        const emptyState = classesList.querySelector('.empty-state');
        
        if (emptyState) {
            emptyState.remove();
        }
        
        const classItem = document.createElement('div');
        classItem.className = `class-item ${classData.course.toLowerCase()}`;
        classItem.dataset.id = classData.id;
        // Apply department color to the draggable card
        try {
            const deptColor = getDepartmentColorForClass(classData);
            console.log('Applying department color to class item:', deptColor);
            // Use !important to override any CSS rules
            classItem.style.setProperty('background-color', deptColor, 'important');
            classItem.style.setProperty('color', '#fff', 'important');
            classItem.style.setProperty('border-left-color', deptColor, 'important');
            classItem.dataset.departmentColor = deptColor;
            console.log('Applied color:', deptColor, 'to element');
        } catch (e) {
            console.warn('Could not compute department color for class item', e);
        }
        
        // Format subject display: code and name
        const subjectDisplay = classData.subjectCode 
            ? `${classData.subjectCode} - ${classData.subject}`
            : classData.subject;
        
        // Format type display with hours
        let typeDisplay = '';
        if (classData.lectureHours > 0 && classData.labHours > 0) {
            typeDisplay = `Lecture (${classData.lectureHours}h) & Lab (${classData.labHours}h)`;
        } else if (classData.lectureHours > 0) {
            typeDisplay = `Lecture (${classData.lectureHours}h)`;
        } else if (classData.labHours > 0) {
            typeDisplay = `Laboratory (${classData.labHours}h)`;
        } else {
            typeDisplay = `${classData.classType} (${classData.unitLoad}h)`;
        }
        
        classItem.innerHTML = `
            <h3>${subjectDisplay}</h3>
            <div class="class-info"><i class="fas fa-building"></i> ${classData.department || classData.course}</div>
            <div class="class-info"><i class="fas fa-chalkboard-teacher"></i> ${classData.faculty}</div>
            <div class="class-info"><i class="fas fa-book"></i> ${typeDisplay}</div>
            <div class="class-actions">
                <button class="remove-class-btn" data-id="${classData.id}"><i class="fas fa-trash-alt"></i> Remove</button>
            </div>
        `;
        
        classesList.appendChild(classItem);
        
        // Add event listener to remove button
        classItem.querySelector('.remove-class-btn').addEventListener('click', function() {
            removeClassItem(classData.id);
        });
        
        // Make class draggable for manual placement
        makeClassDraggable(classItem, classData);
    }
    
    // Make class draggable to calendar
    function makeClassDraggable(element, classData) {
        // Check if FullCalendar and Draggable are available
        if (typeof FullCalendar === 'undefined' || !FullCalendar.Draggable) {
            console.warn('FullCalendar.Draggable not available, skipping drag functionality');
            return;
        }
        
        // Get department color from the department settings (from superadmin dashboard)
        const departmentColor = (element.dataset && element.dataset.departmentColor) 
            ? element.dataset.departmentColor 
            : getDepartmentColorForClass(classData);
        
        console.log('Making class draggable with department color:', departmentColor, 'for class:', classData);
        
        try {
            new FullCalendar.Draggable(element, {
                itemSelector: '.class-item',
                eventData: function(dragEl) {
                    // Generate a new unique ID for each instance of a dragged class
                    // Format: original-id-timestamp to ensure uniqueness
                    const uniqueInstanceId = classData.id + '-' + Date.now();
                    
                    // Ensure we have the department color
                    const deptColor = dragEl.dataset?.departmentColor || 
                                     element.dataset?.departmentColor || 
                                     getDepartmentColorForClass(classData);
                    
                    console.log('Creating draggable event with color:', deptColor);
                    
                    return {
                        id: uniqueInstanceId, // Use the unique instance ID instead of the original class ID
                        title: classData.subject,
                        duration: { hours: classData.unitLoad },
                        backgroundColor: deptColor,
                        borderColor: deptColor,
                        textColor: '#ffffff',
                        classNames: [
                            `${classData.course.toLowerCase()}-event`,
                            `${classData.classType}-type`,
                            'department-colored-event'
                        ],
                        extendedProps: {
                            originalClassId: classData.id, // Store the original ID for reference
                            subject: classData.subject,
                            course: classData.course,
                            courseId: classData.courseId,
                            faculty: classData.faculty,
                            facultyId: classData.facultyId,
                            unitLoad: classData.unitLoad,
                            classType: classData.classType,
                            department: classData.department,
                            departmentId: classData.departmentId,
                            departmentColor: deptColor
                        }
                    };
                }
            });
            
            console.log('Class item made draggable successfully');
        } catch (error) {
            console.error('Error making class draggable:', error);
        }
    }
    
    // Remove class item
    function removeClassItem(id) {
        // Remove from array
        allClasses = allClasses.filter(item => item.id !== id);
        window.allClasses = allClasses;
        
        // Persist and update UI state
        if (typeof saveClassesToLocalStorage === 'function') {
            try { saveClassesToLocalStorage(); } catch (e) { console.warn('saveClassesToLocalStorage failed', e); }
        }
        if (typeof updateClassesCountBadge === 'function') {
            try { updateClassesCountBadge(); } catch (e) { console.warn('updateClassesCountBadge failed', e); }
        }
        
        // Remove from UI
        const element = document.querySelector(`.class-item[data-id="${id}"]`);
        if (element) {
            element.remove();
        }
        
        // Remove from calendar if scheduled
        const calendar = window.calendar;
        if (calendar) {
            const event = calendar.getEventById(id);
            if (event) {
                event.remove();
            }
        }
        
        // Check if we need to restore the empty state
        const classesList = document.getElementById('createdClasses');
        if (classesList && classesList.children.length === 0) {
            classesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <p>No classes created yet. Start by filling the form above.</p>
                </div>
            `;
        }
        
        showNotification('Class removed', 'info');
    }

    // Function to show clear confirmation modal
    function showClearConfirmation() {
        // Check if there are any classes to clear
        const classesList = document.getElementById('createdClasses');
        if (!classesList) return;
        
        const classItems = classesList.querySelectorAll('.class-item');
        
        if (classItems.length === 0) {
            showNotification('No classes to clear.', 'info');
            return;
        }
        
        // Show custom confirmation dialog
        const confirmMessage = document.getElementById('confirmMessage');
        if (confirmMessage) {
            confirmMessage.textContent = 'Are you sure you want to clear all classes? This will remove all classes from both the list and the calendar.';
        }
        
        // Set up the Yes button for this specific action
        const yesBtn = document.getElementById('confirmYesBtn');
        if (yesBtn) {
            yesBtn.onclick = function() {
                clearAllClasses(classesList, classItems);
                hideModal('confirmModal');
                showNotification('All classes have been cleared.', 'success');
            };
        }
        
        // Set up the No button
        const noBtn = document.getElementById('confirmNoBtn');
        if (noBtn) {
            noBtn.onclick = function() {
                hideModal('confirmModal');
            };
        }
        
        showModal('confirmModal');
    }

    // Function to clear all classes
    function clearAllClasses(classesList, classItems) {
        // Remove all class items from DOM
        classItems.forEach(item => item.remove());
        
        // Clear calendar if FullCalendar instance exists
        if (window.calendar && typeof window.calendar.removeAllEvents === 'function') {
            window.calendar.removeAllEvents();
        }
        
        // Reset allClasses array
        window.allClasses = [];
        allClasses = [];
        
        // Persist and update UI state
        if (typeof saveClassesToLocalStorage === 'function') {
            try { saveClassesToLocalStorage(); } catch (e) { console.warn('saveClassesToLocalStorage failed', e); }
        }
        if (typeof updateClassesCountBadge === 'function') {
            try { updateClassesCountBadge(); } catch (e) { console.warn('updateClassesCountBadge failed', e); }
        }
        
        // Reset room usage counts
        if (roomUsageCount && rooms) {
            rooms.forEach(room => {
                roomUsageCount[room.id] = 0;
            });
        }
        
        // Add empty state message back
        if (classesList && !classesList.querySelector('.empty-state')) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-calendar-plus"></i>
                <p>No classes created yet. Start by filling the form above.</p>
            `;
            classesList.appendChild(emptyState);
        }
    }
    
    // Function to generate schedule
    window.generateSchedule = async function() {
        // Check user role permissions
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.role || 'user';
        
        if (userRole === 'user') {
            showNotification('Access denied. Only admins and superadmins can generate schedules.', 'error');
            return;
        }
        
        if (allClasses.length === 0) {
            showNotification('Please add classes before generating a schedule', 'error');
            return;
        }
        
        // Ensure rooms are loaded before scheduling
        if (rooms.length === 0) {
            showNotification('Loading rooms...', 'info');
            await loadRooms();
            if (rooms.length === 0) {
                showNotification('No rooms available for scheduling. Please add rooms first.', 'error');
                return;
            }
        }
        
        // Clear existing schedule
        clearSchedule();
        
        // Show loading/progress indicator
        showModal('loadingModal');
        const progressBar = document.getElementById('scheduling-progress');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        
        const statusElement = document.getElementById('scheduling-status');
        if (statusElement) {
            statusElement.textContent = "Preparing schedule generation...";
        }
        
        // Use setTimeout to allow the UI to update before starting the heavy work
        setTimeout(function() {
            try {
                // Track progress
                let totalClasses = allClasses.length;
                let classesProcessed = 0;
                
                // Create a deep copy of classes to schedule
                const classesToSchedule = JSON.parse(JSON.stringify(allClasses));
                
                // Group classes by subject for same-time scheduling
                const classesBySubject = {};
                classesToSchedule.forEach(classItem => {
                    const subjectKey = classItem.subjectId || classItem.subject;
                    if (!classesBySubject[subjectKey]) {
                        classesBySubject[subjectKey] = [];
                    }
                    classesBySubject[subjectKey].push(classItem);
                });
                
                // Track scheduled times by subject
                const subjectScheduledTimes = {}; // subjectKey -> { day, time }
                
                // Shuffle to randomize placement order
                shuffleArray(classesToSchedule);
                
                let scheduledClasses = [];
                let unscheduledClasses = [];
                
                // Process each class
                for (const classItem of classesToSchedule) {
                    // Check if this class has both lecture and lab hours - if so, create two separate schedules
                    const hasLecture = classItem.lectureHours > 0;
                    const hasLab = classItem.labHours > 0;
                    
                    if (hasLecture && hasLab) {
                        // Create two separate class items for scheduling
                        const lectureClass = {
                            ...classItem,
                            id: classItem.id + '-lec',
                            unitLoad: classItem.lectureHours,
                            classType: 'lecture',
                            lectureHours: classItem.lectureHours,
                            labHours: 0
                        };
                        
                        const labClass = {
                            ...classItem,
                            id: classItem.id + '-lab',
                            unitLoad: classItem.labHours,
                            classType: 'laboratory',
                            lectureHours: 0,
                            labHours: classItem.labHours
                        };
                        
                        // Get subject key for same-time scheduling
                        const subjectKey = classItem.subjectId || classItem.subject;
                        const subjectScheduledTime = subjectScheduledTimes[subjectKey];
                        
                        // Schedule lecture first
                        classesProcessed++;
                        let progressPct = Math.floor((classesProcessed / totalClasses) * 100);
                        if (progressBar) {
                            progressBar.style.width = progressPct + '%';
                        }
                        if (statusElement) {
                            statusElement.textContent = `Scheduling lecture for ${classItem.subject} (${classesProcessed} of ${totalClasses})`;
                        }
                        
                        const lectureScheduled = scheduleClass(lectureClass, subjectScheduledTime);
                        if (lectureScheduled && lectureScheduled !== true && lectureScheduled.success) {
                            scheduledClasses.push(lectureClass);
                            // Store the scheduled time for the lab to use (same time, different day)
                            subjectScheduledTimes[subjectKey] = { 
                                day: lectureScheduled.day, 
                                time: lectureScheduled.time 
                            };
                            
                            // Schedule lab on a different day but same time
                            classesProcessed++;
                            progressPct = Math.floor((classesProcessed / totalClasses) * 100);
                            if (progressBar) {
                                progressBar.style.width = progressPct + '%';
                            }
                            if (statusElement) {
                                statusElement.textContent = `Scheduling lab for ${classItem.subject} (${classesProcessed} of ${totalClasses})`;
                            }
                            
                            // Schedule lab on a different day but same time
                            const labScheduled = scheduleClass(labClass, { 
                                time: lectureScheduled.time, 
                                excludeDay: lectureScheduled.day // Exclude the day lecture is on
                            });
                            
                            if (labScheduled && labScheduled !== true && labScheduled.success) {
                                scheduledClasses.push(labClass);
                            } else {
                                unscheduledClasses.push(labClass);
                            }
                        } else if (lectureScheduled === true) {
                            // Already scheduled
                            scheduledClasses.push(lectureClass);
                        } else {
                            unscheduledClasses.push(lectureClass);
                            unscheduledClasses.push(labClass);
                        }
                    } else {
                        // Regular class scheduling (only lecture OR only lab)
                        classesProcessed++;
                        let progressPct = Math.floor((classesProcessed / totalClasses) * 100);
                        if (progressBar) {
                            progressBar.style.width = progressPct + '%';
                        }
                        
                        if (statusElement) {
                            statusElement.textContent = `Scheduling class ${classesProcessed} of ${totalClasses}: ${classItem.subject}`;
                        }
                        
                        // Get subject key for same-time scheduling
                        const subjectKey = classItem.subjectId || classItem.subject;
                        const subjectScheduledTime = subjectScheduledTimes[subjectKey];
                        
                        // Try to schedule this class
                        const scheduled = scheduleClass(classItem, subjectScheduledTime);
                        if (scheduled) {
                            scheduledClasses.push(classItem);
                            
                            // If this is the first class for this subject, store the scheduled time
                            if (!subjectScheduledTimes[subjectKey] && scheduled !== true && scheduled.success) {
                                subjectScheduledTimes[subjectKey] = { 
                                    day: scheduled.day, 
                                    time: scheduled.time 
                                };
                            } else if (scheduled === true && !subjectScheduledTimes[subjectKey]) {
                                // Class was already scheduled, try to get its time from calendar
                                const calendar = window.calendar;
                                if (calendar) {
                                    const events = calendar.getEvents();
                                    const scheduledEvent = events.find(e => 
                                        e.extendedProps?.originalClassId === classItem.id
                                    );
                                    if (scheduledEvent && scheduledEvent.start) {
                                        const eventDate = new Date(scheduledEvent.start);
                                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                        const dayName = dayNames[eventDate.getDay()];
                                        const timeStr = eventDate.toTimeString().substring(0, 5);
                                        subjectScheduledTimes[subjectKey] = { day: dayName, time: timeStr };
                                    }
                                }
                            }
                        } else {
                            unscheduledClasses.push(classItem);
                        }
                    }
                }
                
                // Complete the progress bar
                if (progressBar) {
                    progressBar.style.width = '100%';
                }
                
                if (statusElement) {
                    statusElement.textContent = "Schedule generation complete!";
                }
                
                // Force save the schedule
                console.log('Force saving schedule after generation...');
                
                // Verify calendar is showing the week we generated events for
                // Don't change the view - events were generated for whatever week is displayed
                if (window.calendar) {
                    try {
                        const calendarDate = window.calendar.getDate();
                        console.log('Calendar is showing week starting from:', calendarDate.toDateString());
                        console.log('Events should appear on this week\'s timetable');
                    } catch (e) {
                        console.log('Could not get calendar view date');
                    }
                }
                
                // Save the schedule - events are already on the calendar
                setTimeout(() => {
                    window.isGeneratingSchedule = true;
                    
                    // Force calendar to refresh and show events
                    if (window.calendar) {
                        try {
                            // Get all events to verify they exist
                            const currentEvents = window.calendar.getEvents();
                            console.log(`Calendar has ${currentEvents.length} events before save`);
                            
                            if (currentEvents.length === 0) {
                                console.error('ERROR: No events found on calendar after generation!');
                            }
                            
                            // Force calendar to re-render to ensure events are visible
                            window.calendar.render();
                            
                            // Verify events again
                            const eventsAfterRender = window.calendar.getEvents();
                            console.log(`Calendar has ${eventsAfterRender.length} events after render`);
                            
                            // Log first few events for debugging
                            if (eventsAfterRender.length > 0) {
                                console.log('Sample events on calendar:', eventsAfterRender.slice(0, 3).map(e => ({
                                    title: e.title,
                                    start: e.start?.toISOString(),
                                    day: e.extendedProps?.dayOfWeek
                                })));
                            } else {
                                console.warn('WARNING: No events found on calendar after render!');
                            }
                        } catch (e) {
                            console.error('Error refreshing calendar:', e);
                        }
                    }
                    
                    // Save to server
                    saveScheduleToLocalStorage();
                    console.log('Schedule saved to server. Events should remain visible on timetable.');
                    
                    // Clear the flag after save completes
                    setTimeout(() => {
                        window.isGeneratingSchedule = false;
                    }, 2000);
                }, 500);
                
                // Close the modal and show results
                setTimeout(() => {
                    hideModal('loadingModal');
                    
                    if (unscheduledClasses.length > 0) {
                        showConflictsModal(unscheduledClasses);
                    } else {
                        showNotification('Schedule successfully generated!', 'success');
                    }
                }, 500);
                
            } catch (error) {
                console.error("Error generating schedule:", error);
                hideModal('loadingModal');
                showNotification('Error generating schedule: ' + error.message, 'error');
            }
        }, 300);
    };
    
    
    // Show conflicts modal
    function showConflictsModal(unscheduledClasses) {
        const conflictsList = document.getElementById('conflictsList');
        if (conflictsList) {
            conflictsList.innerHTML = '';
            
            unscheduledClasses.forEach(classItem => {
                const li = document.createElement('li');
                li.textContent = `${classItem.subject} (${classItem.course}, ${classItem.unitLoad} hrs, ${classItem.classType})`;
                conflictsList.appendChild(li);
            });
        }
        
        showModal('conflictsModal');
    }
    
    // Apply department colors to events after they're added to the DOM
    function applyDepartmentColorsToEvents() {
        const events = document.querySelectorAll('.fc-event');
        events.forEach(event => {
            const eventId = event.getAttribute('data-event-id');
            if (eventId) {
                // Try to get the event data from the calendar
                const calendar = window.calendar;
                if (calendar) {
                    const eventObj = calendar.getEventById(eventId);
                    if (eventObj && eventObj.extendedProps?.departmentColor) {
                        const color = eventObj.extendedProps.departmentColor;
                        event.style.backgroundColor = color;
                        event.style.borderColor = color;
                        event.style.opacity = '1';
                        // Also set inner content container to avoid theme overrides
                        const mainEl = event.querySelector('.fc-event-main');
                        if (mainEl) {
                            mainEl.style.backgroundColor = color;
                            mainEl.style.borderColor = color;
                        }
                        event.classList.add('department-colored-event');
                        console.log(`Applied department color ${color} to event ${eventId}`);
                    }
                }
            }
        });
    }

    // Set up observer to apply colors when new events are added
    function setupEventColorObserver() {
        const calendarContainer = document.querySelector('#calendar');
        if (calendarContainer) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && (node.classList?.contains('fc-event') || node.querySelector?.('.fc-event'))) {
                                setTimeout(applyDepartmentColorsToEvents, 50);
                            }
                        });
                    }
                });
            });
            
            observer.observe(calendarContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    // Get department color for a class based on its course/program
    function getDepartmentColorForClass(classItem) {
        // Get departments from global or localStorage
        const departments = (Array.isArray(window.departments) && window.departments.length)
            ? window.departments
            : JSON.parse(localStorage.getItem('departments') || '[]');
        
        console.log('Looking up color for classItem:', classItem);
        console.log('Available departments:', departments);
        
        if (!Array.isArray(departments) || departments.length === 0) {
            console.warn('No departments available for color lookup');
            return '#6b7280'; // Default gray
        }
        
        // 1) Try to match by department ID first (most accurate)
        if (classItem.departmentId) {
            const deptById = departments.find(dept => 
                dept.id && String(dept.id) === String(classItem.departmentId)
            );
            if (deptById?.color) {
                console.log('Found color by departmentId:', deptById.color, 'for dept:', deptById.code);
                return deptById.color;
            }
        }
        
        // 2) Try to match by department CODE (this is what's stored in classItem.department)
        const departmentCode = classItem.department || '';
        if (departmentCode) {
            const deptByCode = departments.find(dept => {
                const deptCode = String(dept.code || '').toLowerCase();
                const searchCode = String(departmentCode).toLowerCase();
                return deptCode === searchCode || deptCode === searchCode.trim();
            });
            if (deptByCode?.color) {
                console.log('Found color by department code:', deptByCode.color, 'for dept:', deptByCode.code);
                return deptByCode.color;
            }
        }
        
        // 3) Try to match by course value against department code
        const courseValue = classItem.course || classItem.courseId || '';
        if (courseValue) {
            const courseLc = String(courseValue).toLowerCase().trim();
            const deptByCourse = departments.find(dept => {
                const codeLc = String(dept.code || '').toLowerCase();
                const nameLc = String(dept.name || '').toLowerCase();
                return codeLc === courseLc || 
                       nameLc === courseLc ||
                       (codeLc && courseLc.includes(codeLc)) ||
                       (codeLc && codeLc.includes(courseLc));
            });
            if (deptByCourse?.color) {
                console.log('Found color by course match:', deptByCourse.color, 'for dept:', deptByCourse.code);
                return deptByCourse.color;
            }
        }
        
        // 4) Fallback to default colors (only if no department found)
        console.warn('No department color found, using default');
        const defaultColors = {
            'bsit': '#10b981',
            'it': '#10b981',
            'bsais': '#10b981',
            'ais': '#10b981',
            'bshm': '#f59e0b',
            'hm': '#f59e0b',
            'bstm': '#8b5cf6',
            'tm': '#8b5cf6',
            'default': '#6b7280'
        };
        const courseLc = String(courseValue).toLowerCase();
        for (const [key, color] of Object.entries(defaultColors)) {
            if (courseLc.includes(key)) {
                console.log('Using default color for:', key);
                return color;
            }
        }
        
        return defaultColors.default;
    }

    // Resolve department object for a given course/program
    function getDepartmentForCourse(courseOrClassItem) {
        // If it's a class item object, check for department field first
        if (typeof courseOrClassItem === 'object' && courseOrClassItem !== null) {
            // Check if classItem has departmentId or department field directly
            if (courseOrClassItem.departmentId) {
                const departments = JSON.parse(localStorage.getItem('departments') || '[]');
                const dept = departments.find(d => String(d.id) === String(courseOrClassItem.departmentId));
                if (dept) return dept;
            }
            if (courseOrClassItem.department) {
                const departments = JSON.parse(localStorage.getItem('departments') || '[]');
                const dept = departments.find(d => 
                    String(d.name).toLowerCase() === String(courseOrClassItem.department).toLowerCase() ||
                    String(d.code).toLowerCase() === String(courseOrClassItem.department).toLowerCase() ||
                    String(d.id) === String(courseOrClassItem.department)
                );
                if (dept) return dept;
            }
        }
        
        const course = typeof courseOrClassItem === 'string'
            ? courseOrClassItem
            : (courseOrClassItem.course || courseOrClassItem.courseId || '');
        const courseLc = String(course).toLowerCase().trim();
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');

        // exact id/code/name match
        let dept = departments.find(d => d.code === course || d.name === course || d.id === course);
        if (dept) return dept;
        // substring/alias match
        dept = departments.find(d => {
            const codeLc = (d.code || '').toLowerCase();
            const nameLc = (d.name || '').toLowerCase();
            return (
                (codeLc && (courseLc.includes(codeLc) || codeLc === courseLc)) ||
                (nameLc && (courseLc.includes(nameLc) || nameLc === courseLc))
            );
        });
        return dept || null;
    }

    // Schedule a single class
    function scheduleClass(classItem, subjectScheduledTime = null) {
        const calendar = window.calendar;
        if (!calendar) return false;
        
        // FIRST: Check if this class is already scheduled anywhere
        // This prevents creating multiple events for the same class
        const existingEvents = calendar.getEvents();
        const classAlreadyScheduled = existingEvents.some(existingEvent => {
            return existingEvent.extendedProps?.originalClassId === classItem.id;
        });
        
        if (classAlreadyScheduled) {
            console.log('Class already scheduled, skipping:', classItem.subject, '(ID:', classItem.id, ')');
            return true; // Return true since class is already scheduled
        }
        
        // Check if this is a strand - limit to 4 days per week (excluding Saturday)
        const isStrand = classItem.courseId && (() => {
            try {
                const courses = JSON.parse(localStorage.getItem('courses') || '[]');
                const strands = JSON.parse(localStorage.getItem('strands') || '[]');
                const allPrograms = [...courses, ...strands];
                const program = allPrograms.find(p => p.id === classItem.courseId || p.code === classItem.courseId);
                return program && program.type === 'strand';
            } catch (e) {
                return false;
            }
        })();
        
        // Get possible days - limit strands to 4 days (Mon-Fri, excluding Saturday)
        let possibleDays = [...days];
        if (isStrand) {
            // For strands, only use Monday-Friday (exclude Saturday)
            possibleDays = possibleDays.filter(d => d.id !== 'Saturday');
            // Randomly select 4 days from Mon-Fri
            shuffleArray(possibleDays);
            possibleDays = possibleDays.slice(0, 4);
        } else {
            // For programs, use all days
            shuffleArray(possibleDays);
        }
        
        // Exclude a specific day if provided (for lab scheduling on different day)
        if (subjectScheduledTime && subjectScheduledTime.excludeDay) {
            possibleDays = possibleDays.filter(d => d.id !== subjectScheduledTime.excludeDay);
        }
        
        // Get time slots - if subject already has a scheduled time, prioritize that time and day
        let possibleTimes = timeSlots.slice();
        let targetDay = null;
        let targetTime = null;
        let hasScheduledTime = false;
        
        if (subjectScheduledTime && subjectScheduledTime.time) {
            // Use the same time as the first scheduled class for this subject
            targetTime = subjectScheduledTime.time;
            hasScheduledTime = true;
            
            // If a specific day is provided and not excluded, prioritize it
            if (subjectScheduledTime.day && !subjectScheduledTime.excludeDay) {
                targetDay = possibleDays.find(d => d.id === subjectScheduledTime.day);
                if (targetDay) {
                    // Move target day to front
                    const dayIndex = possibleDays.indexOf(targetDay);
                    if (dayIndex > -1) {
                        possibleDays.splice(dayIndex, 1);
                        possibleDays.unshift(targetDay);
                    }
                }
            }
            
            // Move target time to front
            const timeIndex = possibleTimes.indexOf(targetTime);
            if (timeIndex > -1) {
                possibleTimes.splice(timeIndex, 1);
                possibleTimes.unshift(targetTime);
            }
        } else {
            shuffleArray(possibleTimes);
        }
        
        // Try each combination until we find a valid placement
        for (const day of possibleDays) {
            for (const startTime of possibleTimes) {
                // Calculate duration and end time
                const durationHours = classItem.unitLoad;
                const durationMinutes = durationHours * 60;
                const endTime = addMinutes(startTime, durationMinutes);
                
                // Skip if end time would be after 7:30 PM (19:30)
                const [endHour, endMin] = endTime.split(':').map(Number);
                if (endHour > 19 || (endHour === 19 && endMin > 30)) {
                    continue;
                }
                
                // Calculate the date for the specific day of the week BEFORE finding rooms
                // Use the CALENDAR's current view week (Monday-Saturday week being displayed)
                // The timetable shows Monday-Saturday, so we need Monday of that visible week
                let viewDate;
                try {
                    // Get the date of the week currently being displayed on the calendar
                    viewDate = calendar.getDate();
                } catch (e) {
                    // Fallback: use today, but if it's Sunday, move to Monday
                    viewDate = new Date();
                    if (viewDate.getDay() === 0) {
                        viewDate.setDate(viewDate.getDate() + 1); // Sunday -> Monday
                    }
                }
                
                // Normalize to noon to avoid timezone issues
                viewDate.setHours(12, 0, 0, 0);
                const currentDayOfWeek = viewDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                
                // Calculate Monday of the visible week (Monday-Saturday timetable)
                // If viewDate is Sunday (shouldn't happen), move to next Monday
                let daysToMonday;
                if (currentDayOfWeek === 0) {
                    // Sunday - move to Monday
                    viewDate.setDate(viewDate.getDate() + 1);
                    daysToMonday = 0;
                } else {
                    // Monday = 0 days back, Tuesday = 1 day back, etc.
                    daysToMonday = currentDayOfWeek - 1;
                }
                
                const mondayDate = new Date(viewDate);
                mondayDate.setDate(viewDate.getDate() - daysToMonday);
                mondayDate.setHours(0, 0, 0, 0); // Ensure we're at start of day
                
                // Debug log to verify calculation
                console.log(`Generating for ${day.id}: View date=${viewDate.toDateString()}, Monday of week=${mondayDate.toDateString()}`);
                
                // Map day name to day of week index (Monday = 0, Tuesday = 1, ..., Saturday = 5)
                const dayIndexMap = {
                    'Monday': 0,
                    'Tuesday': 1,
                    'Wednesday': 2,
                    'Thursday': 3,
                    'Friday': 4,
                    'Saturday': 5
                };
                const dayOffset = dayIndexMap[day.id] || 0;
                
                // Calculate the date for this specific day in the CURRENT week
                const targetDate = new Date(mondayDate);
                targetDate.setDate(mondayDate.getDate() + dayOffset);
                targetDate.setHours(0, 0, 0, 0); // Ensure we're at start of day
                
                // Format the date string (YYYY-MM-DD) - this will be the current week's date
                const year = targetDate.getFullYear();
                const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                const dayOfMonth = String(targetDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${dayOfMonth}`;
                
                console.log(`Generating event for ${day.id} on current week date: ${dateStr}`);
                
                // Find compatible AND available rooms for this time slot
                // Pass the date string for proper room occupancy checking
                let compatibleRooms = findCompatibleRooms(classItem, dateStr, startTime, endTime);
                
                // Sort rooms by usage count (less used rooms first)
                // But maintain priority rooms at the top if applicable
                if (classItem.course === 'BSIT' && classItem.classType === 'laboratory') {
                    // Split priority (CL1/CL2) and other rooms
                    const priorityRooms = compatibleRooms.filter(r => r.id === 'CL1' || r.id === 'CL2');
                    const otherRooms = compatibleRooms.filter(r => r.id !== 'CL1' && r.id !== 'CL2');
                    
                    // Sort priority rooms by usage
                    priorityRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                    // Sort other rooms by usage
                    otherRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                    
                    compatibleRooms = [...priorityRooms, ...otherRooms];
                } 
                else if (classItem.course === 'BSHM' && classItem.classType === 'laboratory') {
                    // Keep Kitchen and Dining at the top, sort the rest by usage
                    const kitchenRoom = compatibleRooms.find(r => r.id === 'KITCHEN');
                    const diningRoom = compatibleRooms.find(r => r.id === 'DINING');
                    const otherRooms = compatibleRooms.filter(r => 
                        r.id !== 'KITCHEN' && 
                        r.id !== 'DINING'
                    );
                    // Sort other rooms by usage
                    otherRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                    
                    // Reconstruct the array with priorities maintained
                    compatibleRooms = [
                        ...(kitchenRoom ? [kitchenRoom] : []), 
                        ...(diningRoom ? [diningRoom] : []), 
                        ...otherRooms
                    ];
                }
                else if (classItem.course === 'BSHM') {
                    // Keep Dining at the top, sort the rest by usage
                    const diningRoom = compatibleRooms.find(r => r.id === 'DINING');
                    const otherRooms = compatibleRooms.filter(r => 
                        r.id !== 'KITCHEN' && 
                        r.id !== 'DINING'
                    );
                    
                    // Sort other rooms by usage
                    otherRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                    
                    // Reconstruct the array with priority maintained
                    compatibleRooms = [...(diningRoom ? [diningRoom] : []), ...otherRooms];
                }
                else {
                    // For all other cases, just sort by usage
                    compatibleRooms.sort((a, b) => roomUsageCount[a.id] - roomUsageCount[b.id]);
                }
                
                for (const room of compatibleRooms) {
                    // dateStr is already calculated above before this loop
                    
                    // Get department color for this class
                    const departmentColor = getDepartmentColorForClass(classItem);
                    console.log(`Generated department color: ${departmentColor} for class: ${classItem.subject} (${classItem.course})`);
                    
                    // Create event data - for timeGridWeek, we use the actual date, not resourceId
                    const eventData = {
                        id: classItem.id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9), // Unique ID per instance
                        title: classItem.subject,
                        start: `${dateStr}T${startTime}:00`,
                        end: `${dateStr}T${endTime}:00`,
                        backgroundColor: departmentColor,
                        borderColor: departmentColor,
                        classNames: [
                            `${classItem.course.toLowerCase()}-event`,
                            `${classItem.classType}-type`,
                            'department-colored-event'
                        ],
                        extendedProps: {
                            originalClassId: classItem.id,
                            subject: classItem.subject,
                            course: classItem.course,
                            faculty: classItem.faculty,
                            unitLoad: classItem.unitLoad,
                            classType: classItem.classType,
                            room: room.name || room.title || room.id,
                            roomId: room.id,
                                department: classItem.department,
                                departmentId: classItem.departmentId,
                            dayOfWeek: day.id,
                            departmentColor: departmentColor
                        }
                    };
                        
                        // Check for conflicts (faculty, room/time, and room exclusivity)
                        if (!wouldCreateScheduleConflict(eventData)) {
                        // Double-check for duplicates right before adding (in case something changed)
                        const currentEvents = calendar.getEvents();
                        const isDuplicate = currentEvents.some(existingEvent => {
                            return existingEvent.extendedProps?.originalClassId === classItem.id;
                        });
                        
                        if (isDuplicate) {
                            console.log('Duplicate detected just before adding, skipping:', classItem.subject);
                            return true; // Class was scheduled while we were processing
                        }
                        
                        // No conflicts or duplicates - add the event to the calendar
                        // Event is already set to current week date, so it will appear on the current timetable
                        console.log('Adding event to calendar (current week):', {
                            title: eventData.title,
                            day: day.id,
                            date: dateStr,
                            time: `${startTime} - ${endTime}`
                        });
                        const addedEvent = calendar.addEvent(eventData);
                        console.log('Event added to calendar:', {
                            id: addedEvent.id,
                            title: addedEvent.title,
                            start: addedEvent.start?.toISOString(),
                            end: addedEvent.end?.toISOString(),
                            visible: addedEvent.isStart
                        });
                        
                        // Force calendar to render/update after adding event
                        try {
                            calendar.render();
                        } catch (e) {
                            // render() might not be needed, just ensure update
                            console.log('Calendar render attempted');
                        }
                        
                        // Apply department color after event is added
                        setTimeout(() => {
                            const eventElement = document.querySelector(`[data-event-id="${eventData.id}"]`);
                            if (eventElement) {
                                eventElement.style.backgroundColor = departmentColor;
                                eventElement.style.borderColor = departmentColor;
                                eventElement.style.opacity = '1';
                                const mainEl = eventElement.querySelector('.fc-event-main');
                                if (mainEl) {
                                    mainEl.style.backgroundColor = departmentColor;
                                    mainEl.style.borderColor = departmentColor;
                                }
                                console.log(`Applied department color ${departmentColor} to event element`);
                            }
                        }, 100);
                        roomUsageCount[room.id] += 1;  // Track room usage
                        
                        // Return success with scheduled time info for same-subject scheduling
                        return { 
                            success: true, 
                            day: day.id, 
                            time: startTime
                        };
                    }
                }
            }
        }
        
        // If we reach here, we couldn't place this class
        return false;
    }
    
    // Print schedule - simplified to only show the timetable
    // Export schedule to Excel file
    function printSchedule() {
        const calendar = window.calendar;
        if (!calendar) {
            showNotification('Calendar not initialized', 'error');
            return;
        }

        try {
            showNotification('Preparing Excel file...', 'info');
            
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            wb.Props = {
                Title: "Class Schedule",
                Subject: "Timetable",
                Author: "Automated Scheduling System",
                CreatedDate: new Date()
            };
            
            // Add a worksheet for the timetable
            wb.SheetNames.push("Schedule");
            
            // Create the header row (time slots)
            const timeSlots = [];
            for (let hour = 7; hour < 20; hour++) {
                const amPm = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour > 12 ? hour - 12 : hour;
                timeSlots.push(`${hour12}:00 ${amPm}`);
                timeSlots.push(`${hour12}:30 ${amPm}`);
            }
            
            // Prepare data structure for worksheet
            const wsData = [];
            
            // Add header row with time slots
            wsData.push(['Day/Time', ...timeSlots]);
            
            // Get all events from the calendar
            const events = calendar.getEvents();
            
            // Create a row for each day
            days.forEach(day => {
                const dayRow = [day.title]; // First cell is the day name
                
                // Fill the row with empty cells initially
                for (let i = 0; i < timeSlots.length; i++) {
                    dayRow.push('');
                }
                
                // Find events for this day and fill in the cells
                // For timeGridWeek, we need to find events that fall on this day of the week
                // Calculate the date for this day in the current week
                const today = new Date();
                const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
                const mondayDate = new Date(today);
                mondayDate.setDate(today.getDate() - daysToMonday);
                
                const dayIndexMap = {
                    'Monday': 0,
                    'Tuesday': 1,
                    'Wednesday': 2,
                    'Thursday': 3,
                    'Friday': 4,
                    'Saturday': 5
                };
                const dayOffset = dayIndexMap[day.id] || 0;
                const targetDate = new Date(mondayDate);
                targetDate.setDate(mondayDate.getDate() + dayOffset);
                
                const dayEvents = events.filter(event => {
                    if (!event.start) return false;
                    const eventDate = new Date(event.start);
                    return eventDate.getFullYear() === targetDate.getFullYear() &&
                           eventDate.getMonth() === targetDate.getMonth() &&
                           eventDate.getDate() === targetDate.getDate();
                });
                
                dayEvents.forEach(event => {
                    // Get event details
                    const startTime = event.start;
                    const endTime = event.end;
                    const subject = event.extendedProps.subject;
                    const course = event.extendedProps.course;
                    const faculty = event.extendedProps.faculty;
                    const room = event.extendedProps.room;
                    
                    // Calculate cell positions for this event
                    const startHour = startTime.getHours();
                    const startMinute = startTime.getMinutes();
                    const endHour = endTime.getHours();
                    const endMinute = endTime.getMinutes();
                    
                    // Calculate start and end column indices
                    const startColIndex = ((startHour - 7) * 2) + (startMinute === 30 ? 1 : 0) + 1; // +1 because column 0 is the day name
                    const endColIndex = ((endHour - 7) * 2) + (endMinute === 30 ? 1 : 0) + 1;
                    
                    // Fill in the cells for this event
                    for (let col = startColIndex; col < endColIndex; col++) {
                        if (col < dayRow.length) {
                            dayRow[col] = `${subject}\n${room}\n${faculty}`;
                        }
                    }
                });
                
                // Add the day row to the worksheet
                wsData.push(dayRow);
            });
            
            // Create the worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Set column widths
            const colWidth = { wch: 18 }; // Width for time slot columns
            const dayColWidth = { wch: 10 }; // Width for day name column
            
            ws['!cols'] = [dayColWidth];
            for (let i = 0; i < timeSlots.length; i++) {
                ws['!cols'].push(colWidth);
            }
            
            // Style and formatting
            // Excel doesn't support as much styling through SheetJS, but we can set some properties
            // Each cell is formatted as text to preserve line breaks
            for (let r = 1; r < wsData.length; r++) {
                for (let c = 1; c < wsData[r].length; c++) {
                    const cell_ref = XLSX.utils.encode_cell({r: r, c: c});
                    if (!ws[cell_ref]) continue;
                    
                    // Format cells with content
                    if (ws[cell_ref].v !== '') {
                        ws[cell_ref].s = {
                            alignment: { wrapText: true, vertical: 'center', horizontal: 'center' },
                            font: { bold: true }
                        };
                    }
                }
            }
            
            // Add the worksheet to the workbook
            wb.Sheets["Schedule"] = ws;
            
            // Convert the workbook to a binary string
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
            
            // Convert binary string to ArrayBuffer
            function s2ab(s) {
                const buf = new ArrayBuffer(s.length);
                const view = new Uint8Array(buf);
                for (let i = 0; i < s.length; i++) {
                    view[i] = s.charCodeAt(i) & 0xFF;
                }
                return buf;
            }
            
            // Create a Blob from the ArrayBuffer
            const blob = new Blob([s2ab(wbout)], { type: 'application/octet-stream' });
            
            // Create a download link and trigger the download
            const fileName = `class_schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
            
            if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                // For IE
                window.navigator.msSaveOrOpenBlob(blob, fileName);
            } else {
                // For other browsers
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                document.body.appendChild(a);
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
            
            showNotification('Schedule exported to Excel successfully!', 'success');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showNotification('Error exporting schedule to Excel: ' + error.message, 'error');
        }
    }
    
    // Check if an event has conflicts
    function hasConflict(event) {
        const calendar = window.calendar;
        if (!calendar) return false;
        
        const allEvents = calendar.getEvents();
        const eventDate = event.start ? new Date(event.start) : null;
        if (!eventDate) return false;
        
        for (let otherEvent of allEvents) {
            // Skip comparing with itself
            if (otherEvent.id === event.id) continue;
            
            // Check if same date
            const otherEventDate = otherEvent.start ? new Date(otherEvent.start) : null;
            if (!otherEventDate) continue;
            
            const sameDate = eventDate.getFullYear() === otherEventDate.getFullYear() &&
                           eventDate.getMonth() === otherEventDate.getMonth() &&
                           eventDate.getDate() === otherEventDate.getDate();
            
            if (sameDate && datesOverlap(otherEvent.start, otherEvent.end, event.start, event.end)) {
                // Check if same room (which would be a conflict)
                if (otherEvent.extendedProps.roomId === event.extendedProps.roomId) {
                    return true; // Room conflict found
                }
                
                // Check for faculty conflicts (same faculty teaching two classes at once)
                if (otherEvent.extendedProps.faculty === event.extendedProps.faculty) {
                    return true; // Faculty conflict found
                }
            }
        }
        
        return false; // No conflicts found
    }
    
    function datesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }
    
    // Check for faculty conflicts
    function wouldCreateFacultyConflict(newEventData, eventDateStr) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume conflict if no calendar
        
        const existingEvents = calendar.getEvents();
        const newFaculty = newEventData.extendedProps?.faculty;
        
        if (!newFaculty) return false; // No faculty specified, no conflict
        
        // Parse the date from the event start string
        const newEventDate = newEventData.start ? new Date(newEventData.start) : null;
        if (!newEventDate) return false;
        
        // Get time from start/end strings
        const newStartTime = newEventData.start ? newEventData.start.slice(-8, -3) : null;
        const newEndTime = newEventData.end ? newEventData.end.slice(-8, -3) : null;
        
        if (!newStartTime || !newEndTime) return false;
        
        const newStart = convertTimeToMinutes(newStartTime);
        const newEnd = convertTimeToMinutes(newEndTime);
        
        for (const event of existingEvents) {
            // Skip comparing with itself
            if (event.id === newEventData.id) continue;
            
            // Check if events are on the same date
            const existingEventDate = event.start ? new Date(event.start) : null;
            if (!existingEventDate) continue;
            
            // Compare dates (year, month, day only - ignore time)
            const sameDate = newEventDate.getFullYear() === existingEventDate.getFullYear() &&
                           newEventDate.getMonth() === existingEventDate.getMonth() &&
                           newEventDate.getDate() === existingEventDate.getDate();
            
            if (sameDate) {
                // Get event times and convert to minutes for comparison
                const existingStart = event.start ? convertTimeToMinutes(event.start.toTimeString().substring(0, 5)) : 0;
                const existingEnd = event.end ? convertTimeToMinutes(event.end.toTimeString().substring(0, 5)) : 0;
                
                // Check for time overlap
                if (newStart < existingEnd && existingStart < newEnd) {
                    // Check for faculty conflicts
                    const existingFaculty = event.extendedProps?.faculty;
                    if (existingFaculty && existingFaculty === newFaculty) {
                        console.log(`Faculty conflict detected: ${newFaculty} has overlapping classes at ${newStartTime}-${newEndTime}`);
                        return true; // Same faculty teaching two classes at once
                    }
                }
            }
        }
        
        return false; // No faculty conflicts found
    }
    
    // Helper function to convert HH:MM time to minutes for easier comparison
    function convertTimeToMinutes(timeString) {
        if (!timeString) return 0;
        
        // Handle different time formats
        let hours, minutes;
        
        if (typeof timeString === 'string') {
            // If it's just a time string like "14:30"
            [hours, minutes] = timeString.split(':').map(Number);
        } else if (timeString instanceof Date) {
            // If it's a Date object
            hours = timeString.getHours();
            minutes = timeString.getMinutes();
        } else {
            // Default case
            return 0;
        }
        
        return (hours * 60) + minutes;
    }
    
    // Generate time slots for scheduling (7:00 AM to 10:00 PM in 30-min increments)
    function generateTimeSlots() {
        const slots = [];
        let currentHour = 7;
        let currentMinute = 0;
        
        // Generate slots from 7:00 AM to 7:30 PM (19:30) in 15-minute increments
        while (currentHour < 19 || (currentHour === 19 && currentMinute <= 30)) {
            const hourString = currentHour.toString().padStart(2, '0');
            const minuteString = currentMinute.toString().padStart(2, '0');
            slots.push(`${hourString}:${minuteString}`);
            
            // Advance by 15 minutes
            currentMinute += 15;
            if (currentMinute >= 60) {
                currentHour++;
                currentMinute = 0;
            }
        }
        
        return slots;
    }
    
    // Add minutes to a time string (HH:MM format)
    function addMinutes(timeString, minutes) {
        const [hours, mins] = timeString.split(':').map(Number);
        let totalMinutes = (hours * 60) + mins + minutes;
        
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }
    
    // Clear schedule
    function clearSchedule() {
        const calendar = window.calendar;
        if (calendar) {
            // Clear all events from calendar
            if (typeof calendar.removeAllEvents === 'function') {
                calendar.removeAllEvents();
            } else if (typeof calendar.getEvents === 'function') {
                calendar.getEvents().forEach(event => event.remove());
            }
            console.log('Schedule cleared - calendar events removed');
        }
    }
    
    // Modal functions
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            // Prevent background scrolling when modal is open
            document.body.style.overflow = 'hidden';
        }
    }
    
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            // Restore scrolling when modal is closed
            document.body.style.overflow = '';
        }
    }
    
    // Show notification
    function showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.className = `notification ${type}`;
        
        const notificationMsg = document.getElementById('notificationMessage');
        if (notificationMsg) {
            notificationMsg.textContent = message;
        }
        
        notification.style.display = 'flex';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
    
    // Show event details
    function showEventDetails(event) {
        const modalSubject = document.getElementById('modalSubject');
        const modalCourse = document.getElementById('modalCourse');
        const modalFaculty = document.getElementById('modalFaculty');
        const modalRoom = document.getElementById('modalRoom');
        const modalDuration = document.getElementById('modalDuration');
        const modalType = document.getElementById('modalType');
        
        if (modalSubject) modalSubject.textContent = event.extendedProps.subject;
        if (modalCourse) modalCourse.textContent = event.extendedProps.course;
        if (modalFaculty) modalFaculty.textContent = event.extendedProps.faculty;
        if (modalRoom) modalRoom.textContent = event.extendedProps.room || "Not assigned";
        
        // Calculate actual duration from event start and end times
        const startTime = event.start;
        const endTime = event.end;
        const durationMs = endTime - startTime;
        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);
        
        if (modalDuration) modalDuration.textContent = durationHours + ' hours';
        if (modalType) modalType.textContent = event.extendedProps.classType;
        
        // Add room selection dropdown
        const roomSelect = document.getElementById('modalRoomSelect');
        if (roomSelect) {
            roomSelect.innerHTML = '';
            
            // Get compatible rooms for this class
            const classItem = {
                course: event.extendedProps.course,
                classType: event.extendedProps.classType
            };
            
            // Get the date string from the event
            const eventDate = event.start ? new Date(event.start) : null;
            const eventDateStr = eventDate ? 
                `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}` : 
                null;
            const startTime2 = event.start.toTimeString().substring(0, 5);
            const endTime2 = event.end.toTimeString().substring(0, 5);
            
            const compatibleRooms = findCompatibleRooms(classItem, eventDateStr, startTime2, endTime2);
            
            // Create options for each room
            compatibleRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = room.title;
                
                // Check if room is occupied (except by this event)
                const isOccupied = isRoomOccupiedExcept(
                    room.id, 
                    eventDateStr, 
                    startTime2, 
                    endTime2, 
                    event.id
                );
                
                if (isOccupied) {
                    option.disabled = true;
                    option.textContent += ' (Occupied)';
                }
                
                // Select the current room
                if (room.id === event.extendedProps.roomId) {
                    option.selected = true;
                }
                
                roomSelect.appendChild(option);
            });
        }
        
        // Show the room select in the modal
        const modalRoomSelectContainer = document.getElementById('modalRoomSelectContainer');
        if (modalRoomSelectContainer) {
            modalRoomSelectContainer.style.display = 'block';
        }
        
        // Store the event ID for deletion and room change
        const deleteEventBtn = document.getElementById('deleteEventBtn');
        const changeRoomBtn = document.getElementById('changeRoomBtn');
        
        // Only show delete button for superadmin users
        if (deleteEventBtn) {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userRole = userData.role || 'user';
            const isSuperAdmin = userRole === 'superadmin';
            
            if (!isSuperAdmin) {
                deleteEventBtn.style.display = 'none';
            } else {
                deleteEventBtn.style.display = '';
                deleteEventBtn.setAttribute('data-event-id', event.id);
            }
        }
        
        if (changeRoomBtn) changeRoomBtn.setAttribute('data-event-id', event.id);
        
        showModal('eventModal');
    }

    // Helper function to check if a room is occupied (except by a specific event)
    function isRoomOccupiedExcept(roomId, dayIdOrDate, startTime, endTime, exceptEventId) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume occupied if no calendar
        
        const existingEvents = calendar.getEvents();
        const start = convertTimeToMinutes(startTime);
        const end = convertTimeToMinutes(endTime);
        
        // Parse target date if it's a date string
        let targetDate = null;
        if (dayIdOrDate && dayIdOrDate.includes('-')) {
            targetDate = new Date(dayIdOrDate + 'T00:00:00');
        }
        
        for (const event of existingEvents) {
            // Skip the excluded event
            if (event.id === exceptEventId) continue;
            
            // Check if events are on the same date
            if (targetDate && event.start) {
                const eventDate = new Date(event.start);
                const sameDate = targetDate.getFullYear() === eventDate.getFullYear() &&
                               targetDate.getMonth() === eventDate.getMonth() &&
                               targetDate.getDate() === eventDate.getDate();
                
                if (sameDate) {
                    // Check if this event uses the room we're checking
                    if (event.extendedProps.roomId === roomId) {
                        // Get event times and convert to minutes for comparison
                        const eventStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                        const eventEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                        
                        // Check for overlap
                        if (start < eventEnd && eventStart < end) {
                            return true; // Room is occupied during this time
                        }
                    }
                }
            } else {
                // Fallback: check by day name (for backward compatibility)
                const eventDayName = event.extendedProps?.dayOfWeek;
                if (eventDayName === dayIdOrDate) {
                    if (event.extendedProps.roomId === roomId) {
                        const eventStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                        const eventEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                        if (start < eventEnd && eventStart < end) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false; // Room is available
    }
    
    // Find compatible rooms based on class type and course
    function findCompatibleRooms(classItem, dayIdOrDate, startTime, endTime) {
        // Use the most up-to-date rooms list (from window.rooms or local rooms variable)
        const currentRooms = (window.rooms && Array.isArray(window.rooms) && window.rooms.length > 0) 
            ? window.rooms 
            : (rooms && rooms.length > 0 ? rooms : []);
        
        if (currentRooms.length === 0) {
            console.warn('No rooms available for scheduling');
            return [];
        }
        
        let compatibleRooms = [];
        
        // Apply specific rules based on course and class type
        // For now, use all available rooms for any class type
        // This ensures scheduling works even if specific room IDs don't exist
        compatibleRooms = [...currentRooms];
        
        // Try to apply specific room preferences if they exist
        if (classItem.course === 'BSIT' && classItem.classType === 'laboratory') {
            // BSIT lab classes - prefer rooms with 'CL' in name or ID
            const priorityRooms = currentRooms.filter(r => 
                r.id && (r.id.includes('CL') || (r.name && (r.name.includes('CL') || r.name.includes('Computer') || r.name.includes('Lab'))))
            );
            const otherRooms = currentRooms.filter(r => 
                !priorityRooms.includes(r)
            );
            if (priorityRooms.length > 0) {
                shuffleArray(otherRooms);
                compatibleRooms = [...priorityRooms, ...otherRooms];
            }
        } 
        else if (classItem.course === 'BSHM' && classItem.classType === 'laboratory') {
            // BSHM lab classes - prefer rooms with 'KITCHEN' or 'DINING' in name
            const kitchenRoom = currentRooms.find(r => 
                (r.id && r.id.includes('KITCHEN')) || (r.name && (r.name.includes('Kitchen') || r.name.includes('kitchen')))
            );
            const diningRoom = currentRooms.find(r => 
                (r.id && r.id.includes('DINING')) || (r.name && (r.name.includes('Dining') || r.name.includes('dining')))
            );
            const otherRooms = currentRooms.filter(r => 
                r !== kitchenRoom && r !== diningRoom
            );
            
            const priorityRooms = [kitchenRoom, diningRoom].filter(Boolean);
            if (priorityRooms.length > 0) {
                shuffleArray(otherRooms);
                compatibleRooms = [...priorityRooms, ...otherRooms];
            }
        }
        else {
            // Other courses can use any room
            // If no specific room rules match, use all available rooms
            compatibleRooms = [...currentRooms];
            // Randomize rooms for better distribution
            shuffleArray(compatibleRooms);
        }

        // Enforce department-aware room availability/prioritization
        const dept = getDepartmentForCourse(classItem);
        const deptId = dept ? dept.id : null;
        const deptName = dept ? dept.name : null;
        const deptCode = dept ? dept.code : null;

        // Helper function to check if two departments match (by ID, name, or code)
        const sameDepartment = (roomDeptId, roomDeptName, classDeptId, classDeptName, classDeptCode) => {
            // Match by ID first
            if (roomDeptId && classDeptId && String(roomDeptId) === String(classDeptId)) return true;
            // Match by name
            if (roomDeptName && classDeptName && String(roomDeptName).toLowerCase() === String(classDeptName).toLowerCase()) return true;
            // Match by code
            if (roomDeptName && classDeptCode && String(roomDeptName).toLowerCase() === String(classDeptCode).toLowerCase()) return true;
            return false;
        };

        // 1) Exclude rooms that are exclusive to a different department
        // IMPORTANT: If a room is marked as exclusive, it can ONLY be used by the department it's assigned to
        const beforeFilterCount = compatibleRooms.length;
        compatibleRooms = compatibleRooms.filter(r => {
            // If room is not exclusive, it's available to all departments
            if (!r.exclusive) return true;
            
            // If room is exclusive but no department assigned, it's not available (shouldn't happen, but safety check)
            if (!r.departmentId && !r.department) {
                console.log(`[Room Filter] Excluding exclusive room "${r.name || r.id}" - no department assigned`);
                return false;
            }
            
            // If class has no department, exclude exclusive rooms
            if (!deptId && !deptName && !deptCode) {
                console.log(`[Room Filter] Excluding exclusive room "${r.name || r.id}" - class has no department`);
                return false;
            }
            
            // Room is exclusive - only allow if it matches the class's department
            const matches = sameDepartment(r.departmentId, r.department, deptId, deptName, deptCode);
            if (!matches) {
                console.log(`[Room Filter] Excluding exclusive room "${r.name || r.id}" (dept: ${r.department || r.departmentId}) - class is for department: ${deptName || deptCode || deptId}`);
            }
            return matches;
        });
        
        const afterFilterCount = compatibleRooms.length;
        if (beforeFilterCount !== afterFilterCount) {
            console.log(`[Room Filter] Filtered ${beforeFilterCount - afterFilterCount} exclusive rooms. ${afterFilterCount} rooms remaining for class "${classItem.subject}" (dept: ${deptName || deptCode || deptId})`);
        }

        // 2) Prefer rooms of the matching department (priority rooms first), but keep shared rooms available
        compatibleRooms.sort((a, b) => {
            const aMatch = (deptId && a.departmentId === deptId) ? 1 : 0;
            const bMatch = (deptId && b.departmentId === deptId) ? 1 : 0;
            // Put matches first
            if (aMatch !== bMatch) return bMatch - aMatch;
            // Among matches, prioritize exclusive/priority
            const aWeight = (a.priority ? 1 : 0) + (a.exclusive ? 1 : 0);
            const bWeight = (b.priority ? 1 : 0) + (b.exclusive ? 1 : 0);
            return bWeight - aWeight;
        });
        
        // If day/date, start and end time are provided, filter out rooms that are already occupied
        if (dayIdOrDate && startTime && endTime) {
            return compatibleRooms.filter(room => !isRoomOccupied(room.id, dayIdOrDate, startTime, endTime));
        }
        
        return compatibleRooms;
    }

    // Helper function to check if a room is occupied at a specific time
    function isRoomOccupied(roomId, dayIdOrDate, startTime, endTime) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume occupied if no calendar
        
        const existingEvents = calendar.getEvents();
        const start = convertTimeToMinutes(startTime);
        const end = convertTimeToMinutes(endTime);
        
        // dayIdOrDate can be either a day name (for compatibility) or a date string
        // For timeGridWeek, we'll check by date
        let targetDate = null;
        if (dayIdOrDate && dayIdOrDate.includes('-')) {
            // It's a date string (YYYY-MM-DD)
            targetDate = new Date(dayIdOrDate + 'T00:00:00');
        }
        
        for (const event of existingEvents) {
            // Check if events are on the same date
            if (targetDate && event.start) {
                const eventDate = new Date(event.start);
                const sameDate = targetDate.getFullYear() === eventDate.getFullYear() &&
                               targetDate.getMonth() === eventDate.getMonth() &&
                               targetDate.getDate() === eventDate.getDate();
                
                if (sameDate) {
                    // Check if this event uses the room we're checking
                    if (event.extendedProps.roomId === roomId) {
                        // Get event times and convert to minutes for comparison
                        const eventStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                        const eventEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                        
                        // Check for overlap
                        if (start < eventEnd && eventStart < end) {
                            return true; // Room is occupied during this time
                        }
                    }
                }
            } else {
                // Fallback: check by day name (for backward compatibility)
                const eventDayName = event.extendedProps?.dayOfWeek;
                if (eventDayName === dayIdOrDate) {
                    if (event.extendedProps.roomId === roomId) {
                        const eventStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                        const eventEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                        if (start < eventEnd && eventStart < end) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false; // Room is available
    }
    
    // Shuffle arrays for randomization
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
      // Set up event handlers for modal controls and buttons
    document.querySelectorAll('.close-modal').forEach(button => {
        if (button) {
            button.addEventListener('click', function() {
                const modal = button.closest('.modal');
                if (modal) modal.style.display = 'none';
                // Restore scrolling when modal is closed
                document.body.style.overflow = '';
            });
        }
    });
    
    // Preventing modals from closing when clicking outside
    // We don't want to add any click handler here that would close the modal
      const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            hideModal('eventModal');
        });
    }
    
    const changeRoomBtn = document.getElementById('changeRoomBtn');
    if (changeRoomBtn) {
        changeRoomBtn.addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            const calendar = window.calendar;
            if (!calendar) return;
            
            const event = calendar.getEventById(eventId);
            
            if (event) {
                // Get the selected room
                const roomSelect = document.getElementById('modalRoomSelect');
                const newRoomId = roomSelect.value;
                const newRoomTitle = roomSelect.options[roomSelect.selectedIndex].textContent.replace(' (Occupied)', '');
                
                // Update the event with the new room
                event.setExtendedProp('roomId', newRoomId);
                event.setExtendedProp('room', newRoomTitle);
                
                // Update the room display in the modal
                const modalRoom = document.getElementById('modalRoom');
                if (modalRoom) modalRoom.textContent = newRoomTitle;
                
                // Force a re-render
                event.setProp('title', event.extendedProps.subject);
                
                showNotification('Room changed successfully!', 'success');
            }
        });
    }
    
    const deleteEventBtn = document.getElementById('deleteEventBtn');
    if (deleteEventBtn) {
        deleteEventBtn.addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            const calendar = window.calendar;
            if (!calendar) return;
            
            const event = calendar.getEventById(eventId);
            
            if (event) {
                event.remove();
                showNotification('Schedule removed successfully!', 'success');
            }
            
            hideModal('eventModal');
        });
    }

    // Apply event filters based on selected courses
    function applyEventFilters() {
        // Get all checked course checkboxes
        const checked = Array.from(document.querySelectorAll('.course-filter-checkbox:checked'))
            .map(cb => cb.value.toLowerCase());
        
        // Get all events from calendar
        const calendar = window.calendar;
        if (!calendar) return;
        
        const events = calendar.getEvents();
        
        // Loop through events and show/hide based on course
        events.forEach(event => {
            const eventCourse = event.extendedProps.course.toLowerCase();
            if (checked.includes(eventCourse)) {
                event.setProp('display', 'auto'); // Show the event
            } else {
                event.setProp('display', 'none'); // Hide the event
            }
        });
    }
    
    // Set up course filter checkboxes
    document.querySelectorAll('.course-filter-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            applyEventFilters();
        });
    });
    
    // Show all courses button
    const showAllBtn = document.getElementById('showAllBtn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', function() {
            // Check all checkboxes
            document.querySelectorAll('.course-filter-checkbox').forEach(cb => {
                cb.checked = true;
            });
            
            // Apply filters to show all events
            applyEventFilters();
        });
    }

    // Variable to store departments
    let departments = [
        { code: 'BSIT', name: 'BS Information Technology' },
        { code: 'BSAIS', name: 'BS Accounting Information Systems' },
        { code: 'BSHM', name: 'BS Hospitality Management' },
        { code: 'BSTM', name: 'BS Tourism Management' }
    ];
    
    // Variable to store strands/courses 
    let strands = [];
    
    // Load departments and strands from localStorage if they exist
    if (localStorage.getItem('departments')) {
        try {
            departments = JSON.parse(localStorage.getItem('departments'));
            console.log('Loaded departments:', departments.length);
            
            // Update department options in select elements
            updateDepartmentSelectOptions();
        } catch (e) {
            console.error('Error loading departments from localStorage:', e);
        }
    }
    
    if (localStorage.getItem('strands')) {
        try {
            strands = JSON.parse(localStorage.getItem('strands'));
            console.log('Loaded strands/courses:', strands.length);
        } catch (e) {
            console.error('Error loading strands from localStorage:', e);
        }
    }
    // Ensure we have department colors from the server if missing locally
    (async function ensureDepartmentsFromServer() {
        try {
            const hasColors = Array.isArray(departments) && departments.some(d => d && d.color);
            if (!Array.isArray(departments) || departments.length === 0 || !hasColors) {
                const resp = await fetch('/api/departments', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                if (resp.ok) {
                    const serverDepts = await resp.json();
                    if (Array.isArray(serverDepts) && serverDepts.length) {
                        departments = serverDepts;
                        window.departments = departments;
                        try { localStorage.setItem('departments', JSON.stringify(departments)); } catch (_) {}
                        updateDepartmentSelectOptions();
                        console.log('Refreshed departments from server:', departments.length);
                    }
                }
            }
        } catch (e) {
            console.warn('Could not refresh departments from server', e);
        }
    })();

    // Department management moved to superadmin.html
    const addDepartmentLink = document.getElementById('addDepartmentLink');
    const manageDepartmentLink = document.getElementById('manageDepartmentLink');
    
    // Hide department management links - management moved to superadmin dashboard
    if (addDepartmentLink) {
        addDepartmentLink.style.display = 'none';
    }
    
    // Manage departments link handler - hidden as management moved to superadmin
    if (manageDepartmentLink) {
        manageDepartmentLink.style.display = 'none';
    }
    
    // Save department button handler - DISABLED to prevent conflicts with superadmin
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');
    if (saveDepartmentBtn) {
        // Remove any existing event listeners
        saveDepartmentBtn.replaceWith(saveDepartmentBtn.cloneNode(true));
        // Don't add new event listener to prevent conflicts
        console.log('Department button handler disabled to prevent conflicts');
    }
    
    // Cancel department button handler - DISABLED to prevent conflicts
    const cancelDepartmentBtn = document.getElementById('cancelDepartmentBtn');
    if (cancelDepartmentBtn) {
        // Remove any existing event listeners
        cancelDepartmentBtn.replaceWith(cancelDepartmentBtn.cloneNode(true));
        console.log('Cancel department button handler disabled to prevent conflicts');
    }
    
    // Function to populate the departments list in the manage departments modal
    function populateDepartmentsList() {
        const departmentsList = document.getElementById('departmentsList');
        if (!departmentsList) return;
        
        // Clear the list
        departmentsList.innerHTML = '';
        
        if (departments.length === 0) {
            // Show a message if there are no departments
            departmentsList.innerHTML = '<div class="no-departments">No departments added yet.</div>';
            return;
        }
        
        // Create a list for the departments
        const list = document.createElement('ul');
        list.className = 'departments-list';
        
        // Add departments to the list
        departments.forEach(department => {
            const listItem = document.createElement('li');
            listItem.className = 'department-item';
            
            // Create the department name element
            const nameEl = document.createElement('span');
            nameEl.className = 'department-name';
            nameEl.textContent = `${department.code} - ${department.name}`;
            
            // Create the remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-department-btn';
            removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
            removeBtn.dataset.code = department.code;
            
            // Add event listener to the remove button
            removeBtn.addEventListener('click', function() {
                removeDepartment(department.code);
            });
            
            // Add elements to the list item
            listItem.appendChild(nameEl);
            listItem.appendChild(removeBtn);
            
            // Add the list item to the list
            list.appendChild(listItem);
        });
        
        // Add the list to the departments list container
        departmentsList.appendChild(list);
    }
    
    // Function to remove a department
    function removeDepartment(code) {
        // Find the department
        const department = departments.find(d => d.code === code);
        if (!department) return;
        
        // Check if there are subjects or faculty members in this department
        const departmentHasSubjects = subjectsByDepartment[code] && subjectsByDepartment[code].length > 0;
        const departmentHasFaculty = facultyMembers.some(f => f.department === code);
        
        if (departmentHasSubjects || departmentHasFaculty) {
            showNotification(`Cannot remove department "${code}" because it has subjects or faculty members assigned to it.`, 'error');
            return;
        }
        
        // Show custom confirmation dialog
        const confirmMessage = document.getElementById('confirmMessage');
        if (confirmMessage) {
            confirmMessage.textContent = `Are you sure you want to remove department "${code}"?`;
        }
        
        // Set up the Yes button for this specific action
        const yesBtn = document.getElementById('confirmYesBtn');
        if (yesBtn) {
            yesBtn.textContent = 'Yes, Remove';
            yesBtn.onclick = function() {
                // Remove from the array
                departments = departments.filter(d => d.code !== code);
                
                // Save to localStorage
                try {
                    localStorage.setItem('departments', JSON.stringify(departments));
                } catch (e) {
                    console.error('Error saving departments to localStorage:', e);
                }
                
                // Update the departments list
                populateDepartmentsList();
                
                // Update department dropdowns
                updateDepartmentSelectOptions();
                
                // Hide confirm modal
                hideModal('confirmModal');
                
                // Show notification
                showNotification(`Department ${code} has been removed.`, 'success');
            };
        }
        
        // Set up the No button
        const noBtn = document.getElementById('confirmNoBtn');
        if (noBtn) {
            noBtn.textContent = 'Cancel';
            noBtn.onclick = function() {
                hideModal('confirmModal');
            };
        }
        
        showModal('confirmModal');
    }
    
    // Function to update all department select options
    function updateDepartmentSelectOptions() {
        // Update department select in the main form
        if (departmentSelect) {
            const currentValue = departmentSelect.value;
            
            departmentSelect.innerHTML = '<option value="" selected disabled>Select Department</option>';
            
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.code;
                option.textContent = dept.code;
                departmentSelect.appendChild(option);
            });
            
            // Try to restore previous selection
            if (currentValue && departments.some(d => d.code === currentValue)) {
                departmentSelect.value = currentValue;
            }
        }
        
        // Update department select in the add faculty form
        const facultyDepartmentSelect = document.getElementById('facultyDepartment');
        if (facultyDepartmentSelect) {
            const currentValue = facultyDepartmentSelect.value;
            
            facultyDepartmentSelect.innerHTML = '<option value="" selected disabled>Select Department</option>';
            
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.code;
                option.textContent = dept.code;
                facultyDepartmentSelect.appendChild(option);
            });
            
            // Try to restore previous selection
            if (currentValue && departments.some(d => d.code === currentValue)) {
                facultyDepartmentSelect.value = currentValue;
            }
        }
        
        // Update department select in the add subject form
        const subjectDepartmentSelect = document.getElementById('subjectDepartment');
        if (subjectDepartmentSelect) {
            subjectDepartmentSelect.innerHTML = '<option value="" selected disabled>Select Department</option>';
            
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.code;
                option.textContent = dept.code;
                subjectDepartmentSelect.appendChild(option);
            });
        }
    }    // Subject management moved to superadmin.html
    // No need to create/add subject management links as they're now in superadmin dashboard
    
    const saveSubjectBtn = document.getElementById('saveSubjectBtn');
    const cancelSubjectBtn = document.getElementById('cancelSubjectBtn');
      // Subject management event handlers removed - moved to superadmin dashboard
    
    // Save subject button handler
    if (saveSubjectBtn) {
        saveSubjectBtn.addEventListener('click', function() {
            const subjectCodeField = document.getElementById('subjectCode');
            const subjectNameField = document.getElementById('subjectName');
            const subjectDeptField = document.getElementById('subjectDepartment');
            
            // Basic validation
            if (!subjectCodeField || !subjectCodeField.value.trim()) {
                subjectCodeField.parentElement.classList.add('error');
                return;
            } else {
                subjectCodeField.parentElement.classList.remove('error');
            }
            
            if (!subjectNameField || !subjectNameField.value.trim()) {
                subjectNameField.parentElement.classList.add('error');
                return;
            } else {
                subjectNameField.parentElement.classList.remove('error');
            }
            
            if (!subjectDeptField || !subjectDeptField.value) {
                subjectDeptField.parentElement.classList.add('error');
                return;
            } else {
                subjectDeptField.parentElement.classList.remove('error');
            }
            
            const departmentCode = subjectDeptField.value;
            
            // Create new subject
            const newSubject = {
                id: subjectCodeField.value.trim().toLowerCase(),
                name: subjectNameField.value.trim()
            };
            
            // Check if subject already exists in this department
            if (!subjectsByDepartment[departmentCode]) {
                // Create a new array for this department if it doesn't exist
                subjectsByDepartment[departmentCode] = [];
            }
            
            const existingSubjectIndex = subjectsByDepartment[departmentCode].findIndex(s => 
                s.id === newSubject.id || s.name === newSubject.name
            );
            
            if (existingSubjectIndex >= 0) {
                showNotification(`Subject with this code or name already exists in ${departmentCode}.`, 'error');
                return;
            }
            
            // Add to subjects array for this department
            subjectsByDepartment[departmentCode].push(newSubject);
            
            // Save to localStorage
            try {
                localStorage.setItem('subjectsByDepartment', JSON.stringify(subjectsByDepartment));
            } catch (e) {
                console.error('Error saving subjects to localStorage:', e);
            }
            
            // Update the subject dropdown if the current department is selected
            if (departmentSelect && departmentSelect.value === departmentCode) {
                // Re-populate subject dropdown
                if (subjectSelect) {
                    // Clear and re-populate
                    subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                    
                    // Add subject options for the department
                    subjectsByDepartment[departmentCode].forEach(subject => {
                        const option = document.createElement('option');
                        option.value = subject.id;
                        option.textContent = subject.name;
                        option.dataset.course = departmentCode;
                        subjectSelect.appendChild(option);
                    });
                    
                    // Enable the dropdown
                    subjectSelect.disabled = false;
                }
            }
            
            // Hide modal
            hideModal('addSubjectModal');
            
            // Show notification
            showNotification('Subject added successfully!', 'success');
        });
    }
    
    // Cancel subject button handler
    if (cancelSubjectBtn) {
        cancelSubjectBtn.addEventListener('click', function() {
            hideModal('addSubjectModal');
        });
    }
    
    // Function to populate the subjects list in the manage subjects modal
    function populateSubjectsList() {
        const subjectsList = document.getElementById('subjectsList');
        if (!subjectsList) return;
        
        // Clear the list
        subjectsList.innerHTML = '';
        
        // Check if there are any subjects
        const departmentsWithSubjects = Object.keys(subjectsByDepartment).filter(
            dept => subjectsByDepartment[dept] && subjectsByDepartment[dept].length > 0
        );
        
        if (departmentsWithSubjects.length === 0) {
            // Show a message if there are no subjects
            subjectsList.innerHTML = '<div class="no-subjects">No subjects added yet.</div>';
            return;
        }
        
        // Create sections for each department
        departmentsWithSubjects.forEach(departmentCode => {
            const departmentSection = document.createElement('div');
            departmentSection.className = 'subject-department-section';
            
            // Create a heading for the department
            const heading = document.createElement('h3');
            
            // Find the department name
            const department = departments.find(d => d.code === departmentCode);
            const departmentName = department ? department.name : departmentCode;
            
            heading.textContent = departmentCode + (departmentName !== departmentCode ? ` - ${departmentName}` : '');
            departmentSection.appendChild(heading);
            
            // Create a list for the subjects
            const list = document.createElement('ul');
            list.className = 'subjects-list';
            
            // Add subjects to the list
            subjectsByDepartment[departmentCode].forEach(subject => {
                const listItem = document.createElement('li');
                listItem.className = 'subject-item';
                
                // Create the subject name element
                const nameEl = document.createElement('span');
                nameEl.className = 'subject-name';
                nameEl.textContent = `${subject.id} - ${subject.name}`;
                
                // Create the remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-subject-btn';
                removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
                removeBtn.dataset.dept = departmentCode;
                removeBtn.dataset.id = subject.id;
                
                // Add event listener to the remove button with correct scope
                removeBtn.addEventListener('click', function() {
                    const dept = this.dataset.dept;
                    const id = this.dataset.id;
                    removeSubject(dept, id);
                });
                
                // Add elements to the list item
                listItem.appendChild(nameEl);
                listItem.appendChild(removeBtn);
                
                // Add the list item to the list
                list.appendChild(listItem);
            });
            
            // Add the list to the department section
            departmentSection.appendChild(list);
            
            // Add the department section to the subjects list
            subjectsList.appendChild(departmentSection);
        });
    }
    
    // Function to remove a subject
    function removeSubject(departmentCode, subjectId) {
        // Check if there are any classes using this subject
        const subjectInUse = allClasses.some(cls => 
            cls.course === departmentCode && 
            cls.subject === subjectsByDepartment[departmentCode].find(s => s.id === subjectId)?.name
        );
        
        if (subjectInUse) {
            showNotification(`Cannot remove subject because it is being used in one or more classes.`, 'error');
            return;
        }
        
        // Show custom confirmation dialog
        const confirmMessage = document.getElementById('confirmMessage');
        if (confirmMessage) {
            const subjectName = subjectsByDepartment[departmentCode].find(s => s.id === subjectId)?.name || subjectId;
            confirmMessage.textContent = `Are you sure you want to remove subject "${subjectName}" from ${departmentCode}?`;
        }
        
        // Set up the Yes button for this specific action
        const yesBtn = document.getElementById('confirmYesBtn');
        if (yesBtn) {
            yesBtn.textContent = 'Yes, Remove';
            yesBtn.onclick = function() {
                // Remove from the array
                if (subjectsByDepartment[departmentCode]) {
                    subjectsByDepartment[departmentCode] = subjectsByDepartment[departmentCode].filter(s => s.id !== subjectId);
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('subjectsByDepartment', JSON.stringify(subjectsByDepartment));
                    } catch (e) {
                        console.error('Error saving subjects to localStorage:', e);
                    }
                    
                    // Update the subject dropdown if the current department is selected
                    if (departmentSelect && departmentSelect.value === departmentCode) {
                        // Re-populate subject dropdown
                        if (subjectSelect) {
                            // Clear and re-populate
                            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                            
                            // Add subject options for the department
                            subjectsByDepartment[departmentCode].forEach(subject => {
                                const option = document.createElement('option');
                                option.value = subject.id;
                                option.textContent = subject.name;
                                option.dataset.course = departmentCode;
                                subjectSelect.appendChild(option);
                            });
                        }
                    }
                    
                    // Update the subjects list
                    populateSubjectsList();
                }
                
                // Hide confirm modal
                hideModal('confirmModal');
                
                // Show notification
                showNotification(`Subject has been removed.`, 'success');
            };
        }
        
        // Set up the No button
        const noBtn = document.getElementById('confirmNoBtn');
        if (noBtn) {
            noBtn.textContent = 'Cancel';
            noBtn.onclick = function() {
                hideModal('confirmModal');
            };
        }
        
        showModal('confirmModal');
    }
    
    // Load subjects from localStorage if they exist
    if (localStorage.getItem('subjectsByDepartment')) {
        try {
            const savedSubjects = JSON.parse(localStorage.getItem('subjectsByDepartment'));
            
            // Replace the default subjects with the saved ones
            subjectsByDepartment = savedSubjects;
            
            console.log('Loaded subjects from localStorage');
            
            // Initialize subject dropdown after subjects are loaded
            initializeSubjectDropdown();
        } catch (e) {
            console.error('Error loading subjects from localStorage:', e);
        }
    }
    
    // Initialize subject dropdown if a department is already selected
    function initializeSubjectDropdown() {
        if (departmentSelect && departmentSelect.value && subjectSelect) {
            const selectedDepartment = departmentSelect.value;
            
            // Clear and populate subject dropdown
            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
            
            // Add subject options for selected department
            if (subjectsByDepartment[selectedDepartment] && Array.isArray(subjectsByDepartment[selectedDepartment])) {
                subjectsByDepartment[selectedDepartment].forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    option.dataset.course = selectedDepartment;
                    subjectSelect.appendChild(option);
                });
                
                // Enable the subject dropdown
                subjectSelect.disabled = false;
            }
        }
    }
    
    // Program/Strand management UI is handled by index.html via #programSelect populated by loadPrograms().
    // Remove legacy dynamic insertion of a duplicate #strandSelect to avoid two Program/Strand fields.
    // If any helper functions are invoked, they will first query the DOM for #strandSelect and no-op if absent.
    
    const strandSelect = document.getElementById('strandSelect');
    const addStrandLink = document.getElementById('addStrandLink');
    const manageStrandsLink = document.getElementById('manageStrandsLink');
    const saveStrandBtn = document.getElementById('saveStrandBtn');
    const cancelStrandBtn = document.getElementById('cancelStrandBtn');
      // Strand management moved to superadmin dashboard
    // Event handlers removed as they should only be used from the superadmin page
    
    // Save strand button handler
    if (saveStrandBtn) {
        saveStrandBtn.addEventListener('click', function() {
            const strandCodeField = document.getElementById('strandCode');
            const strandNameField = document.getElementById('strandName');
            const strandDescField = document.getElementById('strandDescription');
            
            // Basic validation
            if (!strandCodeField || !strandCodeField.value.trim()) {
                strandCodeField.parentElement.classList.add('error');
                return;
            } else {
                strandCodeField.parentElement.classList.remove('error');
            }
            
            if (!strandNameField || !strandNameField.value.trim()) {
                strandNameField.parentElement.classList.add('error');
                return;
            } else {
                strandNameField.parentElement.classList.remove('error');
            }
            
            // Create new strand
            const newStrand = {
                id: 'strand_' + Date.now(),
                code: strandCodeField.value.trim(),
                name: strandNameField.value.trim(),
                description: strandDescField ? strandDescField.value.trim() : ''
            };
            
            // Check if strand already exists
            const existingStrandIndex = strands.findIndex(s => 
                s.code === newStrand.code || s.name === newStrand.name
            );
            
            if (existingStrandIndex >= 0) {
                showNotification(`Program/Strand with this code or name already exists.`, 'error');
                return;
            }
            
            // Add to strands array
            strands.push(newStrand);
            
            // Save to localStorage
            try {
                localStorage.setItem('strands', JSON.stringify(strands));
            } catch (e) {
                console.error('Error saving strands to localStorage:', e);
            }
            
            // Update the strand dropdown
            updateStrandSelectOptions();
            
            // Hide modal
            hideModal('addStrandModal');
            
            // Show notification
            showNotification('Program/Strand added successfully!', 'success');
        });
    }
    
    // Cancel strand button handler
    if (cancelStrandBtn) {
        cancelStrandBtn.addEventListener('click', function() {
            hideModal('addStrandModal');
        });
    }
    
    // Function to populate the strands list in the manage strands modal
    function populateStrandsList() {
        const strandsList = document.getElementById('strandsList');
        if (!strandsList) return;
        
        // Clear the list
        strandsList.innerHTML = '';
        
        if (strands.length === 0) {
            // Show a message if there are no strands
            strandsList.innerHTML = '<div class="no-strands">No strands/courses added yet.</div>';
            return;
        }
        
        // Create a list for the strands
        const list = document.createElement('ul');
        list.className = 'strands-list';
        
        // Add strands to the list
        strands.forEach(strand => {
            const listItem = document.createElement('li');
            listItem.className = 'strand-item';
            
            // Create the strand name element
            const nameEl = document.createElement('span');
            nameEl.className = 'strand-name';
            nameEl.textContent = `${strand.code} - ${strand.name}`;
            
            // Create description if there is one
            if (strand.description) {
                const descEl = document.createElement('p');
                descEl.className = 'strand-description';
                descEl.textContent = strand.description;
                nameEl.appendChild(descEl);
            }
            
            // Create the remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-strand-btn';
            removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove';
            removeBtn.dataset.id = strand.id;
            
            // Add event listener to the remove button
            removeBtn.addEventListener('click', function() {
                removeStrand(strand.id);
            });
            
            // Create the edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-strand-btn';
            editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
            editBtn.dataset.id = strand.id;
            
            // Add event listener to the edit button
            editBtn.addEventListener('click', function() {
                editStrand(strand.id);
            });
            
            // Create button container
            const btnContainer = document.createElement('div');
            btnContainer.className = 'strand-btn-container';
            btnContainer.appendChild(editBtn);
            btnContainer.appendChild(removeBtn);
            
            // Add elements to the list item
            listItem.appendChild(nameEl);
            listItem.appendChild(btnContainer);
            
            // Add the list item to the list
            list.appendChild(listItem);
        });
        
        // Add the list to the strands list container
        strandsList.appendChild(list);
    }
    
    // Function to edit a strand
    function editStrand(id) {
        const strand = strands.find(s => s.id === id);
        if (!strand) return;
        
        // Populate form fields with strand data
        const strandCodeField = document.getElementById('strandCode');
        const strandNameField = document.getElementById('strandName');
        const strandDescField = document.getElementById('strandDescription');
        
        if (strandCodeField) strandCodeField.value = strand.code;
        if (strandNameField) strandNameField.value = strand.name;
        if (strandDescField) strandDescField.value = strand.description || '';
        
        // Change save button behavior - we need to save changes instead of creating a new strand
        const saveStrandBtn = document.getElementById('saveStrandBtn');
        if (saveStrandBtn) {
            // Store the original onclick
            const originalOnClick = saveStrandBtn.onclick;
            
            // Set new onclick for editing
            saveStrandBtn.onclick = function() {
                // Basic validation
                if (!strandCodeField || !strandCodeField.value.trim()) {
                    strandCodeField.parentElement.classList.add('error');
                    return;
                } else {
                    strandCodeField.parentElement.classList.remove('error');
                }
                
                if (!strandNameField || !strandNameField.value.trim()) {
                    strandNameField.parentElement.classList.add('error');
                    return;
                } else {
                    strandNameField.parentElement.classList.remove('error');
                }
                
                // Check if another strand has the same code or name
                const duplicateStrand = strands.find(s => 
                    s.id !== id && (s.code === strandCodeField.value.trim() || s.name === strandNameField.value.trim())
                );
                
                if (duplicateStrand) {
                    showNotification(`Another strand/course already uses this code or name.`, 'error');
                    return;
                }
                
                // Update the strand
                strand.code = strandCodeField.value.trim();
                strand.name = strandNameField.value.trim();
                strand.description = strandDescField ? strandDescField.value.trim() : '';
                
                // Save to localStorage
                try {
                    localStorage.setItem('strands', JSON.stringify(strands));
                } catch (e) {
                    console.error('Error saving strands to localStorage:', e);
                }
                
                // Update the strand dropdown
                updateStrandSelectOptions();
                
                // Restore original onclick
                saveStrandBtn.onclick = originalOnClick;
                
                // Hide modal
                hideModal('addStrandModal');
                
                // Show notification
                showNotification('Program/Strand updated successfully!', 'success');
                
                // Update the manage strands modal
                populateStrandsList();
            };
        }
        
        // Show the modal
        const modalTitle = document.querySelector('#addStrandModal .modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Edit Program/Strand';
        
        showModal('addStrandModal');
        
        // Set up a handler to restore the original behavior when the modal is closed
        const closeButtons = document.querySelectorAll('#addStrandModal .close-modal, #cancelStrandBtn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function onClose() {
                if (saveStrandBtn) saveStrandBtn.onclick = originalOnClick;
                btn.removeEventListener('click', onClose);
                
                // Restore original title
                if (modalTitle) modalTitle.textContent = 'Add New Program/Strand';
            });
        });
    }
    
    // Function to remove a strand
    function removeStrand(id) {
        // Check if strand is in use
        const strandInUse = allClasses.some(cls => 
            cls.strand === strands.find(s => s.id === id)?.code
        );
        
        if (strandInUse) {
            showNotification(`Cannot remove strand/course because it is being used in one or more classes.`, 'error');
            return;
        }
        
        // Find the strand
        const strand = strands.find(s => s.id === id);
        if (!strand) return;
        
        // Show custom confirmation dialog
        const confirmMessage = document.getElementById('confirmMessage');
        if (confirmMessage) {
            confirmMessage.textContent = `Are you sure you want to remove strand/course "${strand.code} - ${strand.name}"?`;
        }
        
        // Set up the Yes button for this specific action
        const yesBtn = document.getElementById('confirmYesBtn');
        if (yesBtn) {
            yesBtn.textContent = 'Yes, Remove';
            yesBtn.onclick = function() {
                // Remove from the array
                strands = strands.filter(s => s.id !== id);
                
                // Save to localStorage
                try {
                    localStorage.setItem('strands', JSON.stringify(strands));
                } catch (e) {
                    console.error('Error saving strands to localStorage:', e);
                }
                
                // Update the strand dropdown
                updateStrandSelectOptions();
                
                // Update the strands list
                populateStrandsList();
                
                // Hide confirm modal
                hideModal('confirmModal');
                
                // Show notification
                showNotification(`Program/Strand has been removed.`, 'success');
            };
        }
        
        // Set up the No button
        const noBtn = document.getElementById('confirmNoBtn');
        if (noBtn) {
            noBtn.textContent = 'Cancel';
            noBtn.onclick = function() {
                hideModal('confirmModal');
            };
        }
        
        showModal('confirmModal');
    }
    
    // Function to update strand select options
    function updateStrandSelectOptions() {
        const el = document.getElementById('strandSelect');
        if (!el) return; // No duplicate field on this page
        const currentValue = el.value;
        el.innerHTML = '<option value="" selected disabled>Select Program/Strand</option>';
        (Array.isArray(window.strands) ? window.strands : []).forEach(strand => {
            const option = document.createElement('option');
            option.value = strand.code;
            option.textContent = `${strand.code} - ${strand.name}`;
            el.appendChild(option);
        });
        if (currentValue && (Array.isArray(window.strands) ? window.strands : []).some(s => s.code === currentValue)) {
            el.value = currentValue;
        }
    }
    
    // Call updateStrandSelectOptions initially
    updateStrandSelectOptions();

    // Save schedule to server (global - exposed for use in other files)
    window.saveScheduleToLocalStorage = async function() {
        console.log('saveScheduleToLocalStorage called');
        const calendar = window.calendar;
        if (!calendar) {
            console.log('No calendar available for saving');
            return;
        }
        
        const events = calendar.getEvents();
        console.log('Current events on calendar:', events.length);
        
        // Check for duplicate events before saving
        const seenEvents = new Set();
        const eventsData = events.map(event => {
            // Extract the necessary data to recreate the event
            // For timeGridWeek view, events don't have getResources() method
            // We can get day of week from extendedProps or calculate from start date
            let resourceId = null;
            if (typeof event.getResources === 'function') {
                // Only use getResources if it exists (for resource views)
                const resources = event.getResources();
                resourceId = resources && resources.length > 0 ? resources[0].id : null;
            } else {
                // For timeGridWeek, extract dayOfWeek from extendedProps if available
                // If not in extendedProps, calculate from start date
                if (event.extendedProps?.dayOfWeek) {
                    resourceId = event.extendedProps.dayOfWeek;
                } else if (event.start) {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const eventDate = new Date(event.start);
                    resourceId = dayNames[eventDate.getDay()];
                    // Update the event's extendedProps
                    event.setExtendedProp('dayOfWeek', resourceId);
                }
            }
            
            // Create a unique key to detect duplicates (same class, same day, same time)
            const originalClassId = event.extendedProps?.originalClassId;
            const startTime = event.start ? new Date(event.start).toTimeString().substring(0, 5) : null;
            const duplicateKey = `${originalClassId}-${resourceId}-${startTime}`;
            
            // Skip if we've seen this exact event before (duplicate)
            if (seenEvents.has(duplicateKey) && originalClassId) {
                console.log('Skipping duplicate event when saving:', event.title, 'on', resourceId);
                return null; // Return null to filter out later
            }
            
            seenEvents.add(duplicateKey);
            
            return {
                id: event.id,
                title: event.title,
                resourceId: resourceId,
                start: event.start ? event.start.toISOString() : null,
                end: event.end ? event.end.toISOString() : null,
                backgroundColor: event.backgroundColor || null,
                borderColor: event.borderColor || null,
                classNames: Array.from(event.classNames || []),
                extendedProps: event.extendedProps || {}
            };
        }).filter(event => event !== null); // Remove null entries (duplicates)
        
        try {
            // Save to server
            const response = await fetch('/api/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ events: eventsData })
            });
            
            if (response.ok) {
                console.log('Saved', eventsData.length, 'events to server');
                console.log('Events data saved:', eventsData);
                
                // Store timestamp of last save
                localStorage.setItem('scheduleLastUpdated', Date.now().toString());
            } else {
                console.error('Failed to save schedule to server:', response.status);
            }
        } catch (e) {
            console.error('Error saving schedule to server:', e);
        }
    };
    
    
    // Manual schedule loading function for debugging
    window.forceLoadSchedule = function() {
        console.log('Force loading schedule...');
        if (window.calendar) {
            window.calendar.removeAllEvents();
            window.loadScheduleFromLocalStorage();
        } else {
            console.log('Calendar not available');
        }
    };
    
    // Manual schedule saving function for debugging
    window.forceSaveSchedule = function() {
        console.log('Force saving schedule...');
        if (window.calendar) {
            const events = window.calendar.getEvents();
            console.log('Current events on calendar:', events.length);
            saveScheduleToLocalStorage();
        } else {
            console.log('Calendar not available');
        }
    };
    
    // Clear schedule function
    window.clearSchedule = async function() {
        console.log('Clearing schedule...');
        localStorage.removeItem('calendarEvents');
        if (window.calendar) {
            window.calendar.removeAllEvents();
        }
        
        // Save empty schedule to server so it persists after reload
        try {
            const response = await fetch('/api/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ events: [] }) // Save empty array to server
            });
            
            if (response.ok) {
                console.log('Cleared schedule saved to server');
            } else {
                console.error('Failed to save cleared schedule to server:', response.status);
            }
        } catch (e) {
            console.error('Error saving cleared schedule to server:', e);
        }
        
        console.log('Schedule cleared');
    };
    
    // Debug function to check server and localStorage
    window.debugLocalStorage = async function() {
        console.log('=== DEBUG INFO ===');
        console.log('allClasses (localStorage):', localStorage.getItem('allClasses'));
        console.log('userData (localStorage):', localStorage.getItem('userData'));
        
        // Check server schedule
        try {
            const response = await fetch('/api/schedule', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            if (response.ok) {
                const serverSchedule = await response.json();
                console.log('Server schedule events:', serverSchedule.length);
                console.log('Server schedule data:', serverSchedule);
            } else {
                console.log('Failed to fetch server schedule:', response.status);
            }
        } catch (e) {
            console.log('Error fetching server schedule:', e);
        }
        
        if (window.calendar) {
            const events = window.calendar.getEvents();
            console.log('Current calendar events:', events.length);
            events.forEach((event, index) => {
                console.log(`Event ${index}:`, {
                    id: event.id,
                    title: event.title,
                    start: event.start ? event.start.toISOString() : null,
                    end: event.end ? event.end.toISOString() : null
                });
            });
        }
        console.log('=== END DEBUG ===');
    };
    
    // Load schedule from server (filtered by faculty for regular users)
    window.loadScheduleFromLocalStorage = async function() {
        const calendar = window.calendar;
        console.log('loadScheduleFromLocalStorage called, calendar exists:', !!calendar);
        if (!calendar) {
            console.log('Calendar not yet initialized, skipping schedule load');
            return;
        }
        
        try {
            // Get current user data
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const userRole = userData.role || 'user';
            // Build user name from firstName + lastName or use email/name
            const userFirstName = userData.firstName || '';
            const userLastName = userData.lastName || '';
            const userEmail = userData.email || '';
            const userFullName = (userFirstName && userLastName) ? `${userFirstName} ${userLastName}`.trim() : (userData.name || '');
            const userName = userFullName || userEmail || '';
            
            // Create array of possible user identifiers for matching
            const userIdentifiers = [];
            if (userFullName) userIdentifiers.push(userFullName.toLowerCase().trim());
            if (userFirstName && userLastName) {
                userIdentifiers.push(`${userFirstName} ${userLastName}`.toLowerCase().trim());
                userIdentifiers.push(`${userFirstName}${userLastName}`.toLowerCase().trim());
            }
            if (userEmail) userIdentifiers.push(userEmail.toLowerCase().trim());
            if (userData.name) userIdentifiers.push(userData.name.toLowerCase().trim());
            
            console.log('Loading schedule for user:', userName, 'with role:', userRole);
            console.log('User identifiers for matching:', userIdentifiers);
            
            // Load schedule from server
            const response = await fetch('/api/schedule', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                const eventsData = await response.json();
                console.log('Found events data from server:', eventsData.length, 'events');
                
                if (eventsData && eventsData.length) {
                    // Filter events based on user role and faculty assignment
                    let filteredEvents = eventsData;
                    
                    if (userRole === 'user' || userRole === 'faculty') {
                        // For regular users and faculty, only show their assigned classes
                        filteredEvents = eventsData.filter(event => {
                            const eventFaculty = (event.extendedProps?.faculty || '').toLowerCase().trim();
                            if (!eventFaculty) {
                                console.log(`Event "${event.title}" has no faculty assigned, skipping`);
                                return false;
                            }
                            
                            // Check if event faculty matches any of the user identifiers
                            const isAssignedToUser = userIdentifiers.some(id => {
                                const match = eventFaculty === id || eventFaculty.includes(id) || id.includes(eventFaculty);
                                if (match) {
                                    console.log(`Matched event "${event.title}" - Faculty: "${event.extendedProps?.faculty}", User ID: "${id}"`);
                                }
                                return match;
                            });
                            
                            return isAssignedToUser;
                        });
                        console.log(`Filtered to ${filteredEvents.length} events for user: ${userName} (out of ${eventsData.length} total)`);
                    } else {
                        // For admins and superadmins, show all events
                        console.log('Admin/Superadmin - showing all events');
                    }
                    
                    if (filteredEvents.length > 0) {
                        console.log('Loading', filteredEvents.length, 'filtered events from server');
                        
                        // Clear existing events first to prevent duplication
                        calendar.removeAllEvents();
                        
                        // Use the calendar's current view date (Monday-Saturday week being displayed)
                        // This allows events to show on the correct week when user navigates
                        let viewDate;
                        try {
                            viewDate = calendar.getDate(); // Get the date of the week being viewed
                        } catch (e) {
                            // Fallback: use today, but if it's Sunday, move to Monday
                            viewDate = new Date();
                            if (viewDate.getDay() === 0) {
                                viewDate.setDate(viewDate.getDate() + 1); // Sunday -> Monday
                            }
                        }
                        
                        // Normalize to noon to avoid timezone issues
                        viewDate.setHours(12, 0, 0, 0);
                        const currentDayOfWeek = viewDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        
                        // Calculate Monday of the visible week (Monday-Saturday timetable)
                        let daysToMonday;
                        if (currentDayOfWeek === 0) {
                            // Sunday - move to Monday
                            viewDate.setDate(viewDate.getDate() + 1);
                            daysToMonday = 0;
                        } else {
                            // Monday = 0 days back, Tuesday = 1 day back, etc.
                            daysToMonday = currentDayOfWeek - 1;
                        }
                        
                        const mondayDate = new Date(viewDate);
                        mondayDate.setDate(viewDate.getDate() - daysToMonday);
                        mondayDate.setHours(0, 0, 0, 0); // Start of day
                        
                        console.log('Calendar view date:', viewDate.toDateString());
                        console.log('Converting events to Monday-Saturday week starting:', mondayDate.toDateString());
                        console.log('Monday date:', mondayDate.toISOString().split('T')[0]);
                        
                        // Map day name to day of week offset (Monday = 0, Tuesday = 1, ..., Saturday = 5)
                        const dayOffsetMap = {
                            'Monday': 0,
                            'Tuesday': 1,
                            'Wednesday': 2,
                            'Thursday': 3,
                            'Friday': 4,
                            'Saturday': 5
                        };
                        
                        filteredEvents.forEach(eventData => {
                            console.log('Adding event to calendar:', eventData);
                            
                            // Check if event has a valid date that's within the visible week
                            // If the event's date is already in the visible week, use it as-is
                            // Otherwise, convert to current week based on dayOfWeek
                            let useOriginalDate = false;
                            if (eventData.start) {
                                const eventStartDate = new Date(eventData.start);
                                const eventStartDay = eventStartDate.getDay();
                                // Check if event date falls within the visible week (Monday-Saturday)
                                // Compare with the Monday of the visible week
                                const eventStartWeekStart = new Date(eventStartDate);
                                eventStartWeekStart.setDate(eventStartDate.getDate() - (eventStartDay === 0 ? 6 : eventStartDay - 1));
                                
                                // If the event's week matches the visible week, use the original date
                                if (eventStartWeekStart.getTime() === mondayDate.getTime()) {
                                    useOriginalDate = true;
                                    console.log('Using original event date (already in visible week):', eventStartDate.toDateString());
                                }
                            }
                            
                            // Convert event date to current week based on dayOfWeek if needed
                            if (!useOriginalDate) {
                                const dayOfWeek = eventData.extendedProps?.dayOfWeek || eventData.resourceId;
                                if (dayOfWeek && dayOffsetMap.hasOwnProperty(dayOfWeek)) {
                                    const targetDate = new Date(mondayDate);
                                    targetDate.setDate(mondayDate.getDate() + dayOffsetMap[dayOfWeek]);
                                    
                                    // Format the date string (YYYY-MM-DD)
                                    const year = targetDate.getFullYear();
                                    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                                    const dayOfMonth = String(targetDate.getDate()).padStart(2, '0');
                                    const dateStr = `${year}-${month}-${dayOfMonth}`;
                                    
                                    // Extract time from original start/end dates
                                    // Handle both ISO string format and Date objects
                                    const originalStart = new Date(eventData.start);
                                    const originalEnd = new Date(eventData.end || eventData.start);
                                    
                                    // Extract time components (using local time, not UTC)
                                    // FullCalendar interprets dates without timezone as local time
                                    const startHours = String(originalStart.getHours()).padStart(2, '0');
                                    const startMinutes = String(originalStart.getMinutes()).padStart(2, '0');
                                    const endHours = String(originalEnd.getHours()).padStart(2, '0');
                                    const endMinutes = String(originalEnd.getMinutes()).padStart(2, '0');
                                    
                                    // Update start and end dates to current week (using local time, no timezone)
                                    eventData.start = `${dateStr}T${startHours}:${startMinutes}:00`;
                                    eventData.end = `${dateStr}T${endHours}:${endMinutes}:00`;
                                    
                                    console.log(`Updated event date to current week: ${dayOfWeek} -> ${dateStr}`);
                                }
                            }
                            
                            // Apply department color if not already set
                            if (!eventData.backgroundColor && eventData.extendedProps?.departmentColor) {
                                eventData.backgroundColor = eventData.extendedProps.departmentColor;
                                eventData.borderColor = eventData.extendedProps.departmentColor;
                                console.log(`Applied stored department color: ${eventData.extendedProps.departmentColor} for event: ${eventData.title}`);
                            } else if (!eventData.backgroundColor) {
                                // Try to get department color for existing events
                                const departmentColor = getDepartmentColorForClass({
                                    course: eventData.extendedProps?.course || '',
                                    courseId: eventData.extendedProps?.courseId
                                });
                                eventData.backgroundColor = departmentColor;
                                eventData.borderColor = departmentColor;
                                console.log(`Applied calculated department color: ${departmentColor} for event: ${eventData.title}`);
                            } else {
                                console.log(`Event already has color: ${eventData.backgroundColor} for event: ${eventData.title}`);
                            }
                            
                            calendar.addEvent(eventData);
                            
                            // Apply department color after event is added
                            setTimeout(() => {
                                const eventElement = document.querySelector(`[data-event-id="${eventData.id}"]`);
                                if (eventElement) {
                                    eventElement.style.backgroundColor = eventData.backgroundColor;
                                    eventElement.style.borderColor = eventData.borderColor;
                                    eventElement.style.opacity = '1';
                                    const mainEl = eventElement.querySelector('.fc-event-main');
                                    if (mainEl) {
                                        mainEl.style.backgroundColor = eventData.backgroundColor;
                                        mainEl.style.borderColor = eventData.borderColor;
                                    }
                                    console.log(`Applied department color ${eventData.backgroundColor} to loaded event element`);
                                }
                            }, 100);
                        });
                    } else {
                        // No events found for this faculty member
                        console.log('No events found for faculty:', userName);
                        calendar.removeAllEvents();
                        
                        // Show a message to the user
                        if (userRole === 'user' || userRole === 'faculty') {
                            showNotification('No classes assigned to you yet. Please contact your administrator.', 'info');
                            // Hide the schedule info notice when no events
                            const scheduleInfo = document.getElementById('scheduleInfo');
                            if (scheduleInfo) {
                                scheduleInfo.style.display = 'none';
                            }
                        }
                    }
                    
                    if (userRole === 'user' || userRole === 'faculty') {
                        showNotification('Your schedule loaded successfully!', 'success');
                        // Show the schedule info notice
                        const scheduleInfo = document.getElementById('scheduleInfo');
                        if (scheduleInfo) {
                            scheduleInfo.style.display = 'flex';
                        }
                    } else {
                        showNotification('Schedule loaded successfully!', 'success');
                        // Hide the schedule info notice for admins
                        const scheduleInfo = document.getElementById('scheduleInfo');
                        if (scheduleInfo) {
                            scheduleInfo.style.display = 'none';
                        }
                    }
                } else {
                    console.log('No events found on server');
                    // Clear any existing events
                    calendar.removeAllEvents();
                    
                    if (userRole === 'user' || userRole === 'faculty') {
                        showNotification('No classes assigned to you yet. Please contact your administrator.', 'info');
                        // Hide the schedule info notice when no events
                        const scheduleInfo = document.getElementById('scheduleInfo');
                        if (scheduleInfo) {
                            scheduleInfo.style.display = 'none';
                        }
                    } else {
                        showNotification('No schedule available yet', 'info');
                    }
                }
            } else {
                console.error('Failed to load schedule from server:', response.status);
                if (userRole === 'user' || userRole === 'faculty') {
                    showNotification('Failed to load schedule', 'error');
                }
            }
        } catch (e) {
            console.error('Error loading schedule from server:', e);
        }
    }
    
    // Save classes to localStorage
    function saveClassesToLocalStorage() {
        try {
            localStorage.setItem('allClasses', JSON.stringify(allClasses));
            console.log('Saved', allClasses.length, 'classes to localStorage');
        } catch (e) {
            console.error('Error saving classes to localStorage:', e);
        }
    }
    
    // Load classes from localStorage
    function loadClassesFromLocalStorage() {
        try {
            const savedClasses = JSON.parse(localStorage.getItem('allClasses'));
            if (savedClasses && savedClasses.length) {
                console.log('Loading', savedClasses.length, 'classes from localStorage');
                
                // Clear any existing classes first
                const classesList = document.getElementById('createdClasses');
                if (classesList) {
                    classesList.innerHTML = '';
                }
                
                // Add each class to the list
                savedClasses.forEach(classData => {
                    addClassToList(classData);
                });
                
                // Update the allClasses array
                allClasses = savedClasses;
                window.allClasses = allClasses;
            }
        } catch (e) {
            console.error('Error loading classes from localStorage:', e);
        }
    }
    
    // Initialize the page with saved data
    loadClassesFromLocalStorage();
    loadScheduleFromLocalStorage();
    
    // Save schedule whenever it changes - moved to after calendar initialization
    // This will be set up in the calendar initialization section
    
    // Save classes whenever they change
    const originalAddClassToList = addClassToList;
    addClassToList = function(classData) {
        originalAddClassToList(classData);
        saveClassesToLocalStorage();
    };
    
    const originalRemoveClassItem = removeClassItem;
    removeClassItem = function(id) {
        originalRemoveClassItem(id);
        saveClassesToLocalStorage();
    };
    
    const originalClearAllClasses = clearAllClasses;
    clearAllClasses = function(classesList, classItems) {
        originalClearAllClasses(classesList, classItems);
        saveClassesToLocalStorage();
        // Don't clear calendar events when clearing classes - they should remain
    };

    // Move the strand section to be after the faculty member section in the form
    function moveStrandSectionAfterFacultyMember() {
        // Find the strand section that was previously created
        const strandSection = document.querySelector('.form-group:has(#strandSelect)');
        if (!strandSection) return;
        
        // Find the faculty member section
        const facultySection = document.querySelector('.form-group:has(#facultySelect)');
        if (!facultySection) return;
        
        // Get the next sibling of the faculty section
        const nextSibling = facultySection.nextSibling;
        
        // Remove the strand section from its current position
        strandSection.remove();
        
        // Insert the strand section after the faculty section
        if (nextSibling) {
            facultySection.parentNode.insertBefore(strandSection, nextSibling);
        } else {
            facultySection.parentNode.appendChild(strandSection);
        }
    }
    
    // Call the function to move the strand section
    moveStrandSectionAfterFacultyMember();

    // Reset buttons implementation
    // Reset all faculty members
    const resetFacultyBtn = document.getElementById('resetFacultyBtn');
    if (resetFacultyBtn) {
        resetFacultyBtn.addEventListener('click', function() {
            // Show custom confirmation dialog
            const confirmMessage = document.getElementById('confirmMessage');
            if (confirmMessage) {
                confirmMessage.textContent = 'Are you sure you want to reset ALL faculty members? This action cannot be undone.';
            }
            
            // Set up the Yes button for this specific action
            const yesBtn = document.getElementById('confirmYesBtn');
            if (yesBtn) {
                yesBtn.textContent = 'Yes, Reset All';
                yesBtn.onclick = function() {
                    // Check if any faculty is being used in classes
                    const facultyInUse = allClasses.length > 0;
                    
                    if (facultyInUse) {
                        hideModal('confirmModal');
                        showNotification('Cannot reset faculty members because some are being used in classes. Clear all classes first.', 'error');
                        return;
                    }
                    
                    // Reset the faculty members array
                    facultyMembers = [];
                    
                    // Save to localStorage
                    try {
                        localStorage.removeItem('facultyMembers');
                    } catch (e) {
                        console.error('Error removing faculty members from localStorage:', e);
                    }
                    
                    // Update the faculty dropdown
                    populateFacultyDropdown();
                    
                    // Update the faculty list in the manage faculty modal
                    populateFacultyManagerList();
                    
                    // Hide confirm modal
                    hideModal('confirmModal');
                    
                    // Show notification
                    showNotification('All faculty members have been reset.', 'success');
                };
            }
            
            // Set up the No button
            const noBtn = document.getElementById('confirmNoBtn');
            if (noBtn) {
                noBtn.textContent = 'Cancel';
                noBtn.onclick = function() {
                    hideModal('confirmModal');
                };
            }
            
            showModal('confirmModal');
        });
    }
    
    // Reset all departments
    const resetDepartmentsBtn = document.getElementById('resetDepartmentsBtn');
    if (resetDepartmentsBtn) {
        resetDepartmentsBtn.addEventListener('click', function() {
            // Show custom confirmation dialog
            const confirmMessage = document.getElementById('confirmMessage');
            if (confirmMessage) {
                confirmMessage.textContent = 'Are you sure you want to reset ALL departments? This action cannot be undone.';
            }
            
            // Set up the Yes button for this specific action
            const yesBtn = document.getElementById('confirmYesBtn');
            if (yesBtn) {
                yesBtn.textContent = 'Yes, Reset All';
                yesBtn.onclick = function() {
                    // Check if any department is being used in classes or has subjects/faculty
                    const departmentsInUse = allClasses.length > 0 || facultyMembers.length > 0 || Object.keys(subjectsByDepartment).some(dept => subjectsByDepartment[dept] && subjectsByDepartment[dept].length > 0);
                    
                    if (departmentsInUse) {
                        hideModal('confirmModal');
                        showNotification('Cannot reset departments because some are being used. Clear all classes, subjects, and faculty first.', 'error');
                        return;
                    }
                    
                    // Reset the departments array to defaults
                    departments = [
                        { code: 'BSIT', name: 'BS Information Technology' },
                        { code: 'BSAIS', name: 'BS Accounting Information Systems' },
                        { code: 'BSHM', name: 'BS Hospitality Management' },
                        { code: 'BSTM', name: 'BS Tourism Management' }
                    ];
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('departments', JSON.stringify(departments));
                    } catch (e) {
                        console.error('Error saving departments to localStorage:', e);
                    }
                    
                    // Update department dropdowns
                    updateDepartmentSelectOptions();
                    
                    // Update the departments list
                    populateDepartmentsList();
                    
                    // Hide confirm modal
                    hideModal('confirmModal');
                    
                    // Show notification
                    showNotification('All departments have been reset to defaults.', 'success');
                };
            }
            
            // Set up the No button
            const noBtn = document.getElementById('confirmNoBtn');
            if (noBtn) {
                noBtn.textContent = 'Cancel';
                noBtn.onclick = function() {
                    hideModal('confirmModal');
                };
            }
            
            showModal('confirmModal');
        });
    }
    
    // Reset all subjects
    const resetSubjectsBtn = document.getElementById('resetSubjectsBtn');
    if (resetSubjectsBtn) {
        resetSubjectsBtn.addEventListener('click', function() {
            // Show custom confirmation dialog
            const confirmMessage = document.getElementById('confirmMessage');
            if (confirmMessage) {
                confirmMessage.textContent = 'Are you sure you want to reset ALL subjects? This action cannot be undone.';
            }
            
            // Set up the Yes button for this specific action
            const yesBtn = document.getElementById('confirmYesBtn');
            if (yesBtn) {
                yesBtn.textContent = 'Yes, Reset All';
                yesBtn.onclick = function() {
                    // Check if any subject is being used in classes
                    const subjectsInUse = allClasses.length > 0;
                    
                    if (subjectsInUse) {
                        hideModal('confirmModal');
                        showNotification('Cannot reset subjects because some are being used in classes. Clear all classes first.', 'error');
                        return;
                    }
                    
                    // Reset to default subjects
                    subjectsByDepartment = {
                        'BSIT': [
                            { id: 'it101', name: 'Introduction to Information Technology' },
                            { id: 'cs101', name: 'Computer Programming 1' },
                            { id: 'cs102', name: 'Computer Programming 2' },
                            { id: 'net101', name: 'Network Fundamentals' },
                            { id: 'db101', name: 'Database Systems' },
                            { id: 'web101', name: 'Web Development' },
                            { id: 'sys101', name: 'Systems Analysis and Design' },
                            { id: 'algo101', name: 'Algorithms and Data Structures' },
                            { id: 'mob101', name: 'Mobile App Development' }
                        ],
                        'BSAIS': [
                            { id: 'acct101', name: 'Financial Accounting' },
                            { id: 'busi101', name: 'Business Mathematics' },
                            { id: 'econ101', name: 'Principles of Economics' },
                            { id: 'tax101', name: 'Income Taxation' },
                            { id: 'audit101', name: 'Auditing Principles' },
                            { id: 'fin101', name: 'Financial Management' },
                            { id: 'cost101', name: 'Cost Accounting' },
                            { id: 'law101', name: 'Business Law' },
                            { id: 'ethic101', name: 'Professional Ethics' }
                        ],
                        'BSHM': [
                            { id: 'food101', name: 'Food and Beverage Service' },
                            { id: 'hosp101', name: 'Introduction to Hospitality' },
                            { id: 'cook101', name: 'Culinary Arts' },
                            { id: 'event101', name: 'Events Management' },
                            { id: 'bar101', name: 'Bar Operations' },
                            { id: 'house101', name: 'Housekeeping Operations' },
                            { id: 'tour101', name: 'Tour Operations' },
                            { id: 'front101', name: 'Front Office Operations' },
                            { id: 'menu101', name: 'Menu Planning' }
                        ],
                        'BSTM': [
                            { id: 'tour201', name: 'Tourism Planning and Development' },
                            { id: 'dest101', name: 'Destination Management' },
                            { id: 'hosp201', name: 'Hospitality Management' },
                            { id: 'trans101', name: 'Transportation Management' },
                            { id: 'tour202', name: 'Tour Guiding' },
                            { id: 'event201', name: 'Event Planning and Management' },
                            { id: 'cult101', name: 'Cultural Tourism' },
                            { id: 'eco101', name: 'Ecotourism' },
                            { id: 'mark101', name: 'Tourism Marketing' }
                        ]
                    };
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('subjectsByDepartment', JSON.stringify(subjectsByDepartment));
                    } catch (e) {
                        console.error('Error saving subjects to localStorage:', e);
                    }
                    
                    // Update subject dropdown if a department is selected
                    if (departmentSelect && departmentSelect.value) {
                        const selectedDepartment = departmentSelect.value;
                        
                        // Re-populate subject dropdown
                        if (subjectSelect) {
                            // Clear and re-populate
                            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                            
                            // Add subject options for the department
                            if (subjectsByDepartment[selectedDepartment] && Array.isArray(subjectsByDepartment[selectedDepartment])) {
                                subjectsByDepartment[selectedDepartment].forEach(subject => {
                                    const option = document.createElement('option');
                                    option.value = subject.id;
                                    option.textContent = subject.name;
                                    option.dataset.course = selectedDepartment;
                                    subjectSelect.appendChild(option);
                                });
                            }
                        }
                        
                        // Update the subjects list
                        populateSubjectsList();
                    }
                    
                    // Hide confirm modal
                    hideModal('confirmModal');
                    
                    // Show notification
                    showNotification('All subjects have been reset to defaults.', 'success');
                };
            }
            
            // Set up the No button
            const noBtn = document.getElementById('confirmNoBtn');
            if (noBtn) {
                noBtn.textContent = 'Cancel';
                noBtn.onclick = function() {
                    hideModal('confirmModal');
                };
            }
            
            showModal('confirmModal');
        });
    }
    
    // Reset all strands
    const resetStrandsBtn = document.getElementById('resetStrandsBtn');
    if (resetStrandsBtn) {
        resetStrandsBtn.addEventListener('click', function() {
            // Show custom confirmation dialog
            const confirmMessage = document.getElementById('confirmMessage');
            if (confirmMessage) {
                confirmMessage.textContent = 'Are you sure you want to reset ALL strands/courses? This action cannot be undone.';
            }
            
            // Set up the Yes button for this specific action
            const yesBtn = document.getElementById('confirmYesBtn');
            if (yesBtn) {
                yesBtn.textContent = 'Yes, Reset All';
                yesBtn.onclick = function() {
                    // Check if any strand is being used in classes
                    const strandsInUse = allClasses.some(cls => cls.strand);
                    
                    if (strandsInUse) {
                        hideModal('confirmModal');
                        showNotification('Cannot reset strands/courses because some are being used in classes. Clear all classes first.', 'error');
                        return;
                    }
                    
                    // Reset the strands array
                    strands = [];
                    
                    // Save to localStorage
                    try {
                        localStorage.removeItem('strands');
                    } catch (e) {
                        console.error('Error removing strands from localStorage:', e);
                    }
                    
                    // Update the strand dropdown
                    updateStrandSelectOptions();
                    
                    // Update the strands list
                    populateStrandsList();
                    
                    // Hide confirm modal
                    hideModal('confirmModal');
                    
                    // Show notification
                    showNotification('All strands/courses have been reset.', 'success');
                };
            }
            
            // Set up the No button
            const noBtn = document.getElementById('confirmNoBtn');
            if (noBtn) {
                noBtn.textContent = 'Cancel';
                noBtn.onclick = function() {
                    hideModal('confirmModal');
                };
            }
            
            showModal('confirmModal');
        });
    }

    // Remove all subjects button in manage subjects modal
    const resetAllSubjectsBtn = document.getElementById('resetSubjectsBtn');
    if (resetAllSubjectsBtn) {
        resetAllSubjectsBtn.addEventListener('click', function() {
            // Show custom confirmation dialog
            const confirmMessage = document.getElementById('confirmMessage');
            if (confirmMessage) {
                confirmMessage.textContent = 'Are you sure you want to remove ALL subjects? This will delete all subjects and cannot be undone.';
            }
            
            // Set up the Yes button for this specific action
            const yesBtn = document.getElementById('confirmYesBtn');
            if (yesBtn) {
                yesBtn.textContent = 'Yes, Remove All';
                yesBtn.onclick = function() {
                    // Check if any subject is being used in classes
                    const subjectsInUse = allClasses.length > 0;
                    
                    if (subjectsInUse) {
                        hideModal('confirmModal');
                        showNotification('Cannot remove subjects because some are being used in classes. Clear all classes first.', 'error');
                        return;
                    }
                    
                    // Clear all subjects (empty the objects but keep the department keys)
                    for (const dept in subjectsByDepartment) {
                        if (subjectsByDepartment.hasOwnProperty(dept)) {
                            subjectsByDepartment[dept] = [];
                        }
                    }
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('subjectsByDepartment', JSON.stringify(subjectsByDepartment));
                    } catch (e) {
                        console.error('Error saving subjects to localStorage:', e);
                    }
                    
                    // Update subject dropdown if a department is selected
                    if (departmentSelect && departmentSelect.value) {
                        const selectedDepartment = departmentSelect.value;
                        
                        // Clear subject dropdown
                        if (subjectSelect) {
                            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                        }
                    }
                    
                    // Update the subjects list
                    populateSubjectsList();
                    
                    // Hide both modals
                    hideModal('confirmModal');
                    hideModal('manageSubjectsModal');
                    
                    // Show notification
                    showNotification('All subjects have been removed.', 'success');
                };
            }
            
            // Set up the No button
            const noBtn = document.getElementById('confirmNoBtn');
            if (noBtn) {
                noBtn.textContent = 'Cancel';
                noBtn.onclick = function() {
                    hideModal('confirmModal');
                };
            }
            
            showModal('confirmModal');
        });
    }
    
    // Unit load input validation (allow only numeric input)
    const unitLoadInput = document.getElementById('unitLoadInput');
    if (unitLoadInput) {
        // Validate input on keypress - allow only numbers and decimal point
        unitLoadInput.addEventListener('keypress', function(e) {
            // Allow: backspace, delete, tab, escape, enter
            if ([46, 8, 9, 27, 13, 110].indexOf(e.keyCode) !== -1 ||
                // Allow: decimal point (.)
                (e.keyCode === 190 || e.keyCode === 110) && !this.value.includes('.') ||
                // Allow: numbers
                (e.keyCode >= 48 && e.keyCode <= 57) ||
                // Allow: number pad
                (e.keyCode >= 96 && e.keyCode <= 105)) {
                // Let it happen, don't do anything
                return;
            }
            // Prevent non-numeric/non-decimal characters
            e.preventDefault();
        });
        
        // Additional validation on input change
        unitLoadInput.addEventListener('input', function() {
            // Remove any non-numeric characters except decimal point
            this.value = this.value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            const parts = this.value.split('.');
            if (parts.length > 2) {
                this.value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Validate the value is a valid number
            const unitLoadNumber = parseFloat(this.value);
            if (isNaN(unitLoadNumber) || unitLoadNumber <= 0) {
                this.parentElement.classList.add('error');
            } else {
                this.parentElement.classList.remove('error');
            }
        });
        
        // Final validation on blur to ensure it's a valid positive number
        unitLoadInput.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                // Default to 3 if empty
                this.value = '3';
                this.parentElement.classList.remove('error');
                return;
            }
            
            const unitLoadNumber = parseFloat(this.value);
            if (isNaN(unitLoadNumber) || unitLoadNumber <= 0) {
                // Reset to default if invalid
                this.value = '3';
                this.parentElement.classList.remove('error');
                showNotification('Invalid unit value. Reset to default (3).', 'error');
            }
        });    }
    
    // Check authentication and redirect if needed
    function checkAuthAndRedirect() {
        const authToken = localStorage.getItem('authToken');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
          // On fresh system, don't redirect - allow viewing
        // We'll set a default role of 'user' for viewing
        if (!authToken && !localStorage.getItem('demoUserData') && !localStorage.getItem('initialAccess')) {
            console.log('First access detected, setting default user role');
            localStorage.setItem('initialAccess', 'true');
            localStorage.setItem('userData', JSON.stringify({
                firstName: 'Guest',
                lastName: 'User',
                role: 'user',
                department: 'Mathematics'
            }));
        }
        
        // Get user info
        const userRole = userData.role || 'user';
        const userName = userData.firstName ? `${userData.firstName} ${userData.lastName}` : userData.email || 'User';
        
        // Check if user is pending approval
        if (userData.status === 'pending') {
            showPendingApprovalModal();
            return; // Don't proceed with normal authentication flow
        }
        
        // Update user name in header
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }
        
        // Add role indicator
        if (userRole) {
            const userMenu = document.querySelector('.user-menu');
            if (userMenu && !document.querySelector('.role-badge')) {
                const roleBadge = document.createElement('span');
                roleBadge.className = 'role-badge';
                roleBadge.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
                userMenu.insertBefore(roleBadge, userMenu.querySelector('.logout-btn'));
            }
        }
        
        // Setup logout functionality
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                localStorage.removeItem('demoUserData');
                window.location.href = 'login.html';
            });
        }
        
        // Modify UI based on role
        if (userRole === 'superadmin') {
            addAdminControls();
        } else if (userRole === 'admin') {
            addAdminControls(userData.department);
        } else {
            // Regular user - only show their department's data
            restrictToDepartment(userData.department);
        }
    }

    // Add admin controls to the interface
    function addAdminControls(department = null) {
        // Add admin navigation in header
        const header = document.querySelector('.header');
        if (header && !document.querySelector('.admin-nav')) {
            const adminNav = document.createElement('div');
            adminNav.className = 'admin-nav';
            
            // Move existing user-menu first (so it appears on the left)
            const userMenu = document.querySelector('.user-menu');
            
            // Append user menu only (dashboard link removed)
            if (userMenu) {
                adminNav.appendChild(userMenu);
            }
            
            header.appendChild(adminNav);
        }    }
    
    // Restrict UI to only show data for user's department
    function restrictToDepartment(department) {
        if (!department) return;
        
        console.log('Restricting UI for department:', department);
        
        // Regular users should only be able to view schedules, not create or modify them
        
        // Completely hide the schedule form panel
        const scheduleFormPanel = document.querySelector('.schedule-form');
        if (scheduleFormPanel) {
            scheduleFormPanel.style.display = 'none';
        }
        
        // Make the schedule view panel full width
        const scheduleViewPanel = document.querySelector('.schedule-view');
        if (scheduleViewPanel) {
            scheduleViewPanel.style.width = '100%';
            scheduleViewPanel.style.maxWidth = '100%';
            scheduleViewPanel.style.marginLeft = '0';
        }
        
        // Hide the department classes section
        const classesContainer = document.querySelector('.classes-container');
        if (classesContainer) {
            classesContainer.style.display = 'none';
        }
        
        // Disable all action buttons in the schedule view panel except print
        const actionButtons = document.querySelectorAll('.action-buttons button');
        actionButtons.forEach(button => {
            if (button.id !== 'printScheduleBtn') {
                button.style.display = 'none';
            }
        });
        
        // Hide any editing/deleting controls
        const allEditButtons = document.querySelectorAll('.edit-btn, .delete-btn, .add-btn, .remove-class-btn');
        
        // Filter calendar or timetable to show only this department's data
        filterCalendarByDepartment(department);
    }    // Helper function to filter calendar by department
    function filterCalendarByDepartment(department) {
        // This function filters the calendar/timetable data
        // to only show events related to the user's department
        console.log('Filtering calendar for department:', department);
        
        // Adjust calendar container for full view
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.style.height = 'calc(100vh - 150px)';
            calendarContainer.style.maxHeight = 'none';
        }
        
        // Update the calendar with proper filtering
        if (window.calendar) {
            // Force calendar to render at full size
            setTimeout(() => {
                try {
                    // Different methods to try rendering the calendar at full size
                    if (typeof window.calendar.render === 'function') {
                        window.calendar.render();
                    } else if (typeof window.calendar.renderEvents === 'function') {
                        window.calendar.renderEvents();
                    } else if (typeof window.calendar.rerenderEvents === 'function') {
                        window.calendar.rerenderEvents();
                    }
                } catch (e) {
                    console.log('Calendar re-render method not available:', e);
                }
            }, 100);
            
            // Filter events by department
            try {
                const events = window.calendar.getEvents();
                if (events && Array.isArray(events)) {
                    events.forEach(event => {
                        const eventData = event.extendedProps;
                        if (eventData && eventData.department && eventData.department !== department) {
                            event.remove(); // Remove events from other departments
                        }
                    });
                }
            } catch (e) {
                console.log('Error filtering events:', e);
            }        }
        
        // Also filter any DOM events if needed
        setTimeout(() => {
            // Give time for the calendar to render first
            const events = document.querySelectorAll('.fc-event');
            if (events.length) {
                events.forEach(event => {
                    try {
                        const eventDept = event.getAttribute('data-department');
                        if (eventDept && eventDept !== department) {
                            event.style.display = 'none';
                        }
                    } catch (e) {
                        console.log('Error processing event:', e);
                    }                });
            }
        }, 200);
        
        // Disable drag and drop for regular users in view-only mode
        if (window.calendar) {
            console.log("Applying strict view-only restrictions to calendar");
            // Completely disable all drag and drop capabilities
            try {
                // Using direct property access as backup in case setOption doesn't work
                if (typeof window.calendar.setOption === 'function') {
                    window.calendar.setOption('editable', false);
                    window.calendar.setOption('droppable', false);
                    window.calendar.setOption('eventStartEditable', false);
                    window.calendar.setOption('eventDurationEditable', false);
                    window.calendar.setOption('eventResizableFromStart', false);
                }
                
                // Direct property setting as a fallback
                window.calendar.editable = false;
                window.calendar.droppable = false;
                
                // Also apply CSS to make events non-draggable
                setTimeout(() => {
                    const eventElements = document.querySelectorAll('.fc-event');
                    eventElements.forEach(el => {
                        el.classList.add('nodrag');
                        el.style.pointerEvents = 'none';
                        el.style.cursor = 'default';
                    });
                }, 200);
            } catch (e) {
                console.warn("Could not set calendar editable options:", e);            }
              // Add helper text about view-only mode
            const calendarContainer = document.querySelector('.calendar-container');
            // Removed view-only help text
        }
    }
    
    // Function to show pending approval modal
    function showPendingApprovalModal() {
        // Remove any existing modal first
        const existingModal = document.getElementById('pendingApprovalModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modalHTML = `
            <div id="pendingApprovalModal" class="modal-overlay" style="display: flex; opacity: 0; visibility: hidden;">
                <div class="modal-container" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-clock"></i> Account Pending Approval</h3>
                        <button class="close-btn" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align: center; padding: 20px;">
                            <i class="fas fa-user-clock" style="font-size: 48px; color: #ffc107; margin-bottom: 20px;"></i>
                            <h4>Your account is pending approval</h4>
                            <p>Your account has been created successfully, but it requires approval from an administrator before you can access the system.</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>What happens next?</strong></p>
                                <ul style="text-align: left; margin: 10px 0;">
                                    <li>An administrator will review your account</li>
                                    <li>You will be notified once your account is approved</li>
                                    <li>You can then log in and access the system</li>
                                </ul>
                            </div>
                            <p style="color: #6c757d; font-size: 14px;">
                                <i class="fas fa-info-circle"></i> 
                                This process usually takes 24-48 hours. Thank you for your patience.
                            </p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" data-action="close">Understood</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = document.getElementById('pendingApprovalModal');
        if (modal) {
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Show modal with animation
            setTimeout(() => {
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                modal.classList.add('active');
            }, 10);
            
            // Add event listeners
            modal.addEventListener('click', (e) => {
                const target = e.target.closest('button[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                if (action === 'close') {
                    closePendingApprovalModal();
                }
            });
            
            // Click outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closePendingApprovalModal();
                }
            });
            
            // Escape key to close
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closePendingApprovalModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }
    
    // Function to close pending approval modal
    function closePendingApprovalModal() {
        const modal = document.getElementById('pendingApprovalModal');
        if (modal) {
            // Start fade out animation
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            modal.classList.remove('active');
            
            // Wait for animation to complete before removing
            setTimeout(() => {
                if (modal && modal.parentNode) {
                    modal.remove();
                }
                
                // Restore body scroll
                document.body.style.overflow = 'auto';
            }, 300);
        } else {
            // If modal doesn't exist, just restore body scroll
            document.body.style.overflow = 'auto';
        }
    }
    
    // Initialize Created Classes Modal
    initializeCreatedClassesModal();
    
    // Update classes count badge on page load
    updateClassesCountBadge();
    // Initialize generate schedule button handlers (moved button location)
    if (typeof initializeGenerateScheduleButton === 'function') {
        initializeGenerateScheduleButton();
    }
});

// Created Classes Modal Functions
function initializeCreatedClassesModal() {
    const viewClassesBtn = document.getElementById('viewCreatedClassesBtn');
    const modal = document.getElementById('createdClassesModal');
    const closeBtn = modal?.querySelector('[data-close-modal="createdClassesModal"]');
    
    if (viewClassesBtn && modal) {
        viewClassesBtn.addEventListener('click', function() {
            showCreatedClassesModal();
        });
    }
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', function() {
            hideModal('createdClassesModal');
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideModal('createdClassesModal');
            }
        });
    }
    
    // Handle close-modal buttons
    const closeModalButtons = modal?.querySelectorAll('.close-modal');
    if (closeModalButtons) {
        closeModalButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                hideModal('createdClassesModal');
            });
        });
    }
}

function showCreatedClassesModal() {
    const modal = document.getElementById('createdClassesModal');
    if (modal) {
        // Update modal content
        updateModalClassesList();
        updateModalStats();
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Add animation
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

// Create class element for modal display
function createClassElement(classData) {
    const classElement = document.createElement('div');
    classElement.className = 'class-item';
    classElement.style.cssText = `
        padding: 16px;
        margin-bottom: 12px;
        background: white;
        border-radius: 8px;
        border-left: 4px solid var(--primary-color);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    `;
    classElement.onmouseenter = function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.12)';
    };
    classElement.onmouseleave = function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
    };
    
    // Apply department color if available
    try {
        const deptColor = getDepartmentColorForClass(classData);
        classElement.style.borderLeftColor = deptColor;
    } catch (e) {
        console.warn('Could not apply department color to modal class element', e);
    }
    
    classElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-color);">${classData.subject || 'Unknown Subject'}</h3>
            <span style="background: var(--primary-color); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">
                ${classData.classType || 'lecture'}
            </span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 0.9rem; color: var(--dark-gray);">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-graduation-cap" style="color: var(--primary-color); width: 16px;"></i>
                <span>${classData.course || 'N/A'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-chalkboard-teacher" style="color: var(--primary-color); width: 16px;"></i>
                <span>${classData.faculty || 'N/A'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-clock" style="color: var(--primary-color); width: 16px;"></i>
                <span>${classData.unitLoad || 3} hours</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-building" style="color: var(--primary-color); width: 16px;"></i>
                <span>${classData.department || 'N/A'}</span>
            </div>
        </div>
    `;
    
    return classElement;
}

function updateModalClassesList() {
    const modalClassesList = document.getElementById('modalClassesList');
    if (!modalClassesList) return;
    
    if (window.allClasses && window.allClasses.length > 0) {
        modalClassesList.innerHTML = '';
        window.allClasses.forEach(classItem => {
            const classElement = createClassElement(classItem);
            modalClassesList.appendChild(classElement);
        });
    } else {
        modalClassesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus"></i>
                <h4>No classes created yet</h4>
                <p>Start by filling the form above to create your first class</p>
            </div>
        `;
    }
}

function updateModalStats() {
    const totalClasses = window.allClasses ? window.allClasses.length : 0;
    const totalHours = window.allClasses ? window.allClasses.reduce((sum, cls) => sum + (cls.unitLoad || 3), 0) : 0;
    const conflicts = 0; // You can implement conflict detection here
    
    const modalClassCount = document.getElementById('modalClassCount');
    const modalTotalHours = document.getElementById('modalTotalHours');
    const modalConflictCount = document.getElementById('modalConflictCount');
    
    if (modalClassCount) modalClassCount.textContent = totalClasses;
    if (modalTotalHours) modalTotalHours.textContent = totalHours;
    if (modalConflictCount) modalConflictCount.textContent = conflicts;
}

function updateClassesCountBadge() {
    const badge = document.getElementById('classesCountBadge');
    const count = window.allClasses ? window.allClasses.length : 0;
    if (badge) {
        badge.textContent = count;
    }
    
    // Also update the Generate Schedule button state
    updateGenerateScheduleButtonState();
}

// Initialize Generate Schedule Button
function initializeGenerateScheduleButton() {
    const generateScheduleBtn = document.getElementById('generateScheduleBtn');
    
    if (generateScheduleBtn) {
        // Add click event listener
        generateScheduleBtn.addEventListener('click', function() {
            console.log('Generate Schedule button clicked');
            generateSchedule();
        });
        
        // Update button state based on classes count
        updateGenerateScheduleButtonState();
    }
}

// Update Generate Schedule button state
function updateGenerateScheduleButtonState() {
    const generateScheduleBtn = document.getElementById('generateScheduleBtn');
    if (!generateScheduleBtn) return;
    
    const hasClasses = window.allClasses && window.allClasses.length > 0;
    
    if (hasClasses) {
        generateScheduleBtn.disabled = false;
        generateScheduleBtn.innerHTML = `
            <i class="fas fa-calendar-check"></i> Generate Schedule (${window.allClasses.length} classes)
        `;
    } else {
        generateScheduleBtn.disabled = true;
        generateScheduleBtn.innerHTML = `
            <i class="fas fa-calendar-check"></i> Generate Schedule
        `;
    }
}
