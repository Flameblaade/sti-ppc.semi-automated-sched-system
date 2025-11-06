# 📋 Copy-Paste Commands (One at a Time)

All commands separated so you can copy each one individually.

---

## 🚨 Step 1: Navigate to Your Project

Copy and paste this command:

```bash
cd "C:\Users\Flameblade\Desktop\flameblade\all coding projects\web dev\web based automated sched system with custom timetable"
```

Press Enter.

---

## 🚨 Step 2: Remove .env from Git History

Copy and paste this command:

```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
```

Press Enter. Wait for it to finish (may take a minute).

---

## 🚨 Step 3: Clean Up Old References

Copy and paste this command:

```bash
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
```

Press Enter.

---

## 🚨 Step 4: Expire Reflog

Copy and paste this command:

```bash
git reflog expire --expire=now --all
```

Press Enter.

---

## 🚨 Step 5: Garbage Collect

Copy and paste this command:

```bash
git gc --prune=now
```

Press Enter. Wait for it to finish.

---

## 🚨 Step 6: Force Push to GitHub (Removes from GitHub)

Copy and paste this command:

```bash
git push origin --force --all
```

Press Enter. You may need to enter your GitHub username and password/token.

---

## 🚨 Step 7: Force Push Tags

Copy and paste this command:

```bash
git push origin --force --tags
```

Press Enter.

---

## ✅ Step 8: Verify It Worked

Copy and paste this command:

```bash
git log --all --full-history -- .env
```

Press Enter.

**Expected result:** Should return nothing (empty). If it shows anything, the removal didn't work completely.

---

## 📝 What to Do Next

1. **Generate NEW Gmail app password** (see URGENT_SECURITY_FIX.md)
2. **Update Render** with new password
3. **Test email sending**

---

**⚠️ Important:** After running these commands, your git history will be rewritten. If others are using this repository, they'll need to re-clone it.

---

**All done! Your credentials are now removed from git history.** 🔒

