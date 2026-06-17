# EMERGENCY GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**For:** Non-technical operators on phones  

---

## IF THE WEBSITE IS DOWN

### Check 1: Is it just you?
Go to `downforeveryoneorjustme.com` → type your Replit URL  
- If it's just you → clear browser cache, try a different network
- If it's everyone → continue below

### Check 2: Replit
1. Open Replit app on phone
2. Check if all workflows show ▶ (running)
3. If any are stopped → tap them to restart

### Check 3: Call the tech team
- WhatsApp group: DUNAZOE Tech
- Message: "Website down — [time] — error: [what you see]"

---

## IF PAYMENTS ARE FAILING

### Step 1 — Don't panic
No money is lost. Paystack holds it safely.

### Step 2 — Verify in Paystack Dashboard
1. Go to dashboard.paystack.com
2. Transactions → check if payment shows "failed" or "pending"
3. If "pending" → wait 30 minutes, it usually completes

### Step 3 — Notify tech team
"Payment failing for order #[ORDER_ID] — user [email] — amount ₦[amount]"

### Step 4 — Manual resolution
The tech team can:
- Issue refund via `/payments/refund`
- Check webhook logs
- Re-trigger payment notification

---

## IF USERS CANNOT LOGIN

Likely cause: Auth service restarted, sessions cleared

Solution:
1. Ask user to try again (session may have expired)
2. Tech team: restart auth service workflow in Replit
3. If still failing: check `JWT_SECRET` is still set in Replit Secrets

---

## EMERGENCY CONTACTS

| Role | Contact | Availability |
|---|---|---|
| CTO | [CTO phone] | 24/7 for P0 |
| Lead Dev | [Dev phone] | Business hours |
| Paystack Support | support@paystack.com | Business hours |
| Replit Support | support@replit.com | Business hours |

---

## EMERGENCY ROLLBACK (Do this yourself)

Only if site is completely down AND tech team is unreachable:

1. Open Replit on phone
2. Tap the 3-dot menu → History
3. Find checkpoint: `a20abd7c` (latest stable)
4. Tap Restore
5. Wait 2 minutes
6. Test: open the website

**Post in WhatsApp group:** "Rolled back to checkpoint a20abd7c at [time]. Website should be up."

---

## WHAT NOT TO DO IN AN EMERGENCY

❌ Do NOT delete any services or workflows  
❌ Do NOT change any secrets/environment variables  
❌ Do NOT issue refunds without checking with tech team  
❌ Do NOT deploy new code during an incident  

---

*DUNAZOE Emergency Guide v1.0.0-RC1 — 2026-06-16*
