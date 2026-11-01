# 六客户端迁移与三项目维护

日期：2026-11-01。用户明确授权创建 `yanyurule-data-a`、`yanyurule-data-b` 两个免费 Pages 项目并公开规则数据。仍使用原私有仓库 `BABYANYU/YanyuRule`，不新建仓库、不新增 DNS、不修改 VPS。

## 分组与恢复配置

| Pages 项目 | 分组变量 YANYURULE_GROUP | 输出目录 | 客户端 | 首次全量文件数 |
|---|---|---|---|---:|
| yanyurule | main（默认） | dist | Surge、Mihomo，主界面和图标 | 12,136 |
| yanyurule-data-a | a | dist-a | Loon、QuantumultX、Shadowrocket | 9,737 |
| yanyurule-data-b | b | dist-b | Egern、SingBox、Surfboard | 9,587 |

全部项目生产分支为 main，Node 22，构建命令均为：

```sh
node --test tests/*.test.mjs && node scripts/sync.mjs --production && node scripts/check.mjs
```

每组基线为其 Pages 地址下的 `/status.json`。正常运行 `YANYURULE_INITIAL_BUILD=0`、`YANYURULE_SCHEDULER_ENABLED=true`，不能长期启用首次部署豁免。两个数据项目首建验证后已关闭豁免；运行时状态以其成功发布的 status.json 为准。

## 数据范围

| 客户端 | 规则记录数 |
|---|---:|
| Surge | 1,186 |
| Mihomo | 1,185 |
| Loon | 1,185 |
| QuantumultX | 1,185 |
| Shadowrocket | 1,186 |
| Egern | 1,185 |
| SingBox | 1,184 |
| Surfboard | 1,185 |
| 合计 | 9,481 |

以上为客户端规则记录数，同名规则在不同客户端下分别统计。未迁移 Stash、AdGuard。

保留上游所有声明的格式和二进制文件；不重新生成规则正文。源清单/文件完整性、格式身份、大小和文件数量限制继续校验。数据分组各自保留旧的成功快照，失败不覆盖。

## 统一入口与固定链接

- 用户入口仍为 `https://rule.yanyubaby.eu.org/`，八个客户端在同一界面切换。
- Surge、Mihomo 的旧链接不变。新增客户端使用对应数据项目的固定路径：`https://yanyurule-data-a.pages.dev/rules/Loon/{rule-id}/{key}.{ext}` 等。
- `site/clients.mjs` 固定客户端与可信数据域名的对应关系。清单、文件只能从所属客户端/分组读取；不允许任意第三方源 URL。
- 数据项目启用公开静态 CORS，支持主站读取、复制链接、文件下载。没有 Workers/Functions、数据库或代理请求服务。
- 页面按分组独立载入和更新。某组故障不阻断其余客户端，页脚显示所选客户端所在组的最后成功时间。
- 图标仍从主站读取，保留自动对比度修正和通用图标兜底，不在每组重复部署完整图标库。

## 过滤模块与设备验证边界

Surge 原模块保持兼容；新增 Loon、QuantumultX、Shadowrocket 的文本过滤及 Egern 的平面 YAML 过滤模块。只有请求本站虚拟域名及固定规则源才处理；源文件上限 1 MiB，不调用上游动态函数，不以空规则伪装成功。

SingBox、Surfboard 提供现成文件，不虚构过滤模块。保留 SRS/JSON/YAML 等上游格式和版本，用户客户端需支持相应格式。脚本环境、实际文件及 HTTP 下载验证不能代替手机上的导入验证；当前未操作用户手机。

## 每日同步与卸载恢复

现有 daily-sync.yml 每天北京时间 11:17（GitHub 可能延迟）在 main 提交一个请求标记，三个 CF 项目分别构建。`scripts/wait-for-deployment.mjs` 等待三组 request_id 全部对应本次请求且 scheduler_enabled=true 才报告成功。手动运行也只允许 main，避免从开发分支覆盖生产分支。

一组失败时先检查对应项目日志和 env/output 配置，不关闭校验，不重建其他组。三组使用同一源码，构建缓存、暂存目录、输出、锁和失败回退按组处理；不清理其他组仍需要的共享下载缓存。

卸载与重装按 README 执行，范围是三个 Pages 项目，只有主站有自定义域名绑定。源码不是数据快照；原样恢复需要事先保存三组静态文件。重新创建项目先获用户确认。项目名或数据域名改变时，要同时更新客户端映射、过滤脚本、CF 基线和同步校验，不能仅改 DNS。

## 初步验证

- 45 项测试通过，包括八客户端入口、分组资源地址限制、单组失败隔离、下载链接、四种客户端过滤运行、跨组构建及失败保留旧快照。
- 三组本地完整文件及图标引用校验通过；最大单文件分别约 9.28、10.76、8.28 MiB，均低于 25 MiB。
- 两个数据项目首批线上共核对 7,110 条清单引用，24 个规则文件样本字节哈希通过，覆盖 LIST、YAML、JSON、SRS、插件和模块格式；CORS 和缺失规则 404 正常。
- 统一主站上线、最终生产设置和三组实际工作流验收结果在操作完成后补记。
