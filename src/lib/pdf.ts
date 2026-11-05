import { readFileSync } from "fs";
import path from "path";

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").slice(0, 110);
}

function jpegSize(buf: Buffer) {
  let offset = 2;
  while (offset < buf.length - 8) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  return { width: 220, height: 228 };
}

function logoJpeg() {
  try {
    const bytes = readFileSync(path.join(process.cwd(), "public", "brand", "pumps-logo-pdf.jpg"));
    return { bytes, ...jpegSize(bytes) };
  } catch {
    return null;
  }
}

/** One-page text PDF with the Oswal pumps logo in the header. */
export function textPdf(title: string, lines: string[]) {
  const escape = (value: string) => ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const logo = logoJpeg();
  const commands = ["0.008 0.314 0.184 rg", "0 800 595 42 re f", "BT", "/F1 12 Tf", "1 1 1 rg"];
  const body = [title, ...lines].slice(0, 46);
  const top = logo ? 760 : 790;
  body.forEach((line, index) => {
    const size = index === 0 ? 16 : 11;
    const gray = index === 0 ? "0.008 0.314 0.184 rg" : "0.14 0.14 0.14 rg";
    commands.push(gray);
    commands.push(`/F1 ${size} Tf`);
    commands.push(`1 0 0 1 ${logo ? 120 : 48} ${top - index * 16} Tm (${escape(line)}) Tj`);
  });
  commands.push("ET");
  if (logo) {
    const width = 72;
    const height = Math.round((logo.height / logo.width) * width);
    commands.unshift(`q ${width} 0 0 ${height} 36 ${842 - height - 28} cm /Im1 Do Q`);
  }
  const stream = commands.join("\n");
  const objects: (string | Buffer)[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
  ];
  const imageId = logo ? 6 : 0;
  const resources = logo
    ? `/Resources << /Font << /F1 5 0 R >> /XObject << /Im1 ${imageId} 0 R >> >>`
    : "/Resources << /Font << /F1 5 0 R >> >>";
  objects.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R ${resources} >> endobj\n`);
  objects.push(Buffer.from(`4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj\n`));
  objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");
  if (logo) {
    objects.push(Buffer.concat([
      Buffer.from(`6 0 obj << /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >> stream\n`),
      logo.bytes,
      Buffer.from("\nendstream endobj\n"),
    ]));
  }
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(typeof object === "string" ? Buffer.from(object) : object);
  }
  const xrefAt = Buffer.concat(chunks).length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  chunks.push(Buffer.from(xref));
  chunks.push(Buffer.from(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`));
  return Buffer.concat(chunks);
}
