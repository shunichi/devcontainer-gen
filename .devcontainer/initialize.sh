#!/bin/bash
set -euo pipefail

# Copy host's SSH public key if present
touch .devcontainer/.ssh_authorized_keys
cat ~/.ssh/id_*.pub > .devcontainer/.ssh_authorized_keys 2>/dev/null || true

# Copy host's tmux config if present
[ -f ~/.tmux.conf ] && cp ~/.tmux.conf .devcontainer/.tmux.conf || true
