# 🚀 Hostinger VPS Deployment Guide

Yes, you can deploy to Hostinger, but you'll need **VPS hosting** (not shared hosting). Here's how:

---

## 📋 Requirements

- ✅ **Hostinger VPS Plan** (starts around $4-6/month)
- ✅ **SSH Access** (provided with VPS)
- ✅ **Domain Name** (optional, can use IP address)

**Note:** Node.js requires VPS - shared hosting won't work!

---

## 🎯 Step 1: Get Hostinger VPS

1. Go to [hostinger.com](https://www.hostinger.com)
2. Choose **"VPS Hosting"** plan
3. **Recommended:** Select **"Ubuntu 22.04 with Node.js"** template (pre-configured!)
4. Complete purchase
5. You'll receive:
   - Server IP address
   - SSH root password
   - Access credentials

---

## 🔧 Step 2: Connect to Your VPS

### On Windows:
Use **PuTTY** or **Windows Terminal**:
```bash
ssh root@your-server-ip
```

### On Mac/Linux:
```bash
ssh root@your-server-ip
```

Enter the root password when prompted.

---

## 📦 Step 3: Install Node.js (If Not Pre-installed)

If you didn't choose the Node.js template, install it:

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

You should see version numbers (e.g., `v18.17.0`).

---

## 📥 Step 4: Upload Your Code

### Option A: Using Git (Recommended)

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Navigate to project
cd YOUR_REPO_NAME

# Install dependencies
npm install --production
```

### Option B: Using SFTP (FileZilla)

1. Download [FileZilla](https://filezilla-project.org/)
2. Connect using:
   - **Host:** `sftp://your-server-ip`
   - **Username:** `root`
   - **Password:** Your VPS password
   - **Port:** `22`
3. Upload all project files to `/var/www/your-app`
4. SSH into server and run:
   ```bash
   cd /var/www/your-app
   npm install --production
   ```

---

## ⚙️ Step 5: Set Up Environment Variables

```bash
# Navigate to your app directory
cd /var/www/your-app

# Create .env file
nano .env
```

Add these variables:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-random-string-here
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
CLIENT_URL=http://your-server-ip:3000
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔄 Step 6: Install PM2 (Keeps App Running)

PM2 keeps your app running 24/7 and auto-restarts if it crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start your app
cd /var/www/your-app
pm2 start server.js --name "scheduling-system"

# Save PM2 configuration
pm2 save

# Set up PM2 to start on server reboot
pm2 startup
# Follow the command it outputs (usually: sudo env PATH=... pm2 startup systemd -u root)
```

**Check if it's running:**
```bash
pm2 status
pm2 logs scheduling-system
```

---

## 🌐 Step 7: Configure Firewall

Allow traffic on port 3000:

```bash
# Allow port 3000
ufw allow 3000/tcp

# Or allow all ports (less secure, but easier)
ufw allow 3000
ufw enable
```

---

## ✅ Step 8: Test Your App

1. Open browser and go to: `http://your-server-ip:3000`
2. Your app should load!

---

## 🔒 Step 9: Set Up Domain (Optional)

### If you have a domain:

1. **Point domain to your VPS:**
   - Go to your domain registrar (Namecheap, etc.)
   - Add **A Record:**
     - **Type:** A
     - **Host:** @ (or www)
     - **Value:** Your VPS IP address
     - **TTL:** 3600

2. **Update .env:**
   ```env
   CLIENT_URL=http://yourdomain.com:3000
   ```

3. **Restart app:**
   ```bash
   pm2 restart scheduling-system
   ```

---

## 🔄 Updating Your App

When you make changes:

```bash
# SSH into server
ssh root@your-server-ip

# Navigate to app
cd /var/www/your-app

# Pull latest changes (if using Git)
git pull

# Install new dependencies (if any)
npm install --production

# Restart app
pm2 restart scheduling-system

# Check logs
pm2 logs scheduling-system
```

---

## 🛠️ Useful PM2 Commands

```bash
# View all apps
pm2 list

# View logs
pm2 logs scheduling-system

# Restart app
pm2 restart scheduling-system

# Stop app
pm2 stop scheduling-system

# Delete app from PM2
pm2 delete scheduling-system

# Monitor app (CPU, memory)
pm2 monit
```

---

## 🐛 Troubleshooting

### App Won't Start

```bash
# Check PM2 logs
pm2 logs scheduling-system

# Check if port is in use
netstat -tulpn | grep 3000

# Check Node.js version
node -v
```

### Can't Access App

1. **Check firewall:**
   ```bash
   ufw status
   ```

2. **Check if app is running:**
   ```bash
   pm2 status
   ```

3. **Check server logs:**
   ```bash
   pm2 logs scheduling-system
   ```

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 PID
```

---

## 💰 Cost Comparison

| Hosting | Cost/Month | Always-On | Setup Difficulty |
|---------|-----------|-----------|------------------|
| **Hostinger VPS** | $4-6 | ✅ Yes | Medium |
| **Render Free** | Free | ❌ Sleeps | Easy |
| **Render Paid** | $7 | ✅ Yes | Easy |
| **Railway** | $5 | ✅ Yes | Easy |

---

## ⚡ Performance

**Hostinger VPS:**
- ✅ **Always-on** - No sleep
- ✅ **Full control** - You manage everything
- ✅ **Fast** - Dedicated resources
- ⚠️ **More setup** - Requires SSH/command line knowledge
- ⚠️ **You manage** - Updates, security, backups

**Render:**
- ✅ **Easy setup** - Just connect GitHub
- ✅ **Auto-deploy** - Push to deploy
- ✅ **Managed** - They handle infrastructure
- ⚠️ **Free tier sleeps** - Paid is always-on

---

## 🎯 Recommendation

**For beginners:** Stick with **Render** (easier, auto-deploy)

**For more control:** Use **Hostinger VPS** (cheaper, full control)

**Best of both:** **Render Paid** ($7/month) - Easy + Always-on

---

## 📝 Quick Checklist

- [ ] VPS purchased from Hostinger
- [ ] SSH access working
- [ ] Node.js installed
- [ ] Code uploaded to `/var/www/your-app`
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with all variables
- [ ] PM2 installed and app started
- [ ] Firewall configured (port 3000 open)
- [ ] App accessible at `http://your-ip:3000`
- [ ] Domain pointed (if using custom domain)

---

## 🆘 Need Help?

- **Hostinger Support:** [support.hostinger.com](https://support.hostinger.com)
- **PM2 Docs:** [pm2.keymetrics.io](https://pm2.keymetrics.io/docs/)
- **Node.js Docs:** [nodejs.org](https://nodejs.org/docs/)

---

**Good luck with your deployment! 🚀**

