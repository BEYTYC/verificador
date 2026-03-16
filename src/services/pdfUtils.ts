import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateOrderedPdfWithTOC(
  originalPdfBase64: string, 
  checklist: { requirement: string; status: string; pageRange?: string }[],
  studentName: string
): Promise<Uint8Array> {
  const originalPdfBytes = Uint8Array.from(atob(originalPdfBase64), c => c.charCodeAt(0));
  const originalPdf = await PDFDocument.load(originalPdfBytes);
  const newPdf = await PDFDocument.create();
  
  // Add Reordered Pages
  for (const item of checklist) {
    if (!item.pageRange) continue;

    const parts = item.pageRange.split('-').map(p => parseInt(p.trim()));
    let start = parts[0];
    let end = parts.length > 1 ? parts[1] : start;

    if (isNaN(start)) continue;

    start = Math.max(1, start) - 1;
    end = Math.min(originalPdf.getPageCount(), end) - 1;

    if (start > end) continue;

    const pagesToCopy = [];
    for (let i = start; i <= end; i++) {
      pagesToCopy.push(i);
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pagesToCopy);
    copiedPages.forEach(page => newPdf.addPage(page));
  }

  return await newPdf.save();
}

export async function reorderPdf(originalPdfBase64: string, pageRanges: (string | undefined)[]): Promise<Uint8Array> {
  const originalPdfBytes = Uint8Array.from(atob(originalPdfBase64), c => c.charCodeAt(0));
  const originalPdf = await PDFDocument.load(originalPdfBytes);
  const newPdf = await PDFDocument.create();

  for (const range of pageRanges) {
    if (!range) continue;

    const parts = range.split('-').map(p => parseInt(p.trim()));
    let start = parts[0];
    let end = parts.length > 1 ? parts[1] : start;

    if (isNaN(start)) continue;

    // Convert to 0-indexed
    start = Math.max(1, start) - 1;
    end = Math.min(originalPdf.getPageCount(), end) - 1;

    if (start > end) continue;

    const pagesToCopy = [];
    for (let i = start; i <= end; i++) {
      pagesToCopy.push(i);
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pagesToCopy);
    copiedPages.forEach(page => newPdf.addPage(page));
  }

  // Add any pages that were not included in the ranges (optional, but requested "additional documents")
  // Actually, the user asked for the PDF in the order of the checklist.
  // We should probably just stick to the checklist order.

  return await newPdf.save();
}
