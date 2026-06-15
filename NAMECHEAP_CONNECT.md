# NAMECHEAP DNS CONNECTION GUIDE
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 8 — Domain Connection  
**Domain:** dunazoe.com  

> DNS is NOT modified automatically. All changes are manual operator actions in the Namecheap dashboard.

---

## A Records

Replace `<YOUR_VPS_IP>` with your actual server IP address.

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<YOUR_VPS_IP>` | Automatic |
| A | `www` | `<YOUR_VPS_IP>` | Automatic |
| A | `api` | `<YOUR_VPS_IP>` | Automatic |

---

## CNAME Records

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `app` | `dunazoe.com` | Automatic |

> If deploying frontend on Replit Reserved VM instead of a VPS:
> Replace the `www` A record with a CNAME pointing to `<your-replit-app>.replit.app`

---

## SSL Certificate

```bash
# On your VPS, after DNS propagates:
apt install certbot python3-certbot-nginx -y

# Issue certificate
certbot --nginx \
  -d dunazoe.com \
  -d www.dunazoe.com \
  -d api.dunazoe.com \
  --non-interactive \
  --agree-tos \
  -m admin@dunazoe.com

# Enable auto-renewal
systemctl enable certbot.timer
certbot renew --dry-run
```

---

## Nginx Configuration

```nginx
# /etc/nginx/sites-available/dunazoe

server {
    listen 80;
    server_name dunazoe.com www.dunazoe.com api.dunazoe.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dunazoe.com www.dunazoe.com;

    ssl_certificate     /etc/letsencrypt/live/dunazoe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dunazoe.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name api.dunazoe.com;

    ssl_certificate     /etc/letsencrypt/live/dunazoe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dunazoe.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable and test
ln -s /etc/nginx/sites-available/dunazoe /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Verification Checklist

- [ ] Logged in to Namecheap → Domain List → dunazoe.com → Advanced DNS
- [ ] A record `@` → `<YOUR_VPS_IP>` saved
- [ ] A record `www` → `<YOUR_VPS_IP>` saved
- [ ] A record `api` → `<YOUR_VPS_IP>` saved
- [ ] CNAME `app` → `dunazoe.com` saved
- [ ] DNS propagation confirmed: `nslookup dunazoe.com` returns your IP
- [ ] Online check: [https://dnschecker.org/#A/dunazoe.com](https://dnschecker.org/#A/dunazoe.com)
- [ ] HTTP → HTTPS redirect: `curl -I http://dunazoe.com` → `301`
- [ ] HTTPS live: `curl -I https://dunazoe.com` → `200`
- [ ] API reachable: `curl https://api.dunazoe.com/health` → `{"status":"ok"}`
- [ ] SSL valid (no browser warning, padlock shown)

---

*Generated: 2026-06-15 — DUNAZOE CTO / DevOps Lead*
