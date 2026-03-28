# Production Readiness Checklist: 001-culinary-platform

## 1. 环境与配置

- [ ] 生产环境设置 `SESSION_SECRET` 为高强度随机值
- [ ] 生产环境设置 `DATABASE_URL` 并完成迁移部署
- [ ] 生产环境设置 `WEB_BASE_URL` 与 `API_BASE_URL` 为正式域名
- [ ] 按需配置 `ADMIN_EMAILS`（逗号分隔）并核对管理账号
- [ ] 按业务策略配置 `BLOCKED_COUNTRIES`
- [ ] 配置 `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_BASE_URL`
- [ ] 配置 `SENTRY_DSN`、`NEXT_PUBLIC_SENTRY_DSN`

## 2. 数据与回滚

- [ ] 执行 `npx prisma migrate deploy --schema prisma/schema.prisma`
- [ ] 执行 `npx prisma generate --schema prisma/schema.prisma`
- [ ] 完成生产数据库备份策略（全量 + 增量）
- [ ] 验证回滚预案（迁移回退或备库切换）

## 3. 业务链路验收

- [ ] 注册/登录/退出流程可用
- [ ] PayPal 支付成功后授权可发放
- [ ] 支付失败与取消状态正确落库
- [ ] 课程支持 USD/EUR 展示与结算
- [ ] 播放链路可返回 MP4/HLS/DASH 并成功播放
- [ ] 管理端可完成课程/视频维护与上架下架
- [ ] 地域限制策略在受限地区可拦截购买与播放

## 4. 可观测与运营

- [ ] `/metrics` 可读取支付、播放、复购、留存指标
- [ ] 客户端事件可通过 `/metrics/event` 成功上报
- [ ] 告警策略覆盖支付失败率与播放异常波动
- [ ] 关键日志字段包含用户、课程、订单关联信息

## 5. 发布前回归

- [ ] 执行 `npm run build`
- [ ] 执行 `npm test -w apps/api`
- [ ] 执行 `npm run test:e2e -w apps/api`
- [ ] 执行 `npm run test:e2e -w apps/web`
- [ ] 执行 `npm run verify:p2-metrics`

## 6. 发布后观察（建议首日）

- [ ] 观察支付成功率与失败率趋势
- [ ] 观察播放请求成功率与质量样本分布
- [ ] 抽样验证管理端上架内容在前台可见
- [ ] 抽样验证地域限制拦截符合预期
