# YanyuRule

面向 Surge、Mihomo 的独立规则站。目标域名：`https://rule.yanyubaby.eu.org/`。网页采用无框架 HTML/CSS/JavaScript，生成后全部为静态资源；VPS 无需安装或运行组件。

## 当前状态

本地功能开发与数据迁移验证。**尚未部署 Cloudflare，未启用 GitHub 每日同步，Surge 客户端完整订阅尚待上线后实测。** 最终 UI 设计调整留在功能验证之后。

## 功能

- Surge / Mihomo 切换；中英文名称、描述搜索；类型筛选；名称、更新时间、数量排序；分页。
- 详情查看类型数量、文件格式、推荐/二进制标记、来源及更新时间。
- 本站文件的订阅链接复制、下载、打开；名称复制、详情深链接、客户端选择记忆。
- Surge 自定义类型选择、no-resolve 选项、单条通配符排除；按现成产物优先，必要时生成本地重写转换链接。
- 自行实现的 Surge 过滤模块：只请求本站固定 artifacts 目录，不接受任意源 URL，不执行远程代码。只解密模块虚拟域名 `yanyu.rule`；源文件上限 1 MiB；失败返回错误，不能用空规则伪装成功。
- Surge 图标搜索、分页、图标链接复制、来源清单。Mihomo 保持原站实际能力，不虚构其不存在的过滤模块。
- 最后成功同步时间、超过 26 小时未更新提示、页面打开期间每 5 分钟检查新版本。

## 本地使用

Node.js 22 或以上，无需安装 npm 包。命令在本目录执行：

```text
node scripts/sync.mjs
node --test tests/*.test.mjs
node scripts/check.mjs
node scripts/serve.mjs
```

预览：`http://127.0.0.1:18761/`。正式域名尚未上线时，可以验证界面、本站下载和生成链接；安装到 Surge 的模块仍使用正式域名，因此完整客户端链路待上线后验证。

## 同步与校验

1. 从原站主域名及已核实分站 `rule-26r.pages.dev` 获取两栏索引及逐项清单。
2. 保留所有现有格式，包括 Surge DOMAIN-SET、RULE-SET、MITM 文件，以及 Mihomo YAML、TEXT、MRS 实际产物。
3. 对内容寻址文件使用缓存；元数据使用 ETag / Last-Modified 条件请求，四并发、超时和有限重试。
4. 校验原清单字节 SHA-256；原站部分文件仅头部元数据变化，按它提供的规范化正文 SHA-256 验证。只有规定的 NAME/AUTHOR/REPO/UPDATED/DESC 头部行可规范化，规则正文变动仍失败。最终副本另外生成本地逐文件 SHA-256。
5. 把索引、清单、图标的运行链接改为本站相对路径，保留原作者署名及第三方来源。页面不再依赖实时原站请求。
6. 空索引、身份不匹配、哈希失败、文件超过 25 MiB、超过 20,000 个文件均停止发布。记录相较上一成功版本减少 20% 以上需人工复核（确认为正常删除可用 `--allow-large-removal`）。
7. 全部成功后替换 dist，并保留 dist.previous。下载失败不覆盖当前 dist；CI 失败不执行 CF 部署，因此线上保持最后成功版本。

`--no-icons` 只用于测试/明确排除图标的构建；正常构建包含 Surge 图标库。缓存、产物、私人配置、凭据不进入源码仓库。

## Cloudflare / GitHub 每日更新准备

部署方案：独立 Cloudflare Pages 项目 `yanyurule`，自定义域名 `rule.yanyubaby.eu.org`，连接独立私有 GitHub 仓库 `BABYANYU/YanyuRule`；不启用 Functions、KV、D1 或 R2。

工作流 `.github/workflows/daily-sync.yml` 用仓库变量 `YANYURULE_ENABLED` 作为开关。**没有设置为 true 时不会触发每日更新。** 每天 UTC 03:17（北京时间 11:17）提交新的 `.sync-request.json`，由 CF 的 GitHub 连接触发构建、抓取与校验。工作流会等待线上 status.json 出现同一请求 ID，不能把“提交成功”当作“同步上线成功”。GitHub 定时任务可能延迟，不承诺严格 24 小时 SLA。

该方案不把本机范围较广的 Wrangler OAuth 凭据传入 GitHub，也不要求保存 CF 账号级 API Token。新建私有仓库已经完成；Pages 的 GitHub 连接需要用户在提供方授权该仓库。

上线前需要：

- 本项目源码放入独立私有 GitHub 仓库。不能使用仅保存文档的 Sub2API 仓库，也不能上传 VPS 项目的私人交接资料。
- 在用户现有 CF 账号创建 Pages 项目并绑定目标子域名，检查现有 DNS 不冲突。
- CF 构建命令：`node --test tests/*.test.mjs && node scripts/sync.mjs --production && node scripts/check.mjs`，输出目录 dist，Node 22 以上。设置 `YANYURULE_BASELINE_URL` 为本站 /status.json，后续构建读取上次线上数量作为骤减保护基线；首建可临时设置 `YANYURULE_INITIAL_BUILD=1`，首建完成后移除。
- 本站与定时链路实测通过后，CF 构建环境设 `YANYURULE_SCHEDULER_ENABLED=true`，仓库变量设 `YANYURULE_ENABLED=true`、`YANYURULE_PUBLIC_BASE_URL=https://rule.yanyubaby.eu.org`。私有仓库数据更新仅由 GitHub 内置 GITHUB_TOKEN 提交，无需额外长期令牌。
- 首次构建、全量检查通过，正式域名及 HTTPS、实际规则下载、Surge 模块、Mihomo 二进制文件实测通过后，再开启仓库变量。
- 未成功完成以上步骤不能宣称上线或每日同步已生效。回滚使用 CF 上一成功部署；本地可从 dist.previous 恢复，随后重新检查。

## 来源

数据来自 MagicRule 公开分发站点及其所列上游，保留原文件署名与来源。原项目仓库 `https://github.com/magical404/MagicRule` 的说明及各第三方资源条件分别适用，不能把仓库标注的 MIT 自动扩展到所有第三方图标、规则和未公开引擎。

本项目网页及过滤逻辑为独立实现，没有复制原站打包前端或未公开生成引擎。原站暂停后仍可使用最后成功副本，但持续生成同样的新规则仍依赖上游可用性。
