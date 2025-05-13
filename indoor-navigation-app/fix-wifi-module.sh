#!/bin/bash
echo "==== Wi-Fi Module Fix Script ===="
echo "Cleaning node_modules..."
rm -rf node_modules
rm -rf yarn.lock

echo "Reinstalling dependencies..."
npm install

echo "Cleaning Android build..."
cd android
./gradlew clean
cd ..

echo "Relinking native modules..."
npx react-native link react-native-wifi-reborn

echo "Rebuilding project..."
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

echo "Building Android APK..."
cd android
./gradlew assembleDebug
cd ..

echo "Done! The app should now work with Wi-Fi scanning."
echo "APK can be found at: ./android/app/build/outputs/apk/debug/app-debug.apk" 