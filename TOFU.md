# Numbat in the Tofu gallery

Numbat is a statically typed programming language for scientific computation, with physical dimensions and
units built into its type system. This copy is its web calculator, the one at numbat.dev: a command line in
the browser where you type an expression such as `40 kg * 9.8 m/s^2 * 150 cm -> J` and get the result with
its unit and its dimension. It knows hundreds of units, physical constants and functions, converts with
`-> unit`, and refuses nonsense: `3 months + 2 lightyears` is a type error that shows which side is a Time
and which a Length. Tab completes names (`\alpha` then Tab gives α); `help`, `list`, `info <name>`, `clear`
and `reset` are commands. Each line you enter is added to the page address (`?q=...`), so the address
replays the session and can be shared. Currency units (`EUR`, `USD`, `GBP`, `JPY`, ...) use the European
Central Bank's daily reference rates.

Everything runs in the visitor's browser: the language is compiled to WebAssembly. There is no account,
server or database, and what you type stays in the browser. The site also carries upstream's article
"Introducing Numbat: The type system" at `/articles/intro.html`, whose examples can be edited and re-run on
the page.

## How Tofu runs it

| | |
|---|---|
| Framework preset | `static` |
| Root folder | **`site/`**, only this folder |
| Install and build when deploying | none. `site/` is the finished site, built and committed for this pin. |
| Output directory | `site/` itself |
| Source build | Rust (stable; 1.98.1 here) with the `wasm32-unknown-unknown` target, wasm-pack (0.15.0 here), rsync and Node.js: `bash tofu/build-site.sh` from the repository root |
| Environment variables | none |
| Database | none |

Do not import the repository root or `numbat-wasm/www/`. The root is the Rust workspace and has no
`index.html`. `numbat-wasm/www/` has no compiled `pkg/` folder (upstream's `.gitignore` keeps it out of
git), so its page cannot start. The site expects to be served at the root of its address (`/`), which is
how Tofu serves it.

## What we changed, and why

No upstream file is edited. Every change is a new file on the `tofu` branch:

1. **`tofu/build-site.sh`.** Runs upstream's own build, `numbat-wasm/build.sh`
   (`wasm-pack build --target=web --out-dir=www/pkg` with `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`),
   then copies `numbat-wasm/www/`, the folder upstream publishes as numbat.dev, to `site/`. It leaves out
   the `.gitignore` files (wasm-pack writes `pkg/.gitignore` containing `*`, which would keep the build out
   of git), applies the change below to `site/index.js`, and puts copies of `LICENSE-MIT` and
   `LICENSE-APACHE` in `site/`.
2. **`tofu/patch-exchange-rates.mjs`: exchange rates that any address can read.** Upstream's page asks
   `https://numbat.dev/ecb-exchange-rates.php` for the European Central Bank's reference rates. Neither that
   address nor the ECB's own feed (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`) sends a
   CORS header (checked on 2026-10-23), so a browser showing the page from any other address may not read
   the answer. Upstream's code then loads the currency units without rates, and every conversion between
   currencies prints `NaN`. The script rewrites `fetch_exchange_rates()` in `site/index.js` (only there;
   upstream's `numbat-wasm/www/index.js` is untouched) so that it reads the same ECB rates from Frankfurter,
   `https://api.frankfurter.dev/v1/latest`, an open-source service that answers any address
   (`Access-Control-Allow-Origin: *`) and needs no key. Frankfurter answers in JSON; the script writes the
   answer as the ECB's XML, which is what numbat parses, keeping only three-letter codes with positive
   numeric rates. It also stops waiting after 5 seconds, so a slow rate service cannot keep the calculator
   behind its loading placeholder. A failure is handled exactly as upstream handles one: the calculator
   starts anyway and loads the currency units without rates. The rewritten file begins with a notice saying
   what was changed, when, and where the original is (Apache License 2.0, section 4(b)). If upstream changes
   `fetch_exchange_rates()`, the script stops with an error instead of building a site without the change.
3. **`site/`.** The verified build for this pin: 35 files, 5.2 MB. It is upstream's `numbat-wasm/www/` (the
   calculator page, its styles and scripts, jQuery and jQuery Terminal, the logo and icons,
   `opensearch.xml`, and `articles/` with the article's own prebuilt WebAssembly package, which upstream
   commits), plus the freshly built `pkg/` (`numbat_wasm_bg.wasm`, 1,896,505 bytes) and the two licence
   files.
4. **`TOFU.md`.** This file.

To move to a newer upstream commit: merge upstream's `main` into `tofu`, run `bash tofu/build-site.sh`,
check the calculator in a browser, commit `site/`, and tag a new pin.

## What works, and what does not

The calculator is upstream's, unchanged apart from where its exchange rates come from: expressions, units
and conversions, constants, functions, type errors, completion, history, the commands and `?q=` links. The
article's examples run, and run again when edited.

- **Exchange rates** are fetched from Frankfurter once per page load. They are the ECB's euro reference
  rates, which the ECB updates once per working day and publishes for information purposes. The ECB's
  feed has no Bulgarian lev rate, so `1 BGN -> EUR` prints `NaN €`, here and on numbat.dev alike. If
  Frankfurter cannot be reached, the calculator starts after at most about 5 seconds, the browser console
  shows "Failed to load currency exchange rates from the European Central Bank", and conversions between
  currencies print `NaN`. Everything else works, including sums within one currency (`5 EUR/kg * 3 kg`).
- **Fonts.** Both pages load their fonts from Google Fonts (`fonts.googleapis.com`, with the font files from
  `fonts.gstatic.com`): Exo 2 and Fira Mono on the calculator; Fira Mono, Lustria and Lato on the article.
  Without them the browser uses its own fonts.
- **Links that leave the copy.** Documentation, Syntax reference and Commands and key bindings go to
  numbat.dev/docs; Source code and the corner badge go to github.com/sharkdp/numbat; the article links to
  numbat.dev, Wikipedia and GitHub. The documentation is not part of this copy.
- **Search engine and link previews.** `opensearch.xml` and the page's preview tags (`og:url`, `og:image`)
  name numbat.dev. A browser that offers to add the calculator as a search engine adds numbat.dev, and a
  shared link's preview shows numbat.dev's address and image.
- **Ace's module address.** The article sets the Ace editor's module address to
  `cdnjs.cloudflare.com/ajax/libs/ace/1.9.6/`, where Ace would fetch extra modules on demand. The article
  uses only what its bundled `ace.min.js` contains; our runs made no request there.
- **Offline use.** There is no service worker, so the site needs a connection to load.
- **Phones.** At 375 px wide the calculator fits the width with no sideways scrolling and works.

The only requests that leave the site are to Frankfurter and Google Fonts when a page loads, and the links
above when a visitor follows one. There are no analytics, advertising or tracking scripts, and nothing
needs a key.

## Upstream and licence

- Upstream: <https://github.com/sharkdp/numbat>, branch `main`, commit
  `e8abf32b975fb03d5a554f5e7141cd50ae63e88d` (2026-10-11, "Deployment via nix"; the `numbat` crate is
  version 1.24.0).
- Fork: <https://github.com/tofu-gallery/numbat>. Its `main` mirrors upstream untouched; the adaptations are
  on `tofu`, and the gallery pins the tag `pin/2026-10-23`.
- Licence: MIT OR Apache-2.0, at your option (the `license` field of upstream's crates). "Copyright (c)
  2022-2024 David Peter, and all Numbat contributors". `LICENSE-MIT` and `LICENSE-APACHE` are unchanged, and
  `site/` carries byte-identical copies. Upstream has no NOTICE file. `site/index.js` is the one modified
  upstream file in the site, and it carries the notice described above.
- Name and artwork: the Numbat name, logo (`numbat.svg`, `numbat.png`) and icons are upstream's, unchanged;
  upstream ships no separate licence for them. The copy keeps upstream's links to the project.
- Bundled third-party code, shipped in `site/` exactly as upstream ships it: jQuery 3.7.0 (MIT; its notice
  line is in `jquery.min.js`), jQuery Terminal 2.36.0 (MIT; its licence header is in
  `jquery.terminal.min.js`), jQuery Mousewheel (MIT), keyboardevent-key-polyfill (CC0-1.0), and Ace 1.9.6
  (BSD-3-Clause) in `articles/` (`articles/ace.min.js` is an unused duplicate of `articles/pkg/ace.min.js`).
  The minified Mousewheel and Ace files carry no licence notice, as on numbat.dev.
- The WebAssembly file is compiled from numbat and about 80 Rust crates (`numbat-wasm/Cargo.lock`) under
  permissive terms (MIT, Apache-2.0, Unlicense, BSD-2-Clause, BSL-1.0, Unicode-3.0; most offer a choice).
  The one copyleft crate in the build, option-ext (MPL-2.0), is used only by the `rust-embed` macro while
  compiling and is not in the WebAssembly file. As on numbat.dev, the compiled file does not carry the
  crates' notices.
- Known advisories: GitHub's Dependabot lists alerts for upstream's lockfiles. The only one in the
  WebAssembly build is GHSA-cq8v-f236-94qc (low) for rand 0.9.1, which applies only to a program that
  installs a custom logger calling `rand::rng()`; the web build installs no logger. The others are in the
  command-line tool, the documentation build, the fuzzing harness and the VS Code extension, none of which
  are in `site/`.
- No copyleft source offer is needed. The exact source of this build is this fork at `pin/2026-10-23`.

## Verification

Run on 2026-10-23 on macOS (arm64) with rustc 1.98.1, wasm-pack 0.15.0 (installed with
`cargo install --locked --root <tools folder> wasm-pack`), Node 22.22.3 and Python 3. No app was deployed.

```sh
bash tofu/build-site.sh
# exit 0. numbat-wasm/build.sh took 40 s the first time (wasm-pack installed wasm-bindgen-cli 0.2.100 for
# itself and ran wasm-opt). site/: 35 files, 5.2 MB.
git status --short          # only site/ and tofu/ new; no upstream file changed (numbat-wasm/Cargo.lock unchanged)
node --check <copy of site/index.js>                                   # OK
python3 -I -m http.server <port> --bind 127.0.0.1 --directory <copy of site/, filtered as the importer filters>
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/                         # 200 text/html
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/pkg/numbat_wasm_bg.wasm  # 200 application/wasm
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:<port>/articles/intro.html      # 200
python3 -I simulate_import.py --one tofu-gallery/numbat tofu site yes
# root=site container=False kept=35 dropped=0
```

The `tofu` branch's archive before this file was added measured 3,601,869 bytes compressed, 620 files and
10.3 MB unpacked, well within the importer's limits.

A browser run (Chromium, driven by Aside) against 127.0.0.1 only:

- The calculator was ready 1.3 s after loading. `1 USD -> EUR` gave 0.893416 € (Frankfurter's rate for
  2026-10-23, 1.1193 dollars per euro); `40 kg * 9.8 m/s^2 * 150 cm -> J` gave 588 J; `2 m + 3 ft` gave
  9.56168 ft; `3 months + 2 lightyears` gave the type error naming Time and Length. The only requests to
  other addresses went to fonts.googleapis.com and api.frankfurter.dev (200).
- A `?q=` link holding three lines replayed them: 2.54 cm, `1 BGN -> EUR` = NaN €, `1 GBP -> USD` =
  1.33683 $. No console errors.
- At 375×812 the page was 375 px wide (no sideways scrolling) and `100 km/h -> m/s` gave 27.7778 m/s.
- Rate service that never answers (a local port that accepts connections and stays silent): the calculator
  was ready after 6.4 s, the console showed the one "Failed to load currency exchange rates" line,
  `1 USD -> EUR` gave NaN €, `2 m + 3 ft` gave 9.56168 ft and `5 EUR/kg * 3 kg` gave 15 €. Rate service
  that refuses the connection: ready after 1.3 s, same results.
- Upstream's unmodified `numbat-wasm/www/`, served the same way from 127.0.0.1, logged "Failed to load
  currency exchange rates from the European Central Bank" on load: the CORS failure described above.
- The article: all six examples evaluated; changing the first to `3 months + 2 lightyears` showed the type
  error; no console errors; the only request to another address went to Google Fonts.
- Typing through the browser automation's synthetic key events makes jQuery Terminal log
  `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` once per space, because those
  synthetic space key events carry an empty `key`. Upstream's unmodified page does the same, and lines
  entered through the terminal's own `exec()` log nothing, so this is the test tool, not the app.

Upstream's tests (`cargo test`, `numbat-wasm/test.sh`) were not run: no Rust file was changed.
