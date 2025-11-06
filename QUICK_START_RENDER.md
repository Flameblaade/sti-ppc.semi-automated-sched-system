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

**Option 1: Generate a new one (Recommended)**
1. Open your terminal/command prompt in your project folder
2. Run this command:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Copy the output** (it will be a long random string like `a1b2c3d4e5f6789...`)
4. In Render's Environment Variables:
   - **Variable name:** `JWT_SECRET`
   - **Value:** Paste the copied string (the output from the command)

**Option 2: Use your existing one**
If you already have a `JWT_SECRET` in your `.env` file, you can use that same value:
- **Variable name:** `JWT_SECRET`
- **Value:** Copy the value from your `.env` file (the part after `JWT_SECRET=`)

**Important:** Never share your JWT_SECRET publicly! It should be a long, random string.

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

After making changes to your code:

### Step 1: Stage Your Changes
```bash
git add .
```
This adds all modified files to be committed.

### Step 2: Commit Your Changes
```bash
git commit -m "Description of your changes"
```
Examples:
- `git commit -m "Fix login redirect issue"`
- `git commit -m "Update CORS settings"`
- `git commit -m "Add new feature"`

### Step 3: Push to GitHub
```bash
git push
```
If this is your first push, use:
```bash
git push -u origin main
```

### Step 4: Wait for Auto-Deploy
- Render will automatically detect the push
- Check your Render dashboard - you'll see a new deployment starting
- Wait 2-5 minutes for deployment to complete
- Your changes will be live!

**Render will automatically redeploy! ✨**

---

## 📤 First Time Pushing to GitHub?

If you haven't pushed your code yet, follow these steps:

### 1. Initialize Git (if not done)
```bash
git init
```

### 2. Add All Files
```bash
git add .
```

### 3. Create First Commit
```bash
git commit -m "Initial commit - ready for deployment"
```

### 4. Connect to GitHub
```bash
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual values
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**Note:** You'll need to create the repository on GitHub first (see Step 1 in the main guide above).

