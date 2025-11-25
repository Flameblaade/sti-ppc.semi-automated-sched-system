document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const userFullNameSpan = document.getElementById('userFullName');
    const userEmailSpan = document.getElementById('userEmail');
    const userFirstNameSpan = document.getElementById('userFirstName');
    const userMiddleNameSpan = document.getElementById('userMiddleName');
    const userLastNameSpan = document.getElementById('userLastName');
    const userTypeSpan = document.getElementById('userType');
    const userRoleSpan = document.getElementById('userRole');
    const userDepartmentSpan = document.getElementById('userDepartment');
    const logoutBtn = document.getElementById('logoutBtn');

    // Load user data from localStorage
    let userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData || !userData.email) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return;
    }

    // Fetch fresh user data from server to get updated department
    try {
        const authToken = localStorage.getItem('authToken');
        if (authToken && userData.id) {
            const response = await fetch(`/api/users/${userData.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const freshUserData = await response.json();
                // Update userData with fresh data, especially department
                userData = { ...userData, ...freshUserData };
                // Update localStorage with fresh data
                localStorage.setItem('userData', JSON.stringify(userData));
            }
        }
    } catch (error) {
        console.error('Error fetching fresh user data:', error);
        // Continue with localStorage data if fetch fails
    }

    // Fallback: try to get names from sessionStorage if missing
    let firstName = userData.firstName || sessionStorage.getItem('firstName') || '';
    let middleName = userData.middleName || sessionStorage.getItem('middleName') || '';
    let lastName = userData.lastName || sessionStorage.getItem('lastName') || '';

    // Fill in fields - format with middle initial
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
    const fullName = formatFullName(firstName, middleName, lastName);
    if (userFullNameSpan) userFullNameSpan.textContent = fullName || userData.email || 'User';
    if (userEmailSpan) userEmailSpan.textContent = userData.email || '';
    if (userFirstNameSpan) userFirstNameSpan.textContent = firstName;
    if (userMiddleNameSpan) userMiddleNameSpan.textContent = middleName;
    if (userLastNameSpan) userLastNameSpan.textContent = lastName;
    if (userTypeSpan) userTypeSpan.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'User';
    if (userRoleSpan) {
        userRoleSpan.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'User';
        // Add role-specific CSS class for styling
        if (userData.role) {
            userRoleSpan.className = `role-badge ${userData.role.toLowerCase()}`;
        } else {
            userRoleSpan.className = 'role-badge user';
        }
    }
    // Display department - filter out "Pending Assignment" and show actual department or "Not Assigned"
    let departmentDisplay = 'Not Assigned';
    if (userData.department && userData.department !== 'Pending Assignment' && userData.department.trim() !== '') {
        departmentDisplay = userData.department;
    }
    if (userDepartmentSpan) userDepartmentSpan.textContent = departmentDisplay;

    // Logout
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    });

    // View Schedule button
    const viewScheduleBtn = document.getElementById('viewScheduleBtn');
    if (viewScheduleBtn) {
        viewScheduleBtn.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    
    // Show view-only notice for regular users
    if (userData.role === 'user') {
        const viewOnlyNotice = document.querySelector('.view-only-notice');
        if (viewOnlyNotice) {
            viewOnlyNotice.style.display = 'block';
        }
    }
}); 