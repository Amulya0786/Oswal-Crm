import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAP_SERVER_URL || "http://10.0.2.2:3000/field";

const config: CapacitorConfig = {
  appId: "com.oswal.service",
  appName: "Oswal Service",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, backgroundColor: "#02502f" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
