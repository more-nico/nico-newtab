/** Suggestion lookups stay quiet: every failure resolves to an empty list. */

import { t } from "./i18n";

export const MIN_QUERY_LENGTH = 2;
export const MAX_SUGGESTIONS = 8;
export const MAX_SUGGESTION_LENGTH = 120;
export const SUGGEST_TIMEOUT_MS = 4000;
const CACHE_LIMIT = 100;

export interface SuggestRequest {
  url: string;
  parser: "opensearch" | "baidu";
}

/**
 * Suggestion endpoints per built-in engine. Custom engines are intentionally
 * absent: they only ever search the address the user configured. Every host
 * here must also be granted in public/manifest.json — suggest.test.ts locks
 * the two together.
 */
const SUGGEST_ENDPOINTS: Record<string, SuggestRequest> = {
  google: {
    url: "https://suggestqueries.google.com/complete/search?client=chrome&q=%s",
    parser: "opensearch",
  },
  bing: {
    url: "https://api.bing.com/osjson.aspx?query=%s",
    parser: "opensearch",
  },
  baidu: {
    url: "https://suggestion.baidu.com/su?wd=%s&ie=utf-8",
    parser: "baidu",
  },
  duckduckgo: {
    url: "https://duckduckgo.com/ac/?q=%s&type=list",
    parser: "opensearch",
  },
};

/** The hosts the extension is allowed to talk to, derived from the table above. */
export function suggestHosts(): string[] {
  return [
    ...new Set(
      Object.values(SUGGEST_ENDPOINTS).map(
        (request) => new URL(request.url).origin,
      ),
    ),
  ];
}

/** Returns null for engines without suggestion support. */
export function suggestRequest(
  engineId: string,
  query: string,
): SuggestRequest | null {
  const request = SUGGEST_ENDPOINTS[engineId];
  if (!request) return null;
  return {
    url: request.url.replace("%s", encodeURIComponent(query.trim())),
    parser: request.parser,
  };
}

/** Trims, drops blanks and duplicates, removes the query itself, then caps. */
export function normalizeSuggestions(value: unknown, query = ""): string[] {
  if (!Array.isArray(value)) return [];
  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const text = entry.replace(/\s+/g, " ").trim();
    if (!text || text.length > MAX_SUGGESTION_LENGTH) continue;
    const key = text.toLowerCase();
    if (key === needle || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length === MAX_SUGGESTIONS) break;
  }
  return result;
}

/** OpenSearch `["query",["a","b"]]`, plus the bare-array shapes. */
export function parseSuggestions(text: string, query = ""): string[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (Array.isArray(data) && Array.isArray(data[1]))
    return normalizeSuggestions(data[1], query);
  if (Array.isArray(data) && data.every((entry) => typeof entry === "string"))
    return normalizeSuggestions(data, query);
  return normalizeSuggestions(
    Array.isArray(data)
      ? data.map((entry) =>
          typeof entry === "object" && entry !== null && "phrase" in entry
            ? (entry as { phrase: unknown }).phrase
            : entry,
        )
      : [],
    query,
  );
}

/**
 * Extracts a JSON array literal following the `key:` member by matching
 * brackets while tracking string state — suggestions legitimately contain `]`,
 * so a plain regex would truncate them. Baidu emits unquoted keys
 * (`{q:"…",p:false,s:[…]}`), so the quoted form is optional.
 */
function extractArray(text: string, key: string): string | null {
  const member = new RegExp(`(?:^|[{,\\s])"?${key}"?\\s*:`).exec(text);
  if (!member) return null;
  const start = text.indexOf("[", member.index);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** Baidu answers with `window.baidu.sug({q:"…",p:false,s:["…"]})`. */
export function parseBaiduSuggestions(text: string, query = ""): string[] {
  const literal = extractArray(text, "s");
  if (!literal) return [];
  try {
    return normalizeSuggestions(JSON.parse(literal), query);
  } catch {
    return [];
  }
}

/**
 * `Response.text()` always decodes as UTF-8 and ignores the charset parameter,
 * so honour the declared charset ourselves — Baidu has shipped both UTF-8 and
 * GBK over the years, and a wrong guess turns every suggestion into mojibake.
 */
export function decodeBody(
  contentType: string | null,
  buffer: ArrayBuffer,
): string {
  const declared = /charset=\s*"?([\w-]+)"?/i.exec(contentType ?? "")?.[1];
  if (declared && !/^utf-?8$/i.test(declared)) {
    try {
      return new TextDecoder(declared).decode(buffer);
    } catch {
      // Unknown label — fall back to UTF-8.
    }
  }
  return new TextDecoder("utf-8").decode(buffer);
}

const cache = new Map<string, string[]>();

function remember(key: string, list: string[]) {
  if (list.length === 0) return;
  cache.set(key, list);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export interface SuggestOutcome {
  items: string[];
  /**
   * True when the request itself failed (offline, blocked by the extension's
   * CSP, or timed out) as opposed to a successful response with no matches.
   * The field stays quiet either way, but the difference is what makes a
   * misconfigured extension diagnosable instead of invisible.
   */
  error: boolean;
}

export async function fetchSuggestions(
  engineId: string,
  query: string,
  signal?: AbortSignal,
): Promise<SuggestOutcome> {
  const text = query.trim();
  if (text.length < MIN_QUERY_LENGTH) return { items: [], error: false };
  const request = suggestRequest(engineId, text);
  if (!request) return { items: [], error: false };
  const key = `${engineId}\u0000${text}`;
  const cached = cache.get(key);
  if (cached) return { items: cached, error: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward, { once: true });
  try {
    const response = await fetch(request.url, {
      signal: controller.signal,
      credentials: "omit",
    });
    if (!response.ok) return { items: [], error: false };
    const body = decodeBody(
      response.headers.get("content-type"),
      await response.arrayBuffer(),
    );
    const list =
      request.parser === "baidu"
        ? parseBaiduSuggestions(body, text)
        : parseSuggestions(body, text);
    remember(key, list);
    return { items: list, error: false };
  } catch (e) {
    // Cancelling our own request is routine, not a fault.
    if (!controller.signal.aborted)
      console.warn(t().lib.suggest.requestFailed(engineId), e);
    return { items: [], error: !controller.signal.aborted };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
