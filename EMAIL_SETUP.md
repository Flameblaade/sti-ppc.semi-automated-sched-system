# Gmail Setup for Nodemailer

## Step 1: Create a .env file

Create a `.env` file in your project root with the following content:

```env
# Server Configuration
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Gmail Configuration for Nodemailer
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000
```

## Step 2: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to "Security"
3. Enable "2-Step Verification" if not already enabled

## Step 3: Generate an App Password

1. In your Google Account settings, go to "Security"
2. Find "2-Step Verification" and click on it
3. Scroll down to "App passwords"
4. Click "Generate" for a new app password
5. Select "Mail" as the app type
6. Copy the generated 16-character password

## Step 4: Update your .env file

Replace the values in your `.env` file:

```env
EMAIL_USER=your-actual-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
```

## Step 5: Test the Configuration

Your server.js already has the Nodemailer configuration:

```javascript
const transporter = nodemailer.createTransporter({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## Alternative: Using OAuth2 (More Secure)

For production, consider using OAuth2 instead of app passwords:

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials

### Step 2: Install OAuth2 Package

```bash
npm install google-auth-library
```

### Step 3: Update Configuration

```javascript
const { OAuth2Client } = require('google-auth-library');

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    accessToken: process.env.GOOGLE_ACCESS_TOKEN
  }
});
```

## Troubleshooting

### Common Issues:

1. **"Invalid login" error**: Make sure you're using an App Password, not your regular Gmail password
2. **"Less secure app access" error**: This is deprecated, use App Passwords instead
3. **"Authentication failed"**: Check that 2FA is enabled and App Password is correct

### Testing Email Function:

You can test the email functionality by adding this route to your server.js:

```javascript
// Test email route (remove in production)
app.post('/api/test-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject || 'Test Email',
      html: message || '<h1>Test Email</h1><p>This is a test email from your scheduling system.</p>'
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email', error: error.message });
  }
});
```

## Security Notes

1. **Never commit your .env file** - it's already in .gitignore
2. **Use App Passwords** instead of your main Gmail password
3. **Consider OAuth2** for production applications
4. **Rotate credentials** regularly
5. **Monitor usage** in Google Cloud Console

## Production Deployment

For production, consider:
- Using a dedicated email service (SendGrid, Mailgun, etc.)
- Setting up proper SPF/DKIM records
- Using environment-specific configurations
- Implementing rate limiting for email sending 