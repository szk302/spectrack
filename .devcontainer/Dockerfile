FROM debian:12.11-slim

ARG TZ=Asia/Tokyo
ARG UID=1000
ARG GID=1000
ARG USER_NAME=dev
ARG NODE_VERSION=24.10.0
ARG BUN_VERSION=1.2.19
ARG DENO_VERSION=2.5.4
ARG RUST_VERSION=1.90.0
ARG UV_VERSION=0.9.0
ARG GIT_CLIFF_VERSION=2.10.1
ARG YQ_VERSION=v4.47.2
ARG ARCH=x64
ARG Q_VERSION=1.17.1
ARG CLAUDE_CODE_VERSION=2.0.25
# see: https://github.com/google-gemini/gemini-cli/releases
ARG GEMINI_VERSION=0.16.0
ARG LEFT_HOOK_VERSION=2.0.0
ARG GH_VERSION=2.83.1

LABEL maintainer="69619077+szk302@users.noreply.github.com" \
      description="spectrack2 developer image" \
      version="1.0.0"

ENV DEVCONTAINER=true \
    LC_ALL=ja_JP.UTF-8 \
    LANG=ja_JP.UTF-8 \
    TZ="${TZ}" \
    PATH="/usr/local/bin:${PATH}" \
    HISTFILE="/commandhistory/.bash_history" \
    DEBIAN_FRONTEND=noninteractive \
    USER_NAME="${USER_NAME}"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# -------------------------------------------------------------------
# 基本ツール + ロケール
# -------------------------------------------------------------------
# hadolint ignore=DL3008
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        locales \
        build-essential \
        unzip \
        jq \
        less \
        git \
        gosu \
        sudo \
        # Git SSH署名用
        openssh-client && \
    rm -rf /var/lib/apt/lists/* && \
    sed -i -E 's/# (ja_JP.UTF-8)/\1/' /etc/locale.gen && \
    locale-gen

# -------------------------------------------------------------------
# ユーザー作成
# -------------------------------------------------------------------
RUN groupadd --gid "${GID}" "${USER_NAME}" && \
    useradd --uid "${UID}" --gid "${GID}" --shell /bin/bash --create-home "${USER_NAME}" && \
    echo "${USER_NAME}:${USER_NAME}" | /usr/sbin/chpasswd && \
    echo "${USER_NAME} ALL=(ALL:ALL) ALL" | tee "/etc/sudoers.d/${USER_NAME}" && \
    chmod 0440 "/etc/sudoers.d/${USER_NAME}"

WORKDIR /tmp

# -------------------------------------------------------------------
# Node.js
# -------------------------------------------------------------------
RUN TMP_DIR=$(mktemp -d) && \
    export TMP_DIR && \
    ( \
      pushd "${TMP_DIR}" && \
      NODE_DISTRO="linux-${ARCH}" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt.asc" && \
      gpgv --keyring="./pubring.kbx" --output SHASUMS256.txt < SHASUMS256.txt.asc && \
      grep "node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" SHASUMS256.txt | sha256sum -c - && \
      tar -xzf "node-v${NODE_VERSION}-${NODE_DISTRO}.tar.gz" -C /usr/local --strip-components=1 && \
      popd \
    ) && \
      rm -rf "${TMP_DIR}" && \
      node --version && npm --version

# -------------------------------------------------------------------
# uv
# -------------------------------------------------------------------
RUN TMP_DIR=$(mktemp -d) && \
    export TMP_DIR && \
    ( \
      pushd "${TMP_DIR}" && \
      UV_FILE="uv-x86_64-unknown-linux-gnu.tar.gz" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_FILE}" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_FILE}.sha256" && \
      grep "${UV_FILE}" "${UV_FILE}.sha256" | sha256sum -c - && \
      tar -xzf "${UV_FILE}" -C /usr/local/bin --strip-components=1 && \
      popd \
    ) && \
    rm -rf "${TMP_DIR}" && \
    uv --version

# -------------------------------------------------------------------
# yq
# -------------------------------------------------------------------
RUN TMP_DIR=$(mktemp -d) && \
    export TMP_DIR && \
    ( \
      pushd "${TMP_DIR}" && \
      YQ_BINARY=yq_linux_amd64 && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/${YQ_BINARY}" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/checksums" && \
      curl --proto '=https' --tlsv1.2 -fsSLO "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/checksums_hashes_order" && \
      SHA256_POS="$(grep -n "^SHA-256$" checksums_hashes_order | cut -d: -f1)" && \
      FIELD_NUM="$((SHA256_POS + 1))" && \
      echo "$(grep "^${YQ_BINARY} " checksums | tr -s ' ' | cut -d' ' "-f${FIELD_NUM}")  ${YQ_BINARY}" | sha256sum -c - && \
      mv "${YQ_BINARY}" /usr/local/bin/yq && \
      chmod +x /usr/local/bin/yq && \
      popd \
    ) && \
    rm -rf "${TMP_DIR}" && \
    yq --version

# -------------------------------------------------------------------
# 開発ツール（ユーザ権限）
# -------------------------------------------------------------------
USER ${USER_NAME}
WORKDIR /home/${USER_NAME}

# -------------------------------------------------------------------
# Amazon Q CLI
# -------------------------------------------------------------------
RUN TMP_DIR=$(mktemp -d) && \
    export TMP_DIR && \
    ( \
      pushd "${TMP_DIR}" && \
      echo -e "-----BEGIN PGP PUBLIC KEY BLOCK----- \n\
\n\
mDMEZig60RYJKwYBBAHaRw8BAQdAy/+G05U5/EOA72WlcD4WkYn5SInri8pc4Z6D\n\
BKNNGOm0JEFtYXpvbiBRIENMSSBUZWFtIDxxLWNsaUBhbWF6b24uY29tPoiZBBMW\n\
CgBBFiEEmvYEF+gnQskUPgPsUNx6jcJMVmcFAmYoOtECGwMFCQPCZwAFCwkIBwIC\n\
IgIGFQoJCAsCBBYCAwECHgcCF4AACgkQUNx6jcJMVmef5QD/QWWEGG/cOnbDnp68\n\
SJXuFkwiNwlH2rPw9ZRIQMnfAS0A/0V6ZsGB4kOylBfc7CNfzRFGtovdBBgHqA6P\n\
zQ/PNscGuDgEZig60RIKKwYBBAGXVQEFAQEHQC4qleONMBCq3+wJwbZSr0vbuRba\n\
D1xr4wUPn4Avn4AnAwEIB4h+BBgWCgAmFiEEmvYEF+gnQskUPgPsUNx6jcJMVmcF\n\
AmYoOtECGwwFCQPCZwAACgkQUNx6jcJMVmchMgEA6l3RveCM0YHAGQaSFMkguoAo\n\
vK6FgOkDawgP0NPIP2oA/jIAO4gsAntuQgMOsPunEdDeji2t+AhV02+DQIsXZpoB\n\
=f8yY\n\
-----END PGP PUBLIC KEY BLOCK-----" > "q.key" && \
      gpg --import "q.key" && \
      OS=$(uname -m) && \
      curl --proto '=https' --tlsv1.2 -fsSL "https://desktop-release.q.us-east-1.amazonaws.com/${Q_VERSION}/q-${OS}-linux.zip" -o q.zip && \
      curl --proto '=https' --tlsv1.2 -fsSL "https://desktop-release.q.us-east-1.amazonaws.com/${Q_VERSION}/q-${OS}-linux.zip.sig" -o q.zip.sig && \
      gpg --verify "q.zip.sig" "q.zip" && \
      unzip q.zip && \
      q/install.sh --no-confirm --force && \
      popd \
    ) && \
    rm -rf "${TMP_DIR}" && \
    source ~/.bashrc && \
    q --version

# Claude Code CLI
RUN npm install -g "@anthropic-ai/claude-code" && \
    claude --version
COPY --chown=${USER_NAME}:${USER_NAME} .claude /home/${USER_NAME}/.claude

# Gemini CLI
RUN npm install -g "@google/gemini-cli" && \
    gemini --version

RUN npm i -g backlog.md

# -------------------------------------------------------------------
# エントリポイント
# -------------------------------------------------------------------
# hadolint ignore=DL3002
USER root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
