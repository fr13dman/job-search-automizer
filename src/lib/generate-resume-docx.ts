import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  UnderlineType,
} from "docx";
import { stripNonBoldMarkdown, stripCuratedMarkers } from "@/lib/clean-markdown";
import { convertInchesToTwip } from "docx";

const ORANGE = "C55A11";
const TEXT_DARK = "1A1A1A";
const TEXT_MID = "444444";
const TEXT_GRAY = "666666";
const STRIPE_PCT = 4; // narrow orange left stripe
const CONTENT_PCT = 96;

function cellNoBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function tableNoBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}

function makeRuns(text: string, bold = false, color = TEXT_DARK, size = 20): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      const isBold = part.startsWith("**") && part.endsWith("**");
      const cleanText = isBold ? part.slice(2, -2) : part.replace(/\*\*/g, "");
      return new TextRun({ text: cleanText, bold: isBold || bold, color, size });
    });
}

function classifyLine(line: string): Paragraph {
  const trimmed = line.trim();

  if (!trimmed) {
    return new Paragraph({ spacing: { after: 40 } });
  }

  // ALL CAPS section heading
  if (trimmed.length > 2 && /[A-Za-z]/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
    return new Paragraph({
      children: [
        new TextRun({
          text: trimmed,
          bold: true,
          size: 24,
          color: TEXT_DARK,
        }),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 2 },
      },
      spacing: { before: 200, after: 80 },
    });
  }

  // Bullet
  if (trimmed.startsWith("•") || trimmed.startsWith("-") || /^\*\s/.test(trimmed)) {
    const bulletText = trimmed.slice(1).trim();
    return new Paragraph({
      children: [
        new TextRun({ text: "● ", color: ORANGE, size: 18 }),
        ...makeRuns(bulletText, false, TEXT_MID, 18),
      ],
      indent: { left: 200 },
      spacing: { after: 40 },
    });
  }

  return new Paragraph({
    children: makeRuns(trimmed, false, TEXT_MID, 18),
    spacing: { after: 40 },
  });
}

export async function downloadResumeDocx(
  resumeText: string,
  filename = "curated-resume.docx"
): Promise<void> {
  const cleaned = stripNonBoldMarkdown(stripCuratedMarkers(resumeText));
  const rawLines = cleaned.split("\n");

  // First two non-empty lines are name + contact — render them specially
  const contentParagraphs: Paragraph[] = [];
  let headerCount = 0;
  let firstSectionSeen = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      contentParagraphs.push(new Paragraph({ spacing: { after: 40 } }));
      continue;
    }

    // ALL CAPS section heading check
    const isHeading =
      trimmed.length > 2 && /[A-Za-z]/.test(trimmed) && trimmed === trimmed.toUpperCase();
    if (isHeading) firstSectionSeen = true;

    if (!firstSectionSeen && headerCount < 2) {
      if (headerCount === 0) {
        // Name — large bold
        contentParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.replace(/\*\*/g, ""),
                bold: true,
                size: 52,
                color: TEXT_DARK,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      } else {
        // Contact line — smaller, medium weight
        contentParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.replace(/\*\*/g, ""),
                bold: true,
                size: 18,
                color: TEXT_GRAY,
                underline: { type: UnderlineType.NONE },
              }),
            ],
            spacing: { after: 120 },
          })
        );
      }
      headerCount++;
      continue;
    }

    contentParagraphs.push(classifyLine(rawLine));
  }

  const cnb = cellNoBorders();
  const nb = tableNoBorders();

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: nb,
    rows: [
      new TableRow({
        children: [
          // Orange stripe
          new TableCell({
            width: { size: STRIPE_PCT, type: WidthType.PERCENTAGE },
            shading: { fill: ORANGE, type: ShadingType.CLEAR, color: "auto" },
            borders: cnb,
            children: [new Paragraph({ children: [new TextRun({ text: " " })] })],
          }),
          // Resume content
          new TableCell({
            width: { size: CONTENT_PCT, type: WidthType.PERCENTAGE },
            borders: cnb,
            margins: {
              top: convertInchesToTwip(0.15),
              left: convertInchesToTwip(0.2),
              bottom: convertInchesToTwip(0.15),
              right: convertInchesToTwip(0.15),
            },
            children: contentParagraphs,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.3),
            },
          },
        },
        children: [table],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
