# PHONE_INSTALL.md
# DUNAZOE — Install on Phone (PWA + Operator Guide)

**Version:** v1.0.0-rc1  
**Generated:** 2026-06-29

---

## Install as App on Phone (PWA)

### Android (Chrome / Samsung Internet)

1. Open `https://dunazoe.com` in Chrome
2. Tap the menu (⋮) → "Add to Home Screen"
3. Tap "Add" → App appears on home screen
4. Open → works offline for static screens

### iPhone / iPad (Safari)

1. Open `https://dunazoe.com` in Safari
2. Tap Share button (📤)
3. Tap "Add to Home Screen"
4. Tap "Add" → App appears on home screen

### Deployment AI (Phone Mode)

1. Open `https://dunazoe.com/deploy`
2. Sign in with admin email + password
3. Install as PWA (same steps above)
4. Works on phone for: Audit, Deploy, Monitor, Features

---

## Operator Mode — Deploy from Phone

```
Phone → Browser → dunazoe.com/deploy → Admin Login
→ Run Audit → All Green? → Press DEPLOY
→ Monitor tab → check 72h
```

### Termius SSH App (for VPS ops)

1. Install Termius from Play Store / App Store
2. Add new host: IP + root + password
3. Run git/docker commands from phone

---

## PWA Features

| Feature | Status |
|---------|--------|
| Install prompt | ✅ Active |
| Offline mode | ✅ Static pages |
| Tablet mode | ✅ Responsive (max-width 520px → adapts) |
| Desktop mode | ✅ Full screen |
| Operator mode | ✅ /deploy |
| Dark theme | ✅ Navy/Blue (#0A0E1A) |

---

## Quick Actions from Phone

| Action | URL |
|--------|-----|
| Deploy | dunazoe.com/deploy |
| Build Studio | dunazoe.com/deploy/studio |
| API Status | dunazoe.com/deploy/apis |
| Features | dunazoe.com/deploy/features |
| GitHub | dunazoe.com/deploy/github |
| Monitor | dunazoe.com/deploy/monitor |

---
*DUNAZOE Deployment AI Control Plane*
