# YanyuRule 部署与维护

记录日期：2026-10-31，时区 Asia/Shanghai。

## 已部署状态

- 正式站点： https://rule.yanyubaby.eu.org/
- CF Pages 项目：yanyurule；备用地址： https://yanyurule.pages.dev/
- 私有源码仓库：BABYANYU/YanyuRule，生产分支 main。
- 用户已完成 Cloudflare Workers and Pages GitHub App 的仓库授权及 CNAME 配置；本次没有修改其他 DNS 记录或 VPS。
- 自定义域名验证、HTTPS、校验后的全量静态文件发布均通过。
- 最终功能版本：990880dcace7ed5d321c97420ee2f4970e6d39bd；CF 部署 0d2915ba-7cd9-45b0-9789-60644378eb3b，发布成功。
- 该版本数据同步成功时间：2026-10-31 11:07:27（北京时间）。

| 数据 | 数量 |
|---|---:|
| Surge / Mihomo | 1,186 / 1,185 |
| 规则清单 | 2,371 |
| 规则文件 | 6,249 |
| Surge 图标 | 3,135 |
| 静态站点文件 | 11,770 |
| 最大单文件 | 9.28 MiB |

## 每日更新

1. GitHub Actions 的 daily-sync.yml 每天 UTC 03:17（北京时间 11:17）运行，也可手动 Run workflow。
2. 工作流测试通过后，用仓库自身 GITHUB_TOKEN 提交 .sync-request.json。
3. CF 的仓库连接自动启动构建：测试、抓取、完整性检查全部通过后才发布。
4. 工作流轮询正式站点 status.json，确认相同 request_id 已上线且 scheduler_enabled=true；超时或失败不会被视为成功。

实测工作流： https://github.com/BABYANYU/YanyuRule/actions/runs/41162724189 ，结果 success。请求 ID daily-41162724189-1 已在正式站点确认。

仓库变量：YANYURULE_ENABLED=true、YANYURULE_PUBLIC_BASE_URL=https://rule.yanyubaby.eu.org。

CF 生产构建设置：

```text
node --test tests/*.test.mjs && node scripts/sync.mjs --production && node scripts/check.mjs
```

输出目录 dist，Node 22。生产环境 YANYURULE_BASELINE_URL=https://yanyurule.pages.dev/status.json、YANYURULE_INITIAL_BUILD=0、YANYURULE_SCHEDULER_ENABLED=true。初建豁免已经关闭；无法读取上次线上基线或规则数量骤减时阻止发布。

不保存 CF 账号级 API Token / OAuth 刷新凭据到 GitHub。没有 Functions、KV、D1、R2 或 VPS 常驻进程。CF 已配置 README.md 与 documentation/** 为构建排除路径，纯维护文档变动无需全量重建。

## 固定订阅路径

规则文件 `/rules/{client}/{rule-id}/{artifact-key}.{ext}`，详情清单 `/data/rules/{client}/{rule-id}/manifest.json`。文件内容更新不会改变这些地址；上游删除规则或变更规则 ID 时仍需维护。同步不保留所有历史哈希文件，避免文件数无限增长。

Surge 虚拟过滤域名为 yanyu.rule，模块从正式站点的 /rules/Surge/ 固定目录读取。只解密该虚拟域名；源文件上限 1 MiB，失败以错误状态返回。线上模块和真实源文件已通过 Node 脚本环境执行验证；不是 iPhone Surge 安装测试。

## 已完成验证与限制

- 25 项测试通过，包含真实前端脚本的模拟 DOM 事件、过滤模块、两轮源文件哈希变化后固定链接不变、失败保留旧快照、线上基线失败保护。
- CF Linux / Node 22 构建中测试及全量逐文件校验通过。
- 正式域名的 Surge LIST、Mihomo YAML / MRS 下载样本与发布的逐文件 SHA-256 清单一致。
- 线上过滤脚本读取真实源文件，DOMAIN-SUFFIX 选择和 115*.com 排除模式正确输出 8 条结果。
- 缺失规则文件返回 HTTP 404；添加根目录 404.html 避免 Pages 默认 SPA 回退返回 HTML 200。
- iPhone Surge / 用户实际 Mihomo 客户端的导入与运行仍需设备端验证；未声称已操作用户手机。
- IAB 自动控制当前不可用，因此未声称自动完成浏览器截图验收；HTTP、代码、数据与调度结果均已直接验证。

## 常规维护

- 手动更新：GitHub → Actions → YanyuRule daily sync → Run workflow，完成后检查 success 和线上 status.json 的 request_id / last_success。
- 暂停每日更新：仓库变量 YANYURULE_ENABLED=false；恢复前检查 CF 构建和域名可用性。
- 回滚：CF Pages → yanyurule → Deployments，选择上一份成功部署回滚；同步失败本身不会覆盖旧的成功站点。
- 本地预览：Node 22 以上执行 node scripts/sync.mjs、node scripts/check.mjs、node scripts/serve.mjs。缓存、dist 和生产凭据不提交仓库。
- 规则正文哈希不一致、超出 25 MiB / 20,000 文件、上游新增分发域名或记录骤减时先调查，不关闭验证来强行上线。

## 2026-10-31 UI 更新

采用用户选定的 C 方案：浅色留白、双列开放列表、清晰字重、移动端单列。新增列表直接复制完整规则链接，保留筛选、详情、下载、自定义过滤和图标库。关于页署名 YANYU 并提供用户指定的 Telegram 联系入口；第三方资源权利归属保留。8 个常用品牌标识为本地静态 Simple Icons（CC0），无新增运行依赖。27 项测试通过，包含直接复制与关于页联系地址验证。
