// Tofu gallery: rewrites fetch_exchange_rates() in the site's copy of numbat-wasm/www/index.js.
// Usage: node tofu/patch-exchange-rates.mjs site/index.js
//
// Upstream fetches the European Central Bank's daily reference rates from numbat.dev's own proxy. Neither
// that proxy nor the ECB's feed sends a CORS header, so a copy served from any other address cannot read
// them, and every currency would come out as NaN. Frankfurter (https://frankfurter.dev, open source, no key)
// publishes the same ECB rates to any address; this writes its answer as the ECB's XML, which is what numbat
// parses. The REPL still waits for the rates before it starts, as upstream's does, but at most 5 seconds.
// If upstream's function changes, this stops with an error instead of building a site without the change.

import { readFileSync, writeFileSync } from "node:fs";

const UPSTREAM = `async function fetch_exchange_rates() {
    try {
        const response = await fetch("https://numbat.dev/ecb-exchange-rates.php");

        if (!response.ok) {
            return;
        }

        const xml_content = await response.text();
        numbat.set_exchange_rates(xml_content);
    } catch (error) {
        console.error("Failed to load currency exchange rates from the European Central Bank");
        // Load the units anyway
        numbat.interpret("use units::currencies");
        return;
    }
}
`;

const REPLACEMENT = `// Tofu gallery: the European Central Bank's reference rates, through Frankfurter (frankfurter.dev),
// which any address may read; numbat.dev's proxy and the ECB's own feed answer only numbat.dev.
const EXCHANGE_RATES_URL = "https://api.frankfurter.dev/v1/latest";
const EXCHANGE_RATES_TIMEOUT_MS = 5000;

// Frankfurter answers {"base": "EUR", "date": "…", "rates": {"USD": 1.12, …}}. numbat parses the ECB's
// XML, one <Cube currency='USD' rate='1.12'/> per currency, so the answer is written that way.
function ecb_xml_from_frankfurter(answer) {
    if (!answer || answer.base !== "EUR" || typeof answer.rates !== "object" || answer.rates === null) {
        throw new Error("Unexpected answer from " + EXCHANGE_RATES_URL);
    }

    let cubes = "";
    for (const [currency, rate] of Object.entries(answer.rates)) {
        if (/^[A-Z]{3}$/.test(currency) && typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
            cubes += "<Cube currency='" + currency + "' rate='" + rate + "'/>";
        }
    }
    if (cubes === "") {
        throw new Error("No exchange rates in the answer from " + EXCHANGE_RATES_URL);
    }

    const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(answer.date) ? answer.date : "";
    return '<?xml version="1.0" encoding="UTF-8"?><Cube><Cube time=\\'' + date + "'>" + cubes + "</Cube></Cube>";
}

async function fetch_exchange_rates() {
    // Without an answer within the limit, the REPL starts without exchange rates.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXCHANGE_RATES_TIMEOUT_MS);

    try {
        const response = await fetch(EXCHANGE_RATES_URL, { signal: controller.signal });

        if (!response.ok) {
            return;
        }

        const xml_content = ecb_xml_from_frankfurter(await response.json());
        numbat.set_exchange_rates(xml_content);
    } catch (error) {
        console.error("Failed to load currency exchange rates from the European Central Bank");
        // Load the units anyway
        numbat.interpret("use units::currencies");
        return;
    } finally {
        clearTimeout(timeout);
    }
}
`;

const NOTICE = `// This file was modified for the Tofu gallery on 2026-10-23 (Apache License 2.0, section 4(b)):
// fetch_exchange_rates() reads the European Central Bank's reference rates through Frankfurter
// (api.frankfurter.dev) instead of numbat.dev's proxy, which other addresses cannot read, and gives up
// after 5 seconds. The original is numbat-wasm/www/index.js in https://github.com/sharkdp/numbat; the
// change is made by tofu/patch-exchange-rates.mjs in https://github.com/tofu-gallery/numbat.
`;

const file = process.argv[2];
if (!file) {
    console.error("Usage: node tofu/patch-exchange-rates.mjs site/index.js");
    process.exit(2);
}

const source = readFileSync(file, "utf8");
if (source.startsWith(NOTICE)) {
    console.error(`${file} is already patched`);
    process.exit(1);
}
if (source.split(UPSTREAM).length !== 2) {
    console.error(`${file}: upstream's fetch_exchange_rates() has changed; update tofu/patch-exchange-rates.mjs`);
    process.exit(1);
}

writeFileSync(file, NOTICE + source.replace(UPSTREAM, () => REPLACEMENT));
console.log(`${file}: exchange rates now come from https://api.frankfurter.dev/v1/latest`);
