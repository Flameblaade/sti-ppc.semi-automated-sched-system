# 📧 How to Generate Gmail App Password - Step by Step

Follow these exact steps to generate a new Gmail app password for your scheduling system.

---

## ✅ Step 1: Go to Google Account Security

1. Open your web browser
2. Go to: **https://myaccount.google.com/security**
3. Sign in with your Gmail account (the one you want to use for sending emails)

---

## ✅ Step 2: Enable 2-Step Verification (If Not Already Enabled)

**Skip this step if you already have 2-Step Verification enabled.**

1. On the Security page, find **"2-Step Verification"**
2. Click on it
3. If it says **"Off"**, click **"Get Started"**
4. Follow the prompts to:
   - Enter your phone number
   - Verify with a code sent to your phone
   - Confirm you want to enable it
5. Click **"Turn On"**

**Note:** You MUST have 2-Step Verification enabled to create app passwords!

---

## ✅ Step 3: Delete Old App Password (If It Exists)

1. Still on the Security page, scroll down
2. Find **"2-Step Verification"** section
3. Click on **"2-Step Verification"** (not the toggle, but the text/link)
4. Scroll down to find **"App passwords"**
5. Click **"App passwords"**
6. You'll see a list of app passwords (if any exist)
7. Find the one that was exposed (or any old ones)
8. Click the **trash/delete icon** next to it
9. Confirm deletion

---

## ✅ Step 4: Generate New App Password

1. On the **"App passwords"** page, you'll see:
   - **"Select app"** dropdown
   - **"Select device"** dropdown

2. **Select App:**
   - Click **"Select app"** dropdown
   - Choose **"Mail"**

3. **Select Device:**
   - Click **"Select device"** dropdown
   - Choose **"Other (Custom name)"**
   - A text box will appear
   - Type: **"Render Deployment"** (or any name you like)

4. **Generate:**
   - Click **"Generate"** button
   - Google will show you a **16-character password**

---

## ✅ Step 5: Copy the App Password

You'll see something like this:

```
Your app password:
abcd efgh ijkl mnop
```

**Important:**
- Copy the **entire 16-character code**
- It will have spaces like: `abcd efgh ijkl mnop`
- **Remove the spaces** when using it: `abcdefghijklmnop`

**How to copy:**
1. Click the **copy icon** (if available)
2. Or manually select and copy: `abcd efgh ijkl mnop`
3. Remove spaces: `abcdefghijklmnop`

---

## ✅ Step 6: Save It Securely (Temporarily)

**Don't save it in a file that gets committed to git!**

- Write it down on paper temporarily
- Or save in a secure password manager
- Or keep it in your clipboard until you add it to Render

---

## ✅ Step 7: Add to Render

1. Go to **Render Dashboard**: https://dashboard.render.com
2. Click on your service (scheduling system)
3. Go to **"Environment"** tab
4. Find **"EMAIL_PASS"** in the list
5. Click on it to edit
6. **Paste your new app password** (without spaces: `abcdefghijklmnop`)
7. Click **"Save Changes"**
8. Render will automatically redeploy

---

## 🎯 Visual Guide (What You'll See)

### On Google Security Page:
```
Security
├── Your devices
├── 2-Step Verification ← Click here
├── App passwords ← Then click here
└── ...
```

### On App Passwords Page:
```
App passwords

Select app: [Mail ▼]
Select device: [Other (Custom name) ▼]
Name: [Render Deployment        ]
[Generate] button

Your app password:
abcd efgh ijkl mnop  [Copy icon]
```

---

## ⚠️ Important Notes

1. **You can only see the password ONCE** - Copy it immediately!
2. **If you lose it**, you'll need to generate a new one
3. **Remove spaces** when using it (Google shows it with spaces, but use without)
4. **This is NOT your regular Gmail password** - It's a special app-only password
5. **Each app password is unique** - Generate a new one for each service

---

## 🐛 Troubleshooting

### "App passwords" option not showing?

**Problem:** You don't have 2-Step Verification enabled.

**Solution:**
1. Go back to Security page
2. Enable 2-Step Verification first
3. Then come back to App passwords

---

### "App passwords" is grayed out?

**Problem:** Your Google account might not support it, or 2-Step Verification isn't fully set up.

**Solution:**
1. Make sure 2-Step Verification is **fully enabled** (not just started)
2. Try using a different Google account
3. Or use a work/school Google account (if available)

---

### Can't find "App passwords" link?

**Try this:**
1. Go directly to: **https://myaccount.google.com/apppasswords**
2. Or search in Google Account settings for "app password"

---

### Password doesn't work in Render?

**Check:**
1. Did you remove spaces? (`abcd efgh` → `abcdefgh`)
2. Did you copy the entire 16 characters?
3. Did you wait for Render to redeploy after saving?
4. Check Render logs for email errors

---

## ✅ Quick Checklist

- [ ] Went to Google Account Security page
- [ ] Enabled 2-Step Verification (if needed)
- [ ] Opened App passwords section
- [ ] Deleted old exposed password
- [ ] Selected "Mail" as app
- [ ] Selected "Other (Custom name)" as device
- [ ] Named it "Render Deployment"
- [ ] Clicked Generate
- [ ] Copied the 16-character password
- [ ] Removed spaces from password
- [ ] Added to Render as EMAIL_PASS
- [ ] Saved in Render (auto-redeploys)

---

## 🎉 Done!

After adding the new password to Render and it redeploys, your emails should work!

**Test it:**
1. Try signing up a new account
2. Check your email for the OTP code
3. Check Render logs if email doesn't arrive

---

**Need more help?** Check `FIX_EMAIL_ISSUES.md` for troubleshooting email problems.

