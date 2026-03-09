import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit, type SimpleGit } from "simple-git";
import { rmSync } from "node:fs";

export type GitFixture = {
  readonly dir: string;
  readonly git: SimpleGit;
  cleanup: () => void;
};

/**
 * テスト用の一時 Git リポジトリを作成する
 */
export async function createGitFixture(
  files: Record<string, string> = {},
): Promise<GitFixture> {
  const dir = mkdtempSync(join(tmpdir(), "spectrack-test-"));
  const git = simpleGit(dir);

  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("commit.gpgsign", "false");

  // ファイルを作成してコミット
  if (Object.keys(files).length > 0) {
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = join(dir, relPath);
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dirPath !== dir) {
        mkdirSync(dirPath, { recursive: true });
      }
      writeFileSync(fullPath, content, "utf-8");
    }
    await git.add(".");
    await git.commit("initial commit");
  } else {
    // 空のリポジトリでも最低1コミットが必要
    writeFileSync(join(dir, ".gitkeep"), "", "utf-8");
    await git.add(".");
    await git.commit("initial commit");
  }

  return {
    dir,
    git,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    },
  };
}

/**
 * ファイルを追加してコミットする
 */
export async function addAndCommit(
  fixture: GitFixture,
  files: Record<string, string>,
  message = "update",
): Promise<void> {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(fixture.dir, relPath);
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dirPath !== fixture.dir) {
      mkdirSync(dirPath, { recursive: true });
    }
    writeFileSync(fullPath, content, "utf-8");
  }
  await fixture.git.add(".");
  await fixture.git.commit(message);
}
