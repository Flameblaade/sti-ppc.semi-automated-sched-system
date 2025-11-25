document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and role
    const authToken = localStorage.getItem('authToken');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const demoUserData = JSON.parse(localStorage.getItem('demoUserData') || '{}');
    
    // For a fresh system, create a superadmin account if it's the first access
    if (!authToken && !localStorage.getItem('initialSuperAdminCreated')) {
        // Create a demo superadmin for first access
        const initialSuperAdmin = {
            id: 'initial-superadmin',
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin@school.edu',
            role: 'superadmin',
            department: 'All',
            verified: true
        };
        
        localStorage.setItem('userData', JSON.stringify(initialSuperAdmin));
        localStorage.setItem('initialSuperAdminCreated', 'true');
        location.reload(); // Reload to use the new superadmin account
        return;
    }
    
    // If not authenticated or not superadmin, check if in demo mode first
    if ((!authToken && !demoUserData) || userData.role !== 'superadmin') {
        alert('Unauthorized access. Please login with a superadmin account.');
        window.location.href = 'login.html';
        return;
    }
    
    // Set superadmin name in header
    document.getElementById('superadminName').textContent = `${userData.firstName} ${userData.lastName}`;
    
    // Initialize components
    initMenu();
    loadPendingAccounts();
    loadApprovedUsers();
    loadDepartments();
    initEventListeners();
    initSystemComponents();
    initDataManagementTabs();
    initEntityManagementTabs();
    
    // Add demo message if in demo mode
    if (!authToken && localStorage.getItem('demoUserData')) {
        showNotification('You are in demo mode. Some functionality may be limited.', 'warning');
    }
});

// Initialize system components
function initSystemComponents() {
    // Initialize system logs
    displaySystemLogs();
    
    // Initialize data management components
    initDataManagementTabs();
    initEntityManagementTabs();
    
    // Initialize entity management components
    initFacultyManagement();
    initSubjectManagement();
    initStrandsManagement();
}

// Initialize sidebar menu
function initMenu() {
    const menuItems = document.querySelectorAll('.admin-menu a');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all menu items and sections
            document.querySelectorAll('.admin-menu li').forEach(li => li.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked menu item
            this.parentElement.classList.add('active');
            
            // Show corresponding section
            const sectionId = this.getAttribute('data-section');
            document.getElementById(sectionId).classList.add('active');
        });
    });
}

// Load pending user accounts
async function loadPendingAccounts() {
    try {
        // Get authentication token
        const authToken = localStorage.getItem('authToken');
        
        // Get pending users from localStorage since this is a demo/prototype
        const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
        
        // Display the pending accounts
        displayPendingAccounts(pendingUsers);
        
        // For a demo, create some sample pending users if none exist
        if (pendingUsers.length === 0 && !localStorage.getItem('pendingUsersInitialized')) {
            // Create sample pending users for demo purposes
            const demoUsers = [
                {
                    id: 'pending-1',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com',
                    createdAt: new Date().toISOString(),
                    verified: true
                },
                {
                    id: 'pending-2',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    email: 'jane.smith@example.com',
                    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                    verified: false
                }
            ];
            
            localStorage.setItem('pendingUsers', JSON.stringify(demoUsers));
            localStorage.setItem('pendingUsersInitialized', 'true');
            
            // Reload the pending accounts
            displayPendingAccounts(demoUsers);
        }
        
    } catch (error) {
        console.error('Error loading pending accounts:', error);
        showNotification('Failed to load pending accounts. Using demo data instead.', 'error');
        showDemoPendingAccounts();
    }
}

// Display pending accounts in the table
function displayPendingAccounts(pendingUsers) {
    const tableBody = document.getElementById('pendingAccountsTable');
    tableBody.innerHTML = '';
    
    if (pendingUsers.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="5" class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <p>No pending accounts at the moment</p>
                </td>
            </tr>
        `;
        return;
    }
    
    pendingUsers.forEach(user => {
        const row = document.createElement('tr');
        
        // Format date
        const registeredDate = new Date(user.createdAt);
        const formattedDate = registeredDate.toLocaleDateString() + ' ' + 
                              registeredDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        row.innerHTML = `
            <td>${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}</td>
            <td>${user.email}</td>
            <td>${formattedDate}</td>
            <td>
                <span class="status-badge ${user.verified ? 'verified' : 'not-verified'}">
                    ${user.verified ? 'Verified' : 'Not Verified'}
                </span>
            </td>
            <td class="action-cell">
                <button class="btn-sm btn-approve approve-user" data-id="${user.id}">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-sm btn-reject reject-user" data-id="${user.id}">
                    <i class="fas fa-times"></i> Reject
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the newly created buttons
    addPendingAccountEventListeners();
}

// Show demo pending accounts (for demo mode)
function showDemoPendingAccounts() {
    // Get real pending users from localStorage
    const allDemoUsers = JSON.parse(localStorage.getItem('demoUsers') || '[]');
    const pendingUsers = allDemoUsers.filter(user => !user.approved);
    
    // Display any pending accounts or an empty list
    displayPendingAccounts(pendingUsers);
}

// Add event listeners to buttons in pending accounts table
function addPendingAccountEventListeners() {
    // Approve user buttons
    document.querySelectorAll('.approve-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            approveUser(userId);
        });
    });
    
    // Reject user buttons
    document.querySelectorAll('.reject-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            rejectUser(userId);
        });
    });
}

// Open the approve user modal
async function openApproveUserModal(userId) {
    const modal = document.getElementById('approveUserModal');
    const approveUserId = document.getElementById('approveUserId');
    const approveUserDepartmentSelect = document.getElementById('approveUserDepartment');
    
    // Set user ID in hidden field
    approveUserId.value = userId;
    
    // Clear previous department options
    approveUserDepartmentSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
    
    try {
        // Get departments
        const departments = await getDepartments();
        
        // Add departments to select
        departments.forEach(department => {
            const option = document.createElement('option');
            option.value = department;
            option.textContent = department;
            approveUserDepartmentSelect.appendChild(option);
        });
        
        // Find user details either from pending accounts table or make API request
        const userRow = document.querySelector(`.approve-user[data-id="${userId}"]`).closest('tr');
        const userName = userRow.cells[0].textContent;
        const userEmail = userRow.cells[1].textContent;
        const userVerified = userRow.cells[3].textContent.trim() === 'Verified' ? 'Yes' : 'No';
        
        // Set user info in modal
        document.getElementById('approveUserName').textContent = userName;
        document.getElementById('approveUserEmail').textContent = userEmail;
        document.getElementById('approveUserVerified').textContent = userVerified;
        
        // Show modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error preparing approve user modal:', error);
        showNotification('Failed to prepare approval form', 'error');
    }
}

// Get departments (from API or demo data)
async function getDepartments() {
    const authToken = localStorage.getItem('authToken');
    
    if (!authToken) {
        // Return demo departments
        return ['Mathematics', 'Science', 'English', 'History', 'Computer Science', 'Arts'];
    }
    
    try {
        const response = await fetch('/api/departments', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch departments');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching departments:', error);
        return ['Mathematics', 'Science', 'English', 'History', 'Computer Science', 'Arts'];
    }
}

// Approve a pending user
async function approveUser() {
    const userId = document.getElementById('approveUserId').value;
    const role = document.getElementById('approveUserRole').value;
    const department = document.getElementById('approveUserDepartment').value;
    
    if (!role || !department) {
        showNotification('Please select both role and department', 'error');
        return;
    }
    
    // If faculty role is selected, check if subjects are selected
    let selectedSubjects = [];
    if (role === 'faculty') {
        const subjectsSelect = document.getElementById('facultySubjects');
        selectedSubjects = Array.from(subjectsSelect.selectedOptions).map(option => option.value);
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {            // Demo mode - use localStorage to approve the user
            const demoUsers = JSON.parse(localStorage.getItem('demoUsers') || '[]');
            const userIndex = demoUsers.findIndex(u => u.id === userId);
            
            if (userIndex >= 0) {
                const user = demoUsers[userIndex];
                
                // Update the user with role and department
                user.approved = true;
                user.role = role;
                user.department = department;
                
                // Save back to localStorage
                localStorage.setItem('demoUsers', JSON.stringify(demoUsers));
                
                // If user is a faculty member, create or update faculty record
                if (role === 'faculty') {
                    const facultyMembers = JSON.parse(localStorage.getItem('facultyMembers') || '[]');
                    
                    // Check if faculty already exists for this user
                    const existingFacultyIndex = facultyMembers.findIndex(f => f.userId === userId);
                    
                    if (existingFacultyIndex >= 0) {
                        // Update existing faculty record
                        facultyMembers[existingFacultyIndex].department = department;
                        facultyMembers[existingFacultyIndex].subjects = selectedSubjects;
                    } else {
                        // Create new faculty record
                        const newFaculty = {
                            id: 'faculty-' + Date.now(),
                            userId: userId,
                            firstName: user.firstName || '',
                            middleName: user.middleName || '',
                            lastName: user.lastName || '',
                            name: `${user.firstName || ''} ${user.lastName || ''}`,
                            email: user.email || '',
                            department: department,
                            subjects: selectedSubjects
                        };
                        
                        facultyMembers.push(newFaculty);
                    }
                    
                    // Save updated faculty records
                    localStorage.setItem('facultyMembers', JSON.stringify(facultyMembers));
                }
                
                showNotification('User approved successfully', 'success');
                closeModal('approveUserModal');
                
                // Redirect to manage users page
                document.querySelector('a[href="#manage-users"]').click();
            } else {
                showNotification('User not found', 'error');
            }
            
            // Refresh tables
            loadPendingAccounts();
            loadApprovedUsers();
            
            // Refresh entity management tables if appropriate
            if (role === 'faculty') {
                loadEmFaculty();
            }
            
            return;
        }
        
        // Real API call
        const response = await fetch(`/api/users/approve/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role,
                department
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to approve user');
        }
        
        // Close modal
        closeModal('approveUserModal');
        
        // Show success notification
        showNotification('User approved successfully', 'success');
        
        // Refresh tables
        loadPendingAccounts();
        loadApprovedUsers();
        
    } catch (error) {
        console.error('Error approving user:', error);
        showNotification('Failed to approve user', 'error');
    }
}

// Reject a pending user
async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user registration?')) {
        return;
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {
            // Demo mode - simulate rejection
            
            // Remove user from table
            const userRow = document.querySelector(`.reject-user[data-id="${userId}"]`).closest('tr');
            userRow.remove();
            
            // Check if table is empty now
            const tableBody = document.getElementById('pendingAccountsTable');
            if (tableBody.children.length === 0) {
                tableBody.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-user-clock"></i>
                            <p>No pending accounts at the moment</p>
                        </td>
                    </tr>
                `;
            }
            
            showNotification('User rejected successfully (demo mode)', 'success');
            return;
        }
        
        // Real API call
        const response = await fetch(`/api/users/reject/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reject user');
        }
        
        // Show success notification
        showNotification('User rejected successfully', 'success');
        
        // Refresh pending accounts
        loadPendingAccounts();
        
    } catch (error) {
        console.error('Error rejecting user:', error);
        showNotification('Failed to reject user', 'error');
    }
}

// Load approved users
async function loadApprovedUsers() {
    try {
        // Get approved users from localStorage
        const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
        
        // Display the approved users
        displayApprovedUsers(approvedUsers);
        
        // For a demo, create some sample approved users if none exist
        if (approvedUsers.length === 0 && !localStorage.getItem('approvedUsersInitialized')) {
            // Create sample approved users for demo purposes
            const demoUsers = [
                {
                    id: 'approved-1',
                    firstName: 'Admin',
                    lastName: 'User',
                    email: 'admin@example.com',
                    role: 'admin',
                    department: 'BSIT',
                    approved: true,
                    verified: true
                },
                {
                    id: 'approved-2',
                    firstName: 'Regular',
                    lastName: 'User',
                    email: 'user@example.com',
                    role: 'user',
                    department: 'BSHM',
                    approved: true,
                    verified: true
                }
            ];
            
            localStorage.setItem('approvedUsers', JSON.stringify(demoUsers));
            localStorage.setItem('approvedUsersInitialized', 'true');
            
            // Reload the approved users
            displayApprovedUsers(demoUsers);
        }
        
    } catch (error) {
        console.error('Error loading approved users:', error);
        showNotification('Failed to load approved users', 'error');
    }
}

// Display approved users in the table
function displayApprovedUsers(users) {
    const tableBody = document.getElementById('usersTable');
    
    if (!tableBody) {
        console.error('Users table body element not found');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="5" class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No approved users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${user.department || 'Not assigned'}</td>
            <td class="action-cell">
                <button class="btn-sm btn-edit edit-user" data-id="${user.id}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-reject delete-user" data-id="${user.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the newly created buttons
    addApprovedUserEventListeners();
}

// Add event listeners for approved users table
function addApprovedUserEventListeners() {
    // Edit user buttons
    document.querySelectorAll('.edit-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            editUser(userId);
        });
    });
    
    // Delete user buttons
    document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            deleteUser(userId);
        });
    });
}

// Open the edit user modal
async function openEditUserModal(userId) {
    const modal = document.getElementById('editUserModal');
    const editUserId = document.getElementById('editUserId');
    const editUserRoleSelect = document.getElementById('editUserRole');
    const editUserDepartmentSelect = document.getElementById('editUserDepartment');
    
    // Set user ID in hidden field
    editUserId.value = userId;
    
    // Clear previous department options
    editUserDepartmentSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
    
    try {
        // Get departments
        const departments = await getDepartments();
        
        // Add departments to select
        departments.forEach(department => {
            const option = document.createElement('option');
            option.value = department;
            option.textContent = department;
            editUserDepartmentSelect.appendChild(option);
        });
        
        // Find user details from users table
        const userRow = document.querySelector(`.edit-user[data-id="${userId}"]`).closest('tr');
        const userName = userRow.cells[0].textContent;
        const userEmail = userRow.cells[1].textContent;
        const userRole = userRow.cells[2].textContent.trim();
        const userDepartment = userRow.cells[3].textContent;
        
        // Set user info in modal
        document.getElementById('editUserName').textContent = userName;
        document.getElementById('editUserEmail').textContent = userEmail;
        editUserRoleSelect.value = userRole.toLowerCase();
        
        // Find department in options and set it
        for (let i = 0; i < editUserDepartmentSelect.options.length; i++) {
            if (editUserDepartmentSelect.options[i].text === userDepartment) {
                editUserDepartmentSelect.selectedIndex = i;
                break;
            }
        }
        
        // Show modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error preparing edit user modal:', error);
        showNotification('Failed to prepare edit form', 'error');
    }
}

// Edit a user (save changes)
async function saveUserChanges() {
    const userId = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;
    const department = document.getElementById('editUserDepartment').value;
    
    if (!role || !department) {
        showNotification('Please select both role and department', 'error');
        return;
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {
            // Demo mode - simulate editing
            closeModal('editUserModal');
            
            // Update user in table
            const userRow = document.querySelector(`.edit-user[data-id="${userId}"]`).closest('tr');
            userRow.cells[2].innerHTML = `<span class="status-badge role-${role}">${role}</span>`;
            userRow.cells[3].textContent = department;
            
            showNotification('User updated successfully (demo mode)', 'success');
            return;
        }
        
        // Real API call would be here
        // This endpoint is not implemented in the server yet
        showNotification('User updated successfully', 'success');
        closeModal('editUserModal');
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Failed to update user', 'error');
    }
}

// Delete a user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    
    try {
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {
            // Demo mode - simulate deletion
            
            // Remove user from table
            const userRow = document.querySelector(`.delete-user[data-id="${userId}"]`).closest('tr');
            userRow.remove();
            
            // Check if table is empty now
            const tableBody = document.getElementById('usersTable');
            if (tableBody.children.length === 0) {
                tableBody.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-users"></i>
                            <p>No users found</p>
                        </td>
                    </tr>
                `;
            }
            
            showNotification('User deleted successfully (demo mode)', 'success');
            return;
        }
        
        // Real API call would be here
        // This endpoint is not implemented in the server yet
        showNotification('This feature is not implemented on the server yet', 'error');
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

// Load departments
async function loadDepartments() {
    try {
        // Get departments from localStorage
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Display the departments
        displayDepartments(departments);
        
        // Populate department dropdowns
        populateDepartmentDropdowns(departments);
        
        // For a demo, create some sample departments if none exist
        if (departments.length === 0 && !localStorage.getItem('departmentsInitialized')) {
            // Create sample departments for demo purposes
            const demoDepartments = [
                {
                    code: 'BSIT',
                    name: 'BS Information Technology'
                },
                {
                    code: 'BSAIS',
                    name: 'BS Accounting Information Systems'
                },
                {
                    code: 'BSHM',
                    name: 'BS Hospitality Management'
                },
                {
                    code: 'BSTM',
                    name: 'BS Tourism Management'
                }
            ];
            
            localStorage.setItem('departments', JSON.stringify(demoDepartments));
            localStorage.setItem('departmentsInitialized', 'true');
            
            // Reload the departments
            displayDepartments(demoDepartments);
            populateDepartmentDropdowns(demoDepartments);
        }
        
    } catch (error) {
        console.error('Error loading departments:', error);
        showNotification('Failed to load departments', 'error');
    }
}

// Display departments in the table
function displayDepartments(departments) {
    const tableBody = document.getElementById('departmentsTable');
    
    if (!tableBody) {
        console.error('Departments table body element not found');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (departments.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="4" class="empty-state">
                    <i class="fas fa-building"></i>
                    <p>No departments found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Get users to count department members
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
    
    departments.forEach(dept => {
        const row = document.createElement('tr');
        
        // Count users and admins in this department
        const departmentUsers = approvedUsers.filter(u => u.department === dept.code);
        const userCount = departmentUsers.filter(u => u.role === 'user').length;
        const adminCount = departmentUsers.filter(u => u.role === 'admin').length;
        
        row.innerHTML = `
            <td><strong>${dept.name}</strong> <span class="dept-code">(${dept.code})</span></td>
            <td>${userCount}</td>
            <td>${adminCount}</td>
            <td class="action-cell">
                <button class="btn-sm btn-edit edit-department" data-code="${dept.code}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-reject delete-department" data-code="${dept.code}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the newly created buttons
    addDepartmentEventListeners();
}

// Add event listeners for department table
function addDepartmentEventListeners() {
    // Edit department buttons
    document.querySelectorAll('.edit-department').forEach(button => {
        button.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-code');
            editDepartment(deptCode);
        });
    });
    
    // Delete department buttons
    document.querySelectorAll('.delete-department').forEach(button => {
        button.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-code');
            deleteDepartment(deptCode);
        });
    });
}

// Populate department dropdowns
function populateDepartmentDropdowns(departments) {
    const dropdowns = [
        document.getElementById('approveUserDepartment'),
        document.getElementById('editUserDepartment'),
        document.getElementById('filterUserDepartment')
    ];
    
    dropdowns.forEach(dropdown => {
        if (!dropdown) return;
        
        // Save current selection if any
        const currentValue = dropdown.value;
        
        // Clear options except the first one (if it's a filter dropdown)
        if (dropdown.id === 'filterUserDepartment') {
            dropdown.innerHTML = '<option value="">All Departments</option>';
        } else {
            dropdown.innerHTML = '';
        }
        
        // Add department options
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.code;
            option.textContent = `${dept.name} (${dept.code})`;
            dropdown.appendChild(option);
        });
        
        // Restore previous selection if it exists in new options
        if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
            dropdown.value = currentValue;
        }
    });
}

// Populate a department dropdown
function populateDepartmentDropdown(selectId) {
    return new Promise((resolve) => {
        const select = document.getElementById(selectId);
        if (!select) return resolve();
        
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Clear current options except the first placeholder option
        select.innerHTML = '<option value="" disabled selected>Select Department</option>';
        
        // Add departments to dropdown
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.code;
            option.textContent = `${dept.code} - ${dept.name}`;
            select.appendChild(option);
        });
        
        resolve();
    });
}

// Initialize general event listeners
function initEventListeners() {
    // Set up logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Refresh buttons
    const refreshPendingBtn = document.getElementById('refreshPendingBtn');
    if (refreshPendingBtn) {
        refreshPendingBtn.addEventListener('click', function() {
            loadPendingAccounts();
            showNotification('Pending accounts refreshed', 'info');
        });
    }

    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', function() {
            loadApprovedUsers();
            showNotification('User list refreshed', 'info');
        });
    }
    
    // Department buttons
    const addDepartmentBtn = document.getElementById('addDepartmentBtn');
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener('click', function() {
            showModal('addDepartmentModal');
        });
    }
    
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');
    if (saveDepartmentBtn) {
        saveDepartmentBtn.addEventListener('click', function() {
            saveDepartment();
        });
    }

    // User search and filter
    const userSearchBtn = document.getElementById('userSearchBtn');
    if (userSearchBtn) {
        userSearchBtn.addEventListener('click', function() {
            filterUsers();
        });
    }
    
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                filterUsers();
            }
        });
    }
    
    const filterUserRole = document.getElementById('filterUserRole');
    if (filterUserRole) {
        filterUserRole.addEventListener('change', filterUsers);
    }
    
    const filterUserDepartment = document.getElementById('filterUserDepartment');
    if (filterUserDepartment) {
        filterUserDepartment.addEventListener('change', filterUsers);
    }
    
    // System logs
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', function() {
            showConfirmModal('Are you sure you want to clear all system logs?', clearAllLogs);
        });
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // Outside modal click to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });
}

// Approve a user account
function approveUser(userId) {
    const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
    const user = pendingUsers.find(u => u.id === userId);
    
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Get existing approved users
    let approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
    
    // Add user to approved list
    user.approved = true;
    approvedUsers.push(user);
    
    // Remove from pending list
    const updatedPendingUsers = pendingUsers.filter(u => u.id !== userId);
    
    // Update localStorage
    localStorage.setItem('approvedUsers', JSON.stringify(approvedUsers));
    localStorage.setItem('pendingUsers', JSON.stringify(updatedPendingUsers));
    
    // Refresh lists
    loadPendingAccounts();
    loadApprovedUsers();
    
    addSystemLog(`User ${user.firstName} ${user.lastName} (${user.email}) approved by superadmin`);
    showNotification(`User ${user.firstName} ${user.lastName} approved successfully`, 'success');
}

// Reject a user account
function rejectUser(userId) {
    showConfirmModal('Are you sure you want to reject this user?', () => {
        const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
        const user = pendingUsers.find(u => u.id === userId);
        
        if (!user) {
            showNotification('User not found', 'error');
            return;
        }
        
        // Remove from pending list
        const updatedPendingUsers = pendingUsers.filter(u => u.id !== userId);
        localStorage.setItem('pendingUsers', JSON.stringify(updatedPendingUsers));
        
        // Refresh lists
        loadPendingAccounts();
        
        addSystemLog(`User ${user.firstName} ${user.lastName} (${user.email}) rejected by superadmin`);
        showNotification(`User ${user.firstName} ${user.lastName} rejected`, 'info');
    });
}

// Edit a user account
function editUser(userId) {
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
    const user = approvedUsers.find(u => u.id === userId);
    
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Populate the edit form
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editFirstName').value = user.firstName || '';
    document.getElementById('editLastName').value = user.lastName || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editRole').value = user.role || 'user';
    document.getElementById('editDepartment').value = user.department || '';
    
    showModal('editUserModal');
}

// Save edited user
function saveUserChanges() {
    const userId = document.getElementById('editUserId').value;
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const role = document.getElementById('editRole').value;
    const department = document.getElementById('editDepartment').value;
    
    if (!firstName || !lastName || !email) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
    const userIndex = approvedUsers.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Update user data
    approvedUsers[userIndex].firstName = firstName;
    approvedUsers[userIndex].lastName = lastName;
    approvedUsers[userIndex].email = email;
    approvedUsers[userIndex].role = role;
    approvedUsers[userIndex].department = department;
    
    // Save changes
    localStorage.setItem('approvedUsers', JSON.stringify(approvedUsers));
    
    // If the current user is being edited, update userData as well
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.id === userId) {
        userData.firstName = firstName;
        userData.lastName = lastName;
        userData.email = email;
        userData.role = role;
        userData.department = department;
        localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    // Refresh the list
    loadApprovedUsers();
    
    // Close modal and show notification
    hideModal('editUserModal');
    addSystemLog(`User ${firstName} ${lastName} (${email}) updated by superadmin`);
    showNotification('User information updated successfully', 'success');
}

// Delete a user
function deleteUser(userId) {
    showConfirmModal('Are you sure you want to delete this user? This action cannot be undone.', () => {
        const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
        const user = approvedUsers.find(u => u.id === userId);
        
        if (!user) {
            showNotification('User not found', 'error');
            return;
        }
        
        // Remove user from approved list
        const updatedApprovedUsers = approvedUsers.filter(u => u.id !== userId);
        localStorage.setItem('approvedUsers', JSON.stringify(updatedApprovedUsers));
        
        // Refresh list
        loadApprovedUsers();
        
        addSystemLog(`User ${user.firstName} ${user.lastName} (${user.email}) deleted by superadmin`);
        showNotification(`User ${user.firstName} ${user.lastName} deleted`, 'info');
    });
}

// Load departments
async function loadDepartments() {
    try {
        // Get departments from localStorage
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Display the departments
        displayDepartments(departments);
        
        // Populate department dropdowns
        populateDepartmentDropdowns(departments);
        
        // For a demo, create some sample departments if none exist
        if (departments.length === 0 && !localStorage.getItem('departmentsInitialized')) {
            // Create sample departments for demo purposes
            const demoDepartments = [
                {
                    code: 'BSIT',
                    name: 'BS Information Technology'
                },
                {
                    code: 'BSAIS',
                    name: 'BS Accounting Information Systems'
                },
                {
                    code: 'BSHM',
                    name: 'BS Hospitality Management'
                },
                {
                    code: 'BSTM',
                    name: 'BS Tourism Management'
                }
            ];
            
            localStorage.setItem('departments', JSON.stringify(demoDepartments));
            localStorage.setItem('departmentsInitialized', 'true');
            
            // Reload the departments
            displayDepartments(demoDepartments);
            populateDepartmentDropdowns(demoDepartments);
        }
        
    } catch (error) {
        console.error('Error loading departments:', error);
        showNotification('Failed to load departments', 'error');
    }
}

// Display departments in the table
function displayDepartments(departments) {
    const tableBody = document.getElementById('departmentsTable');
    
    if (!tableBody) {
        console.error('Departments table body element not found');
        return;
    }
    
    tableBody.innerHTML = '';
    
    if (departments.length === 0) {
        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="4" class="empty-state">
                    <i class="fas fa-building"></i>
                    <p>No departments found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Get users to count department members
    const approvedUsers = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
    
    departments.forEach(dept => {
        const row = document.createElement('tr');
        
        // Count users and admins in this department
        const departmentUsers = approvedUsers.filter(u => u.department === dept.code);
        const userCount = departmentUsers.filter(u => u.role === 'user').length;
        const adminCount = departmentUsers.filter(u => u.role === 'admin').length;
        
        row.innerHTML = `
            <td><strong>${dept.name}</strong> <span class="dept-code">(${dept.code})</span></td>
            <td>${userCount}</td>
            <td>${adminCount}</td>
            <td class="action-cell">
                <button class="btn-sm btn-edit edit-department" data-code="${dept.code}">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-sm btn-reject delete-department" data-code="${dept.code}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners to the newly created buttons
    addDepartmentEventListeners();
}

// Add event listeners for department table
function addDepartmentEventListeners() {
    // Edit department buttons
    document.querySelectorAll('.edit-department').forEach(button => {
        button.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-code');
            editDepartment(deptCode);
        });
    });
    
    // Delete department buttons
    document.querySelectorAll('.delete-department').forEach(button => {
        button.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-code');
            deleteDepartment(deptCode);
        });
    });
}

// Populate department dropdowns
function populateDepartmentDropdowns(departments) {
    const dropdowns = [
        document.getElementById('approveUserDepartment'),
        document.getElementById('editUserDepartment'),
        document.getElementById('filterUserDepartment')
    ];
    
    dropdowns.forEach(dropdown => {
        if (!dropdown) return;
        
        // Save current selection if any
        const currentValue = dropdown.value;
        
        // Clear options except the first one (if it's a filter dropdown)
        if (dropdown.id === 'filterUserDepartment') {
            dropdown.innerHTML = '<option value="">All Departments</option>';
        } else {
            dropdown.innerHTML = '';
        }
        
        // Add department options
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.code;
            option.textContent = `${dept.name} (${dept.code})`;
            dropdown.appendChild(option);
        });
        
        // Restore previous selection if it exists in new options
        if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
            dropdown.value = currentValue;
        }
    });
}

// Populate a department dropdown
function populateDepartmentDropdown(selectId) {
    return new Promise((resolve) => {
        const select = document.getElementById(selectId);
        if (!select) return resolve();
        
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Clear current options except the first placeholder option
        select.innerHTML = '<option value="" disabled selected>Select Department</option>';
        
        // Add departments to dropdown
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.code;
            option.textContent = `${dept.code} - ${dept.name}`;
            select.appendChild(option);
        });
        
        resolve();
    });
}

// Initialize general event listeners
function initEventListeners() {
    // Set up logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Refresh buttons
    const refreshPendingBtn = document.getElementById('refreshPendingBtn');
    if (refreshPendingBtn) {
        refreshPendingBtn.addEventListener('click', function() {
            loadPendingAccounts();
            showNotification('Pending accounts refreshed', 'info');
        });
    }

    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', function() {
            loadApprovedUsers();
            showNotification('User list refreshed', 'info');
        });
    }
    
    // Department buttons
    const addDepartmentBtn = document.getElementById('addDepartmentBtn');
    if (addDepartmentBtn) {
        addDepartmentBtn.addEventListener('click', function() {
            showModal('addDepartmentModal');
        });
    }
    
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');
    if (saveDepartmentBtn) {
        saveDepartmentBtn.addEventListener('click', function() {
            saveDepartment();
        });
    }

    // User search and filter
    const userSearchBtn = document.getElementById('userSearchBtn');
    if (userSearchBtn) {
        userSearchBtn.addEventListener('click', function() {
            filterUsers();
        });
    }
    
    const userSearchInput = document.getElementById('userSearchInput');
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                filterUsers();
            }
        });
    }
    
    const filterUserRole = document.getElementById('filterUserRole');
    if (filterUserRole) {
        filterUserRole.addEventListener('change', filterUsers);
    }
    
    const filterUserDepartment = document.getElementById('filterUserDepartment');
    if (filterUserDepartment) {
        filterUserDepartment.addEventListener('change', filterUsers);
    }
    
    // System logs
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', function() {
            showConfirmModal('Are you sure you want to clear all system logs?', clearAllLogs);
        });
    }
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // Outside modal click to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });
}

// Initialize entity management tabs
function initEntityManagementTabs() {
    const tabBtns = document.querySelectorAll('.category-tabs .tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all tabs
            tabBtns.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            const tabContents = document.querySelectorAll('.section-content .tab-content');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Add Department button click handler
    const emAddDepartmentBtn = document.getElementById('emAddDepartmentBtn');
    if (emAddDepartmentBtn) {
        emAddDepartmentBtn.addEventListener('click', function() {
            // Reset department form fields
            const departmentForm = document.getElementById('addDepartmentForm');
            if (departmentForm) departmentForm.reset();
            
            // Show add department modal
            showModal('addDepartmentModal');
        });
    }
    
    // Add Faculty button click handler
    const emAddFacultyBtn = document.getElementById('emAddFacultyBtn');
    if (emAddFacultyBtn) {
        emAddFacultyBtn.addEventListener('click', function() {
            // Reset faculty form fields
            const facultyForm = document.getElementById('addFacultyForm');
            if (facultyForm) facultyForm.reset();
            
            // Show add faculty modal
            showModal('addFacultyModal');
        });
    }
    
    // Add Subject button click handler
    const emAddSubjectBtn = document.getElementById('emAddSubjectBtn');
    if (emAddSubjectBtn) {
        emAddSubjectBtn.addEventListener('click', function() {
            // Reset subject form fields
            const subjectForm = document.getElementById('addSubjectForm');
            if (subjectForm) subjectForm.reset();
            
            // Show add subject modal
            showModal('addSubjectModal');
        });
    }
    
    // Add Strand/Course button click handler
    const emAddStrandBtn = document.getElementById('emAddStrandBtn');
    if (emAddStrandBtn) {
        emAddStrandBtn.addEventListener('click', function() {
            // Reset strand form fields
            const strandForm = document.getElementById('addStrandForm');
            if (strandForm) strandForm.reset();
            
            // Show add strand modal
            showModal('addStrandModal');
        });
    }
    
    // Initialize department management
    initDepartmentManagement();
}

// Initialize department management
function initDepartmentManagement() {
    // Load departments
    loadAndDisplayDepartments();
    
    // Add save department button handler
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');
    if (saveDepartmentBtn) {
        saveDepartmentBtn.addEventListener('click', function() {
            saveDepartment();
        });
    }
}

// Load and display departments in the table
function loadAndDisplayDepartments() {
    try {
        // Get departments from localStorage
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        const users = JSON.parse(localStorage.getItem('usersData') || '[]');
        
        const departmentsTable = document.getElementById('emDepartmentsTable');
        if (departmentsTable) {
            if (departments.length === 0) {
                departmentsTable.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="5" class="empty-state">
                            <i class="fas fa-building"></i>
                            <p>No departments found</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Clear table
            departmentsTable.innerHTML = '';
            
            // Populate table with departments
            departments.forEach(dept => {
                // Count users in this department
                const deptUsers = users.filter(user => user.department === dept.code);
                const deptAdmins = deptUsers.filter(user => user.role === 'admin');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dept.code}</td>
                    <td>${dept.name}</td>
                    <td>${deptUsers.length}</td>
                    <td>${deptAdmins.length}</td>
                    <td>
                        <button class="btn btn-sm btn-edit edit-department-btn" data-id="${dept.code}" title="Edit Department">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-delete delete-department-btn" data-id="${dept.code}" title="Delete Department">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                departmentsTable.appendChild(row);
            });
            
            // Add event listeners for edit and delete buttons
            addDepartmentActionListeners();
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// Add event listeners for department action buttons
function addDepartmentActionListeners() {
    // Edit department buttons
    document.querySelectorAll('.edit-department-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-id');
            editDepartment(deptCode);
        });
    });
    
    // Delete department buttons
    document.querySelectorAll('.delete-department-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const deptCode = this.getAttribute('data-id');
            deleteDepartment(deptCode);
        });
    });
}

// Save a new or updated department
function saveDepartment() {
    const departmentCodeField = document.getElementById('departmentCode');
    const departmentNameField = document.getElementById('departmentName');
    
    // Basic validation
    if (!departmentCodeField || !departmentCodeField.value.trim()) {
        showFormError(departmentCodeField, 'Department code is required');
        return;
    }
    
    if (!departmentNameField || !departmentNameField.value.trim()) {
        showFormError(departmentNameField, 'Department name is required');
        return;
    }
    
    try {
        // Get existing departments
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Check if we're editing (hidden field with department ID)
        const editDeptId = document.getElementById('editDepartmentId')?.value;
        
        if (editDeptId) {
            // Update existing department
            const deptIndex = departments.findIndex(dept => dept.code === editDeptId);
            
            if (deptIndex >= 0) {
                departments[deptIndex] = {
                    code: departmentCodeField.value.trim().toUpperCase(),
                    name: departmentNameField.value.trim()
                };
                
                // Save to localStorage
                localStorage.setItem('departments', JSON.stringify(departments));
                
                // Update UI
                loadAndDisplayDepartments();
                hideModal('addDepartmentModal');
                showNotification('Department updated successfully', 'success');
            }
        } else {
            // Create new department
            const newDepartment = {
                code: departmentCodeField.value.trim().toUpperCase(),
                name: departmentNameField.value.trim()
            };
            
            // Check if department already exists
            if (departments.some(dept => dept.code === newDepartment.code)) {
                showFormError(departmentCodeField, 'Department code already exists');
                return;
            }
            
            // Add to departments array
            departments.push(newDepartment);
            
            // Save to localStorage
            localStorage.setItem('departments', JSON.stringify(departments));
            
            // Update UI
            loadAndDisplayDepartments();
            hideModal('addDepartmentModal');
            showNotification('Department added successfully', 'success');
        }
    } catch (error) {
        console.error('Error saving department:', error);
        showNotification('Error saving department', 'error');
    }
}

// Edit department
function editDepartment(deptCode) {
    try {
        // Get departments
        const departments = JSON.parse(localStorage.getItem('departments') || '[]');
        
        // Find department
        const dept = departments.find(d => d.code === deptCode);
        
        if (dept) {
            // Set form fields
            document.getElementById('departmentCode').value = dept.code;
            document.getElementById('departmentName').value = dept.name;
            
            // Create or set hidden field for department ID
            let editDeptIdField = document.getElementById('editDepartmentId');
            if (!editDeptIdField) {
                editDeptIdField = document.createElement('input');
                editDeptIdField.type = 'hidden';
                editDeptIdField.id = 'editDepartmentId';
                document.getElementById('addDepartmentForm').appendChild(editDeptIdField);
            }
            editDeptIdField.value = deptCode;
            
            // Set modal title
            document.querySelector('#addDepartmentModal .modal-header h3').textContent = 'Edit Department';
            
            // Show modal
            showModal('addDepartmentModal');
        }
    } catch (error) {
        console.error('Error editing department:', error);
    }
}

// Show form error for a specific field
function showFormError(field, message) {
    if (!field) return;
    
    field.classList.add('invalid');
    
    // Find the error message element
    let errorElement = field.parentElement.querySelector('.form-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        field.parentElement.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Clear error after user starts typing
    field.addEventListener('input', function() {
        field.classList.remove('invalid');
        errorElement.style.display = 'none';
    }, { once: true });
}

// Delete department confirmation
function deleteDepartment(deptCode) {
    if (confirm(`Are you sure you want to delete department ${deptCode}? This action cannot be undone.`)) {
        try {
            // Get departments
            const departments = JSON.parse(localStorage.getItem('departments') || '[]');
            
            // Filter out the department to delete
            const updatedDepartments = departments.filter(dept => dept.code !== deptCode);
            
            // Save updated departments
            localStorage.setItem('departments', JSON.stringify(updatedDepartments));
            
            // Update UI
            loadAndDisplayDepartments();
            showNotification('Department deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting department:', error);
            showNotification('Error deleting department', 'error');
        }
    }
}

// Update approve user modal to show/hide faculty options based on selected role
document.addEventListener('DOMContentLoaded', function() {
    const approveUserRoleSelect = document.getElementById('approveUserRole');
    if (approveUserRoleSelect) {
        approveUserRoleSelect.addEventListener('change', function() {
            const facultyOptions = document.querySelector('.faculty-options');
            if (this.value === 'faculty') {
                facultyOptions.style.display = 'block';
                // Populate subjects dropdown
                populateSubjectsDropdown();
            } else {
                facultyOptions.style.display = 'none';
            }
        });
    }
});

// Populate subjects dropdown for faculty assignment
function populateSubjectsDropdown() {
    const subjectsSelect = document.getElementById('facultySubjects');
    if (!subjectsSelect) return;
    
    // Clear existing options
    subjectsSelect.innerHTML = '';
    
    // Get subjects from localStorage
    const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
    
    // Add options for each subject
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = `${subject.code} - ${subject.name}`;
        subjectsSelect.appendChild(option);
    });
}

// Update the event listeners in loadEmFaculty
function updateFacultyEventListeners() {
    // Add event listeners to faculty table buttons
    const facultyTable = document.getElementById('emFacultyTable');
    if (facultyTable) {
        // Link buttons
        facultyTable.querySelectorAll('.link-btn').forEach(button => {
            button.addEventListener('click', function() {
                const facultyId = this.getAttribute('data-id');
                linkFacultyToUser(facultyId);
            });
        });
    }
}

// Function to link a faculty member to a user
function linkFacultyToUser(facultyId) {
    // Get faculty and users data
    const faculty = JSON.parse(localStorage.getItem('facultyMembers') || '[]');
    const facultyIndex = faculty.findIndex(f => f.id === facultyId);
    
    if (facultyIndex === -1) {
        showNotification('Faculty member not found', 'error');
        return;
    }
    
    // Get available users who aren't already faculty
    const users = JSON.parse(localStorage.getItem('demoUsers') || '[]');
    const availableUsers = users.filter(user => {
        // Only show approved users who aren't already linked to faculty
        return user.approved && 
               !faculty.some(f => f.userId === user.id);
    });
    
    if (availableUsers.length === 0) {
        showNotification('No available users to link', 'warning');
        return;
    }
    
    // Create a prompt for user selection
    let userPrompt = 'Select a user to link this faculty member to (enter number):\n';
    availableUsers.forEach((user, index) => {
        userPrompt += `${index + 1}. ${user.firstName || ''} ${user.lastName || ''} (${user.email})\n`;
    });
    
    const userIndex = parseInt(prompt(userPrompt)) - 1;
    if (isNaN(userIndex) || userIndex < 0 || userIndex >= availableUsers.length) {
        showNotification('Invalid user selection', 'error');
        return;
    }
    
    // Link the faculty to the selected user
    const selectedUser = availableUsers[userIndex];
    faculty[facultyIndex].userId = selectedUser.id;
    faculty[facultyIndex].name = `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`;
    faculty[facultyIndex].email = selectedUser.email;
    
    // Save faculty
    localStorage.setItem('facultyMembers', JSON.stringify(faculty));
    
    showNotification('Faculty linked to user successfully', 'success');
    
    // Refresh the faculty table
    loadEmFaculty();
}

// Show modal to add a new faculty member
function showAddFacultyModal() {
    // In a real implementation, you would create and display a modal
    // For this demo, we'll simulate it with prompts
    const name = prompt('Enter faculty member name:');
    
    // Get departments for selection
    const departments = JSON.parse(localStorage.getItem('departments') || '[]');
    if (departments.length === 0) {
        showNotification('You must create departments before adding faculty members.', 'warning');
        return;
    }
    
    // Create a department selection prompt
    let deptPrompt = 'Select department by entering the number:\n';
    departments.forEach((dept, index) => {
        deptPrompt += `${index + 1}. ${dept.name}\n`;
    });
    
    const deptIndex = parseInt(prompt(deptPrompt)) - 1;
    if (isNaN(deptIndex) || deptIndex < 0 || deptIndex >= departments.length) {
        showNotification('Invalid department selection.', 'error');
        return;
    }
    
    // Get subjects for the faculty member
    const subjects = prompt('Enter subjects (comma separated):');
    
    // Create a new faculty object
    const newFaculty = {
        id: 'faculty-' + Date.now(),
        name: name,
        department: departments[deptIndex].name,
        subjects: subjects ? subjects.split(',').map(s => s.trim()) : []
    };
    
    // Save to localStorage
    const faculty = JSON.parse(localStorage.getItem('faculty') || '[]');
    faculty.push(newFaculty);
    localStorage.setItem('faculty', JSON.stringify(faculty));
    
    // Show success message
    showNotification('Faculty member added successfully!', 'success');
    
    // Refresh faculty tables
    loadEmFaculty();
}

// Show modal to add a new subject
function showAddSubjectModal() {
    // In a real implementation, you would create and display a modal
    // For this demo, we'll simulate it with prompts
    const code = prompt('Enter subject code:');
    const name = prompt('Enter subject name:');
    
    // Get departments for selection
    const departments = JSON.parse(localStorage.getItem('departments') || '[]');
    if (departments.length === 0) {
        showNotification('You must create departments before adding subjects.', 'warning');
        return;
    }
    
    // Create a department selection prompt
    let deptPrompt = 'Select department by entering the number:\n';
    departments.forEach((dept, index) => {
        deptPrompt += `${index + 1}. ${dept.name}\n`;
    });
    
    const deptIndex = parseInt(prompt(deptPrompt)) - 1;
    if (isNaN(deptIndex) || deptIndex < 0 || deptIndex >= departments.length) {
        showNotification('Invalid department selection.', 'error');
        return;
    }
    
    // Create a new subject object
    const newSubject = {
        id: 'subject-' + Date.now(),
        code: code,
        name: name,
        department: departments[deptIndex].name
    };
    
    // Save to localStorage
    const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
    subjects.push(newSubject);
    localStorage.setItem('subjects', JSON.stringify(subjects));
    
    // Show success message
    showNotification('Subject added successfully!', 'success');
    
    // Refresh subject tables
    loadEmSubjects();
}

// Show modal to add a new strand/course
function showAddStrandModal() {
    // In a real implementation, you would create and display a modal
    // For this demo, we'll simulate it with prompts
    const code = prompt('Enter strand/course code:');
    const name = prompt('Enter strand/course name:');
    const description = prompt('Enter strand/course description:');
    
    // Create a new strand object
    const newStrand = {
        id: 'strand-' + Date.now(),
        code: code,
        name: name,
        description: description
    };
    
    // Save to localStorage
    const strands = JSON.parse(localStorage.getItem('strands') || '[]');
    strands.push(newStrand);
    localStorage.setItem('strands', JSON.stringify(strands));
    
    // Show success message
    showNotification('Strand/Course added successfully!', 'success');
    
    // Refresh strands tables
    loadEmStrands();
}
