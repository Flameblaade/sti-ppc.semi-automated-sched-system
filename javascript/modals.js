// Modal Management
function initModals() {
    console.log('initModals function called');
    
    // Initialize subject modal
    initSubjectModal();
    
    // Initialize room modal
    initRoomModal();
    
    console.log('All modals initialized');
    const modal = document.getElementById('departmentModal');
    if (!modal) return;

    const form = document.getElementById('departmentForm');
    const closeBtn = document.getElementById('closeDepartmentModal');
    const cancelBtn = document.getElementById('cancelDepartment');

    // Close modal functions
    const closeModal = () => modal.style.display = 'none';
    
    // Event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const departmentData = {
            name: document.getElementById('departmentName').value,
            code: document.getElementById('departmentCode').value
        };
        
        try {
            const response = await fetchWithAuth('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(departmentData)
            });
            
            if (response.ok) {
                showNotification('Department added successfully', 'success');
                closeModal();
                loadEntityData(); // Refresh the data
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add department');
            }
        } catch (error) {
            console.error('Error adding department:', error);
            showNotification(error.message || 'An error occurred', 'error');
        }
    });
}

// Faculty Modal
function initFacultyModal() {
    const modal = document.getElementById('facultyModal');
    if (!modal) return;

    const form = document.getElementById('facultyForm');
    const closeBtn = document.getElementById('closeFacultyModal');
    const cancelBtn = document.getElementById('cancelFaculty');

    // Close modal functions
    const closeModal = () => modal.style.display = 'none';
    
    // Event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const facultyData = {
            name: document.getElementById('facultyName').value,
            email: document.getElementById('facultyEmail').value,
            departmentId: document.getElementById('facultyDepartment').value
        };
        
        try {
            const response = await fetchWithAuth('/api/faculty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(facultyData)
            });
            
            if (response.ok) {
                showNotification('Faculty added successfully', 'success');
                closeModal();
                loadEntityData(); // Refresh the data
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add faculty');
            }
        } catch (error) {
            console.error('Error adding faculty:', error);
            showNotification(error.message || 'An error occurred', 'error');
        }
    });
}

// Subject Modal
function initSubjectModal() {
    console.log('=== INITIALIZING SUBJECT MODAL ===');
    const modal = document.getElementById('subjectModal');
    console.log('Subject modal element found:', modal);
    if (!modal) {
        console.error('Subject modal not found!');
        return;
    }

    const form = document.getElementById('subjectForm');
    const closeBtn = document.getElementById('closeSubjectModal');
    const cancelBtn = document.getElementById('cancelSubject');
    
    console.log('Form element found:', form);
    console.log('Close button found:', closeBtn);
    console.log('Cancel button found:', cancelBtn);

    // Close modal function
    const closeModal = () => {
        modal.style.display = 'none';
        form.reset();
    };

    // Event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Add direct click handler to submit button for debugging
    const submitBtn = form.querySelector('button[type="submit"]');
    console.log('Submit button found:', submitBtn);
    if (submitBtn) {
        console.log('Adding click listener to submit button');
        submitBtn.addEventListener('click', (e) => {
            console.log('=== SUBMIT BUTTON CLICKED DIRECTLY ===');
            console.log('Button clicked:', e.target);
        });
    } else {
        console.error('Submit button not found!');
    }

    // Form submission - use both submit event and button click
    console.log('Adding form submit listener...');
    
    // Create the form submission handler function
    const handleSubjectFormSubmit = async (e) => {
        console.log('=== SUBJECT FORM SUBMITTED ===');
        console.log('Form element:', form);
        console.log('Form action:', form.action);
        console.log('Form method:', form.method);
        e.preventDefault();
        
        // Debug form fields
        const nameField = document.getElementById('subjectName');
        const codeField = document.getElementById('subjectCode');
        const deptField = document.getElementById('subjectDepartment');
        const unitsField = document.getElementById('subjectUnits');
        
        console.log('Form fields found:');
        console.log('- subjectName:', nameField, nameField?.value);
        console.log('- subjectCode:', codeField, codeField?.value);
        console.log('- subjectDepartment:', deptField, deptField?.value);
        console.log('- subjectUnits:', unitsField, unitsField?.value);

        const subjectData = {
            name: nameField?.value?.trim() || '',
            code: codeField?.value?.trim().toUpperCase() || '',
            departmentId: deptField?.value || '',
            units: parseInt(unitsField?.value) || 1
        };

        console.log('Subject data collected:', subjectData);

        // Validate required fields
        if (!subjectData.name || !subjectData.code || !subjectData.departmentId) {
            console.log('Validation failed - missing required fields');
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        try {
            console.log('Starting subject save process...');
            
            // Get existing subjects
            const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            console.log('Existing subjects before save:', subjects.length);
            
            // Check if subject code already exists
            if (subjects.some(s => s.code === subjectData.code)) {
                console.log('Subject code already exists:', subjectData.code);
                showNotification('Subject code already exists', 'error');
                return;
            }
            
            // Create new subject with ID
            const newSubject = {
                id: 'subject-' + Date.now(),
                ...subjectData
            };
            console.log('New subject created:', newSubject);
            
            // Add to subjects array
            subjects.push(newSubject);
            console.log('Subject added to array, total subjects:', subjects.length);
            
            // Save to localStorage
            localStorage.setItem('subjects', JSON.stringify(subjects));
            console.log('Subject saved to localStorage');
            console.log('All subjects after save:', subjects);
            
            // Verify save
            const savedSubjects = JSON.parse(localStorage.getItem('subjects') || '[]');
            console.log('Verification - subjects in localStorage:', savedSubjects.length);
            console.log('Verification - all subjects:', savedSubjects);
            
            // Show success message
            showNotification('Subject added successfully', 'success');
            
            // Close modal and reset form
            closeModal();
            
            // Refresh the subject list
            console.log('Attempting to refresh subject list...');
            if (typeof window.loadSubjects === 'function') {
                console.log('Calling window.loadSubjects()');
                window.loadSubjects();
            } else if (typeof loadSubjects === 'function') {
                console.log('Calling loadSubjects()');
                loadSubjects();
            } else if (typeof window.loadEntityData === 'function') {
                console.log('Calling window.loadEntityData()');
                window.loadEntityData();
            } else {
                console.log('No refresh function found, reloading page');
                window.location.reload();
            }
            
        } catch (error) {
            console.error('Error adding subject:', error);
            showNotification('Failed to add subject', 'error');
        }
    };
    
    // Add submit button click handler as backup
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        console.log('Adding click listener to submit button as backup');
        submitButton.addEventListener('click', async (e) => {
            console.log('=== SUBMIT BUTTON CLICKED (BACKUP HANDLER) ===');
            e.preventDefault();
            await handleSubjectFormSubmit(e);
        });
    }
    
    // Main form submit handler
    form?.addEventListener('submit', handleSubjectFormSubmit);
    
    console.log('=== SUBJECT MODAL INITIALIZATION COMPLETE ===');
}

// Course/Strand Modal
function initCourseModal() {
    const modal = document.getElementById('courseModal');
    if (!modal) return;

    const form = document.getElementById('courseForm');
    const closeBtn = document.getElementById('closeCourseModal');
    const cancelBtn = document.getElementById('cancelCourse');

    // Close modal functions
    const closeModal = () => modal.style.display = 'none';
    
    // Event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Form submission
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const courseData = {
            name: document.getElementById('courseName').value.trim(),
            code: document.getElementById('courseCode').value.trim().toUpperCase(),
            type: document.getElementById('courseType').value,
            departmentId: document.getElementById('courseDepartment').value
        };
        
        // Validate required fields
        if (!courseData.name || !courseData.code || !courseData.departmentId) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        try {
            // Try server first
            let saved = false;
            try {
                const response = await fetchWithAuth('/api/courses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(courseData)
                });
                
                if (response && response.ok) {
                    saved = true;
                    const newCourse = await response.json();
                    console.log('Course saved to server successfully', newCourse);
                    
                    // Update the UI by reloading the course list
                    if (typeof loadEntityData === 'function') {
                        loadEntityData('course');
                    }
                    
                    // Close the modal and show success message
                    closeModal();
                    showNotification('Program/Strand added successfully', 'success');
                    
                    // Reset the form
                    form.reset();
                    return;
                } else {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.message || 'Failed to save course');
                }
            } catch (serverError) {
                console.warn('Server save failed, falling back to localStorage:', serverError);
            }
            
            // Fallback to localStorage if server failed
            if (!saved) {
                const courses = JSON.parse(localStorage.getItem('courses') || '[]');
                
                // Check if course code already exists
                if (courses.some(c => c.code === courseData.code)) {
                    showNotification('Course code already exists', 'error');
                    return;
                }
                
                // Create new course with ID
                const newCourse = {
                    ...courseData,
                    id: `course-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Save to localStorage
                courses.push(newCourse);
                localStorage.setItem('courses', JSON.stringify(courses));
                console.log('Course saved to localStorage:', newCourse);
                
                // Update the UI by reloading the course list
                if (typeof loadEntityData === 'function') {
                    loadEntityData('course');
                }
                
                // Close the modal and show success message
                closeModal();
                showNotification('Program/Strand added successfully (saved locally)', 'success');
                
                // Reset the form
                form.reset();
            }
            
            showNotification('Program/Strand added successfully', 'success');
            closeModal();
            form.reset();
            
            // Refresh the data
            if (typeof loadEntityData === 'function') {
                loadEntityData();
            } else if (typeof window.loadEntityData === 'function') {
                window.loadEntityData();
            }
            
        } catch (error) {
            console.error('Error adding program/strand:', error);
            showNotification('Failed to add program/strand', 'error');
        }
    });
}

// Room Modal
function initRoomModal() {
    const modal = document.getElementById('roomModal');
    if (!modal) return;

    const form = document.getElementById('roomForm');
    const closeBtn = document.getElementById('closeRoomModal');
    const cancelBtn = document.getElementById('cancelRoom');

    // Close modal functions
    const closeModal = () => modal.style.display = 'none';
    
    // Event listeners
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Close when clicking outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Form submission
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Call the saveRoom function from superadmin.js
        if (typeof saveRoom === 'function') {
            // Ensure the form fields are properly set
            const roomName = document.getElementById('roomName');
            const roomCapacity = document.getElementById('roomCapacity');
            const roomType = document.getElementById('roomType');
            const roomPriorityToggle = document.getElementById('roomHasPriority');
            const roomPriority = document.getElementById('roomPriority');
            const roomDepartment = document.getElementById('roomDepartment');
            
            if (!roomName || !roomCapacity) {
                showNotification('Error: Could not find room form fields', 'error');
                return;
            }
            
            // Validate required fields
            if (!roomName.value.trim() || !roomCapacity.value || parseInt(roomCapacity.value) < 1) {
                showNotification('Please fill in all required fields with valid values', 'error');
                return;
            }

            // If priority toggle/select is present and selected, require priority and department
            const prioritySelected = !!(roomPriorityToggle && (roomPriorityToggle.checked)) || !!(roomPriority && roomPriority.value);
            if (prioritySelected) {
                if (roomPriority && !roomPriority.value) {
                    showNotification('Please choose a room priority', 'error');
                    return;
                }
                if (roomDepartment && !roomDepartment.value) {
                    showNotification('Please select a department for priority rooms', 'error');
                    return;
                }
            }
            
            // Call the saveRoom function
            saveRoom();
        } else {
            console.error('saveRoom function not found in superadmin.js');
            showNotification('Error: Could not save room', 'error');
        }
    });

    // Priority toggle logic: show/hide priority + department controls if present
    const roomPriorityToggle = document.getElementById('roomHasPriority');
    const roomPriorityWrapper = document.getElementById('roomPriorityWrapper');
    const roomDeptWrapper = document.getElementById('roomDepartmentWrapper');
    const roomPriority = document.getElementById('roomPriority');
    const roomDepartment = document.getElementById('roomDepartment');

    const updatePriorityVisibility = () => {
        const enabled = roomPriorityToggle ? roomPriorityToggle.checked : !!(roomPriority && roomPriority.value);
        if (roomPriorityWrapper) roomPriorityWrapper.style.display = enabled ? 'block' : 'none';
        if (roomDeptWrapper) roomDeptWrapper.style.display = enabled ? 'block' : 'none';
    };

    if (roomPriorityToggle) {
        roomPriorityToggle.addEventListener('change', updatePriorityVisibility);
        updatePriorityVisibility();
    }

    // Populate department dropdown if present using the helper in superadmin.js
    if (roomDepartment) {
        if (typeof window.loadDepartmentsForDropdown === 'function') {
            window.loadDepartmentsForDropdown(roomDepartment).catch(err => console.warn('Dept load failed:', err));
        } else if (typeof window.populateDepartmentDropdown === 'function') {
            // fallback to older util that takes selectId
            window.populateDepartmentDropdown('roomDepartment').catch?.(err => console.warn('Dept populate failed:', err));
        } else {
            // fallback to localStorage
            try {
                const departments = JSON.parse(localStorage.getItem('departments') || '[]');
                // keep first placeholder option, append others
                const hasPlaceholder = roomDepartment.options.length > 0;
                if (!hasPlaceholder) {
                    const ph = document.createElement('option');
                    ph.value = '';
                    ph.textContent = 'Select Department';
                    ph.disabled = true;
                    ph.selected = true;
                    roomDepartment.appendChild(ph);
                }
                departments.forEach(dept => {
                    const opt = document.createElement('option');
                    opt.value = dept.id || dept.code;
                    opt.textContent = dept.name || dept.code;
                    roomDepartment.appendChild(opt);
                });
            } catch (e) {
                console.warn('Local department populate failed:', e);
            }
        }
    }
}

// The showModal and closeModal functions are defined in superadmin.js
// to avoid duplicate function declarations and ensure consistent behavior.
