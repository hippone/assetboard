# Assetboard 研究来源与能力边界

核查日期：2026-09-24。以下以官方文档和项目自身说明为依据；未执行登录、接口实测或竞品可用性测试。事实与本轮设计推断分开列出。

UI / UX 已提升为首要研究主线。新增的 NN/g、Carbon、Linear 与 W3C 一手资料、设计推论和验证方法见 [UI / UX 研究](ASSETBOARD-UI-UX.md)。

## 一览界面参照

| 参照 | 来源中的事实 | 本轮设计借鉴与边界 |
|---|---|---|
| [Homepage](https://gethomepage.dev/) | 可配置的应用 dashboard，支持服务集成 | 借鉴服务入口与分组；并不能由此证明它覆盖资产续费和项目归属 |
| [Glance](https://github.com/glanceapp/glance) | 自托管 dashboard，汇集多种 feeds | 借鉴信息层级和紧凑排布；资产模型仍需另行设计 |
| [Wallos](https://github.com/ellite/wallos/blob/main/README.md) | 开源自托管订阅追踪，含分类、多币种和通知 | 借鉴周期费用与提醒；不能把订阅模型等同于项目基础设施模型 |

这些是三个不同切面的参照，不是“市场没有竞品”的证明。原对话提及的 Lemon Domains、ServerShelf、AppVentory 等未在本轮逐一复核，因此不据此作产品或市场结论。尚未形成完整竞争格局研究。

## 首批连接能力核查

| 来源 | 已核实 | 对设计的含义 | 尚待实际验证 |
|---|---|---|---|
| [GitHub Apps](https://docs.github.com/en/apps/using-github-apps/about-using-github-apps) | 安装时可限定仓库和权限 | 连接状态必须说明覆盖范围，不能说找到全部仓库 | 精确端点权限、组织限制、多账号与分页 |
| [GitHub 权限说明](https://docs.github.com/en/enterprise-cloud%40latest/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) | 按端点和功能选择权限 | 清单需求先核对必要权限 | 最小权限端到端 PoC |
| [Cloudflare OAuth Client](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/) | 可注册第三方 OAuth client；支持授权码；公开可见需域名验证 | Connect 体验可规划，但应用配置有前置工作 | 所需 scopes、账户覆盖、token 生命周期 |
| [Cloudflare Zones](https://developers.cloudflare.com/api/resources/zones/methods/list/) | 存在列出 zones 的 API | DNS 托管站点可作为发现来源 | 账号范围、分页、所需权限 |
| [Cloudflare Registrar](https://developers.cloudflare.com/api/resources/registrar/subresources/registrations/methods/list/) | 注册记录接口包括注册到期信息 | 注册记录与 DNS zone 分开映射；不能由 zone 直接推断续费日 | 对目标账号的资源覆盖、权限及实际字段 |
| [Vercel permissions](https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference) | Integration 权限涉及项目、部署等资源 | 可探索项目/部署的只读资产入口 | 费用与账单另查，不由项目读取推断可获得 |
| [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) | gmail.readonly 属于 restricted scope | 邮件读取不是无门槛的通用导入 | 目标用途是否满足政策及所需审核 |
| [Google restricted verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) | 受限权限有审核要求，服务器处理受限数据可能涉及安全评估，存在例外条件 | 不把全邮箱授权作为首轮体验门槛 | 具体架构、使用范围和例外是否适用 |

## 修正历史讨论中容易混淆的点

1. Cloudflare 的第三方 OAuth 能力已有官方依据，但这不等于任意目标字段都已验证可读。
2. 列出资源、读取注册到期时间、读取实际账单是三个不同能力。
3. “邮件最容易自动化”不能直接作为开发优先级；需同时衡量权限和识别可靠性。
4. 托管、自托管都需要解释凭证与数据的去向；开源不自动免除平台要求。
5. 个人开发者数量与需求强度、授权接受度、付费意愿之间没有直接证明关系。

## 后续资料包的调查模板

每个连接器记录：用户要看的字段 → 官方端点 → 认证方式 → 最小权限 → 账号/团队范围 → 分页 → 限流 → 更新时间 → 缺失字段 → 撤销方式 → 实测样本。按实际需求逐个补齐，不把“有 API”记作“产品支持”。

每个视觉参照记录：具体页面 → 信息密度 → 分组方式 → 主要交互 → 空白/错误状态 → 手机处理 → 可以借鉴的原则。截图与视觉检验待原型阶段补充，本轮不声称已经完成视觉实测。
