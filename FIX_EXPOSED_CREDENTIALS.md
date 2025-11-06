# 🔒 URGENT: Fix Exposed SMTP Credentials

GitGuardian detected your email credentials in your GitHub repository. This is a **security risk** and needs to be fixed immediately!

---

## ⚠️ Why This Matters

1. **Security Risk:** Anyone can see your email password in git history
2. **Email Not Working:** If credentials were exposed and changed, emails won't send
3. **Account Compromise:** Someone could use your email account

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

### Step 1: Rotate Your Gmail App Password (DO THIS FIRST!)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **"2-Step Verification"**
3. Scroll to **"App passwords"**
4. **Delete the old app password** that was exposed
5. **Generate a NEW app password:**
   - Select "Mail"
   - Device: "Other (Custom name)" → Type: "Render Deployment"
   - Click "Generate"
   - **Copy the new 16-character password** (remove spaces)

---

### Step 2: Remove Credentials from Git History

**Option A: Using BFG Repo-Cleaner (Easier)**

1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/
2. Run these commands:

```bash
# Clone a fresh copy (mirror)
git clone --mirror https://github.com/Flameblaade/sti-ppc.semi-automated-sched-system.git

# Remove .env file from history
java -jar bfg.jar --delete-files .env sti-ppc.semi-automated-sched-system.git

# Clean up
cd sti-ppc.semi-automated-sched-system.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history!)
git push --force
```

**Option B: Using git-filter-repo (Recommended)**

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from history
git filter-repo --path .env --invert-paths

# Force push
git push --force --all
```

**Option C: Manual Method (If above don't work)**

```bash
# Remove .env from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push
git push --force --all
```

**⚠️ WARNING:** Force pushing rewrites git history. If others are using the repo, coordinate with them first!

---

### Step 3: Verify .env is in .gitignore

Check that `.gitignore` includes:

```gitignore
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

✅ Your `.gitignore` already has this - good!

---

### Step 4: Update Render Environment Variables

1. Go to **Render Dashboard** → Your Service → **Environment** tab
2. Find `EMAIL_PASS`
3. **Replace with your NEW app password** (the one you just generated)
4. Click **"Save Changes"**
5. Render will redeploy automatically

---

### Step 5: Verify No Credentials in Code

Search your codebase to make sure no credentials are hardcoded:

```bash
# Search for email passwords in code
grep -r "EMAIL_PASS" . --exclude-dir=node_modules
grep -r "your-app-password" . --exclude-dir=node_modules
grep -r "@gmail.com" . --exclude-dir=node_modules
```

If you find any hardcoded credentials, remove them immediately!

---

## ✅ After Fixing

1. **Test email sending:**
   - Try signing up a new account
   - Check Render logs for email status
   - Check your email (and spam folder)

2. **Verify credentials are secure:**
   - `.env` file is NOT in repository
   - All credentials are in Render environment variables only
   - No hardcoded passwords in code

---

## 🔍 Why Emails Might Not Be Working

If your credentials were exposed:
1. **Password might have been changed** - Old password no longer works
2. **Gmail might have blocked it** - Security measure
3. **App password might have been revoked** - Need new one

**Solution:** Generate a NEW app password and update Render!

---

## 🛡️ Prevention

### DO:
- ✅ Always use `.env` file for secrets
- ✅ Keep `.env` in `.gitignore`
- ✅ Use environment variables in hosting (Render, etc.)
- ✅ Never commit passwords to git

### DON'T:
- ❌ Commit `.env` files
- ❌ Hardcode passwords in code
- ❌ Share credentials in documentation
- ❌ Push secrets to public repositories

---

## 📝 Quick Checklist

- [ ] Generated NEW Gmail app password
- [ ] Deleted OLD app password from Google
- [ ] Removed `.env` from git history
- [ ] Updated `EMAIL_PASS` in Render environment variables
- [ ] Verified `.env` is in `.gitignore`
- [ ] Tested email sending
- [ ] Checked Render logs for email status

---

## 🆘 Need Help?

- **GitHub Support:** [support.github.com](https://support.github.com)
- **GitGuardian:** They can help with credential removal
- **Render Support:** [render.com/support](https://render.com/support)

---

**This is urgent - fix it ASAP!** 🔒

