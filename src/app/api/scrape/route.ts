import { NextRequest, NextResponse } from "next/server";
import { scrapeJobUrl } from "@/lib/scrape-job";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid URL" },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    console.log("[/api/scrape] Scraping URL:", url);
    const result = await scrapeJobUrl(url);
    console.log("[/api/scrape] Result:", { success: result.success, textLength: result.jobDescription?.length ?? 0 });
    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (error) {
    console.error("[/api/scrape] Error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
