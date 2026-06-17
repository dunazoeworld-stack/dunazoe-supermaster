# ADMIN GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Audience:** Admin users (not tech team)  

---

## HOW TO ACCESS THE ADMIN AREA

1. Open your browser or Replit preview
2. Go to `/deploy`
3. Enter your admin email and password
4. You'll see the Deployment AI dashboard

---

## WHAT EACH PAGE DOES

| Page | What It Shows |
|---|---|
| `/deploy` | Run audits, deploy to production, view last deployment |
| `/deploy/monitor` | Live traffic — errors, orders, payments (updates every 30s) |
| `/deploy/status` | 14 service checks — PASS/WARN/FAIL for each |
| `/deploy/health` | Deep service health with auto-refresh |
| `/deploy/audit` | Run a fresh 5-gate quality audit |
| `/deploy/logs` | History of all deployment attempts |
| `/deploy/releases` | Version history |
| `/deploy/github` | GitHub push commands (copy-paste) |
| `/deploy/credits` | How many services running, RAM saved |
| `/deploy/checklist` | GO/NO-GO checklist before any deploy |

---

## DAILY ROUTINE

### Morning (2 minutes)
1. Open `/deploy/monitor` on your phone
2. Check: 🟢 HEALTHY? Good, nothing needed.
3. Check: any red/yellow? Message the tech team.

### Before Deploy (10 minutes)
1. `/deploy/checklist` → all items show PASS
2. `/deploy/audit` → run audit, all scores ≥85
3. `/deploy` → press 🚀 DEPLOY
4. Follow the generated steps

### After Deploy (30 minutes)
1. Keep `/deploy/monitor` open
2. Watch for any 🔴 alerts
3. If 🟢 after 30 minutes — you're good

---

## HOW TO READ THE MONITOR

```
🟢 HEALTHY — Everything is running perfectly
🟡 MONITORING — Minor issues, watch closely
🔴 ISSUES DETECTED — Contact tech team NOW
```

The 3 numbers shown:
- **Errors** — problems in the last hour (should be 0)
- **Orders** — new orders in the last hour
- **Payments** — successful payments in the last hour

---

## HOW TO DEPLOY (Step by Step)

1. Go to `/deploy` on your phone
2. Enter your admin password
3. Choose Environment: Production
4. Choose Host: Replit (for now)
5. Tap **🔍 Run Deployment Audit**
6. Wait ~30 seconds for results
7. If all scores are green → tap **🚀 DEPLOY TO PRODUCTION**
8. Follow the checklist that appears (tap each step when done)
9. Open `/deploy/monitor` and watch for 30 minutes

---

## WHAT TO DO IF SOMETHING LOOKS WRONG

| What You See | What To Do |
|---|---|
| 🔴 on monitor | Take screenshot → message tech team |
| Score below 85 | Do NOT deploy → fix issues first |
| Payment failing | Check Paystack dashboard → message support |
| Site is down | Replit → History → Restore checkpoint |

---

*DUNAZOE Admin Guide v1.0.0-RC1 — 2026-06-16*
