---
description: "001-culinary-platform 第二轮差距收敛任务列表"
---

# 任务列表 v2: 海外美食文化学习平台（差距收敛）

**输入**: `spec.md` + `gap-closure.md`  
**目标**: 收敛规格差距，形成可上线的稳定能力与关键业务完整度  

## 格式: `[ID] [P?] [Phase] 描述`

- **[P]**: 可以并行执行（不同文件、无强依赖）
- **[Phase]**: 所属阶段（P0/P1/P2）

---

## 阶段 P0: 稳定性与闭环

- [X] V200 [P0] 修复 Web 构建期 API 不可达导致失败：`apps/web/lib/api/index.ts`、`apps/web/app/page.tsx`
- [X] V201 [P0] 增强支付失败/取消回调处理与状态落库：`apps/api/src/modules/payment/webhook.controller.ts`、`apps/api/src/modules/payment/order.service.ts`
- [X] V202 [P0] 在取消页实现重试购买入口：`apps/web/app/checkout/cancel/page.tsx`
- [X] V203 [P0] 统一未登录访问购买/播放的返回与跳转：`apps/api/src/modules/auth/`、`apps/web/app/login/`
- [X] V204 [P0] 增加 P0 回归测试（API + Web E2E）：`apps/api/test/`、`apps/web/tests/e2e/`

**检查点**: API 关闭时可构建、支付失败可重试、登录态行为一致

---

## 阶段 P1: 规格关键功能补齐

- [X] V300 [P1] 扩展支付网关支持 PayPal：`apps/api/src/modules/payment/`
- [X] V301 [P] [P1] 前端接入 PayPal 支付入口：`apps/web/app/courses/[courseId]/page.tsx`
- [X] V302 [P1] 增加多币种（USD/EUR）课程与订单结算支持：`apps/api/prisma/schema.prisma`、`apps/api/src/modules/payment/`
- [X] V303 [P] [P1] 前端展示多币种价格与格式化：`apps/web/lib/api/`、`apps/web/app/courses/[courseId]/page.tsx`
- [X] V304 [P1] 播放链路接入 HLS/DASH 源与签发：`apps/api/src/modules/playback/`
- [X] V305 [P1] 播放页适配 HLS/DASH 播放：`apps/web/app/watch/[courseId]/page.tsx`
- [X] V306 [P1] 补齐播放器控制能力（倍速/音量/全屏/拖拽）：`apps/web/app/watch/[courseId]/page.tsx`
- [X] V307 [P1] 增加 P1 回归测试（支付链路 + 播放）：`apps/api/test/`、`apps/web/tests/e2e/`

**检查点**: PayPal 支付可用、多币种可结算、播放支持自适应流

---

## 阶段 P2: 完整度与可观测

- [X] V400 [P2] 实现内容上传与管理 API（课程/视频 CRUD）：`apps/api/src/modules/admin-content/`
- [X] V401 [P] [P2] 实现最小管理页面（上架/下架、内容维护）：`apps/web/app/admin/`
- [X] V402 [P2] 增加地域限制策略与中间件：`apps/api/src/common/geo/`、`apps/api/src/modules/payment/`、`apps/api/src/modules/playback/`
- [X] V403 [P2] 增加支付成功率与播放质量埋点：`apps/api/src/common/observability/`、`apps/web/`
- [X] V404 [P2] 增加复购与留存基础事件埋点：`apps/api/src/common/observability/`、`apps/web/`
- [X] V405 [P2] 增加 P2 回归测试与指标验证脚本：`apps/api/test/`、`apps/web/tests/e2e/`

**检查点**: 具备内容管理能力、地域策略可执行、关键指标可观测

---

## 完成定义（DoD）

- [X] 所有任务完成并标注 `[X]`
- [X] `npm run build` 在标准开发环境下稳定通过
- [X] API 单测与 e2e 全绿，Web e2e 全绿
- [X] 与 `spec.md` 的 FR/US/Edge Cases 差距项有明确闭环或记录豁免
- [X] 更新相关文档（`tasks-v2.md`、`gap-closure.md`）与运行说明
