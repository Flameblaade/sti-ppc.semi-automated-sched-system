# 🔧 Fix Email Not Sending Issue

If OTP emails aren't being sent, follow these steps:

## ✅ Step 1: Check Render Environment Variables

1. Go to your **Render Dashboard**
2. Click on your service (scheduling system)
3. Go to **"Environment"** tab
4. Verify these variables are set:

   | Variable | Value | Example |
   |----------|-------|---------|
   | `EMAIL_SERVICE` | `gmail` | `gmail` |
   | `EMAIL_USER` | Your Gmail address | `your-email@gmail.com` |
   | `EMAIL_PASS` | Gmail App Password | `abcd efgh ijkl mnop` |

**Important:** `EMAIL_PASS` must be a **Gmail App Password**, NOT your regular Gmail password!

---

## ✅ Step 2: Get Gmail App Password

### If you DON'T have 2-Step Verification enabled:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **"2-Step Verification"**
3. Follow the setup process

### Generate App Password:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **"2-Step Verification"** (must be enabled)
3. Scroll down to **"App passwords"**
4. Click **"Select app"** → Choose **"Mail"**
5. Click **"Select device"** → Choose **"Other (Custom name)"**
6. Type: `Render Deployment`
7. Click **"Generate"**
8. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)
9. **Remove spaces** when adding to Render (use: `abcdefghijklmnop`)

---

## ✅ Step 3: Update Render Environment Variables

1. In Render dashboard → Your service → **Environment** tab
2. Find `EMAIL_PASS`
3. **Replace** with your 16-character app password (no spaces)
4. Click **"Save Changes"**
5. Render will automatically redeploy

---

## ✅ Step 4: Check Server Logs

After redeploying, check your Render logs:

1. In Render dashboard → Your service → **"Logs"** tab
2. Look for these messages:

   **✅ If working:**
   ```
   ✅ Email server is ready to send messages
   📧 Email configured for: your-email@gmail.com
   ```

   **❌ If not working:**
   ```
   ❌ Email transporter verification failed: ...
   ⚠️  Email not configured: EMAIL_USER or EMAIL_PASS not set
   ```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Authentication failed" (EAUTH error)

**Problem:** Wrong password or not using app password

**Fix:**
- Make sure you're using a **Gmail App Password**, not your regular password
- Verify 2-Step Verification is enabled
- Regenerate the app password and update `EMAIL_PASS` in Render

### Issue 2: "Email not configured" warning

**Problem:** Environment variables not set

**Fix:**
- Go to Render → Environment tab
- Add `EMAIL_USER` and `EMAIL_PASS`
- Make sure they're spelled correctly (case-sensitive)
- Save and wait for redeploy

### Issue 3: "Connection failed" (ECONNECTION error)

**Problem:** Network or Gmail blocking connection

**Fix:**
- Check if Gmail is blocking "less secure apps" (shouldn't be needed with app passwords)
- Try regenerating app password
- Check Render logs for more details

### Issue 4: Emails go to spam

**Problem:** Gmail marking emails as spam

**Fix:**
- Check spam/junk folder
- Add `your-email@gmail.com` to contacts
- This is normal for automated emails

---

## 🧪 Test Email Configuration

After setting up, test by:

1. **Sign up** a new account
2. **Check Render logs** for email sending status
3. **Check your email** (and spam folder) for verification code

---

## 📝 Quick Checklist

- [ ] 2-Step Verification enabled on Gmail
- [ ] Gmail App Password generated
- [ ] `EMAIL_USER` set in Render (your Gmail address)
- [ ] `EMAIL_PASS` set in Render (16-character app password, no spaces)
- [ ] `EMAIL_SERVICE` set to `gmail` in Render
- [ ] Render service redeployed after changes
- [ ] Checked Render logs for email status

---

## 🆘 Still Not Working?

1. **Check Render logs** - Look for error messages with ❌
2. **Verify environment variables** - Make sure they're saved correctly
3. **Try regenerating app password** - Sometimes they expire
4. **Check Gmail account** - Make sure it's not locked or restricted

---

## 💡 Alternative: Use SendGrid (More Reliable)

If Gmail continues to have issues, consider using SendGrid (free tier available):

1. Sign up at [SendGrid](https://sendgrid.com)
2. Get API key
3. Update environment variables:
   - `EMAIL_SERVICE=smtp`
   - `EMAIL_HOST=smtp.sendgrid.net`
   - `EMAIL_PORT=587`
   - `EMAIL_USER=apikey`
   - `EMAIL_PASS=your-sendgrid-api-key`

---

**After fixing, push your code and test again!** 🚀

