import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverSkillsAtPackageRoot,
  skillInstallFolderName,
  skillsDirectoryPath,
} from "./skills-discovery.js";
import {
  formatSkillsInstallPreflightMessage,
  installBundledSkills,
  type SkillsInstallFs,
} from "./skills-install.js";

/** Flat files per skill dir: { skillDir: { "file.ext": "body" } } */
function makePackageWithSkillsFlat(skillsMap: Record<string, Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "awf-pkg-"));
  const skills = skillsDirectoryPath(root);
  for (const [dirName, files] of Object.entries(skillsMap)) {
    const base = join(skills, dirName);
    mkdirSync(base, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(base, name), content, "utf8");
    }
  }
  return root;
}

test("installBundledSkills: happy path installs multiple skills under awf-*", () => {
  const pkg = makePackageWithSkillsFlat({
    alpha: { "SKILL.md": "a" },
    beta: { "x.txt": "b" },
  });
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  try {
    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r.ok, true);
    if (!r.ok) return;

    assert.equal(r.installed.length, 2);
    const byDest = new Map(r.installed.map((i) => [i.destPath, i.sourcePath]));
    const aDest = join(dest, skillInstallFolderName("alpha"));
    const bDest = join(dest, skillInstallFolderName("beta"));
    assert.ok(byDest.has(aDest));
    assert.ok(byDest.has(bDest));
    assert.equal(readFileSync(join(aDest, "SKILL.md"), "utf8"), "a");
    assert.equal(readFileSync(join(bDest, "x.txt"), "utf8"), "b");
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: staging failure leaves destRoot untouched", () => {
  const pkg = makePackageWithSkillsFlat({
    one: { "f.txt": "1" },
    two: { "g.txt": "2" },
  });
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  mkdirSync(join(dest, "pre"), { recursive: true });
  writeFileSync(join(dest, "pre", "marker.txt"), "stay", "utf8");

  let copyCalls = 0;
  const fs: Partial<SkillsInstallFs> = {
    copyTreeRecursive(src, d) {
      copyCalls++;
      if (copyCalls === 2) {
        throw new Error("simulated staging copy failure");
      }
      cpSync(src, d, { recursive: true });
    },
  };

  try {
    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest, fs });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.kind, "staging");
    assert.equal(copyCalls, 2);

    const entries = readdirSync(dest);
    assert.deepEqual(entries.sort(), ["pre"]);
    assert.equal(readFileSync(join(dest, "pre", "marker.txt"), "utf8"), "stay");
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: preserves sibling directories under destRoot", () => {
  const pkg = makePackageWithSkillsFlat({
    only: { "SKILL.md": "x" },
  });
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  const sibling = join(dest, "user-other-skill");
  mkdirSync(sibling, { recursive: true });
  writeFileSync(join(sibling, "keep.md"), "k", "utf8");

  try {
    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r.ok, true);
    if (!r.ok) return;

    assert.equal(readFileSync(join(sibling, "keep.md"), "utf8"), "k");
    const installed = join(dest, skillInstallFolderName("only"));
    assert.equal(readFileSync(join(installed, "SKILL.md"), "utf8"), "x");
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: full replace removes files dropped from source", () => {
  const pkg = mkdtempSync(join(tmpdir(), "awf-pkg-"));
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  try {
    const skills = skillsDirectoryPath(pkg);
    mkdirSync(join(skills, "mut"), { recursive: true });
    writeFileSync(join(skills, "mut", "keep.txt"), "k", "utf8");
    writeFileSync(join(skills, "mut", "gone.txt"), "bye", "utf8");

    const r1 = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r1.ok, true);
    const mutDest = join(dest, skillInstallFolderName("mut"));
    assert.equal(readFileSync(join(mutDest, "gone.txt"), "utf8"), "bye");

    rmSync(join(skills, "mut", "gone.txt"));
    const r2 = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r2.ok, true);

    const names = readdirSync(mutDest).sort();
    assert.deepEqual(names, ["keep.txt"]);
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: preflight missing skills directory", () => {
  const pkg = mkdtempSync(join(tmpdir(), "awf-pkg-"));
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  try {
    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.kind, "preflight");
    const msg = formatSkillsInstallPreflightMessage(r.discovery);
    assert.match(msg, /skills directory missing/);
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: preflight no eligible skill directories", () => {
  const pkg = mkdtempSync(join(tmpdir(), "awf-pkg-"));
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  try {
    mkdirSync(skillsDirectoryPath(pkg), { recursive: true });
    writeFileSync(join(skillsDirectoryPath(pkg), "readme.txt"), "nope", "utf8");

    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.kind, "preflight");
    assert.equal(r.discovery.reason, "no_skill_directories");
    const msg = formatSkillsInstallPreflightMessage(r.discovery);
    assert.match(msg, /no skill directories/);
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test("installBundledSkills: discover + install agree on skill set (no duplicate naming logic)", () => {
  const pkg = makePackageWithSkillsFlat({ a: { "1": "x" }, b: { "2": "y" } });
  const dest = mkdtempSync(join(tmpdir(), "awf-dest-"));
  try {
    const d = discoverSkillsAtPackageRoot(pkg);
    assert.equal(d.ok, true);
    if (!d.ok) return;

    const r = installBundledSkills({ packageRoot: pkg, destRoot: dest });
    assert.equal(r.ok, true);
    if (!r.ok) return;

    assert.equal(r.installed.length, d.skills.length);
    const destNames = new Set(readdirSync(dest));
    for (const s of d.skills) {
      assert.ok(destNames.has(s.installFolderName));
    }
  } finally {
    rmSync(pkg, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});
