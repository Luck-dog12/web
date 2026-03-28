---

description: "001-culinary-platform 实施任务列表"
---

# 任务列表: 海外美食文化学习平台（001-culinary-platform）

**输入**: `/specs/001-culinary-platform/`（spec.md, plan.md）  
**先决条件**: spec.md（必须）, plan.md（必须）  

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可以并行执行（不同的文件，无依赖关系）
- **[Story]**: 此任务所属的用户故事（US1/US2/US3）
- 任务描述中包含准确的文件路径

---

## 阶段 1: 设置（共享基础设施）

- [X] T001 创建 Monorepo 目录结构：`apps/web/` 与 `apps/api/`
- [X] T002 初始化根目录 Node.js Workspace：`package.json`、工作区配置、统一脚本
- [X] T003 [P] 初始化前端 Next.js（App Router + TypeScript）：`apps/web/`
- [X] T004 [P] 初始化后端 NestJS（TypeScript）：`apps/api/`
- [X] T005 [P] 配置 ESLint/Prettier（根目录 + apps 继承）：`.eslintrc*`/`eslint.config.*`、`.prettierrc*`
- [X] T006 [P] 配置 Tailwind（如启用）：`apps/web/tailwind.config.ts`、`apps/web/postcss.config.*`
- [X] T007 配置环境变量样例与校验：`.env.example`、`apps/api/src/common/config/`

---

## 阶段 2: 基础（阻塞性先决条件）

- [X] T020 配置 Prisma 与数据库迁移：`apps/api/prisma/schema.prisma`、`apps/api/prisma/migrations/`
- [X] T021 建立 PrismaClient 注入与生命周期管理：`apps/api/src/common/prisma/`
- [X] T022 [P] 建立 Redis 客户端与通用封装：`apps/api/src/common/redis/`
- [X] T023 实现 Auth 模块（会话 Cookie）：`apps/api/src/modules/auth/`
- [X] T024 统一错误处理与结构化日志：`apps/api/src/common/filters/`、`apps/api/src/common/logger/`
- [X] T025 配置基础安全策略（CORS、速率限制、基础 Header）：`apps/api/src/main.ts`、`apps/api/src/common/`

**检查点**: 完成后可开始并行开发 US1/US2/US3

---

## 阶段 3: 用户故事 1 - 探索美食课程（优先级: P1）🎯

**目标**: 游客可浏览课程列表与详情页，明确价格与课程信息。  
**独立测试**: 访问 `apps/web/app/page.tsx` 可看到课程列表；点击进入 `apps/web/app/courses/[courseId]/page.tsx` 可查看详情。

- [X] T030 [P] [US1] 定义课程与视频数据模型：`apps/api/prisma/schema.prisma`（Course、Video）
- [X] T031 [US1] 实现 Catalog 模块服务：`apps/api/src/modules/catalog/`
- [X] T032 [US1] 实现课程列表与详情 API：`apps/api/src/modules/catalog/catalog.controller.ts`
- [X] T033 [P] [US1] 实现 Web 首页课程列表：`apps/web/app/page.tsx`
- [X] T034 [US1] 实现 Web 课程详情页：`apps/web/app/courses/[courseId]/page.tsx`
- [X] T035 [P] [US1] 实现前端 API 客户端与类型：`apps/web/lib/api/`

---

## 阶段 4: 用户故事 2 - 购买视频课程（优先级: P1）

**目标**: 用户完成支付后获得权限，权限以 PayPal webhook 落库为准。  
**独立测试**: 点击购买后可进入 PayPal 支付；支付成功后订单与权限可在数据库中查询到。

- [X] T040 [US2] 实现 Payment 模块（创建 Checkout Session）：`apps/api/src/modules/payment/payment.controller.ts`
- [X] T041 [US2] 实现 PayPal Webhook 接收与处理：`apps/api/src/modules/payment/webhook.controller.ts`
- [X] T042 [US2] 实现订单状态机与落库：`apps/api/src/modules/payment/order.service.ts`
- [X] T043 [US2] 实现 Entitlement 模块（授予/校验/查询）：`apps/api/src/modules/entitlement/`
- [X] T044 [US2] 在课程详情页接入购买按钮与跳转：`apps/web/app/courses/[courseId]/page.tsx`
- [X] T045 [P] [US2] 增加支付成功/取消回调页面：`apps/web/app/checkout/success/page.tsx`、`apps/web/app/checkout/cancel/page.tsx`

---

## 阶段 5: 用户故事 3 - 在线观看学习（优先级: P1）

**目标**: 已购买用户可进入播放页并观看；未购买用户被拦截。  
**独立测试**: 已购买用户访问 `/watch/[courseId]` 可播放；未购买用户被引导至购买页。

- [X] T050 [US3] 实现 Playback 模块（创建播放会话 + 并发限制）：`apps/api/src/modules/playback/`
- [X] T051 [US3] 校验 Entitlement 并签发短时播放凭证：`apps/api/src/modules/playback/token.service.ts`
- [X] T052 [US3] 实现 Web 播放页并接入 Cloudflare Stream：`apps/web/app/watch/[courseId]/page.tsx`
- [X] T053 [US3] 实现未购买拦截与引导：`apps/web/app/watch/[courseId]/page.tsx`、`apps/web/app/courses/[courseId]/page.tsx`

---

## 阶段 N: 完善 & 横切关注点

- [X] T070 [P] 接入 Sentry（Web/API）与基础 Trace：`apps/web/`、`apps/api/src/common/observability/`
- [X] T071 [P] 添加 Playwright E2E（浏览→购买→播放）覆盖：`apps/web/tests/e2e/`
- [X] T072 性能优化（图片/缓存/路由分包）：`apps/web/`、`apps/api/`

