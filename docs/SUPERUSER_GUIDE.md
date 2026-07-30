# DUNAZOE Superuser Operations Guide
**Date:** 2026-07-30

---

## Accessing the Superuser Control Center

URL: `/admin`

Required roles: `super_admin`, `admin`, `coordinator`, `operator`

### To grant superuser access (run in database):
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';
```

---

## Tab-by-Tab Guide

### Overview
- See platform-wide stats at a glance
- Use Quick Access links for DevOps tools
- Review RBAC Permission Matrix

### Users Tab
- **Search**: Type name or email to filter
- **Suspend**: Blocks user login (coordinator+ only)
- **Verify**: Marks user as identity-verified (coordinator+ only)
- Roles displayed as color-coded badges

### Vendors Tab
- **Approve**: Activates vendor account for selling (coordinator+ only)
- **Suspend**: Disables vendor store (coordinator+ only)
- **View Products**: Opens product listing filtered by vendor
- Logos shown if vendor uploaded one during onboarding

### Products Tab
- Grid view with product images
- **Approve**: Makes product visible to buyers (coordinator+ only)
- **Hide**: Removes product from search without deleting (coordinator+ only)
- AI Listing badge shown for AI-assisted products

### Orders Tab
- Real-time order list with status badges
- Click **View →** to see full order detail and delivery status
- Filter by status using search box

### Payments Tab
- Summary: Total, Successful, Failed, Pending counts
- Transaction ledger with TXN-XXXXX IDs
- Search by reference number or payment type

### Disputes Tab
- **Review**: Sets status to Under Review (sends notification to buyer)
- **Resolve**: Closes dispute in favour of investigation outcome
- **Escalate**: Sends to senior mediation team
- DSP-XXXXX short IDs used throughout

---

## Common Tasks

### Suspend a vendor
1. Go to Vendors tab
2. Find vendor by name
3. Click **🚫 Suspend**
4. Vendor cannot log in or sell; their products hidden

### Approve a new vendor
1. Go to Vendors tab
2. Find pending vendor
3. Click **✅ Approve**
4. Vendor activated; receives notification

### Resolve a dispute
1. Go to Disputes tab
2. Click dispute to expand
3. Review description
4. Choose: **Review → Resolve** or **Escalate**

### Create a new admin
Only SUPERUSER can do this — update directly in database:
```sql
UPDATE users SET role = 'admin' WHERE email = 'new-admin@example.com';
```

---

## Status Codes

| Badge | Meaning |
|-------|---------|
| 🟢 Active / Approved / Published | Live and operational |
| 🟡 Pending / Processing | Awaiting action |
| 🔴 Suspended / Cancelled / Failed | Blocked or failed |
| 🔵 Open / Shipped | In progress |
| ⚫ Closed / Hidden | Inactive |
