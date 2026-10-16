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

目前只有前端：每辆车是一个文件 `content/pre-owned/<slug>.md`（文件名就是网址 `/pre-owned/<slug>/`），
照片放 `public/uploads/pre-owned/`。新增一辆车 = 加一个文件、提交到 main，Pages 会自动重新部署。
后台管理方式还没定；所有读数据的代码都在 `src/lib/preowned.ts`（`getAll` / `getBySlug` / `getListed`），
以后换成后端接口只改这一个文件。

```yaml
---
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
  这是按「构建时间」算的，网站下次部署时才会更新。没填 `soldDate` 的已售车不会自动隐藏。
- `reserved` 不会自动变化。
- `draft: true` 只在本地 `npm run dev` 显示；`NEXT_PUBLIC_SHOW_DRAFTS=1 npm run build` 可本地预览（不要在 CI 里设）。
  仓库里 6 条 `example-*` 都是草稿示例，上真车后删掉即可。
- 不要写车架号、序列号或任何私人信息，仓库可能是公开的。
- 设计稿里的占位文案（48 小时保留、32 项检测、付款方式、送货等）集中在 `src/lib/preowned-copy.ts`，都标了 `TODO(Panda)`，上线前要确认。
