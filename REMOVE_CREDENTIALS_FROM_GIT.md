# 🗑️ Quick Guide: Remove .env from Git History

## ⚠️ IMPORTANT: Read First

Removing files from git history **rewrites history**. This means:
- All commit hashes will change
- Anyone who cloned your repo will need to re-clone
- If others are working on this repo, coordinate with them first

---

## 🎯 Method 1: Using git-filter-repo (Recommended)

### Step 1: Install git-filter-repo

**Windows:**
```bash
pip install git-filter-repo
```

**Mac:**
```bash
brew install git-filter-repo
```

**Linux:**
```bash
pip3 install git-filter-repo
```

### Step 2: Remove .env from History

**Command 1:** Navigate to your project
```bash
cd "C:\Users\Flameblade\Desktop\flameblade\all coding projects\web dev\web based automated sched system with custom timetable"
```

**Command 2:** Remove .env from all commits
```bash
git filter-repo --path .env --invert-paths
```

**Command 3:** Force push all branches to GitHub
```bash
git push origin --force --all
```

**Command 4:** Force push tags
```bash
git push origin --force --tags
```

---

## 🎯 Method 2: Using git filter-branch (Built-in)

**Command 1:** Navigate to your project
```bash
cd "C:\Users\Flameblade\Desktop\flameblade\all coding projects\web dev\web based automated sched system with custom timetable"
```

**Command 2:** Remove .env from history
```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
```

**Command 3:** Clean up old references
```bash
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
```

**Command 4:** Expire reflog
```bash
git reflog expire --expire=now --all
```

**Command 5:** Garbage collect
```bash
git gc --prune=now
```

**Command 6:** Force push all branches
```bash
git push origin --force --all
```

**Command 7:** Force push tags
```bash
git push origin --force --tags
```

---

## 🎯 Method 3: Delete Repository and Recreate (Easiest but loses history)

**⚠️ Only do this if:**
- You don't care about git history
- No one else is using the repo
- You want the fastest solution

**Step 1:** Delete the repository on GitHub
- Go to GitHub → Your Repo → Settings → Scroll down → Delete this repository

**Step 2:** Remove .env from your local project
- Make sure `.env` is in `.gitignore` (it already is ✅)

**Step 3:** Create new repository on GitHub
- Go to GitHub → New repository
- Use the same name: `sti-ppc.semi-automated-sched-system`

**Step 4:** Push fresh code

**Command 1:** Initialize git
```bash
git init
```

**Command 2:** Add all files (except .env which is ignored)
```bash
git add .
```

**Command 3:** Create commit
```bash
git commit -m "Initial commit - credentials secured"
```

**Command 4:** Add remote
```bash
git remote add origin https://github.com/Flameblaade/sti-ppc.semi-automated-sched-system.git
```

**Command 5:** Push to GitHub
```bash
git push -u origin main
```

---

## ✅ After Removing from History

1. **Verify .env is NOT in repository:**

**Command:**
```bash
git log --all --full-history -- .env
```
Should return nothing.

2. **Check .gitignore:**

**Command:**
```bash
cat .gitignore | grep .env
```
Should show `.env` listed.

3. **Create fresh .env locally (never commit it):**

**Command 1:** Create .env file
```bash
echo "EMAIL_USER=your-email@gmail.com" > .env
```

**Command 2:** Add email password
```bash
echo "EMAIL_PASS=your-new-app-password" >> .env
```

**Command 3:** Add other variables (repeat as needed)
```bash
echo "JWT_SECRET=your-jwt-secret" >> .env
echo "PORT=3000" >> .env
echo "NODE_ENV=production" >> .env
```

**Remember:** This `.env` file stays on your computer only - never commit it!

4. **Update Render with NEW credentials:**
   - Go to Render → Environment
   - Update `EMAIL_PASS` with your NEW app password

---

## 🔒 Security Best Practices Going Forward

1. **Always check before committing:**
   ```bash
   git status
   ```
   Make sure `.env` is NOT listed!

2. **Use pre-commit hook (optional):**
   Create `.git/hooks/pre-commit`:
   ```bash
   #!/bin/sh
   if git diff --cached --name-only | grep -q "\.env$"; then
     echo "ERROR: .env file cannot be committed!"
     exit 1
   fi
   ```

3. **Double-check before pushing:**
   ```bash
   git log -1 --name-only
   ```
   Verify no sensitive files are being pushed.

---

## 🆘 If Something Goes Wrong

If you accidentally break your repository:

```bash
# Restore from remote
git fetch origin
git reset --hard origin/main
```

Or re-clone:
```bash
cd ..
rm -rf "web based automated sched system with custom timetable"
git clone https://github.com/Flameblaade/sti-ppc.semi-automated-sched-system.git
```

---

**Remember: After fixing, generate a NEW Gmail app password and update Render!** 🔐

