import { ExitCode } from "../output/exit-code.js";

/** spectrack のベースエラークラス */
export class SpectrackError extends Error {
  readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode = ExitCode.ERROR) {
    super(message);
    this.name = "SpectrackError";
    this.exitCode = exitCode;
  }
}

/** 参照エラー: 依存先IDが見つからない */
export class DependencyNotFoundError extends SpectrackError {
  constructor(id: string, estimatedPath?: string) {
    const suffix = estimatedPath
      ? `（Git履歴の推定元パス: ${estimatedPath}）`
      : "";
    super(
      `ERROR: 依存先 [${id}] が見つかりません。ファイルが削除された可能性があります。${suffix}`,
      ExitCode.ERROR,
    );
    this.name = "DependencyNotFoundError";
  }
}

/** バージョン不在エラー */
export class VersionNotFoundError extends SpectrackError {
  constructor(id: string, version: string) {
    super(
      `ERROR: ID [${id}] のバージョン [${version}] は存在しません`,
      ExitCode.ERROR,
    );
    this.name = "VersionNotFoundError";
  }
}

/** ID重複エラー */
export class DuplicateIdError extends SpectrackError {
  constructor(id: string) {
    super(
      `ERROR: ID重複検出。ID [${id}] が複数のドキュメントで使用されています`,
      ExitCode.ERROR,
    );
    this.name = "DuplicateIdError";
  }
}

/** ファイル不在エラー */
export class FileNotFoundError extends SpectrackError {
  constructor(path: string, estimatedPath?: string) {
    const suffix = estimatedPath
      ? `（Git履歴の推定元パス: ${estimatedPath}）`
      : "";
    super(
      `ERROR: ファイル [${path}] が見つかりません。ファイルが削除された可能性があります。${suffix}`,
      ExitCode.ERROR,
    );
    this.name = "FileNotFoundError";
  }
}

/** フロントマター不正エラー */
export class InvalidFrontMatterError extends SpectrackError {
  constructor(file: string) {
    super(
      `ERROR: [${file}] のフロントマター形式が不正です`,
      ExitCode.ERROR,
    );
    this.name = "InvalidFrontMatterError";
  }
}

/** 設定ファイル不在エラー */
export class ConfigNotFoundError extends SpectrackError {
  constructor() {
    super(
      `ERROR: spectrack.yml が見つかりません。spectrack init を実行してください`,
      ExitCode.ERROR,
    );
    this.name = "ConfigNotFoundError";
  }
}

/** プレリリースバージョン不正エラー */
export class InvalidPrereleaseError extends SpectrackError {
  constructor() {
    super(
      `ERROR: プレリリースバージョンは数値のみ許可されています (例: 1.0.0-1)`,
      ExitCode.ERROR,
    );
    this.name = "InvalidPrereleaseError";
  }
}

/** SemVer 不正警告 */
export class InvalidSemVerWarning extends SpectrackError {
  constructor(file: string, version: string) {
    super(
      `WARNING: [${file}] のバージョン [${version}] は有効なセマンティックバージョンではありません`,
      ExitCode.WARNING,
    );
    this.name = "InvalidSemVerWarning";
  }
}

/** Git 未初期化エラー */
export class GitNotInitializedError extends SpectrackError {
  constructor() {
    super(`ERROR: Git リポジトリが初期化されていません`, ExitCode.ERROR);
    this.name = "GitNotInitializedError";
  }
}

/** Git コミットゼロエラー */
export class GitNoCommitsError extends SpectrackError {
  constructor(gitError: string) {
    super(
      `ERROR: spectrack は Git の履歴を利用するため、少なくとも1つのコミットが必要です。(Internal: ${gitError})`,
      ExitCode.ERROR,
    );
    this.name = "GitNoCommitsError";
  }
}

/** diff 対象バージョン不在エラー */
export class DiffTargetNotFoundError extends SpectrackError {
  constructor(version: string) {
    super(
      `ERROR: バージョン [${version}] となるコミットがGit履歴から見つかりません`,
      ExitCode.ERROR,
    );
    this.name = "DiffTargetNotFoundError";
  }
}
