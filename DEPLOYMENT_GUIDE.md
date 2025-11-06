# 🚀 Deployment Guide - Run Your App 24/7

This guide will help you deploy your scheduling system so it runs automatically without needing to type `npm start` each time.

## 📋 What You Need Before Deploying

1. **GitHub Account** (free) - for hosting your code
2. **Hosting Service Account** - choose one below
3. **Domain Name** (optional) - from Hostinger or any domain provider

---

## 🎯 **EASIEST OPTION: Railway.app** (Recommended for Beginners)

Railway is the easiest way to deploy Node.js apps. **Free tier available!**

### Step 1: Push Your Code to GitHub

1. Create a GitHub account at [github.com](https://github.com)
2. Install Git if you haven't: [git-scm.com](https://git-scm.com)
3. Open terminal in your project folder and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Create `.gitignore` File

Create a `.gitignore` file in your project root:

```gitignore
# Dependencies
node_modules/

# Environment variables (IMPORTANT - don't commit secrets!)
.env
.env.local

# Data files (you'll recreate these on the server)
data/*.json

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
```

### Step 3: Add `Procfile` (for Railway)

Create a file named `Procfile` (no extension) in your project root:

```
web: node server.js
```

This tells Railway how to start your app.

### Step 4: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (free)
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your repository
6. Railway will automatically detect it's a Node.js app and start deploying!

### Step 5: Set Environment Variables

In Railway dashboard:
1. Click on your project
2. Go to **"Variables"** tab
3. Add these environment variables:

```
PORT=3000
JWT_SECRET=your-super-secret-random-string-here-make-it-long
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
CLIENT_URL=https://your-app-name.railway.app
NODE_ENV=production
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 6: Your App is Live! 🎉

Railway will give you a URL like: `https://your-app-name.up.railway.app`

**Your app now runs 24/7 automatically!** No need to type `npm start` anymore.

---

## 🌐 **ALTERNATIVE: Render.com** (Also Easy)

### Step 1-2: Same as Railway (GitHub setup)

### Step 3: Deploy to Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name:** Your app name
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (or choose paid)

6. Add environment variables (same as Railway above)

### Step 4: Deploy!

Click **"Create Web Service"** - Render will deploy your app automatically!

---

## 🖥️ **HOSTINGER VPS OPTION** (If You Prefer Hostinger)

If you want to use Hostinger VPS:

### Step 1: Get Hostinger VPS

1. Buy a VPS plan from Hostinger
2. They'll give you SSH access

### Step 2: Connect to Server

```bash
ssh root@your-server-ip
```

### Step 3: Install Node.js

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node -v
npm -v
```

### Step 4: Install PM2 (Keeps App Running)

```bash
npm install -g pm2
```

PM2 keeps your app running even after you close the terminal!

### Step 5: Upload Your Code

**Option A: Using Git**
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
```

**Option B: Using FTP/SFTP**
- Use FileZilla or similar
- Upload all files to `/var/www/your-app`

### Step 6: Create `.env` File

```bash
nano .env
```

Add your environment variables (same as Railway above).

### Step 7: Start with PM2

```bash
pm2 start server.js --name "scheduling-app"
pm2 save
pm2 startup
```

**Done!** Your app now runs 24/7 and auto-restarts if it crashes.

---

## 🔧 **UPDATING YOUR CODE FOR PRODUCTION**

### Update CORS Settings

Your `server.js` already handles this, but make sure your `CLIENT_URL` matches your frontend URL.

### Update Frontend API URLs

If you're hosting frontend separately, update API calls to use your production URL.

---

## 🌍 **CONNECTING YOUR DOMAIN (Optional)**

### If Using Railway/Render:

1. Buy domain from Hostinger
2. In Railway/Render dashboard:
   - Go to **"Settings"** → **"Domains"**
   - Add your custom domain
   - Follow DNS instructions
3. In Hostinger DNS settings, add the provided CNAME record

### If Using Hostinger VPS:

1. Point your domain's A record to your VPS IP
2. Set up Nginx as reverse proxy (optional but recommended)

---

## ✅ **DEPLOYMENT CHECKLIST**

Before going live:

- [ ] Code pushed to GitHub
- [ ] `.gitignore` includes `.env` and `node_modules`
- [ ] Environment variables set
- [ ] JWT_SECRET is strong and unique
- [ ] `CLIENT_URL` matches your frontend URL
- [ ] Test your app on the production URL
- [ ] Verify email sending works
- [ ] Check that data saves correctly

---

## 🐛 **TROUBLESHOOTING**

### App Won't Start

1. Check logs in Railway/Render dashboard
2. Verify all environment variables are set
3. Make sure `Procfile` exists (Railway) or start command is correct

### Data Not Saving

1. Verify `data/` folder has write permissions
2. Check server logs for errors
3. Ensure file system is writable

### Email Not Working

1. Verify Gmail app password is correct
2. Check if 2FA is enabled on Gmail account
3. Try alternative email service (SendGrid, Mailgun)

---

## 📞 **NEED HELP?**

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- PM2 Docs: https://pm2.keymetrics.io/docs/

---

## 🎉 **YOU'RE DONE!**

Once deployed, your app will:
- ✅ Start automatically when the server reboots
- ✅ Restart if it crashes
- ✅ Run 24/7 without manual intervention
- ✅ Be accessible from anywhere in the world

No more `npm start` - it just runs! 🚀


