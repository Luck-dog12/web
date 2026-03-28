# Supabase MVP 部署说明

## 1. 初始化

1. 安装 Supabase CLI 并登录  
2. 在仓库根目录执行 `supabase link --project-ref <project-ref>`
3. 执行 `supabase db push`

## 2. 配置 Secrets

在 Supabase 项目中设置以下 Function Secrets：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_BASE_URL`
- `CF_STREAM_CUSTOMER_CODE`

## 3. 部署函数

```bash
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order
supabase functions deploy get-playback
```

## 4. 前端环境变量

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`（填 Supabase Functions 网关地址，建议以 `/functions/v1` 结尾）
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
