# spectrack 📄🔗

**spectrack**（スペクトラック）は、MarkdownやYAMLで書かれた仕様書・ドキュメント間の「依存関係」を、Gitの力を使って堅牢に追跡・管理するCLIツールです。

「要件定義書が更新されたのに、ユースケース図の修正が漏れていた…」
「ディレクトリ構造を整理したら、ドキュメントのリンクが全部切れてしまった…」

そんな仕様書管理の悲劇を、IDベースの追跡とSemVer（セマンティックバージョニング）で未然に防ぎます。

## ✨ 主な機能と特徴

* **堅牢なIDベース追跡**: ドキュメントの移動やリネームに影響されません。フロントマターに埋め込まれた一意のIDで関係性を維持し、人間用には「パスヒント」を自動で書き込みます。
* **Working Tree ファースト**: 未コミットのローカルの変更を即座に評価。「仕様書Aを直して、それに合わせて仕様書Bも直してから、まとめて1つのコミットにする」という自然な開発体験（アトミック・コミット）を実現します。
* **Git履歴との高度な連携**: 過去のバージョンとの差分表示（`deps-diff`）や、すでに削除されたファイルからの依存履歴の掘り起こし（`dependents --all`）など、強力な分析機能を備えています。
* **CI/CDフレンドリー**: `verify` コマンドによる循環依存のチェックや、`graph` コマンドによる依存ツリーの可視化（Mermaid出力）をサポートしています。

## 📦 インストール

```bash
# npm を使用する場合
npm install -g spectrack

```

## 🚀 クイックスタート

### 1. プロジェクトの初期化

プロジェクトのルートディレクトリで `init` コマンドを実行します。

```bash
# 設定ファイルを作成し、既存のドキュメントを一括で追跡対象にする
spectrack init --all

```

### 2. 依存関係を結ぶ（Link）

あるドキュメントが、別のドキュメントの仕様を前提としている場合、`link` コマンドで紐づけます。

```bash
spectrack link docs/use-case/UC001.md --deps=docs/prd/requirements.md

```

### 3. 日々のワークフロー

仕様書の更新から追従までのサイクルは非常にシンプルです。

**① 依存先ドキュメントを更新する**
要件定義書を修正し、バージョンを上げます。

```bash
spectrack bump docs/prd/requirements.md --minor

```

**② 状態を確認する（Status）**
プロジェクト全体の依存状況をチェックします。`status` はローカルの未コミットの変更を即座に検知します。

```console
$ spectrack status
...
🔄 [st-uc-001] docs/use-case/UC001.md の依存状況:
   └─ 🔄 [st-prd-001] docs/prd/requirements.md (参照: 1.0.0, 現在: 1.1.0) ⚠️ 更新あり

```

**③ 変更内容をレビューする（Deps-diff）**
依存先がどのように変更されたのか、差分を確認します。

```bash
spectrack deps-diff docs/use-case/UC001.md

```

**④ 自分のドキュメントを修正し、同期する（Sync）**
変更内容に合わせてユースケース記述を修正し、「最新の仕様に追従した」ことをマークします。

```bash
spectrack sync docs/use-case/UC001.md

```

これで、整合性の取れたドキュメント群をまとめて `git commit` する準備が整いました！

## 🛠 コマンドリファレンス

すべてのファイル変更を伴うコマンドには、安全確認用の `--dry-run` オプションが使用可能です。

| コマンド | 役割 |
| --- | --- |
| `spectrack init [<file>] [--all]` | プロジェクトの初期化、またはドキュメントへの追跡メタデータ追加 |
| `spectrack link <file> --deps=<path>...` | ドキュメント間に依存関係を結ぶ |
| `spectrack unlink <file> --deps=<path>...` | ドキュメント間の依存関係を解除する |
| `spectrack bump <file> [--major|minor|patch]` | ドキュメントのバージョンを上げる |
| `spectrack sync <file>` | 更新された依存先の最新バージョンに追従・同期する |
| `spectrack status [<file>]` | 依存先ツリーを表示し、バージョンのズレ（更新）を警告する |
| `spectrack diff <file>` | ドキュメント自身の過去バージョンからの変更差分を表示する |
| `spectrack deps-diff <file>` | 対象が依存している全ドキュメントの変更差分を表示する |
| `spectrack list` | 追跡中の全ドキュメントの目録（インベントリ）を表示する |
| `spectrack dependents <file> [--all]` | 対象に依存しているドキュメント（影響範囲）を逆引き検索する |
| `spectrack log <file>` | バージョンがいつ上がったかの歴史（タイムライン）を表示する |
| `spectrack verify` | 構造、未解決リンク、循環依存などの全体的な健全性を検証する |
| `spectrack graph` | 依存関係のネットワークグラフ（Mermaid形式等）を出力する |

## ⚙️ 設定（spectrack.yml）

プロジェクトルートに配置される `spectrack.yml` で、フロントマターのキーやID生成のルールを柔軟にカスタマイズできます。

```yaml
frontMatterKeyPrefix: x-st-
frontMatterTemplate:
  md:
    version: 0.0.0
    x-st-version-path: version
    x-st-id: "{{context.file.dir}}-{{context.utils.nanoid}}"
    x-st-dependencies: []

```

### 除外設定（.spectrackignore）

`.gitignore` と同じ文法で、追跡対象から外したいディレクトリやファイルを指定します（`init` 時に強力なデフォルト設定が自動生成されます）。

## 📄 ライセンス (License)

This project is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
