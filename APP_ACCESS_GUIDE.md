# APP ACCESSIBILITY GUIDE
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 9 — App Accessibility  

---

## How Users Can Get DUNAZOE

### Channel 1 — Website (Available at Launch)

Users visit `https://dunazoe.com` in any browser.

- No installation required
- Works on desktop, mobile browser, tablet
- Full marketplace functionality (browse, buy, sell, wallet, orders)
- Recommended for go-live day one

---

### Channel 2 — PWA Install (Available at Launch — 10 min setup)

Users on Chrome (Android) or Safari (iOS) can install DUNAZOE directly from the website.

**How it works:**
1. User visits `https://dunazoe.com` on mobile
2. Browser shows "Add to Home Screen" banner automatically (once `manifest.json` is added)
3. User taps install → DUNAZOE icon appears on home screen
4. App opens in standalone mode (no browser chrome, full screen)

**What's needed:**
- Add `apps/core/frontend/public/manifest.json` (template in `APP_RELEASE_REPORT.md`)
- Add `<link rel="manifest">` to `layout.jsx`
- Place 192×192 and 512×512 PNG icons in `public/`
- **Time required:** 10–15 minutes

**PWA advantages:** Works offline (with service worker), installable, push notifications possible.

---

### Channel 3 — Android APK Direct Download (Post-Build)

After the Expo mobile app is built:

1. Host the APK at `https://dunazoe.com/download/dunazoe.apk`
2. Add a "Download App" button to the website homepage
3. Users tap the button, download APK, enable "Install from unknown sources", install

**APK download page copy:**
```
📱 Download DUNAZOE for Android
Tap the button below to download and install.
Version 1.0.0 | ~30MB | Android 8.0+
[Download APK]
```

---

### Channel 4 — Google Play Store (Post-Build)

After AAB is generated via EAS:

1. Create Google Play Developer account ($25 one-time fee)
2. Upload AAB to Play Console
3. Complete store listing (description, screenshots, privacy policy)
4. Submit for review (~1–3 days)
5. Live at: `https://play.google.com/store/apps/details?id=com.dunazoe.app`

**Required assets:**
- App icon 512×512 PNG
- Feature graphic 1024×500 PNG
- At least 2 phone screenshots
- Privacy policy URL (add `/privacy` page to website)

---

### Channel 5 — iOS App Store (Post-Build + Apple Dev Account)

After IPA is generated via EAS:

1. Enrol in Apple Developer Program ($99/year)
2. Build IPA: `eas build --platform ios --profile production`
3. Upload via Transporter or `eas submit --platform ios`
4. Submit for App Store review (~1–2 days)

---

## Launch Day Priority

| Channel | Ready? | Action |
|---|---|---|
| Website (`dunazoe.com`) | ✅ Ready | Deploy and point DNS |
| PWA Install | ⏸ 10 min work | Add manifest.json + icons |
| Android APK | ⏸ 3–4 weeks | Build Expo app |
| Google Play | ⏸ After APK | Submit AAB |
| iOS App Store | ⏸ After APK | Submit IPA + Apple Dev account |

---

## Recommendation

**Go live on website + PWA first.** This covers 100% of users on day one with zero app store wait time. Build and release the native app in parallel over 3–4 weeks.

---

*Generated: 2026-06-15 — DUNAZOE CTO / Release Director*
