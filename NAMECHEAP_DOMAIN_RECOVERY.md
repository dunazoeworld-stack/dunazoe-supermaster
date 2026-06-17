# NAMECHEAP_DOMAIN_RECOVERY.md — Phase 30
## DUNAZOE Domain Recovery Plan | 2026-06-17

## DO NOT EXECUTE YET
Only follow this plan AFTER 72-hour stable Replit beta.

---

## EXECUTION TIMELINE
```
Day 1:   Deploy on Replit → get .replit.app URL
Day 1-4: Beta test with .replit.app URL (test everything)
Day 4:   Renew Namecheap + configure DNS
Day 5-6: DNS propagation (24-48h)
Day 6+:  Full production on dunazoe.com
```

---

## STEP 1: RENEW DOMAIN
1. Go to https://namecheap.com → My Domains
2. Find dunazoe.com → click Renew
3. Complete payment
4. Wait for renewal confirmation email (usually instant)

## STEP 2: GET REPLIT PRODUCTION URL
After deploying:
```
https://<project-name>.replit.app
```
Note this URL — you'll point DNS to it.

## STEP 3: CONFIGURE DNS ON NAMECHEAP
In Namecheap → Domain List → dunazoe.com → Manage → Advanced DNS:

### Option A: Replit Custom Domain (recommended)
1. Replit → Deploy → Custom Domains → Add Domain
2. Enter: dunazoe.com
3. Namecheap will show you a CNAME/A record to add
4. Add it in Namecheap Advanced DNS
5. Click Verify in Replit

### Option B: Manual DNS
```
Type    Host    Value                        TTL
CNAME   @       <project-name>.replit.app    Auto
CNAME   www     <project-name>.replit.app    Auto
CNAME   app     <project-name>.replit.app    Auto
```

## STEP 4: SSL
- Replit Autoscale provides automatic TLS via Let's Encrypt
- No manual SSL configuration required
- Certificate issued automatically after DNS verification

## STEP 5: UPDATE ORIGINS
After DNS propagates, update ALLOWED_ORIGINS secret:
```
ALLOWED_ORIGINS=https://dunazoe.com,https://www.dunazoe.com,https://app.dunazoe.com,https://<replit-url>.replit.app
```
Restart services after updating.

## STEP 6: VERIFY
```bash
# DNS propagation check
nslookup dunazoe.com
# Expected: resolves to Replit IP

# Health check on custom domain
curl https://dunazoe.com/health
# Expected: 200 {"status":"ok"}

# SSL check
curl -I https://dunazoe.com
# Expected: HTTP/2 200, strict-transport-security header
```

## ROLLBACK (if domain switch fails)
1. Revert ALLOWED_ORIGINS to .replit.app URL only
2. Remove custom domain in Replit → Deploy → Custom Domains
3. Continue using .replit.app URL for users
4. Debug DNS issue and retry after 24h

---

## IMPORTANT NOTES
- Do NOT remove the .replit.app URL from ALLOWED_ORIGINS immediately
  (keep both during transition period)
- DNS propagation can take up to 48h globally
- Nigerian users may see faster propagation (~2-4h)
- Test from multiple locations/VPNs to confirm global propagation
