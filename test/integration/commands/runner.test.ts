import { describe, it, expect, afterEach } from "vitest";
import {
  createGitFixture,
  type GitFixture,
} from "../../helpers/git-fixture.js";
import { initCommandContext } from "../../../src/cli/runner.js";
import { join } from "node:path";

let fixture: GitFixture | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

describe("initCommandContext", () => {
  it("パース不能ファイルがあっても初期化が成功し、有効なドキュメントのみ含む", async () => {
    fixture = await createGitFixture({
      "spectrack.yml": `frontMatterKeyPrefix: x-st-\n`,
      "doc/valid.md": `---\nx-st-id: valid-001\nx-st-version-path: version\nversion: 1.0.0\n---\n# Valid\n`,
      // 不正な YAML フロントマター（未閉の bracket）
      "doc/malformed.md": `---\nkey: [unclosed\n---\n# Malformed\n`,
    });

    // パースエラーは無視されて初期化が成功する
    const ctx = await initCommandContext(fixture.dir, false);
    expect(ctx).toBeDefined();

    // malformed.md はスキップされ valid.md のみ含まれる
    const ids = ctx.docs.map((d) => d.frontMatter.id);
    expect(ids).toContain("valid-001");
    expect(ids).not.toContain(undefined);
    expect(ctx.docs.some((d) => d.filePath === join(fixture!.dir, "doc/malformed.md"))).toBe(false);
  });
});
