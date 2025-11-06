# Deployment Guide for Automated Scheduling System

This guide will walk you through the process of deploying the Automated Scheduling System to a production environment.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Backend Deployment Options](#backend-deployment-options)
3. [Database Setup](#database-setup)
4. [Environment Variables](#environment-variables)
5. [Email Service Setup for 2FA](#email-service-setup-for-2fa)
6. [Deploying to Heroku](#deploying-to-heroku)
7. [Deploying to DigitalOcean](#deploying-to-digitalocean)
8. [Domain and SSL Configuration](#domain-and-ssl-configuration)
9. [Security Best Practices](#security-best-practices)
10. [Maintenance and Monitoring](#maintenance-and-monitoring)

## Prerequisites

Before deploying the application, make sure you have the following:
- Node.js (v14+) and npm
- Git repository with your project code
- Domain name (optional but recommended)
- SMTP email service for sending verification codes
- MongoDB Atlas account or another database service

## Backend Deployment Options

### Option 1: Heroku

Heroku offers a simple deployment process that works well for Node.js applications.

### Option 2: DigitalOcean App Platform

DigitalOcean's App Platform provides a PaaS solution similar to Heroku.

### Option 3: VPS (DigitalOcean, AWS EC2, etc.)

For more control, you can use a Virtual Private Server.

## Database Setup

### MongoDB Atlas Setup (Recommended)

1. Create a MongoDB Atlas account
2. Create a new cluster (free tier is sufficient for starting)
3. Set up a database user with read/write permissions
4. Whitelist your IP address or set it to allow access from anywhere (0.0.0.0/0)
5. Get your connection string: `mongodb+srv://<username>:<password>@clustername.mongodb.net/<dbname>?retryWrites=true&w=majority`

### Migrate from In-Memory to MongoDB

1. Install Mongoose in your project:
```bash
npm install mongoose
```

2. Update your server.js file to connect to MongoDB:
```javascript
const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));
```

3. Create models for your data structures (users, departments, etc.)

## Environment Variables

Your application will need the following environment variables:

```
PORT=3000                       # Port to run your app
MONGODB_URI=your_mongo_uri      # MongoDB connection string
JWT_SECRET=your_jwt_secret      # Strong random string for JWT tokens
EMAIL_SERVICE=gmail             # Email service provider
EMAIL_USER=your_email@gmail.com # Email account for sending emails
EMAIL_PASS=your_email_password  # Email password or app-specific password
NODE_ENV=production             # Set to 'production' in deployed environment
```

## Email Service Setup for 2FA

### Option 1: Gmail

1. Create a dedicated Gmail account for your application
2. Enable "Less secure app access" or use App Password
3. Use the following Nodemailer configuration:

```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

### Option 2: SendGrid (Recommended)

1. Create a SendGrid account
2. Create an API key
3. Install the SendGrid package:
```bash
npm install @sendgrid/mail
```

4. Update your email sending code:
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendVerificationEmail(email, code) {
  const msg = {
    to: email,
    from: 'your-verified-sender@example.com',
    subject: 'Your Verification Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <strong>${code}</strong></p>`,
  };
  
  await sgMail.send(msg);
}
```

## Deploying to Heroku

1. Create a Heroku account and install the Heroku CLI
2. Login to Heroku:
```bash
heroku login
```

3. Create a new Heroku app:
```bash
heroku create your-app-name
```

4. Set environment variables:
```bash
heroku config:set JWT_SECRET=your_secret
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set EMAIL_USER=your_email
heroku config:set EMAIL_PASS=your_password
heroku config:set NODE_ENV=production
```

5. Add a Procfile to your project:
```
web: node server.js
```

6. Push your code to Heroku:
```bash
git push heroku main
```

## Deploying to DigitalOcean

### Using App Platform

1. Create a DigitalOcean account
2. Navigate to App Platform in the dashboard
3. Click "Create App" and connect your GitHub repository
4. Configure your app:
   - Select the repository branch
   - Choose the Node.js environment
   - Set environment variables
5. Review and launch

### Using a VPS (more technical)

1. Create a droplet in DigitalOcean
2. SSH into your droplet:
```bash
ssh root@your_server_ip
```

3. Install Node.js, npm, and MongoDB
4. Clone your repository:
```bash
git clone your_repository_url
```

5. Install dependencies:
```bash
npm install --production
```

6. Set up environment variables
7. Install and set up PM2 to keep your app running:
```bash
npm install -g pm2
pm2 start server.js
pm2 startup
```

## Domain and SSL Configuration

### Custom Domain Setup

1. Purchase a domain name from Namecheap, GoDaddy, etc.
2. Point your domain to your hosting provider (update DNS settings)
3. Add your domain to your hosting platform

### SSL Certificate (HTTPS)

1. For Heroku: Enable Automatic Certificate Management (ACM)
2. For DigitalOcean App Platform: SSL is provided automatically
3. For VPS: Use Let's Encrypt with Certbot

## Security Best Practices

1. **Rate Limiting**: Implement rate limiting for login and API endpoints to prevent brute force attacks
   ```bash
   npm install express-rate-limit
   ```

2. **CORS Configuration**: Restrict cross-origin requests
   ```javascript
   const cors = require('cors');
   app.use(cors({ origin: 'https://your-domain.com' }));
   ```

3. **Helmet.js**: Set security headers
   ```bash
   npm install helmet
   ```
   ```javascript
   const helmet = require('helmet');
   app.use(helmet());
   ```

4. **Input Validation**: Use express-validator or Joi to validate all user inputs

5. **Secure Cookie Settings**:
   ```javascript
   app.use(session({
     cookie: { 
       secure: true, 
       httpOnly: true,
       sameSite: 'strict'
     }
   }));
   ```

6. **2FA Implementation**:
   - Continue using email-based 2FA for signup
   - Add 2FA for login by implementing a middleware that checks if 2FA is required
   - Store 2FA preferences in user records

## Maintenance and Monitoring

1. **Logging**: Use Winston or Morgan for logging
   ```bash
   npm install winston
   ```

2. **Monitoring**: Consider services like:
   - New Relic
   - Sentry.io
   - PM2 Plus

3. **Regular Updates**:
   - Keep dependencies updated using `npm audit` and `npm update`
   - Set up automated security scanning with GitHub Actions

4. **Database Backups**:
   - Set up automated backups for MongoDB
   - For MongoDB Atlas, configure automatic backups

## Implementation of 2FA for Login

To add 2FA for login, implement the following flow:

1. Create a middleware that checks if the user has 2FA enabled:
```javascript
function check2FARequired(req, res, next) {
  const user = req.user;
  if (user.requires2FA) {
    // Generate and send verification code
    const code = generateVerificationCode();
    
    // Store code with expiration time
    verificationCodes[user.email] = {
      code,
      expiry: Date.now() + 10 * 60 * 1000 // 10 min expiry
    };
    
    // Send verification email
    sendVerificationEmail(user.email, code);
    
    // Return partial auth response
    return res.status(202).json({
      message: '2FA verification required',
      requires2FA: true,
      userId: user.id,
      // Don't include the token yet
    });
  }
  
  // User doesn't require 2FA, proceed
  next();
}
```

2. Add a new endpoint for verifying 2FA codes during login:
```javascript
app.post('/api/auth/verify-login', async (req, res) => {
  const { email, code } = req.body;
  
  // Validate code
  const storedCode = verificationCodes[email];
  if (!storedCode || storedCode.code !== code || Date.now() > storedCode.expiry) {
    return res.status(401).json({ message: 'Invalid or expired code' });
  }
  
  // Look up user
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Generate token
  const token = generateToken(user);
  
  // Clear verification code
  delete verificationCodes[email];
  
  // Return full authorization
  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    }
  });
});
```

3. Update your client-side login flow to handle the 2FA requirement.

By following this guide, you'll be able to successfully deploy your Automated Scheduling System with secure authentication.
