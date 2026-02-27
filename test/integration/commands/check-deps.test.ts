import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import {
  createGitFixture,
  addAndCommit,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { runCheckDeps } from "../../../src/cli/commands/check-deps.js";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("spectrack check-deps", () => {
  it("依存先が最新の場合は EXIT_CODE=0", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);

    expect(exitCode).toBe(0);
  });

  it("依存先が更新されている場合は EXIT_CODE=2（警告）", async () => {
    // 最初のコミット: prd version=1.0.0
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // 2番目のコミット: prd を 1.1.0 に更新してコミット
    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD v2\n`,
      },
      "chore: bump prd version",
    );

    // uc はまだ prd-001:1.0.0 を参照しているまま（Working tree のまま）
    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);

    // 1.0.0 → 1.1.0 はマイナー更新なので警告（EXIT_CODE=2）
    expect(exitCode).toBe(2);
  });

  it("--strict フラグでパッチ更新も検出する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // prd をパッチバージョンに更新
    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.1\n---\n# PRD patch\n`,
      },
      "fix: patch update",
    );

    const ctx = await initCommandContext(fixture.dir, false);

    // --strict なしではパッチ更新は警告なし
    const exitCodeNoStrict = await runCheckDeps(undefined, {}, ctx);
    expect(exitCodeNoStrict).toBe(0);

    // --strict ありではパッチ更新も警告
    const exitCodeStrict = await runCheckDeps(undefined, { strict: true }, ctx);
    expect(exitCodeStrict).toBe(2);
  });

  it("非対称比較: Working tree の依存元 vs コミット済みの依存先", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    // prd を 1.1.0 にコミット
    await addAndCommit(
      fixture,
      {
        "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.1.0\n---\n# PRD v1.1\n`,
      },
      "feat: bump prd",
    );

    // uc の Working tree 版も prd を 1.1.0 に参照更新（未コミット）
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      join(fixture.dir, "doc/uc.md"),
      `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.1.0\nversion: 1.0.0\n---\n# UC\n`,
      "utf-8",
    );

    // uc の Working tree は 1.1.0 参照、prd の HEAD も 1.1.0 → 差分なし
    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);
    expect(exitCode).toBe(0);
  });

  it("依存関係のないドキュメントのみの場合はメッセージを表示", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nx-st-dependencies: []\nversion: 1.0.0\n---\n# PRD\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);
    // 依存関係なし → EXIT_CODE=0
    expect(exitCode).toBe(0);
  });

  it("存在しないIDへの依存は EXIT_CODE=1（エラー）", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: nonexistent-dep\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);
    // 依存先が見つからない → エラー
    expect(exitCode).toBe(1);
  });

  it("特定ファイルを指定して check-deps を実行する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/prd.md": `---\nx-st-id: prd-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# PRD\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: prd-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    // prd.md を指定すると、prd に依存する uc.md だけがチェック対象になる
    const filePath = join(fixture.dir, "doc/prd.md");
    const exitCode = await runCheckDeps(filePath, {}, ctx);
    expect(exitCode).toBe(0);
  });

  it("カスタム x-st-version-path を持つ依存先を正しく検出する", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: info.version\ninfo:\n  version: "2.0.0"\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);
    // api-001 のコミット済みバージョンは 2.0.0 (メジャー更新) → WARNING
    expect(exitCode).toBe(2);
  });

  it("YAML ファイル (.yml) を依存先として check-deps できる", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\ndocumentRootPath: doc\n`,
      "doc/api.yml": `x-st-id: api-001\nx-st-version-path: version\nversion: 1.0.0\n`,
      "doc/uc.md": `---\nx-st-id: uc-001\nx-st-version-path: version\nx-st-dependencies:\n  - id: api-001\n    version: 1.0.0\nversion: 1.0.0\n---\n# UC\n`,
    });

    const ctx = await initCommandContext(fixture.dir, false);
    const exitCode = await runCheckDeps(undefined, {}, ctx);
    expect(exitCode).toBe(0);
  });
});
