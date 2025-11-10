// Fixed Schedules Management
(function() {
    // Initialize fixed schedules array
    let fixedSchedules = [];
    
    // Load fixed schedules from localStorage
    function loadFixedSchedules() {
        try {
            const saved = localStorage.getItem('fixedSchedules');
            if (saved) {
                fixedSchedules = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading fixed schedules:', e);
            fixedSchedules = [];
        }
        return fixedSchedules;
    }
    
    // Save fixed schedules to localStorage
    function saveFixedSchedules() {
        try {
            localStorage.setItem('fixedSchedules', JSON.stringify(fixedSchedules));
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
        const event = {
            id: schedule.id,
            title: schedule.name,
            start: startDate,
            end: endDate,
            backgroundColor: '#ff9800',
            borderColor: '#f57c00',
            textColor: '#ffffff',
            classNames: ['fixed-schedule-event'],
            extendedProps: {
                isFixedSchedule: true,
                allowClasses: schedule.allowClasses,
                scheduleId: schedule.id
            },
            editable: false, // Fixed schedules cannot be moved
            startEditable: false,
            durationEditable: false
        };
        
        window.calendar.addEvent(event);
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
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Load fixed schedules
        loadFixedSchedules();
        
        // Open fixed schedule modal
        const addFixedScheduleBtn = document.getElementById('addFixedScheduleBtn');
        const fixedScheduleModal = document.getElementById('fixedScheduleModal');
        const saveFixedScheduleBtn = document.getElementById('saveFixedScheduleBtn');
        const fixedScheduleForm = document.getElementById('fixedScheduleForm');
        
        if (addFixedScheduleBtn && fixedScheduleModal) {
            addFixedScheduleBtn.addEventListener('click', function() {
                fixedScheduleModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                fixedScheduleForm.reset();
                document.getElementById('fixedScheduleAllowClasses').checked = true;
            });
        }
        
        // Close modal handlers
        document.querySelectorAll('[data-close-modal="fixedScheduleModal"]').forEach(btn => {
            btn.addEventListener('click', function() {
                if (fixedScheduleModal) {
                    fixedScheduleModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        });
        
        if (fixedScheduleModal) {
            fixedScheduleModal.addEventListener('click', function(e) {
                if (e.target === fixedScheduleModal) {
                    fixedScheduleModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        }
        
        // Save fixed schedule
        if (saveFixedScheduleBtn && fixedScheduleForm) {
            saveFixedScheduleBtn.addEventListener('click', function() {
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
                saveFixedSchedules();
                
                // Add to calendar
                if (window.calendar) {
                    addFixedScheduleToCalendar(schedule);
                    // Re-apply filter after adding
                    setTimeout(() => {
                        if (typeof window.applyScheduleFilter === 'function') {
                            window.applyScheduleFilter();
                        }
                    }, 100);
                }
                
                // Close modal
                fixedScheduleModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                fixedScheduleForm.reset();
                
                // Show notification
                if (typeof showNotification === 'function') {
                    showNotification('Fixed schedule added successfully', 'success');
                }
            });
        }
        
        // Filter functionality
        const scheduleFilter = document.getElementById('scheduleFilter');
        
        // Function to apply filter
        function applyFilter() {
            if (!scheduleFilter || !window.calendar) return;
            
            const filterValue = scheduleFilter.value || 'all';
            const events = window.calendar.getEvents();
            
            events.forEach(event => {
                const extendedProps = event.extendedProps || {};
                const classType = extendedProps.classType || '';
                const isFixed = extendedProps.isFixedSchedule || false;
                
                let shouldShow = true;
                
                if (filterValue === 'lecture') {
                    shouldShow = classType === 'lecture' && !isFixed;
                } else if (filterValue === 'laboratory') {
                    shouldShow = classType === 'laboratory' && !isFixed;
                } else if (filterValue === 'fixed') {
                    shouldShow = isFixed;
                } else {
                    // Show all
                    shouldShow = true;
                }
                
                // Add or remove filtered-out class
                const eventEl = event.el;
                if (eventEl) {
                    if (shouldShow) {
                        eventEl.classList.remove('filtered-out');
                    } else {
                        eventEl.classList.add('filtered-out');
                    }
                }
            });
        }
        
        if (scheduleFilter) {
            // Add CSS for hiding events
            if (!document.getElementById('schedule-filter-styles')) {
                const style = document.createElement('style');
                style.id = 'schedule-filter-styles';
                style.textContent = `
                    .fc-event.filtered-out {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }
            
            scheduleFilter.addEventListener('change', applyFilter);
            
            // Re-apply filter when events are added or calendar is rendered
            if (window.calendar) {
                window.calendar.on('eventsSet', applyFilter);
            }
        }
        
        // Expose applyFilter globally
        window.applyScheduleFilter = applyFilter;
        
        // Load fixed schedules to calendar when calendar is ready
        function ensureFixedSchedulesLoaded() {
            if (window.calendar) {
                loadFixedSchedulesToCalendar();
                // Re-apply filter after loading
                setTimeout(() => {
                    if (typeof window.applyScheduleFilter === 'function') {
                        window.applyScheduleFilter();
                    }
                }, 200);
            }
        }
        
        // Try to load immediately
        setTimeout(ensureFixedSchedulesLoaded, 1000);
        
        // Also load after schedule is loaded
        const originalLoadSchedule = window.loadScheduleFromLocalStorage;
        if (originalLoadSchedule) {
            window.loadScheduleFromLocalStorage = async function(...args) {
                const result = await originalLoadSchedule.apply(this, args);
                // Load fixed schedules after regular schedule loads
                setTimeout(ensureFixedSchedulesLoaded, 500);
                return result;
            };
        }
        
        // Also listen for calendar ready
        if (window.calendar) {
            ensureFixedSchedulesLoaded();
        } else {
            const checkCalendar = setInterval(() => {
                if (window.calendar) {
                    ensureFixedSchedulesLoaded();
                    clearInterval(checkCalendar);
                }
            }, 500);
        }
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

