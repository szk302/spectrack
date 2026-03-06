/**
 * vitest v4 ではプロセスが自然に終了するため、このファイルは不要になった。
 * vitest v3 では残留ハンドルによるハング問題があったが、v4 で修正済み。
 */
export default function setup() {
  return function teardown() {};
}
