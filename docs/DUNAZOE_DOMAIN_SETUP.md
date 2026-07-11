# HOW TO CONNECT DUNAZOE.COM ON NAMECHEAP
### Simple operator guide — no technical background required

---

## BEFORE YOU START

✅ Confirm your app works on the Replit URL first  
✅ You need access to: **Replit dashboard** + **Namecheap account**  
✅ This takes about 10 minutes to set up, then up to 48 hours for DNS to propagate

---

## STEP 1 — Publish your app on Replit

1. Open your Replit project
2. Click the **Deploy** button (rocket icon) in the top-right
3. Choose **Reserved VM** or **Autoscale** deployment
4. Wait for deployment to complete — you'll get a `.replit.app` URL
5. ✅ Confirm the app opens correctly on that `.replit.app` URL before continuing

---

## STEP 2 — Add your custom domain in Replit

1. In Replit, go to your deployment settings
2. Find **Custom Domains** or **Domains**
3. Add: `dunazoe.com`
4. Add: `www.dunazoe.com`
5. Replit will show you the exact DNS records to add — **copy them exactly**

---

## STEP 3 — Add DNS records in Namecheap

1. Log in to [namecheap.com](https://namecheap.com)
2. Go to **Domain List** → find `dunazoe.com` → click **Manage**
3. Click **Advanced DNS** tab
4. Add the records Replit gave you:

| What Replit gives you | What to do in Namecheap |
|----------------------|-------------------------|
| `A` record for `@` | Add A Record, Host = `@`, Value = IP from Replit |
| `CNAME` for `www` | Add CNAME Record, Host = `www`, Value = Replit domain |
| `TXT` verification record | Add TXT Record exactly as shown — **keep this permanently** |

5. **Delete any old A or CNAME records** for the same host (`@` or `www`) that conflict
6. Click **Save All Changes**

---

## STEP 4 — Wait and verify

1. Wait 15 minutes to 48 hours for DNS to spread worldwide
2. Open `https://dunazoe.com` in your browser
3. Test: login, sign-up, checkout, payment webhooks, and callback URLs
4. ✅ You should see a padlock (SSL) — Replit handles SSL automatically

---

## IMPORTANT RULES

⚠️ **Never delete the TXT verification record** — Replit needs it to renew your SSL certificate  
⚠️ **Don't add duplicate A records** for the same host — remove old ones first  
⚠️ After switching to the real domain, update these environment variables in Replit Secrets:

| Variable | New value |
|----------|-----------|
| `FRONTEND_URL` | `https://dunazoe.com` |
| `NEXT_PUBLIC_API_URL` | Your API gateway URL |
| `PAYSTACK_WEBHOOK_SECRET` | Keep as-is — webhook URL in Paystack dashboard needs updating |
| `STRIPE_WEBHOOK_SECRET` | Keep as-is — webhook URL in Stripe dashboard needs updating |

---

## WEBHOOK URLs TO UPDATE IN PROVIDER DASHBOARDS

After going live on `dunazoe.com`, update these in your payment dashboards:

- **Paystack:** `https://dunazoe.com/api/webhooks/paystack`
- **Stripe:** `https://dunazoe.com/api/webhooks/stripe`
- **Termii (SMS):** `https://dunazoe.com/api/webhooks/termii`

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Site not loading after 48h | Double-check the DNS records match exactly what Replit showed |
| SSL certificate error | Check TXT verification record is still in Namecheap |
| Login redirects broken | Update `FRONTEND_URL` secret in Replit |
| Payments not working | Update webhook URLs in Paystack/Stripe dashboard |

---

*Guide version: v1.0 — DUNAZOE v1.0.0-rc1*
