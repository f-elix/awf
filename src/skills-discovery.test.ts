import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  awfPackageRootFromThisModule,
  discoverSkillsAtPackageRoot,
  packageRootFromSrcModuleDir,
  skillInstallFolderName,
  skillsDirectoryPath,
} from "./skills-discovery.js";

test("packageRootFromSrcModuleDir: src/ → parent package root", () => {
  const pkg = join(tmpdir(), "fake-pkg");
  const src = join(pkg, "src");
  assert.equal(packageRootFromSrcModuleDir(src), pkg);
});

test("skillsDirectoryPath: joins skills under package root", () => {
  assert.equal(skillsDirectoryPath("/x/y"), join("/x/y", "skills"));
});

test("skillInstallFolderName: single awf- prefix mapping", () => {
  assert.equal(skillInstallFolderName("grill-me"), "awf-grill-me");
});

test("discoverSkillsAtPackageRoot: missing skills directory", () => {
  const root = mkdtempSync(join(tmpdir(), "awf-skills-"));
  try {
    const r = discoverSkillsAtPackageRoot(root);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, "missing_skills_dir");
    assert.equal(r.skillsDir, skillsDirectoryPath(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSkillsAtPackageRoot: skills exists but is a file", () => {
  const root = mkdtempSync(join(tmpdir(), "awf-skills-"));
  try {
    writeFileSync(join(root, "skills"), "not a dir", "utf8");
    const r = discoverSkillsAtPackageRoot(root);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, "missing_skills_dir");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSkillsAtPackageRoot: empty skills directory (no subdirs)", () => {
  const root = mkdtempSync(join(tmpdir(), "awf-skills-"));
  try {
    mkdirSync(skillsDirectoryPath(root), { recursive: true });
    const r = discoverSkillsAtPackageRoot(root);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, "no_skill_directories");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSkillsAtPackageRoot: only files at skills root — ignored", () => {
  const root = mkdtempSync(join(tmpdir(), "awf-skills-"));
  try {
    const skills = skillsDirectoryPath(root);
    mkdirSync(skills, { recursive: true });
    writeFileSync(join(skills, "README.md"), "# notes\n", "utf8");
    writeFileSync(join(skills, "notes.txt"), "x", "utf8");
    const r = discoverSkillsAtPackageRoot(root);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.reason, "no_skill_directories");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSkillsAtPackageRoot: immediate subdirs only; install names use skillInstallFolderName", () => {
  const root = mkdtempSync(join(tmpdir(), "awf-skills-"));
  try {
    const skills = skillsDirectoryPath(root);
    mkdirSync(join(skills, "alpha", "nested"), { recursive: true });
    mkdirSync(join(skills, "beta"), { recursive: true });
    writeFileSync(join(skills, "loose.md"), "x", "utf8");

    const r = discoverSkillsAtPackageRoot(root);
    assert.equal(r.ok, true);
    if (!r.ok) return;

    assert.equal(r.skills.length, 2);
    assert.deepEqual(
      r.skills.map((s) => s.sourceDirName),
      ["alpha", "beta"],
    );
    for (const s of r.skills) {
      assert.equal(s.installFolderName, skillInstallFolderName(s.sourceDirName));
      assert.equal(s.sourcePath, join(r.skillsDir, s.sourceDirName));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("awfPackageRootFromThisModule + discover: real repo layout resolves bundled skills", () => {
  const pkgRoot = awfPackageRootFromThisModule();
  const r = discoverSkillsAtPackageRoot(pkgRoot);
  assert.equal(r.ok, true);
  if (!r.ok) return;

  const names = new Set(r.skills.map((s) => s.sourceDirName));
  assert.deepEqual(names, new Set(["grill-me", "prd-to-tasks", "write-a-prd", "write-qa-plan"]));
});

test("package root from test module matches discover helper (linked clone semantics)", () => {
  const fromTestFile = packageRootFromSrcModuleDir(dirname(fileURLToPath(import.meta.url)));
  assert.equal(fromTestFile, awfPackageRootFromThisModule());
});
