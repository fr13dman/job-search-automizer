import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import { mkdir, writeFile } from "node:fs/promises";

/** Expand a leading ~ to the user's home directory (shell-style). */
function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

export async function GET() {
  return NextResponse.json({ rootFolder: process.env.ROOT_FOLDER ?? null });
}

interface SaveFile {
  name: string;
  content: string; // base64-encoded PDF bytes
}

interface SaveRequest {
  rootFolder: string;
  folderName: string;
  files: SaveFile[];
}

export async function POST(request: Request) {
  let body: SaveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rootFolder, folderName, files } = body;

  if (
    !rootFolder ||
    typeof rootFolder !== "string" ||
    !folderName ||
    typeof folderName !== "string" ||
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Expand ~ and resolve to an absolute path
  const targetDir = path.resolve(expandHome(rootFolder), folderName);

  console.log("[/api/save-documents] Writing to:", targetDir);

  try {
    await mkdir(targetDir, { recursive: true });

    for (const file of files) {
      if (!file.name || !file.content) continue;
      const buffer = Buffer.from(file.content, "base64");
      await writeFile(path.join(targetDir, file.name), buffer);
    }

    console.log("[/api/save-documents] Saved", files.length, "files to", targetDir);
    return NextResponse.json({ success: true, path: targetDir });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/save-documents] Error:", code, message);
    return NextResponse.json(
      { error: `Failed to save files: ${message}`, code },
      { status: 500 }
    );
  }
}
