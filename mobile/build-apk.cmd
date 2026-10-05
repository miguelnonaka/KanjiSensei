@echo off
setlocal
cd /d "%~dp0"

if not exist android\gradlew.bat (
	call npx.cmd expo prebuild --platform android
	if errorlevel 1 exit /b 1
)

call android\gradlew.bat -p android assembleRelease -PreactNativeArchitectures=arm64-v8a
if errorlevel 1 exit /b 1

if not exist android\app\build\outputs\apk\release\app-release.apk exit /b 1
echo APK pronto: %~dp0android\app\build\outputs\apk\release\app-release.apk