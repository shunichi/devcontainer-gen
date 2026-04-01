# devcontainer-gen

YAML 設定ファイルから VS Code 用の `.devcontainer/` ディレクトリを生成するツール。

DNS ベースのファイアウォール（iptables + dnsmasq）による通信制限付きの devcontainer 設定を生成する。

## 使い方

### 他のプロジェクトから GitHub URL で実行

```bash
pnpm dlx github:shunichi/devcontainer-gen devcontainer-gen.yml
```

### ローカルで実行

```bash
pnpm generate devcontainer-gen.yml
pnpm generate devcontainer-gen.yml -o .devcontainer
```

## 生成されるファイル

| ファイル | 説明 |
|---|---|
| `devcontainer.json` | devcontainer 設定本体 |
| `Dockerfile` | コンテナイメージ定義 |
| `docker-compose.yml` | services 指定時のみ生成 |
| `allowed-domains.conf` | DNS 許可ドメインリスト |
| `dnsmasq.conf` | 制限モード用 DNS 設定 |
| `dnsmasq-observe.conf` | 観察モード用 DNS 設定 |
| `init-firewall.sh` | iptables ファイアウォール初期化 |
| `initialize.sh` | ホスト側の初期化（SSH 鍵コピー等） |
| `post-start.sh` | コンテナ起動時処理 |
| `cleanup-devcontainer-images.sh` | Docker イメージ削除ユーティリティ |
| `cleanup-devcontainer-volumes.sh` | Docker ボリューム削除ユーティリティ |
| `test-firewall.sh` | ファイアウォールルールのテスト |

## 設定ファイル（YAML）

### 最小構成（Node.js）

```yaml
project:
  name: my-app

container:
  user: node

languages:
  node:
    version: "22"
    package_manager: pnpm
    pnpm_version: "10.30.0"

vscode:
  extensions:
    - anthropic.claude-code

lifecycle:
  post_create: "pnpm install"

dockerfile:
  pre_create_dirs:
    - node_modules
```

### Ruby + Node.js + Docker Compose 構成

```yaml
project:
  name: my-rails-app

container:
  user: dev

languages:
  ruby:
    version: "3.4.5"
  node:
    version: "22"
    package_manager: pnpm
    pnpm_version: "10.32.1"

system_packages:
  - locales
  - build-essential
  - libpq-dev
  - libvips

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "15432:5432"
  redis:
    image: redis:7
    volumes:
      - redis-data:/data

vscode:
  extensions:
    - anthropic.claude-code
    - Shopify.ruby-lsp

mounts:
  - name: bundle-cache
    target: /usr/local/bundle

container_env:
  DATABASE_CONFIG: config/database.devcontainer.yml
  REDIS_URL: redis://redis:6379/1

compose:
  app_environment:
    RUBYOPT: "-EUTF-8"

lifecycle:
  post_create: "bundle install && pnpm install"

dockerfile:
  pre_create_dirs:
    - node_modules
    - vendor/bundle
```

## 設定リファレンス

### project

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | プロジェクト名。コンテナ名やボリュームプレフィックスに使用 |

### container

| フィールド | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `user` | Yes | - | コンテナ内のユーザー名。Node ベースなら `node`、Ruby ベースなら `dev` 等 |
| `timezone` | No | `Asia/Tokyo` | タイムゾーン |
| `firewall_mode` | No | `restrict` | `restrict`（許可ドメインのみ）または `observe`（全通信をログ） |

### languages

ベースイメージは `languages` から自動決定される。

- `ruby` 指定あり → `ruby:{version}-bookworm`（Node は nodesource で追加）
- `node` のみ → `node:{version}-bookworm`

#### languages.node

| フィールド | 必須 | 説明 |
|---|---|---|
| `version` | Yes | Node.js バージョン（例: `"22"`） |
| `package_manager` | No | `pnpm` または `npm` |
| `pnpm_version` | No | pnpm のバージョン |

#### languages.ruby

| フィールド | 必須 | 説明 |
|---|---|---|
| `version` | Yes | Ruby バージョン（例: `"3.4.5"`） |

### tools

| フィールド | デフォルト | 説明 |
|---|---|---|
| `claude_code` | `latest` | Claude Code のバージョン |
| `git_delta` | `0.18.2` | git-delta のバージョン |
| `zsh_in_docker` | `1.2.0` | zsh-in-docker のバージョン |
| `firebase_tools` | - | Firebase CLI のバージョン（指定時のみインストール） |

### services

Docker Compose サービスの定義。指定すると `docker-compose.yml` が生成され、ファイアウォールに Docker 内部ネットワークの許可が追加される。

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "15432:5432"
```

### vscode

| フィールド | 必須 | 説明 |
|---|---|---|
| `extensions` | Yes | VS Code 拡張機能の ID リスト |
| `settings` | No | VS Code の設定 |

### mounts

追加の名前付きボリューム。`zsh-history` と `claude-config` は自動で追加される。

```yaml
mounts:
  - name: node-modules
    target: /workspace/node_modules
```

### container_env

追加の環境変数。`NODE_OPTIONS`, `CLAUDE_CONFIG_DIR`, `POWERLEVEL9K_DISABLE_GITSTATUS`, `HISTFILE` は自動で設定される。

### allowed_domains

プロジェクト固有の許可ドメイン。以下のドメインは自動で含まれる:

- npm (npmjs.org, npmjs.com)
- GitHub
- Claude Code
- GitHub Copilot
- VS Code 拡張機能
- JSON スキーマ
- TLS 証明書失効確認
- RubyGems（`languages.ruby` 指定時）

```yaml
allowed_domains:
  - group: CopyTuner
    domains:
      - copy-tuner.sg-apps.com
```

### ports

```yaml
ports:
  - port: 3000
    label: Rails
    on_auto_forward: notify  # notify | silent | ignore
```

### lifecycle

| フィールド | 説明 |
|---|---|
| `post_create` | コンテナ初回作成時のコマンド |
| `post_start_extra` | コンテナ起動時にファイアウォール初期化後に実行する追加コマンド |

### compose

| フィールド | 説明 |
|---|---|
| `app_environment` | docker-compose の app サービスに設定する環境変数 |

### dockerfile

| フィールド | 説明 |
|---|---|
| `pre_create_dirs` | ボリュームマウント用に事前作成するディレクトリ |
| `extra_run_commands` | Dockerfile に追加する RUN コマンド |

### system_packages

追加の apt パッケージ。基本的な開発ツール（git, zsh, vim, ripgrep 等）は自動でインストールされる。

## ファイアウォール

生成される devcontainer には DNS ベースのネットワーク制限が含まれる。

- **restrict モード**: `allowed-domains.conf` に記載されたドメインのみアクセス可能。DNS で解決されていない IP への直接アクセスもブロック。
- **observe モード**: 制限なし。全 DNS クエリをログに記録し、必要なドメインを調査する。

新しいプロジェクトでは `firewall_mode: observe` で必要なドメインを調査してから `restrict` に切り替える運用を想定。

## 開発

```bash
pnpm install
pnpm test
pnpm typecheck
```
