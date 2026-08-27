# Agent Note: 受限的本地 `.env` 文件命令

Status: implemented

[English](2026-08-27-env-management-script.md) | 中文

## 问题

开发者需要一种可重复的方式来校验和初始化 harness 使用的、被 git 忽略的 `.env` 文件。现有启动路径把这些文件作为普通环境层读取，而产品管理的凭据使用独立的 YAML 存储。一个回显值、默认覆盖文件或直接编辑凭据存储的助手会降低本地设置的安全性，也会混淆这些所有权规则。

## 决策

仓库通过 `scripts/env.ts` 暴露 `pnpm run env -- <command>`。命令集合保持受限：

- `check [NAME...]` 解析一个文件（默认 `.env`），并可通过位置参数或 `--required name1,name2` 要求变量存在。
- `list` 解析文件并只输出排序后的变量名；值绝不会进入命令输出。
- `init` 把经过校验的 `.env.example`（或 `--template`）复制到目标文件；除非显式提供 `--force`，否则拒绝替换已有文件。
- `set NAME VALUE` 添加或替换一个普通变量，同时保留无关行；`unset NAME` 删除一个普通变量。两个命令都会在写入前拒绝 launch-only 名称（`DSH_*`、启动/运行时选择项、网络路由及相关变量）。

`--file` 选择 dotenv 路径，`--template` 选择初始化来源。解析使用 Node 的 `parseEnv`，因此校验器和启动器遵循相同的 dotenv 语法。初始化以 UTF-8 写入并尝试恢复所有者可读写的 `0600` 权限；不支持文件模式的平台不会因此阻止设置。错误写入 stderr 并以非零状态退出，成功操作只输出简短状态，且不包含机密值。

该助手只负责语法和本地文件初始化。它不修改 `process.env`，不应用启动环境层优先级，也不写入 `$DSH_HOME/.credentials.yaml`；启动优先级和 bootstrap 变量拒绝由 `dsh-app-boot` 负责，机密记录由 `dsh-credentials-local` 负责。

## 备选方案

**提供通用 dotenv 编辑器。** 拒绝：脚本只支持单键 `set`/`unset`，每次重写前后都校验完整文件，保留无关行并拒绝 launch-only 名称。更宽泛的编辑器还需要额外的引号和重复键策略。

**用 `dsh-credentials-local` 处理所有 `.env` 写入。** 拒绝，因为该提供方的版本化 YAML 文档有意只存储凭据记录，而不是任意环境变量。合并存储会改变优先级，并可能让非机密变量变得不可达。

**让 `list` 或 `check` 输出 `NAME=value`。** 拒绝，因为 `.env` 通常包含 API key 和 token；诊断与清单必须有用，同时不能把机密复制到日志或终端。

**让 `init` 默认覆盖 `.env`。** 拒绝，因为现有文件可能包含凭据或本地覆盖值。替换必须通过显式的 `--force` 执行。

## 后果

本地设置可以用 `pnpm run env -- init` 脚本化，CI 可以用 `check --required` 校验，`list` 可以安全查看变量名。该命令不保证文件会被产品启动器接受：`loadLayeredEnv` 会在启动时拒绝 bootstrap-only 名称，该策略仍集中在启动路径中。未来的编辑命令必须保持这种分离，避免输出变量值，并为任何新的语法或重写行为增加聚焦测试。
