import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";

function inlineBoldRuns(text: string): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((p) => p)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({ text: part.slice(2, -2), bold: true });
      }
      // Strip any bare ** that weren't part of a matched bold pair
      return new TextRun({ text: part.replace(/\*\*/g, "") });
    });
}

function classifyLine(line: string): Paragraph {
  const trimmed = line.trim();

  if (!trimmed) {
    return new Paragraph({});
  }

  // ALL CAPS heading: length > 2, contains a letter, all uppercase
  if (
    trimmed.length > 2 &&
    /[A-Za-z]/.test(trimmed) &&
    trimmed === trimmed.toUpperCase()
  ) {
    return new Paragraph({
      text: trimmed,
      heading: HeadingLevel.HEADING_2,
    });
  }

  // Bullet point (•, -, or * followed by space — not **bold**)
  if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\*\s/.test(trimmed)) {
    return new Paragraph({
      children: inlineBoldRuns(trimmed.slice(1).trim()),
      bullet: { level: 0 },
    });
  }

  return new Paragraph({ children: inlineBoldRuns(trimmed) });
}

export async function downloadDocx(
  resumeText: string,
  filename = "curated-resume.docx"
): Promise<void> {
  const lines = resumeText.split("\n");
  const paragraphs = lines.map(classifyLine);

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
