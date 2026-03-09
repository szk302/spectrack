#!/bin/bash
set -e

if [ -z "${USER_NAME}" ]; then
  echo "Error: USER_NAME environment variable is not set" >&2
  exit 1
fi

# 非rootユーザーでコマンド実行
exec gosu "${USER_NAME}" "$@"
