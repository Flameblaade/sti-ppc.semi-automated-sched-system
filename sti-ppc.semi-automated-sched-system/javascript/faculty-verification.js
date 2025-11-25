document.addEventListener('DOMContentLoaded', function() {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        showError('Invalid verification link. Please check your email for the correct link.');
        return;
    }
    
    // Get all toggle password icons
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    
    // Add click event to each icon
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const passwordInput = this.parentElement.querySelector('input');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });
    
    // Password strength meter
    const passwordInput = document.getElementById('password');
    const strengthMeter = document.getElementById('password-strength-meter');
    
    if (passwordInput && strengthMeter) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }
    
    function updatePasswordStrength() {
        const password = passwordInput.value;
        const strength = calculatePasswordStrength(password);
        
        strengthMeter.style.width = `${strength}%`;
        
        if (strength < 33) {
            strengthMeter.style.backgroundColor = '#d9534f';
        } else if (strength < 66) {
            strengthMeter.style.backgroundColor = '#f0ad4e';
        } else {
            strengthMeter.style.backgroundColor = '#5cb85c';
        }
    }
    
    function calculatePasswordStrength(password) {
        if (!password) return 0;
        
        let strength = 0;
        strength += Math.min(30, (password.length * 5));
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        
        return Math.min(100, strength);
    }
    
    // Load user info
    async function loadUserInfo() {
        try {
            const response = await fetch(`/api/faculty/verify/${token}/info`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load user information');
            }
            
            const userInfo = await response.json();
            
            // Display user info
            document.getElementById('display-name').textContent = userInfo.fullName || 'N/A';
            document.getElementById('display-email').textContent = userInfo.email || 'N/A';
            
        } catch (error) {
            console.error('Error loading user info:', error);
            showError(error.message || 'Failed to load user information. Please check your verification link.');
        }
    }
    
    // Form validation
    const inputs = document.querySelectorAll('#verification-form input');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            const errorElement = document.getElementById(`${this.id}-error`);
            if (errorElement) errorElement.style.display = 'none';
        });
    });
    
    // Confirm password validation
    const repasswordInput = document.getElementById('repassword');
    if (repasswordInput) {
        repasswordInput.addEventListener('input', function() {
            if (passwordInput.value !== this.value) {
                document.getElementById('repassword-error').style.display = 'block';
            } else {
                document.getElementById('repassword-error').style.display = 'none';
            }
        });
    }
    
    // Form submission
    const form = document.getElementById('verification-form');
    const submitBtn = document.querySelector('.sign-up-btn');
    
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Reset error messages
            document.querySelectorAll('.error-message').forEach(el => {
                el.style.display = 'none';
            });
            
            const password = passwordInput.value;
            const repassword = repasswordInput.value;
            
            // Validate form
            if (!password || !repassword) {
                showError('Please fill in all required fields');
                return;
            }
            
            if (password.length < 6) {
                document.getElementById('password-error').style.display = 'block';
                passwordInput.focus();
                return;
            }
            
            if (password !== repassword) {
                document.getElementById('repassword-error').style.display = 'block';
                repasswordInput.focus();
                return;
            }
            
            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying...';
            
            try {
                const response = await fetch(`/api/faculty/verify/${token}/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Verification failed');
                }
                
                // Store auth token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                // Show success message
                submitBtn.textContent = '✓ Verified! Redirecting...';
                submitBtn.style.backgroundColor = '#5cb85c';
                
                // Redirect to appropriate dashboard
                setTimeout(() => {
                    const role = data.user.role || 'user';
                    if (role === 'superadmin') {
                        window.location.href = '/superadmin.html';
                    } else if (role === 'admin') {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/index.html';
                    }
                }, 1500);
                
            } catch (error) {
                console.error('Verification error:', error);
                showError(error.message || 'Failed to verify account. Please try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Verify & Set Password';
            }
        });
    }
    
    // Field validation function
    function validateField(field) {
        const id = field.id;
        const value = field.value.trim();
        const errorElement = document.getElementById(`${id}-error`);
        
        if (!errorElement) return true;
        
        switch(id) {
            case 'password':
                if (value.length < 6) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
            case 'repassword':
                if (value !== passwordInput.value) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
        }
        
        errorElement.style.display = 'none';
        return true;
    }
    
    function showError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('verification-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'verification-error';
            errorDiv.style.cssText = 'color: #d9534f; background: #f8d7da; border: 1px solid #f5c6cb; padding: 12px; border-radius: 6px; margin-bottom: 20px; text-align: center;';
            form.insertBefore(errorDiv, form.firstChild);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    
    // Load user info on page load
    loadUserInfo();
});

