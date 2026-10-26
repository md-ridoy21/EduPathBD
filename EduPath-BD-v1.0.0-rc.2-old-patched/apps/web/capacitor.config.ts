import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "bd.edupath.app",
  appName: "EduPath BD",
  webDir: "dist",
  android: {
    allowMixedContent: process.env.CAPACITOR_ALLOW_MIXED_CONTENT === "true"
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#10b981"
    },
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      hidden: false,
      animation: "NONE"
    }
  },
  server: {
    androidScheme: "https"
  }
};

export default config;
