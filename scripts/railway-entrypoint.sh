#!/usr/bin/env sh
set -eu

CODEX_SHARED_HOME="${CODEX_HOME:-${HOME}/.codex}"
CODEX_AUTH_PATH="${CODEX_SHARED_HOME}/auth.json"

if [ -n "${CODEX_AUTH_JSON_B64:-}" ]; then
  mkdir -p "${CODEX_SHARED_HOME}"
  printf '%s' "${CODEX_AUTH_JSON_B64}" | base64 -d > "${CODEX_AUTH_PATH}"
  chmod 600 "${CODEX_AUTH_PATH}"
elif [ -n "${CODEX_AUTH_JSON:-}" ]; then
  mkdir -p "${CODEX_SHARED_HOME}"
  printf '%s' "${CODEX_AUTH_JSON}" > "${CODEX_AUTH_PATH}"
  chmod 600 "${CODEX_AUTH_PATH}"
fi

exec "$@"
