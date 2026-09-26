import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Meet, Performance } from "./types";

export function certificateFileName(meet: Meet, row: Performance): string {
  const safeName = row.name.replace(/\s+/g, "");
  const event = row.event.normalize("NFKC");
  return `大会記録証明書_${meet.id}_${row.bib}_${safeName}_${event}.pdf`;
}

export async function downloadCertificatePdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  await document.fonts.ready;
  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const image = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  pdf.addImage(image, "JPEG", 0, 0, 210, 297);
  pdf.save(fileName);
}
