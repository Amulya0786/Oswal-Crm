import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadObject, saveObject, signedObjectUrl, spacesConfigured } from "../src/server/storage";

const previous = process.env.STORAGE_DIR;

afterEach(() => {
  if (previous === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = previous;
  delete process.env.S3_BUCKET;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY;
  delete process.env.S3_SECRET_KEY;
});

describe("file storage", () => {
  it("uses Spaces only when the bucket and real keys are set", () => {
    expect(spacesConfigured({})).toBe(false);
    expect(spacesConfigured({
      S3_BUCKET: "oswal-service-files",
      S3_ENDPOINT: "https://sgp1.digitaloceanspaces.com",
      S3_ACCESS_KEY: "enter-spaces-key",
      S3_SECRET_KEY: "enter-spaces-secret",
    })).toBe(false);
    expect(spacesConfigured({
      S3_BUCKET: "oswal-service-files",
      S3_ENDPOINT: "https://sgp1.digitaloceanspaces.com",
      S3_ACCESS_KEY: "DO00realkey",
      S3_SECRET_KEY: "a-real-spaces-secret",
    })).toBe(true);
  });

  it("keeps a file on local disk when Spaces is not configured", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "oswal-files-"));
    process.env.STORAGE_DIR = dir;
    await saveObject("uploads/note.txt", Buffer.from("hello"));
    expect((await loadObject("uploads/note.txt")).toString()).toBe("hello");
    expect(await signedObjectUrl("uploads/note.txt")).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});
