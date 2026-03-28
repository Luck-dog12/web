# 实施计划 (Implementation Plan): [功能名称]

**分支**: `[###-feature-name]` | **日期**: [DATE] | **规格说明书**: [link]
**输入**: 来自 `/specs/[###-feature-name]/spec.md` 的功能规格说明书

**注意**: 此模板由 `/speckit.plan` 命令填充。执行工作流请参考 `.specify/templates/plan-template.md`。

## 摘要 (Summary)

[从功能规格中提取：主要需求 + 研究得出的技术方案]

## 技术背景 (Technical Context)

<!--
  项目特定的技术架构
  基于用户对“海外美食文化学习平台”的输入
-->

**语言/版本**: TypeScript 5.x, Node.js 20+ (LTS)
**主要依赖**: Next.js (App Router), NestJS (API), Tailwind CSS, Prisma (ORM), Stripe SDK
**存储**: PostgreSQL (主数据), Redis (缓存/会话/限流), Cloudflare R2 / AWS S3 (静态资源)
**视频交付**: Cloudflare Stream (上传/转码/HLS/CDN)
**认证与身份**: Session Cookies (Web) / JWT (移动端), Clerk/Auth0 或自建 (NestJS + Passport)
**测试**: Jest (单元/集成), Playwright (E2E), React Testing Library
**目标平台**: Vercel/Docker (Web/API), Cloudflare Edge (安全/CDN)
**项目类型**: 模块化单体 (Web + API)
**性能目标**: 视频起播时间 < 2s (全球), API 延迟 < 100ms (P95), LCP < 2.5s
**约束**: GDPR/CCPA 合规, PCI-DSS (通过 Stripe), 高可用性 (多区域 CDN)
**规模/范围**: 支持全球用户，可扩展的视频摄取和播放

## 宪章检查 (Constitution Check)

*关卡: 必须在阶段 0 研究前通过。在阶段 1 设计后重新检查。*

[基于宪章文件确定的关卡]

## 项目结构 (Project Structure)

### 文档 (本功能)

```text
specs/[###-feature]/
├── plan.md              # 本文件 (/speckit.plan 命令输出)
├── research.md          # 阶段 0 输出 (/speckit.plan 命令)
├── data-model.md        # 阶段 1 输出 (/speckit.plan 命令)
├── quickstart.md        # 阶段 1 输出 (/speckit.plan 命令)
├── contracts/           # 阶段 1 输出 (/speckit.plan 命令)
└── tasks.md             # 阶段 2 输出 (/speckit.tasks 命令 - 非 /speckit.plan 创建)
```

### 源代码 (仓库根目录)

<!--
  标准项目结构：模块化单体 API + Next.js 前端
-->

```text
apps/
├── web/                     # 前端: Next.js + TypeScript + Tailwind
│   ├── app/                 # App Router (页面 & 布局)
│   ├── components/          # React 组件 (UI 库)
│   ├── lib/                 # 共享工具 & API 客户端
│   └── public/              # 静态资源
│
└── api/                     # 后端: NestJS + TypeScript
    ├── src/
    │   ├── modules/         # 领域模块 (模块化单体)
    │   │   ├── auth/        # 注册, 登录, 会话, 设备管理
    │   │   ├── catalog/     # 课程/视频元数据, 上下架
    │   │   ├── payment/     # Stripe Checkout, Webhooks, 订单状态机
    │   │   ├── entitlement/ # 用户权限 & 访问控制
    │   │   ├── playback/    # 视频会话, 并发限制, 令牌签发
    │   │   └── admin/       # CMS, 定价, 运营配置
    │   ├── common/          # 共享守卫, 拦截器, DTOs
    │   └── main.ts          # 应用程序入口点
    ├── prisma/              # 数据库模式 & 迁移
    └── test/                # E2E 测试
```

**结构决策**: 采用 Monorepo 结构，`apps/web` (Next.js) 作为前端，`apps/api` (NestJS) 作为后端，以确保类型安全并在可能的情况下共享代码。后端采用模块化单体架构，以平衡开发速度与领域分离。

## 复杂度追踪 (Complexity Tracking)

> **仅当宪章检查有必须合理的违规项时填写**

| 违规项 | 为何需要 | 拒绝更简单方案的原因 |
|-----------|------------|-------------------------------------|
| [例如: 微服务] | [规模需求] | [单体限制了部署速度] |
| [例如: 自定义认证] | [特定流程] | [SaaS 提供商太贵/不灵活] |
