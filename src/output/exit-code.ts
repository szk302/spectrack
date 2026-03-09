/** spectrack の終了コード定義 */
export const ExitCode = {
  /** 成功、エラーなし */
  SUCCESS: 0,
  /** エラーあり（致命的） */
  ERROR: 1,
  /** 警告あり（処理は完了したが注意が必要） */
  WARNING: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
