# UKSEV LTD website

Static lead-gen marketing site for UKSEV LTD (Abingdon warehouse).

- `/` — portal (hero, roster, stock, about, contact)
- `/shop` — catalogue with search / filter / sort
- `/used` — used e-bikes (one Markdown file per bike in `content/used/`)
- `/admin` — Sveltia CMS for managing used bikes (see below)

CTA: Call / WhatsApp / Enquire. No checkout.

```bash
npm install
npm run dev
```

Stack: Next.js App Router, React 19, TypeScript, Tailwind CSS 4. Static export
(`out/`) deployed to GitHub Pages by `.github/workflows/pages.yml`.

## 二手车模块（Used E-Bikes）

每辆车是一个文件：`content/used/<slug>.md`（文件名就是网址 `/used/<slug>/`），
照片放在 `public/uploads/used/`。构建时会校验每个字段，填错（比如价格不是数字、
状态不是 available/reserved/sold、照片文件不存在）会让构建失败，并在日志里写清是哪个文件哪个字段。

字段：`title`、`brand`、`model`、`year`、`mileage`（英里）、`batteryHealth`（%，可选）、
`motor` / `battery`（可选）、`price`（英镑）、`condition`（Excellent / Good / Fair）、
`status`（available / reserved / sold）、`location`（默认 Abingdon OX13）、`photos`（第一张是封面）、
`featured`、`date`、`draft`，正文是描述（Markdown，原始 HTML 会被去掉）。

- 已售（sold）的车会变灰、排在最后，但不会消失；想彻底下架就删掉这条。
- `draft: true` 的条目只在本地 `npm run dev` 里显示，正式网站不显示。
  仓库里自带的 3 条 `EXAMPLE` 示例车都是 `draft: true`，只用来看效果；可以在后台删掉。
  本地想预览带草稿的正式构建：`NEXT_PUBLIC_SHOW_DRAFTS=1 npm run build`（不要在 CI / Pages 里设这个变量）。

### 在后台添加一辆二手车

1. 打开 <https://uksev.co.uk/admin/>，点 **Sign in with GitHub**（需要对 `UKSEV-CO-UK/uksev-website` 有写权限）。
2. 左边选「二手电动车 Used E-Bikes」→ **New**。
3. 填标题、品牌、型号、年份、里程、价格、成色、状态，上传照片（第一张是封面），写描述。
   **「草稿 Draft」保持关闭**，否则正式网站不显示。
4. 点 **Save / Publish**。后台会直接提交到 `main`，GitHub Actions 大约 2 分钟后重新部署，`/used/` 上就能看到。
5. 卖掉了：打开那辆车，把状态改成「已售 Sold」再保存。

### 一次性设置：后台登录（GitHub OAuth App + Cloudflare Worker）

GitHub Pages 没有服务器，后台登录要靠一个很小的 Cloudflare Worker 换 GitHub token。只需要做一次：

1. **部署 Worker**：打开 <https://github.com/sveltia/sveltia-cms-auth>，点 *Deploy to Cloudflare Workers*
   （或 clone 后 `wrangler deploy`）。部署完在 Cloudflare 后台记下 Worker 地址，
   形如 `https://sveltia-cms-auth.<你的子域>.workers.dev`。
2. **建 GitHub OAuth App**：GitHub → `UKSEV-CO-UK` 组织 Settings → Developer settings → OAuth Apps → New OAuth App
   （放个人账号下也可以）。
   - Homepage URL：`https://uksev.co.uk`
   - Authorization callback URL：`<Worker 地址>/callback`
   - 建好后记下 Client ID，生成一个 Client Secret。
   - 如果组织开了 OAuth App 访问限制，要在组织设置里批准这个 App。
3. **给 Worker 配变量**：Cloudflare → Workers → `sveltia-cms-auth` → Settings → Variables：
   - `GITHUB_CLIENT_ID` = Client ID
   - `GITHUB_CLIENT_SECRET` = Client Secret（点 Encrypt）
   - `ALLOWED_DOMAINS` = `uksev.co.uk`（强烈建议设）
   保存并重新部署。
4. **改配置**：把 `public/admin/config.yml` 里 `backend.base_url` 的
   `https://uksev-cms-auth.REPLACE-ME.workers.dev` 换成第 1 步的 Worker 地址，提交到 main。
   （想用自己的域名也可以给 Worker 绑一个，例如 `cms-auth.uksev.co.uk`，DNS 在 Cloudflare 上，填那个地址即可。）

之后 `/admin/` 就能用 GitHub 登录了。`/admin/` 已加 `noindex`，`robots.txt` 也屏蔽了它。
