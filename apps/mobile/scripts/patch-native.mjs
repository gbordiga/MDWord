import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifest = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(manifest)) {
  const mdFilter = `            <!-- mdword-markdown -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="text/*" />
                <data android:pathPattern=".*\\\\.md" />
                <data android:pathPattern=".*\\\\.markdown" />
            </intent-filter>`;
  const xml = fs.readFileSync(manifest, "utf8");
  if (!xml.includes("mdword-markdown")) {
    const next = xml.replace(
      "</activity>",
      `${mdFilter}\n        </activity>`
    );
    if (next === xml) {
      console.warn("Could not patch AndroidManifest.xml activity");
    } else {
      fs.writeFileSync(manifest, next);
      console.log("Patched AndroidManifest.xml");
    }
  }
}

const plist = path.join(root, "ios", "App", "App", "Info.plist");
if (fs.existsSync(plist)) {
  const xml = fs.readFileSync(plist, "utf8");
  if (!xml.includes("MDWord Markdown")) {
    const block = `	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	<key>UIFileSharingEnabled</key>
	<true/>
	<key>LSSupportsOpeningDocumentsInPlace</key>
	<true/>
	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeName</key>
			<string>MDWord Markdown</string>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>LSHandlerRank</key>
			<string>Owner</string>
			<key>LSItemContentTypes</key>
			<array>
				<string>net.daringfireball.markdown</string>
				<string>public.plain-text</string>
			</array>
		</dict>
	</array>
`;
    const next = xml.replace("</dict>\n</plist>", `${block}</dict>\n</plist>`);
    if (next === xml) {
      console.warn("Could not patch Info.plist");
    } else {
      fs.writeFileSync(plist, next);
      console.log("Patched Info.plist");
    }
  }
}
