import jsPDF from "jspdf";

export function downloadPdf(text: string, filename = "cover-letter.pdf") {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxY = pageHeight - margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(text, maxWidth);
  let y = margin;

  for (const line of lines) {
    if (y + lineHeight > maxY) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  doc.save(filename);
}
