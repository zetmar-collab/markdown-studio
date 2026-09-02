/**
 * Publishes the current build to the Microsoft Store through the submission API.
 *
 *   npm run store:publish            przygotowuje zgłoszenie i zatrzymuje się
 *   npm run store:publish -- --submit przygotowuje i wysyła do certyfikacji
 *
 * Without --submit the script stops after uploading the package and saving the
 * release notes, leaving a draft in Partner Center to review. Sending an app to
 * certification is public and effectively irreversible, so it never happens as
 * a side effect of running a build command.
 *
 * Required environment (an Azure AD application tied to the Partner Center
 * account — see README, section "Publikacja przez API"):
 *   PARTNER_TENANT_ID
 *   PARTNER_CLIENT_ID
 *   PARTNER_CLIENT_SECRET
 *   PARTNER_APP_ID        optional, defaults to the Store ID below
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_APP_ID = "9NTCFXN0QDC3";
const STORE_DIR = join("out", "store");
const STAGE_DIR = join("out", "store-upload");
const NOTES_PATH = join("store", "release-notes.json");

const args = process.argv.slice(2);
const shouldSubmit = args.includes("--submit");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(
      `Brak zmiennej środowiskowej ${name}.\n` +
        `  Wymagane: PARTNER_TENANT_ID, PARTNER_CLIENT_ID, PARTNER_CLIENT_SECRET.\n` +
        `  Instrukcja konfiguracji jest w README (Publikacja przez API).`
    );
  }
  return value;
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

/** The unsigned package for this exact version; Partner Center signs it itself. */
function findPackage() {
  const expected = join(STORE_DIR, `StudioMarkdown-${version}-store-unsigned.appx`);
  if (!existsSync(expected)) {
    fail(`Nie znaleziono pakietu ${expected}.\n` + `  Zbuduj go najpierw: npm run dist:store`);
  }
  return expected;
}

function loadReleaseNotes() {
  if (!existsSync(NOTES_PATH)) return {};
  try {
    return JSON.parse(readFileSync(NOTES_PATH, "utf8"));
  } catch (error) {
    fail(`${NOTES_PATH} nie jest poprawnym JSON-em: ${error.message}`);
  }
}

/**
 * The API expects a ZIP holding the packages. The .appx is already compressed,
 * so the archive is stored without compression — it keeps a 190 MB package fast
 * to pack instead of spending minutes re-deflating incompressible data.
 */
function buildZip(packagePath) {
  rmSync(STAGE_DIR, { recursive: true, force: true });
  mkdirSync(STAGE_DIR, { recursive: true });
  const zipPath = resolve(join(STAGE_DIR, `StudioMarkdown-${version}.zip`));
  const sourceDir = resolve(join(STAGE_DIR, "payload"));
  mkdirSync(sourceDir, { recursive: true });

  // A single quote inside a path would end the PowerShell literal early.
  const ps = (value) => value.replace(/'/g, "''");
  const script = `
    $ErrorActionPreference = 'Stop'
    Copy-Item -LiteralPath '${ps(resolve(packagePath))}' -Destination '${ps(join(sourceDir, basename(packagePath)))}'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
      '${ps(sourceDir)}', '${ps(zipPath)}',
      [System.IO.Compression.CompressionLevel]::NoCompression, $false)
  `;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], { stdio: "inherit" });
  if (result.status !== 0) fail("Nie udało się spakować pakietu do ZIP.");
  return zipPath;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const {
  getAccessToken,
  getApplication,
  createSubmission,
  updateSubmission,
  commitSubmission,
  getSubmissionStatus,
  deleteSubmission,
  uploadZip
} = await import("./lib/storeApi.mjs");

const appId = process.env.PARTNER_APP_ID || DEFAULT_APP_ID;
const credentials = {
  tenantId: requireEnv("PARTNER_TENANT_ID"),
  clientId: requireEnv("PARTNER_CLIENT_ID"),
  clientSecret: requireEnv("PARTNER_CLIENT_SECRET")
};

const packagePath = findPackage();
const notes = loadReleaseNotes();

console.log(`\n=== Studio Markdown ${version} → Microsoft Store ===\n`);
console.log(`  Pakiet   : ${packagePath} (${formatMb(statSync(packagePath).size)})`);
console.log(`  Store ID : ${appId}`);
console.log(
  `  Tryb     : ${shouldSubmit ? "wyślij do certyfikacji" : "przygotuj wersję roboczą"}\n`
);

const token = await getAccessToken(credentials);

// A submission already in progress blocks creating a new one.
const application = await getApplication(token, appId);
if (application.pendingApplicationSubmission?.id) {
  const pendingId = application.pendingApplicationSubmission.id;
  console.log(`  Usuwam otwarte zgłoszenie ${pendingId}…`);
  await deleteSubmission(token, appId, pendingId);
}

console.log("  Tworzę zgłoszenie (klon ostatnio opublikowanego)…");
const submission = await createSubmission(token, appId);
const submissionId = submission.id;

// Replace every previous package with the new one.
const packageName = basename(packagePath);
submission.applicationPackages = [
  ...(submission.applicationPackages ?? []).map((entry) => ({
    ...entry,
    fileStatus: "PendingDelete"
  })),
  { fileName: packageName, fileStatus: "PendingUpload" }
];

for (const [language, text] of Object.entries(notes)) {
  const listing = submission.listings?.[language];
  if (!listing?.baseListing) {
    console.log(`  ! Pomijam notatki dla ${language} — brak takiego listingu w zgłoszeniu`);
    continue;
  }
  listing.baseListing.releaseNotes = text;
  console.log(`  Notatki wydania: ${language}`);
}

const zipPath = buildZip(packagePath);
console.log(`  Archiwum : ${zipPath} (${formatMb(statSync(zipPath).size)})`);

let lastPercent = -1;
await uploadZip(submission.fileUploadUrl, zipPath, (done, total) => {
  const percent = Math.floor((done / total) * 100);
  if (percent !== lastPercent && percent % 5 === 0) {
    lastPercent = percent;
    process.stdout.write(`\r  Wysyłanie: ${percent}%   `);
  }
});
process.stdout.write("\r  Wysyłanie: 100%\n");

await updateSubmission(token, appId, submissionId, submission);
console.log("  Zgłoszenie zaktualizowane.");

rmSync(STAGE_DIR, { recursive: true, force: true });

const submissionUrl = `https://partner.microsoft.com/dashboard/products/${appId}/submissions/${submissionId}`;

if (!shouldSubmit) {
  console.log(`\n=== Wersja robocza gotowa ===`);
  console.log(`  ${submissionUrl}`);
  console.log(`\n  Sprawdź ją i wyślij ręcznie albo uruchom ponownie z --submit.\n`);
  process.exit(0);
}

console.log("  Wysyłam do certyfikacji…");
await commitSubmission(token, appId, submissionId);

let status = null;
for (let attempt = 0; attempt < 30; attempt++) {
  await new Promise((done) => setTimeout(done, 10000));
  status = await getSubmissionStatus(token, appId, submissionId);
  process.stdout.write(`\r  Status: ${status.status}                    `);
  if (status.status !== "CommitStarted") break;
}
process.stdout.write("\n");

if (status?.status === "CommitFailed") {
  const details = status.statusDetails?.errors ?? [];
  fail(
    `Zgłoszenie odrzucone przy commit:\n` +
      details.map((error) => `  - ${error.code}: ${error.details}`).join("\n")
  );
}

console.log(`\n=== Wysłane ===`);
console.log(`  Status: ${status?.status}`);
console.log(`  ${submissionUrl}\n`);
