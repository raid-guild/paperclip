import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const TRUTHY_ENV_RE = /^(1|true|yes|on)$/i;
const COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const SYMLINKED_SHARED_FILES = ["auth.json"] as const;
const DEFAULT_PAPERCLIP_INSTANCE_ID = "default";
const RAILWAY_RUNTIME_HOME_DIR = ".paperclip-runtime";

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

export function resolveSharedCodexHomeDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = nonEmpty(env.CODEX_HOME);
  return fromEnv ? path.resolve(fromEnv) : path.join(os.homedir(), ".codex");
}

function isWorktreeMode(env: NodeJS.ProcessEnv): boolean {
  return TRUTHY_ENV_RE.test(env.PAPERCLIP_IN_WORKTREE ?? "");
}

function isTemporaryPath(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  const tempRoot = path.resolve(os.tmpdir());
  return resolved === tempRoot || resolved.startsWith(`${tempRoot}${path.sep}`);
}

function resolveManagedCodexBaseDir(env: NodeJS.ProcessEnv): string {
  const paperclipHome = nonEmpty(env.PAPERCLIP_HOME) ?? path.resolve(os.homedir(), ".paperclip");
  const railwayVolumeMount = nonEmpty(env.RAILWAY_VOLUME_MOUNT_PATH);
  if (railwayVolumeMount && isTemporaryPath(paperclipHome)) {
    return path.resolve(railwayVolumeMount, RAILWAY_RUNTIME_HOME_DIR);
  }
  return path.resolve(paperclipHome);
}

export function resolveManagedCodexHomeDir(
  env: NodeJS.ProcessEnv,
  companyId?: string,
): string {
  const managedBaseDir = resolveManagedCodexBaseDir(env);
  const instanceId = nonEmpty(env.PAPERCLIP_INSTANCE_ID) ?? DEFAULT_PAPERCLIP_INSTANCE_ID;
  return companyId
    ? path.resolve(managedBaseDir, "instances", instanceId, "companies", companyId, "codex-home")
    : path.resolve(managedBaseDir, "instances", instanceId, "codex-home");
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureSymlink(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    try {
      await fs.symlink(source, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== "EEXIST") throw error;
      await ensureSymlink(target, source);
    }
    return;
  }

  if (!existing.isSymbolicLink()) {
    await fs.unlink(target);
    await fs.symlink(source, target);
    return;
  }

  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return;

  const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) return;

  await fs.unlink(target);
  await fs.symlink(source, target);
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

export async function prepareManagedCodexHome(
  env: NodeJS.ProcessEnv,
  onLog: AdapterExecutionContext["onLog"],
  companyId?: string,
): Promise<string> {
  const targetHome = resolveManagedCodexHomeDir(env, companyId);

  const sourceHome = resolveSharedCodexHomeDir(env);
  if (path.resolve(sourceHome) === path.resolve(targetHome)) return targetHome;

  await fs.mkdir(targetHome, { recursive: true });

  for (const name of SYMLINKED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureSymlink(path.join(targetHome, name), source);
  }

  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }

  await onLog(
    "stdout",
    `[paperclip] Using ${isWorktreeMode(env) ? "worktree-isolated" : "Paperclip-managed"} Codex home "${targetHome}" (seeded from "${sourceHome}").\n`,
  );
  return targetHome;
}
