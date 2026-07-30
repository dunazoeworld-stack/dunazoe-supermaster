# DUNAZOE Dispute Flow
**Date:** 2026-07-30

---

## Dispute Lifecycle

```
Buyer Raises Dispute
       ↓
  Status: OPEN
       ↓
  Team Reviews
       ↓
  Status: UNDER REVIEW
       ↓
  Decision Made
    ↙         ↘
RESOLVED    ESCALATED
    ↓              ↓
CLOSED      Senior Review
                   ↓
              RESOLVED / CLOSED
```

---

## Status Definitions

| Status | Badge | Meaning |
|--------|-------|---------|
| `open` | 🔵 Open | Dispute received, awaiting review (24-48h) |
| `under_review` | 🟡 Under Review | Team actively investigating |
| `resolved` | ✅ Resolved | Investigation complete, decision made |
| `escalated` | 🔴 Escalated | Sent to senior mediation team |
| `closed` | ⚫ Closed | Case closed (no further action) |

---

## For Buyers

### Raise a Dispute
1. Go to `/disputes`
2. Click **"+ Raise Dispute"**
3. Enter Order ID (e.g. ORD-00123)
4. Select reason:
   - Item not received
   - Wrong item delivered
   - Item arrived damaged
   - Seller not responding
   - Payment issue
   - Refund request
   - Other
5. Write detailed description
6. Submit

### Track Your Dispute
- Visit `/disputes`
- Filter by status (All / Open / Under Review / Escalated / Resolved)
- Click dispute card to expand and see **Case Timeline**
- Timeline shows progress: **Created → Under Review → Resolved**

---

## For Admins

### Review Disputes (`/admin` → Disputes tab)
- **🔍 Review**: Sets to `under_review` + notifies buyer
- **✅ Resolve**: Sets to `resolved` + notifies buyer of outcome
- **🔺 Escalate**: Sets to `escalated` + notifies senior team

---

## API Routes

```
GET  /api/disputes              — List user's disputes
POST /api/disputes              — Raise new dispute
GET  /api/disputes/:id          — Get dispute detail
PUT  /api/disputes/:id          — Update status (admin only)

GET  /api/admin/disputes        — List ALL disputes (admin)
```

---

## Notifications

When dispute status changes, buyer receives:
- In-app notification (via notification-service)
- Notification bell update

---

## Resolution Timeline

| Stage | Target Response Time |
|-------|---------------------|
| Acknowledgement | Immediate (auto) |
| First review | 24–48 hours |
| Resolution | 3–7 business days |
| Escalated cases | 7–14 business days |

---

## Status: IMPLEMENTED ✅
