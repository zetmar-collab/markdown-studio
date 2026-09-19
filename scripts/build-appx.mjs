/**
 * Builds the Microsoft Store packages.
 *
 *   node scripts/build-appx.mjs --store        unsigned .appx for Partner Center
 *   node scripts/build-appx.mjs --test         .appx signed with the local certificate
 *   node scripts/build-appx.mjs --store --test both
 *
 * The .appx is built exactly once and then copied, so the package you test is
 * byte-for-byte the package you submit apart from the signature:
 *
 *  - the Store package stays UNSIGNED on purpose. Partner Center re-signs
 *    submissions with the publisher certificate behind
 *    CN=15A53D32-C868-48EE-B700-5DBB5449CA1B; a self-signed package is rejected.
 *  - the test package is signed with the certificate of that same subject which
 *    is already installed locally, so it can be side-loaded.
 *
 * Signing uses the Windows SDK signtool rather than electron-builder's bundled
 * one: electron-builder dual-signs (SHA-1 plus an appended SHA-256), while an
 * AppX accepts exactly one SHA-256 signature, which makes its signtool fail
 * with "A required function is not present."
 *
 * The certificate is located by subject, or taken from MS_CERT_SHA1 when set.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { join } from "node:path";

const PUBLISHER_CN = "15A53D32-C868-48EE-B700-5DBB5449CA1B";
const OUT_DIR = join("out", "pack");
const STORE_DIR = join("out", "store");
const SDK_ROOT = "C:\\Program Files (x86)\\Windows Kits\\10\\bin";
/** electron-builder caches a real Windows Kits bundle; a usable fallback when the SDK is gone. */
const CACHED_KITS_ROOT = join(
  process.env.LOCALAPPDATA ?? "",
  "electron-builder",
  "Cache",
  "win-codesign@1.1.0"
);

const args = process.argv.slice(2);
const wantStore = args.includes("--store");
const wantTest = args.includes("--test");

if (!wantStore && !wantTest) {
  console.error("Użycie: node scripts/build-appx.mjs [--store] [--test]");
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} → kod ${result.status}`);
  }
}

/**
 * Newest Windows Kits signtool.exe.
 *
 * Prefers a locally installed SDK. When there is none — a Windows update or a
 * disk cleanup can take it away — it falls back to the Windows Kits bundle that
 * electron-builder caches, which is a genuine SDK signtool. Not to be confused
 * with the ancient one under Cache\winCodeSign, which cannot sign an AppX.
 */
function findSigntool() {
  const roots = [];
  if (existsSync(SDK_ROOT)) {
    for (const version of readdirSync(SDK_ROOT)
      .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
      .sort()
      .reverse()) {
      roots.push(join(SDK_ROOT, version, "x64", "signtool.exe"));
    }
  }
  if (existsSync(CACHED_KITS_ROOT)) {
    for (const bundle of readdirSync(CACHED_KITS_ROOT)
      .filter((name) => name.startsWith("windows-kits-bundle-"))
      .sort()
      .reverse()) {
      roots.push(join(CACHED_KITS_ROOT, bundle, "x64", "signtool.exe"));
    }
  }
  for (const candidate of roots) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Nie znaleziono signtool.exe ani w ${SDK_ROOT}\\*\\x64, ani w ${CACHED_KITS_ROOT}.\n` +
      `  Zainstaluj Windows 10/11 SDK albo uruchom raz "npm run dist:setup",\n` +
      `  żeby electron-builder pobrał swój zestaw narzędzi podpisujących.`
  );
}

/** Newest local certificate whose subject matches the Store publisher. */
function findSigningCertificate() {
  if (process.env.MS_CERT_SHA1) return process.env.MS_CERT_SHA1.trim();

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq 'CN=${PUBLISHER_CN}' -and $_.HasPrivateKey } | Sort-Object NotAfter -Descending | Select-Object -First 1 -ExpandProperty Thumbprint`
    ],
    { encoding: "utf8" }
  );
  const thumbprint = (result.stdout || "").trim();
  if (!thumbprint) {
    throw new Error(
      `Nie znaleziono certyfikatu CN=${PUBLISHER_CN} z kluczem prywatnym w Cert:\\CurrentUser\\My.\n` +
        `Ustaw MS_CERT_SHA1=<odcisk palca> albo zainstaluj certyfikat testowy.`
    );
  }
  return thumbprint;
}

/** The .appx electron-builder just produced. */
function newestAppx() {
  const candidates = readdirSync(OUT_DIR)
    .filter((file) => file.toLowerCase().endsWith(".appx"))
    .map((file) => ({ file, mtime: statSync(join(OUT_DIR, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!candidates.length) throw new Error(`Nie znaleziono pliku .appx w ${OUT_DIR}`);
  return join(OUT_DIR, candidates[0].file);
}

function copyTo(source, name) {
  mkdirSync(STORE_DIR, { recursive: true });
  const destination = join(STORE_DIR, name);
  if (existsSync(destination)) rmSync(destination);
  copyFileSync(source, destination);
  return destination;
}

function signPackage(file, thumbprint) {
  const signtool = findSigntool();
  // AppX supports exactly one signature and it must be SHA-256.
  run(`"${signtool}"`, ["sign", "/fd", "SHA256", "/sha1", thumbprint, `"${file}"`]);
}

function signatureOf(file) {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$s = Get-AuthenticodeSignature '${file}'; "$($s.Status) $($s.SignerCertificate.Subject)"`
    ],
    { encoding: "utf8" }
  );
  return (result.stdout || "").trim();
}

// package.json is the single source of truth for the version.
const appVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

console.log(`\n=== Studio Markdown ${appVersion} -> pakiety Microsoft Store ===\n`);

run("node", ["scripts/stop-running-app.mjs"]);
run("npm", ["run", "build"]);

// Nothing ambient may sign the package meant for Partner Center.
delete process.env.CSC_LINK;
delete process.env.WIN_CSC_LINK;
delete process.env.CSC_KEY_PASSWORD;
delete process.env.WIN_CSC_KEY_PASSWORD;

console.log("\n--- Budowanie pakietu AppX ---\n");
run("npx", ["electron-builder", "--win", "appx", "--publish", "never"]);
const built = newestAppx();

const produced = [];

if (wantStore) {
  const file = copyTo(built, `StudioMarkdown-${appVersion}-store-unsigned.appx`);
  produced.push({ file, kind: "Store (niepodpisany)" });
}

if (wantTest) {
  const thumbprint = findSigningCertificate();
  const file = copyTo(built, `StudioMarkdown-${appVersion}-test-signed.appx`);
  console.log(`\n--- Podpisywanie pakietu testowego (${thumbprint}) ---\n`);
  signPackage(file, thumbprint);
  produced.push({ file, kind: "Testowy (podpisany)" });
}

console.log("\n=== Gotowe ===");
for (const item of produced) {
  const size = (statSync(item.file).size / (1024 * 1024)).toFixed(1);
  console.log(`  ${item.kind.padEnd(22)} ${item.file}`);
  console.log(`  ${"".padEnd(22)} ${size} MB · ${signatureOf(item.file)}`);
}
console.log();
