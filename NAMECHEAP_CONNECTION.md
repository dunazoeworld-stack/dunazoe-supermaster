# NAMECHEAP DNS CONNECTION GUIDE
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 8 — Domain Connection  
**Domain:** dunazoe.com  

> **Important:** This guide provides the exact DNS values. Do NOT modify DNS automatically.
> All DNS changes must be made manually by the domain owner in the Namecheap dashboard.

---

## DNS Records Required

### For VPS Deployment (Contabo or similar)

Replace `<YOUR_VPS_IP>` with your actual VPS IP address.

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<YOUR_VPS_IP>` | Automatic |
| A | `www` | `<YOUR_VPS_IP>` | Automatic |
| A | `api` | `<YOUR_VPS_IP>` | Automatic |
| CNAME | `app` | `dunazoe.com` | Automatic |

### For Replit Deployment (Frontend Only)

If deploying the frontend on Replit Reserved VM:

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `www` | `<your-replit-app>.replit.app` | Automatic |
| A | `@` | `<Replit IP — shown in Replit Deploy panel>` | Automatic |

---

## Step-by-Step: Namecheap Dashboard

1. Log in to [namecheap.com](https://namecheap.com)
2. Go to **Domain List** → click **Manage** next to `dunazoe.com`
3. Click the **Advanced DNS** tab
4. Delete any existing A or CNAME records for `@` and `www`
5. Add records from the table above
6. Click the green ✓ checkmark to save each record
7. Wait for DNS propagation (typically 10–30 minutes; up to 48 hours max)

---

## SSL Certificate (After DNS Propagates)

```bash
# On your VPS, install Certbot
apt install certbot python3-certbot-nginx -y

# Obtain certificate
certbot --nginx -d dunazoe.com -d www.dunazoe.com -d api.dunazoe.com

# Auto-renew
certbot renew --dry-run
```

---

## Nginx Configuration (Minimal — Add to VPS)

```nginx
server {
    listen 80;
    server_name dunazoe.com www.dunazoe.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name dunazoe.com www.dunazoe.com;

    ssl_certificate /etc/letsencrypt/live/dunazoe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dunazoe.com/privkey.pem;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Gateway
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Verification Checklist

- [ ] A record for `@` pointing to VPS IP saved in Namecheap
- [ ] A record for `www` pointing to VPS IP saved in Namecheap
- [ ] A record for `api` pointing to VPS IP saved in Namecheap
- [ ] DNS propagation confirmed: `nslookup dunazoe.com` returns your VPS IP
- [ ] HTTP → HTTPS redirect working: `curl -I http://dunazoe.com` returns `301`
- [ ] HTTPS working: `curl -I https://dunazoe.com` returns `200`
- [ ] SSL certificate valid (no browser warning)
- [ ] API gateway reachable: `curl https://dunazoe.com/api/health`

---

*Generated: 2026-06-15 — DUNAZOE Release Manager (Replit 4)*
