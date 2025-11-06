# 🔧 Fix SMTP Connection Timeout on Render

You're getting `ETIMEDOUT` - this means Render can't connect to Gmail's SMTP server. Here are solutions:

---

## 🎯 Solution 1: Try Different Port (Quick Fix)

Render sometimes blocks port 587. Try port 465 with SSL:

### In Render Environment Variables, add:

**Variable:** `EMAIL_PORT`  
**Value:** `465`

**Variable:** `EMAIL_USE_TLS`  
**Value:** `false`

Then redeploy. The code will automatically use port 465 with SSL.

---

## 🎯 Solution 2: Use SendGrid Instead (Recommended for Cloud)

Gmail SMTP often has issues on cloud platforms. **SendGrid is more reliable** and has a free tier.

### Step 1: Sign Up for SendGrid

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)
3. Verify your email
4. Go to **Settings** → **API Keys**
5. Click **"Create API Key"**
6. Name it: `Render Deployment`
7. Give it **"Full Access"** permissions
8. **Copy the API key** (you'll only see it once!)

### Step 2: Update Your Code

I'll need to update `server.js` to support SendGrid. For now, you can:

1. Install SendGrid:
   ```bash
   npm install @sendgrid/mail
   ```

2. Update environment variables in Render:
   - Remove: `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`
   - Add: `SENDGRID_API_KEY` = your SendGrid API key
   - Add: `SENDGRID_FROM_EMAIL` = your verified sender email

### Step 3: Update server.js

I can update the code to use SendGrid if you want. It's more reliable than Gmail on cloud platforms.

---

## 🎯 Solution 3: Check Render Network Settings

Sometimes Render blocks outbound SMTP. Check:

1. Render Dashboard → Your Service → **Settings**
2. Look for **"Network"** or **"Outbound"** settings
3. Make sure SMTP ports (465, 587) are allowed

---

## 🎯 Solution 4: Use Gmail OAuth2 (More Complex)

OAuth2 is more reliable but requires more setup:

1. Create Google Cloud Project
2. Enable Gmail API
3. Create OAuth2 credentials
4. Update code to use OAuth2

**This is more complex but more reliable.**

---

## ⚡ Quick Test: Try Port 465

**Fastest fix - update Render environment:**

1. Render Dashboard → Environment tab
2. Add new variable:
   - **Name:** `EMAIL_PORT`
   - **Value:** `465`
3. Save and redeploy
4. Test again

---

## 📊 Comparison

| Solution | Difficulty | Reliability | Cost |
|----------|-----------|-------------|------|
| **Port 465** | Easy | Medium | Free |
| **SendGrid** | Medium | High | Free (100/day) |
| **OAuth2** | Hard | High | Free |
| **Mailgun** | Medium | High | Free (100/day) |

---

## 🎯 My Recommendation

**For immediate fix:** Try port 465 first (easiest)

**For long-term:** Switch to SendGrid (more reliable on cloud platforms)

---

**Want me to update the code to support SendGrid?** It's a better solution for cloud deployments! 🚀

