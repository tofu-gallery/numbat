#!/usr/bin/env bash
# Tofu gallery: builds Numbat's web REPL (numbat-wasm/) and writes the finished static site to site/.
# Needs Rust with the wasm32-unknown-unknown target, wasm-pack on PATH, rsync and Node.js.
# See TOFU.md for what this changes and why.

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Upstream's own build: wasm-pack compiles numbat-wasm/ and writes numbat-wasm/www/pkg/.
(cd numbat-wasm && bash build.sh)

# 2. The site is upstream's www/ folder, which is what numbat.dev serves, minus its .gitignore files
#    (wasm-pack writes pkg/.gitignore containing "*", which would keep the build out of git) and minus the
#    npm packaging of its two wasm-pack packages (pkg/, built above, and articles/pkg/, which upstream
#    commits): the TypeScript declarations (*.d.ts) and package.json. The pages load neither, and Tofu's
#    static hosting refuses a site that contains them.
rm -rf site
mkdir site
rsync -a --exclude '.gitignore' --exclude '*.d.ts' --exclude 'package.json' numbat-wasm/www/ site/

# 3. Exchange rates from a source that any address may read (TOFU.md, "What we changed").
node tofu/patch-exchange-rates.mjs site/index.js

# 4. The licences travel with the site.
cp LICENSE-MIT LICENSE-APACHE site/

echo "site/ is ready: $(find site -type f | wc -l | tr -d ' ') files"
