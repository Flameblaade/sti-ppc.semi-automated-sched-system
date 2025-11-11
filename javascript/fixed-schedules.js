// Fixed Schedules Management
(function() {
    // Initialize fixed schedules array
    let fixedSchedules = [];
    
    // Load fixed schedules from server (with localStorage fallback)
    async function loadFixedSchedules() {
        try {
            // Try to load from server first
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch('/api/fixed-schedules', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (response.ok) {
                        const serverSchedules = await response.json();
                        if (Array.isArray(serverSchedules)) {
                            fixedSchedules = serverSchedules;
                            // Also save to localStorage as cache
                            localStorage.setItem('fixedSchedules', JSON.stringify(fixedSchedules));
                            console.log('Loaded', fixedSchedules.length, 'fixed schedules from server');
                            return fixedSchedules;
                        }
                    }
                } catch (serverError) {
                    console.warn('Failed to load fixed schedules from server, trying localStorage:', serverError);
                }
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('fixedSchedules');
            if (saved) {
                fixedSchedules = JSON.parse(saved);
                console.log('Loaded', fixedSchedules.length, 'fixed schedules from localStorage (fallback)');
            } else {
                fixedSchedules = [];
            }
        } catch (e) {
            console.error('Error loading fixed schedules:', e);
            fixedSchedules = [];
        }
        return fixedSchedules;
    }
    
    // Save fixed schedules to server and localStorage
    async function saveFixedSchedules() {
        try {
            // Save to localStorage first (for immediate access)
            localStorage.setItem('fixedSchedules', JSON.stringify(fixedSchedules));
            
            // Save to server (if user is admin/superadmin)
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch('/api/fixed-schedules', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ schedules: fixedSchedules })
                    });
                    
                    if (response.ok) {
                        console.log('Saved', fixedSchedules.length, 'fixed schedules to server');
                    } else {
                        // If not admin, that's okay - just log it
                        if (response.status === 403) {
                            console.log('User does not have permission to save fixed schedules to server (view-only)');
                        } else {
                            console.warn('Failed to save fixed schedules to server:', response.status);
                        }
                    }
                } catch (serverError) {
                    console.warn('Error saving fixed schedules to server:', serverError);
                    // Continue anyway - localStorage is saved
                }
            }
        } catch (e) {
            console.error('Error saving fixed schedules:', e);
        }
    }
    
    // Convert day name to day index (0 = Sunday, 1 = Monday, etc.)
    function dayNameToIndex(dayName) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days.indexOf(dayName);
    }
    
    // Get the date for a specific day of the current week
    function getDateForDay(dayName) {
        const today = new Date();
        const currentDay = today.getDay();
        const targetDay = dayNameToIndex(dayName);
        
        // Calculate days to add
        let daysToAdd = targetDay - currentDay;
        
        // If today is Sunday (0) and we want Monday-Saturday, move to next week
        if (currentDay === 0 && targetDay >= 1) {
            daysToAdd = targetDay;
        }
        
        // If target day is in the past this week, move to next week
        if (daysToAdd < 0) {
            daysToAdd += 7;
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysToAdd);
        targetDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        
        return targetDate;
    }
    
    // Add fixed schedule to calendar
    function addFixedScheduleToCalendar(schedule) {
        if (!window.calendar) return;
        
        const dayDate = getDateForDay(schedule.day);
        const [startHours, startMinutes] = schedule.startTime.split(':').map(Number);
        const [endHours, endMinutes] = schedule.endTime.split(':').map(Number);
        
        const startDate = new Date(dayDate);
        startDate.setHours(startHours, startMinutes, 0, 0);
        
        const endDate = new Date(dayDate);
        endDate.setHours(endHours, endMinutes, 0, 0);
        
        // Create event with special class to identify it as fixed schedule
        // Use checkmark icon if schedule allows classes, X mark if it blocks classes
        const icon = schedule.allowClasses ? '✓' : '✗';
        const event = {
            id: schedule.id,
            title: `${icon} ${schedule.name}`,
            start: startDate,
            end: endDate,
            backgroundColor: schedule.allowClasses ? '#4caf50' : '#ff9800',
            borderColor: schedule.allowClasses ? '#388e3c' : '#f57c00',
            textColor: '#ffffff',
            classNames: ['fixed-schedule-event'],
            extendedProps: {
                isFixedSchedule: true,
                allowClasses: schedule.allowClasses,
                scheduleId: schedule.id
            },
            editable: false, // Fixed schedules cannot be moved
            startEditable: false,
            durationEditable: false,
            resourceEditable: false,
            display: 'block'
        };
        
        const addedEvent = window.calendar.addEvent(event);
        
        // Ensure it stays non-editable even after calendar refresh
        if (addedEvent) {
            addedEvent.setProp('editable', false);
            addedEvent.setProp('startEditable', false);
            addedEvent.setProp('durationEditable', false);
        }
    }
    
    // Load all fixed schedules to calendar
    function loadFixedSchedulesToCalendar() {
        if (!window.calendar) return;
        
        // Remove existing fixed schedule events
        const existingEvents = window.calendar.getEvents();
        existingEvents.forEach(event => {
            if (event.extendedProps?.isFixedSchedule) {
                event.remove();
            }
        });
        
        // Add all fixed schedules
        fixedSchedules.forEach(schedule => {
            addFixedScheduleToCalendar(schedule);
        });
    }
    
    // Check if a time conflicts with a fixed schedule that doesn't allow classes
    window.checkFixedScheduleConflict = function(startTime, endTime, dayOfWeek) {
        const dayName = dayOfWeek || (startTime ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startTime.getDay()] : null);
        
        if (!dayName) return false;
        
        for (const schedule of fixedSchedules) {
            if (schedule.day !== dayName) continue;
            if (schedule.allowClasses) continue; // This schedule allows classes, no conflict
            
            // Parse schedule times
            const [scheduleStartH, scheduleStartM] = schedule.startTime.split(':').map(Number);
            const [scheduleEndH, scheduleEndM] = schedule.endTime.split(':').map(Number);
            
            const scheduleStart = scheduleStartH * 60 + scheduleStartM; // minutes from midnight
            const scheduleEnd = scheduleEndH * 60 + scheduleEndM;
            
            // Parse event times
            const eventStart = startTime.getHours() * 60 + startTime.getMinutes();
            const eventEnd = endTime.getHours() * 60 + endTime.getMinutes();
            
            // Check for overlap
            if (eventStart < scheduleEnd && eventEnd > scheduleStart) {
                return {
                    conflict: true,
                    scheduleName: schedule.name,
                    scheduleTime: `${schedule.startTime} - ${schedule.endTime}`
                };
            }
        }
        
        return false;
    };
    
    // Convert 24-hour time to 12-hour format with AM/PM
    function formatTime12Hour(time24) {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        return `${displayHours}:${String(minutes || 0).padStart(2, '0')} ${period}`;
    }
    
    // Render fixed schedules list
    function renderFixedSchedulesList() {
        const listContainer = document.getElementById('fixedSchedulesList');
        if (!listContainer) return;
        
        if (fixedSchedules.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No fixed schedules yet. Click "Add New" to create one.</p>
                </div>
            `;
            return;
        }
        
        // Clear existing content
        listContainer.innerHTML = '';
        
        // Create elements for each schedule
        fixedSchedules.forEach(schedule => {
            const scheduleDiv = document.createElement('div');
            scheduleDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #ff9800;';
            
            const infoDiv = document.createElement('div');
            infoDiv.style.flex = '1';
            const startTime12 = formatTime12Hour(schedule.startTime);
            const endTime12 = formatTime12Hour(schedule.endTime);
            infoDiv.innerHTML = `
                <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${schedule.name || 'Unnamed Schedule'}</div>
                <div style="font-size: 0.85rem; color: #666;">
                    <i class="fas fa-calendar-day"></i> ${schedule.day || 'N/A'} | 
                    <i class="fas fa-clock"></i> ${startTime12} - ${endTime12} |
                    <i class="fas fa-${schedule.allowClasses ? 'check-circle' : 'times-circle'}" style="color: ${schedule.allowClasses ? '#4caf50' : '#f44336'};"></i> 
                    ${schedule.allowClasses ? 'Allows classes' : 'Blocks classes'}
                </div>
            `;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.style.cssText = 'margin-left: 10px; padding: 5px 10px;';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', function() {
                if (typeof window.deleteFixedSchedule === 'function') {
                    window.deleteFixedSchedule(schedule.id);
                }
            });
            
            scheduleDiv.appendChild(infoDiv);
            scheduleDiv.appendChild(deleteBtn);
            listContainer.appendChild(scheduleDiv);
        });
    }
    
    // Delete fixed schedule
    window.deleteFixedSchedule = function(scheduleId) {
        const schedule = fixedSchedules.find(s => s.id === scheduleId);
        const scheduleName = schedule ? schedule.name : 'this fixed schedule';
        
        // Show delete confirmation modal
        const deleteModal = document.getElementById('deleteFixedScheduleModal');
        const messageEl = document.getElementById('deleteFixedScheduleMessage');
        
        if (deleteModal && messageEl) {
            messageEl.textContent = `This action will permanently delete "${scheduleName}". This cannot be undone.`;
            deleteModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Set up confirm button
            const confirmBtn = document.getElementById('confirmDeleteFixedScheduleBtn');
            const cancelBtn = document.getElementById('cancelDeleteFixedScheduleBtn');
            
            // Remove existing listeners by cloning
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Add new listener
            newConfirmBtn.addEventListener('click', async function() {
                // Remove from array
                fixedSchedules = fixedSchedules.filter(s => s.id !== scheduleId);
                
                // Save to server and localStorage
                await saveFixedSchedules();
                
                // Also try to delete from server directly (if admin)
                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        const response = await fetch(`/api/fixed-schedules/${scheduleId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (response.ok) {
                            console.log('Fixed schedule deleted from server');
                        }
                    } catch (e) {
                        console.warn('Error deleting fixed schedule from server:', e);
                    }
                }
                
                // Remove from calendar if it exists
                if (window.calendar) {
                    const events = window.calendar.getEvents();
                    events.forEach(event => {
                        if (event.extendedProps?.scheduleId === scheduleId || event.id === scheduleId) {
                            event.remove();
                        }
                    });
                }
                
                // Refresh the list
                renderFixedSchedulesList();
                
                // Close modal
                deleteModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                
                if (typeof showNotification === 'function') {
                    showNotification('Fixed schedule deleted successfully', 'success');
                }
            });
            
            // Cancel button
            newCancelBtn.addEventListener('click', function() {
                deleteModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
            
            // Close modal handlers
            document.querySelectorAll('[data-close-modal="deleteFixedScheduleModal"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                });
            });
            
            // Close on backdrop click
            deleteModal.addEventListener('click', function(e) {
                if (e.target === deleteModal) {
                    deleteModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        }
    };
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', async function() {
        // Load fixed schedules from server
        await loadFixedSchedules();
        
        // Render fixed schedules list on page load
        renderFixedSchedulesList();
        
        const addFixedScheduleBtn = document.getElementById('addFixedScheduleBtn');
        const addFixedScheduleFormContainer = document.getElementById('addFixedScheduleFormContainer');
        const saveFixedScheduleBtn = document.getElementById('saveFixedScheduleBtn');
        const cancelAddFixedScheduleBtn = document.getElementById('cancelAddFixedScheduleBtn');
        const fixedScheduleForm = document.getElementById('fixedScheduleForm');
        
        // Show add form when "Add New" is clicked
        if (addFixedScheduleBtn) {
            addFixedScheduleBtn.addEventListener('click', function() {
                if (addFixedScheduleFormContainer) {
                    addFixedScheduleFormContainer.style.display = 'block';
                    fixedScheduleForm.reset();
                    document.getElementById('fixedScheduleAllowClasses').checked = true;
                }
                // Scroll to form
                addFixedScheduleFormContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
        
        // Cancel add form
        if (cancelAddFixedScheduleBtn) {
            cancelAddFixedScheduleBtn.addEventListener('click', function() {
                if (addFixedScheduleFormContainer) {
                    addFixedScheduleFormContainer.style.display = 'none';
                    fixedScheduleForm.reset();
                }
            });
        }
        
        // Save fixed schedule
        if (saveFixedScheduleBtn && fixedScheduleForm) {
            saveFixedScheduleBtn.addEventListener('click', async function() {
                const name = document.getElementById('fixedScheduleName').value.trim();
                const day = document.getElementById('fixedScheduleDay').value;
                const startTime = document.getElementById('fixedScheduleStartTime').value;
                const endTime = document.getElementById('fixedScheduleEndTime').value;
                const allowClasses = document.getElementById('fixedScheduleAllowClasses').checked;
                
                if (!name || !day || !startTime || !endTime) {
                    if (typeof showNotification === 'function') {
                        showNotification('Please fill in all required fields', 'error');
                    } else {
                        alert('Please fill in all required fields');
                    }
                    return;
                }
                
                if (startTime >= endTime) {
                    if (typeof showNotification === 'function') {
                        showNotification('End time must be after start time', 'error');
                    } else {
                        alert('End time must be after start time');
                    }
                    return;
                }
                
                // Create schedule object
                const schedule = {
                    id: 'fixed-' + Date.now(),
                    name: name,
                    day: day,
                    startTime: startTime,
                    endTime: endTime,
                    allowClasses: allowClasses
                };
                
                // Add to array
                fixedSchedules.push(schedule);
                await saveFixedSchedules();
                
                // DO NOT add to calendar immediately - only when Generate Schedule is clicked
                // The calendar will be populated when generateSchedule() is called
                
                // Reset form and hide it
                fixedScheduleForm.reset();
                if (addFixedScheduleFormContainer) {
                    addFixedScheduleFormContainer.style.display = 'none';
                }
                
                // Refresh list immediately so it appears in the list
                renderFixedSchedulesList();
                
                // Show notification
                if (typeof showNotification === 'function') {
                    showNotification('Fixed schedule added successfully. It will appear in the timetable when you click "Generate Schedule".', 'success');
                }
            });
        }
        
        // Advanced Filter functionality - REMOVED per user request
        // Filter functionality has been disabled
        
        // Filter functions removed - no longer needed
        /*
        // Function to load filter options based on type
        async function loadFilterOptions(filterType) {
            if (!scheduleFilterValue) return;
            
            scheduleFilterValue.innerHTML = '<option value="">Loading...</option>';
            scheduleFilterValue.disabled = true;
            
            try {
                let options = [];
                
                if (filterType === 'department') {
                    scheduleFilterValueLabel.textContent = 'Select Department:';
                    const token = localStorage.getItem('authToken');
                    const response = await fetch('/api/departments', {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    if (response.ok) {
                        const departments = await response.json();
                        options = departments.map(dept => ({
                            value: dept.id || dept.code, // Use ID as primary value
                            text: `${dept.code || ''} - ${dept.name || ''}`.trim(),
                            deptId: dept.id,
                            deptCode: dept.code,
                            deptName: dept.name
                        }));
                    }
                } else if (filterType === 'faculty') {
                    scheduleFilterValueLabel.textContent = 'Select Faculty:';
                    const token = localStorage.getItem('authToken');
                    const response = await fetch('/api/faculty', {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    if (response.ok) {
                        const faculty = await response.json();
                        options = faculty.map(f => ({
                            value: f.email || f.id || f.name,
                            text: `${f.firstName || ''} ${f.lastName || ''}`.trim() || f.email || f.name
                        }));
                    }
                } else if (filterType === 'program') {
                    scheduleFilterValueLabel.textContent = 'Select Program:';
                    try {
                        // Try to load from server first
                        const token = localStorage.getItem('authToken');
                        let courses = [];
                        
                        try {
                            const response = await fetch('/api/courses', {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                            });
                            if (response.ok) {
                                courses = await response.json();
                            }
                        } catch (e) {
                            console.warn('Failed to load courses from server, trying localStorage:', e);
                        }
                        
                        // Fallback to localStorage
                        if (!courses || courses.length === 0) {
                            courses = JSON.parse(localStorage.getItem('courses') || '[]');
                        }
                        
                        const allCourses = courses.filter(c => (c.type || 'course') === 'course');
                        options = allCourses.map(c => ({
                            value: c.id || c.code,
                            text: `${c.code || ''} - ${c.name || ''}`.trim()
                        }));
                    } catch (e) {
                        console.error('Error loading programs:', e);
                    }
                } else if (filterType === 'strand') {
                    scheduleFilterValueLabel.textContent = 'Select Strand:';
                    try {
                        // Try to load from server first
                        const token = localStorage.getItem('authToken');
                        let strands = [];
                        
                        try {
                            const response = await fetch('/api/strands', {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                            });
                            if (response.ok) {
                                strands = await response.json();
                            }
                        } catch (e) {
                            console.warn('Failed to load strands from server, trying localStorage:', e);
                        }
                        
                        // Fallback to localStorage
                        if (!strands || strands.length === 0) {
                            strands = JSON.parse(localStorage.getItem('strands') || '[]');
                        }
                        
                        const allStrands = strands.filter(s => (s.type || 'strand') === 'strand');
                        options = allStrands.map(s => ({
                            value: s.id || s.code,
                            text: `${s.code || ''} - ${s.name || ''}`.trim()
                        }));
                    } catch (e) {
                        console.error('Error loading strands:', e);
                    }
                }
                
                scheduleFilterValue.innerHTML = '<option value="">All</option>';
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.text;
                    scheduleFilterValue.appendChild(option);
                });
                
                scheduleFilterValue.disabled = false;
            } catch (error) {
                console.error('Error loading filter options:', error);
                scheduleFilterValue.innerHTML = '<option value="">Error loading options</option>';
            }
        }
        
        // Function to apply filter
        async function applyFilter() {
            if (!scheduleFilterType || !window.calendar) {
                console.log('Filter: Calendar or filter type not available');
                return;
            }
            
            const filterType = scheduleFilterType.value || 'all';
            const filterValue = scheduleFilterValue?.value || '';
            const events = window.calendar.getEvents();
            
            console.log(`Applying filter: type=${filterType}, value=${filterValue}, events=${events.length}`);
            
            // Pre-fetch department data if filtering by department
            let departmentsData = null;
            if (filterType === 'department' && filterValue) {
                try {
                    const token = localStorage.getItem('authToken');
                    const response = await fetch('/api/departments', {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    if (response.ok) {
                        departmentsData = await response.json();
                    }
                } catch (e) {
                    console.warn('Error fetching departments for filter:', e);
                }
            }
            
            let shownCount = 0;
            let hiddenCount = 0;
            
            for (const event of events) {
                const extendedProps = event.extendedProps || {};
                const isFixed = extendedProps.isFixedSchedule || false;
                
                // ALWAYS show fixed schedules regardless of filter
                if (isFixed) {
                    const eventEl = event.el;
                    if (eventEl) {
                        eventEl.classList.remove('filtered-out');
                        eventEl.style.display = '';
                    }
                    // Also try to find by event ID if el is not available
                    if (!eventEl) {
                        setTimeout(() => {
                            const elById = document.querySelector(`[data-event-id="${event.id}"]`);
                            if (elById) {
                                elById.classList.remove('filtered-out');
                                elById.style.display = '';
                            }
                        }, 100);
                    }
                    shownCount++;
                    continue;
                }
                
                let shouldShow = true;
                
                if (filterType === 'all') {
                    shouldShow = true;
                } else if (filterType === 'department') {
                    if (filterValue) {
                        const eventDeptId = String(extendedProps.departmentId || '').trim();
                        const eventDept = String(extendedProps.department || extendedProps.course || '').trim();
                        const filterDept = String(filterValue).trim();
                        
                        // Exact match on ID (case-insensitive) - this is the primary match
                        const eventDeptIdLower = eventDeptId.toLowerCase();
                        const filterDeptLower = filterDept.toLowerCase();
                        const eventDeptLower = eventDept ? eventDept.toLowerCase() : '';
                        
                        // Check exact ID match first (most reliable)
                        shouldShow = (eventDeptIdLower === filterDeptLower);
                        
                        // If ID doesn't match, try matching by department name/code using pre-fetched data
                        if (!shouldShow && departmentsData) {
                            const selectedDept = departmentsData.find(d => 
                                String(d.id || '').trim().toLowerCase() === filterDeptLower ||
                                String(d.code || '').trim().toLowerCase() === filterDeptLower
                            );
                            
                            if (selectedDept) {
                                const selectedDeptId = String(selectedDept.id || '').trim().toLowerCase();
                                const selectedDeptCode = String(selectedDept.code || '').trim().toLowerCase();
                                const selectedDeptName = String(selectedDept.name || '').trim().toLowerCase();
                                
                                // Match if event's department ID/code/name matches selected department
                                shouldShow = (
                                    eventDeptIdLower === selectedDeptId ||
                                    eventDeptIdLower === selectedDeptCode ||
                                    eventDeptLower === selectedDeptName ||
                                    eventDeptLower === selectedDeptCode ||
                                    eventDeptLower === selectedDeptId
                                );
                            }
                        }
                        
                        // Also try direct matching if departmentsData is not available
                        if (!shouldShow && !departmentsData) {
                            // Try to match event department name/code directly with filter value
                            shouldShow = (
                                eventDeptIdLower === filterDeptLower ||
                                eventDeptLower === filterDeptLower
                            );
                        }
                        
                        if (!shouldShow) {
                            console.log(`HIDING event: "${event.title}" - eventDeptId="${eventDeptId}", eventDept="${eventDept}", filterDept="${filterDept}"`);
                        } else {
                            console.log(`SHOWING event: "${event.title}" - eventDeptId="${eventDeptId}", eventDept="${eventDept}", filterDept="${filterDept}"`);
                        }
                    } else {
                        shouldShow = true;
                    }
                } else if (filterType === 'faculty') {
                    if (filterValue) {
                        const eventFaculty = String(extendedProps.faculty || '').trim().toLowerCase();
                        const filterFaculty = String(filterValue).trim().toLowerCase();
                        // Exact match only - no partial matching
                        shouldShow = (eventFaculty === filterFaculty);
                        
                        if (!shouldShow) {
                            console.log(`HIDING event: "${event.title}" - eventFaculty="${eventFaculty}", filterFaculty="${filterFaculty}"`);
                        }
                    } else {
                        shouldShow = true;
                    }
                } else if (filterType === 'program') {
                    if (filterValue) {
                        const eventCourseId = String(extendedProps.courseId || '').trim().toLowerCase();
                        const filterProgram = String(filterValue).trim().toLowerCase();
                        
                        // Primary match: exact courseId match
                        shouldShow = (eventCourseId === filterProgram);
                        
                        // If no match, try to match by program name/code
                        if (!shouldShow) {
                            try {
                                const courses = JSON.parse(localStorage.getItem('courses') || '[]');
                                const program = courses.find(c => 
                                    String(c.id || '').trim().toLowerCase() === filterProgram ||
                                    String(c.code || '').trim().toLowerCase() === filterProgram
                                );
                                
                                if (program) {
                                    const programId = String(program.id || '').trim().toLowerCase();
                                    const programCode = String(program.code || '').trim().toLowerCase();
                                    // Exact match only
                                    shouldShow = (
                                        eventCourseId === programId ||
                                        eventCourseId === programCode
                                    );
                                }
                            } catch (e) {
                                console.warn('Error matching program:', e);
                            }
                        }
                        
                        if (!shouldShow) {
                            console.log(`HIDING event: "${event.title}" - eventCourseId="${eventCourseId}", filterProgram="${filterProgram}"`);
                        }
                    } else {
                        shouldShow = true;
                    }
                } else if (filterType === 'strand') {
                    if (filterValue) {
                        const eventCourseId = String(extendedProps.courseId || '').trim().toLowerCase();
                        const filterStrand = String(filterValue).trim().toLowerCase();
                        
                        // Primary match: exact courseId match
                        shouldShow = (eventCourseId === filterStrand);
                        
                        // If no match, try to match by strand name/code
                        if (!shouldShow) {
                            try {
                                const strands = JSON.parse(localStorage.getItem('strands') || '[]');
                                const strand = strands.find(s => 
                                    String(s.id || '').trim().toLowerCase() === filterStrand ||
                                    String(s.code || '').trim().toLowerCase() === filterStrand
                                );
                                
                                if (strand) {
                                    const strandId = String(strand.id || '').trim().toLowerCase();
                                    const strandCode = String(strand.code || '').trim().toLowerCase();
                                    // Exact match only
                                    shouldShow = (
                                        eventCourseId === strandId ||
                                        eventCourseId === strandCode
                                    );
                                }
                            } catch (e) {
                                console.warn('Error matching strand:', e);
                            }
                        }
                        
                        if (!shouldShow) {
                            console.log(`HIDING event: "${event.title}" - eventCourseId="${eventCourseId}", filterStrand="${filterStrand}"`);
                        }
                    } else {
                        shouldShow = true;
                    }
                }
                
                // Add or remove filtered-out class and set display style
                // Use multiple methods to ensure the event is hidden/shown
                const eventEl = event.el;
                if (eventEl) {
                    if (shouldShow) {
                        eventEl.classList.remove('filtered-out');
                        // Remove inline styles to restore default display
                        eventEl.style.removeProperty('display');
                        eventEl.style.removeProperty('visibility');
                        eventEl.style.removeProperty('opacity');
                        eventEl.style.removeProperty('height');
                        eventEl.style.removeProperty('padding');
                        eventEl.style.removeProperty('margin');
                        shownCount++;
                    } else {
                        eventEl.classList.add('filtered-out');
                        // Force hide with inline styles
                        eventEl.style.setProperty('display', 'none', 'important');
                        eventEl.style.setProperty('visibility', 'hidden', 'important');
                        eventEl.style.setProperty('opacity', '0', 'important');
                        eventEl.style.setProperty('height', '0', 'important');
                        eventEl.style.setProperty('padding', '0', 'important');
                        eventEl.style.setProperty('margin', '0', 'important');
                        hiddenCount++;
                    }
                } else {
                    // If el is not available, try to find it by event ID or other selectors
                    setTimeout(() => {
                        // Try multiple selectors to find the event element
                        let elById = document.querySelector(`[data-event-id="${event.id}"]`);
                        if (!elById) {
                            elById = document.querySelector(`.fc-event[data-event-id="${event.id}"]`);
                        }
                        if (!elById) {
                            // Try to find by title if ID doesn't work
                            const allEvents = document.querySelectorAll('.fc-event');
                            for (const el of allEvents) {
                                if (el.textContent && el.textContent.includes(event.title)) {
                                    elById = el;
                                    break;
                                }
                            }
                        }
                        if (elById) {
                            if (shouldShow) {
                                elById.classList.remove('filtered-out');
                                elById.style.removeProperty('display');
                                elById.style.removeProperty('visibility');
                                elById.style.removeProperty('opacity');
                            } else {
                                elById.classList.add('filtered-out');
                                elById.style.setProperty('display', 'none', 'important');
                                elById.style.setProperty('visibility', 'hidden', 'important');
                                elById.style.setProperty('opacity', '0', 'important');
                            }
                        }
                    }, 100);
                }
            }
            
            console.log(`Filter applied: ${shownCount} shown, ${hiddenCount} hidden`);
        }
        
        // Filter system removed - no longer needed
        */
        
        // DO NOT automatically load fixed schedules to calendar on page load
        // Fixed schedules will only be loaded when Generate Schedule is clicked
        // This is handled in main.js generateSchedule() function
    });
    
    // Expose functions globally
    window.fixedSchedules = {
        load: loadFixedSchedules,
        save: saveFixedSchedules,
        addToCalendar: addFixedScheduleToCalendar,
        loadToCalendar: loadFixedSchedulesToCalendar,
        getAll: function() { return fixedSchedules; }
    };
})();

