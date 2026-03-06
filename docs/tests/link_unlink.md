# `spectrack link` / `unlink` コマンド テストケース一覧

## 1. `link` 基本動作（正常系）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **L1-1** | 単一依存の追加（バージョン省略） | 対象、依存先ともに初期化済み | `spectrack link docs/a.md --deps=docs/b.md` | `a.md` の `x-st-dependencies` に `b.md` の ID、パスヒント、現在の Working tree のバージョンが自動取得されて追加されること |
| **L1-2** | 単一依存の追加（バージョン指定） | 対象、依存先ともに初期化済み | `spectrack link docs/a.md --deps=docs/b.md:2.0.0` | `a.md` に追加される依存情報として、明示的に指定したバージョン `2.0.0` が記録されること |
| **L1-3** | 複数依存の同時追加 | 対象、依存先(2つ)ともに初期化済み | `spectrack link docs/a.md --deps=docs/b.md,docs/c.md:1.5.0` | `b.md` (自動バージョン) と `c.md` (指定バージョン) の両方が正常にフロントマターへ追加されること |

## 2. `unlink` 基本動作（正常系）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **U1-1** | 単一依存の解除 | `a.md` が `b.md` に依存している | `spectrack unlink docs/a.md --deps=docs/b.md` | `a.md` の依存リストから `b.md` の情報が削除されること |
| **U1-2** | 複数依存の同時解除 | `a.md` が `b.md`, `c.md` に依存している | `spectrack unlink docs/a.md --deps=docs/b.md,docs/c.md` | 指定した両方の依存関係がリストから削除されること |
| **U1-3** | 最後の依存関係の解除 | `a.md` の依存リストに1件のみ登録されている | `spectrack unlink docs/a.md --deps=docs/b.md` | リストが空になり、設定テンプレートに従い `x-st-dependencies: []` の状態になること |

## 3. 異常系・未初期化状態（Errors / Uninitialized）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **E1-1** | 対象ファイルが未初期化 | `a.md` は未初期化（フロントマターなし） | `spectrack link docs/a.md --deps=docs/b.md` | 「対象ファイルが初期化されていません」等のエラーとなり、ファイルが変更されないこと |
| **E1-2** | 依存先ファイルが未初期化 | `b.md` は未初期化 | `spectrack link docs/a.md --deps=docs/b.md` | 「依存先ファイルが初期化されていません」等のエラーとなり、対象ファイルが変更されないこと |
| **E1-3** | 存在しない依存先パスを指定 | 指定した依存先パスが存在しない | `spectrack link docs/a.md --deps=docs/not_found.md` | 「ファイルが見つかりません」のエラーとなり、処理が中断されること |
| **E1-4** | `--deps` オプションの欠落 | 対象ファイルのみ指定 | `spectrack link docs/a.md` | 必須オプション不足のエラーが表示され、コマンドの使い方（Help）が提示されること |

## 4. 冪等性と混在状態（Idempotency / Mixed States）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **I1-1** | 既存の依存先を再リンク（変更なし） | `a.md` はすでに `b.md:1.0.0` に依存済み | `spectrack link docs/a.md --deps=docs/b.md:1.0.0` | 「既にリンクされています」等のメッセージが出て、ファイル内容が一切変更されないこと |
| **I1-2** | 既存の依存先の再リンク（バージョン更新） | `a.md` は `b.md:1.0.0` に依存。`b.md` の Working tree は `1.1.0` | `spectrack link docs/a.md --deps=docs/b.md` | 依存リスト内の `b.md` の参照バージョンが `1.1.0` に上書き更新されること |
| **I1-3** | 新規と既存が混在するリンク | `b.md` は依存済み、`c.md` は未依存 | `spectrack link docs/a.md --deps=docs/b.md,docs/c.md` | `b.md` はスキップまたは上書きされ、`c.md` のみが新規追加されること。重複エラーで全体が停止しないこと |
| **I1-4** | 存在しない依存先の解除 | `a.md` は `b.md` に依存していない | `spectrack unlink docs/a.md --deps=docs/b.md` | 「指定された依存関係はありません」等の警告が出力され、ファイルが変更されず正常終了すること |

## 5. Dry-Run オプション（`--dry-run`）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **D1-1** | `link` の Dry-Run | 正常にリンク可能な状態 | `spectrack link docs/a.md --deps=docs/b.md --dry-run` | 標準出力にフロントマターへの追加差分のみが表示され、実際のファイルは変更されないこと |
| **D1-2** | 混在状態の Dry-Run | `b.md` は依存済み、`c.md` は未依存 | `spectrack link docs/a.md --deps=docs/b.md,docs/c.md --dry-run` | `c.md` が追加される予定の差分のみが表示され、`b.md` が二重に追加されるような差分が出ないこと |
| **D1-3** | `unlink` の Dry-Run | 正常に解除可能な状態 | `spectrack unlink docs/a.md --deps=docs/b.md --dry-run` | フロントマターから削除される予定の差分が表示され、実際のファイルは変更されないこと |

## 6. 境界値・パス解決・フォーマット維持（Boundary / Resolution / Format）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **B1-1** | 相対パスと絶対パスの解決 | `docs/a.md` と `docs/b.md` が存在 | `spectrack link docs/a.md --deps=../docs/b.md` および絶対パス指定 | パス形式に関わらず同一IDとして正しく解決され、`path` ヒントにはプロジェクトルートからの相対パスとして正規化されて記録されること |
| **B1-2** | サブディレクトリからの実行 | カレントディレクトリが `docs/prd/` | `spectrack link a.md --deps=../domain/b.md` | プロジェクトルートの `spectrack.yml` を起点としたパスコンテキストで正しく解決されること |
| **B1-3** | 自己参照の防止 | `a.md` をターゲットとして指定 | `spectrack link docs/a.md --deps=docs/a.md` | 「自分自身に依存することはできません」等のエラーとなり、処理がブロックされること |
| **B1-4** | マルチバイト・スペースを含むパス | ファイル名が `docs/要件 定義.md` | `spectrack link docs/a.md --deps="docs/要件 定義.md"` | パスが正しく解決され、YAMLの `path` ヒントにもエスケープ等破綻なく記録されること |
| **B1-5** | AST（フォーマット・コメント）の維持 | `a.md` のフロントマターにYAMLコメントが記載されている | `spectrack link docs/a.md --deps=docs/b.md` | 依存リストが追加・更新されても、既存のコメントや独自のインデントが維持されていること |

## 7. ファイル種別・内容の不整合（File Types / Invalid Formats）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **F1-1** | 対象外拡張子の指定（依存元） | `logo.png` が存在する | `spectrack link logo.png --deps=docs/b.md` | 対象ファイルがサポート外の拡張子である旨のエラーとなり、処理が中断されること |
| **F1-2** | 対象外拡張子の指定（依存先） | `docs/a.md` と `logo.png` が存在する | `spectrack link docs/a.md --deps=logo.png` | 依存先ファイルがサポート外である旨のエラーとなり、対象ファイルが変更されないこと |
| **F1-3** | バイナリ偽装ファイル（依存元） | 拡張子は `.md` だが中身がバイナリの `fake.md` | `spectrack link fake.md --deps=docs/b.md` | パースエラーを検知し、ファイルが破壊・変更されず安全に終了すること |
| **F1-4** | バイナリ偽装ファイル（依存先） | 拡張子は `.md` だが中身がバイナリの `fake.md` | `spectrack link docs/a.md --deps=fake.md` | 依存先の読み込み時にパースエラーをキャッチし、エラーで処理を中断すること |
| **F1-5** | `unlink` 時の対象外ファイル指定 | `a.md` が `b.md` に依存している | `spectrack unlink docs/a.md --deps=logo.png` | 対象外ファイルとして即座にエラーになるか警告が出て、対象ファイルが変更されないこと |

## 8. 不完全なフロントマター（Missing Keys / Empty Values）

| ID | テスト項目 | 事前条件 | 実行コマンド | 期待される結果 |
| :--- | :--- | :--- | :--- | :--- |
| **M1-1** | `x-st-dependencies` キー欠損 | 対象ファイルに `x-st-id` はあるが、依存リストキー自体が存在しない | `spectrack link docs/a.md --deps=docs/b.md` | クラッシュせず、新たにキーと配列を生成して正常に依存関係が追加されること |
| **M1-2** | 依存元の `x-st-id` が空・欠損 | 対象ファイルにフロントマターはあるが、`x-st-id` が空文字またはキー自体がない | `spectrack link docs/a.md --deps=docs/b.md` | 「対象ファイルのIDが不正または未初期化です」等のエラーで処理が中断されること |
| **M1-3** | 依存先の `x-st-id` が空・欠損 | 依存先ファイルにフロントマターはあるが、`x-st-id` が空文字または欠損している | `spectrack link docs/a.md --deps=docs/b.md` | 「依存先のIDが取得できません」等のエラーで処理が中断されること |
| **M1-4** | 依存先のバージョン情報欠損 | 依存先ファイルに `x-st-version-path` で指定されたキーが存在しない | `spectrack link docs/a.md --deps=docs/b.md` | 「依存先のバージョン情報が見つかりません」等のエラーで処理が中断されること |
| **M1-5** | `unlink` 時のリスト欠損 | 対象ファイルの `x-st-dependencies` が存在しない（または null） | `spectrack unlink docs/a.md --deps=docs/b.md` | ツールが null 参照等でクラッシュせず、「解除する依存関係が存在しません」として安全に終了すること |
| **M1-6** | 不正な型の値が指定されている | 対象ファイルの `x-st-dependencies` が配列ではなく、文字列や数値になっている | `spectrack link docs/a.md --deps=docs/b.md` | 型の不整合を検知し、ファイルを破壊することなく「フロントマターの形式が不正です」等のエラーで中断すること |