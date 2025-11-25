document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and role
    const authToken = localStorage.getItem('authToken');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const demoUserData = JSON.parse(localStorage.getItem('demoUserData') || '{}');
    
    // For a fresh system, create an admin account if first access
    if (!authToken && !localStorage.getItem('initialAdminCreated')) {
        // Create a demo admin for first access
        const initialAdmin = {
            id: 'initial-admin',
            firstName: 'Department',
            lastName: 'Admin',
            email: 'admin@school.edu',
            role: 'admin',
            department: '',
            verified: true
        };
        
        localStorage.setItem('userData', JSON.stringify(initialAdmin));
        localStorage.setItem('initialAdminCreated', 'true');
        location.reload(); // Reload to use the new admin account
        return;
    }
    
    // If not authenticated or not admin, check if in demo mode first
    if ((!authToken && !demoUserData) || userData.role !== 'admin') {
        alert('Unauthorized access. Please login with an admin account.');
        window.location.href = 'login.html';
        return;
    }
    
    // Set admin name and role in header
    const formatFullName = (firstName, middleName, lastName) => {
        if (!firstName && !lastName) return '';
        let name = firstName || '';
        if (middleName && middleName.trim()) {
            name += ` ${middleName.trim().charAt(0).toUpperCase()}.`;
        }
        if (lastName) {
            name += ` ${lastName}`;
        }
        return name.trim();
    };
    document.getElementById('adminName').textContent = formatFullName(userData.firstName || '', userData.middleName || '', userData.lastName || '') || userData.email || 'Admin';
    const adminRoleElement = document.getElementById('adminRole');
    if (adminRoleElement) {
        adminRoleElement.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'Admin';
        adminRoleElement.className = `role-badge ${userData.role || 'admin'}`;
    }
    
    // Initialize components
    initMenu();
    loadDepartmentUsers();
    initEventListeners();
    
    // Add demo message if in demo mode
    if (!authToken && localStorage.getItem('demoUserData')) {
        showNotification('You are in demo mode. Some functionality may be limited.', 'warning');
    }
});

// Initialize sidebar menu
function initMenu() {
    const menuItems = document.querySelectorAll('.nav-list .nav-link');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all menu items and sections
            document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked menu item
            this.parentElement.classList.add('active');
            
            // Show corresponding section
            const sectionId = this.getAttribute('href').replace('#', '');
            document.getElementById(sectionId).classList.add('active');
        });
    });
}

// Load department users
async function loadDepartmentUsers() {
    try {
        const authToken = localStorage.getItem('authToken');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const departmentId = userData.departmentId;
        
        // If in demo mode, show demo data
        if (!authToken) {
            showDepartmentUsers(userData.department);
            return;
        }
        
        // Fetch department details first
        const deptResponse = await fetch(`/api/departments/${departmentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!deptResponse.ok) {
            throw new Error('Failed to load department details');
        }
        
        const department = await deptResponse.json();
        
        // Update the department display in the UI
        const departmentNameElement = document.getElementById('departmentName');
        if (departmentNameElement) {
            departmentNameElement.textContent = `${department.code} - ${department.name}`;
        }
        
        // Fetch users in this department
        const response = await fetch(`/api/users?departmentId=${departmentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load department users');
        }
        
        const users = await response.json();
        displayDepartmentUsers(users);
        
    } catch (error) {
        console.error('Error loading department users:', error);
        showNotification('Failed to load department users. Using demo data instead.', 'error');
        
        // Fall back to demo data
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        showDepartmentUsers(userData.department || 'Mathematics');
    }
}

// Display department users in the table
function displayDepartmentUsers(users) {
    const tableBody = document.getElementById('departmentUsersTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No users found in this department</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        if (user) { // Add null check for user object
            const formatName = (firstName, middleName, lastName) => {
                if (!firstName && !lastName) return '';
                let name = firstName || '';
                if (middleName && middleName.trim()) {
                    name += ` ${middleName.trim().charAt(0).toUpperCase()}.`;
                }
                if (lastName) {
                    name += ` ${lastName}`;
                }
                return name.trim();
            };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatName(user.firstName || '', user.middleName || '', user.lastName || '')}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.role || 'N/A'}</td>
                <td>${user.department || 'N/A'}</td>
            `;
            tableBody.appendChild(tr);
        }
    });
}

// Show demo department users
function showDepartmentUsers(department) {
    // Show empty state for department users
    displayDepartmentUsers([]);
}

// Initialize event listeners
function initEventListeners() {
    // Get modal elements
    const deptModal = document.getElementById('addDepartmentModal');
    const facultyModal = document.getElementById('addFacultyModal');
    const deptForm = document.getElementById('addDepartmentForm');
    const facultyForm = document.getElementById('addFacultyForm');
    
    // Open modals
    document.getElementById('addDepartmentBtn')?.addEventListener('click', () => {
        deptModal.style.display = 'block';
    });
    
    document.getElementById('addFacultyBtn')?.addEventListener('click', () => {
        facultyModal.style.display = 'block';
    });
    
    // Close modals when clicking the X
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deptModal.style.display = 'none';
            facultyModal.style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    [deptModal, facultyModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) { // Only close if clicking on the modal background
                    modal.style.display = 'none';
                }
            });
            
            // Prevent clicks inside modal content from closing the modal
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }
    });
    window.addEventListener('click', (e) => {
        if (e.target === deptModal) deptModal.style.display = 'none';
        if (e.target === facultyModal) facultyModal.style.display = 'none';
    });
    
    // Cancel buttons
    document.getElementById('cancelDeptBtn')?.addEventListener('click', () => {
        deptModal.style.display = 'none';
    });
    
    document.getElementById('cancelFacultyBtn')?.addEventListener('click', () => {
        facultyModal.style.display = 'none';
    });
    
    // Form submissions
    deptForm?.addEventListener('submit', handleAddDepartment);
    facultyForm?.addEventListener('submit', handleAddFaculty);
    
    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('demoUserData');
        window.location.href = 'login.html';
    });
    
    // Search button
    document.getElementById('userSearchBtn')?.addEventListener('click', searchDepartmentUsers);
    
    // Search input on enter key
    document.getElementById('userSearchInput')?.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            searchDepartmentUsers();
        }
    });
    
    // Refresh users button
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadDepartmentUsers);
    
    // Generate report button
    document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);
    
    // Export report button
    document.getElementById('exportReportBtn')?.addEventListener('click', exportReport);
    
    // Report type change
    document.getElementById('reportType')?.addEventListener('change', function() {
        const reportContent = document.getElementById('reportContent');
        if (reportContent) {
            reportContent.style.display = 'none';
        }
    });
}

// Search department users
function searchDepartmentUsers() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#departmentUsersTable tr:not(.empty-state-row)');
    
    let hasVisible = false;
    
    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const email = row.cells[1].textContent.toLowerCase();
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            row.style.display = '';
            hasVisible = true;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show/hide empty state
    const emptyStateRow = document.querySelector('#departmentUsersTable .empty-state-row');
    if (!hasVisible) {
        if (!emptyStateRow) {
            const tableBody = document.getElementById('departmentUsersTable');
            tableBody.innerHTML += `
                <tr class="empty-state-row">
                    <td colspan="3" class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>No users match your search criteria</p>
                    </td>
                </tr>
            `;
        } else {
            emptyStateRow.style.display = '';
        }
    } else if (emptyStateRow) {
        emptyStateRow.style.display = 'none';
    }
}

// Generate a report
function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const dateRange = document.getElementById('reportDateRange').value;
    const reportContent = document.getElementById('reportContent');
    
    // Show loading state
    reportContent.innerHTML = '<div class="loading-spinner"></div>';
    reportContent.style.display = 'block';
    
    // Simulate loading delay
    setTimeout(() => {
        let reportHtml = '';
        
        switch (reportType) {
            case 'faculty-load':
                reportHtml = generateFacultyLoadReport(dateRange);
                break;
                
            case 'room-utilization':
                reportHtml = generateRoomUtilizationReport(dateRange);
                break;
                
            case 'class-distribution':
                reportHtml = generateClassDistributionReport(dateRange);
                break;
                
            default:
                reportHtml = '<p>Unknown report type selected.</p>';
        }
        
        reportContent.innerHTML = reportHtml;
        showNotification('Report generated successfully', 'success');
    }, 1000);
}

// Generate Faculty Load Report
function generateFacultyLoadReport(dateRange) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const department = userData.department || 'Mathematics';
    
    return `
        <div class="report-header">
            <h3>Faculty Load Summary Report</h3>
            <p>Department: ${department}</p>
            <p>Period: ${formatDateRange(dateRange)}</p>
        </div>
        
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Faculty Name</th>
                    <th>Total Hours</th>
                    <th>Classes</th>
                    <th>Lecture Hours</th>
                    <th>Lab Hours</th>
                    <th>Load Status</th>
                </tr>
            </thead>
            <tbody>
                <tr class="empty-state-row">
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-chart-bar"></i>
                        <p>No faculty data available for this period</p>
                    </td>
                </tr>
                    <td>9</td>
                    <td>3</td>
                    <td><span class="status-badge draft">Under Load</span></td>
                </tr>
                <tr>
                    <td>Emily Wilson</td>
                    <td>24</td>
                    <td>8</td>
                    <td>18</td>
                    <td>6</td>
                    <td><span class="status-badge not-verified">Over Load</span></td>
                </tr>
            </tbody>
        </table>
        
        <div class="report-summary">
            <div class="summary-item">
                <span class="summary-label">Average Faculty Load:</span>
                <span class="summary-value">18.75 hours</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Department Coverage:</span>
                <span class="summary-value">92%</span>
            </div>
        </div>
    `;
}

// Generate Room Utilization Report
function generateRoomUtilizationReport(dateRange) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const department = userData.department || 'Mathematics';
    
    return `
        <div class="report-header">
            <h3>Room Utilization Report</h3>
            <p>Department: ${department}</p>
            <p>Period: ${formatDateRange(dateRange)}</p>
        </div>
        
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Room</th>
                    <th>Weekly Hours Used</th>
                    <th>Capacity</th>
                    <th>Utilization Rate</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Room 101</td>
                    <td>32</td>
                    <td>40</td>
                    <td>80%</td>
                    <td><span class="status-badge active">Optimal</span></td>
                </tr>
                <tr>
                    <td>Room 102</td>
                    <td>36</td>
                    <td>40</td>
                    <td>90%</td>
                    <td><span class="status-badge active">Optimal</span></td>
                </tr>
                <tr>
                    <td>Lab 201</td>
                    <td>24</td>
                    <td>40</td>
                    <td>60%</td>
                    <td><span class="status-badge draft">Under Utilized</span></td>
                </tr>
                <tr>
                    <td>Room 305</td>
                    <td>38</td>
                    <td>40</td>
                    <td>95%</td>
                    <td><span class="status-badge not-verified">Near Capacity</span></td>
                </tr>
            </tbody>
        </table>
        
        <div class="report-summary">
            <div class="summary-item">
                <span class="summary-label">Average Utilization:</span>
                <span class="summary-value">81.25%</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Total Weekly Hours:</span>
                <span class="summary-value">130 hours</span>
            </div>
        </div>
    `;
}

// Generate Class Distribution Report
function generateClassDistributionReport(dateRange) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const department = userData.department || 'Mathematics';
    
    return `
        <div class="report-header">
            <h3>Class Distribution Report</h3>
            <p>Department: ${department}</p>
            <p>Period: ${formatDateRange(dateRange)}</p>
        </div>
        
        <div class="chart-container">
            <div class="chart-placeholder">
                <i class="fas fa-chart-pie"></i>
                <p>Class distribution chart would appear here</p>
            </div>
        </div>
        
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Morning Classes</th>
                    <th>Afternoon Classes</th>
                    <th>Evening Classes</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Monday</td>
                    <td>5</td>
                    <td>4</td>
                    <td>2</td>
                    <td>11</td>
                </tr>
                <tr>
                    <td>Tuesday</td>
                    <td>4</td>
                    <td>5</td>
                    <td>1</td>
                    <td>10</td>
                </tr>
                <tr>
                    <td>Wednesday</td>
                    <td>6</td>
                    <td>3</td>
                    <td>2</td>
                    <td>11</td>
                </tr>
                <tr>
                    <td>Thursday</td>
                    <td>4</td>
                    <td>4</td>
                    <td>1</td>
                    <td>9</td>
                </tr>
                <tr>
                    <td>Friday</td>
                    <td>3</td>
                    <td>6</td>
                    <td>0</td>
                    <td>9</td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <th>Total</th>
                    <th>22</th>
                    <th>22</th>
                    <th>6</th>
                    <th>50</th>
                </tr>
            </tfoot>
        </table>
    `;
}

// Format date range for reports
function formatDateRange(dateRange) {
    const current = new Date();
    const year = current.getFullYear();
    
    switch (dateRange) {
        case 'current':
            return `Current Semester (${getMonthRange(current)})`;
            
        case 'previous':
            return `Previous Semester (${getPreviousSemester()})`;
            
        case 'annual':
            return `Annual ${year}`;
            
        default:
            return dateRange;
    }
}

// Helper to get month range
function getMonthRange(date) {
    const month = date.getMonth();
    
    if (month >= 0 && month <= 4) {
        return 'January - May ' + date.getFullYear();
    } else if (month >= 5 && month <= 7) {
        return 'June - August ' + date.getFullYear();
    } else {
        return 'September - December ' + date.getFullYear();
    }
}

// Helper to get previous semester
function getPreviousSemester() {
    const current = new Date();
    const month = current.getMonth();
    const year = current.getFullYear();
    
    if (month >= 0 && month <= 4) {
        return 'September - December ' + (year - 1);
    } else if (month >= 5 && month <= 7) {
        return 'January - May ' + year;
    } else {
        return 'June - August ' + year;
    }
}

// Export report (demo function)
function exportReport() {
    const reportType = document.getElementById('reportType')?.value;
    const reportContent = document.getElementById('reportContent');
    
    if (!reportContent || reportContent.style.display !== 'block') {
        showNotification('Please generate a report first', 'error');
        return;
    }
    
    // Show export notification
    showNotification('Exporting report to Excel...', 'success');
    
    // Simulate export delay
    setTimeout(() => {
        showNotification('Report exported successfully!', 'success');
    }, 3000);
}

// Handle add department form submission
async function handleAddDepartment(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const departmentData = {
        code: formData.get('code').trim(),
        name: formData.get('name').trim()
    };
    
    try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/departments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(departmentData)
        });
        
        if (response.ok) {
            showNotification('Department added successfully!', 'success');
            form.reset();
            document.getElementById('addDepartmentModal').style.display = 'none';
            loadDepartmentUsers();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add department');
        }
    } catch (error) {
        console.error('Error adding department:', error);
        showNotification(error.message || 'Failed to add department', 'error');
    }
}

// Handle add faculty form submission
async function handleAddFaculty(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const facultyData = {
        firstName: formData.get('firstName').trim(),
        lastName: formData.get('lastName').trim(),
        email: formData.get('email').trim().toLowerCase(),
        role: 'faculty',
        department: JSON.parse(localStorage.getItem('userData') || '{}').departmentId
    };
    
    try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                ...facultyData,
                password: generateTemporaryPassword(),
                status: 'approved' // Auto-approve faculty added by admin
            })
        });
        
        if (response.ok) {
            showNotification('Faculty member added successfully!', 'success');
            form.reset();
            document.getElementById('addFacultyModal').style.display = 'none';
            loadDepartmentUsers();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to add faculty member');
        }
    } catch (error) {
        console.error('Error adding faculty member:', error);
        showNotification(error.message || 'Failed to add faculty member', 'error');
    }
}

// Generate a temporary password for new faculty
function generateTemporaryPassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}
