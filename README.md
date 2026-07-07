# Chatty Buddy

A communication app (AAC) for non-verbal children. It is a static site hosted on
Cloudflare Pages: tap word or photo tiles, or type, to have the device speak.

## Repository layout

```
public/                      <- everything Cloudflare serves (the live site)
  index.html                 the app
  _headers                   security response headers (CSP, etc.)
  assets/
    css/                     compiled Tailwind + self-hosted font CSS
    js/chatty_buddy_app.js   all app logic
    fonts/                   self-hosted Material Symbols icon font
build_tooling/               source for compiling the CSS (NOT served)
wrangler.toml                Cloudflare Pages config (serve ./public)
```

Nothing outside `public/` is web-accessible.

## Deploying (Cloudflare Pages)

The site is static and already built, so **no build step is required** - Cloudflare
just serves the `public/` folder.

- The included `wrangler.toml` sets the build output directory to `public`. If your
  Pages project does not pick that up, set **Build output directory = `public`** and
  leave the **Build command empty** in the Pages project settings.
- Set `name` in `wrangler.toml` to match your Pages project name.
- Push to a branch and open a pull request first: Cloudflare builds a preview at a
  temporary URL, so you can confirm the site loads and the headers are present before
  merging to your production branch.

## Changing the design (only if you edit styles)

`public/assets/css/chatty_buddy_styles.css` is compiled from Tailwind and committed, so
you only need this when you change classes or the theme:

```
cd build_tooling
npm install          # first time only; restores dependencies from package-lock.json
npm run build:css    # recompiles into public/assets/css/chatty_buddy_styles.css
```

The build scans both `public/index.html` and `public/assets/js/` for the classes to keep.

## Security notes

- Fully self-contained: no third-party CDNs or fonts and no external network calls. All
  data (a child's name and photos) stays in the browser's localStorage, on the device.
- A strict Content-Security-Policy lives in TWO places that must stay in sync: the
  `<meta>` tag in `public/index.html` and the header block in `public/_headers`. Change
  one, change the other.
- The UI is built with `textContent` / `createElement` (never `innerHTML` from user
  input), and uploaded photos are validated before use.
