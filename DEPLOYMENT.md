# Deployment Guide

## Production Deployment Checklist

### Pre-Deployment

- [ ] Review and test all code changes
- [ ] Run security scans (CodeQL, OWASP)
- [ ] Perform load testing
- [ ] Update documentation
- [ ] Create backup of existing production data
- [ ] Notify stakeholders of deployment window

### Environment Setup

#### 1. Server Requirements

**Minimum Specifications**:
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 20.04 LTS or similar

**Recommended Specifications**:
- **CPU**: 8 cores
- **RAM**: 16GB
- **Storage**: 100GB SSD with RAID
- **OS**: Ubuntu 22.04 LTS

#### 2. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### 3. PostgreSQL Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE telehealth_production;
CREATE USER telehealth_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE telehealth_production TO telehealth_user;

# Exit psql
\q

# Run schema
psql -U telehealth_user -d telehealth_production < backend/src/database/schema.sql
```

#### 4. Application Setup

```bash
# Clone repository
git clone https://github.com/jonastrance/telehealth-saas-platform.git
cd telehealth-saas-platform

# Install dependencies
npm install
npm install --workspace=backend
npm install --workspace=frontend

# Build applications
npm run build
```

#### 5. Environment Configuration

Create production environment file:

```bash
# backend/.env
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Database (Use secure values)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telehealth_production
DB_USER=telehealth_user
DB_PASSWORD=your_secure_password
DB_SSL=true
DB_ENCRYPTION_KEY=your_32_character_encryption_key_here

# JWT (Generate strong random secrets)
JWT_SECRET=your_jwt_secret_key_minimum_64_characters_for_production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Session
SESSION_TIMEOUT=15m
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=30m

# CORS
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# WebRTC
TURN_SERVER_URL=turn:turn.yourdomain.com:3478
TURN_SERVER_USERNAME=your_turn_username
TURN_SERVER_CREDENTIAL=your_turn_credential
STUN_SERVER_URL=stun:stun.l.google.com:19302

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID_BASIC=price_your_basic_plan_id
STRIPE_PRICE_ID_PRO=price_your_pro_plan_id

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/telehealth/app.log

# Audit
AUDIT_LOG_ENABLED=true
AUDIT_LOG_FILE=/var/log/telehealth/audit.log

# Data Retention
DATA_RETENTION_DAYS=2555
LOG_RETENTION_DAYS=2555

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png,doc,docx
```

**Security Notes**:
- Use strong, randomly generated values for all secrets
- Never commit `.env` file to version control
- Store secrets in secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate secrets regularly (quarterly recommended)

#### 6. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/telehealth
```

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (Static Files)
    location / {
        root /var/www/telehealth/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for video calls
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket for Video Signaling
    location /video-signal {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Long timeout for WebSocket connections
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:5000;
        access_log off;
    }

    # Disable logging for favicon
    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/telehealth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 7. SSL Certificate Setup

```bash
# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal (cron job already created by certbot)
```

#### 8. Deploy Frontend

```bash
# Copy built files to web root
sudo mkdir -p /var/www/telehealth/frontend
sudo cp -r frontend/dist/* /var/www/telehealth/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/telehealth
sudo chmod -R 755 /var/www/telehealth
```

#### 9. Deploy Backend with PM2

Create PM2 ecosystem file:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'telehealth-api',
    script: './backend/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/telehealth/pm2-error.log',
    out_file: '/var/log/telehealth/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

Start the application:
```bash
# Create log directory
sudo mkdir -p /var/log/telehealth
sudo chown -R $USER:$USER /var/log/telehealth

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs
```

### Monitoring & Maintenance

#### 1. PM2 Monitoring

```bash
# View logs
pm2 logs telehealth-api

# Monitor resources
pm2 monit

# Check status
pm2 status

# Restart application
pm2 restart telehealth-api

# Reload without downtime
pm2 reload telehealth-api
```

#### 2. Database Backups

Create backup script:

```bash
#!/bin/bash
# /usr/local/bin/backup-db.sh

BACKUP_DIR="/var/backups/telehealth"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="telehealth_production"
DB_USER="telehealth_user"

mkdir -p $BACKUP_DIR

# Create backup
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME | \
    gzip > $BACKUP_DIR/backup_${DATE}.sql.gz

# Encrypt backup
gpg --symmetric --cipher-algo AES256 $BACKUP_DIR/backup_${DATE}.sql.gz

# Remove unencrypted backup
rm $BACKUP_DIR/backup_${DATE}.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz.gpg" -mtime +30 -delete

echo "Backup completed: backup_${DATE}.sql.gz.gpg"
```

Schedule with cron:
```bash
sudo crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/telehealth/backup.log 2>&1
```

#### 3. Log Rotation

```bash
sudo nano /etc/logrotate.d/telehealth
```

```
/var/log/telehealth/*.log {
    daily
    rotate 2555
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### 4. Monitoring Tools

**Install monitoring stack**:

```bash
# Install Node Exporter for Prometheus
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo mv node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-1.7.0.linux-amd64*

# Create systemd service
sudo nano /etc/systemd/system/node_exporter.service
```

```ini
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
User=node_exporter
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -rs /bin/false node_exporter
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

### Security Hardening

#### 1. Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change 22 to your custom port if modified)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

#### 2. Fail2ban Setup

```bash
# Install Fail2ban
sudo apt install -y fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

```bash
sudo systemctl restart fail2ban
```

#### 3. Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Create indexes (already in schema.sql)
-- Analyze tables regularly
ANALYZE;

-- Vacuum regularly
VACUUM ANALYZE;

-- Set up autovacuum
ALTER TABLE users SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE appointments SET (autovacuum_vacuum_scale_factor = 0.1);
```

#### 2. Enable Gzip Compression

Add to Nginx configuration:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

#### 3. Redis Caching (Optional)

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
```

### Rollback Procedure

If deployment fails:

```bash
# Stop current version
pm2 stop telehealth-api

# Restore database backup
gunzip < /var/backups/telehealth/backup_YYYYMMDD_HHMMSS.sql.gz | \
    psql -U telehealth_user telehealth_production

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Restart
pm2 restart telehealth-api
```

### Health Checks

```bash
# API Health Check
curl https://yourdomain.com/health

# Database Check
psql -U telehealth_user -d telehealth_production -c "SELECT NOW();"

# SSL Certificate Check
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | \
    openssl x509 -noout -dates

# Disk Space Check
df -h

# Memory Check
free -h

# Process Check
pm2 status
```

### Post-Deployment

- [ ] Verify all endpoints are working
- [ ] Test video call functionality
- [ ] Check audit logs are being written
- [ ] Verify SSL certificate is valid
- [ ] Test authentication flow
- [ ] Monitor error logs for 24 hours
- [ ] Update documentation
- [ ] Notify stakeholders of successful deployment

### Disaster Recovery

#### Backup Strategy
- **Database**: Daily encrypted backups, retained for 7 years
- **Application Files**: Version controlled in Git
- **Logs**: Retained for 7 years (HIPAA requirement)
- **Configuration**: Stored in secure vault

#### Recovery Time Objective (RTO)
- **Target**: 4 hours
- **Maximum Tolerable**: 24 hours

#### Recovery Point Objective (RPO)
- **Target**: 1 hour (hourly backups recommended)
- **Maximum Tolerable**: 24 hours

### Support & Troubleshooting

#### Common Issues

**Issue**: Application won't start
```bash
# Check logs
pm2 logs telehealth-api

# Check environment variables
cat backend/.env

# Check database connection
psql -U telehealth_user -d telehealth_production
```

**Issue**: WebSocket connection fails
```bash
# Check Nginx configuration
sudo nginx -t

# Check WebSocket upgrade headers in logs
tail -f /var/log/nginx/access.log
```

**Issue**: High memory usage
```bash
# Restart application
pm2 restart telehealth-api

# Check memory leaks
pm2 monit

# Adjust max memory restart
pm2 restart telehealth-api --max-memory-restart 1G
```

### Maintenance Windows

Schedule regular maintenance:
- **Weekly**: Log review and cleanup
- **Monthly**: Security updates and patches
- **Quarterly**: SSL certificate rotation, secret rotation
- **Annually**: Full security audit, HIPAA compliance review

### Contact Information

**DevOps Team**: devops@telehealth-platform.com
**Security Team**: security@telehealth-platform.com
**Emergency On-Call**: [24/7 number]

---

**Last Updated**: December 2024
**Version**: 1.0.0
