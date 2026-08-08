import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.otterhub.music",
  appName: "倾听音乐",
  webDir: "dist",
  plugins: {
    SystemBars: {
      insetsHandling: "css",
    },
  },
};

export default config;
