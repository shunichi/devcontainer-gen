export interface ProjectConfig {
  name: string;
}

export interface ContainerConfig {
  timezone?: string;
  firewall_mode?: "restrict" | "observe";
  editor?: string;
}

export interface NodeLanguageConfig {
  version: string;
  package_manager?: "pnpm" | "npm";
  pnpm_version?: string;
}

export interface RubyLanguageConfig {
  version: string;
}

export interface LanguagesConfig {
  ruby?: RubyLanguageConfig;
  node?: NodeLanguageConfig;
}

export interface ToolsConfig {
  git_delta?: string;
  zsh_in_docker?: string;
  firebase_tools?: string;
}

export interface ServiceConfig {
  image: string;
  environment?: Record<string, string>;
  volumes?: string[];
  ports?: string[];
  command?: string;
}

export interface VscodeConfig {
  extensions: string[];
  settings?: Record<string, unknown>;
}

export interface MountConfig {
  name: string;
  target: string;
}

export interface PortConfig {
  port: number;
  label: string;
  on_auto_forward: "notify" | "silent" | "ignore";
}

export interface DomainGroup {
  group: string;
  domains: string[];
}

export interface LifecycleConfig {
  post_create?: string;
  post_start_extra?: string;
}

export interface ComposeConfig {
  app_environment?: Record<string, string>;
}

export interface DockerfileConfig {
  extra_run_commands?: string[];
}

export interface DevcontainerConfig {
  project: ProjectConfig;
  container: ContainerConfig;
  languages?: LanguagesConfig;
  tools?: ToolsConfig;
  services?: Record<string, ServiceConfig>;
  system_packages?: string[];
  vscode: VscodeConfig;
  mounts?: MountConfig[];
  container_env?: Record<string, string>;
  allowed_domains?: DomainGroup[];
  ports?: PortConfig[];
  lifecycle?: LifecycleConfig;
  compose?: ComposeConfig;
  dockerfile?: DockerfileConfig;
}

/** config.ts で算出するテンプレート用コンテキスト */
export interface TemplateContext extends DevcontainerConfig {
  baseImage: string;
  hasServices: boolean;
  serviceNames: string[];
  needsNodeInstall: boolean;
  nodeBaseImage: boolean;
}
