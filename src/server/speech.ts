import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function storeAudio(complaintId: string, dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Voice note was empty");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 2_000_000) throw new Error("Voice note is larger than 2 MB");
  const dir = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "uploads");
  await mkdir(dir, { recursive: true });
  const file = `${complaintId}-voice-${Date.now()}.webm`;
  await writeFile(path.join(dir, file), bytes);
  return file;
}

export async function transcribe(lang: "en" | "hi") {
  if (process.env.SPEECH_URL && process.env.SPEECH_KEY) {
    return { text: "", provider: "speech", lang };
  }
  return {
    provider: "mock",
    lang,
    text: lang === "hi" ? "मॉक ट्रांसक्रिप्ट। स्पीच कुंजी सेट नहीं है।" : "Mock transcript. No speech key is set.",
  };
}
