import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * awf ships with `src/` one level below the package root. Any module file in that tree can derive
 * the package root the same way the `bin/awf.mjs` launcher does (`join(binDir, "..")`).
 */
export function packageRootFromSrcModuleDir(srcModuleDir: string): string {
  return join(srcModuleDir, "..");
}

/** Package root for the running awf installation (works with global `pnpm link` and any cwd). */
export function awfPackageRootFromThisModule(): string {
  return packageRootFromSrcModuleDir(dirnameOfThisFile());
}

function dirnameOfThisFile(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function skillsDirectoryPath(packageRoot: string): string {
  return join(packageRoot, "skills");
}

/** Single mapping from repo skill folder name to destination folder under ~/.agents/skills. */
export function skillInstallFolderName(skillDirectoryBasename: string): string {
  return `awf-${skillDirectoryBasename}`;
}

export type DiscoveredSkill = {
  sourceDirName: string;
  sourcePath: string;
  installFolderName: string;
};

export type SkillsDiscoveryOk = {
  ok: true;
  skillsDir: string;
  skills: DiscoveredSkill[];
};

export type SkillsDiscoveryErrorReason = "missing_skills_dir" | "no_skill_directories";

export type SkillsDiscoveryError = {
  ok: false;
  skillsDir: string;
  reason: SkillsDiscoveryErrorReason;
};

export type SkillsDiscoveryResult = SkillsDiscoveryOk | SkillsDiscoveryError;

/**
 * Lists immediate subdirectories of the package `skills/` directory (files at the root are ignored).
 * Returns structured preflight outcomes when `skills/` is missing or has no eligible directories.
 */
export function discoverSkillsAtPackageRoot(packageRoot: string): SkillsDiscoveryResult {
  const skillsDir = skillsDirectoryPath(packageRoot);

  if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
    return { ok: false, skillsDir, reason: "missing_skills_dir" };
  }

  const dirents = readdirSync(skillsDir, { withFileTypes: true });
  const dirNames = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  dirNames.sort();

  if (dirNames.length === 0) {
    return { ok: false, skillsDir, reason: "no_skill_directories" };
  }

  const skills: DiscoveredSkill[] = dirNames.map((sourceDirName) => ({
    sourceDirName,
    sourcePath: join(skillsDir, sourceDirName),
    installFolderName: skillInstallFolderName(sourceDirName),
  }));

  return { ok: true, skillsDir, skills };
}
