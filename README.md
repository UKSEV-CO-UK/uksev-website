# UKSEV LTD website

Static lead-gen marketing site for UKSEV LTD (Abingdon warehouse).

- `/` — portal (hero, roster, stock, about, contact)
- `/shop` — catalogue with search / filter / sort
- `/pre-owned` — pre-owned e-bikes (one Markdown file per bike in `content/pre-owned/`)

CTA: Call / WhatsApp / Enquire. No checkout.

```bash
npm install
npm run dev
```

Stack: Next.js App Router, React 19, TypeScript, Tailwind CSS 4. Static export
(`out/`) deployed to GitHub Pages by `.github/workflows/pages.yml`.

## 二手车模块 Pre-owned（`/pre-owned/`）

每辆车是一个文件 `content/pre-owned/<slug>.md`（文件名就是网址 `/pre-owned/<slug>/`），
照片放 `public/uploads/pre-owned/`。新增一辆车 = 加一个文件、提交到 main，Pages 会自动重新部署。
构建时读数据的代码在 `src/lib/preowned.ts`（`getAll` / `getBySlug` / `getListed`）；
校验规则只有一份，在 `src/lib/preowned-schema.ts`（`validateBike` / `normaliseBike`），构建和后台共用。

```yaml
---
type: e-bike             # e-bike / e-scooter；不写 = e-bike（后台新建时必选）
brand: DYU               # 必填
model: "C6 City 26″"     # 必填
year: 2023               # 必填
mileage: 1240            # 必填，里程表英里数
price: 695               # 必填，指导价 £
photos:                  # 必填，至少一张，第一张是封面
  - src: /uploads/pre-owned/dyu-c6-1.jpg
    caption: Drive side  # 可选
newPrice: 1099           # 可选，新车价（列表里划线显示）
batteryWh: 504           # 以下都可选
batteryHealth: 92        # %
chargeCycles: 38
batterySource: BMS app   # 电池读数来源
motorW: 250
frameSize: M
wheelSize: "26″"
range: 50                # 英里
grade: A                 # A 像新 / B 良好 / C 一般
colour: Grey
serviceHistory: Serviced Oct 2026
location: Steventon, Abingdon OX13
inspection:              # 结果只能是 pass / replaced / note，其他值会被丢掉（构建不报错）
  - item: Battery
    result: pass
    text: 92% on BMS test   # 可选
included:                # 可选，「包含配件」，空的话详情页不显示这一节
  - item: Original charger
    text: 42V 2A, UK plug
  - item: Original box
    included: false
status: available        # available / reserved / sold
soldDate: 2026-10-08     # 卖掉时填
date: 2026-10-12         # 上架日期，用于排序
draft: false
---
描述（Markdown，原始 HTML 会被去掉）
```

- 构建时会校验：缺必填字段、数字不对、照片文件不存在 → 构建失败，日志里写明哪个文件哪个字段。未填完的 `draft: true` 只跳过并警告。
- 已售：不显示任何价格，只有 SOLD 印章，按钮变成「Find similar」（同品牌筛选）。`soldDate` 超过 30 天就不在列表里显示，但详情页还在。
  这是按「构建时间」算的，网站下次部署时才会更新。没填 `soldDate` 的已售车改用 `date` 算，同样 30 天后撤下。
- `reserved` 不会自动变化。
- 后台的草稿只存在这台设备上（浏览器 IndexedDB），从不进仓库。仓库里的 `draft` 字段只给示例数据用：
  `draft: true` 只在本地 `npm run dev` 显示；`NEXT_PUBLIC_SHOW_DRAFTS=1 npm run build` 可本地预览（不要在 CI 里设）。
  仓库里 6 条 `example-*` 都是草稿示例，上真车后删掉即可。
- 不要写车架号、序列号或任何私人信息，仓库可能是公开的。
- 设计稿里的占位文案（48 小时保留、32 项检测、付款方式、送货等）集中在 `src/lib/preowned-copy.ts`，都标了 `TODO(Panda)`，上线前要确认。

### 后台 `/admin/`

员工操作说明（上架、拍照、改状态、常见提示）见 [`docs/pre-owned-staff-guide.md`](docs/pre-owned-staff-guide.md)。

手机优先的自定义后台。网站本身仍是纯静态，**不含任何令牌**：后台只调同域的 `/admin-api/*`，
那是一个挂在 Cloudflare Access 后面的 Cloudflare Worker，GitHub 令牌只作为 Worker 的 secret 存在。
每次 Publish 由 Worker 往 `main` 提交**一次**（`.md` + 新照片 + 删掉的照片），Pages 1–2 分钟后上线。
`/admin/` 不在导航里，页面带 `noindex`。

- **谁能打开：** Cloudflare Access 挡 `/admin*` 和 `/admin-api/*`（Panda 在公司 CF 上手动配，需要橙色云，SSL 用 Full）。
  网站里没有登录页，打开 `/admin/` 直接是车辆列表。
- **Access 会话过期：** 显示「登录已过期，刷新页面重新验证」+ Refresh 按钮，刷新会重新走 Access。草稿保留在本机。
- **Worker 的 GitHub 令牌：** 失效时显示「后台写入凭证失效，请联系管理员」；`/admin-api/status` 的 `expiresAt` 在 7 天内时列表顶部出琥珀色提醒。
  换令牌：在 GitHub 新建细粒度令牌（只选 `UKSEV-CO-UK/uksev-website`，Contents 读写，90 天），更新 Worker 的 secret。
- **页面：** `/admin/`（列表）、`/admin/edit/`（新建）、`/admin/edit/?slug=<slug>`、`/admin/edit/?draft=<id>`。
- **照片：** 浏览器里把 JPEG/PNG/HEIC 转成 WebP（长边 2000px，≤1MB），重新编码时去掉 EXIF/定位。最多 20 张，第一张是封面。
- **校验：** 发布前跑 `validateBike`，和构建同一套规则；不通过就不提交，并滚到第一个出错的字段。
- **删除：** 删车会在同一次提交里删掉它的照片（别的车还在用的不删）。已售 30 天下架只是不在列表显示，照片保留。
- **上线状态：** 构建时生成 `/build.json`（`{ "sha": "<GITHUB_SHA>" }`，本地是 `local`），后台每 15 秒查一次，
  等于刚提交的 sha 就显示 Live，5 分钟还没等到就提示「可能部署失败」。
- **提交层：** 页面只从 `src/lib/admin/api.ts` 引入。真实现是 `worker.ts`（调 `/admin-api/*`）；
  带 `?fake` 打开（或 `npm run dev`）用内存里的 `fake.ts`，可以用
  `?fake=retry,conflict,exhausted,offline,forbidden,accessexpired,credinvalid,expiringsoon,slow,empty,reset` 模拟各种状态，`?fake=off` 关掉。
- **测试：** `npm test`（校验规则、写出的 Markdown 能被构建正确读回、Worker 客户端的请求格式和错误分类）。

#### Worker 接口（后端照这个实现，类型在 `src/lib/admin/types.ts`）

同域、JSON、带 Access cookie（`credentials: "include"`）。前端不跟随重定向（`redirect: "manual"`）。

| 方法 | 路径 | 请求 | 成功 |
|---|---|---|---|
| GET | `/admin-api/status` | – | `{ canWrite: boolean, expiresAt?: string /* ISO，GitHub 令牌到期 */, login?: string }` |
| GET | `/admin-api/bikes` | – | `{ cars: RepoBike[], headSha: string }`（`RepoBike = { slug, path, data /* 解析后的 frontmatter */, body, updatedAt? }`） |
| POST | `/admin-api/blob` | `{ content: string /* base64 */, encoding: "base64" }`，一次一张照片 | `{ sha }` |
| POST | `/admin-api/publish` | `{ message, baseSha, files: [{ path, sha?, content?: string \| null, encoding?: "utf-8" }] }` | `{ commitSha }` |

- 照片先逐张 `POST /blob` 拿 `sha`，`publish` 里照片只带 `sha`，`.md` 用 `utf-8` 内联，`content: null` = 删除该路径。
  这样每个 Worker 请求都很小，不会碰到 Worker 的 CPU 上限，上传进度也是真实的。单张照片超过 2.5 MB 前端直接拒绝（`too_large`）。
- Worker 用 Git Data API 一次提交（blobs → tree → commit → 更新 ref，不 force-push）；ref 更新 422 时从新的 head 自动重试，
  同一辆车的文件在 `baseSha` 之后被改过就返回 `conflict`。
- 失败统一返回 `{ code, message, details? }`：

| HTTP | `code` | 含义 |
|---|---|---|
| 409 | `conflict` | `details: { paths, by?, at? }`，要写的文件在 `baseSha` 之后被别人改过 |
| 409 | `retry_exhausted` | `main` 一直在动，自动重试用完 |
| 403 | `forbidden` | 路径不在允许的目录里，或请求不合法 |
| 403 | `access_expired` | `Cf-Access-Jwt-Assertion` 缺失或校验失败 |
| 413 | `too_large` | 请求体超过 Worker 上限（`/blob` 4 MB） |
| 502 | `credential_invalid` | Worker 的 GitHub 令牌无效、过期或没有 Contents 写权限 |
| 502 | `github_error` | GitHub 返回了其他错误（例如提交时 ref 冲突以外的 409/422） |
| 404 | `not_found` | 路径或方法不存在 |
| 500 | `internal` | Worker 内部异常 |

  前端另外推断：网络失败 = `offline`；重定向、opaque 响应、HTML 页面、或没有 JSON 的 401/403 = `access_expired`（Access 会话过期）。

#### Worker 部署前必须满足（安全）

1. **只允许写** `content/pre-owned/` 和 `public/uploads/pre-owned/` 下的路径（`/publish` 的 `files[].path`）（规范化后检查，拒绝 `..`、绝对路径），其他一律 403 `forbidden`。
   这样即使 Access 被绕过，也改不了站点代码和 CI。
2. **自己校验** `Cf-Access-Jwt-Assertion`：用团队 Access 的公钥（`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`）验签，
   `aud` 必须等于这条 Access 应用的 AUD，`exp` 未过期；不通过返回 403 `access_expired`，不碰 GitHub。
3. **关掉 `*.workers.dev`** 默认地址，Worker 只挂在 `uksev.co.uk/admin-api/*` 这条走 Access 的路由上。
4. GitHub 令牌只存成 Worker secret，不进仓库、不进站点、不发群里。

#### Worker 代码和部署

代码在 `worker/`（`worker/src/index.ts` 路由，`access.ts` 验 Access JWT，`github.ts` 提交），测试在 `tests/admin-worker.test.ts`。
上面 4 条都在代码和 `worker/wrangler.toml` 里做了：`workers_dev = false`、只挂 `uksev.co.uk/admin-api/*`，`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` 没填时所有请求都拒绝。
提交信息末尾会带 `Published-by: <Access 登录邮箱>`，方便查是谁发的。

部署（需要 CF API 令牌：只给 `uksev.co.uk` 的 Workers Scripts 编辑 + Workers Routes 编辑）：

```bash
npm ci                                   # 仓库根目录，Worker 复用 js-yaml 和 types
cd worker
# 先在 wrangler.toml 填 ACCESS_TEAM_DOMAIN 和 ACCESS_AUD（Access 应用里能看到）
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN     # 细粒度令牌，只选本仓库，Contents 读写，90 天
```

换令牌：重新跑最后一行即可，不用重新部署。
