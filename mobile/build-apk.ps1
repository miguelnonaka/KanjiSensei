$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
  $gradle = Join-Path $PSScriptRoot "android\gradlew.bat"
  if (-not (Test-Path $gradle)) {
    npx.cmd expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) { throw "Expo prebuild failed." }
  }

  if (-not (Test-Path $gradle)) { throw "Gradle wrapper was not generated." }

  & $gradle -p (Join-Path $PSScriptRoot "android") assembleRelease -PreactNativeArchitectures=arm64-v8a
  if ($LASTEXITCODE -ne 0) { throw "Android release build failed." }

  $apk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path $apk)) { throw "Release APK was not found at $apk" }
  Write-Host "APK pronto: $apk"
}
finally {
  Pop-Location
}