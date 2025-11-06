# 🚨 URGENT: Fix Exposed Email Credentials

**GitGuardian detected your SMTP credentials in GitHub!** This is why emails aren't working and it's a security risk.

---

## ⚡ Quick Fix (5 Steps)

### 1. Generate NEW Gmail App Password (2 minutes)

1. Go to: https://myaccount.google.com/security
2. Click **"2-Step Verification"** → **"App passwords"**
3. **Delete the OLD password** (the exposed one)
4. Generate **NEW password** for "Mail"
5. **Copy the 16-character code** (remove spaces)

---

### 2. Update Render Environment Variables (1 minute)

1. Render Dashboard → Your Service → **Environment** tab
2. Find `EMAIL_PASS`
3. **Paste your NEW app password**
4. Save → Render redeploys

---

### 3. Remove .env from Git History (5 minutes)

**Easiest method - using git filter-branch:**

**Step 1:** Open terminal in your project folder
```bash
cd "C:\Users\Flameblade\Desktop\flameblade\all coding projects\web dev\web based automated sched system with custom timetable"
```

**Step 2:** Remove .env from all git history
```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
```

**Step 3:** Clean up old references
```bash
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
```

**Step 4:** Expire reflog
```bash
git reflog expire --expire=now --all
```

**Step 5:** Garbage collect
```bash
git gc --prune=now
```

**Step 6:** Force push to GitHub (removes from GitHub history)
```bash
git push origin --force --all
```

**Step 7:** Force push tags
```bash
git push origin --force --tags
```

**⚠️ Warning:** This rewrites git history. If others use this repo, tell them first!

---

### 4. Verify .env is Ignored

Your `.gitignore` already has `.env` - good! But verify:

**Command 1:** Check if .env is tracked
```bash
git ls-files | grep .env
```
Should return nothing.

**If it shows .env, run these commands:**

**Command 2:** Remove from tracking
```bash
git rm --cached .env
```

**Command 3:** Commit the removal
```bash
git commit -m "Remove .env from tracking"
```

**Command 4:** Push to GitHub
```bash
git push
```

---

### 5. Test Email (2 minutes)

1. Try signing up a new account
2. Check Render logs for:
   - `✅ Email sent successfully`
   - `📬 Email delivered to: your-email@example.com`
3. Check your email (and spam folder)

---

## ✅ Why This Fixes Email Issue

**The problem:**
- Your old Gmail app password was exposed in GitHub
- Gmail may have revoked/blocked it for security
- Old password no longer works → emails fail

**The solution:**
- New app password = fresh credentials
- Updated in Render = app uses new password
- Removed from git = secure going forward

---

## 🔒 Going Forward

**NEVER commit:**
- ❌ `.env` files
- ❌ Passwords in code
- ❌ API keys
- ❌ Secrets

**ALWAYS use:**
- ✅ Environment variables (Render, etc.)
- ✅ `.gitignore` for `.env`
- ✅ Separate passwords for each service

---

## 📋 Checklist

- [ ] Generated NEW Gmail app password
- [ ] Deleted OLD app password
- [ ] Updated `EMAIL_PASS` in Render
- [ ] Removed `.env` from git history
- [ ] Force pushed to GitHub
- [ ] Tested email sending
- [ ] Verified emails arrive

---

**Do this NOW - your credentials are exposed!** 🔐

See `FIX_EXPOSED_CREDENTIALS.md` for detailed instructions.

