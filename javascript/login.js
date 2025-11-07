document.addEventListener('DOMContentLoaded', function() {
    const togglePassword = document.querySelector('.password-container i');
    const passwordInput = document.querySelector('#password');
    const loginForm = document.querySelector('form');
    const loginBtn = document.querySelector('.sign-in-btn');
    let revealTimer = null;
    
    // Show password on mouse down/touch start
    togglePassword.addEventListener('mousedown', startReveal);
    togglePassword.addEventListener('touchstart', startReveal, { passive: true });
    
    // Hide password on mouse up/touch end/leave
    togglePassword.addEventListener('mouseup', stopReveal);
    togglePassword.addEventListener('mouseleave', stopReveal);
    togglePassword.addEventListener('touchend', stopReveal);
    togglePassword.addEventListener('touchcancel', stopReveal);
    
    // Prevent context menu on long press
    togglePassword.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    function startReveal(e) {
        e.preventDefault();
        // Show password immediately on mobile for better UX
        passwordInput.setAttribute('type', 'text');
        togglePassword.classList.remove('fa-eye');
        togglePassword.classList.add('fa-eye-slash');
        
        // Set a timer to hide after 3 seconds (as a safety measure)
        revealTimer = setTimeout(() => {
            stopReveal();
        }, 3000);
    }
    
    function stopReveal() {
        if (revealTimer) {
            clearTimeout(revealTimer);
            revealTimer = null;
        }
        passwordInput.setAttribute('type', 'password');
        togglePassword.classList.remove('fa-eye-slash');
        togglePassword.classList.add('fa-eye');
    }
    
    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Basic validation
        if (!email || !password) {
            alert('Please enter both email and password');
            return;
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }
        
        // Disable login button during authentication
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        try {
            // Send login request to the server
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });
            
            // Check if response is ok before parsing JSON
            let data;
            try {
                const text = await response.text();
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                throw new Error('Server returned invalid response. Please try again.');
            }
            
            if (!response.ok) {
                // Handle pending approval status
                if (response.status === 401 && data.requiresApproval) {
                    // Show pending approval modal
                    showPendingApprovalModal();
                    // Reset button state
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log In';
                    return;
                }
                // Handle incorrect password
                if (response.status === 401 && data.incorrectPassword) {
                    // Show incorrect password modal
                    showIncorrectPasswordModal();
                    // Reset button state
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log In';
                    return;
                }
                // Handle user not found (invalid credentials)
                if (response.status === 401 && data.message === 'Invalid credentials') {
                    // Show user not found modal
                    showUserNotFoundModal();
                    // Reset button state
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log In';
                    return;
                }
                // Handle unverified email (legacy case)
                if (response.status === 403 && data.requiresVerification) {
                    // Store email for verification page
                    sessionStorage.setItem('pendingUserEmail', email);
                    window.location.href = 'email-verification.html';
                    return;
                }
                // Handle other errors
                throw new Error(data.message || 'Login failed');
            }
            if (data.twoFA) {
                // Store email in sessionStorage for 2FA page
                sessionStorage.setItem('loginUserEmail', email);
                sessionStorage.setItem('loginUserPassword', password);
                
                // Redirect to 2FA page
                window.location.href = 'login-2fa.html';
                return;
            }
            // Store authentication token and user data
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                console.log('Auth token stored in localStorage');
            } else {
                console.error('No token received in login response');
            }
            
            // Ensure we have user data
            if (data.user) {
                // Set default role to 'user' if not specified
                const userData = {
                    ...data.user,
                    role: data.user.role || 'user'  // Default to 'user' if role is not set
                };
                
                // Store user data in localStorage
                localStorage.setItem('userData', JSON.stringify(userData));
                console.log('User data stored in localStorage:', userData);
                
                // Set specific session data for superadmin
                if (userData.role === 'superadmin') {
                    localStorage.setItem('superadminLoggedIn', 'true');
                    localStorage.setItem('superadminUser', JSON.stringify(userData));
                    console.log('Superadmin data stored in localStorage');
                }
                
            // Redirect based on user role
            console.log('About to redirect, user role:', data.user.role);
            // Redirect immediately - localStorage is synchronous
            redirectBasedOnRole(data.user.role);
            } else {
                console.error('No user data received in login response');
                throw new Error('Login successful but user data is missing');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || 'Login failed. Please check your connection and try again.');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
        }
    });
    
    // Function to redirect based on user role
    function redirectBasedOnRole(role) {
        console.log('Redirecting user with role:', role);
        // All users (user, admin, superadmin) go to the timetable page
        console.log(`Redirecting ${role || 'user'} to index.html for timetable`);
        window.location.href = 'index.html';
    }
    
    // Function to show pending approval modal
    function showPendingApprovalModal() {
        // Remove any existing modal first
        const existingModal = document.getElementById('pendingApprovalModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML with improved design
        const modalHTML = `
            <div id="pendingApprovalModal" class="pending-approval-overlay">
                <div class="pending-approval-container">
                    <div class="pending-approval-header">
                        <div class="pending-approval-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <h2>Account Pending Approval</h2>
                        <button class="pending-approval-close" data-action="close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="pending-approval-body">
                        <div class="pending-approval-content">
                            <div class="pending-approval-main-icon">
                                <i class="fas fa-user-clock"></i>
                            </div>
                            <h3>Your account is pending approval</h3>
                            <p class="pending-approval-description">
                                Your account has been created successfully, but it requires approval from an administrator before you can access the system.
                            </p>
                            
                            <div class="pending-approval-info-box">
                                <h4><i class="fas fa-info-circle"></i> What happens next?</h4>
                                <ul class="pending-approval-steps">
                                    <li>
                                        <i class="fas fa-user-check"></i>
                                        <span>An administrator will review your account</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-bell"></i>
                                        <span>You will be notified once your account is approved</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-sign-in-alt"></i>
                                        <span>You can then log in and access the system</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div class="pending-approval-note">
                                <i class="fas fa-hourglass-half"></i>
                                <span>This process usually takes 24-48 hours. Thank you for your patience.</span>
                            </div>
                        </div>
                    </div>
                    <div class="pending-approval-footer">
                        <button class="pending-approval-btn" data-action="close">
                            <i class="fas fa-check"></i>
                            Understood
                        </button>
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
                modal.classList.add('show');
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
            modal.classList.remove('show');
            
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
    
    // Function to show user not found modal
    function showUserNotFoundModal() {
        // Remove any existing modal first
        const existingModal = document.getElementById('userNotFoundModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML with improved design
        const modalHTML = `
            <div id="userNotFoundModal" class="user-not-found-overlay">
                <div class="user-not-found-container">
                    <div class="user-not-found-header">
                        <div class="user-not-found-icon">
                            <i class="fas fa-user-times"></i>
                        </div>
                        <h2>Account Not Found</h2>
                        <button class="user-not-found-close" data-action="close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="user-not-found-body">
                        <div class="user-not-found-content">
                            <div class="user-not-found-main-icon">
                                <i class="fas fa-user-slash"></i>
                            </div>
                            <h3>No account found with this email</h3>
                            <p class="user-not-found-description">
                                The email address you entered is not registered in our system.
                            </p>
                            
                            <div class="user-not-found-info-box">
                                <h4><i class="fas fa-lightbulb"></i> What you can do:</h4>
                                <ul class="user-not-found-steps">
                                    <li>
                                        <i class="fas fa-search"></i>
                                        <span>Check if you entered the correct email address</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-user-plus"></i>
                                        <span>Create a new account if you haven't registered yet</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-headset"></i>
                                        <span>Contact support if you believe this is an error</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div class="user-not-found-note">
                                <i class="fas fa-info-circle"></i>
                                <span>Don't have an account? Click "Create Account" to register.</span>
                            </div>
                        </div>
                    </div>
                    <div class="user-not-found-footer">
                        <button class="user-not-found-btn-secondary" data-action="close">
                            <i class="fas fa-arrow-left"></i>
                            Try Again
                        </button>
                        <button class="user-not-found-btn-primary" data-action="signup">
                            <i class="fas fa-user-plus"></i>
                            Create Account
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = document.getElementById('userNotFoundModal');
        if (modal) {
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Show modal with animation
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            // Add event listeners
            modal.addEventListener('click', (e) => {
                const target = e.target.closest('button[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                if (action === 'close') {
                    closeUserNotFoundModal();
                } else if (action === 'signup') {
                    closeUserNotFoundModal();
                    // Redirect to signup page
                    window.location.href = 'signup.html';
                }
            });
            
            // Click outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeUserNotFoundModal();
                }
            });
            
            // Escape key to close
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closeUserNotFoundModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }
    
    // Function to close user not found modal
    function closeUserNotFoundModal() {
        const modal = document.getElementById('userNotFoundModal');
        if (modal) {
            // Start fade out animation
            modal.classList.remove('show');
            
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
    
    // Function to show incorrect password modal
    function showIncorrectPasswordModal() {
        // Remove any existing modal first
        const existingModal = document.getElementById('incorrectPasswordModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML with improved design
        const modalHTML = `
            <div id="incorrectPasswordModal" class="user-not-found-overlay">
                <div class="user-not-found-container">
                    <div class="user-not-found-header">
                        <div class="user-not-found-icon">
                            <i class="fas fa-lock"></i>
                        </div>
                        <h2>Incorrect Password</h2>
                        <button class="user-not-found-close" data-action="close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="user-not-found-body">
                        <div class="user-not-found-content">
                            <div class="user-not-found-main-icon">
                                <i class="fas fa-key"></i>
                            </div>
                            <h3>Password is incorrect</h3>
                            <p class="user-not-found-description">
                                The password you entered does not match your account. Please try again.
                            </p>
                            
                            <div class="user-not-found-info-box">
                                <h4><i class="fas fa-lightbulb"></i> What you can do:</h4>
                                <ul class="user-not-found-steps">
                                    <li>
                                        <i class="fas fa-redo"></i>
                                        <span>Double-check that you entered the correct password</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-eye"></i>
                                        <span>Make sure Caps Lock is not enabled</span>
                                    </li>
                                    <li>
                                        <i class="fas fa-question-circle"></i>
                                        <span>Contact support if you forgot your password</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div class="user-not-found-footer">
                        <button class="user-not-found-btn-primary" data-action="close">
                            <i class="fas fa-arrow-left"></i>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal
        const modal = document.getElementById('incorrectPasswordModal');
        if (modal) {
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Show modal with animation
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            // Add event listeners
            modal.addEventListener('click', (e) => {
                const target = e.target.closest('button[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                if (action === 'close') {
                    closeIncorrectPasswordModal();
                }
            });
            
            // Click outside to close
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeIncorrectPasswordModal();
                }
            });
            
            // Escape key to close
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closeIncorrectPasswordModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }
    }
    
    // Function to close incorrect password modal
    function closeIncorrectPasswordModal() {
        const modal = document.getElementById('incorrectPasswordModal');
        if (modal) {
            // Start fade out animation
            modal.classList.remove('show');
            
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
});