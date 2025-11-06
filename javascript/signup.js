document.addEventListener('DOMContentLoaded', function() {
    // Get all toggle password icons
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    const emailInput = document.getElementById('email');
    
    // Add email format validation on blur
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            const emailError = document.getElementById('email-error');
            
            if (email && !validateEmailFormat(email)) {
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                this.setCustomValidity('Please enter a valid email address');
            } else {
                emailError.style.display = 'none';
                this.setCustomValidity('');
            }
        });
        
        // Clear error when user starts typing
        emailInput.addEventListener('input', function() {
            const emailError = document.getElementById('email-error');
            emailError.style.display = 'none';
            this.setCustomValidity('');
        });
    }
    
    // Add click event to each icon
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            // Get the password input field (parent's previous sibling)
            const passwordInput = this.parentElement.querySelector('input');
            
            // Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle the icon
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    });
    
    // Password strength meter
    const passwordInput = document.getElementById('password');
    const strengthMeter = document.getElementById('password-strength-meter');
    
    passwordInput.addEventListener('input', updatePasswordStrength);
    
    function updatePasswordStrength() {
        const password = passwordInput.value;
        const strength = calculatePasswordStrength(password);
        
        // Update the strength meter
        strengthMeter.style.width = `${strength}%`;
        
        // Update color based on strength
        if (strength < 33) {
            strengthMeter.style.backgroundColor = '#d9534f'; // Red - Weak
        } else if (strength < 66) {
            strengthMeter.style.backgroundColor = '#f0ad4e'; // Yellow - Medium
        } else {
            strengthMeter.style.backgroundColor = '#5cb85c'; // Green - Strong
        }
    }
    
    function calculatePasswordStrength(password) {
        if (!password) return 0;
        
        let strength = 0;
        
        // Length contribution (up to 30%)
        strength += Math.min(30, (password.length * 5));
        
        // Complexity contribution
        if (/[A-Z]/.test(password)) strength += 20; // Uppercase
        if (/[a-z]/.test(password)) strength += 15; // Lowercase
        if (/[0-9]/.test(password)) strength += 15; // Numbers
        if (/[^A-Za-z0-9]/.test(password)) strength += 20; // Special chars
        
        return Math.min(100, strength);
    }
    
    // Real-time validation
    const inputs = document.querySelectorAll('#signup-form input');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            // Hide error when user starts typing again
            const errorElement = document.getElementById(`${this.id}-error`);
            if (errorElement) errorElement.style.display = 'none';
        });
    });
    
    // Confirm password validation
    const repasswordInput = document.getElementById('repassword');
    repasswordInput.addEventListener('input', function() {
        if (passwordInput.value !== this.value) {
            document.getElementById('repassword-error').style.display = 'block';
        } else {
            document.getElementById('repassword-error').style.display = 'none';
        }
    });
      // Form elements
    const signUpBtn = document.querySelector('.sign-up-btn');
    const form = document.getElementById('signup-form');
    
    if (!form) return;
    
    // Function to check if email exists (client-side validation)
    function validateEmailFormat(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Function to check if email exists
    async function checkEmailExists(email) {
        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            return data.exists;
        } catch (error) {
            console.error('Error checking email:', error);
            return false; // Continue with registration if there's an error
        }
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Reset error messages
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
        });
        
        const firstName = document.getElementById('firstname')?.value.trim();
        const middleName = document.getElementById('middlename')?.value.trim();
        const lastName = document.getElementById('lastname')?.value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const repassword = document.getElementById('repassword').value;
        const emailError = document.getElementById('email-error');
        
        // Validate form
        if (!firstName || !lastName || !email || !password || !repassword) {
            showError('Please fill in all required fields');
            return;
        }
        
        // Validate email format
        if (!validateEmailFormat(email)) {
            emailError.textContent = 'Please enter a valid email address';
            emailError.style.display = 'block';
            document.getElementById('email').focus();
            return;
        }
        
        // Check if email exists
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
            emailError.textContent = 'Email is already in use';
            emailError.style.display = 'block';
            document.getElementById('email').focus();
            return;
        }
        
        const fields = ['firstname', 'lastname', 'email', 'password', 'repassword'];
        let isValid = true;
        
        fields.forEach(field => {
            if (!validateField(document.getElementById(field))) {
                isValid = false;
            }
        });
        
        // Additional validations
        if (password !== repassword) {
            document.getElementById('repassword-error').style.display = 'block';
            isValid = false;
        }
        
        if (isValid) {
            // Disable the submit button to prevent multiple submissions
            signUpBtn.disabled = true;
            signUpBtn.textContent = 'Signing up...';
            
            try {
                // Store user data for verification
                const userData = {
                    firstName,
                    middleName,
                    lastName,
                    email,
                    password
                };
                
                try {
                    // Try to send data to the server
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(userData)
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        // Handle email validation error
                        if (data.field === 'email') {
                            const emailError = document.getElementById('email-error');
                            emailError.textContent = data.message;
                            emailError.style.display = 'block';
                            document.getElementById('email').focus();
                            // Reset button state
                            signUpBtn.disabled = false;
                            signUpBtn.textContent = 'Sign Up';
                            return;
                        }
                        throw new Error(data.message || 'Registration failed');
                    }
                    
                    // Server registration successful - also add to localStorage for demo purposes
                    let pendingAccounts = JSON.parse(localStorage.getItem('pendingAccounts') || '[]');
                    // Use a consistent ID based on email hash to ensure same ID across processes
                    const userId = data.user?.id || 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
                    pendingAccounts.push({
                        id: userId,
                        name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
                        email: email,
                        registrationDate: new Date().toISOString().split('T')[0],
                        status: 'pending'
                    });
                    localStorage.setItem('pendingAccounts', JSON.stringify(pendingAccounts));
                    
                    // Store user data for verification page
                    sessionStorage.setItem('pendingUserEmail', email);
                    sessionStorage.setItem('firstName', firstName);
                    sessionStorage.setItem('middleName', middleName);
                    sessionStorage.setItem('lastName', lastName);
                    sessionStorage.setItem('password', password);
                    
                    // Generate verification code for email verification
                    const verificationCode = generateVerificationCode();
                    sessionStorage.setItem('verificationCode', verificationCode);
                    
                    console.log('Verification code generated and stored:', verificationCode);
                    console.log('SessionStorage after storing verification code:');
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        const value = sessionStorage.getItem(key);
                        console.log(`${key}: ${value}`);
                    }
                    
                    alert(`Registration successful! Please check your email for a verification code. Your verification code is: ${verificationCode}`);
                    
                    // Redirect to email verification page after successful registration
                    window.location.href = 'email-verification.html';
                } catch (serverError) {
                    console.error('Server error:', serverError);
                    
                    // Fallback for demo/development: Simulate server behavior
                    console.log('Using fallback registration flow since server is not available');
                      // Store user data and email for verification
                    sessionStorage.setItem('pendingUserEmail', email);
                    sessionStorage.setItem('firstName', firstName);
                    sessionStorage.setItem('middleName', middleName);
                    sessionStorage.setItem('lastName', lastName);
                    sessionStorage.setItem('password', password);
                    
                    // Add to pendingAccounts in localStorage
                    let pendingAccounts = JSON.parse(localStorage.getItem('pendingAccounts') || '[]');
                    pendingAccounts.push({
                        id: Date.now(),
                        name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
                        email: email,
                        registrationDate: new Date().toISOString().split('T')[0],
                        status: 'pending'
                    });
                    localStorage.setItem('pendingAccounts', JSON.stringify(pendingAccounts));
                    
                    // Generate verification code (simulating server-side action)
                    const verificationCode = generateVerificationCode();
                    sessionStorage.setItem('verificationCode', verificationCode);
                    
                    console.log('Verification code generated and stored:', verificationCode);
                    console.log('SessionStorage after storing verification code:');
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        const value = sessionStorage.getItem(key);
                        console.log(`${key}: ${value}`);
                    }
                    
                    // Alert to simulate email being sent
                    alert(`Server not available - using demo mode. Verification code: ${verificationCode}`);
                    
                    // Redirect to email verification page after fallback registration
                    window.location.href = 'email-verification.html';
                }
            } catch (error) {
                alert(error.message);
                // Re-enable the submit button if there's an error
                signUpBtn.disabled = false;
                signUpBtn.textContent = 'Sign Up';
            }
        }
    });    // Field validation function
    function validateField(field) {
        const id = field.id;
        const value = field.value.trim();
        const errorElement = document.getElementById(`${id}-error`);
        
        // If no error element exists, just validate the field without showing errors
        if (!errorElement) {
            switch(id) {
                case 'firstname':
                case 'lastname':
                    return !!value;
                case 'email':
                    return validateEmail(value);
                case 'password':
                    return value.length >= 6;
                case 'repassword':
                    const passwordInput = document.getElementById('password');
                    return passwordInput && value === passwordInput.value;
                default:
                    return true;
            }
        }
        
        // If we have an error element, show/hide it as needed
        switch(id) {
            case 'firstname':
            case 'lastname':
                if (!value) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
            case 'email':
                if (!validateEmail(value)) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
            case 'password':
                if (value.length < 6) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
            case 'repassword':
                const passwordInput = document.getElementById('password');
                if (value !== (passwordInput ? passwordInput.value : '')) {
                    errorElement.style.display = 'block';
                    return false;
                }
                break;
        }
        
        errorElement.style.display = 'none';
        return true;
    }
    
    // Email validation helper function
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    
    // Generate a 6-digit verification code
    function generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
});
