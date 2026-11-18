# YanyuRule 部署与维护手册

更新日期：2026-11-01。本文只记录部署、注意事项、维护、卸载和重新部署的方法。历史操作及验证结果见 [维护记录](documentation/DEPLOYMENT.md)。

## 当前部署位置

| 项目 | 配置 |
|---|---|
| 源码仓库 | BABYANYU/YanyuRule，公开，生产分支 main |
| Cloudflare Pages | 项目 yanyurule |
| 正式网站 | https://rule.fakeyou.eu.org/ |
| 唯一对外入口 | https://rule.fakeyou.eu.org |
| 数据范围 | Surge、Mihomo、Loon、QuantumultX、Shadowrocket、Egern、SingBox、Surfboard |
| 每日同步 | 北京时间 00:00，GitHub 定时任务可能延迟 |
| VPS | 无安装、无常驻服务、无数据库 |

站点与源码仓库均已公开：网站设计版权归 YANYU 所有。创建新项目或仓库前先确认可见性及发布范围；源码与站点分别维护。

## 许可

本仓库代码按 MIT 许可发布，版权归 YANYU 所有；许可证全文见 [LICENSE](LICENSE)。站点与仓库不展示第三方说明。

## 部署流程

1. 保留本仓库源码、.github/workflows/daily-sync.yml 和 documentation/。不要上传凭据或其他项目的私人资料。
2. Cloudflare Pages 连接此仓库，只授权需要的仓库，生产分支 main。维护现有项目时不重复新建。
3. 框架选“无”，根目录 /，输出目录 dist，Node.js 22。构建命令：

   ```sh
   node --test tests/*.test.mjs && node scripts/sync.mjs --production && node scripts/check.mjs
   ```

4. 设置 CF 生产构建环境：

   | 变量 | 正常运行值 |
   |---|---|
   | NODE_VERSION | 22 |
   | YANYURULE_BASELINE_URL | https://yanyurule.pages.dev/status.json |
   | YANYURULE_INITIAL_BUILD | 0 |
   | YANYURULE_SCHEDULER_ENABLED | 已验证定时链路后设为 true |

   真正首次部署或删除旧站后重新部署时，上次线上基线不存在，可仅在初始化构建临时设 YANYURULE_INITIAL_BUILD=1；成功后立即改回 0 并重新构建验证。正常更新的基线失败不能借此绕过。
5. 添加自定义域名 rule.fakeyou.eu.org。DNS 使用 CNAME：名称 rule，目标 yanyurule.pages.dev。确认 HTTPS 正常，不修改其他 DNS 记录。
6. GitHub → Settings → Secrets and variables → Actions → Variables：
   - YANYURULE_PUBLIC_BASE_URL=https://rule.fakeyou.eu.org
   - YANYURULE_ENABLED=true：首次部署成功后才启用。

   工作流使用 GitHub 自动提供的 GITHUB_TOKEN。不要把 CF OAuth、账号级 Token 或 SSH 凭据存入仓库。
7. Actions → YanyuRule daily sync → Run workflow。确认整次运行 success，线上 /status.json 的 request_id 与运行一致且 scheduler_enabled=true，不能只看提交成功。
8. 保留 CF 构建排除路径 README.md、documentation/**，纯文档更新不必全量重建。

## 日常维护

| 目的 | 操作与成功标准 |
|---|---|
| 手动同步 | Actions → YanyuRule daily sync → Run workflow，核对成功状态及线上 request_id |
| 暂停同步 | 仓库变量 YANYURULE_ENABLED=false；网站仍提供最后成功版本 |
| 恢复同步 | 确认 CF 与域名正常后设为 true，手动同步并验证一次 |
| 修改页面 | 修改 site/，测试、构建和校验通过后推送 main，确认 CF 对应提交发布成功 |
| 同步失败 | 查看 Actions、CF 构建日志；保留旧站，修复原因，不关闭完整性检查 |
| 回滚 | CF Pages → yanyurule → Deployments → 回滚到上一成功生产部署，并修正源码 |
| 图标不可见 | 检查映射、像素对比度、加载事件和缓存；HTTP 200 不等于图标可见 |

上游文件地址变化但规则 ID、格式标识不变时，本站固定订阅地址保持不变。上游删除规则或变更规则 ID 时仍需处理；当前没有自动保留被删规则、兼容映射或逐条异常通知。

## 本地检查

Node.js 22 或以上，无需安装 npm 运行依赖。在仓库目录执行：

```sh
node --test tests/*.test.mjs
node scripts/sync.mjs
node scripts/check.mjs
node scripts/serve.mjs
```

预览：http://127.0.0.1:18761/。dist/、.staging/、.cache/、dist.previous/ 为本地产物，不提交仓库。本地测试不代表 Surge/Mihomo 客户端实际导入验证。

## 注意事项

- 保留 /rules/{client}/{rule-id}/{artifact-key}.{ext} 固定路径，不改回内容哈希订阅地址。
- 保留根目录 404.html，防止缺失规则被返回成首页 HTML 200。
- 保留字节/正文哈希验证、空索引保护及超过 20% 规则减少时的人工复核；失败不覆盖旧站。
- CF Pages 免费单项目上限 20,000 个文件、单文件 25 MiB，每月 500 次构建。本站约 1.2 万文件；扩展其他客户端前重新核算。
- 保留脚本、样式的版本刷新与缓存处理；内容哈希图标继续长期缓存。透明白色图库图片自动按深色显示，原始下载图片不修改。
- 站点与仓库界面只展示 YANYU 自有版权；许可证文件按法律要求保留在仓库中。
- 站点界面与 README 只展示 YANYU 自有版权；许可证文件按法律要求保留在仓库中，不在界面展示。
- 不擅自引入 Workers/Functions、数据库或 VPS 服务。
- 源码仓库不含历史规则快照；上游不可用时，不能仅凭源码保证重建原数据。

## 卸载步骤（仅记录，当前不执行）

1. 设置 YANYURULE_ENABLED=false，等待或取消已启动的 Actions、CF 构建，防止卸载时继续发布。
2. 如需保留卸载时原样数据，先另行导出并验证静态快照。已公开的源码仓库本身不是规则数据快照备份。
3. CF Pages 项目移除本站自定义域名绑定，再删除 yanyurule 项目。
4. DNS 是否保留由用户决定。清理时仅处理本站 rule 的 CNAME；保留解析但删除 Pages 后，网址仍会不可访问。
5. 保留本源码仓库及文档供恢复使用。不要删除其他项目、账号或取消其他项目仍需使用的授权。VPS 无本站组件需要清理。

## 重新部署步骤

1. 先读取本手册与维护记录，确认重新创建 Pages 项目及网站发布范围，源码仓库维持现有的公开状态。
2. 检查仓库、CF GitHub 连接授权和域名控制权仍可用。若原 Pages 名称不可用，记录新地址并调整 CNAME、基线地址。
3. 按部署流程恢复构建设置、环境变量及域名。旧站不存在时仅初始化使用 YANYURULE_INITIAL_BUILD=1，成功后恢复 0。
4. 默认重新获取上游当前数据。要恢复卸载前原样内容，必须使用事先保存且验证过的独立快照；当前没有一键恢复历史数据的脚本。
5. 确认 HTTPS、规则下载、缺失文件 404 和全量校验通过后，再启用 YANYURULE_ENABLED，运行一次同步并核对线上请求 ID。
6. 更新维护记录，写清日期、提交、部署结果及验证限制，不记录生产凭据。

### 多项目分组配置

| CF 项目 | YANYURULE_GROUP | 输出目录 | 数据范围 | 生产基线 |
|---|---|---|---|---|
| yanyurule | main（默认） | dist | 主界面、图标、Surge、Mihomo | https://yanyurule.pages.dev/status.json |
| yanyurule-data-a | a | dist-a | Loon、QuantumultX、Shadowrocket | https://yanyurule-data-a.pages.dev/status.json |
| yanyurule-data-b | b | dist-b | Egern、SingBox、Surfboard | https://yanyurule-data-b.pages.dev/status.json |

三个项目使用同一公开仓库、同一生产分支 main、相同构建命令，但环境分组、输出目录和基线地址不同；不能互换。两个数据项目不绑定额外自定义域名。首次部署各自临时使用 INITIAL_BUILD=1，分别成功后改回 0。

网站从可信的固定分组域名读取各客户端数据。每组独立校验和保留上次成功版本，页脚显示所选客户端所在分组的更新时间。数据项目故障不使其他组不可用。新增客户端的固定订阅地址位于其数据项目域名，原 Surge/Mihomo 地址不变。

每日工作流计划在北京时间 00:00 提交一次同步标记，触发三个 CF 项目；GitHub 排队可能延迟数小时，不承诺零点完成。验收要求三组线上 request_id 一致、scheduler_enabled=true、deployment=production、产物数非零且发布时间不早于本次请求；还会检查 integrity.json 哈希，并逐客户端抽查 index → manifest → 规则文件。只有全部通过才报告成功。常规约 3 次构建/日，未包含人工修改和排错构建；额度以 CF 账号计划为准。不要把所有文件塞入一个项目。当前各组约 1.2 万、0.97 万、0.96 万文件。

本地默认构建主站。PowerShell 检查数据组示例：

```powershell
$env:YANYURULE_GROUP='a'
node scripts/sync.mjs
node scripts/check.mjs
Remove-Item Env:YANYURULE_GROUP
```

b 组同理。共用 .cache，输出、锁文件及失败回退按组隔离。主站复制链接、下载、筛选、图标和详情支持全部八个客户端。Loon、QuantumultX、Shadowrocket、Egern 提供本站本地过滤模块，源文件上限 1 MiB；SingBox、Surfboard 使用现成格式。模块已进行脚本环境测试，实际手机客户端导入仍需验证。

卸载时先暂停工作流并结束在途构建，再清理这三个 Pages 项目；仅主站有 rule 的域名绑定。要保留原样数据，需导出三组静态快照，源码仓库不是数据备份。重建三组时应沿用原项目名；若名称变更，必须同步更新 site/clients.mjs、客户端过滤脚本中的固定数据域名、CF 基线和校验设置。仅改 DNS 不足以恢复新客户端链接。

八客户端迁移及三项目维护记录：[2026-11-01 记录](documentation/MULTI-CLIENT-2026-11-01.md)。

UI 维护：site/index.html 定义客户端导航和分享元信息，site/style.css 定义侧栏及响应式布局，site/app.js 统一处理导航与选择。分享主标题为“YanyuRule · 规则库”，副标题为“多客户端规则库”。

Telegram 分享使用 https://rule.fakeyou.eu.org/ 。已安装的旧域名订阅需替换域名，路径可直接沿用；带脚本地址的过滤模块请从新站重新安装。数据分组仍通过各自的 Pages 地址提供订阅。

文档维护提交可使用 `[CF-Pages-Skip]` 前缀跳过 Pages 构建，避免仅写维护记录就生成新部署；功能更新和每日同步提交不能加此标记。

首页默认客户端固定为 Surge，不读取或保存浏览器中的上次客户端。手动切换和显式客户端/规则分享链接仍可使用；不要重新加入 localStorage 的客户端默认值回退。

- 2026-11-02：每日同步统一为北京时间00:00（UTC前一日16:00，cron `0 16 * * *`）。这是计划触发时间；GitHub排队及Cloudflare构建需要额外时间，不保证零点整发布完成。

### 2026-11-15 可靠性审查

完整维护交接：[审查、修复、验证与排障步骤](documentation/AUDIT-2026-11-15.md) · [三站上线验收数据](documentation/AUDIT-2026-11-15-deployment.json)。

- 当前绑定的正式域名为 `rule.fakeyou.eu.org`，`rule.yanyubaby.eu.org` 在本轮检查时未配置有效 DNS；不要将旧域名失效误判为规则同步失败。更换域名需同步 Pages 绑定、DNS、GitHub 公开站点变量及代码允许的 origin。
- 生产同步缺少基线配置会拒绝执行；首次建站只允许显式设置 `YANYURULE_INITIAL_BUILD=1`，完成后恢复为 `0`。
- 规则产物必须带合法的上游 SHA-256 校验元数据；空产物清单不能发布。标准头语义校验仍保留，以兼容上游共享文件。
- 上游切版导致版本化资源 404/410 时进行有限整轮重试；持续损坏仍失败，保留上一成功快照。快照提交后的辅助报告写入故障按告警处理，不再把已提交的新快照误报成回滚失败。
- 定时提交会在最新 main 上生成请求并处理非快进竞争，不使用强制推送；官方 Actions 固定到已核对的版本提交。
- Loon 过滤器补齐 `PROCESS-NAME`，Egern 补齐 `domain_regex_set`；发布阶段检查能力位映射，避免界面提供客户端过滤脚本不支持的选项。
