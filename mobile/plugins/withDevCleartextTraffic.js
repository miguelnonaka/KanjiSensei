const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withDevCleartextTraffic(config) {
  const isDevelopment = process.env.APP_VARIANT === "development";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (process.env.APP_VARIANT === "production" && (!apiUrl || !apiUrl.startsWith("https://"))) {
    throw new Error("Production builds require EXPO_PUBLIC_API_URL to use HTTPS.");
  }

  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android application manifest is missing.");

    application.$ = application.$ ?? {};
    application.$["android:usesCleartextTraffic"] = isDevelopment ? "true" : "false";
    return modConfig;
  });
};