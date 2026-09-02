/**
 * Thin client for the Microsoft Store submission API (v1).
 *
 * Kept apart from the publish script so the request/response handling can be
 * read — and reasoned about — without the orchestration around it.
 *
 * https://learn.microsoft.com/windows/uwp/monetize/create-and-manage-submissions-using-windows-store-services
 */
import { createReadStream, statSync } from "node:fs";

const LOGIN_HOST = "https://login.microsoftonline.com";
const API_BASE = "https://manage.devcenter.microsoft.com/v1.0/my";
const RESOURCE = "https://manage.devcenter.microsoft.com";

/** Azure Blob rejects a single PUT above 256 MiB, and smaller blocks retry cheaper. */
const BLOCK_SIZE = 8 * 1024 * 1024;

class StoreApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "StoreApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * The API reports validation problems inside a 200 response as well as through
 * HTTP status codes, so both paths funnel into one readable error.
 */
function describeErrors(body) {
  if (!body || typeof body !== "object") return "";
  const errors = Array.isArray(body.errors) ? body.errors : [];
  if (!errors.length) return "";
  return errors
    .map((error) => `  - ${error.code ?? "?"}: ${error.details ?? error.message ?? ""}`)
    .join("\n");
}

export async function getAccessToken({ tenantId, clientId, clientSecret }) {
  const response = await fetch(`${LOGIN_HOST}/${tenantId}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      resource: RESOURCE
    })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token) {
    throw new StoreApiError(
      `Nie udało się pobrać tokenu (${response.status}). Sprawdź PARTNER_TENANT_ID / CLIENT_ID / CLIENT_SECRET.`,
      response.status,
      body
    );
  }
  return body.access_token;
}

async function request(token, method, path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const details = describeErrors(body);
    throw new StoreApiError(
      `${method} ${path} → ${response.status}${details ? `\n${details}` : ""}`,
      response.status,
      body
    );
  }
  return body;
}

export const getApplication = (token, appId) => request(token, "GET", `/applications/${appId}`);

export const createSubmission = (token, appId) =>
  request(token, "POST", `/applications/${appId}/submissions`);

export const updateSubmission = (token, appId, submissionId, submission) =>
  request(token, "PUT", `/applications/${appId}/submissions/${submissionId}`, submission);

export const commitSubmission = (token, appId, submissionId) =>
  request(token, "POST", `/applications/${appId}/submissions/${submissionId}/commit`);

export const getSubmissionStatus = (token, appId, submissionId) =>
  request(token, "GET", `/applications/${appId}/submissions/${submissionId}/status`);

export const deleteSubmission = (token, appId, submissionId) =>
  request(token, "DELETE", `/applications/${appId}/submissions/${submissionId}`);

function blockId(index) {
  // Every block id must decode to the same byte length, hence the padding.
  return Buffer.from(String(index).padStart(6, "0")).toString("base64");
}

/**
 * Uploads the ZIP to the SAS URL in block-sized pieces.
 *
 * A single PUT would also fit under Azure's 256 MiB ceiling, but blocks give
 * progress output and let one failed piece be retried instead of the whole
 * 190 MB archive.
 */
export async function uploadZip(fileUploadUrl, zipPath, onProgress = () => {}) {
  // The API returns the SAS with a literal "+" that must survive as-is.
  const sasUrl = fileUploadUrl.replace(/\+/g, "%2B");
  const total = statSync(zipPath).size;
  const ids = [];
  let index = 0;
  let uploaded = 0;

  const stream = createReadStream(zipPath, { highWaterMark: BLOCK_SIZE });
  let pending = Buffer.alloc(0);

  const putBlock = async (chunk) => {
    const id = blockId(index++);
    ids.push(id);
    const response = await fetch(`${sasUrl}&comp=block&blockid=${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "x-ms-version": "2021-08-06", "Content-Length": String(chunk.length) },
      body: chunk
    });
    if (!response.ok) {
      throw new StoreApiError(
        `Wysyłka bloku ${index} nie powiodła się (${response.status}): ${await response.text()}`,
        response.status
      );
    }
    uploaded += chunk.length;
    onProgress(uploaded, total);
  };

  for await (const chunk of stream) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (pending.length >= BLOCK_SIZE) {
      await putBlock(pending.subarray(0, BLOCK_SIZE));
      pending = pending.subarray(BLOCK_SIZE);
    }
  }
  if (pending.length) await putBlock(pending);

  const list = `<?xml version="1.0" encoding="utf-8"?><BlockList>${ids
    .map((id) => `<Latest>${id}</Latest>`)
    .join("")}</BlockList>`;

  const commit = await fetch(`${sasUrl}&comp=blocklist`, {
    method: "PUT",
    headers: { "x-ms-version": "2021-08-06", "Content-Type": "application/xml" },
    body: list
  });
  if (!commit.ok) {
    throw new StoreApiError(
      `Sklejenie bloków nie powiodło się (${commit.status}): ${await commit.text()}`,
      commit.status
    );
  }
}

export { StoreApiError };
