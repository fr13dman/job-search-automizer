import type { ParseResumeResult } from "@/types";

export async function parseResume(
  buffer: Buffer,
  filename: string
): Promise<ParseResumeResult> {
  const ext = filename.toLowerCase().split(".").pop();

  try {
    if (ext === "pdf") {
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
      const trimmed = text?.trim();
      if (!trimmed) {
        return { success: false, error: "No text found in PDF" };
      }
      return { success: true, resumeText: trimmed };
    }

    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim();
      if (!text) {
        return { success: false, error: "No text found in DOCX" };
      }
      return { success: true, resumeText: text };
    }

    return { success: false, error: `Unsupported file type: .${ext}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: `Failed to parse file: ${message}` };
  }
}
