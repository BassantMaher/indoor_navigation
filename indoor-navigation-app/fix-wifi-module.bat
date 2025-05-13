@echo off
echo ==== Wi-Fi Module Fix Script ====
echo Cleaning node_modules...
rmdir /s /q node_modules
del yarn.lock

echo Reinstalling dependencies...
call npm install

echo Cleaning Android build...
cd android
call gradlew clean
cd ..

echo Relinking native modules...
call npx react-native link react-native-wifi-reborn

echo Rebuilding project...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

echo Building Android APK...
cd android
call gradlew assembleDebug
cd ..

echo Done! The app should now work with Wi-Fi scanning.
echo APK can be found at: ./android/app/build/outputs/apk/debug/app-debug.apk
pause 