import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function downloadTicketPdfFromElement(element: HTMLElement, fileBaseName: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (node) => node instanceof Element && node.hasAttribute("data-no-pdf"),
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
  const imgW = canvas.width * scale;
  const imgH = canvas.height * scale;
  const x = margin + (maxW - imgW) / 2;
  const y = margin + (maxH - imgH) / 2;

  pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
  pdf.save(`${fileBaseName.replace(/[^a-z0-9-_]+/gi, "_")}.pdf`);
}
