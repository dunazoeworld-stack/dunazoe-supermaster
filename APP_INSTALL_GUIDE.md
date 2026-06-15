# APP INSTALL GUIDE
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  
**Phase:** 4 — App Accessibility  

> APK does not exist yet. DUNAZOE is available as a **PWA** (Progressive Web App).
> Users install it from the browser — no app store required.

---

## How to Install DUNAZOE (PWA)

### Android (Chrome)

1. Open Chrome on your Android phone
2. Go to `https://dunazoe.com`
3. Tap the **⋮ menu** (three dots, top right)
4. Tap **"Add to Home screen"**
5. Tap **"Add"** on the confirmation dialog
6. DUNAZOE icon appears on your home screen
7. Tap it — opens fullscreen, like a native app

### iOS (Safari)

1. Open Safari on your iPhone or iPad
2. Go to `https://dunazoe.com`
3. Tap the **Share button** (box with arrow, bottom bar)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** (top right)
6. DUNAZOE icon appears on your home screen

### Desktop (Chrome / Edge)

1. Go to `https://dunazoe.com`
2. Look for the install icon (⊕) in the address bar
3. Click **"Install DUNAZOE"**
4. App opens in its own window

---

## What the PWA Includes

| Feature | Included |
|---|---|
| Installable to home screen | ✅ |
| Offline fallback page | ✅ (service worker caches homepage + products) |
| Full marketplace | ✅ |
| Wallet + orders | ✅ |
| Vendor dashboard | ✅ |
| Admin panel | ✅ |
| Push notifications (future) | 🔜 Sprint 2 |

---

## PWA Files Added

| File | Purpose |
|---|---|
| `apps/core/frontend/public/manifest.json` | App name, icons, theme, shortcuts |
| `apps/core/frontend/public/sw.js` | Service worker — offline caching |
| `apps/core/frontend/src/app/layout.jsx` | Meta tags for iOS/Android install |

---

## Icons Required (Operator Action)

Place these two PNG files in `apps/core/frontend/public/`:

| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192×192 px | Used by Android Chrome install prompt |
| `icon-512.png` | 512×512 px | Used by Play Store PWA listing + splash screens |

Use the DUNAZOE logo. Export from any image editor or use [https://realfavicongenerator.net](https://realfavicongenerator.net).

---

## Register Service Worker (Add to Homepage)

Add this script to `apps/core/frontend/src/app/page.jsx` (or a client layout):

```jsx
"use client";
import { useEffect } from "react";
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
```

Then add `<RegisterSW />` inside the homepage component.

---

## Android APK / Google Play (Future)

| Step | Timeline |
|---|---|
| Build Expo mobile app | 3–4 weeks post-launch |
| Generate APK via EAS | `eas build --platform android --profile preview` |
| Generate AAB for Play Store | `eas build --platform android --profile production` |
| Direct APK download link | `https://dunazoe.com/download/dunazoe.apk` |
| Google Play listing | After AAB approved by Play Console |

---

*Generated: 2026-06-15 — DUNAZOE CTO / Release Director*
