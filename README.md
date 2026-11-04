# Steven Gobran · Portfolio

Personal site for Steven Gobran: projects, experience, the trading desk, research, certifications and videos.
Plain HTML, CSS and JavaScript. There is no framework and no build step.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Any static file server works. Open `index.html` through a server, not as a `file://` URL, so the dot portrait can read its image.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New → Project** and import the repo.
3. Leave the settings at their defaults: Framework Preset **Other**, no build command, and the project root as the output directory.
4. Click **Deploy**.

You don't need a `Procfile`. That file is for Heroku-style servers. Vercel serves this folder as static files and reads `vercel.json` for clean URLs, caching and security headers.

After the first deploy, once you know the final domain:

- Change the `og:image` tag in `index.html` to the full URL (for example `https://your-domain.com/assets/img/og.png`). LinkedIn and other sites need an absolute URL to show the link preview.
- Add `<link rel="canonical" href="https://your-domain.com/" />` and `<meta property="og:url" content="https://your-domain.com/" />` to the `<head>`.

## Project layout

```
index.html                     all page content
assets/css/styles.css          design tokens + every section's styles
assets/js/main.js              nav, dot portrait, tabs, carousel, filters, video player, diagrams, chart
assets/js/game.js              game mode (loaded only when someone turns it on)
assets/fonts/                  self-hosted Inter, Space Grotesk, JetBrains Mono (SIL OFL)
assets/img/                    photos, project screenshots, certificates, icons, share image
assets/img/trading/            trading screenshots; certificates/ is for prop-firm certificates
assets/video/                  Prop Desk phone recording (mp4 + webm)
assets/Steven_Gobran_Resume.pdf
favicon.ico, favicon.svg, site.webmanifest
vercel.json                    clean URLs, cache + security headers
_source/                       original photos/recording (git-ignored, not deployed)
```

## Common edits

- **Resume:** replace `assets/Steven_Gobran_Resume.pdf` with a file of the same name.
- **CSS or JS changes:** bump the `?v=` date on the `styles.css` and `main.js` links in `index.html` so returning visitors get the new files right away.
- **Featured projects:** each carousel slide is an `<article class="slide">` inside `#projects`. Add a matching `<button class="spotlight__dot">` for every new slide. Screenshots are 1200×900 (4:3).
- **Project grid:** each card is an `<article class="card" data-area="...">`. `data-area` takes one or more of `data ai systems web compilers` and drives the filter buttons.
- **Certifications:** each certificate is an `<li class="cert-card">` in the Research section. Save the certificate as `assets/img/certs/NAME.webp` plus a 4:3 thumbnail `NAME-thumb.webp`, copy an existing `<li>`, and update the name, issuer, date and `data-verify` link. Ones without an image go in the "Also completed" list.
- **Architecture diagrams:** each one is a `<template id="arch-KEY">` near the bottom of `index.html` that holds Mermaid source. Any button with `data-arch="KEY"` opens it, and Mermaid.js loads from jsDelivr the first time someone opens a diagram.
- **Prop-firm certificates:** drop images (`.webp`, `.jpg`, `.png`) into `assets/img/trading/certificates/`. In `index.html`, find `id="prop-certs"`, copy the example `<li>` from the comment once per file, and delete the `hidden` attribute.
- **Videos:** each playlist entry is a `<button class="pl-item" data-id="YOUTUBE_ID">`. Thumbnails live in `assets/img/videos/` (`ID.webp` for the player, `ID-320.webp` for the list).
- **Game mode:** platforms are the page elements listed in `PLATFORM_SEL` at the top of `assets/js/game.js`. Physics constants are right above it.

## Credits

The layout is inspired by [Gazi Jarin's portfolio](https://www.gazijarin.com/). All code here is original.
