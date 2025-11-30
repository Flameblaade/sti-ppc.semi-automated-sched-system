# Web-Based Scheduling System with Custom Timetable

This project implements a web-based scheduling system with secure user authentication featuring email-based two-factor authentication and role-based access control.

## How to Download

You can download this system in two ways:

### Option 1: Clone with Git (Recommended)

If you have Git installed on your computer:

```bash
git clone https://github.com/Flameblaade/sti-ppc.semi-automated-sched-system.git
cd sti-ppc.semi-automated-sched-system
```

### Option 2: Download as ZIP

If you don't have Git installed:

1. Go to the repository page: https://github.com/Flameblaade/sti-ppc.semi-automated-sched-system
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Extract the ZIP file to your desired location
5. Navigate to the extracted folder

After downloading, follow the instructions in the [How to Run the Project](#how-to-run-the-project) section below.

## Security Features

1. **Email-based Two-Factor Authentication**
   - Secure signup with email verification
   - 6-digit verification codes sent to user email
   - Time-limited verification codes (10 minutes expiry)
   - Cooldown periods for code resending to prevent abuse

2. **Secure Password Management**
   - Passwords hashed using bcrypt with salting
   - No plaintext password storage
   - Password strength validation

3. **Protection Against Common Attacks**
   - Rate limiting to prevent brute force attacks
   - CSRF protection with secure headers
   - Input validation and sanitization
   - Secure HTTP-only cookies for session management

4. **Secure Communication**
   - HTTPS/TLS for secure data transmission
   - JWT (JSON Web Token) for secure authentication

## Project Structure

```
├── assets/
│   └── sti.png  
├── css/
│   ├── login.css
│   ├── main.css
│   └── signup.css
├── javascript/
│   ├── email-verification.js
│   ├── login.js
│   ├── main.js
│   └── signup.js
├── .env
├── email-verification.html
├── index.html
├── login.html
├── package.json
├── server.js
└── signup.html
```

## How to Run the Project

### Client-Side Only (Demo Mode)

1. Simply open the `signup.html` file in a web browser or use a local web server like Live Server in VS Code.
2. The application will run in "demo mode" when no server is available.
3. All operations will be simulated with client-side code and session storage.
4. Verification codes will be shown in alerts for demo purposes.

### With Server (Full Functionality)

1. Download the repository (see [How to Download](#how-to-download) section above)
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables in `.env` file:
```
PORT=3000
JWT_SECRET=your_jwt_secret_key_here
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
CLIENT_URL=http://localhost:5500
```
4. Start the server:
```bash
npm start
```
5. Open a web browser and navigate to http://localhost:3000 or use Live Server.

## User Authentication Flow

1. User signs up with personal details on signup.html
2. Server validates input and sends verification email with 6-digit code
   - In demo mode, verification code is shown in an alert
3. User enters verification code on email-verification.html
4. Upon successful verification, user is redirected to login.html
5. After login, JWT token is issued for authenticated sessions
   - In demo mode, authentication is simulated client-side

## Demo Mode vs Server Mode

### Demo Mode
- Automatically activates when the server is not available
- Uses browser's localStorage to simulate backend functionality
- Verification codes are shown in alerts
- Demo accounts are created for testing:
  - Superadmin: superadmin@example.com / password123
  - Admin: admin@example.com / password123
  - User: user@example.com / password123
- New users can sign up and will be stored in the demo system
- Unlike previous versions, users must register before they can log in
- All data is stored in browser's localStorage and persists across sessions

### Server Mode
- Provides full functionality with proper backend processing
- Secure registration and authentication
- Real email verification (requires proper email configuration)
- Data persistence (currently using in-memory storage; can be extended to use a database)

## Security Best Practices Implemented

1. **Input Validation**: All inputs are validated on both client and server sides
2. **Rate Limiting**: Prevents excessive login attempts and API abuse
3. **Secure Headers**: Using Helmet.js to set security headers
4. **CORS Protection**: Configured to only allow specific origins
5. **Session Management**: Using JWT with appropriate expiry
6. **Verification Code Security**: Time-limited codes with rate-limited resending
7. **Password Security**: Secure hashing and strength requirements

## Role-Based Access Control

The system implements strict role-based access control:

1. **Regular Users**:
   - View-only access to schedules in their assigned department
   - Cannot create or modify schedules
   - Clean, simplified interface that hides creation tools
   - Clearly labeled "View Only Mode" for clarity

2. **Administrators**:
   - Full access to create and manage schedules for their assigned department
   - Manage users within their department
   - Access to admin dashboard

3. **Superadministrators**:
   - Complete system control
   - Manage all departments and users
   - Approve or reject new user registrations
   - Assign roles and departments to users

### User Registration Flow

1. New users register through the signup form
2. Email verification is required (2-factor authentication)
3. Verified accounts are placed in a pending state
4. Superadmins review pending accounts
5. Superadmins approve accounts and assign roles/departments
6. Users can then log in with their assigned permissions

## Future Enhancements

1. Implement account lockout after multiple failed attempts
2. Add IP-based suspicious activity detection
3. Implement OAuth for social login options
4. Add user activity logging for security auditing
5. Implement server-side rendering for improved security

## License

This project is created for educational purposes.
