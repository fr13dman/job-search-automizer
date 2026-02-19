import { NextRequest, NextResponse } from "next/server";
import { parseResume } from "@/lib/parse-resume";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    console.log("[/api/parse-resume] Parsing file:", file.name, "size:", file.size);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseResume(buffer, file.name);
    console.log("[/api/parse-resume] Result:", { success: result.success, textLength: result.resumeText?.length ?? 0 });

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (error) {
    console.error("[/api/parse-resume] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process upload" },
      { status: 400 }
    );
  }
}
