import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  try {
    return typeof window !== "undefined" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function hideNativeSplash(): Promise<void> {
  if (!isNativeApp()) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide();
}

export async function configureNativeChrome(): Promise<void> {
  if (!isNativeApp()) return;
  const [{ StatusBar, Style }, { Keyboard, KeyboardResize }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/keyboard")
  ]);
  await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  await Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => undefined);
}

export async function writeNativeDocument(name: string, content: string): Promise<string> {
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const safe = name.replace(/[/\\]/g, "-") || "document.md";
  await Filesystem.writeFile({
    path: safe,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8
  });
  const { uri } = await Filesystem.getUri({ path: safe, directory: Directory.Documents });
  return uri;
}

export async function shareNativeFile(title: string, uri: string): Promise<void> {
  const { Share } = await import("@capacitor/share");
  await Share.share({ title, url: uri, dialogTitle: title });
}

export async function openNativeUrl(url: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
