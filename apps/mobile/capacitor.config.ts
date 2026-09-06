import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.mdword.mobile",
  appName: "MDWord",
  webDir: "../web/out",
  server: {
    androidScheme: "https"
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#ffffff",
      showSpinner: false
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#ffffff"
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "MDWord"
  }
};

export default config;
