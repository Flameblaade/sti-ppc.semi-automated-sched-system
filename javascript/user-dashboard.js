document.addEventListener('DOMContentLoaded', function() {
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

    // Fallback: try to get names from sessionStorage if missing
    let firstName = userData.firstName || sessionStorage.getItem('firstName') || '';
    let middleName = userData.middleName || sessionStorage.getItem('middleName') || '';
    let lastName = userData.lastName || sessionStorage.getItem('lastName') || '';

    // Fill in fields
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
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
    if (userDepartmentSpan) userDepartmentSpan.textContent = userData.department || 'None';

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