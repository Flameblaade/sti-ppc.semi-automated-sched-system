// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
// Conditionally require SendGrid (only if package is installed)
let sgMail = null;
try {
  sgMail = require('@sendgrid/mail');
} catch (error) {
  console.warn('⚠️  @sendgrid/mail package not installed. Install it with: npm install @sendgrid/mail');
}
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// File paths for persistent storage
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Load data from files or initialize empty arrays
let users = [];
let departments = [];
let subjects = [];
let rooms = [];
let schedule = []; // Global schedule storage
let fixedSchedules = []; // Global fixed schedules storage

try {
  if (fs.existsSync(USERS_FILE)) {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    users = data.users || [];
    departments = data.departments || [
      {
        id: 'default-dept',
        code: 'DEFAULT',
        name: 'Default Department'
      }
    ];
    subjects = data.subjects || [];
    rooms = data.rooms || [];
    schedule = data.schedule || [];
    fixedSchedules = data.fixedSchedules || [];
    console.log('Data loaded from file:');
    console.log('- Users:', users.length);
    console.log('- Departments:', departments.length);
    console.log('- Subjects:', subjects.length);
    console.log('- Rooms:', rooms.length);
    console.log('- Schedule events:', schedule.length);
    console.log('- Fixed schedules:', fixedSchedules.length);
  }
} catch (error) {
  console.error('Error loading data:', error);
  users = [];
  departments = [
    {
      id: 'default-dept',
      code: 'DEFAULT',
      name: 'Default Department'
    }
  ];
  subjects = [];
  rooms = [];
  fixedSchedules = [];
}

// Queue for serializing file writes to prevent corruption
let saveQueue = [];
let isSaving = false;

// Improved function to save data to files with atomic writes and queue
async function saveData() {
  return new Promise((resolve, reject) => {
    // Add to queue
    saveQueue.push({ resolve, reject });
    
    // Process queue
    if (!isSaving) {
      processSaveQueue();
    }
  });
}

async function processSaveQueue() {
  if (saveQueue.length === 0) {
    isSaving = false;
    return;
  }
  
  isSaving = true;
  const { resolve, reject } = saveQueue.shift();
  
  try {
    const dataToSave = { users, departments, subjects, rooms, schedule, fixedSchedules };
    const dataString = JSON.stringify(dataToSave, null, 2);
    
    // Atomic write: Write to temp file first, then rename (prevents corruption)
    const tempFile = USERS_FILE + '.tmp';
    const backupFile = USERS_FILE + '.bak';
    
    // Create backup of current file if it exists
    if (fs.existsSync(USERS_FILE)) {
      fs.copyFileSync(USERS_FILE, backupFile);
    }
    
    // Write to temp file
    fs.writeFileSync(tempFile, dataString, 'utf8');
    
    // Atomic rename (this is an atomic operation on most filesystems)
    fs.renameSync(tempFile, USERS_FILE);
    
    // Clean up old backup after successful write (keep last backup)
    if (fs.existsSync(backupFile)) {
      // Keep backup for 5 minutes, then delete
      setTimeout(() => {
        try {
          if (fs.existsSync(backupFile)) {
            fs.unlinkSync(backupFile);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      }, 5 * 60 * 1000);
    }
    
    console.log('Data saved successfully (atomic write)');
    resolve();
  } catch (error) {
    console.error('Error saving data:', error);
    console.error('Error details:', {
      code: error.code,
      path: error.path,
      syscall: error.syscall,
      errno: error.errno
    });
    
    // Restore from backup if write failed
    if (fs.existsSync(backupFile)) {
      try {
        fs.copyFileSync(backupFile, USERS_FILE);
        console.log('Restored from backup');
      } catch (restoreError) {
        console.error('Failed to restore from backup:', restoreError);
      }
    }
    
    reject(error);
  } finally {
    // Process next item in queue
    setImmediate(() => processSaveQueue());
  }
}

// Security middleware with permissive CSP for development
app.use(helmet({
  contentSecurityPolicy: false // Temporarily disable CSP to identify the issue
}));

// Set a simple CSP header that allows everything (for development only)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy', 
    "default-src 'self' https:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' http: https: https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;"
  );
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed origins
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8000',
      'http://127.0.0.1:8000'
    ];
    
    // Also allow Render URLs (for same-origin requests)
    const renderUrl = process.env.RENDER_EXTERNAL_URL || process.env.CLIENT_URL;
    if (renderUrl) {
      allowedOrigins.push(renderUrl);
      // Also allow without protocol if needed
      const urlWithoutProtocol = renderUrl.replace(/^https?:\/\//, '');
      allowedOrigins.push(`https://${urlWithoutProtocol}`);
      allowedOrigins.push(`http://${urlWithoutProtocol}`);
    }
    
    // Allow any .onrender.com subdomain in production
    if (process.env.NODE_ENV === 'production' && origin && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Email availability check - must be after body parser middleware
app.options('/api/auth/check-email', cors(corsOptions)); // Enable pre-flight request
app.post('/api/auth/check-email', cors(corsOptions), (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                exists: false,
                message: 'Email is required' 
            });
        }
        
        const emailExists = users.some(user => user.email.toLowerCase() === email.toLowerCase());
        
        return res.status(200).json({
            exists: emailExists,
            available: !emailExists,
            message: emailExists ? 'Email already in use' : 'Email is available'
        });
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ 
            exists: false,
            message: 'Error checking email availability' 
        });
    }
});

// Update helmet CSP to allow external scripts and inline scripts for development
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://cdn.sheetjs.com',
        'https://cdn.jsdelivr.net',
        "'unsafe-inline'"
      ],
      styleSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        "'unsafe-inline'"
      ],
      fontSrc: [
        "'self'",
        'data:',
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
      ],
      imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      connectSrc: [
        "'self'", 
        'https://cdn.sheetjs.com', 
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com'
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // allow 50 requests per windowMs for auth routes (increased for development)
  message: "Too many requests from this IP, please try again later"
});

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);

// Redirect root URL to login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Serve static files
app.use(express.static(path.join(__dirname)));

const verificationCodes = {};
const passwordResetTokens = {};

// In-memory storage for login 2FA codes
const login2FACodes = {}; // email: { code, expiry }

// Initialize default accounts if they don't exist
(async () => {
  const hashedPassword = await bcrypt.hash('superadmin123', 10);
  
  // Check if superadmin exists, if not create it
  const superadminExists = users.find(u => u.email === 'superadmin@school.edu' && u.role === 'superadmin');
  if (!superadminExists) {
    users.push({
      id: uuidv4(),
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@school.edu',
      password: hashedPassword,
      role: 'superadmin',
      department: null,
      department: '',
      status: 'approved',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveData();
  }
  console.log('Database initialized with default accounts');
})();

// Email configuration: SendGrid (preferred) or Gmail SMTP (fallback)
let useSendGrid = false;
let transporter = null;

// Debug: Check what environment variables are available
console.log('=== EMAIL CONFIGURATION DEBUG ===');
console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
console.log('SENDGRID_API_KEY length:', process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length : 0);
console.log('SENDGRID_FROM_EMAIL exists:', !!process.env.SENDGRID_FROM_EMAIL);
console.log('SENDGRID_FROM_EMAIL value:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('================================');

// Check if SendGrid is configured (preferred for cloud platforms like Render)
if (sgMail && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  useSendGrid = true;
  console.log('✅ SendGrid configured for email sending');
  console.log('📧 SendGrid from email:', process.env.SENDGRID_FROM_EMAIL);
  console.log('💡 SendGrid uses HTTP API (not blocked by Render)');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  // Fallback to Gmail SMTP (may be blocked on Render free tier)
  // Try multiple SMTP configurations for better compatibility with cloud platforms
  const smtpConfig = {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 465, // Try 465 first (SSL), fallback to 587
    secure: true, // Use SSL for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    },
    // Connection timeout settings for cloud platforms
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Retry settings
    pool: true,
    maxConnections: 1,
    maxMessages: 3
  };

  // If port 465 doesn't work, try 587 (TLS)
  if (process.env.EMAIL_USE_TLS === 'true' || process.env.EMAIL_PORT === '587') {
    smtpConfig.port = 587;
    smtpConfig.secure = false;
    smtpConfig.requireTLS = true;
  }

  transporter = nodemailer.createTransport(smtpConfig);

  // Verify transporter configuration
  transporter.verify(function(error, success) {
    if (error) {
      console.error('❌ Email transporter verification failed:', error.message);
      console.error('Error details:', {
        code: error.code,
        command: error.command,
        response: error.response
      });
      console.error('⚠️  Email sending will not work. Please check your EMAIL_USER and EMAIL_PASS in Render environment variables.');
    } else {
      console.log('✅ Email server is ready to send messages');
      console.log('📧 Email configured for:', process.env.EMAIL_USER);
    }
  });
} else {
  console.warn('⚠️  Email not configured!');
  console.warn('💡 Recommended: Use SendGrid (works on Render free tier)');
  console.warn('   Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in Render environment variables');
  console.warn('   OR use Gmail SMTP: Set EMAIL_USER and EMAIL_PASS (may be blocked on Render free tier)');
}

// Helper function to safely read JSON file (creates file if doesn't exist)
const readJsonFile = (filePath, defaultValue = []) => {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // If file doesn't exist, create it with default value
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      console.log(`Created missing file: ${filePath}`);
      return defaultValue;
    }
    
    // Read and parse file
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content || content.trim() === '') {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    // If file is corrupted, create a new one
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      console.log(`Recreated corrupted file: ${filePath}`);
    } catch (writeError) {
      console.error(`Failed to recreate ${filePath}:`, writeError);
    }
    return defaultValue;
  }
};

// Helper functions
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationEmail = async (email, code) => {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 20px 0; text-align: center;">
            <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center; background-color: #1A609B; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Email Verification</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    Hello,
                  </p>
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    Thank you for registering with our Scheduling System. Please use the verification code below to complete your registration:
                  </p>
                  <div style="background-color: #f8f9fa; border: 2px dashed #1A609B; padding: 20px; text-align: center; margin: 30px 0; border-radius: 4px;">
                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1A609B; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </div>
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    This verification code will expire in <strong>10 minutes</strong>.
                  </p>
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    If you did not request this verification code, please ignore this email or contact support if you have concerns.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const emailText = `
Email Verification

Hello,

Thank you for registering with our Scheduling System. Please use the verification code below to complete your registration:

Verification Code: ${code}

This verification code will expire in 10 minutes.

If you did not request this verification code, please ignore this email or contact support if you have concerns.

---
This is an automated message. Please do not reply to this email.
  `;

  // Use SendGrid if configured (preferred for cloud platforms like Render)
  if (useSendGrid && sgMail) {
    try {
      console.log(`📧 Attempting to send verification email via SendGrid:`);
      console.log(`   From: ${process.env.SENDGRID_FROM_EMAIL}`);
      console.log(`   To: ${email}`);
      console.log(`   Code: ${code}`);

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL,
          name: 'Scheduling System'
        },
        replyTo: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Verify Your Email Address - Scheduling System',
        text: emailText,
        html: emailHtml,
        categories: ['verification'],
        mailSettings: {
          sandboxMode: {
            enable: false
          }
        }
      };

      const result = await sgMail.send(msg);
      console.log('✅ Email sent successfully via SendGrid!');
      console.log(`   📬 Email delivered to: ${email}`);
      console.log(`   🔑 Verification code: ${code}`);
      console.log(`   📧 SendGrid Response:`, JSON.stringify(result, null, 2));
      console.log(`   📧 SendGrid Status Code:`, result[0]?.statusCode);
      console.log(`   📧 SendGrid Headers:`, result[0]?.headers);
      return true;
    } catch (error) {
      console.error('❌ SendGrid error:', error.message);
      console.error('❌ SendGrid error code:', error.code);
      if (error.response) {
        console.error('❌ SendGrid response status:', error.response.statusCode);
        console.error('❌ SendGrid response body:', JSON.stringify(error.response.body, null, 2));
        console.error('❌ SendGrid response headers:', error.response.headers);
      }
      if (error.message) {
        console.error('❌ Full error message:', error.message);
      }
      return false;
    }
  }

  // Fallback to Gmail SMTP (may be blocked on Render free tier)
  if (!transporter) {
    console.error('❌ Email transporter not configured');
    console.error('💡 Tip: Use SendGrid (SENDGRID_API_KEY) for better reliability on cloud platforms');
    return false;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Cannot send email: EMAIL_USER or EMAIL_PASS not set');
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification Code',
    html: emailHtml
  };

  try {
    console.log(`📧 Attempting to send verification email via Gmail SMTP:`);
    console.log(`   From: ${process.env.EMAIL_USER}`);
    console.log(`   To: ${email}`);
    console.log(`   Code: ${code}`);
    console.log(`   Subject: ${mailOptions.subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log(`   📬 Email delivered to: ${email}`);
    console.log(`   🔑 Verification code: ${code} (also check server logs if email doesn't arrive)`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    console.error('Error response:', error.response);
    
    // Common error messages
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check your Gmail app password.');
      console.error('Make sure you:');
      console.error('1. Enabled 2-Step Verification on Gmail');
      console.error('2. Generated an App Password (not your regular password)');
      console.error('3. Used the 16-character app password in EMAIL_PASS');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('🌐 Connection failed or timeout.');
      console.error('⚠️  Render free tier BLOCKS SMTP ports (465, 587)!');
      console.error('💡 Solution: Use SendGrid instead (SENDGRID_API_KEY) - it uses HTTP, not SMTP');
    }
    
    return false;
  }
};

// Send verification link email to faculty
const sendFacultyVerificationLink = async (email, link, firstName) => {
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 20px 0; text-align: center;">
            <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 40px 30px; text-align: center; background-color: #1A609B; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Verify Your Account</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    Hello ${firstName || 'there'},
                  </p>
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    You have been added as a faculty member to our Scheduling System. Please click the button below to verify your account and set up your password.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${link}" style="
                      display: inline-block;
                      padding: 12px 30px;
                      background-color: #1A609B;
                      color: #ffffff;
                      text-decoration: none;
                      border-radius: 5px;
                      font-weight: bold;
                      font-size: 16px;
                    ">Verify Account</a>
                  </div>
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="margin: 10px 0 0 0; color: #1A609B; font-size: 12px; word-break: break-all;">
                    ${link}
                  </p>
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    This verification link will expire in <strong>7 days</strong>.
                  </p>
                  <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    If you did not expect this email, please ignore it or contact support if you have concerns.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px; text-align: center; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const emailText = `
Verify Your Account

Hello ${firstName || 'there'},

You have been added as a faculty member to our Scheduling System. Please click the link below to verify your account and set up your password.

${link}

This verification link will expire in 7 days.

If you did not expect this email, please ignore it or contact support if you have concerns.

---
This is an automated message. Please do not reply to this email.
  `;

  // Use SendGrid if configured
  if (useSendGrid && sgMail) {
    try {
      console.log(`📧 Attempting to send faculty verification email via SendGrid:`);
      console.log(`   From: ${process.env.SENDGRID_FROM_EMAIL}`);
      console.log(`   To: ${email}`);
      console.log(`   Link: ${link}`);
      console.log(`   API Key configured: ${!!process.env.SENDGRID_API_KEY}`);

      const msg = {
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL,
          name: 'Scheduling System'
        },
        replyTo: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Verify Your Faculty Account - Scheduling System',
        text: emailText,
        html: emailHtml,
        categories: ['faculty-verification']
      };

      const result = await sgMail.send(msg);
      console.log('✅ Faculty verification email sent successfully via SendGrid!');
      console.log('   Status Code:', result[0]?.statusCode);
      if (result[0]?.body) {
        console.log('   Response:', JSON.stringify(result[0].body, null, 2));
      }
      return true;
    } catch (error) {
      console.error('❌ SendGrid error:', error.message);
      if (error.response) {
        console.error('   Status Code:', error.response.statusCode);
        if (error.response.body) {
          console.error('   Response Body:', JSON.stringify(error.response.body, null, 2));
        }
        if (error.response.headers) {
          console.error('   Response Headers:', JSON.stringify(error.response.headers, null, 2));
        }
      }
      if (error.code) {
        console.error('   Error Code:', error.code);
      }
      // Log full error for debugging
      console.error('   Full error:', error);
      return false;
    }
  }

  // Fallback to Gmail SMTP
  if (!transporter) {
    console.error('❌ Email transporter not configured');
    console.error('💡 To fix: Set EMAIL_USER and EMAIL_PASS environment variables, or use SENDGRID_API_KEY');
    return false;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Cannot send email: EMAIL_USER or EMAIL_PASS not set');
    console.error('💡 To fix: Set EMAIL_USER and EMAIL_PASS environment variables in your .env file');
    return false;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Faculty Account - Scheduling System',
    html: emailHtml,
    text: emailText
  };

  try {
    console.log(`📧 Attempting to send faculty verification email via Gmail SMTP:`);
    console.log(`   From: ${process.env.EMAIL_USER}`);
    console.log(`   To: ${email}`);
    console.log(`   Link: ${link}`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Faculty verification email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending faculty verification email:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error command:', error.command);
    if (error.response) {
      console.error('   Error response:', error.response);
    }
    return false;
  }
};

// Email availability check
app.post('/api/auth/check-email', (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                exists: false,
                message: 'Email is required' 
            });
        }
        
        const emailExists = users.some(user => user.email.toLowerCase() === email.toLowerCase());
        
        return res.status(200).json({
            exists: emailExists,
            available: !emailExists,
            message: emailExists ? 'Email already in use' : 'Email is available'
        });
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ 
            exists: false,
            message: 'Error checking email availability' 
        });
    }
});

// Routes

// Check email availability
app.post('/api/auth/check-email', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        exists: false,
        message: 'Email is required' 
      });
    }
    
    const emailExists = users.some(user => user.email.toLowerCase() === email.toLowerCase());
    
    return res.status(200).json({
      exists: emailExists,
      message: emailExists ? 'Email is already in use' : 'Email is available'
    });
  } catch (error) {
    console.error('Error checking email:', error);
    return res.status(500).json({ 
      exists: false,
      message: 'Error checking email availability' 
    });
  }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, middleName, lastName, email, password, departmentId } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Check if email already exists (double check)
    if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ 
        success: false,
        field: 'email',
        message: 'Email is already in use' 
      });
    }

    // Department will be set by superadmin when user is approved
    // For now, use a placeholder
    const department = { id: 'pending', name: 'Pending Assignment' };

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    // Create new user
    const newUser = {
      id: uuidv4(),
      firstName,
      middleName: middleName || '',
      lastName,
      email,
      password: hashedPassword,
      role: 'user',
      department: department.name,
      departmentId: department.id,
      status: 'pending',
      verified: false,
      verificationCode,
      verificationExpires: Date.now() + 3600000, // 1 hour from now
      createdAt: new Date().toISOString()
    };

    // Store verification code in memory for quick lookup
    verificationCodes[email] = {
      code: verificationCode,
      expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
    };

    // Add to users array and save to file
    users.push(newUser);
    try {
      saveData(); // Save to file
      console.log('New user registered and saved:', { 
        id: newUser.id, 
        email: newUser.email, 
        status: newUser.status 
      });
    } catch (error) {
      console.error('Error saving user data:', error);
      throw new Error('Failed to save user data');
    }

    // For superadmin, skip email verification and log in directly
    if (email.toLowerCase() === 'superadmin@school.edu') {
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: 'superadmin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      // Update user to be verified and approved
      newUser.verified = true;
      newUser.status = 'approved';
      newUser.role = 'superadmin';
      saveData();

      return res.status(201).json({
        message: 'Superadmin registration successful',
        token,
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: 'superadmin',
          status: 'approved',
          redirectTo: '/superadmin/account-requests' // Add redirect path
        }
      });
    }

    // For regular users, send verification email
    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      console.error('❌ Failed to send verification email to:', email);
      console.error('Verification code generated (but not sent):', verificationCode);
      return res.status(500).json({ 
        message: 'Failed to send verification email. Please check server logs or contact administrator.',
        debug: process.env.NODE_ENV === 'development' ? 'Email service not configured or failed' : undefined
      });
    }

    res.status(201).json({ 
      message: 'Registration successful, please verify your email',
      userId: newUser.id
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify Email
app.post('/api/auth/verify', (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    // Find user in main users array first
    const userIndex = users.findIndex(user => user.email === email);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if verification code exists and is valid
    // First check user's stored verification code
    const userCode = users[userIndex].verificationCode;
    const memoryCode = verificationCodes[email];
    
    console.log('=== OTP VERIFICATION DEBUG ===');
    console.log('Email:', email);
    console.log('Entered code:', code, '(type:', typeof code, ')');
    console.log('User stored code:', userCode, '(type:', typeof userCode, ')');
    console.log('Memory code:', memoryCode ? memoryCode.code : 'none', memoryCode ? '(type: ' + typeof memoryCode.code + ')' : '');
    
    let codeMatches = false;
    
    // Check user's stored code first
    if (userCode) {
      const userCodeStr = String(userCode).trim();
      const enteredCodeStr = String(code).trim();
      console.log('Comparing user code:', `"${userCodeStr}"`, '===', `"${enteredCodeStr}"`, 'Result:', userCodeStr === enteredCodeStr);
      if (userCodeStr === enteredCodeStr) {
        codeMatches = true;
        // Check expiration
        if (users[userIndex].verificationExpires && users[userIndex].verificationExpires < Date.now()) {
          console.log('❌ User code expired');
          return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
        }
        console.log('✅ User code matches!');
      }
    }
    
    // If user code doesn't match, check memory
    if (!codeMatches && memoryCode) {
      const memoryCodeStr = String(memoryCode.code).trim();
      const enteredCodeStr = String(code).trim();
      console.log('Comparing memory code:', `"${memoryCodeStr}"`, '===', `"${enteredCodeStr}"`, 'Result:', memoryCodeStr === enteredCodeStr);
      
      // Check expiration first
      if (memoryCode.expiry < Date.now()) {
        console.log('❌ Memory code expired');
        delete verificationCodes[email];
        return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
      }
      
      if (memoryCodeStr === enteredCodeStr) {
        codeMatches = true;
        console.log('✅ Memory code matches!');
        // Clear the verification code from memory
        delete verificationCodes[email];
      }
    }
    
    if (!codeMatches) {
      console.log('❌ Code mismatch - all checks failed');
      return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
    }
    
    console.log('✅ Code verified successfully!');

    // Mark user as verified - but keep status as 'pending' until superadmin approves
    // Only change status to 'approved' if superadmin has already approved
    users[userIndex].verified = true;
    users[userIndex].emailVerified = true;
    
    // Keep status as 'pending' - superadmin will approve/reject later
    // Don't auto-approve on verification
    
    // Clear the verification code from user record
    users[userIndex].verificationCode = undefined;
    users[userIndex].verificationExpires = undefined;
    
    // Save the updated user data
    try {
      saveData();
      console.log('User verified successfully:', { email, status: users[userIndex].status, verified: users[userIndex].verified });
      
      // Notify that a new user has verified and is ready for approval
      console.log('📢 New user verified and ready for approval:', {
        email: users[userIndex].email,
        name: `${users[userIndex].firstName} ${users[userIndex].lastName}`,
        status: 'pending',
        verified: true
      });
    } catch (error) {
      console.error('Error saving user data after verification:', error);
      return res.status(500).json({ message: 'Failed to save user data' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: users[userIndex].id, 
        email: users[userIndex].email,
        role: users[userIndex].role || 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        id: users[userIndex].id,
        firstName: users[userIndex].firstName,
        lastName: users[userIndex].lastName,
        email: users[userIndex].email,
        status: users[userIndex].status,
        role: users[userIndex].role || 'user',
        verified: true
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// Resend Verification Code
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user exists
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already verified
    if (user.verified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    
    // Store verification code in user record AND in memory
    user.verificationCode = verificationCode;
    user.verificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Also store in verificationCodes for backward compatibility
    verificationCodes[email] = {
      code: verificationCode,
      expiry: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    // Save user data
    saveData();

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.status(200).json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List of test emails that bypass OTP (for development only)
const TEST_EMAILS = [
  'superadmin@school.edu'  // Keep only essential test accounts
];

// User Login with optional 2FA based on email
app.post('/api/auth/login', async (req, res) => {
  console.log('LOGIN ENDPOINT HIT');
  try {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    
    console.log('=== LOGIN DEBUG ===');
    console.log('All users:', users.map(u => ({ email: u.email, status: u.status })));
    console.log('Looking for email:', email);
    
    console.log('Login attempt:', {
      email,
      userFound: !!user,
      userStatus: user ? user.status : 'not found',
      hasPassword: user ? !!user.password : false,
      passwordLength: user ? (user.password ? user.password.length : 0) : 0
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is verified
    // For faculty members added by superadmin, they are verified via the verification link
    // So we check both emailVerified (for signup flow) and verified (for faculty verification flow)
    const isVerified = user.emailVerified === true || user.verified === true;
    
    if (user.role !== 'superadmin' && !isVerified) {
      return res.status(401).json({ 
        message: 'Your account is pending approval. Please wait for an administrator to approve your account.',
        requiresApproval: true
      });
    }
    
    // Check user status - but allow verified faculty to proceed even if status is pending
    // (they need to set password and complete verification first)
    if (user.status === 'pending' && !isVerified) {
      return res.status(401).json({ 
        message: 'Your account is pending approval. Please wait for an administrator to approve your account.',
        requiresApproval: true
      });
    }
    
    // If user is verified but status is still pending, they should be able to login
    // (This handles the case where faculty completes verification but status hasn't been updated)
    if (user.status === 'pending' && isVerified) {
      // Allow them to proceed - they've verified their email
      console.log('User is verified but status is pending - allowing login');
    }
    
    if (user.status === 'rejected') {
      return res.status(403).json({ 
        message: 'Your account has been rejected. If this is a mistake, please contact a superadmin for further action.',
        accountRejected: true
      });
    }
    
    if (user.status === 'denied') {
      return res.status(403).json({ 
        message: 'Your account has been denied. Please contact the administrator for more information.'
      });
    }
    
    // Allow verified users to login even if status is pending (they've completed email verification)
    // This handles faculty members who were added by superadmin and verified via link
    if (user.status !== 'approved' && !isVerified) {
      return res.status(403).json({ 
        message: 'Your account is not active. Please contact the administrator.'
      });
    }

    console.log('About to compare passwords...');
    console.log('Entered password:', password);
    console.log('Stored password hash:', user.password);
    
    try {
      console.log('=== PASSWORD COMPARISON DEBUG ===');
      console.log('Entered password:', password);
      console.log('Stored password hash:', user.password);
      console.log('Password length:', password ? password.length : 0);
      
      const valid = await bcrypt.compare(password, user.password);
      console.log('Password comparison result:', valid);
      
      if (!valid) {
        console.log('Password comparison failed - returning 401 with incorrect password message');
        return res.status(401).json({ message: 'Incorrect password', incorrectPassword: true });
      }
      console.log('Password comparison successful - continuing...');
    } catch (error) {
      console.error('Error during password comparison:', error);
      return res.status(500).json({ message: 'Server error during authentication' });
    }

    // Check if this is a test email that should bypass 2FA
    const isTestEmail = TEST_EMAILS.includes(email);
    
    if (isTestEmail) {
      console.log(`Bypassing 2FA for test email: ${email}`);
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1d' }
      );
      
      // Prepare user data for response
      const userData = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role || 'user', // Default to 'user' if role is not set
        status: user.status
      };
      
      // Store user data in localStorage
      const responseData = { 
        message: 'Login successful', 
        token,
        user: userData
      };
      
      return res.status(200).json(responseData);
    }

    // For non-test emails, proceed with 2FA
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    login2FACodes[email] = { code, expiry: Date.now() + 10 * 60 * 1000 }; // 10 min expiry
    console.log(`🔑 2FA code generated for ${email}: ${code}`);
    console.log(`⏰ Code expires in 10 minutes`);

    // Try to send email
    const emailSent = await sendVerificationEmail(email, code);
    if (!emailSent) {
      console.error('❌ Failed to send 2FA email to:', email);
      console.error('⚠️  2FA code is still valid - check server logs above for the code');
      console.error(`🔑 CODE FOR ${email}: ${code} (use this if email doesn't arrive)`);
      // Still allow login with 2FA - user can check server logs or contact admin
    } else {
      console.log(`✅ 2FA email sent successfully to: ${email}`);
    }

    res.status(200).json({ message: '2FA required', twoFA: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2FA Verification (Step 2: code)
app.post('/api/auth/verify-2fa', (req, res) => {
  try {
    const { email, code } = req.body;
    const record = login2FACodes[email];
    if (!record || record.expiry < Date.now() || record.code !== code) {
      return res.status(400).json({ message: 'Invalid or expired 2FA code' });
    }
    // Clean up
    delete login2FACodes[email];

    // Find user and generate JWT/token
    const user = users.find(u => u.email === email);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ token, user });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Simple JWT auth middleware for protected routes
function verifyToken(req, res, next) {
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to check if user is a superadmin
const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied. Superadmin privileges required.' });
  }
  next();
};

// Middleware to check if user is an admin or superadmin
const isAdminOrSuperAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin or Superadmin privileges required.' });
}

// Get all users (admin/superadmin only)
app.get('/api/users', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    // Return users without sensitive data
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department,
      departmentId: user.departmentId,
      status: user.status || 'pending',
      verified: user.verified || false,
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt || new Date().toISOString()
    }));
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

// Approve a user (admin/superadmin only)
app.patch('/api/users/:userId/approve', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    // Find the user
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user status
    users[userIndex].status = status;
    users[userIndex].approvedAt = new Date().toISOString();
    
    // Save the changes
    saveData();
    
    // Return the updated user (without sensitive data)
    const { password, verificationCode, ...userData } = users[userIndex];
    res.json(userData);
    
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ message: 'Failed to approve user', error: error.message });
  }
});

// Delete a user (admin/superadmin only)
app.delete('/api/users/:userId', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deleting self
    if (users[userIndex].id === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    // Remove the user
    users.splice(userIndex, 1);
    
    // Save the changes
    saveData();
    
    res.json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

// Clear all signed-in user data (superadmin only)
app.post('/api/users/clear-sessions', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    // Find all users with active sessions (in a real app, this would check for active sessions)
    const usersWithSessions = users.filter(user => user.lastLogin);
    const count = usersWithSessions.length;
    
    // Clear session-related data (in a real app, this would invalidate sessions in your session store)
    usersWithSessions.forEach(user => {
      delete user.lastLogin;
      delete user.refreshToken;
      // Add any other session-related fields you want to clear
    });
    
    // Save the updated users
    saveData();
    
    res.status(200).json({
      success: true,
      message: `Successfully cleared session data for ${count} users`,
      count
    });
    
  } catch (error) {
    console.error('Error clearing user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear user sessions',
      error: error.message
    });
  }
});

// Get all pending users (superadmin only)
app.get('/api/users/pending', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    console.log('Fetching pending users. Total users:', users.length);
    
    // Filter users with 'pending' status AND verified (OTP confirmed)
    // Only show users who have completed OTP verification
    // Exclude hardcoded superadmin account
    const pendingUsers = users.filter(user => {
      // Exclude hardcoded superadmin account
      if (user.email === 'superadmin@school.edu') {
        return false;
      }
      const isPending = user.status === 'pending';
      const isVerified = user.verified === true || user.emailVerified === true;
      const shouldShow = isPending && isVerified;
      console.log(`User ${user.email} - Status: ${user.status} - Verified: ${isVerified} - Show: ${shouldShow}`);
      return shouldShow;
    });
    
    console.log(`Found ${pendingUsers.length} pending users`);
    
    // Return minimal user data (no password hashes)
    const sanitizedUsers = pendingUsers.map(user => ({
      id: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      role: user.role,
      department: user.department || 'Pending Assignment',
      status: user.status,
      verified: user.verified,
      createdAt: user.createdAt
    }));
    
    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ message: 'Failed to fetch pending users', error: error.message });
  }
});

// Get all users (admin and superadmin)
app.get('/api/users', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  // Filter users based on role/department access
  let usersList;
  
  if (req.user.role === 'superadmin') {
    // Superadmin sees all users with their status, but exclude hardcoded superadmin account
    usersList = users
      .filter(user => user.email !== 'superadmin@school.edu')
      .map(user => ({
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
        createdAt: user.createdAt
      }));
  } else {
    // Admin sees only approved users in their department
    usersList = users
      .filter(user => user.department === req.user.department && user.role === 'user' && user.status === 'approved')
      .map(user => ({
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        department: user.department,
        status: user.status,
        createdAt: user.createdAt
      }));
  }
  
  res.status(200).json(usersList);
});

// Debug endpoint to check all users
app.get('/api/debug/users', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const debugInfo = users.map(user => ({
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    }));
    res.json({ totalUsers: users.length, users: debugInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a pending user (superadmin only)
app.put('/api/users/:userId/approve', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Attempting to approve user:', userId);
    console.log('Total users:', users.length);
    console.log('User IDs:', users.map(u => u.id));
    
    // Find the user in the main users array
    const userIndex = users.findIndex(user => user.id === userId);
    console.log('User index found:', userIndex);
    
    if (userIndex === -1) {
      console.log('User not found in users array');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user status to approved
    users[userIndex].status = 'approved';
    
    // If this is a new user, make sure they're marked as verified
    users[userIndex].emailVerified = true;
    
    // Save changes
    saveData();
    
    // In a real app, you would send a welcome email here
    // await sendWelcomeEmail(users[userIndex].email, users[userIndex].firstName);
    
    // Return the updated user (without sensitive data)
    const { password, ...userWithoutPassword } = users[userIndex];
    
    res.status(200).json({
      message: 'User approved successfully',
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ message: 'Failed to approve user', error: error.message });
  }
});

// Reject a pending user (superadmin only)
app.put('/api/users/:userId/reject', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Attempting to reject user:', userId);
    console.log('Total users:', users.length);
    console.log('User IDs:', users.map(u => u.id));
    
    // Find the user in the main users array
    const userIndex = users.findIndex(user => user.id === userId);
    console.log('User index found:', userIndex);
    
    if (userIndex === -1) {
      console.log('User not found in users array');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user status to rejected
    users[userIndex].status = 'rejected';
    users[userIndex].rejectedAt = new Date().toISOString();
    
    // Save changes
    saveData();
    
    // Return the updated user (without sensitive data)
    const { password, ...userWithoutPassword } = users[userIndex];
    
    res.status(200).json({
      message: 'User rejected successfully',
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Error rejecting user:', error);
    res.status(500).json({ message: 'Failed to reject user', error: error.message });
  }
});

// Deny a pending user (superadmin only)
app.post('/api/users/deny/:userId', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    // Find the user in the main users array
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user email before removal (for notification)
    const userEmail = users[userIndex].email;
    
    // Remove the user from the array
    users.splice(userIndex, 1);
    
    // Save changes
    saveData();
    
    // In a real app, you would send a rejection email here
    // await sendRejectionEmail(userEmail, reason);
    
    res.status(200).json({
      message: 'User registration denied',
      userId,
      email: userEmail
    });
    
  } catch (error) {
    console.error('Error denying user:', error);
    res.status(500).json({ message: 'Failed to deny user', error: error.message });
  }
});

// Change user status (superadmin only)
app.put('/api/users/:userId/status', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!['pending', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be "pending", "approved", or "denied"' });
    }
    
    // Find the user
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user status
    users[userIndex].status = status;
    saveData();
    
    res.status(200).json({ 
      message: 'User status updated successfully',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        status: users[userIndex].status
      }
    });
  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (superadmin only)
app.put('/api/users/:userId/role', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    let { role } = req.body;
    
    // Normalize role
    if (typeof role === 'string') role = role.toLowerCase();
    
    // Validate role (include faculty)
    const allowed = ['user', 'admin', 'superadmin', 'faculty'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${allowed.join(', ')}` });
    }
    
    // Find the user
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update user role
    users[userIndex].role = role;
    saveData();
    
    res.status(200).json({ 
      message: 'User role updated successfully',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        role: users[userIndex].role
      }
    });
  } catch (error) {
    console.error('User role update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get individual user (superadmin can access any user, regular users can access their own)
app.get('/api/users/:userId', isAuthenticated, (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    // Find user
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Allow access if:
    // 1. User is requesting their own data, OR
    // 2. User is a superadmin
    if (userId !== requestingUserId && requestingUserRole !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. You can only view your own data.' });
    }
    
    // Return user data (without sensitive information)
    res.status(200).json({
      id: user.id,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department,
      status: user.status,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (superadmin only)
app.put('/api/users/:userId', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, department, role } = req.body;
    
    // Find user
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Check if email is already taken by another user
    const existingUser = users.find(u => u.email === email && u.id !== userId);
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Update user
    if (name) {
      // If name is provided, we'll keep it as is for backward compatibility
      // But also ensure firstName and lastName are set if they don't exist
      users[userIndex].name = name;
      if (!users[userIndex].firstName && !users[userIndex].lastName) {
        const nameParts = name.split(' ');
        users[userIndex].firstName = nameParts[0] || '';
        users[userIndex].lastName = nameParts.slice(1).join(' ') || '';
      }
    }
    if (email) users[userIndex].email = email;
    if (department !== undefined) users[userIndex].department = department;
    if (role) {
      const normalizedRole = role.toLowerCase();
      const allowed = ['user', 'admin', 'superadmin', 'faculty'];
      if (allowed.includes(normalizedRole)) {
        users[userIndex].role = normalizedRole;
      }
    }
    
    // Save to file
    saveData();
    
    res.status(200).json({ 
      message: 'User updated successfully',
      user: {
        id: users[userIndex].id,
        name: users[userIndex].name,
        email: users[userIndex].email,
        role: users[userIndex].role,
        department: users[userIndex].department
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Promote an existing approved user to faculty and optionally assign department (superadmin only)
app.post('/api/users/:userId/promote-faculty', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { departmentId } = req.body || {};

    const userIndex = users.findIndex(user => String(user.id) === String(userId));
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only promote approved or verified users; otherwise return a 400
    const user = users[userIndex];
    const status = String(user.status || 'approved').toLowerCase();
    if (status !== 'approved') {
      return res.status(400).json({ message: 'User must be approved before promoting to faculty' });
    }

    users[userIndex].role = 'faculty';

    if (departmentId) {
      const dept = departments.find(d => String(d.id) === String(departmentId));
      if (dept) {
        users[userIndex].departmentId = dept.id;
        users[userIndex].department = dept.name;
      }
    }

    saveData();

    const { password, verificationCode, ...userData } = users[userIndex];
    return res.status(200).json({
      message: 'User promoted to faculty successfully',
      user: userData
    });
  } catch (error) {
    console.error('Promote to faculty error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (superadmin only)
app.delete('/api/users/:userId', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find the user
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deletion of superadmin accounts
    if (users[userIndex].role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin accounts' });
    }
    
    // Remove user from array
    const deletedUser = users.splice(userIndex, 1)[0];
    saveData();
    
    res.status(200).json({ 
      message: 'User deleted successfully',
      user: {
        id: deletedUser.id,
        email: deletedUser.email,
        firstName: deletedUser.firstName,
        lastName: deletedUser.lastName
      }
    });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get all departments
app.get('/api/departments', isAuthenticated, (req, res) => {
  try {
    // Return all departments
    
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department by ID
app.get('/api/departments/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const department = departments.find(dept => dept.id === id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.status(200).json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create a new department
app.post('/api/departments', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { code, name, color } = req.body;
    
    // Validate input
    if (!code || !name) {
      return res.status(400).json({ error: 'Department code and name are required' });
    }
    
    // Check if department with same code or name already exists
    const exists = departments.some(
      dept => dept.code.toLowerCase() === code.toLowerCase() || 
              dept.name.toLowerCase() === name.toLowerCase()
    );
    
    if (exists) {
      return res.status(409).json({ error: 'A department with this code or name already exists' });
    }
    
    // Default color if not provided
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
    const departmentColor = color || defaultColors[departments.length % defaultColors.length];
    
    // Create new department
    const newDept = {
      id: `dept${departments.length + 1}`,
      code: code.trim(),
      name: name.trim(),
      color: departmentColor,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    departments.push(newDept);
    
    // Save the changes to file
    saveData();
    
    res.status(201).json({
      message: 'Department created successfully',
      department: newDept
    });
    
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update a department
app.put('/api/departments/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, color } = req.body;
    
    // Validate input
    if (!code || !name) {
      return res.status(400).json({ error: 'Department code and name are required' });
    }
    
    // Find the department
    const deptIndex = departments.findIndex(dept => dept.id === id);
    
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Check if another department with the same code or name exists
    const exists = departments.some(
      (dept, index) => index !== deptIndex && 
        (dept.code.toLowerCase() === code.toLowerCase() || 
         dept.name.toLowerCase() === name.toLowerCase())
    );
    
    if (exists) {
      return res.status(409).json({ error: 'Another department with this code or name already exists' });
    }
    
    // Update the department
    const updatedDept = {
      ...departments[deptIndex],
      code: code.trim(),
      name: name.trim(),
      color: color || departments[deptIndex].color || '#3b82f6', // Keep existing color if not provided
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    departments[deptIndex] = updatedDept;
    
    // Save the changes to file
    saveData();
    
    res.status(200).json({
      message: 'Department updated successfully',
      department: updatedDept
    });
    
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete a department (auto-unassign users and block if any faculty remain assigned)
app.delete('/api/departments/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // Find the department
    const deptIndex = departments.findIndex(dept => dept.id === id);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Block delete if any faculty remain in this department
    const facultyAssigned = users.filter(u =>
      String(u.departmentId) === String(id) &&
      String(u.status || 'approved').toLowerCase() === 'approved'
    );
    if (facultyAssigned.length > 0) {
      console.log('Cannot delete department - faculty still assigned:', facultyAssigned.map(f => ({ id: f.id, email: f.email, status: f.status, departmentId: f.departmentId })));
      return res.status(400).json({
        error: 'Cannot delete department while faculty are assigned. Please reassign or demote faculty first.',
        assignedFaculty: facultyAssigned.map(f => ({ id: f.id, email: f.email, status: f.status }))
      });
    }

    // Auto-unassign any users currently assigned to this department
    let affectedUsers = 0;
    users = users.map(user => {
      if (String(user.departmentId) === String(id)) {
        affectedUsers += 1;
        return { ...user, departmentId: null };
      }
      return user;
    });

    // Remove the department
    const [removed] = departments.splice(deptIndex, 1);
    
    // Save the changes to file
    saveData();

    res.status(200).json({
      message: 'Department deleted successfully',
      departmentId: id,
      unassignedUsers: affectedUsers,
      department: removed
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Get all faculty members or filter by department
app.get('/api/faculty', isAuthenticated, (req, res) => {
  try {
    const { departmentId } = req.query;
    
    // Faculty are users assigned to a real department (not the 'pending' placeholder)
    // Include both 'pending' and 'approved' status users
    const isFacultyUser = (u) => !!u.departmentId && String(u.departmentId) !== 'pending' && (String(u.status || '').toLowerCase() === 'approved' || String(u.status || '').toLowerCase() === 'pending');

    if (departmentId) {
      const department = departments.find(dept => dept.id === departmentId);
      if (!department) {
        return res.status(404).json({ error: 'Department not found' });
      }
      const facultyInDept = users.filter(user => 
        isFacultyUser(user) && String(user.departmentId) === String(departmentId)
      );
      return res.status(200).json(facultyInDept);
    }

    const allFaculty = users.filter(isFacultyUser);
    res.status(200).json(allFaculty);
  } catch (error) {
    console.error('Error fetching faculty:', error);
    res.status(500).json({ error: 'Failed to fetch faculty' });
  }
});

// Get verified users without department (removed faculty members)
app.get('/api/faculty/removed', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    // Find verified users who don't have a department assigned (were removed from faculty)
    const removedFaculty = users.filter(user => {
      const isVerified = user.verified === true || user.emailVerified === true;
      const hasNoDepartment = !user.departmentId || String(user.departmentId) === 'pending';
      const isApproved = (user.status || '').toLowerCase() === 'approved';
      return isVerified && hasNoDepartment && isApproved;
    });

    // Return sanitized user data (without password)
    const sanitizedUsers = removedFaculty.map(user => {
      const { password, ...userData } = user;
      return userData;
    });

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching removed faculty:', error);
    res.status(500).json({ error: 'Failed to fetch removed faculty' });
  }
});

// Get a single faculty member by ID
app.get('/api/faculty/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const faculty = users.find(user => user.id === id && user.departmentId);
    
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    
    // Don't include sensitive data in the response
    const { password, ...facultyData } = faculty;
    res.status(200).json(facultyData);
    
  } catch (error) {
    console.error('Error fetching faculty member:', error);
    res.status(500).json({ error: 'Failed to fetch faculty member' });
  }
});

// Create a new faculty member (assign existing user as faculty)
app.post('/api/faculty', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { 
      userId, 
      departmentId
    } = req.body;
    
    // Validate required fields
    if (!userId || !departmentId) {
      return res.status(400).json({ 
        error: 'User ID and department ID are required' 
      });
    }
    
    // Find the user to assign as faculty
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Check if user is approved
    if (users[userIndex].status !== 'approved') {
      return res.status(400).json({ 
        error: 'User must be approved before being assigned to a department' 
      });
    }
    
    // Check if department exists
    const department = departments.find(dept => dept.id === departmentId);
    if (!department) {
      return res.status(404).json({ 
        error: 'Department not found' 
      });
    }
    
    // If user is already assigned to a real department (not 'pending'), block duplicate assignment
    const currentDeptId = users[userIndex].departmentId;
    if (currentDeptId && String(currentDeptId) !== 'pending') {
      return res.status(400).json({ error: 'User is already assigned to a department' });
    }

    // Assign department but KEEP ROLE as-is (user/admin/superadmin)
    users[userIndex].departmentId = departmentId;
    users[userIndex].department = department.name;
    users[userIndex].title = users[userIndex].title || 'Instructor'; // Default title
    users[userIndex].updatedAt = new Date().toISOString();
    users[userIndex].updatedBy = req.user.id;
    
    // Save the changes to file
    saveData();
    
    // Return the updated user (without password)
    const { password: _, ...facultyData } = users[userIndex];
    
    res.status(201).json({
      message: 'User assigned to department successfully',
      faculty: facultyData
    });
    
  } catch (error) {
    console.error('Error assigning faculty:', error);
    res.status(500).json({ error: 'Failed to assign user as faculty' });
  }
});

// Create a new faculty member (create new user as faculty)
app.post('/api/faculty/create', isAuthenticated, isAdminOrSuperAdmin, async (req, res) => {
  console.log('POST /api/faculty/create - Route hit');
  try {
    const { firstName, lastName, email, departmentId } = req.body;
    console.log('Request body:', { firstName, lastName, email, departmentId });
    
    // Validate required fields (email is optional)
    if (!firstName || !lastName || !departmentId) {
      return res.status(400).json({ 
        error: 'First name, last name, and department ID are required' 
      });
    }
    
    // Check if email already exists (only if provided)
    if (email) {
      const existingUser = users.find(user => user.email && user.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ 
          error: 'Email already exists in the system' 
        });
      }
    }
    
    // Check if department exists
    const department = departments.find(dept => dept.id === departmentId);
    if (!department) {
      return res.status(404).json({ 
        error: 'Department not found' 
      });
    }
    
    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
    
    // Create new user with status 'pending' and verified = false
    // Email is optional - can be added later
    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email ? email.toLowerCase().trim() : null,
      password: require('crypto').createHash('sha256').update(tempPassword).digest('hex'),
      role: 'user',
      status: 'pending',
      verified: false,
      departmentId: departmentId,
      department: department.name,
      title: 'Instructor',
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };
    
    // Add to users array
    users.push(newUser);
    saveData();
    
    // Return the created user (without password)
    const { password: _, ...facultyData } = newUser;
    
    res.status(201).json({
      message: email 
        ? 'Faculty member created successfully. Send verification email to activate their account.'
        : 'Faculty member created successfully. You can send verification email later when the teacher email is available.',
      faculty: facultyData
    });
    
  } catch (error) {
    console.error('Error creating faculty:', error);
    res.status(500).json({ error: 'Failed to create faculty member' });
  }
});

// Send verification email to faculty member
app.post('/api/faculty/:id/send-verification', isAuthenticated, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    // Validate email is provided
    if (!email) {
      return res.status(400).json({ error: 'Email is required to send verification' });
    }
    
    // Find the faculty member
    const facultyIndex = users.findIndex(user => user.id === id);
    if (facultyIndex === -1) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    
    const faculty = users[facultyIndex];
    
    // Check if already verified
    if (faculty.verified === true) {
      return res.status(400).json({ error: 'Faculty member is already verified' });
    }
    
    // Generate verification token
    const verificationToken = require('crypto').randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Store verification token
    faculty.verificationToken = verificationToken;
    faculty.verificationExpires = verificationExpires;
    saveData();
    
    // Create verification link
    const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
    const verificationLink = `${baseUrl}/api/faculty/verify/${verificationToken}`;
    
    // Send verification email with link
    // Always allow in development mode (when NODE_ENV is not 'production')
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
    
    // Log verification link for development
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📧 VERIFICATION LINK GENERATED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`To: ${email}`);
    console.log(`Verification Link: ${verificationLink}`);
    console.log(`Token: ${verificationToken}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    try {
      const emailSent = await sendFacultyVerificationLink(email, verificationLink, faculty.firstName || '');
      
      if (!emailSent) {
        // In development mode, log the link and still return success
        if (isDevelopment) {
          console.log('⚠️  Email not sent (email not configured), but verification link is available above');
          return res.status(200).json({
            message: 'Verification link generated (email not configured - check server console for link)',
            developmentMode: true,
            verificationLink: verificationLink
          });
        } else {
          console.error('❌ Email sending returned false. Check email configuration.');
          return res.status(500).json({ 
            error: 'Failed to send verification email. Please check server email configuration (EMAIL_USER, EMAIL_PASS, or SENDGRID_API_KEY).' 
          });
        }
      }
      
      res.status(200).json({
        message: 'Verification email sent successfully'
      });
    } catch (emailError) {
      console.error('❌ Error in sendFacultyVerificationLink:', emailError);
      
      // In development, still return success even if there's an error
      if (isDevelopment) {
        console.log('⚠️  Email error occurred, but verification link is available above');
        return res.status(200).json({
          message: 'Verification link generated (email error - check server console for link)',
          developmentMode: true,
          verificationLink: verificationLink,
          error: emailError.message
        });
      }
      
      return res.status(500).json({ 
        error: `Failed to send verification email: ${emailError.message}` 
      });
    }
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    
    // In development mode, still return the link even if there's an error
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      // Try to get the verification link if it was created
      const facultyIndex = users.findIndex(user => user.id === req.params.id);
      if (facultyIndex !== -1 && users[facultyIndex].verificationToken) {
        const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
        const verificationLink = `${baseUrl}/api/faculty/verify/${users[facultyIndex].verificationToken}`;
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📧 ERROR OCCURRED - VERIFICATION LINK (DEV MODE)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Verification Link: ${verificationLink}`);
        console.log(`Error: ${error.message}`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        return res.status(200).json({
          message: 'Verification link generated (error occurred - check server console for link)',
          developmentMode: true,
          verificationLink: verificationLink,
          error: error.message
        });
      }
    }
    
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Verify faculty account via link - Show verification page
app.get('/api/faculty/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with matching verification token
    const userIndex = users.findIndex(user => 
      user.verificationToken === token && 
      user.verificationExpires && 
      user.verificationExpires > Date.now()
    );
    
    if (userIndex === -1) {
      return res.status(400).send(`
        <html>
          <head><title>Verification Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #d9534f;">Verification Failed</h1>
            <p>The verification link is invalid or has expired.</p>
            <p>Please contact your administrator for assistance.</p>
          </body>
        </html>
      `);
    }
    
    const user = users[userIndex];
    
    // Check if already verified
    if (user.verified === true) {
      return res.status(400).send(`
        <html>
          <head><title>Already Verified</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #5cb85c;">Already Verified</h1>
            <p>Your account has already been verified.</p>
            <p><a href="login.html">Click here to login</a></p>
          </body>
        </html>
      `);
    }
    
    // Redirect to verification page with token in query string
    res.redirect(`/faculty-verification.html?token=${token}`);
    
  } catch (error) {
    console.error('Error in verification link:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #d9534f;">Error</h1>
          <p>An error occurred during verification.</p>
          <p>Please contact your administrator for assistance.</p>
        </body>
      </html>
    `);
  }
});

// Complete verification and set password
app.post('/api/faculty/verify/:token/complete', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // Find user with matching verification token
    const userIndex = users.findIndex(user => 
      user.verificationToken === token && 
      user.verificationExpires && 
      user.verificationExpires > Date.now()
    );
    
    if (userIndex === -1) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    const user = users[userIndex];
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user: set password, mark as verified and approved
    users[userIndex].password = hashedPassword;
    users[userIndex].verified = true;
    users[userIndex].emailVerified = true; // Also set emailVerified for consistency with login checks
    users[userIndex].status = 'approved';
    users[userIndex].verificationToken = undefined;
    users[userIndex].verificationExpires = undefined;
    users[userIndex].updatedAt = new Date().toISOString();
    saveData();
    
    // Generate JWT token for automatic login
    const authToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({
      success: true,
      message: 'Account verified and password set successfully',
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Error completing verification:', error);
    res.status(500).json({ error: 'Failed to complete verification' });
  }
});

// Get user info for verification page (before password is set)
app.get('/api/faculty/verify/:token/info', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with matching verification token
    const userIndex = users.findIndex(user => 
      user.verificationToken === token && 
      user.verificationExpires && 
      user.verificationExpires > Date.now()
    );
    
    if (userIndex === -1) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    const user = users[userIndex];
    
    // Return user info (without sensitive data)
    res.json({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
    });
    
  } catch (error) {
    console.error('Error getting verification info:', error);
    res.status(500).json({ error: 'Failed to get verification information' });
  }
});

// Old verification endpoint (kept for backward compatibility but redirects)
app.get('/api/faculty/verify-old/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with matching verification token
    const userIndex = users.findIndex(user => 
      user.verificationToken === token && 
      user.verificationExpires && 
      user.verificationExpires > Date.now()
    );
    
    if (userIndex === -1) {
      return res.status(400).send(`
        <html>
          <head><title>Verification Failed</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #d9534f;">Verification Failed</h1>
            <p>The verification link is invalid or has expired.</p>
            <p>Please contact your administrator for assistance.</p>
          </body>
        </html>
      `);
    }
    
    // Mark user as verified and approved
    users[userIndex].verified = true;
    users[userIndex].status = 'approved';
    users[userIndex].verificationToken = undefined;
    users[userIndex].verificationExpires = undefined;
    users[userIndex].updatedAt = new Date().toISOString();
    saveData();
    
    // Generate JWT token for automatic login
    const verificationToken = jwt.sign(
      { id: users[userIndex].id, email: users[userIndex].email, role: users[userIndex].role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Create HTML page that stores token and redirects
    const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Verification Successful</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              max-width: 500px;
            }
            .success-icon {
              font-size: 60px;
              color: #5cb85c;
              margin-bottom: 20px;
            }
            h1 {
              color: #5cb85c;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              margin-bottom: 15px;
              line-height: 1.6;
            }
            .loading {
              color: #1A609B;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Verification Successful!</h1>
            <p>Your account has been verified successfully.</p>
            <p>You are being automatically logged in...</p>
            <p class="loading">Redirecting...</p>
          </div>
          <script>
            // Store token in localStorage
            localStorage.setItem('authToken', '${verificationToken}');
            localStorage.setItem('userData', JSON.stringify({
              id: '${users[userIndex].id}',
              firstName: '${users[userIndex].firstName || ''}',
              lastName: '${users[userIndex].lastName || ''}',
              email: '${users[userIndex].email || ''}',
              role: '${users[userIndex].role || 'user'}',
              status: 'approved'
            }));
            
            // Redirect based on role
            setTimeout(function() {
              const role = '${users[userIndex].role || 'user'}';
              if (role === 'superadmin') {
                window.location.href = '/superadmin.html';
              } else if (role === 'admin') {
                window.location.href = '/admin.html';
              } else {
                window.location.href = '/index.html';
              }
            }, 2000);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error verifying faculty:', error);
    res.status(500).send(`
      <html>
        <head><title>Verification Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #d9534f;">Verification Error</h1>
          <p>An error occurred during verification. Please contact your administrator.</p>
        </body>
      </html>
    `);
  }
});

// Update a faculty member (update department assignment or email)
app.put('/api/faculty/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { 
      departmentId,
      email,
      firstName,
      lastName
    } = req.body;
    
    // Find the faculty member
    const facultyIndex = users.findIndex(
      user => user.id === id && user.departmentId
    );
    
    if (facultyIndex === -1) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    
    // Verify department exists if being updated
    if (departmentId) {
      const department = departments.find(dept => dept.id === departmentId);
      if (!department) {
        return res.status(400).json({ error: 'Department not found' });
      }
    }
    
    // Update firstName if provided
    if (firstName !== undefined && firstName !== null) {
      users[facultyIndex].firstName = firstName.trim();
    }
    
    // Update lastName if provided
    if (lastName !== undefined && lastName !== null) {
      users[facultyIndex].lastName = lastName.trim();
    }
    
    // Update faculty department assignment
    if (departmentId) {
      const department = departments.find(dept => dept.id === departmentId);
      users[facultyIndex].departmentId = departmentId;
      users[facultyIndex].department = department.name;
    }
    
    // Update email if provided
    if (email) {
      // Check if email already exists (excluding current user)
      const existingUser = users.find(user => 
        user.id !== id && 
        user.email && 
        user.email.toLowerCase() === email.toLowerCase()
      );
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists in the system' });
      }
      users[facultyIndex].email = email.toLowerCase().trim();
    }
    
    users[facultyIndex].updatedAt = new Date().toISOString();
    users[facultyIndex].updatedBy = req.user.id;
    
    // Save the changes to file
    saveData();
    
    // Don't include password in the response
    const { password, ...facultyData } = users[facultyIndex];
    
    res.status(200).json({
      message: 'Faculty assignment updated successfully',
      faculty: facultyData
    });
    
  } catch (error) {
    console.error('Error updating faculty assignment:', error);
    res.status(500).json({ error: 'Failed to update faculty assignment' });
  }
});

// Remove faculty assignment (demote from faculty role but keep user account)
app.delete('/api/faculty/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to remove faculty assignment for user ID:', id);

    const facultyIndex = users.findIndex(
      user => user.id === id && user.departmentId
    );

    console.log('Faculty search result - index:', facultyIndex, 'total users:', users.length);

    if (facultyIndex === -1) {
      console.log('Faculty member not found with ID:', id);
      return res.status(404).json({ error: 'Faculty member not found' });
    }

    const faculty = users[facultyIndex];
    console.log('Found faculty member:', {
      id: faculty.id,
      email: faculty.email,
      role: faculty.role,
      status: faculty.status,
      departmentId: faculty.departmentId
    });

    // Remove faculty role and department assignment, but keep the user account
    // Change role to 'user' (or keep existing non-faculty role)
    users[facultyIndex] = {
      ...users[facultyIndex],
      role: 'user', // Demote to regular user
      departmentId: null,
      department: null,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    console.log('Faculty assignment removed. User demoted to regular user:', users[facultyIndex]);

    // Save the changes to file
    try {
      saveData();
      console.log('Faculty assignment removal saved successfully');
    } catch (saveError) {
      console.error('Failed to save faculty assignment removal:', saveError);
      return res.status(500).json({ error: 'Failed to save changes' });
    }

    res.status(200).json({
      message: 'Faculty assignment removed successfully. User account retained.',
      userId: id
    });

  } catch (error) {
    console.error('Error removing faculty assignment:', error);
    res.status(500).json({ error: 'Failed to remove faculty assignment' });
  }
});

// Get subjects - by faculty, by department, or all subjects
app.get('/api/subjects', isAuthenticated, (req, res) => {
  try {
    const { facultyId, departmentId } = req.query;
    
    if (facultyId) {
      // Return subjects by faculty (existing functionality)
      // In a real app, this would come from a database
      // For now, return mock data
      const subjects = [];

      res.status(200).json(subjects);
    } else if (departmentId) {
      // Filter subjects by department
      const filteredSubjects = subjects.filter(subject => 
        subject.departmentId === departmentId
      );
      console.log(`GET /api/subjects?departmentId=${departmentId} - Returning ${filteredSubjects.length} subjects for department`);
      res.status(200).json(filteredSubjects);
    } else {
      // Return all subjects for entity management
      console.log('GET /api/subjects - Returning all subjects:', subjects.length, 'subjects');
      console.log('Subjects array:', subjects);

      // Return the actual subjects array
      res.status(200).json(subjects);
    }
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get a single subject by ID
app.get('/api/subjects/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const subject = subjects.find(s => s.id === id);
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.status(200).json(subject);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Update a subject
app.put('/api/subjects/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, departmentId, units, lectureHours, labHours } = req.body;
    
    // Find the subject
    const subjectIndex = subjects.findIndex(subject => subject.id === id);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    // Validate input
    if (!name || !code || !departmentId) {
      return res.status(400).json({ error: 'Subject name, code, and department are required' });
    }
    
    // Check if department exists
    const department = departments.find(dept => dept.id === departmentId);
    if (!department) {
      return res.status(400).json({ error: 'Department not found' });
    }
    
    // Check if another subject with same code exists
    const existingSubject = subjects.find((subj, index) => 
      index !== subjectIndex && subj.code.toLowerCase() === code.toLowerCase()
    );
    
    if (existingSubject) {
      return res.status(409).json({ error: 'A subject with this code already exists' });
    }
    
    // Update subject
    subjects[subjectIndex] = {
      ...subjects[subjectIndex],
      name: name.trim(),
      code: code.trim().toUpperCase(),
      departmentId: departmentId,
      department: department.name,
      units: parseInt(units) || subjects[subjectIndex].units || 1,
      lectureHours: parseInt(lectureHours) || 0,
      labHours: parseInt(labHours) || 0,
      updatedAt: new Date().toISOString()
    };
    
    // Save the changes to file
    saveData();
    
    res.status(200).json({
      message: 'Subject updated successfully',
      subject: subjects[subjectIndex]
    });
    
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete a subject
app.delete('/api/subjects/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    console.log('DELETE /api/subjects - Deleting subject:', id);
    
    // Find the subject index
    const subjectIndex = subjects.findIndex(subject => subject.id === id);
    if (subjectIndex === -1) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    // Remove the subject
    const deletedSubject = subjects.splice(subjectIndex, 1)[0];
    console.log('Subject deleted:', deletedSubject);
    
    // Save the changes to file
    saveData();
    
    res.status(200).json({
      message: 'Subject deleted successfully',
      subject: deletedSubject
    });
    
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// Create a new subject
app.post('/api/subjects', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  console.log('POST /api/subjects endpoint called');
  console.log('Request body:', req.body);
  try {
    const { name, code, departmentId, units = 1, lectureHours = 0, labHours = 0 } = req.body;
    console.log('Extracted data:', { name, code, departmentId, units, lectureHours, labHours });
    
    // Validate input
    if (!name || !code || !departmentId) {
      return res.status(400).json({ error: 'Subject name, code, and department are required' });
    }
    
    // Check if department exists
    const department = departments.find(dept => dept.id === departmentId);
    if (!department) {
      return res.status(400).json({ error: 'Department not found' });
    }
    
    // Check if subject with same code already exists
    const existingSubject = subjects.find(subj => 
      subj.code.toLowerCase() === code.toLowerCase()
    );
    
    if (existingSubject) {
      return res.status(409).json({ error: 'A subject with this code already exists' });
    }
    
    // Create new subject
    const newSubject = {
      id: `subj${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      departmentId: departmentId,
      department: department.name,
      units: parseInt(units) || 1,
      lectureHours: parseInt(lectureHours) || 0,
      labHours: parseInt(labHours) || 0,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };
    
    subjects.push(newSubject);
    console.log('Subject added to array. Total subjects now:', subjects.length);
    console.log('New subject:', newSubject);
    
    // Save the changes to file
    saveData();
    console.log('Data saved to file');
    
    res.status(201).json({
      message: 'Subject created successfully',
      subject: newSubject
    });
    
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Return approved users (protected)
app.get('/api/users/approved', verifyToken, (req, res) => {
  try {
    const approved = users.filter(u => (u.status || '').toLowerCase() === 'approved');
    // Return minimal safe fields
    const safe = approved.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role || 'user',
      department: u.department || 'Not assigned',
      status: u.status || 'approved'
    }));
    res.json({ users: safe });
  } catch (e) {
    console.error('Error getting approved users:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a user (currently supports role change). Protected
app.patch('/api/users/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { role, departmentId } = req.body;

    const allowedRoles = ['superadmin', 'admin', 'user', 'faculty'];
    if (role && !allowedRoles.includes(String(role).toLowerCase())) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ message: 'User not found' });

    // Prevent changing built-in superadmin away from superadmin inadvertently
    if (users[idx].email === 'superadmin@school.edu' && role && role !== 'superadmin') {
      return res.status(400).json({ message: 'Cannot change role of built-in superadmin' });
    }

    if (role) users[idx].role = role;
    if (departmentId) {
      const dept = departments.find(d => String(d.id) === String(departmentId));
      if (dept) {
        users[idx].departmentId = dept.id;
        users[idx].department = dept.name;
      }
    }

    saveData();
    const u = users[idx];
    res.json({
      message: 'User updated',
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        department: u.department || 'Not assigned',
        status: u.status || 'approved'
      }
    });
  } catch (e) {
    console.error('Error updating user:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a user permanently (protected)
app.delete('/api/users/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const idx = users.findIndex(u => String(u.id) === String(id));
    if (idx === -1) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting built-in superadmin
    if (users[idx].email === 'superadmin@school.edu') {
      return res.status(400).json({ message: 'Cannot delete built-in superadmin' });
    }

    users.splice(idx, 1);
    saveData();
    res.json({ message: 'User deleted' });
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test endpoint - creates a test user immediately
app.post('/api/test/create-user', (req, res) => {
  const testUser = {
    id: uuidv4(),
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: '$2b$10$rQZ8K9vX2mN3pL4qR5sT6uV7wX8yZ9aA0bB1cC2dE3fF4gG5hH6iI7jJ8kK9lL0mM1nN2oO3pP4qQ5rR6sS7tT8uU9vV0wW1xX2yY3zZ',
    role: 'user',
    department: '',
    status: 'approved',
    verified: true,
    createdAt: new Date().toISOString()
  };
  
  // Remove existing test user if exists
  users = users.filter(u => u.email !== 'test@example.com');
  users.push(testUser);
  saveData();
  
  res.json({ 
    message: 'Test user created successfully',
    email: 'test@example.com',
    password: 'password123'
  });
});

// Fix superadmin password endpoint
app.post('/api/test/fix-superadmin', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('superadmin123', 10);
    
    // Find and update superadmin
    const superadminIndex = users.findIndex(u => u.email === 'superadmin@school.edu');
    if (superadminIndex !== -1) {
      users[superadminIndex].password = hashedPassword;
      saveData();
      res.json({ 
        message: 'Superadmin password fixed successfully',
        email: 'superadmin@school.edu',
        password: 'superadmin123',
        hash: hashedPassword
      });
    } else {
      res.status(404).json({ message: 'Superadmin not found' });
    }
  } catch (error) {
    console.error('Error fixing superadmin password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin endpoint to reset all data (superadmin only)
app.post('/api/admin/reset-data', isAuthenticated, isSuperAdmin, async (req, res) => {
    await handleResetData(req, res);
});

// Test endpoint to check if the route is working
app.post('/api/admin/test-clear', (req, res) => {
    res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// Admin endpoint to clear all system data (superadmin only)
app.post('/api/admin/clear-all-data', isAuthenticated, isSuperAdmin, async (req, res) => {
    await handleClearAllData(req, res);
});

// Import data endpoint
app.post('/api/admin/import-data', isAuthenticated, isSuperAdmin, async (req, res) => {
    await handleImportData(req, res);
});

// Handle the actual reset data logic
async function handleResetData(req, res) {
    try {
        // Define essential admin accounts to keep - only superadmin
        const essentialAccounts = [
            {
                id: 'superadmin-1',
                email: 'superadmin@school.edu',
                password: await bcrypt.hash('superadmin123', 10),
                firstName: 'Super',
                middleName: '',
                lastName: 'Admin',
                role: 'superadmin',
                status: 'approved',
                isVerified: true,
                departmentId: 'admin-dept',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            }
        ];

        console.log('Before reset - Total users:', users.length);
        console.log('Users before reset:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
        
        // Reset users array to only include essential accounts
        users = essentialAccounts;
        
        console.log('After reset - Total users:', users.length);
        console.log('Users after reset:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));
        
        // Save the updated data
        saveData();
        console.log('Data saved to file');
        
        // Clear any pending 2FA codes
        Object.keys(login2FACodes).forEach(key => delete login2FACodes[key]);
        console.log('2FA codes cleared');
        
        res.status(200).json({
            success: true,
            message: 'All user data has been reset. Only superadmin account has been preserved.',
            usersCount: users.length
        });
        
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while resetting data',
            error: error.message
        });
    }
}

// Handle the actual clear all data logic
async function handleClearAllData(req, res) {
    try {
        console.log('Starting comprehensive data clear...');
        
        // Define essential admin accounts to keep - only superadmin
        const essentialAccounts = [
            {
                id: 'superadmin-1',
                email: 'superadmin@school.edu',
                password: await bcrypt.hash('superadmin123', 10),
                firstName: 'Super',
                middleName: '',
                lastName: 'Admin',
                role: 'superadmin',
                status: 'approved',
                isVerified: true,
                departmentId: 'admin-dept',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            }
        ];

        console.log('Before clear - Total users:', users.length);
        console.log('Before clear - Total departments:', departments.length);
        console.log('Before clear - Total subjects:', subjects.length);
        
        // Clear all data arrays (only the ones that exist)
        users = [...essentialAccounts];
        departments = [];
        subjects = [];
        rooms = [];
        schedule = [];
        fixedSchedules = [];
        
        console.log('After clear - Total users:', users.length);
        console.log('After clear - Total departments:', departments.length);
        console.log('After clear - Total subjects:', subjects.length);
        console.log('After clear - Total rooms:', rooms.length);
        console.log('After clear - Total schedule events:', schedule.length);
        console.log('After clear - Total fixed schedules:', fixedSchedules.length);
        
        // Also clear auxiliary files that are not part of USERS_FILE bundle
        try {
            const coursesPath = path.join(__dirname, 'data', 'courses.json');
            if (fs.existsSync(coursesPath)) {
                fs.writeFileSync(coursesPath, JSON.stringify([], null, 2));
                console.log('courses.json cleared');
            }
        } catch (e) {
            console.warn('Could not clear courses.json:', e?.message);
        }
        try {
            const strandsPath = path.join(__dirname, 'data', 'strands.json');
            if (fs.existsSync(strandsPath)) {
                fs.writeFileSync(strandsPath, JSON.stringify([], null, 2));
                console.log('strands.json cleared');
            }
        } catch (e) {
            console.warn('Could not clear strands.json:', e?.message);
        }

        // Save the updated data (users, departments, subjects, rooms, schedule)
        saveData();
        console.log('All data saved to file');
        
        // Clear localStorage items (fixed schedules, classes, etc.)
        // Note: This will be handled client-side, but we log it here
        console.log('Note: Client-side localStorage (fixed schedules, classes) should be cleared by the frontend');
        
        // Clear any pending 2FA codes safely
        try {
            if (login2FACodes && typeof login2FACodes === 'object') {
                Object.keys(login2FACodes).forEach(key => delete login2FACodes[key]);
                console.log('2FA codes cleared');
            } else {
                console.log('No 2FA codes to clear');
            }
        } catch (faError) {
            console.warn('Warning: Could not clear 2FA codes:', faError.message);
        }
        
        res.status(200).json({
            success: true,
            message: 'All system data has been cleared successfully. Only superadmin account has been preserved.',
            clearedData: {
                users: users.length,
                departments: departments.length,
                subjects: subjects.length,
                rooms: rooms.length,
                schedule: schedule.length
            }
        });
        
    } catch (error) {
        console.error('Error clearing all data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'An error occurred while clearing all data',
            error: error.message
        });
    }
}

// Handle import data logic
async function handleImportData(req, res) {
    try {
        console.log('Starting data import...');
        const importData = req.body;
        
        if (!importData || typeof importData !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid import data format'
            });
        }

        // Preserve superadmin account
        const superAdminAccount = users.find(u => u.role === 'superadmin' && u.email === 'superadmin@school.edu');
        
        // Import users (merge with existing, but preserve superadmin)
        if (importData['/api/users'] && Array.isArray(importData['/api/users'])) {
            const importedUsers = importData['/api/users'];
            // Filter out superadmin from imported data to avoid duplicates
            const filteredUsers = importedUsers.filter(u => !(u.role === 'superadmin' && u.email === 'superadmin@school.edu'));
            
            // Create a copy of existing users for reference
            const existingUsers = [...users];
            
            // Start with superadmin if it exists, otherwise empty array
            const newUsers = superAdminAccount ? [superAdminAccount] : [];
            
            // Process each imported user
            filteredUsers.forEach(importedUser => {
                // Find existing user by email or id in the existing users array
                const existingUser = existingUsers.find(u => 
                    (u.email === importedUser.email) || (u.id === importedUser.id)
                );
                
                if (existingUser) {
                    // Update existing user, preserving important fields like password hash
                    const updatedUser = {
                        ...existingUser,
                        ...importedUser,
                        // Preserve password hash if backup doesn't have it (backup is sanitized)
                        password: importedUser.password || existingUser.password,
                        // Preserve verified status if backup doesn't have it
                        verified: importedUser.verified !== undefined ? importedUser.verified : existingUser.verified,
                        // CRITICAL: Ensure status is preserved from backup (this is the main fix)
                        // Prioritize imported status, fallback to existing, then default to 'pending'
                        status: (importedUser.status !== undefined && importedUser.status !== null) 
                            ? importedUser.status 
                            : (existingUser.status || 'pending'),
                        // Preserve departmentId if backup doesn't have it
                        departmentId: importedUser.departmentId !== undefined ? importedUser.departmentId : existingUser.departmentId
                    };
                    newUsers.push(updatedUser);
                } else {
                    // New user - add with default values for missing fields
                    newUsers.push({
                        ...importedUser,
                        // Set defaults for fields that might be missing from backup
                        password: importedUser.password || '', // Will need to be reset if empty
                        verified: importedUser.verified !== undefined ? importedUser.verified : false,
                        // CRITICAL: Preserve status from backup
                        status: (importedUser.status !== undefined && importedUser.status !== null) 
                            ? importedUser.status 
                            : 'pending',
                        departmentId: importedUser.departmentId || null
                    });
                }
            });
            
            users = newUsers;
            console.log(`Imported ${filteredUsers.length} users (status preserved from backup)`);
        }

        // Import pending users (these should already be in /api/users, but handle separately if needed)
        if (importData['/api/pending-users'] && Array.isArray(importData['/api/pending-users'])) {
            const pendingUsers = importData['/api/pending-users'];
            // Add pending users to main users array if not already present
            pendingUsers.forEach(pu => {
                const existingUserIndex = users.findIndex(u => u.id === pu.id || u.email === pu.email);
                if (existingUserIndex >= 0) {
                    // Update existing user's status if it's pending in the backup
                    if (pu.status === 'pending') {
                        users[existingUserIndex].status = 'pending';
                    }
                } else {
                    // Add new pending user
                    users.push({
                        ...pu,
                        password: pu.password || '',
                        verified: pu.verified !== undefined ? pu.verified : false,
                        status: pu.status || 'pending',
                        departmentId: pu.departmentId || null
                    });
                }
            });
            console.log(`Processed ${pendingUsers.length} pending users from backup`);
        }

        // Import departments
        if (importData['/api/departments'] && Array.isArray(importData['/api/departments'])) {
            departments = importData['/api/departments'];
            console.log(`Imported ${departments.length} departments`);
        }

        // Import subjects
        if (importData['/api/subjects'] && Array.isArray(importData['/api/subjects'])) {
            subjects = importData['/api/subjects'];
            console.log(`Imported ${subjects.length} subjects`);
        }

        // Import rooms
        if (importData['/api/rooms'] && Array.isArray(importData['/api/rooms'])) {
            rooms = importData['/api/rooms'];
            console.log(`Imported ${rooms.length} rooms`);
        }

        // Import schedule
        if (importData['/api/schedule'] && Array.isArray(importData['/api/schedule'])) {
            schedule = importData['/api/schedule'];
            console.log(`Imported ${schedule.length} schedule events`);
        }

        // Import courses and strands if they exist in separate files
        const COURSES_FILE = path.join(__dirname, 'data', 'courses.json');
        const STRANDS_FILE = path.join(__dirname, 'data', 'strands.json');
        
        if (importData['/api/courses'] && Array.isArray(importData['/api/courses'])) {
            try {
                fs.writeFileSync(COURSES_FILE, JSON.stringify(importData['/api/courses'], null, 2));
                console.log(`Imported ${importData['/api/courses'].length} courses`);
            } catch (e) {
                console.warn('Could not write courses file:', e);
            }
        }

        if (importData['/api/strands'] && Array.isArray(importData['/api/strands'])) {
            try {
                fs.writeFileSync(STRANDS_FILE, JSON.stringify(importData['/api/strands'], null, 2));
                console.log(`Imported ${importData['/api/strands'].length} strands`);
            } catch (e) {
                console.warn('Could not write strands file:', e);
            }
        }

        // Import fixed schedules
        if (importData['/api/fixed-schedules'] && Array.isArray(importData['/api/fixed-schedules'])) {
            fixedSchedules = importData['/api/fixed-schedules'];
            console.log(`Imported ${fixedSchedules.length} fixed schedules`);
        }

        // Save all imported data
        saveData();
        console.log('Imported data saved to files');

        res.status(200).json({
            success: true,
            message: 'Data imported successfully',
            imported: {
                users: users.length,
                departments: departments.length,
                subjects: subjects.length,
                rooms: rooms.length,
                schedule: schedule.length
            }
        });

    } catch (error) {
        console.error('Error importing data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'An error occurred while importing data',
            error: error.message
        });
    }
}

// Course management endpoints
app.get('/api/courses', isAuthenticated, (req, res) => {
    try {
        const { departmentId } = req.query;
        const courses = readJsonFile(path.join(__dirname, 'data', 'courses.json'), []);
        
        if (departmentId) {
            // Filter courses by department
            const filteredCourses = courses.filter(course => 
                course.departmentId === departmentId
            );
            console.log(`GET /api/courses?departmentId=${departmentId} - Returning ${filteredCourses.length} courses for department`);
            res.json(filteredCourses);
        } else {
            // Return all courses
            res.json(courses);
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ message: 'Failed to fetch courses' });
    }
});

// Get individual course
app.get('/api/courses/:id', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const courses = readJsonFile(path.join(__dirname, 'data', 'courses.json'), []);
        
        const course = courses.find(c => c.id === id);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        
        res.json(course);
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).json({ message: 'Failed to fetch course' });
    }
});

app.post('/api/courses', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { code, name, type, departmentId } = req.body;
        
        // Validate input
        if (!code || !name || !type || !departmentId) {
            return res.status(400).json({ message: 'Code, name, type, and department are required' });
        }

        // Check if department exists
        const department = departments.find(dept => dept.id === departmentId);
        if (!department) {
            return res.status(400).json({ message: 'Department not found' });
        }

        const courses = readJsonFile(path.join(__dirname, 'data', 'courses.json'), []);
        
        // Check if course with same code already exists
        if (courses.some(course => course.code === code)) {
            return res.status(409).json({ message: 'A course with this code already exists' });
        }

        const newCourse = {
            id: `course-${Date.now()}`,
            code,
            name,
            type,
            departmentId,
            department: department.name,
            departmentColor: department.color,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        courses.push(newCourse);
        fs.writeFileSync(path.join(__dirname, 'data', 'courses.json'), JSON.stringify(courses, null, 2));
        
        res.status(201).json(newCourse);
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ message: 'Failed to create course' });
    }
});

app.put('/api/courses/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, type, departmentId } = req.body;
        
        // Validate input
        if (!code || !name || !type || !departmentId) {
            return res.status(400).json({ message: 'Code, name, type, and department are required' });
        }

        // Check if department exists
        const department = departments.find(dept => dept.id === departmentId);
        if (!department) {
            return res.status(400).json({ message: 'Department not found' });
        }

        let courses = readJsonFile(path.join(__dirname, 'data', 'courses.json'), []);
        const courseIndex = courses.findIndex(c => c.id === id);
        
        if (courseIndex === -1) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if another course with the same code exists
        if (courses.some((course, index) => course.code === code && index !== courseIndex)) {
            return res.status(409).json({ message: 'A course with this code already exists' });
        }

        const updatedCourse = {
            ...courses[courseIndex],
            code,
            name,
            type,
            departmentId,
            department: department.name,
            departmentColor: department.color,
            updatedAt: new Date().toISOString()
        };

        courses[courseIndex] = updatedCourse;
        fs.writeFileSync(path.join(__dirname, 'data', 'courses.json'), JSON.stringify(courses, null, 2));
        
        res.json(updatedCourse);
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ message: 'Failed to update course' });
    }
});

app.delete('/api/courses/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { id } = req.params;
        let courses = readJsonFile(path.join(__dirname, 'data', 'courses.json'), []);
        
        const courseIndex = courses.findIndex(c => c.id === id);
        
        if (courseIndex === -1) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if the course is being used by any users or other entities
        // This is a simplified check - you might need to add more comprehensive checks
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '{}').users || [];
        const isInUse = users.some(user => user.courseId === id);
        
        if (isInUse) {
            return res.status(400).json({ 
                message: 'Cannot delete course as it is assigned to one or more users' 
            });
        }

        courses = courses.filter(course => course.id !== id);
        fs.writeFileSync(path.join(__dirname, 'data', 'courses.json'), JSON.stringify(courses, null, 2));
        
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ message: 'Failed to delete course' });
    }
});

// Strands endpoints (similar to courses but for strands/programs)
app.get('/api/strands', isAuthenticated, (req, res) => {
    try {
        const { departmentId } = req.query;
        
        // Use safe read function for strands
        const strandsPath = path.join(__dirname, 'data', 'strands.json');
        let strands = readJsonFile(strandsPath, []);
        
        if (departmentId) {
            // Filter strands by department
            const filteredStrands = strands.filter(strand => 
                strand.departmentId === departmentId
            );
            console.log(`GET /api/strands?departmentId=${departmentId} - Returning ${filteredStrands.length} strands for department`);
            res.status(200).json(filteredStrands);
            return;
        }
        
        // Return all strands
        res.status(200).json(strands);
    } catch (error) {
        console.error('Error fetching strands:', error);
        res.status(500).json({ message: 'Failed to fetch strands' });
    }
});

app.post('/api/strands', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { code, name, description, type, departmentId } = req.body;
        
        if (!code || !name) {
            return res.status(400).json({ message: 'Code and name are required' });
        }
        
        // Check if department exists (if provided)
        if (departmentId) {
            const department = departments.find(dept => dept.id === departmentId);
            if (!department) {
                return res.status(400).json({ message: 'Department not found' });
            }
        }
        
        const strandsPath = path.join(__dirname, 'data', 'strands.json');
        let strands = readJsonFile(strandsPath, []);
        
        // Check if strand with same code already exists
        if (strands.some(strand => strand.code === code)) {
            return res.status(409).json({ message: 'A strand with this code already exists' });
        }
        
        const newStrand = {
            id: `strand-${Date.now()}`,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description || '',
            type: type || 'Strand',
            departmentId: departmentId || null,
            department: departmentId ? departments.find(d => d.id === departmentId)?.name : null,
            createdAt: new Date().toISOString()
        };
        
        strands.push(newStrand);
        fs.writeFileSync(strandsPath, JSON.stringify(strands, null, 2));
        
        res.status(201).json(newStrand);
    } catch (error) {
        console.error('Error creating strand:', error);
        res.status(500).json({ message: 'Failed to create strand' });
    }
});

app.put('/api/strands/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, description, type, departmentId } = req.body;
        
        if (!code || !name) {
            return res.status(400).json({ message: 'Code and name are required' });
        }
        
        const strandsPath = path.join(__dirname, 'data', 'strands.json');
        let strands = readJsonFile(strandsPath, []);
        const strandIndex = strands.findIndex(s => s.id === id);
        
        if (strandIndex === -1) {
            return res.status(404).json({ message: 'Strand not found' });
        }
        
        // Check if another strand with the same code exists
        if (strands.some((strand, index) => strand.code === code && index !== strandIndex)) {
            return res.status(409).json({ message: 'A strand with this code already exists' });
        }
        
        const updatedStrand = {
            ...strands[strandIndex],
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description || '',
            type: type || 'Strand',
            departmentId: departmentId || strands[strandIndex].departmentId || null,
            department: departmentId ? departments.find(d => d.id === departmentId)?.name : strands[strandIndex].department || null,
            updatedAt: new Date().toISOString()
        };
        
        strands[strandIndex] = updatedStrand;
        fs.writeFileSync(strandsPath, JSON.stringify(strands, null, 2));
        
        res.status(200).json(updatedStrand);
    } catch (error) {
        console.error('Error updating strand:', error);
        res.status(500).json({ message: 'Failed to update strand' });
    }
});

app.delete('/api/strands/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        const strandsPath = path.join(__dirname, 'data', 'strands.json');
        let strands = readJsonFile(strandsPath, []);
        
        const strandIndex = strands.findIndex(s => s.id === id);
        if (strandIndex === -1) {
            return res.status(404).json({ message: 'Strand not found' });
        }
        
        strands = strands.filter(strand => strand.id !== id);
        fs.writeFileSync(strandsPath, JSON.stringify(strands, null, 2));
        
        res.status(200).json({ message: 'Strand deleted successfully' });
    } catch (error) {
        console.error('Error deleting strand:', error);
        res.status(500).json({ message: 'Failed to delete strand' });
    }
});

// Removed hardcoded admin password reset endpoint for security

// Fix user verification endpoint
app.post('/api/test/fix-verification', (req, res) => {
  try {
    // Find the user that was just approved
    const userIndex = users.findIndex(u => u.email === 'twoletterog@gmail.com');
    if (userIndex !== -1) {
      users[userIndex].verified = true;
      saveData();
      res.json({ 
        message: 'User verification fixed successfully',
        email: 'twoletterog@gmail.com',
        verified: true
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fixing user verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fix faculty department assignment (debug endpoint)
app.post('/api/debug/fix-faculty/:facultyId', isAuthenticated, isSuperAdmin, (req, res) => {
  try {
    const { facultyId } = req.params;
    console.log('Manual fix requested for faculty ID:', facultyId);

    const facultyIndex = users.findIndex(
      user => user.id === facultyId && user.departmentId
    );

    if (facultyIndex === -1) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }

    const faculty = users[facultyIndex];
    console.log('Before fix:', {
      id: faculty.id,
      email: faculty.email,
      role: faculty.role,
      status: faculty.status,
      departmentId: faculty.departmentId
    });

    // Fix the faculty member
    users[facultyIndex] = {
      ...users[facultyIndex],
      status: 'inactive',
      departmentId: null,
      department: null,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.id
    };

    console.log('After fix:', users[facultyIndex]);

    // Save the changes
    saveData();

    res.status(200).json({
      message: 'Faculty member fixed successfully',
      facultyId: facultyId,
      updatedFaculty: users[facultyIndex]
    });

  } catch (error) {
    console.error('Error fixing faculty:', error);
    res.status(500).json({ error: 'Failed to fix faculty member' });
  }
});

// Test email route (for testing email functionality)
app.post('/api/test-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject || 'Test Email from Scheduling System',
      html: message || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1A609B;">Test Email</h2>
          <p>This is a test email from your scheduling system.</p>
          <p>If you received this email, your Nodemailer configuration is working correctly!</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email Details:</strong></p>
            <p>From: ${process.env.EMAIL_USER}</p>
            <p>To: ${to}</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      details: {
        to: to,
        subject: mailOptions.subject,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email', 
      error: error.message,
      details: {
        emailService: process.env.EMAIL_SERVICE,
        emailUser: process.env.EMAIL_USER ? 'Configured' : 'Not configured',
        emailPass: process.env.EMAIL_PASS ? 'Configured' : 'Not configured'
      }
    });
  }
});

// Rooms endpoints
app.get('/api/rooms', isAuthenticated, (req, res) => {
  try {
    return res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

app.post('/api/rooms', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { name, capacity, departmentId, priority, exclusive } = req.body || {};
    
    // Validate input
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Room name is required' });
    }
    if (!capacity || parseInt(capacity) < 1) {
      return res.status(400).json({ message: 'Valid capacity is required' });
    }
    // departmentId is optional; rooms can be general-purpose
    
    const normalizedName = String(name).trim();
    const cap = parseInt(capacity, 10);

    if (rooms.some(r => r.name && r.name.toLowerCase() === normalizedName.toLowerCase())) {
      return res.status(409).json({ message: 'A room with this name already exists' });
    }

    // Find department name if provided
    const department = departmentId ? departments.find(d => d.id === departmentId) : null;
    const departmentName = department ? department.name : null;

    const newRoom = {
      id: uuidv4(),
      name: normalizedName,
      capacity: cap,
      departmentId: priority ? departmentId : null,
      department: priority ? departmentName : null,
      priority: Boolean(priority),
      exclusive: Boolean(exclusive && priority), // Exclusive only makes sense if priority is enabled
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    rooms.push(newRoom);
    saveData();
    return res.status(201).json(newRoom);
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ message: 'Failed to create room' });
  }
});

// Get individual room
app.get('/api/rooms/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const room = rooms.find(r => r.id === id);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ message: 'Failed to fetch room' });
  }
});

// Update room
app.put('/api/rooms/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity, departmentId, priority, exclusive } = req.body;
    
    // Validate input
    if (!name || !capacity) {
      return res.status(400).json({ message: 'Name and capacity are required' });
    }
    
    const roomIndex = rooms.findIndex(r => r.id === id);
    if (roomIndex === -1) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if another room with the same name exists
    if (rooms.some((room, index) => room.name.toLowerCase() === name.toLowerCase() && index !== roomIndex)) {
      return res.status(409).json({ message: 'A room with this name already exists' });
    }
    
    // Find department name if provided
    const department = departmentId ? departments.find(d => d.id === departmentId) : null;
    const departmentName = department ? department.name : null;
    
    const updatedRoom = {
      ...rooms[roomIndex],
      name: name.trim(),
      capacity: parseInt(capacity),
      departmentId: priority ? departmentId : null,
      department: priority ? departmentName : null,
      priority: Boolean(priority),
      exclusive: Boolean(exclusive && priority), // Exclusive only makes sense if priority is enabled
      updatedAt: new Date().toISOString()
    };
    
    rooms[roomIndex] = updatedRoom;
    saveData();
    
    res.json(updatedRoom);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ message: 'Failed to update room' });
  }
});

// Delete room
app.delete('/api/rooms/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const roomIndex = rooms.findIndex(r => r.id === id);
    
    if (roomIndex === -1) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    const deletedRoom = rooms.splice(roomIndex, 1)[0];
    saveData();
    
    res.json({
      message: 'Room deleted successfully',
      room: deletedRoom
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Failed to delete room' });
  }
});

// Schedule Management Endpoints

// Get schedule (all users can view)
app.get('/api/schedule', isAuthenticated, (req, res) => {
  try {
    console.log('Fetching schedule, events count:', schedule.length);
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ message: 'Failed to fetch schedule' });
  }
});

// Save schedule (only admins and superadmins)
app.post('/api/schedule', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { events } = req.body;
    console.log('Saving schedule, events count:', events ? events.length : 0);
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ message: 'Events must be an array' });
    }
    
    // Replace the entire schedule
    schedule = events;
    saveData();
    
    console.log('Schedule saved successfully, total events:', schedule.length);
    res.status(200).json({ 
      message: 'Schedule saved successfully',
      eventCount: schedule.length
    });
  } catch (error) {
    console.error('Error saving schedule:', error);
    res.status(500).json({ message: 'Failed to save schedule' });
  }
});

// Get unassigned schedules (schedules without valid faculty members)
app.get('/api/schedule/unassigned', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    // Get all current faculty member IDs
    const facultyIds = new Set();
    users.forEach(user => {
      if (user.departmentId && user.departmentId !== 'pending') {
        facultyIds.add(user.id);
      }
    });
    
    // Find schedules that don't have a valid faculty member
    const unassignedSchedules = schedule.filter(event => {
      const extendedProps = event.extendedProps || {};
      const facultyId = extendedProps.facultyId;
      const faculty = extendedProps.faculty;
      
      // Schedule is unassigned if:
      // 1. No facultyId, OR
      // 2. facultyId doesn't match any current faculty member, OR
      // 3. Has faculty name but no matching facultyId
      if (!facultyId) {
        return true; // No faculty ID assigned
      }
      
      if (!facultyIds.has(facultyId)) {
        return true; // Faculty ID doesn't exist anymore
      }
      
      return false;
    });
    
    res.status(200).json(unassignedSchedules);
  } catch (error) {
    console.error('Error fetching unassigned schedules:', error);
    res.status(500).json({ message: 'Failed to fetch unassigned schedules' });
  }
});

// Update schedule faculty assignment
app.put('/api/schedule/assign-faculty', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { scheduleIds, facultyId } = req.body;
    
    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return res.status(400).json({ error: 'Schedule IDs array is required' });
    }
    
    if (!facultyId) {
      return res.status(400).json({ error: 'Faculty ID is required' });
    }
    
    // Find the faculty member
    const facultyMember = users.find(user => user.id === facultyId && user.departmentId);
    if (!facultyMember) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    
    const facultyName = `${facultyMember.firstName || ''} ${facultyMember.lastName || ''}`.trim() || facultyMember.email || 'Faculty';
    
    // Update schedules
    let updatedCount = 0;
    schedule.forEach(event => {
      if (scheduleIds.includes(event.id)) {
        if (!event.extendedProps) {
          event.extendedProps = {};
        }
        event.extendedProps.facultyId = facultyId;
        event.extendedProps.faculty = facultyName;
        updatedCount++;
      }
    });
    
    // Save changes
    saveData();
    
    res.status(200).json({
      message: `Successfully assigned ${updatedCount} schedule(s) to faculty member`,
      updatedCount
    });
  } catch (error) {
    console.error('Error assigning faculty to schedules:', error);
    res.status(500).json({ message: 'Failed to assign faculty to schedules' });
  }
});

// Fixed Schedules Management Endpoints

// Get fixed schedules (all users can view)
app.get('/api/fixed-schedules', isAuthenticated, (req, res) => {
  try {
    console.log('Fetching fixed schedules, count:', fixedSchedules.length);
    res.status(200).json(fixedSchedules);
  } catch (error) {
    console.error('Error fetching fixed schedules:', error);
    res.status(500).json({ message: 'Failed to fetch fixed schedules' });
  }
});

// Save fixed schedules (only admins and superadmins)
app.post('/api/fixed-schedules', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { schedules } = req.body;
    console.log('Saving fixed schedules, count:', schedules ? schedules.length : 0);
    
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ message: 'Schedules must be an array' });
    }
    
    // Replace the entire fixed schedules array
    fixedSchedules = schedules;
    saveData();
    
    console.log('Fixed schedules saved successfully, total:', fixedSchedules.length);
    res.status(200).json({ 
      message: 'Fixed schedules saved successfully',
      count: fixedSchedules.length
    });
  } catch (error) {
    console.error('Error saving fixed schedules:', error);
    res.status(500).json({ message: 'Failed to save fixed schedules' });
  }
});

// Delete a fixed schedule (only admins and superadmins)
app.delete('/api/fixed-schedules/:id', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const index = fixedSchedules.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Fixed schedule not found' });
    }
    
    fixedSchedules.splice(index, 1);
    saveData();
    
    res.status(200).json({ message: 'Fixed schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting fixed schedule:', error);
    res.status(500).json({ message: 'Failed to delete fixed schedule' });
  }
});

// Clear schedule (only admins and superadmins)
app.delete('/api/schedule', isAuthenticated, isAdminOrSuperAdmin, (req, res) => {
  try {
    console.log('Clearing schedule');
    schedule = [];
    saveData();
    
    res.status(200).json({ message: 'Schedule cleared successfully' });
  } catch (error) {
    console.error('Error clearing schedule:', error);
    res.status(500).json({ message: 'Failed to clear schedule' });
  }
});

// Default route
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

