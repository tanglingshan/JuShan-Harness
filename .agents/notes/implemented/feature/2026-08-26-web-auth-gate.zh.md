# Agent Note: Web authentication gate

Status: implemented

[English](2026-08-26-web-auth-gate.md) | 中文

## Problem

Web Shell 没有账号入口，部署无法在打开会话前要求身份，也没有预留远程账号服务的接入方式。

## Decision

`apps/web` 入口在 `AppWebEntry` 之前挂载登录/注册门禁，并在登录后显示用户名和退出操作。组件通过可配置的 `VITE_AUTH_API_URL` 携带 Cookie 调用 `/register`、`/login`、`/me` 和 `/logout` 接口。远程服务不存在时，网络错误、404 和 503 使用浏览器本地开发存储，并以 SHA-256 保存密码哈希。服务端专用的 `AUTH_DATABASE_URL` 位置写在 `.env.example` 中，浏览器不会接收该值。

## Alternatives considered

**浏览器直接连接数据库。** 否决，因为这会暴露数据库凭据并绕过服务端授权。

**远程服务就绪前阻断整个界面。** 否决，本地回退可以在部署接线完成前验证界面和表单流程。

## Consequences

生产部署必须提供文档所述的 HTTP 认证接口来保存账号。浏览器本地回退明确只用于开发，远程 API 可用后会自动切换。
