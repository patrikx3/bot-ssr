[//]: #@corifeus-header

  [![NPM](https://img.shields.io/npm/v/ngx-bot-ssr.svg)](https://www.npmjs.com/package/ngx-bot-ssr)  [![Donate for PatrikX3 / P3X](https://img.shields.io/badge/Donate-PatrikX3-003087.svg)](https://paypal.me/patrikx3) [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Corifeus @ Facebook](https://img.shields.io/badge/Facebook-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)  [![Uptime ratio (90 days)](https://network.corifeus.com/public/api/uptime-shield/31ad7a5c194347c33e5445dbaf8.svg)](https://network.corifeus.com/status/31ad7a5c194347c33e5445dbaf8)





# 🤖 Angular SSR for bots, prebuilt CSR shell for humans. Faster page loads for users, fully prerendered HTML for Googlebot, Bingbot, Yandex, ClaudeBot, GPTBot and link unfurlers. v2026.4.106


  
🌌 **Bugs are evident™ - MATRIX️**  
🚧 **This project is under active development!**  
📢 **We welcome your feedback and contributions.**  
    



### NodeJS LTS is supported

### 🛠️ Built on NodeJs version

```txt
v24.14.1
```





# 📝 Description

                        
[//]: #@corifeus-header:end

**Angular SSR for bots, prebuilt CSR shell for humans.** Faster page loads for users, fully prerendered HTML for Googlebot, Bingbot, Yandex, ClaudeBot, GPTBot and link unfurlers.

Powered by [`isbot`](https://github.com/omrilotan/isbot).

# Why

Angular SSR is great for crawlers and great in the readme — but in production, every real user pays for it: SSR HTML arrives, hydrates, and re-renders. Users see a flash, click handlers don't fire until hydration completes, and Time to Interactive is *worse* than a CSR-only build for sites with any meaningful JS.

Meanwhile, the bots that actually need server-rendered HTML — Googlebot, Bingbot, Yandex, Facebook/Twitter unfurlers, ClaudeBot, GPTBot, PerplexityBot — execute little or no JavaScript. Shipping them the CSR shell means empty meta tags, empty link previews, and weak indexing.

`ngx-bot-ssr` switches the response based on the `User-Agent`:

- **Real browsers** → static `index.csr.html` shell, Angular bootstraps client-side, no hydration flicker
- **Bots / crawlers / unfurlers / missing UA** → Angular SSR via `AngularNodeAppEngine.handle()`, fully prerendered HTML

Sets `Vary: User-Agent` so any upstream cache (CDN, Varnish, Cloudflare) keeps the two responses separate.

The Angular community has been asking for this for years:

- [angular/angular#52360](https://github.com/angular/angular/issues/52360) — *"skip Client App Initialization for Google/Bing Crawlers/Bots"*
- [angular/universal-starter#536](https://github.com/angular/universal-starter/issues/536) — *"Is it possible to use SSR only for bots/crawlers?"*

# Install

```bash
yarn add ngx-bot-ssr
# or
npm install ngx-bot-ssr
```

`express` is a peer dependency. You almost certainly already have it via `@angular/ssr`.

# Usage — Angular SSR (the easy way)

In your Angular SSR project's `src/server.ts`, replace the catch-all `app.use((req, res, next) => angularApp.handle(req)...)` block with `angularBotSsr(...)`. Three lines, no glue code:

```ts
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { angularBotSsr } from 'ngx-bot-ssr';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Static assets first (CSR JS, images, fonts)
app.use(express.static(browserDistFolder, {
  maxAge: '1y',
  index: false,
  redirect: false,
}));

// Bots → SSR, humans → CSR shell. That's it.
app.use(angularBotSsr({
  browserDistFolder,
  angularApp,
  writeResponseToNodeResponse,
}));

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => console.log(`listening on http://localhost:${port}`));
}

export const reqHandler = createNodeRequestHandler(app);
```

Build with `ng build` (which already produces `index.csr.html`), run the SSR server, and:

- `curl -H 'User-Agent: Googlebot/2.1' http://localhost:4000/` → fully prerendered Angular HTML
- `curl -H 'User-Agent: Mozilla/5.0 (...) Chrome/...' http://localhost:4000/` → CSR shell, ~1 KB

> **Why pass `writeResponseToNodeResponse` and `angularApp` in?** `@angular/ssr/node` is ESM-only, so the package can't `require()` it from a CJS module. Passing them in keeps `ngx-bot-ssr` framework-agnostic at the core (Hono, raw Web fetch handlers, etc. all work) while still giving the Angular case a one-call API.

# API — `angularBotSsr(options)`

```js
const { angularBotSsr } = require('ngx-bot-ssr');
// or: import { angularBotSsr } from 'ngx-bot-ssr';

app.use(angularBotSsr(options));
```

| Option | Required | Description |
| --- | --- | --- |
| `browserDistFolder` | ✅ | Absolute path to your Angular `dist/.../browser/` folder. The CSR shell is read from `${browserDistFolder}/index.csr.html` unless `shell` is set. |
| `angularApp` | ✅ | An `AngularNodeAppEngine` instance from `@angular/ssr/node`. |
| `writeResponseToNodeResponse` | ✅ | Imported from `@angular/ssr/node`. |
| `shell` | – | Override the shell path if your CSR file lives elsewhere. |
| `isBot` | – | `(userAgent: string \| undefined) => boolean`. Override the default detection. |
| `shellCacheControl` | – | `Cache-Control` header for the CSR shell. Defaults to `'no-cache'`. |

# API — `botSsr(options)` (low-level, framework-agnostic)

Use this if you're not on Angular — Hono, plain `fetch`-style handlers, anything that returns a Web `Response` works.

```js
const { botSsr } = require('ngx-bot-ssr');

app.use(botSsr({
  shell: '/abs/path/to/index.csr.html',
  ssr: (req) => myEngine.handle(req),         // → Promise<Response | null | undefined>
  writeResponse: (response, res) => { /* serialize Web Response → Node res */ },
  // optional:
  isBot,                // (ua) => boolean
  shellCacheControl,    // string
}));
```

| Option | Required | Description |
| --- | --- | --- |
| `shell` | ✅ | Absolute path to the CSR shell HTML. Read once at construction (boot-time sync I/O is fine). |
| `ssr` | ✅ | `(req) => Promise<Response \| null \| undefined>`. Returning `null`/`undefined` calls `next()`. |
| `writeResponse` | ✅ | `(response, res) => void`. Serializes the Web `Response` into the Node `res`. |
| `isBot` | – | `(userAgent) => boolean`. Default uses [`isbot`](https://github.com/omrilotan/isbot) and treats missing UAs as bots. |
| `shellCacheControl` | – | Default `'no-cache'`. |

# How it works

```text
                  request
                     │
                     ▼
        ┌────────────────────────┐
        │ Vary: User-Agent       │
        └────────────────────────┘
                     │
            isBot(req.UA)?
              ┌──────┴──────┐
              │             │
            true           false
              │             │
              ▼             ▼
        options.ssr     send shell
              │       (read once
              ▼        at boot)
       Response | null
              │
       ┌──────┴──────┐
       │             │
   Response       null/undef
       │             │
       ▼             ▼
 writeResponse    next()
```

Treats missing UAs as bots — safer to prerender than to ship the CSR shell to an unknown client.

# Reference reading

- [Adnan Ebrahimi — switch SSR/CSR by user agent](https://blog.adnanebrahimi.com/how-to-switch-between-angular-ssr-or-csr-based-on-detecting-user-agent)
- [baunov gist](https://gist.github.com/baunov/e1ecdb899e7be9ecf65a25b8c1a418d6)
- [dsimmons on Medium — Frustrated with Angular Universal SSR](https://medium.com/@dsimmons_23530/frustrated-with-angular-universal-ssr-heres-the-answer-35bf37d70cee)
- [Infinum handbook — robots and sitemap](https://infinum.com/handbook/frontend/angular/server-side-rendering-ssr/robots-and-sitemap)

# Credits

- [`isbot`](https://github.com/omrilotan/isbot) by Omri Lotan — the bot detection library this package wraps. Updated continuously, covers the long tail of crawlers, AI bots, and link unfurlers.
- Pattern originally extracted from [`corifeus-app-web-pages`](https://github.com/patrikx3/corifeus-app-web-pages).

[//]: #@corifeus-footer

---

# 🌐 Meet Assistant SaaS — meeting.corifeus.com

Don't want to install anything? Try the **hosted version** at **[meeting.corifeus.com](https://meeting.corifeus.com)** — full meeting workflow built for European businesses, no setup, no API key, no command line.

What the hosted version offers:

- **21-language live translation** during the meeting
- **AI summaries, action items, decisions, attendees, key quotes** auto-generated after every meeting
- **Custom vocabulary** — your client / company / industry terms corrected automatically (Pro+ tier)
- **Searchable meeting library** — find any decision or promise across all your past meetings
- **Shareable read-only links** — send a clean meeting summary to a client or teammate, no signup needed on their end
- **One-click email summary** after each meeting
- **Premium engine on every plan** — no downgraded model, ever
- **EU billing** — Stripe Tax + VAT-compliant + EUR-priced (Solo €19.99 / Pro €39.99 / Business €99.99 per month, no lock-in)
- **GDPR-compliant by default** — browser-language auto-detection, no tracking cookies, your meetings stored encrypted

Try the live demo (1 minute free, no signup) or browse the **public sample meeting** at [meeting.corifeus.com/sample](https://meeting.corifeus.com/sample).

---

# Corifeus Network

AI-powered network & email toolkit — free, no signup.

**Web** · [network.corifeus.com](https://network.corifeus.com)  **MCP** · [`npm i -g p3x-network-mcp`](https://www.npmjs.com/package/p3x-network-mcp)

- **AI Network Assistant** — ask in plain language, get a full domain health report
- **Network Audit** — DNS, SSL, security headers, DNSBL, BGP, IPv6, geolocation in one call
- **Diagnostics** — DNS lookup & global propagation, WHOIS, reverse DNS, HTTP check, my-IP
- **Mail Tester** — live SPF/DKIM/DMARC + spam score + AI fix suggestions, results emailed (localized)
- **Monitoring** — TCP / HTTP / Ping with alerts and public status pages
- **MCP server** — 17 tools exposed to Claude Code, Codex, Cursor, any MCP client
- **Install** — `claude mcp add p3x-network -- npx p3x-network-mcp`
- **Try** — *"audit example.com"*, *"why do my emails land in spam? test me@example.com"*
- **Source** — [patrikx3/network](https://github.com/patrikx3/network) · [patrikx3/network-mcp](https://github.com/patrikx3/network-mcp)
- **Contact** — [patrikx3.com](https://www.patrikx3.com/en/front/contact) · [donate](https://paypal.me/patrikx3)

---

## ❤️ Support Our Open-Source Project  
If you appreciate our work, consider ⭐ starring this repository or 💰 making a donation to support server maintenance and ongoing development. Your support means the world to us—thank you!  

---

### 🌍 About My Domains  
All my domains, including [patrikx3.com](https://patrikx3.com), [corifeus.eu](https://corifeus.eu), and [corifeus.com](https://corifeus.com), are developed in my spare time. While you may encounter minor errors, the sites are generally stable and fully functional.  

---

### 📈 Versioning Policy  
**Version Structure:** We follow a **Major.Minor.Patch** versioning scheme:  
- **Major:** 📅 Corresponds to the current year.  
- **Minor:** 🌓 Set as 4 for releases from January to June, and 10 for July to December.  
- **Patch:** 🔧 Incremental, updated with each build.  

**🚨 Important Changes:** Any breaking changes are prominently noted in the readme to keep you informed.


[**NGX-BOT-SSR**](https://corifeus.com/bot-ssr) Build v2026.4.106

 [![NPM](https://img.shields.io/npm/v/ngx-bot-ssr.svg)](https://www.npmjs.com/package/ngx-bot-ssr)  [![Donate for PatrikX3 / P3X](https://img.shields.io/badge/Donate-PatrikX3-003087.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QZVM4V6HVZJW6)  [![Contact Corifeus / P3X](https://img.shields.io/badge/Contact-P3X-ff9900.svg)](https://www.patrikx3.com/en/front/contact) [![Like Corifeus @ Facebook](https://img.shields.io/badge/LIKE-Corifeus-3b5998.svg)](https://www.facebook.com/corifeus.software)





[//]: #@corifeus-footer:end
