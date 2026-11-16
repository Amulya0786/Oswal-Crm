export const IMAGE_SLOTS = [
  { id: "IMAGE_1", label: "Image 1" },
  { id: "IMAGE_2", label: "Image 2" },
  { id: "IMAGE_3", label: "Image 3" },
  { id: "IMAGE_4", label: "Image 4" },
  { id: "IMAGE_5", label: "Image 5" },
  { id: "SIGNATURE", label: "Signature" },
  { id: "ATR", label: "ATR Image" },
] as const;

export type ImageSlotId = (typeof IMAGE_SLOTS)[number]["id"];

const KIND_TO_SLOT: Record<string, ImageSlotId> = {
  IMAGE_1: "IMAGE_1",
  IMAGE_2: "IMAGE_2",
  IMAGE_3: "IMAGE_3",
  IMAGE_4: "IMAGE_4",
  IMAGE_5: "IMAGE_5",
  SIGNATURE: "SIGNATURE",
  ATR: "ATR",
  ATR_IMAGE: "ATR",
  BEFORE: "IMAGE_1",
  AFTER: "IMAGE_2",
  SITE: "IMAGE_3",
  NAMEPLATE: "IMAGE_4",
};

export type SlotFile = { id: string; kind: string; name: string; source: "media" | "attachment" };

const PHOTO_SLOTS: ImageSlotId[] = ["IMAGE_1", "IMAGE_2", "IMAGE_3", "IMAGE_4", "IMAGE_5"];

/** Put stored photos into the fixed desk slots. The first file keeps a named slot. */
export function placeImageSlots(files: SlotFile[]): Record<ImageSlotId, SlotFile | null> {
  const placed = Object.fromEntries(IMAGE_SLOTS.map((slot) => [slot.id, null])) as Record<ImageSlotId, SlotFile | null>;
  for (const file of files) {
    const preferred = KIND_TO_SLOT[file.kind.toUpperCase()] ?? null;
    if (preferred && !placed[preferred]) {
      placed[preferred] = file;
      continue;
    }
    const spare = PHOTO_SLOTS.find((slot) => !placed[slot]);
    if (spare) placed[spare] = file;
  }
  return placed;
}

export function isImageSlot(value: string): value is ImageSlotId {
  return IMAGE_SLOTS.some((slot) => slot.id === value);
}
