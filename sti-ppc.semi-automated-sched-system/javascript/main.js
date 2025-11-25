document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    
    // Check authentication and redirect if needed
    checkAuthAndRedirect();
    
    // Debug check for calendar element
    const calendarEl = document.getElementById('calendar');
    console.log('Calendar element exists:', !!calendarEl);    // Initialize empty subjects by department (to be created by superadmin)
    let subjectsByDepartment = {};
      // Initialize empty rooms (to be created by superadmin)
    const rooms = [];

    // Define days of the week for the calendar in correct order
    const days = [
        { id: 'Monday', title: 'Monday' },
        { id: 'Tuesday', title: 'Tuesday' },
        { id: 'Wednesday', title: 'Wednesday' },
        { id: 'Thursday', title: 'Thursday' },
        { id: 'Friday', title: 'Friday' },
        { id: 'Saturday', title: 'Saturday' }
    ];
    
    // Track all created classes for auto scheduling
    let allClasses = [];
    window.allClasses = allClasses; // Make it globally accessible

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
    rooms.forEach(room => {
        roomUsageCount[room.id] = 0;
    });
    window.roomUsageCount = roomUsageCount;
    window.rooms = rooms;    // Initialize the calendar with resource time grid view
    if (calendarEl) {
        console.log('Initializing calendar...');
        window.calendar = new FullCalendar.Calendar(calendarEl, {
            schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
            initialView: 'resourceTimeGrid',
            headerToolbar: {
                left: '',
                center: '',
                right: ''
            },
            // Removed problematic views configuration
            resourceOrder: 'order',
            resources: [
                { id: 'Monday', title: 'Monday', order: 1 },
                { id: 'Tuesday', title: 'Tuesday', order: 2 },
                { id: 'Wednesday', title: 'Wednesday', order: 3 },
                { id: 'Thursday', title: 'Thursday', order: 4 },
                { id: 'Friday', title: 'Friday', order: 5 },
                { id: 'Saturday', title: 'Saturday', order: 6 }
            ],            navLinks: false,
            // Check user role for initial editable state
            editable: (function() {
                const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                const userRole = userData.role || '';
                return userRole === 'admin' || userRole === 'superadmin';
            })(),
            droppable: (function() {
                const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                const userRole = userData.role || '';
                return userRole === 'admin' || userRole === 'superadmin';
            })(),
            selectable: true,
            dayMaxEvents: true,
            slotMinTime: '07:00:00',
            slotMaxTime: '20:00:00',
            allDaySlot: false,
            weekends: true,
            slotDuration: '00:30:00',
            slotLabelInterval: '01:00',
            slotLabelFormat: {
                hour: 'numeric',
                minute: '2-digit',
                omitZeroMinute: false,
                meridiem: 'short'
            },
            dayHeaderFormat: { weekday: 'long' },
            resourceLabelDidMount: function(info) {
                info.el.classList.add('day-resource');
            },
            eventClick: function(info) {
                showEventDetails(info.event);
            },
            eventDrop: function(info) {
                // Check if the new position creates a conflict
                if (hasConflict(info.event)) {
                    // Revert the change and show notification
                    info.revert();
                    showNotification('This move would create a room or faculty conflict!', 'error');
                }
                
                // Force a complete event re-render
                const event = calendar.getEventById(info.event.id);
                if (event) {
                    event.setProp('title', event.extendedProps.subject);
                }
            },
            eventResize: function(info) {
                // Check if the new size creates a conflict
                if (hasConflict(info.event)) {
                    // Revert the change and show notification
                    info.revert();
                    showNotification('This resize would create a room or faculty conflict!', 'error');
                }
            },
            eventContent: function(arg) {
                // Get event data
                const event = arg.event;
                const course = event.extendedProps?.course;
                const room = event.extendedProps?.room;
                const subject = event.extendedProps?.subject;
                const classType = event.extendedProps?.classType;
                
                // Create HTML elements for custom content
                const container = document.createElement('div');
                container.className = 'custom-event-content';
                
                // Add course-specific classes to container
                if (course) {
                    container.classList.add(`${course.toLowerCase()}-event`);
                    
                    if (classType === 'laboratory') {
                        container.classList.add('lab-type');
                    } else {
                        container.classList.add('lecture-type');
                    }
                }
                
                // Subject name
                const subjectElement = document.createElement('div');
                subjectElement.className = 'event-subject';
                subjectElement.textContent = subject;
                
                // Time information
                const timeElement = document.createElement('div');
                timeElement.className = 'event-time';
                
                // Format the time
                const startTime = event.start;
                const endTime = event.end;
                
                let formattedStartTime = startTime ? 
                    startTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : '';
                let formattedEndTime = endTime ? 
                    endTime.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : '';
                
                timeElement.innerHTML = `<i class="fas fa-clock"></i> ${formattedStartTime} - ${formattedEndTime}`;
                
                // Room information - make it more prominent
                const roomElement = document.createElement('div');
                roomElement.className = 'event-room';
                roomElement.style.fontWeight = 'bold'; // Make the room text bold
                roomElement.style.marginTop = '2px';   // Add some spacing
                roomElement.style.display = 'block';   // Ensure it's always visible as a block
                roomElement.innerHTML = `<i class="fas fa-door-open"></i> ${room || 'No Room'}`;
                
                // Add all elements to container in the correct order with the room more visible
                container.appendChild(subjectElement);
                container.appendChild(timeElement);
                container.appendChild(roomElement);
                
                // Return the custom HTML content
                return { domNodes: [container] };
            },
            height: 'auto',
            contentHeight: 'auto',
            aspectRatio: 2.5
        });
          console.log('Rendering calendar...');
        calendar.render();
        
        // Store the calendar object globally
        window.calendar = calendar;
        
        // Check if we need to apply user restrictions
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userRole = userData.role || '';
        if (userRole !== 'admin' && userRole !== 'superadmin' && userData.department) {
            // Apply restrictions for regular users immediately after rendering
            setTimeout(() => restrictToDepartment(userData.department), 100);
        }
    } else {
        console.error('Calendar element not found!');
    }

    // Form elements
    const departmentSelect = document.getElementById('departmentSelect');
    const facultySelect = document.getElementById('facultySelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const submitScheduleBtn = document.getElementById('submitScheduleBtn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    
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
                subjectsByDepartment[selectedDepartment].forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    option.dataset.course = selectedDepartment;
                    subjectSelect.appendChild(option);
                });
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
                    
                    // Keep the faculty select enabled so user sees there are no options
                    facultySelect.disabled = false;
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
    
    // Submit button handler - creates a class based on form selections
    if (submitScheduleBtn) {
        submitScheduleBtn.addEventListener('click', function() {
            // Validate form selections
            if (!validateForm()) {
                return;
            }
              // Get selected values
            const selectedDepartment = departmentSelect.value;
            const selectedFacultyId = facultySelect.value;
            const selectedFacultyName = facultySelect.options[facultySelect.selectedIndex].text;
            const selectedSubjectId = subjectSelect.value;
            const selectedSubjectName = subjectSelect.options[subjectSelect.selectedIndex].text;
            const unitLoadInput = document.getElementById('unitLoadInput');
            const unitLoad = unitLoadInput ? unitLoadInput.value.trim() : "3";
            const classType = document.querySelector('input[name="classType"]:checked').value;
            
            // Create class data object
            const classData = {
                id: 'class-' + Date.now(),
                subject: selectedSubjectName,
                unitLoad: parseFloat(unitLoad),
                classType: classType,
                course: selectedDepartment,
                faculty: selectedFacultyName,
                department: selectedDepartment
            };
            
            // Add to our classes collection
            allClasses.push(classData);
            window.allClasses = allClasses;
            
            // Add to UI list
            addClassToList(classData);
            
            // Reset form fields but keep department selection
            resetFormFieldsPartial();
            
            // Show notification
            showNotification('Class added successfully!', 'success');
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
    const clearBtn = document.getElementById('clearAllClassesBtn');
    const printBtn = document.getElementById('printScheduleBtn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            generateSchedule();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            showClearConfirmation();
        });
    }
    
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            printSchedule();
        });
    }

    // Helper Functions
    
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
                facultySelect.appendChild(option);
            });
            
            // Enable the faculty select
            facultySelect.disabled = false;
        } else {
            console.log('No faculty members available to populate dropdown');
            // Keep dropdown enabled so user can see they need to add faculty
            facultySelect.disabled = false;
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
        
        // Validate unit load input (must be a valid number)
        const unitLoadInput = document.getElementById('unitLoadInput');
        if (unitLoadInput) {
            const unitLoadValue = unitLoadInput.value.trim();
            const unitLoadNumber = parseFloat(unitLoadValue);
            
            if (isNaN(unitLoadNumber) || unitLoadNumber <= 0) {
                unitLoadInput.parentElement.classList.add('error');
                isValid = false;
            } else {
                unitLoadInput.parentElement.classList.remove('error');
            }
        }
        
        return isValid;
    }
      // Reset form fields but keep department selection
    function resetFormFieldsPartial() {
        // Keep department selection
        
        if (subjectSelect) {
            // Re-enable and repopulate the subject dropdown based on current department
            if (departmentSelect && departmentSelect.value) {
                const selectedDepartment = departmentSelect.value;
                
                // Clear and populate subject dropdown
                subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
                
                // Add subject options for selected department
                subjectsByDepartment[selectedDepartment].forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    option.dataset.course = selectedDepartment;
                    subjectSelect.appendChild(option);
                });
                
                // Make sure the dropdown is enabled
                subjectSelect.disabled = false;
            }
        }
        
        // Reset unit load to default (3 hours)
        const unitLoadInput = document.getElementById('unitLoadInput');
        if (unitLoadInput) unitLoadInput.value = '3';
        
        // Reset class type to default (lecture)
        const classTypeRadio = document.querySelector('input[name="classType"][value="lecture"]');
        if (classTypeRadio) classTypeRadio.checked = true;
    }
      // Reset all form fields
    function resetFormFieldsFull() {
        if (departmentSelect) {
            // Reset department dropdown
            departmentSelect.value = '';
        }
        
        if (facultySelect) {
            // Reset and disable faculty dropdown
            facultySelect.innerHTML = '<option value="" selected disabled>Select Faculty Member</option>';
            facultySelect.disabled = false;
        }
        
        if (subjectSelect) {
            // Reset and disable subject dropdown
            subjectSelect.innerHTML = '<option value="" selected disabled>Select Subject</option>';
            subjectSelect.disabled = true;
        }
        
        // Reset unit load to default (3 hours)
        const unitLoadInput = document.getElementById('unitLoadInput');
        if (unitLoadInput) unitLoadInput.value = '3';
        
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
        
        classItem.innerHTML = `
            <h3>${classData.subject}</h3>
            <div class="class-info"><i class="fas fa-graduation-cap"></i> ${classData.course}</div>
            <div class="class-info"><i class="fas fa-chalkboard-teacher"></i> ${classData.faculty}</div>
            <div class="class-info"><i class="fas fa-clock"></i> ${classData.unitLoad} hours (${classData.classType})</div>
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
        new FullCalendar.Draggable(element, {
            itemSelector: '.class-item',
            eventData: function() {
                // Generate a new unique ID for each instance of a dragged class
                // Format: original-id-timestamp to ensure uniqueness
                const uniqueInstanceId = classData.id + '-' + Date.now();
                
                return {
                    id: uniqueInstanceId, // Use the unique instance ID instead of the original class ID
                    title: classData.subject,
                    duration: { hours: classData.unitLoad },
                    classNames: [
                        `${classData.course.toLowerCase()}-event`,
                        `${classData.classType}-type`
                    ],
                    extendedProps: {
                        originalClassId: classData.id, // Store the original ID for reference
                        subject: classData.subject,
                        course: classData.course, 
                        faculty: classData.faculty,
                        unitLoad: classData.unitLoad,
                        classType: classData.classType
                    }
                };
            }
        });
    }
    
    // Remove class item
    function removeClassItem(id) {
        // Remove from array
        allClasses = allClasses.filter(item => item.id !== id);
        window.allClasses = allClasses;
        
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
    function generateSchedule() {
        if (allClasses.length === 0) {
            showNotification('Please add classes before generating a schedule', 'error');
            return;
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
                
                // Shuffle to randomize placement order
                shuffleArray(classesToSchedule);
                
                let scheduledClasses = [];
                let unscheduledClasses = [];
                
                // Process each class
                for (const classItem of classesToSchedule) {
                    // Update progress
                    classesProcessed++;
                    let progressPct = Math.floor((classesProcessed / totalClasses) * 100);
                    if (progressBar) {
                        progressBar.style.width = progressPct + '%';
                    }
                    
                    if (statusElement) {
                        statusElement.textContent = `Scheduling class ${classesProcessed} of ${totalClasses}: ${classItem.subject}`;
                    }
                    
                    // Try to schedule this class
                    if (scheduleClass(classItem)) {
                        scheduledClasses.push(classItem);
                    } else {
                        unscheduledClasses.push(classItem);
                    }
                }
                
                // Complete the progress bar
                if (progressBar) {
                    progressBar.style.width = '100%';
                }
                
                if (statusElement) {
                    statusElement.textContent = "Schedule generation complete!";
                }
                
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
    }
    
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
    
    // Schedule a single class
    function scheduleClass(classItem) {
        const calendar = window.calendar;
        if (!calendar) return false;
        
        // Get all possible days and time slots and shuffle them both for better distribution
        const possibleDays = [...days];
        shuffleArray(possibleDays); // Shuffle the days array so we don't always start with Monday
        const possibleTimes = timeSlots.slice();
        shuffleArray(possibleTimes); // Use our proper shuffle function instead of sort
        
        // Try each combination until we find a valid placement
        for (const day of possibleDays) {
            for (const startTime of possibleTimes) {
                // Calculate duration and end time
                const durationHours = classItem.unitLoad;
                const durationMinutes = durationHours * 60;
                const endTime = addMinutes(startTime, durationMinutes);
                
                // Skip if end time would be after 8:00 PM
                if (endTime > '20:00') {
                    continue;
                }
                
                // Find compatible AND available rooms for this time slot
                let compatibleRooms = findCompatibleRooms(classItem, day.id, startTime, endTime);
                
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
                    // Create event data using today's date as the reference date
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const dayOfMonth = String(today.getDate()).padStart(2, '0'); // Renamed from day to dayOfMonth
                    const fixedDateStr = `${year}-${month}-${dayOfMonth}`;
                    
                    // Create a test event
                    const eventData = {
                        id: classItem.id,
                        title: classItem.subject,
                        resourceId: day.id, // This is what matters - which day of week
                        start: `${fixedDateStr}T${startTime}:00`,
                        end: `${fixedDateStr}T${endTime}:00`,
                        classNames: [
                            `${classItem.course.toLowerCase()}-event`,
                            `${classItem.classType}-type`
                        ],
                        extendedProps: {
                            subject: classItem.subject,
                            course: classItem.course,
                            faculty: classItem.faculty,
                            unitLoad: classItem.unitLoad,
                            classType: classItem.classType,
                            room: room.title,
                            roomId: room.id,
                            dayOfWeek: day.id
                        }
                    };
                    
                    // Check for faculty conflicts
                    if (!wouldCreateFacultyConflict(eventData)) {
                        // No conflicts - add the event to the calendar
                        calendar.addEvent(eventData);
                        roomUsageCount[room.id] += 1;  // Track room usage
                        
                        return true;
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
                const dayEvents = events.filter(event => 
                    event.getResources()[0]?.id === day.id
                );
                
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
        
        for (let otherEvent of allEvents) {
            // Skip comparing with itself
            if (otherEvent.id === event.id) continue;
            
            // Check if same day and time overlapping
            if (otherEvent.getResources()[0]?.id === event.getResources()[0]?.id) {
                if (datesOverlap(otherEvent.start, otherEvent.end, event.start, event.end)) {
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
        }
        
        return false; // No conflicts found
    }
    
    function datesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }
    
    // Check for faculty conflicts
    function wouldCreateFacultyConflict(newEventData) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume conflict if no calendar
        
        const existingEvents = calendar.getEvents();
        const newDay = newEventData.resourceId;
        const newFaculty = newEventData.extendedProps.faculty;
        
        // Convert time strings to comparable values
        const newStart = convertTimeToMinutes(newEventData.start.slice(-8, -3));
        const newEnd = convertTimeToMinutes(newEventData.end.slice(-8, -3));
        
        for (const event of existingEvents) {
            // Skip comparing with itself
            if (event.id === newEventData.id) continue;
            
            // Only check for conflicts on the same day
            if (event.getResources()[0]?.id === newDay) {
                // Get event times and convert to minutes for comparison
                const existingStart = convertTimeToMinutes(event.start.toTimeString().substring(0, 5));
                const existingEnd = convertTimeToMinutes(event.end.toTimeString().substring(0, 5));
                
                // Check for time overlap
                if (newStart < existingEnd && existingStart < newEnd) {
                    // Check for faculty conflicts
                    if (event.extendedProps.faculty === newFaculty) {
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
    
    // Generate time slots for scheduling (7:00 AM to 7:30 PM in 30-min increments)
    function generateTimeSlots() {
        const slots = [];
        let currentHour = 7;
        let currentMinute = 0;
        
        while (currentHour < 20) {
            const hourString = currentHour.toString().padStart(2, '0');
            const minuteString = currentMinute.toString().padStart(2, '0');
            slots.push(`${hourString}:${minuteString}`);
            
            // Advance by 30 minutes
            currentMinute += 30;
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
        if (calendar && typeof calendar.getEvents === 'function') {
            calendar.getEvents().forEach(event => event.remove());
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
            
            const dayId = event.getResources()[0]?.id;
            const startTime2 = event.start.toTimeString().substring(0, 5);
            const endTime2 = event.end.toTimeString().substring(0, 5);
            
            const compatibleRooms = findCompatibleRooms(classItem, dayId, startTime2, endTime2);
            
            // Create options for each room
            compatibleRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.id;
                option.textContent = room.title;
                
                // Check if room is occupied (except by this event)
                const isOccupied = isRoomOccupiedExcept(
                    room.id, 
                    dayId, 
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
        
        if (deleteEventBtn) deleteEventBtn.setAttribute('data-event-id', event.id);
        if (changeRoomBtn) changeRoomBtn.setAttribute('data-event-id', event.id);
        
        showModal('eventModal');
    }

    // Helper function to check if a room is occupied (except by a specific event)
    function isRoomOccupiedExcept(roomId, dayId, startTime, endTime, exceptEventId) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume occupied if no calendar
        
        const existingEvents = calendar.getEvents();
        const start = convertTimeToMinutes(startTime);
        const end = convertTimeToMinutes(endTime);
        
        for (const event of existingEvents) {
            // Skip the excluded event
            if (event.id === exceptEventId) continue;
            
            // Only check for conflicts on the same day
            if (event.getResources()[0]?.id === dayId) {
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
        }
        
        return false; // Room is available
    }
    
    // Find compatible rooms based on class type and course
    function findCompatibleRooms(classItem, dayId, startTime, endTime) {
        let compatibleRooms = [];
        
        // Apply specific rules based on course and class type
        if (classItem.course === 'BSIT' && classItem.classType === 'laboratory') {
            // BSIT lab classes MUST use CL1 and CL2 first
            const priorityRooms = rooms.filter(r => r.id === 'CL1' || r.id === 'CL2');
            const otherRooms = rooms.filter(r => 
                r.id !== 'CL1' && 
                r.id !== 'CL2' && 
                r.id !== 'KITCHEN'
            );
            // Randomize other rooms for better distribution
            shuffleArray(otherRooms);
            compatibleRooms = [...priorityRooms, ...otherRooms];
        } 
        else if (classItem.course === 'BSIT') {
            // BSIT lecture classes - can use any room except KITCHEN
            const roomsExceptKitchen = rooms.filter(r => r.id !== 'KITCHEN');
            // Randomize rooms for better distribution
            shuffleArray(roomsExceptKitchen);
            compatibleRooms = roomsExceptKitchen;
        }
        else if (classItem.course === 'BSHM' && classItem.classType === 'laboratory') {
            // BSHM lab classes MUST use KITCHEN first, then DINING
            const kitchenRoom = rooms.find(r => r.id === 'KITCHEN');
            const diningRoom = rooms.find(r => r.id === 'DINING');
            const otherRooms = rooms.filter(r => 
                r.id !== 'KITCHEN' && 
                r.id !== 'DINING'
            );
            // Randomize other rooms for better distribution
            shuffleArray(otherRooms);
            compatibleRooms = [kitchenRoom, diningRoom, ...otherRooms];
        }
        else if (classItem.course === 'BSHM') {
            // BSHM lecture classes - prioritize DINING but not KITCHEN
            const diningRoom = rooms.find(r => r.id === 'DINING');
            const otherRooms = rooms.filter(r => 
                r.id !== 'KITCHEN' && 
                r.id !== 'DINING'
            );
            
            // Randomize rooms for better distribution
            shuffleArray(otherRooms);
            compatibleRooms = [diningRoom, ...otherRooms];
        }
        else if (classItem.course === 'BSTM') {
            // BSTM courses can use any room, including KITCHEN (per requirement)
            const kitchenRoom = rooms.find(r => r.id === 'KITCHEN');
            const otherRooms = rooms.filter(r => r.id !== 'KITCHEN');
            
            // Randomize rooms for better distribution
            shuffleArray(otherRooms);
            compatibleRooms = [kitchenRoom, ...otherRooms];
        }
        else {
            // Other courses can use any room except KITCHEN 
            const roomsExceptKitchen = rooms.filter(r => r.id !== 'KITCHEN');
            // Randomize rooms for better distribution
            shuffleArray(roomsExceptKitchen);
            compatibleRooms = roomsExceptKitchen;
        }
        
        // If day, start and end time are provided, filter out rooms that are already occupied
        if (dayId && startTime && endTime) {
            return compatibleRooms.filter(room => !isRoomOccupied(room.id, dayId, startTime, endTime));
        }
        
        return compatibleRooms;
    }

    // Helper function to check if a room is occupied at a specific time
    function isRoomOccupied(roomId, dayId, startTime, endTime) {
        const calendar = window.calendar;
        if (!calendar) return true; // Assume occupied if no calendar
        
        const existingEvents = calendar.getEvents();
        const start = convertTimeToMinutes(startTime);
        const end = convertTimeToMinutes(endTime);
        
        for (const event of existingEvents) {
            // Only check events on the same day
            if (event.getResources()[0]?.id === dayId) {
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
    
    // Save department button handler
    if (saveDepartmentBtn) {
        saveDepartmentBtn.addEventListener('click', function() {
            const departmentCodeField = document.getElementById('departmentCode');
            const departmentNameField = document.getElementById('departmentName');
            
            // Basic validation
            if (!departmentCodeField || !departmentCodeField.value.trim()) {
                departmentCodeField.parentElement.classList.add('error');
                return;
            } else {
                departmentCodeField.parentElement.classList.remove('error');
            }
            
            if (!departmentNameField || !departmentNameField.value.trim()) {
                departmentNameField.parentElement.classList.add('error');
                return;
            } else {
                departmentNameField.parentElement.classList.remove('error');
            }
            
            // Create new department
            const newDepartment = {
                code: departmentCodeField.value.trim().toUpperCase(),
                name: departmentNameField.value.trim()
            };
            
            // Check if department already exists
            const existingDeptIndex = departments.findIndex(d => d.code === newDepartment.code);
            if (existingDeptIndex >= 0) {
                showNotification(`Department with code ${newDepartment.code} already exists.`, 'error');
                return;
            }
            
            // Add to departments array
            departments.push(newDepartment);
            
            // Save to localStorage
            try {
                localStorage.setItem('departments', JSON.stringify(departments));
            } catch (e) {
                console.error('Error saving departments to localStorage:', e);
            }
            
            // Update department dropdowns
            updateDepartmentSelectOptions();
            
            // Hide modal
            hideModal('addDepartmentModal');
            
            // Show notification
            showNotification('Department added successfully!', 'success');
        });
    }
    
    // Cancel department button handler
    if (cancelDepartmentBtn) {
        cancelDepartmentBtn.addEventListener('click', function() {
            hideModal('addDepartmentModal');
        });
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
        } catch (e) {
            console.error('Error loading subjects from localStorage:', e);
        }
    }

    // Strand/Course management
    const strandSection = document.createElement('div');
    strandSection.className = 'form-group';
    strandSection.innerHTML = `
        <label for="strandSelect">Strand/Course</label>
        <select id="strandSelect" class="form-control">
            <option value="" selected disabled>Select Strand/Course</option>
        </select>
        <div class="form-error">Please select a strand/course</div>        <!-- Strand management moved to superadmin dashboard -->
    `;
    
    // Add the strand section to the form after the department select
    const formEl = document.getElementById('scheduleForm');
    if (formEl) {
        const departmentFormGroup = document.querySelector('.form-group:has(#departmentSelect)');
        if (departmentFormGroup) {
            formEl.insertBefore(strandSection, departmentFormGroup.nextSibling);
        }
    }
    
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
                showNotification(`Strand/Course with this code or name already exists.`, 'error');
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
            showNotification('Strand/Course added successfully!', 'success');
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
                showNotification('Strand/Course updated successfully!', 'success');
                
                // Update the manage strands modal
                populateStrandsList();
            };
        }
        
        // Show the modal
        const modalTitle = document.querySelector('#addStrandModal .modal-header h3');
        if (modalTitle) modalTitle.textContent = 'Edit Strand/Course';
        
        showModal('addStrandModal');
        
        // Set up a handler to restore the original behavior when the modal is closed
        const closeButtons = document.querySelectorAll('#addStrandModal .close-modal, #cancelStrandBtn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function onClose() {
                if (saveStrandBtn) saveStrandBtn.onclick = originalOnClick;
                btn.removeEventListener('click', onClose);
                
                // Restore original title
                if (modalTitle) modalTitle.textContent = 'Add New Strand/Course';
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
                showNotification(`Strand/Course has been removed.`, 'success');
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
        if (strandSelect) {
            const currentValue = strandSelect.value;
            
            strandSelect.innerHTML = '<option value="" selected disabled>Select Strand/Course</option>';
            
            strands.forEach(strand => {
                const option = document.createElement('option');
                option.value = strand.code;
                option.textContent = `${strand.code} - ${strand.name}`;
                strandSelect.appendChild(option);
            });
            
            // Try to restore previous selection
            if (currentValue && strands.some(s => s.code === currentValue)) {
                strandSelect.value = currentValue;
            }
        }
    }
    
    // Call updateStrandSelectOptions initially
    updateStrandSelectOptions();

    // Save schedule to localStorage
    function saveScheduleToLocalStorage() {
        const calendar = window.calendar;
        if (!calendar) return;
        
        const events = calendar.getEvents();
        const eventsData = events.map(event => {
            // Extract the necessary data to recreate the event
            const resources = event.getResources();
            const resourceId = resources && resources.length > 0 ? resources[0].id : null;
            
            return {
                id: event.id,
                title: event.title,
                resourceId: resourceId,
                start: event.start ? event.start.toISOString() : null,
                end: event.end ? event.end.toISOString() : null,
                classNames: Array.from(event.classNames),
                extendedProps: event.extendedProps
            };
        });
        
        try {
            localStorage.setItem('calendarEvents', JSON.stringify(eventsData));
            console.log('Saved', eventsData.length, 'events to localStorage');
        } catch (e) {
            console.error('Error saving schedule to localStorage:', e);
        }
    }
    
    // Load schedule from localStorage
    function loadScheduleFromLocalStorage() {
        const calendar = window.calendar;
        if (!calendar) return;
        
        try {
            const eventsData = JSON.parse(localStorage.getItem('calendarEvents'));
            if (eventsData && eventsData.length) {
                console.log('Loading', eventsData.length, 'events from localStorage');
                
                eventsData.forEach(eventData => {
                    calendar.addEvent(eventData);
                });
                
                showNotification('Schedule loaded successfully!', 'success');
            }
        } catch (e) {
            console.error('Error loading schedule from localStorage:', e);
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
    
    // Save schedule whenever it changes
    if (window.calendar) {
        window.calendar.on('eventAdd', saveScheduleToLocalStorage);
        window.calendar.on('eventChange', saveScheduleToLocalStorage);
        window.calendar.on('eventRemove', saveScheduleToLocalStorage);
    }
    
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
        saveScheduleToLocalStorage(); // Clear the calendar events in storage too
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
                            if (subjectsByDepartment[selectedDepartment]) {
                                subjectsByDepartment[selectedDepartment].forEach(subject => {
                                    const option = document.createElement('option');
                                    option.value = subject.id;
                                    option.textContent = subject.name;
                                    option.dataset.course = selectedDepartment;
                                    subjectSelect.appendChild(option);
                                });
                            }
                        }
                    }
                    
                    // Update the subjects list
                    populateSubjectsList();
                    
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
            
            adminNav.innerHTML = `
                <a href="${department ? 'admin.html' : 'superadmin.html'}" class="admin-link">
                    <i class="fas fa-cogs"></i> ${department ? 'Admin Dashboard' : 'Superadmin Dashboard'}
                </a>
            `;
            
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
        allEditButtons.forEach(btn => {
            btn.style.display = 'none';        });
        
        // Add a compact view-only indicator at the very top of the page
        const header = document.querySelector('.header');
        if (!document.querySelector('.view-only-notice')) {
            const viewOnlyNotice = document.createElement('div');
            viewOnlyNotice.className = 'view-only-notice';
            viewOnlyNotice.innerHTML = `<i class="fas fa-eye"></i> View Only Mode - ${department} Department`;
            
            // Insert at the beginning of the body
            document.body.insertBefore(viewOnlyNotice, document.body.firstChild);
        }
        
        // Hide all department-related management UI
        document.querySelectorAll('#addDepartmentLink, #manageDepartmentLink').forEach(el => {
            if (el) el.style.display = 'none';
        });
        
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
            if (calendarContainer && !document.querySelector('.calendar-help-text')) {
                const helpText = document.createElement('div');
                helpText.className = 'calendar-help-text';
                helpText.textContent = 'View-only mode: Schedule is displayed for reference only.';
                calendarContainer.insertBefore(helpText, calendarContainer.firstChild);
            }
        }
    }
});
