# devcontainer-gen

YAML 設定ファイルから VS Code 用の `.devcontainer/` ディレクトリを生成するツール。

DNS ベースのファイアウォール（iptables + dnsmasq）による通信制限付きの devcontainer 設定を生成する。

## インストール

```bash
pnpm install -g github:shunichi/devcontainer-gen
```

## 使い方

### 設定 YAML の初期化

テンプレートから設定 YAML を生成する。`node`, `firebase`, `rails` の3種類を用意。

```bash
devcontainer-gen init -t node                # Node.js プロジェクト
devcontainer-gen init -t firebase            # Firebase プロジェクト
devcontainer-gen init -t rails               # Rails + Node.js プロジェクト
devcontainer-gen init -t node -n my-app      # プロジェクト名を指定
devcontainer-gen init -t node -o config.yml  # 出力ファイルを指定
devcontainer-gen init -t rails --postgres 16 # PostgreSQL バージョンを指定
```

| オプション | 短縮 | デフォルト | 説明 |
|---|---|---|---|
| `--template` | `-t` | (必須) | `node`, `firebase`, `rails` |
| `--name` | `-n` | カレントディレクトリ名 | プロジェクト名 |
| `--output` | `-o` | `devcontainer-gen.yml` | 出力ファイルパス |
| `--postgres` | - | `18` | PostgreSQL バージョン（rails のみ） |
| `--redis` | - | `7` | Redis バージョン（rails のみ） |

Ruby・Node.js・pnpm のバージョンは `ruby -v`・`node -v`・`pnpm -v` から自動検出される。コマンドが見つからない場合はデフォルト値が使われる。

`node` と `firebase` テンプレートでは `pnpm-lock.yaml` の `importers` フィールドから pnpm ワークスペースのパッケージを検出し、各パッケージの `node_modules` マウントを自動生成する。

### devcontainer ファイルの生成

```bash
devcontainer-gen devcontainer-gen.yml
devcontainer-gen devcontainer-gen.yml -o .devcontainer
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

languages:
  node:
    version: "22"
    package_manager: pnpm
    pnpm_version: "10"

vscode:
  extensions:
    - anthropic.claude-code

lifecycle:
  post_create: "pnpm install"
```

### Ruby + Node.js + Docker Compose 構成

```yaml
project:
  name: my-rails-app

languages:
  ruby:
    version: "3.4.5"
  node:
    version: "22"
    package_manager: pnpm
    pnpm_version: "10"

system_packages:
  - build-essential
  - libpq-dev
  - libvips

services:
  db:
    image: postgres:18
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata-18:/var/lib/postgresql
    ports:
      - "15432:5432"
  redis:
    image: redis:7
    volumes:
      - redis-data-7:/data

vscode:
  extensions:
    - anthropic.claude-code
    - Shopify.ruby-lsp
    - KoichiSasada.vscode-rdbg

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
```

## 設定リファレンス

### project

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | プロジェクト名。コンテナ名やボリュームプレフィックスに使用 |

### container

| フィールド | 必須 | デフォルト | 説明 |
|---|---|---|---|
| `timezone` | No | `Asia/Tokyo` | タイムゾーン |
| `firewall_mode` | No | `restrict` | `restrict`（許可ドメインのみ）または `observe`（全通信をログ） |
| `editor` | No | `code` | `EDITOR` / `VISUAL` 環境変数に設定するエディタ |

### languages

ベースイメージは `languages` から自動決定される。

- `ruby` 指定あり → `ruby:{version}-bookworm`（Node は nodesource で追加）
- `node` のみ → `node:{version}-bookworm`

`languages.node` と `languages.ruby` のうち少なくとも一方が必須。

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

Claude Code は `curl -fsSL https://claude.ai/install.sh | bash` で自動インストールされる（バージョン指定不要）。

| フィールド | デフォルト | 説明 |
|---|---|---|
| `git_delta` | `0.18.2` | git-delta のバージョン |
| `zsh_in_docker` | `1.2.0` | zsh-in-docker のバージョン |
| `firebase_tools` | - | Firebase CLI のバージョン（指定時のみインストール） |

### services

Docker Compose サービスの定義。指定すると `docker-compose.yml` が生成され、ファイアウォールに Docker 内部ネットワークの許可が追加される。

```yaml
services:
  db:
    image: postgres:18
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata-18:/var/lib/postgresql
    ports:
      - "15432:5432"
```

PostgreSQL 18 以降はデータディレクトリが `/var/lib/postgresql` に変更されている（17 以前は `/var/lib/postgresql/data`）。

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

`/workspace/` 配下および `/home/dev/` 配下にマウントされるディレクトリは Dockerfile 内で自動的に `mkdir -p` される。

### container_env

追加の環境変数。`CLAUDE_CONFIG_DIR`, `POWERLEVEL9K_DISABLE_GITSTATUS`, `HISTFILE` は自動で設定される。`NODE_OPTIONS` 等もここで指定する。

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
| `extra_run_commands` | Dockerfile に追加する RUN コマンド |

### system_packages

追加の apt パッケージ。基本的な開発ツール（git, zsh, vim, ripgrep 等）は自動でインストールされる。

## Firebase エミュレータ（firebase テンプレート）

firebase テンプレートでは以下が自動設定される:

- `firebase_tools` のインストール
- `default-jre-headless` パッケージ（エミュレータ用 JRE）
- Firebase / Google 関連ドメインの許可
- エミュレータ用ポート（Emulator UI, Functions, Firestore, Auth 等）

コンテナ起動時に `firebase.json` のエミュレータホストを `0.0.0.0` に書き換えた `firebase.devcontainer.json` を自動生成する（`post_start_extra` で実行）。

`FIREBASE_CONFIG_OPTS` 環境変数が `containerEnv` に設定されるため、`package.json` のスクリプトで以下のように参照すればコンテナ内外で設定を切り替えられる：

```json
{
  "scripts": {
    "emulators:start": "firebase emulators:start $FIREBASE_CONFIG_OPTS -P demo-project"
  }
}
```

コンテナ内では `--config /workspace/firebase.devcontainer.json` が展開され、コンテナ外では変数が未設定のため通常の `firebase.json` が使われる。

`firebase.devcontainer.json` は `.gitignore` に追加しておくこと。

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
