# Kamiko SEO MCP Android — experimental APK

This is a **local caption extraction prototype**, not yet a remote MCP companion. Share a YouTube URL to the app or paste one, then extract accessible subtitle segments and copy the result. YouTube frequently blocks unofficial caption requests; failure is expected for some videos. No login, pairing, background service or cloud upload is implemented. Never advertise it as synchronized to the remote MCP.

Build: GitHub Actions workflow **Build Kamiko Android APK** creates a downloadable **debug APK artifact**. It is a debug-signed test build, not a production release. To build locally use Android SDK 35, JDK 17 and Gradle 8.9: `gradle :app:assembleDebug` from this directory.

Future remote synchronization requires authenticated device pairing, short-lived credentials, a secure job queue and server-side authorization checks. Do not send Google OAuth secrets to this app.
