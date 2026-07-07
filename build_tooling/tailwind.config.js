/*
    ============================================================================
    Tailwind build config for Chatty Buddy
    ============================================================================
    This is the config we use to COMPILE our stylesheet ahead of time, instead of
    shipping the runtime Tailwind CDN that used to compile styles live in every
    kid's browser. Compiling here means:
      - no third-party <script> running on the page (big security win),
      - a small, static .css file that can't change under us,
      - the app works offline and on locked-down networks.

    The theme below is an EXACT copy of the old inline `tailwind.config` that used
    to live in index.html, so the compiled output matches what the CDN produced
    for us - same colors, same everything. If you change the palette, change it
    here and re-run `npm run build:css`.

    Versions are pinned in package.json to the exact ones the CDN was serving
    (tailwindcss 3.4.17, forms 0.5.10, container-queries 0.1.1) so the generated
    utilities are identical down to the byte.
    ============================================================================
*/
module.exports = {
    // Scan BOTH the markup AND the app JS. This matters: after Phase 3 a lot of
    // classes (the category tiles, the setup-list rows, the dynamic drill-down
    // header) are applied from chatty_buddy_app.js at runtime, not written in the
    // HTML. If we only scanned index.html those classes would get purged and those
    // views would render unstyled. Scanning both keeps every used class and still
    // drops the ones we never reference.
    content: [
        "../public/index.html",
        "../public/assets/js/**/*.js",
    ],

    // Matches the old config. The app doesn't ship a dark theme yet, but we keep
    // this so behavior is identical to before.
    darkMode: "class",

    theme: {
        extend: {
            // Our custom "Material-you"-style palette. Verbatim from the old
            // inline config that index.html used to hand the CDN.
            colors: {
                "tertiary-container": "#8ff199",
                "on-tertiary-container": "#00702a",
                "secondary-container": "#4c96fe",
                "on-secondary-container": "#ffffff",
                "primary-container": "#ffd93d",
                "on-primary-container": "#725e00",
                "surface-container-highest": "#e4e2dd",
                "on-surface": "#1b1c19",
                "on-surface-variant": "#4d4633",
                "surface-container": "#f0eee9",
                "outline": "#7e7761",
                "error": "#ba1a1a",
                "on-error": "#ffffff",
            },

            // Kept for parity with the old config. Heads up: these map to
            // "Quicksand", which we no longer ship (it was never actually applied
            // to the page - see chatty_buddy_fonts.css). No element currently uses
            // font-body-lg / font-display-lg, so nothing is emitted for these and
            // they're effectively inert. If you ever want the Quicksand look,
            // self-host the font AND add a font-* class to the markup.
            fontFamily: {
                "body-lg": ["Quicksand"],
                "display-lg": ["Quicksand"],
            },
        },
    },

    // Same two plugins the CDN was loading (forms styles our inputs/selects,
    // container-queries is carried along for parity even though we don't use it yet).
    plugins: [
        require("@tailwindcss/forms"),
        require("@tailwindcss/container-queries"),
    ],
};
