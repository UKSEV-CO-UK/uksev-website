# UKSEV LTD website

Static lead-gen marketing site for UKSEV LTD (Abingdon warehouse).

- `/` — portal (hero, roster, stock, about, contact)
- `/shop` — catalogue with search / filter / sort

CTA: Call / WhatsApp / Enquire (`Tonysun@uksev.co.uk`). No checkout.

## Hosting

Production domain: **https://uksev.co.uk**

- Host: GitHub Pages from [UKSEV-CO-UK/uksev-website](https://github.com/UKSEV-CO-UK/uksev-website)
- Deploy: GitHub Actions → Pages (source = Actions, not branch)
- DNS: Cloudflare for `uksev.co.uk` (apex + `www` → Pages). Proxy **off** (grey cloud) until Pages finishes HTTPS.
- Site base path: `/` (root). Do **not** use `https://uksev-co-uk.github.io/uksev-website/` for visual sign-off if assets are rooted at `/`; that path preview will look broken.
- Until DNS is live, keep the existing Vercel deploy. After `uksev.co.uk` serves this build, turn Vercel off. Do not wipe old Vercel A/CNAME records until Pages custom domain is green.

### Cloudflare DNS (grey cloud)

DNS is on the company Cloudflare account. Agents do not change it — the owner adds these records by hand.


| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `uksev-co-uk.github.io` |

After the Pages workflow is on `main`, set the Pages custom domain to `uksev.co.uk` and turn on Enforce HTTPS.

Contact:

- Call `tel:+44752163699`
- WhatsApp `https://wa.me/44752163699`
- Email `Tonysun@uksev.co.uk`
- Address: Steventon Storage Facility, Hanney Rd, Steventon, Abingdon OX13 6DJ

## Local

```bash
npm install
npm run dev
```

Stack: Next.js App Router, React 19, TypeScript, Tailwind CSS 4.

Static export for Pages (`output: 'export'`) lands in a separate PR from the frontend workstream. After that merges to `main`, Actions publishes to Pages; Cloudflare apex CNAME/ALIAS points at the Pages target.
