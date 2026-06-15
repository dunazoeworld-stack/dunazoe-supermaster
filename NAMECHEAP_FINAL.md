# NAMECHEAP FINAL DNS GUIDE
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  
**Domain:** dunazoe.com  

> Do NOT modify DNS automatically. All steps are manual operator actions.

---

## A Records

Replace `<YOUR_VPS_IP>` with your server's public IP address.

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<YOUR_VPS_IP>` | Automatic |
| A | `www` | `<YOUR_VPS_IP>` | Automatic |
| A | `api` | `<YOUR_VPS_IP>` | Automatic |

---

## CNAME Record

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `app` | `dunazoe.com` | Automatic |

---

## Step-by-Step (Phone-Friendly)

1. Open browser → go to `namecheap.com`
2. Log in → tap **Domain List**
3. Tap **Manage** next to `dunazoe.com`
4. Tap **Advanced DNS** tab
5. Delete any existing A records for `@` and `www`
6. Tap **Add New Record** for each row in the table above
7. Tap the green ✓ to save each one
8. Wait 10–30 minutes for DNS to propagate

---

## SSL Certificate Setup (After DNS Propagates)

Run on your VPS:

```bash
apt update && apt install certbot python3-certbot-nginx -y

certbot --nginx \
  -d dunazoe.com \
  -d www.dunazoe.com \
  -d api.dunazoe.com \
  --non-interactive --agree-tos \
  -m admin@dunazoe.com
```

---

## Nginx Config (Paste to VPS)

```nginx
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
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}

server {
    listen 443 ssl http2;
    server_name api.dunazoe.com;
    ssl_certificate     /etc/letsencrypt/live/dunazoe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dunazoe.com/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable and reload
ln -sf /etc/nginx/sites-available/dunazoe /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Verification Checklist

- [ ] A record `@` → VPS IP saved in Namecheap
- [ ] A record `www` → VPS IP saved in Namecheap
- [ ] A record `api` → VPS IP saved in Namecheap
- [ ] DNS propagated: `nslookup dunazoe.com` → returns your VPS IP
- [ ] Check online: [https://dnschecker.org/#A/dunazoe.com](https://dnschecker.org/#A/dunazoe.com)
- [ ] HTTP redirect: `curl -I http://dunazoe.com` → `301 Moved Permanently`
- [ ] HTTPS live: `curl -I https://dunazoe.com` → `200 OK`
- [ ] SSL valid: no browser warning, padlock visible
- [ ] API health: `curl https://api.dunazoe.com/health` → `{"status":"ok"}`

---

*Generated: 2026-06-15 — DUNAZOE CTO / DevOps Lead*
