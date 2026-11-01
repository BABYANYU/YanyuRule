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
正式部署 318b7a32-ce32-4272-944c-b2b1df65d934（源码 d2dc951）于北京时间 2026-10-31 14:15 成功。正式域名首页、CSS、JS、品牌 SVG 与 Surge/Mihomo 规则样本共 6 个文件逐一匹配线上 SHA-256；联系地址正确、缺失规则 404、每日同步开启。内置浏览器自动控制不可用，未进行实际浏览器截图验收。

2026-10-31 文案更新：页脚采用“每日同步 · 更新于 MM.DD HH:mm”，悬停可见完整北京时间；关于页按用户要求显示“所有版权归 YANYU 所有”，移除数据来源段落，保留 YANYU 与 Telegram。部署 fc4975ad-337a-4edd-85c0-e9208ae15ce5（61c150c）成功，线上 JS/CSS 哈希及文案已验证，27 项测试通过。

## 全规则图标适配

Surge 1186 项、Mihomo 1185 项全部有图标：各 369 项使用本地品牌 SVG，77 项复用已同步的图标库，其余分别为 739/738 项分类图标与 1 项通用规则图标。Google、YouTubeMusic 和子服务已加入映射，取消首字母占位。图标加载失败使用内嵌 SVG 兜底，不请求第三方图片站点。

Simple Icons 固定 11.0.0，资源包完整性已按 npm sha512 验证，保留 LICENSE、DISCLAIMER 与来源元数据；分类 SVG 为项目自有线条图。新增规则可自动按现有图标名或类别匹配，未知规则自动使用通用图标。品牌新增/别名调整维护 site/brand-icons/map.mjs，分类维护 site/rule-icons.mjs。图标目录随每日同步刷新，映射不绑定原站内容哈希文件名。

31 项测试通过，含品牌子服务、分类、未知规则、外部图标地址拒绝和加载失败兜底；scripts/check.mjs 对每一条规则解析图标并验证文件存在，缺失时阻止发布。没有新增 VPS 服务、npm 运行依赖或 AI 图片调用。
图标版已由部署 3fd6e231-78cd-4d9f-bb83-1b3134c8f094（源码 091e052）于北京时间 2026-10-31 14:40 发布成功。线上已逐规则核对 2371 个图标引用均存在于完整性清单，并对脚本、映射与品牌/分类/通用/图库样本共 10 个文件验证 SHA-256；SVG MIME、每日同步启用和缺失规则 404 正常。未声称完成实际浏览器截图或客户端导入验收。

关于弹窗精简：紧凑居中布局、440px 最大宽度、Telegram 描边按钮，删除弹窗中的更新状态、同步记录及文件校验入口；首页更新时间保留。文字/数字占位样式独立调整为 22px、500 字重、中灰，图片桌面 46px、响应式 40/39px 不变。当前全规则图标版不重新引入字母占位。页面资源版本 compact2，避免旧入口缓存。31 项测试和全量文件校验通过，关于样式不会影响详情/图标库弹窗。内置浏览器自动控制不可用，未声称完成截图验收。
精简关于版已由部署 72f0aa4f-bdfc-4610-b7bc-a9c6796890c3（f72d067）于北京时间 2026-10-31 14:47 成功发布。正式站首页、脚本与 CSS 的 SHA-256、资源版本 compact2、删除更新状态区域、22px 字符样式及 46px 图片样式均已核验；每日同步仍开启。

## 图标对比度与缓存修复

AcFun、All4 等图标虽然返回 200，但图片为透明底白色图案，浅色页面中不可见。对当前用于规则列表的 77 个图库图片做像素采样，发现 32 个同类图标。前端在图片载入后以 32×32 Canvas 检测透明比例与可见像素亮度，仅对透明白色图案应用深色滤镜，结果按不可变图片 URL 缓存在页面内存；不修改原图，也不影响图标库下载。普通彩色、深色、非透明图片保持原样，载入失败继续用内嵌图标。

脚本与样式原响应允许缓存 14400 秒，现对 app.js、style.css、core.mjs、rule-icons.mjs 和 brand-icons/map.mjs 设置 Cache-Control: no-cache；首页资源版本 contrast3，使已缓存旧入口的浏览器加载新 URL。带内容哈希的图标仍长期缓存。33 项测试通过，新增白色透明图案检测及实际加载事件回归。

缓存核验补充：Pages 备用域名能返回 no-cache，但正式域名的 JS/CSS 仍被其 CDN 层改写为 max-age=14400。因此不能仅依赖 _headers。构建新增 scripts/frontend-assets.mjs，生成 /assets/app.{内容SHA前16位}.js 与 style.{内容SHA前16位}.css，首页自动引用；只有内容改变才换文件名，规则订阅链接不变。模块仍从本站根目录加载，已实测 mjs 返回 no-cache。check.mjs 校验版本文件名与完整性哈希一致。35 项测试通过。README 已按用户要求改为部署、维护、卸载和重新部署手册，说明源码私有、原样恢复需另存数据快照。
最终核验：部署 2a78e813-7ef9-4ecd-a199-fce5df86443a（adc9c5b）于北京时间 2026-10-31 15:15 成功；正式首页引用 app.93044f44a0390679.js 和 style.cebc76434aed45c9.css，内容哈希与完整性清单一致，内容版本资源返回一年 immutable 缓存，mjs 模块返回 no-cache。无需依赖旧 app.js 的 4 小时缓存过期。35 项测试、全量图标引用与规则文件校验通过。GitHub API 再次确认仓库 private，线上 README 已包含部署、维护、注意事项、卸载和重新部署章节。内置浏览器自动控制不可用，未声称截图验收。
2026-10-31 15:19：按用户要求隐藏规则详情的“来源与致谢”整段（标题、来源链接、提示文字），仅移除页面渲染，不修改规则正文或清单中的来源。源码 b0c8972，部署 2d604e80-70c8-4c9c-a6d7-ee78e39903bc 成功；35 项测试通过，正式站内容指纹脚本已验证不再渲染该段，完整性哈希一致。

2026-11-01 六客户端迁移：三项目配置、维护和验证记录见 MULTI-CLIENT-2026-11-01.md；不改变原 Surge/Mihomo 订阅路径。
2026-11-01 八客户端版已上线：三组工作流 41269131398 成功，均发布 daily-41269131398-1。最终文件数 12136 / 9737 / 9587，INITIAL_BUILD 均已关闭，仓库保持私有；详见 MULTI-CLIENT-2026-11-01.md。

2026-11-01 侧栏 UI 调整：主站桌面采用左侧客户端文字导航与右侧双列规则列表，小桌面自适应单列；860px 以下隐藏侧栏并使用原生下拉选择。删除可见的“规则库 / 支持 8 种客户端”大标题，顶部品牌兼作返回入口。保留原图标尺寸、白色图标对比度修正、关于弹窗与所有规则功能。左右导航、移动选择和竖向键盘切换同步，46 项测试通过，全量文件校验通过。

分享元信息：保留 title / og:title / twitter:title 为“YanyuRule · 规则库”，清空三类 description。不发送 Telegram 消息或操作用户账号；旧消息中的链接预览可能仍需刷新。内置浏览器自动控制不可用，未声称完成截图验收或 Telegram 实际消息预览验收。
侧栏版于北京时间 2026-11-01 14:38 发布成功，源码 edeccbe，部署 3ef77832-b0e9-4ea7-9517-97dacd5794d2。正式站以 TelegramBot User-Agent 获取返回 200，标题正确、三个 description 均为空，侧栏八个客户端及移动选择器存在；脚本 app.404a587eb5399f63.js 与样式 style.6c4ea3a0b9466344.css 哈希匹配完整性清单，原 All4 订阅仍 200。46 项测试通过。未操作 Telegram 账号，也未完成实际浏览器截图验收。
