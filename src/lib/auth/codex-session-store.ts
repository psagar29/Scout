import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type StoredCodexSessionRecord = {
  expiresAt: number;
  sealedSession: string;
};

const STORE_DIR = join(tmpdir(), "broker-scout-codex-sessions");

function sessionFilePath(sessionId: string) {
  return join(STORE_DIR, `${sessionId}.json`);
}

async function ensureStoreDir() {
  await mkdir(STORE_DIR, {
    recursive: true,
    mode: 0o700,
  });
}

export async function persistStoredCodexSession(
  sessionId: string,
  sealedSession: string,
  expiresAt: number,
) {
  await ensureStoreDir();
  await writeFile(
    sessionFilePath(sessionId),
    JSON.stringify({
      expiresAt,
      sealedSession,
    } satisfies StoredCodexSessionRecord),
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
}

export async function loadStoredCodexSession(sessionId: string) {
  try {
    const raw = await readFile(sessionFilePath(sessionId), "utf8");
    const parsed = JSON.parse(raw) as StoredCodexSessionRecord;
    if (
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.sealedSession !== "string" ||
      !parsed.sealedSession
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function deleteStoredCodexSession(sessionId: string) {
  try {
    await rm(sessionFilePath(sessionId), {
      force: true,
    });
  } catch {
    // Ignore missing or already-removed files.
  }
}
