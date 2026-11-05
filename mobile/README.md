# Oswal Service technician app

Native Android and iOS shell around the technician desk at `/field`. The screens, Hindi and English, offline queue, GPS and camera prompts stay in the web app. This folder adds the store build.

## What the phone does

- Offline closes, photos and voice notes wait on the phone and sync when the network returns. The desk already queues failed saves.
- Punch-in and close read GPS. On a device build, `@capacitor/geolocation` is available for a background-safe read.
- Proof photos can use the native camera (`@capacitor/camera`). The page also accepts a normal photo pick.
- Push uses FCM on Android and APNs on iOS. Without `FCM_SERVER_KEY` or `APNS_KEY_ID` the server only logs the alert.

## Accounts

- Google Play Developer account, to upload an AAB.
- Apple Developer account, plus a Mac with Xcode, to archive and send a build to TestFlight.

## Android APK or AAB

From this folder, with Node 22, a JDK 17, and the Android SDK:

```bash
npm install
export CAP_SERVER_URL=https://your-desk.example/field
npx cap add android
npm run android
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

For Play Store, open Android Studio (`npm run android:open`) and build a signed AAB (Build → Generate Signed Bundle).

## iOS

On a Mac:

```bash
npm install
export CAP_SERVER_URL=https://your-desk.example/field
npx cap add ios
npm run ios:open
```

In Xcode, set the signing team, then Product → Archive and upload to App Store Connect / TestFlight.

## Icon and splash

Use `public/brand/pumps-logo.png` from the desk repo as `www/icon.png`. The splash background is Oswal green `#02502f`.

`CAP_SERVER_URL` must be the public `/field` address. The Android emulator default in config is `http://10.0.2.2:3000/field`.
