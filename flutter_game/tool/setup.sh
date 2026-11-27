#!/usr/bin/env bash
# One-time setup for flutter_game: generates the platform folders, then lets each
# platform talk to the local backend (http://...:3000). Safe to run again.
#   cd flutter_game && bash tool/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

flutter create . --project-name type_to_run --platforms=android,ios,macos,web,windows,linux
flutter pub get

# macOS: the app sandbox blocks network access unless this entitlement is present.
for f in macos/Runner/DebugProfile.entitlements macos/Runner/Release.entitlements; do
  [ -f "$f" ] || continue
  if ! grep -q "com.apple.security.network.client" "$f"; then
    perl -0pi -e 's#<dict>#<dict>\n\t<key>com.apple.security.network.client</key>\n\t<true/>#' "$f"
    echo "✓ network access enabled in $f"
  fi
done

# Android: allow plain-http to your dev backend, and internet access in release builds.
m=android/app/src/main/AndroidManifest.xml
if [ -f "$m" ]; then
  grep -q 'android.permission.INTERNET' "$m" || \
    perl -0pi -e 's#(<manifest[^>]*>)#$1\n    <uses-permission android:name="android.permission.INTERNET"/>#' "$m"
  grep -q 'usesCleartextTraffic' "$m" || \
    perl -0pi -e 's#<application#<application\n        android:usesCleartextTraffic="true"#' "$m"
  echo "✓ Android: INTERNET permission + cleartext http to the dev backend"
fi

# iOS: allow plain-http to local addresses (localhost / LAN) for development.
p=ios/Runner/Info.plist
if [ -f "$p" ] && ! grep -q "NSAllowsLocalNetworking" "$p"; then
  perl -0pi -e 's#<dict>#<dict>\n\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>#' "$p"
  echo "✓ iOS: local-network http allowed"
fi

echo
echo "Done. Commit the new platform folders so teammates don't have to run this."
echo "Start the backend (cd ../backend && npm run dev), then: flutter run -d macos   (or -d chrome)"
