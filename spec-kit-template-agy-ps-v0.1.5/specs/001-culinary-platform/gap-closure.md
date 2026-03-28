# Gap Closure Plan: 001-culinary-platform

## 文档目的

本文件用于将 `spec.md` 中“已实现的 MVP 能力”与“尚未完全满足的规格项”进行差距收敛，作为下一轮实施的执行依据。

---

## 当前状态摘要

- `tasks.md` 中 T001-T072 已全部标记完成
- 前后端核心链路可联调：注册 → 浏览课程 → 购买 → 授权 → 播放
- 仍存在规格层面的缺口，主要集中在支付扩展、流媒体能力、内容管理与地域规则

---

## 最新复盘结论（2026-03-19）

- GC-001 已完成：Web 构建期具备 API 不可达降级能力，根构建可通过
- GC-002 已完成：支付失败/取消状态闭环已打通，取消页支持重试
- GC-003 已完成：未登录访问购买/播放返回与登录回跳策略一致
- GC-101 已完成：PayPal 网关已接入并具备回归测试
- GC-102 已完成：USD/EUR 多币种展示与结算已接入课程与订单链路
- GC-103 已完成：播放接口返回 MP4/HLS/DASH 源，前端支持优选播放
- GC-104 已完成：播放页补齐倍速/音量/全屏/进度拖拽控制
- GC-201 已完成：管理端课程/视频 CRUD、上架下架与内容维护可用
- GC-202 已完成：地域限制策略接入购买与播放链路并可配置拦截
- GC-203 已完成：支付/播放/复购/留存指标埋点与指标读取接口可用

---

## 差距清单（按优先级）

## P0（上线稳定性与闭环完整）

### GC-001 根构建解耦 API 强依赖
- 背景：Web 首页在构建期请求 API，API 不可达时导致 `npm run build` 失败
- 目标：API 不可用时构建仍可完成，并提供前端降级展示
- 涉及：
  - `apps/web/lib/api/index.ts`
  - `apps/web/app/page.tsx`
- 验收：
  - 关闭 API 后执行根构建成功
  - 首页展示可读的降级状态，不出现崩溃

### GC-002 支付失败状态闭环
- 背景：规格要求支付失败/超时可重试，订单状态需可追踪
- 目标：处理失败/超时 webhook，订单进入 `failed/canceled` 并支持重试
- 涉及：
  - `apps/api/src/modules/payment/webhook.controller.ts`
  - `apps/api/src/modules/payment/order.service.ts`
  - `apps/web/app/checkout/cancel/page.tsx`
- 验收：
  - 模拟失败回调后订单状态正确变更
  - 取消页可重新发起支付

### GC-003 登录态与跳转一致性
- 背景：购买与播放涉及受保护资源，需要统一未登录处理策略
- 目标：未登录访问购买/播放时统一返回与前端跳转
- 涉及：
  - `apps/api/src/modules/auth/*`
  - `apps/api/src/main.ts`
  - `apps/web/app/login/*`
- 验收：
  - 未登录访问受保护接口返回一致错误码
  - 前端跳转登录后可返回原目标页面

---

## P1（规格关键功能补齐）

### GC-101 支付网关采用 PayPal
- 背景：规格要求支持安全的全球化支付
- 目标：提供 PayPal 下单与回调能力
- 涉及：
  - `apps/api/src/modules/payment/*`
  - `apps/web/app/courses/[courseId]/page.tsx`
- 验收：
  - 前端可发起 PayPal 支付
  - 可完成“支付成功 → 授权发放”

### GC-102 多币种结算（USD/EUR）
- 背景：规格要求多币种
- 目标：课程与订单支持多币种展示与结算
- 涉及：
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/catalog/*`
  - `apps/api/src/modules/payment/*`
  - `apps/web/app/courses/[courseId]/page.tsx`
- 验收：
  - 课程详情正确展示币种
  - 支付与订单金额币种一致

### GC-103 自适应流媒体（HLS/DASH）
- 背景：规格要求在不同网络环境下流畅播放
- 目标：播放链路支持 HLS/DASH，非单一 MP4 直链
- 涉及：
  - `apps/api/src/modules/playback/*`
  - `apps/web/app/watch/[courseId]/page.tsx`
- 验收：
  - 播放页可消费 HLS/DASH 源
  - 弱网场景下码率可切换或有自适应效果

### GC-104 播放器控制能力增强
- 背景：规格要求播放/暂停、音量、全屏、倍速、拖拽
- 目标：补齐播放器能力与 UI 状态
- 涉及：
  - `apps/web/app/watch/[courseId]/page.tsx`
- 验收：
  - 控制能力可用且交互稳定

---

## P2（产品完整度与运营可观测）

### GC-201 内容上传与管理后台能力
- 背景：规格要求视频内容上传、存储、管理
- 目标：支持课程/视频 CRUD、上架/下架、封面与视频地址维护
- 涉及：
  - `apps/api/src/modules/admin-content/*`（新增）
  - `apps/web/app/admin/*`（可分阶段）
- 验收：
  - 管理端新增内容后前台可见
  - 上下架状态即时生效

### GC-202 地域限制策略
- 背景：规格 Edge Case 提及版权地域限制
- 目标：按地区对购买与播放执行限制规则
- 涉及：
  - `apps/api/src/common/geo/*`（新增）
  - `apps/api/src/modules/payment/*`
  - `apps/api/src/modules/playback/*`
- 验收：
  - 受限地区被拦截并返回明确提示
  - 非受限地区流程不受影响

### GC-203 指标埋点与报表基础
- 背景：SC-001~SC-004 需要可观测基础
- 目标：补齐支付成功率、起播时间、卡顿率、复购相关埋点
- 涉及：
  - `apps/api/src/common/observability/*`
  - `apps/web/*`
- 验收：
  - 指标可按天聚合查询
  - 支付与播放链路具备可追踪 ID

---

## 执行建议

- 按顺序实施：P0 → P1 → P2
- 每完成一个 GC 项即补充用例与回归检查
- 每个 GC 项完成后同步回写 `tasks-v2.md` 状态
