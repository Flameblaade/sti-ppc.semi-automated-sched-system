document.addEventListener('DOMContentLoaded', function() {
    // Check if there's a pending user email
    const pendingUserEmail = sessionStorage.getItem('pendingUserEmail');
    
    // Debug: Log all sessionStorage data
    console.log('Email verification page loaded. SessionStorage contents:');
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        console.log(`${key}: ${value}`);
    }
    
    if (!pendingUserEmail) {
        // No pending user, redirect to signup page
        console.log('No pending user email found, redirecting to signup');
        window.location.href = 'signup.html';
        return;
    }
    
    // Check if we have the required data for verification
    const hasVerificationCode = sessionStorage.getItem('verificationCode');
    const hasUserData = sessionStorage.getItem('firstName') && sessionStorage.getItem('lastName') && sessionStorage.getItem('password');
    
    console.log('Data validation check:', {
        hasVerificationCode: !!hasVerificationCode,
        hasUserData: !!hasUserData,
        firstName: sessionStorage.getItem('firstName'),
        lastName: sessionStorage.getItem('lastName'),
        password: sessionStorage.getItem('password') ? 'Present' : 'Missing',
        verificationCode: hasVerificationCode ? 'Present' : 'Missing'
    });
    
    if (!hasVerificationCode || !hasUserData) {
        console.log('Missing verification data, redirecting to signup page');
        window.location.href = 'signup.html';
        return;
    }
    
    console.log('All required data is present, proceeding with email verification');
    
    console.log('Pending user email found:', pendingUserEmail);
    
    // Display user email
    document.getElementById('user-email').textContent = pendingUserEmail;
    
    // Get verification code inputs
    const inputs = document.querySelectorAll('.verification-code input');
    const verifyButton = document.querySelector('.sign-up-btn');
    
    // Auto-tab between inputs
    inputs.forEach((input, index) => {
        // Handle input
        input.addEventListener('input', function(e) {
            // Allow only numbers
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Move to next input if value is entered
            if (this.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        
        // Handle backspace
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && index > 0) {
                // Move to previous input on backspace if current input is empty
                inputs[index - 1].focus();
            }
        });
        
        // Handle paste
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            
            // Get pasted content
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            
            // If pasted content is 6 digits, distribute across inputs
            if (/^\d{6}$/.test(paste)) {
                for (let i = 0; i < inputs.length; i++) {
                    inputs[i].value = paste[i] || '';
                }
                
                // Focus the last input
                inputs[inputs.length - 1].focus();
            }
        });
    });
    
    // Handle form submission
    document.getElementById('verification-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Collect the verification code
        let enteredCode = '';
        inputs.forEach(input => {
            enteredCode += input.value;
        });
        
        // Check if code is complete
        if (enteredCode.length !== 6) {
            alert('Please enter the complete 6-digit verification code');
            return;
        }
        
        // Disable button during verification
        verifyButton.disabled = true;
        verifyButton.textContent = 'Verifying...';
        try {
            // Check if we have verification data in sessionStorage (local verification)
            const storedCode = sessionStorage.getItem('verificationCode');
            console.log('Verification attempt:', {
                enteredCode,
                storedCode: storedCode ? 'Present' : 'Missing',
                email: pendingUserEmail
            });
            
            if (storedCode) {
                console.log('Using local verification with stored code');
                // We have local verification data, verify the code locally
                if (enteredCode === storedCode) {
                    // Clear session storage
                    sessionStorage.removeItem('verificationCode');
                    
                    // Retrieve the user data that was created during signup
                    let firstName = sessionStorage.getItem('firstName');
                    let middleName = sessionStorage.getItem('middleName');
                    let lastName = sessionStorage.getItem('lastName');
                    const email = pendingUserEmail;
                    let password = sessionStorage.getItem('password');
                    
                    console.log('Retrieved data from sessionStorage:', {
                        firstName,
                        middleName,
                        lastName,
                        email,
                        password: password ? 'Present' : 'Missing'
                    });
                    
                    // Fallback: If data is missing, try to get it from the form or create defaults
                    if (!firstName || !lastName || !password) {
                        console.log('Some data is missing from sessionStorage, using fallbacks');
                        
                        // Try to get data from form fields if they exist
                        const firstNameField = document.querySelector('input[name="firstName"]');
                        const lastNameField = document.querySelector('input[name="lastName"]');
                        const passwordField = document.querySelector('input[name="password"]');
                        
                        firstName = firstName || (firstNameField ? firstNameField.value : email.split('@')[0]);
                        lastName = lastName || (lastNameField ? lastNameField.value : 'User');
                        password = password || (passwordField ? passwordField.value : 'password123');
                        
                        console.log('Using fallback data:', { firstName, lastName, password: password ? 'Present' : 'Missing' });
                    }
                    
                    // Create a new user and save to server
                    const newUser = {
                        firstName: firstName && firstName.trim() ? firstName.trim() : email.split('@')[0],
                        middleName: middleName && middleName.trim() ? middleName.trim() : '',
                        lastName: lastName && lastName.trim() ? lastName.trim() : 'User',
                        email: email && email.trim() ? email.trim() : '',
                        password: password && password.trim() ? password.trim() : 'password123'
                        // Department will be set by superadmin when user is approved
                    };
                    
                    console.log('Created newUser object:', newUser);
                    
                    // Validate required fields
                    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
                        console.error('Validation failed:', newUser);
                        throw new Error(`Missing required fields: firstName=${newUser.firstName}, lastName=${newUser.lastName}, email=${newUser.email}, password=${newUser.password ? 'Present' : 'Missing'}`);
                    }
                    
                    // Final validation - ensure no empty strings
                    if (newUser.firstName.trim() === '' || newUser.lastName.trim() === '' || newUser.email.trim() === '' || newUser.password.trim() === '') {
                        console.error('Empty fields detected:', newUser);
                        throw new Error('All fields must have valid values');
                    }

                    // Save the user to the server
                    try {
                        console.log('Sending user data to server:', newUser);
                        const response = await fetch('/api/auth/register', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(newUser)
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            console.log('Server response:', errorData);
                            
                            // If email is already in use, treat it as success since user already exists
                            if (errorData.message && errorData.message.includes('Email is already in use')) {
                                console.log('Email already exists in server, treating as success');
                                
                                // Add user to local storage for demo mode visibility
                                try {
                                    let pendingAccounts = JSON.parse(localStorage.getItem('pendingAccounts') || '[]');
                                    const userExists = pendingAccounts.some(account => account.email === email);
                                    
                                    if (!userExists) {
                                        // Use a consistent ID based on email hash to ensure same ID across processes
                                        const userId = 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
                                        pendingAccounts.push({
                                            id: userId,
                                            name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
                                            email: email,
                                            registrationDate: new Date().toISOString().split('T')[0],
                                            status: 'pending'
                                        });
                                        localStorage.setItem('pendingAccounts', JSON.stringify(pendingAccounts));
                                        console.log('User added to pending accounts for demo mode with ID:', userId);
                                    }
                                } catch (localError) {
                                    console.error('Error updating local storage:', localError);
                                }
                                
                                // Clear sensitive data from session storage
                                sessionStorage.removeItem('password');
                                sessionStorage.removeItem('verificationCode');
                                
                                // Show success modal instead of alert and redirect
                                document.getElementById('successModal').style.display = 'flex';
                                return;
                            }
                            
                            console.error('Registration failed:', errorData);
                            throw new Error(errorData.message || 'Failed to register user');
                        }

                        // Add user to local storage for demo mode visibility
                        try {
                            let pendingAccounts = JSON.parse(localStorage.getItem('pendingAccounts') || '[]');
                            const userExists = pendingAccounts.some(account => account.email === email);
                            
                            if (!userExists) {
                                // Use a consistent ID based on email hash to ensure same ID across processes
                                const userId = 'user_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
                                pendingAccounts.push({
                                    id: userId,
                                    name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
                                    email: email,
                                    registrationDate: new Date().toISOString().split('T')[0],
                                    status: 'pending'
                                });
                                localStorage.setItem('pendingAccounts', JSON.stringify(pendingAccounts));
                                console.log('User added to pending accounts for demo mode with ID:', userId);
                            }
                        } catch (localError) {
                            console.error('Error updating local storage:', localError);
                        }

                        // Clear sensitive data from session storage
                        sessionStorage.removeItem('password');
                        sessionStorage.removeItem('verificationCode');
                    } catch (error) {
                        console.error('Error saving user to server:', error);
                        throw new Error('Failed to save user data to server');
                    }
                    
                    // Show success modal instead of alert and redirect
                    document.getElementById('successModal').style.display = 'flex';
                    return;
                } else {
                    throw new Error('Invalid verification code. Please try again.');
                }
            }
            
            // If we don't have local verification data, try server verification
            console.log('No local verification code found, trying server verification');
            try {
                // Send verification request to the server
                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: pendingUserEmail,
                        code: enteredCode
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Verification failed');
                }
                
                // Store user token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                // Clear session storage
                sessionStorage.removeItem('pendingUserEmail');
                sessionStorage.removeItem('verificationCode');
                
                // For pending approval, show success modal
                if (data.user.status === 'pending') {
                    document.getElementById('successModal').style.display = 'flex';
                } 
                // For approved users, redirect to timetable
                // All users go to the timetable page
                window.location.href = 'index.html';
            } catch (serverError) {
                console.error('Server error during verification:', serverError);
                throw new Error('Server error: Unable to verify your code at this time.');
            }
        } catch (error) {
            alert(error.message);
            
            // Clear the inputs
            inputs.forEach(input => {
                input.value = '';
            });
            
            // Focus the first input
            inputs[0].focus();
            
            // Re-enable the button
            verifyButton.disabled = false;
            verifyButton.textContent = 'Verify Email';
        }
    });    // Handle resend code
    document.getElementById('resend-link').addEventListener('click', async function(e) {
        e.preventDefault();
        
        const resendLink = document.getElementById('resend-link');
        
        // Disable the resend link temporarily
        resendLink.textContent = 'Sending...';
        resendLink.style.pointerEvents = 'none';
        
        try {
            // Check if we're in demo mode (no server available)
            if (sessionStorage.getItem('verificationCode')) {
                // Generate a new verification code for demo mode
                const newVerificationCode = generateVerificationCode();
                sessionStorage.setItem('verificationCode', newVerificationCode);
                
                alert(`Demo mode: New verification code is: ${newVerificationCode}`);
                
                // Clear inputs
                inputs.forEach(input => {
                    input.value = '';
                });
                
                // Focus the first input
                inputs[0].focus();
                return;
            }
            
            // If not in demo mode, try sending request to server
            try {
                // Send resend verification request
                const response = await fetch('/api/auth/resend-verification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: pendingUserEmail
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to resend verification code');
                }
                
                alert('A new verification code has been sent to your email');
                
                // Clear inputs
                inputs.forEach(input => {
                    input.value = '';
                });
                
                // Focus the first input
                inputs[0].focus();
            } catch (serverError) {
                console.error('Server error during resend:', serverError);
                
                // Fallback to demo mode if server is unavailable
                const newVerificationCode = generateVerificationCode();
                sessionStorage.setItem('verificationCode', newVerificationCode);
                
                alert(`Server unavailable - using demo mode. New verification code: ${newVerificationCode}`);
                
                // Clear inputs
                inputs.forEach(input => {
                    input.value = '';
                });
                
                // Focus the first input
                inputs[0].focus();
            }
        } catch (error) {
            alert(error.message);
        } finally {
            // Set a cooldown timer for resending (1 minute)
            resendLink.textContent = 'Resend code (60s)';
            resendLink.style.pointerEvents = 'none';
            
            let cooldown = 60;
            const cooldownTimer = setInterval(() => {
                cooldown--;
                resendLink.textContent = `Resend code (${cooldown}s)`;
                
                if (cooldown <= 0) {
                    clearInterval(cooldownTimer);
                    resendLink.textContent = 'Resend code';
                    resendLink.style.pointerEvents = 'auto';
                }
            }, 1000);
        }    });
    
    // Generate a 6-digit verification code
    function generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
});
