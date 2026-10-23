// This file was modified for the Tofu gallery on 2026-10-23 (Apache License 2.0, section 4(b)):
// fetch_exchange_rates() reads the European Central Bank's reference rates through Frankfurter
// (api.frankfurter.dev) instead of numbat.dev's proxy, which other addresses cannot read, and gives up
// after 5 seconds. The original is numbat-wasm/www/index.js in https://github.com/sharkdp/numbat; the
// change is made by tofu/patch-exchange-rates.mjs in https://github.com/tofu-gallery/numbat.
import init, { setup_panic_hook, Numbat, FormatType } from "./pkg/numbat_wasm.js";

// Tofu gallery: the European Central Bank's reference rates, through Frankfurter (frankfurter.dev),
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

    const date = /^\d{4}-\d{2}-\d{2}$/.test(answer.date) ? answer.date : "";
    return '<?xml version="1.0" encoding="UTF-8"?><Cube><Cube time=\'' + date + "'>" + cubes + "</Cube></Cube>";
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

function create_numbat_instance() {
    return Numbat.new(true, true, FormatType.JqueryTerminal);
}

function updateUrlQuery(query) {
    let url = new URL(window.location);
    if (query == null) {
        url.searchParams.delete('q');
    } else {
        url.searchParams.set('q', query);
    }

    history.replaceState(null, null, url);
}

function interpret(input) {
    // Skip empty lines or comments
    var input_trimmed = input.trim();
    if (input_trimmed === "" || (input_trimmed[0] === "#" && input_trimmed.indexOf("\n") == -1)) {
        return;
    }

    var cmd_result = numbat.try_run_command(input);

    if (cmd_result.is_command) {
        if (cmd_result.should_reset) {
            numbat = create_numbat_instance();
            numbat.interpret("use units::currencies");
            combined_input = "";
            updateUrlQuery(null);
            this.clear();
        } else if (cmd_result.should_clear) {
            this.clear();
        }

        return cmd_result.output;
    }

    // Not a command - interpret as Numbat code
    var result = numbat.interpret(input);

    if (!result.is_error) {
        combined_input += input.trim() + "⏎";
        updateUrlQuery(combined_input);
    }

    return result.output;
}

const parsedTerminalHeightInPixels = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
        "--terminal-height"
    ),
    10
);

function setup() {
    $(document).ready(function () {
        var term = $('#terminal').terminal(interpret, {
            greetings: false,
            name: "terminal",
            height: parsedTerminalHeightInPixels,
            prompt: "[[;;;prompt]>>> ]",
            checkArity: false,
            historySize: 200,
            historyFilter(line) {
                return line.trim() !== "";
            },
            completion(inp, cb) {
                cb(numbat.get_completions_for(inp));
            },
            keymap: {
                'TAB': function(e, original) {
                    // Handle unicode completion (e.g., \alpha -> α)
                    var cmd = this.get_command();
                    var unicodeResult = numbat.get_unicode_completion(cmd);
                    if (unicodeResult.length === 2) {
                        var patternLen = unicodeResult[0];
                        var replacement = unicodeResult[1];
                        var newCmd = cmd.slice(0, -patternLen) + replacement;
                        this.set_command(newCmd);
                    } else {
                        original(e);
                    }
                }
            }
        });

        // Swap out the skeleton loader with the terminal to prevent layout shifting.
        document.getElementById("skeleton-loader").classList.add("hidden");
        document.getElementById("terminal").classList.remove("hidden");

        // evaluate expression in query string if supplied (via opensearch)
        if (location.search) {
            var queryParams = new URLSearchParams(location.search);
            if (queryParams.has("q")) {
                // feed in the query line by line, as if the user typed it in
                for (const line of queryParams.get("q").split("⏎")) {
                    if (line.trim().length > 0) {
                        term.exec(line.trim() + "\n");
                    }
                }
            }
        }
    });
}

var numbat;
var combined_input = "";

async function main() {
    await init();

    setup_panic_hook();

    numbat = create_numbat_instance();
    combined_input = "";

    // Load KeyboardEvent polyfill for old browsers
    keyboardeventKeyPolyfill.polyfill();

    fetch_exchange_rates().then(setup);
}

main();
