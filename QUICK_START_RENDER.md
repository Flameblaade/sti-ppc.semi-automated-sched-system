# ⚡ Quick Start - Deploy to Render in 5 Steps

Follow these steps to deploy your scheduling system to Render:

## ✅ Pre-Deployment Checklist

Before starting, make sure you have:
- [ ] GitHub account created
- [ ] Git installed on your computer
- [ ] Your project code ready

---

## 🚀 5 Simple Steps

### Step 1: Push to GitHub (5 minutes)

```bash
# In your project folder, open terminal and run:

git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**Don't have a GitHub repo yet?**
1. Go to [github.com](https://github.com) → New Repository
2. Create a new repo (don't initialize with README)
3. Copy the repo URL and use it in the commands above

---

### Step 2: Sign Up on Render (2 minutes)

1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (click "Continue with GitHub")
4. Authorize Render to access your repositories

---

### Step 3: Create Web Service (3 minutes)

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `scheduling-system` (or any name)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free`

---

### Step 4: Add Environment Variables (5 minutes)

Click **"Add Environment Variable"** and add these:

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `3000` | Render will override this |
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | *(generate random string)* | See below |
| `EMAIL_SERVICE` | `gmail` | Or your email service |
| `EMAIL_USER` | `your-email@gmail.com` | Your email |
| `EMAIL_PASS` | `your-app-password` | Gmail app password |
| `CLIENT_URL` | `https://your-app.onrender.com` | Update after deployment |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Use that as `EMAIL_PASS`

---

### Step 5: Deploy! (2 minutes)

1. Scroll down and click **"Create Web Service"**
2. Wait 2-5 minutes for deployment
3. Copy your app URL (e.g., `https://scheduling-system-xxxx.onrender.com`)
4. Go back to Environment Variables
5. Update `CLIENT_URL` to your actual Render URL
6. Save - Render will auto-redeploy

---

## 🎉 Done!

Your app is now live at: `https://your-app-name.onrender.com`

---

## 📝 Important Notes

- **Free tier:** App sleeps after 15 min inactivity (wakes on first request)
- **Data storage:** Free tier uses ephemeral storage (data resets on restart)
- **Auto-deploy:** Every time you `git push`, Render automatically redeploys!

---

## 🆘 Need Help?

See the full guide: `RENDER_DEPLOYMENT_GUIDE.md`

---

## 🔄 Updating Your App

After making changes:

```bash
git add .
git commit -m "Your changes"
git push
```

Render will automatically redeploy! ✨

