# Agent Note: Account-scoped Web API keys

Status: implemented

[English](2026-08-26-web-api-key-management.md) | 中文

## Problem

登录后的 Web 用户无法创建、查看或撤销 API 凭据，未来远程 Key 存储也没有账号归属约定。

## Decision

登录账户栏打开 API Key 面板，支持按账号查看列表、创建、一次性显示并复制密钥，以及撤销操作。浏览器通过配置的认证 API 调用 `/keys` 接口并携带现有会话 Cookie。本地开发回退按账号 ID 存储 Key，不同账号互不共享。服务端必须校验归属，并使用 `AUTH_DATABASE_URL` 指定的远程数据库保存密钥。

## Alternatives considered

**在浏览器存储中使用全局 Key 列表。** 否决，因为即使开发模式也必须隔离不同账号的凭据。

**让浏览器直接访问数据库。** 否决，因为数据库凭据和授权必须由服务端负责。

## Consequences

生产部署需要提供文档所述的 Key 接口和按账号隔离的数据库适配器。新建密钥只在创建时提供复制入口，列表只返回元数据。
