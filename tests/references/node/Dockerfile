FROM node:22-bookworm

ARG TZ
ENV TZ="$TZ"

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.utf8
ENV LC_ALL=C.utf8

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  dnsmasq \
  aggregate \
  jq \
  nano \
  ripgrep \
  vim \
  tmux \
  openssh-server \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist command history
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin:/home/node/.local/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=code
ENV VISUAL=code

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

ARG PNPM_VERSION=10.30.0

# Install pnpm and zsh completion
RUN npm install -g pnpm@${PNPM_VERSION} \
  && mkdir -p /usr/local/share/zsh/site-functions \
  && pnpm completion zsh > /usr/local/share/zsh/site-functions/_pnpm

# Install Claude Code
RUN curl -fsSL https://claude.ai/install.sh | bash

# Pre-create directories for named volume mounts (owned by node user)
RUN mkdir -p \
  /workspace/.pnpm-store \
  /workspace/node_modules

# Firewall mode: restrict (default) or observe (for domain discovery)
ARG FIREWALL_MODE=restrict

# Copy and set up firewall script.
# Create dnsmasq log file owned by nobody at build time to avoid permission issues at runtime.
COPY init-firewall.sh test-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh /usr/local/bin/test-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh ${FIREWALL_MODE}, /usr/local/bin/test-firewall.sh, /usr/bin/mkdir -p /run/sshd, /usr/sbin/sshd" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall && \
  echo "${FIREWALL_MODE}" > /etc/firewall-mode && chmod 644 /etc/firewall-mode && \
  touch /var/log/dnsmasq.log && chown nobody:nogroup /var/log/dnsmasq.log
USER node
