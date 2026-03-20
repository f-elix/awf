import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discoverSkillsAtPackageRoot, type SkillsDiscoveryError } from "./skills-discovery.js";

export type SkillsInstallFs = {
  copyTreeRecursive(src: string, dest: string): void;
  removePathRecursive(path: string): void;
  mkdtempInSystemTemp(prefix: string): string;
  ensureDir(path: string): void;
};

function defaultSkillsInstallFs(): SkillsInstallFs {
  return {
    copyTreeRecursive(src, dest) {
      cpSync(src, dest, { recursive: true });
    },
    removePathRecursive(path) {
      rmSync(path, { recursive: true, force: true });
    },
    mkdtempInSystemTemp(prefix) {
      return mkdtempSync(join(tmpdir(), prefix));
    },
    ensureDir(path) {
      mkdirSync(path, { recursive: true });
    },
  };
}

export type SkillsInstallInstalled = {
  sourcePath: string;
  destPath: string;
};

export type SkillsInstallOk = {
  ok: true;
  installed: SkillsInstallInstalled[];
};

export type SkillsInstallPreflightFailure = {
  ok: false;
  kind: "preflight";
  discovery: SkillsDiscoveryError;
};

export type SkillsInstallStagingFailure = {
  ok: false;
  kind: "staging";
  message: string;
  cause: unknown;
};

export type SkillsInstallCommitFailure = {
  ok: false;
  kind: "commit";
  message: string;
  cause: unknown;
};

export type SkillsInstallResult =
  | SkillsInstallOk
  | SkillsInstallPreflightFailure
  | SkillsInstallStagingFailure
  | SkillsInstallCommitFailure;

/** Concise stderr-oriented copy for preflight outcomes (CLI maps to non-zero exit). */
export function formatSkillsInstallPreflightMessage(discovery: SkillsDiscoveryError): string {
  switch (discovery.reason) {
    case "missing_skills_dir":
      return `skills directory missing or not a directory: ${discovery.skillsDir}`;
    case "no_skill_directories":
      return `no skill directories under ${discovery.skillsDir}`;
  }
}

/**
 * Stages full copies of every discovered skill under a temp tree, then replaces only each
 * `awf-<name>` directory under `destRoot`. Siblings under `destRoot` are untouched.
 * If staging fails before completion, `destRoot` is not read or written.
 */
export function installBundledSkills(options: {
  packageRoot: string;
  destRoot: string;
  fs?: Partial<SkillsInstallFs>;
}): SkillsInstallResult {
  const fs = { ...defaultSkillsInstallFs(), ...options.fs };
  const discovered = discoverSkillsAtPackageRoot(options.packageRoot);
  if (!discovered.ok) {
    return { ok: false, kind: "preflight", discovery: discovered };
  }

  const stagingRoot = fs.mkdtempInSystemTemp("awf-skills-stage-");
  try {
    for (const skill of discovered.skills) {
      const stagedPath = join(stagingRoot, skill.installFolderName);
      try {
        fs.copyTreeRecursive(skill.sourcePath, stagedPath);
      } catch (cause) {
        return {
          ok: false,
          kind: "staging",
          cause,
          message: formatStagingFailureMessage(skill.sourcePath, stagedPath, cause),
        };
      }
    }

    fs.ensureDir(options.destRoot);

    for (const skill of discovered.skills) {
      const destPath = join(options.destRoot, skill.installFolderName);
      const stagedSkillPath = join(stagingRoot, skill.installFolderName);
      try {
        fs.removePathRecursive(destPath);
        fs.copyTreeRecursive(stagedSkillPath, destPath);
      } catch (cause) {
        return {
          ok: false,
          kind: "commit",
          cause,
          message: formatCommitFailureMessage(stagedSkillPath, destPath, cause),
        };
      }
    }

    return {
      ok: true,
      installed: discovered.skills.map((s) => ({
        sourcePath: s.sourcePath,
        destPath: join(options.destRoot, s.installFolderName),
      })),
    };
  } finally {
    fs.removePathRecursive(stagingRoot);
  }
}

function formatStagingFailureMessage(source: string, stagingDest: string, cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return `failed to stage skill copy ${source} → ${stagingDest}: ${detail}`;
}

function formatCommitFailureMessage(staged: string, dest: string, cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return `failed to publish staged skill ${staged} → ${dest}: ${detail}`;
}
