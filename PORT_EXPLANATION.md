# 🔌 PORT vs EMAIL_PORT - What's the Difference?

These are **two completely different ports** for different purposes!

---

## 📡 PORT (Your App's Port)

**What it is:** The port your Node.js server listens on

**Where it's used:** 
- Your app runs on this port
- Users access your website via this port
- Example: `https://your-app.onrender.com:3000`

**In your code:**
```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**In Render:**
- Render **automatically sets** `PORT` for you
- You don't need to set it manually
- Render uses it to route traffic to your app

**Example values:**
- `3000` (default)
- `8080`
- `5000`

---

## 📧 EMAIL_PORT (Gmail SMTP Port)

**What it is:** The port used to connect to Gmail's email server (SMTP)

**Where it's used:**
- Your app connects to Gmail's servers to send emails
- This is for **outgoing email connections**
- Not related to your website at all!

**In your code:**
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 465, // ← This is EMAIL_PORT
  // ...
});
```

**In Render:**
- You **need to set this manually** (optional)
- Only if Gmail port 587 doesn't work
- Use `465` for SSL or `587` for TLS

**Example values:**
- `465` (SSL - more reliable on cloud)
- `587` (TLS - standard)

---

## 📊 Quick Comparison

| Port Type | Purpose | Who Sets It | Example |
|-----------|--------|-------------|---------|
| **PORT** | Your app listens on this | Render (auto) | `3000` |
| **EMAIL_PORT** | Connect to Gmail SMTP | You (optional) | `465` or `587` |

---

## 🎯 In Your Render Environment Variables

You should have:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | `3000` (or auto-set by Render) | Your app's port |
| `EMAIL_PORT` | `465` (optional) | Gmail SMTP port |
| `EMAIL_USER` | `your-email@gmail.com` | Gmail address |
| `EMAIL_PASS` | `your-app-password` | Gmail app password |

---

## 💡 Why EMAIL_PORT Matters

**The problem:**
- Gmail SMTP uses port **587** by default
- Some cloud platforms (like Render) block port 587
- Port **465** (SSL) works better on cloud platforms

**The solution:**
- Set `EMAIL_PORT=465` in Render
- Your app will use port 465 to connect to Gmail
- This often fixes connection timeout errors

---

## ✅ What You Need to Do

**For the timeout fix:**

1. In Render → Environment tab
2. Add variable:
   - **Name:** `EMAIL_PORT`
   - **Value:** `465`
3. Save → Redeploy

**That's it!** This tells your app to use port 465 (SSL) instead of 587 (TLS) when connecting to Gmail.

---

## 🔍 Summary

- **PORT** = Your website's port (Render sets this automatically)
- **EMAIL_PORT** = Gmail's email server port (you set this to fix timeouts)

**They're completely separate!** One is for your website, one is for sending emails. 📧

