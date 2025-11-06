# ✅ Final Deployment Checklist

Complete checklist to ensure everything is working properly.

---

## 🔒 Security (URGENT - Do First!)

### Exposed Credentials Fix
- [ ] Generated **NEW** Gmail app password
- [ ] Deleted **OLD** exposed app password from Google
- [ ] Removed `.env` from git history (run commands from `COPY_PASTE_COMMANDS.md`)
- [ ] Force pushed to GitHub (removes credentials from GitHub)
- [ ] Verified `.env` is NOT in repository: `git log --all --full-history -- .env` (should return nothing)

---

## 📧 Email Configuration

### Gmail Setup
- [ ] 2-Step Verification enabled on Gmail
- [ ] New Gmail app password generated
- [ ] App password copied (16 characters, no spaces)

### Render Environment Variables
- [ ] `EMAIL_USER` = your Gmail address
- [ ] `EMAIL_PASS` = new app password (no spaces)
- [ ] `EMAIL_SERVICE` = `gmail`
- [ ] `EMAIL_PORT` = `465` (to fix timeout)
- [ ] Test email sending (sign up or login)

---

## 🚀 Render Deployment

### Environment Variables (All Required)
- [ ] `PORT` = `3000` (Render sets this automatically)
- [ ] `NODE_ENV` = `production`
- [ ] `JWT_SECRET` = (generated random string)
- [ ] `CLIENT_URL` = `https://your-app-name.onrender.com`
- [ ] `EMAIL_USER` = your Gmail
- [ ] `EMAIL_PASS` = Gmail app password
- [ ] `EMAIL_SERVICE` = `gmail`
- [ ] `EMAIL_PORT` = `465`

### Deployment Status
- [ ] Code pushed to GitHub
- [ ] Render service created and deployed
- [ ] App is accessible at Render URL
- [ ] No errors in Render logs

---

## 🧪 Functionality Tests

### Authentication
- [ ] Sign up works
- [ ] OTP email arrives (check spam folder too)
- [ ] Email verification works
- [ ] Login works
- [ ] 2FA login works (if enabled)
- [ ] Redirects work (no getting stuck)

### Superadmin Features
- [ ] Can access superadmin dashboard
- [ ] Can approve/reject pending accounts
- [ ] Search boxes work (Pending Accounts & Manage Users)
- [ ] Can add/edit/delete departments
- [ ] Can add/edit/delete faculty
- [ ] Can add/edit/delete subjects
- [ ] Can add/edit/delete programs/strands
- [ ] Can add/edit/delete rooms

### Timetable Features
- [ ] Can drag and drop classes to timetable
- [ ] Conflict detection works (same teacher/room/subject)
- [ ] Superadmin can allow conflicts (non-blocking)
- [ ] Events save correctly
- [ ] Can edit event details
- [ ] Can change room for events
- [ ] Can delete events

---

## 📁 Code Quality

### Git Security
- [ ] `.env` is in `.gitignore` ✅ (already done)
- [ ] No passwords hardcoded in code
- [ ] No credentials in documentation files
- [ ] Git history cleaned (credentials removed)

### Files Present
- [ ] `Procfile` exists (for Render)
- [ ] `package.json` has correct start script
- [ ] All necessary files committed

---

## 🐛 Known Issues Fixed

- [ ] Login/signup redirects work (no getting stuck)
- [ ] Search boxes functional (Pending Accounts & Manage Users)
- [ ] Courses/strands can be added (file creation fixed)
- [ ] Conflict detection prevents merging
- [ ] CORS configured for Render URL
- [ ] Email timeout fixed (port 465)

---

## 📝 Documentation

### Guides Created
- [x] `RENDER_DEPLOYMENT_GUIDE.md` - Full deployment guide
- [x] `QUICK_START_RENDER.md` - Quick reference
- [x] `FIX_EMAIL_ISSUES.md` - Email troubleshooting
- [x] `FIX_SMTP_TIMEOUT.md` - SMTP timeout fix
- [x] `GMAIL_APP_PASSWORD_GUIDE.md` - How to get app password
- [x] `URGENT_SECURITY_FIX.md` - Fix exposed credentials
- [x] `COPY_PASTE_COMMANDS.md` - Git commands
- [x] `HOSTING_SPEED_COMPARISON.md` - Hosting options
- [x] `HOSTINGER_DEPLOYMENT_GUIDE.md` - Hostinger guide
- [x] `PORT_EXPLANATION.md` - PORT vs EMAIL_PORT

---

## 🎯 Next Steps (Optional Improvements)

### Performance
- [ ] Set up UptimeRobot to keep Render awake (free)
- [ ] Or upgrade to Render Paid ($7/month) for always-on

### Email (If Gmail Still Doesn't Work)
- [ ] Consider switching to SendGrid (more reliable on cloud)
- [ ] Or use Mailgun (free tier available)

### Features
- [ ] Test all user roles (user, admin, superadmin)
- [ ] Test schedule generation
- [ ] Test data export/import
- [ ] Test offline functionality

---

## 🆘 If Something's Not Working

### Email Not Sending?
1. Check Render logs for error messages
2. Verify `EMAIL_PORT=465` is set
3. Verify app password is correct (no spaces)
4. Check spam folder
5. See `FIX_EMAIL_ISSUES.md`

### App Not Loading?
1. Check Render logs
2. Verify all environment variables are set
3. Check if app is sleeping (first request takes 30-60s)
4. See `RENDER_DEPLOYMENT_GUIDE.md`

### Slow Performance?
1. App is sleeping (Render free tier)
2. Set up UptimeRobot (see `HOSTING_SPEED_COMPARISON.md`)
3. Or upgrade to Render Paid

---

## ✅ Completion Status

**Critical (Must Do):**
- [ ] Remove credentials from git history
- [ ] Generate new Gmail app password
- [ ] Update Render with new password
- [ ] Add `EMAIL_PORT=465` in Render
- [ ] Test email sending

**Important:**
- [ ] Test all major features
- [ ] Verify no errors in logs
- [ ] Test on different user roles

**Optional:**
- [ ] Set up UptimeRobot (keep app awake)
- [ ] Consider SendGrid (if Gmail still fails)
- [ ] Upgrade to Render Paid (if needed)

---

## 🎉 You're Done When:

- ✅ Credentials removed from GitHub
- ✅ New app password in Render
- ✅ Emails sending successfully
- ✅ All features working
- ✅ No errors in logs

---

**Check off each item as you complete it!** 📋

