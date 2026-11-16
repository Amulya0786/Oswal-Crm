import { describe, expect, it } from "vitest";
import { placeImageSlots } from "@/lib/image-slots";

describe("image slots", () => {
  it("maps field photos and the signature into fixed slots", () => {
    const placed = placeImageSlots([
      { id: "a", kind: "BEFORE", name: "before.jpg", source: "media" },
      { id: "b", kind: "SITE", name: "site.jpg", source: "media" },
      { id: "c", kind: "SIGNATURE", name: "sign.png", source: "media" },
      { id: "d", kind: "ATR", name: "atr.jpg", source: "media" },
    ]);
    expect(placed.IMAGE_1?.id).toBe("a");
    expect(placed.IMAGE_3?.id).toBe("b");
    expect(placed.SIGNATURE?.id).toBe("c");
    expect(placed.ATR?.id).toBe("d");
    expect(placed.IMAGE_2).toBeNull();
  });

  it("fills the next empty image slot when two photos want the same place", () => {
    const placed = placeImageSlots([
      { id: "a", kind: "BEFORE", name: "a.jpg", source: "media" },
      { id: "b", kind: "IMAGE_1", name: "b.jpg", source: "media" },
      { id: "c", kind: "NOTE", name: "c.jpg", source: "attachment" },
    ]);
    expect(placed.IMAGE_1?.id).toBe("a");
    expect(placed.IMAGE_2?.id).toBe("b");
    expect(placed.IMAGE_3?.id).toBe("c");
  });
});
