# 实施计划 (Implementation Plan): 海外美食文化学习平台（MVP）

**分支**: `001-culinary-platform` | **日期**: 2026-02-24 | **规格说明书**: spec.md
**输入**: 来自 `/specs/001-culinary-platform/spec.md` 的功能规格说明书

## 摘要 (Summary)

面向海外用户的美食文化学习网站，通过售卖视频课程实现变现。核心闭环为：浏览课程（US1）→ 购买并获得观看权限（US2）→ 在线点播播放（US3）。

技术方案采用：Next.js（App Router）+ NestJS（REST）+ PostgreSQL/Prisma + Redis（会话/限流/并发控制）+ PayPal（Checkout + Webhook 作为权威落库）+ Cloudflare Stream（转码/HLS/签名播放）+ Cloudflare R2（封面/字幕/课件）。后端以模块化单体实现 Auth/Catalog/Payment/Entitlement/Playback/Admin 模块，便于后期扩展与拆分。

## 技术背景 (Technical Context)

**语言/版本**: TypeScript 5.x, Node.js 20+ (LTS)  
**Web**: Next.js + TypeScript（App Router）+ Tailwind（可选）  
**API**: NestJS + TypeScript（REST 为主，后期可加 GraphQL）  
**数据**: PostgreSQL（主库）+ Prisma（ORM）+ Redis（缓存/限流/会话/队列）  
**鉴权**: 会话 Cookie（Web）+ 可选 JWT（移动端/第三方）  
**身份托管**: Clerk/Auth0/Cognito（优先）或自建（NestJS + 邮箱/社交登录）  
**支付**: PayPal + Webhook（订单与权限发放以 webhook 落库为准）  
**视频**: Cloudflare Stream（上传/转码/HLS/签名播放/CDN）  
**对象存储**: Cloudflare R2 / AWS S3（封面、字幕、课件等）  
**边缘与安全**: Cloudflare（CDN/WAF/DDoS/Rate Limit/Bot）  
**可观测**: Sentry + OpenTelemetry（Trace）+ 结构化日志  
**测试**: Jest（单元/集成）、Playwright（E2E）、React Testing Library  
**性能目标**: 关键页面 LCP < 2.5s；全球起播 TTFF < 2s；API P95 < 100ms  
**约束**: GDPR/CCPA；支付合规通过 PayPal；不在日志中记录敏感信息  

## 宪章检查 (Constitution Check)

- 代码质量：启用 ESLint/Prettier，代码审查为合并前置条件  
- 测试标准：关键购买链路与权限发放具备自动化测试  
- 用户体验一致性：统一组件与交互规范；可访问性作为默认要求  
- 性能要求：Core Web Vitals 达标；禁止引入明显性能回退  

## 项目结构 (Project Structure)

### 文档 (本功能)

```text
specs/001-culinary-platform/
├── plan.md
├── spec.md
└── tasks.md
```

### 源代码 (仓库根目录)

```text
apps/
├── web/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
└── api/
    ├── src/
    │   ├── modules/
    │   └── common/
    ├── prisma/
    └── test/
```

**结构决策**: Monorepo + 模块化单体 API。前端与后端分离部署，但共享 TypeScript 类型与工具链。

## 复杂度追踪 (Complexity Tracking)

| 违规项 | 为何需要 | 拒绝更简单方案的原因 |
|-----------|------------|-------------------------------------|
|  |  |  |

