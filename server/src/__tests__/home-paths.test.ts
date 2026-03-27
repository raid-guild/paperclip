import { afterEach, describe, expect, it } from "vitest";
import {
  resolvePaperclipPersistentHomeDir,
  resolvePaperclipPersistentInstanceRoot,
} from "../home-paths.js";

describe("home paths", () => {
  const originalPaperclipHome = process.env.PAPERCLIP_HOME;
  const originalPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
  const originalRailwayVolumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH;

  afterEach(() => {
    if (originalPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = originalPaperclipHome;
    if (originalPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = originalPaperclipInstanceId;
    if (originalRailwayVolumeMountPath === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    else process.env.RAILWAY_VOLUME_MOUNT_PATH = originalRailwayVolumeMountPath;
  });

  it("uses the Railway volume mount for persistent paths when PAPERCLIP_HOME is temporary", () => {
    process.env.PAPERCLIP_HOME = "/tmp/paperclip-data";
    process.env.PAPERCLIP_INSTANCE_ID = "default";
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/paperclip";

    expect(resolvePaperclipPersistentHomeDir()).toBe("/paperclip/.paperclip-runtime");
    expect(resolvePaperclipPersistentInstanceRoot()).toBe("/paperclip/.paperclip-runtime/instances/default");
  });

  it("keeps PAPERCLIP_HOME for persistent paths when it is already non-temporary", () => {
    process.env.PAPERCLIP_HOME = "/var/lib/paperclip";
    process.env.PAPERCLIP_INSTANCE_ID = "prod";
    process.env.RAILWAY_VOLUME_MOUNT_PATH = "/paperclip";

    expect(resolvePaperclipPersistentHomeDir()).toBe("/var/lib/paperclip");
    expect(resolvePaperclipPersistentInstanceRoot()).toBe("/var/lib/paperclip/instances/prod");
  });
});
