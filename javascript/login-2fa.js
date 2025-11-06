document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.verification-code input');
    const form = document.getElementById('verification-form');
    const resendLink = document.getElementById('resend-link');
    const userEmailSpan = document.getElementById('user-email');
    
    // Get email from sessionStorage (set by login.js)
    const userEmail = sessionStorage.getItem('loginUserEmail');
    if (userEmail && userEmailSpan) {
        userEmailSpan.textContent = userEmail;
    }
    
    // Auto-focus and move to next input
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
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const code = Array.from(inputs).map(input => input.value).join('');
        
        if (code.length !== 6) {
            alert('Please enter a complete 6-digit code.');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    code: code
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Verification failed');
            }
            
            // On successful verification, log the user in and redirect
            // Expecting backend to return a JWT token and user payload
            if (data && data.token) {
                localStorage.setItem('authToken', data.token);
            }
            if (data && data.user) {
                localStorage.setItem('userData', JSON.stringify(data.user));
            }
            
            // Clear temp login info from session
            sessionStorage.removeItem('loginUserEmail');
            sessionStorage.removeItem('loginUserPassword');
            
            // Determine redirect destination
            let redirectPath = (data && (data.redirect || data.redirectPath)) || '';
            if (!redirectPath) {
                const user = data && data.user ? data.user : null;
                const role = user && user.role ? user.role.toLowerCase() : 'user';
                console.log('2FA verification - User role:', role);
                // All users go to the timetable page
                redirectPath = 'index.html';
            }
            
            // Use setTimeout to ensure all async operations complete before redirect
            setTimeout(() => {
                window.location.href = redirectPath;
            }, 100);
            
        } catch (error) {
            alert(error.message);
            // Clear inputs on error
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
        }
    });
    
    // Handle resend code
    resendLink.addEventListener('click', async function(e) {
        e.preventDefault();
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    password: sessionStorage.getItem('loginUserPassword') // This would need to be stored during login
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to resend code');
            }
            
            alert('A new verification code has been sent to your email');
            
            // Clear inputs
            inputs.forEach(input => input.value = '');
            inputs[0].focus();
            
        } catch (error) {
            alert(error.message);
        }
    });
}); 