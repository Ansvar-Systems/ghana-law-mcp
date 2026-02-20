/**
 * Rate-limited HTTP client for GhanaLII (ghalii.org)
 *
 * - 500ms minimum delay between requests
 * - User-Agent header identifying the MCP
 * - Handles HTML responses
 * - Retry with exponential backoff on 429/5xx
 */

const USER_AGENT = 'GhanaLawMCP/1.0 (+https://github.com/Ansvar-Systems/ghana-law-mcp)';
const MIN_DELAY_MS = 500;
const BASE_URL = 'https://ghalii.org';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, application/xhtml+xml, */*',
      },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Fetch the act index page from GhanaLII.
 * Uses /legislation/ endpoint with pagination (?page=N).
 * GhanaLII uses Akoma Ntoso URLs: /akn/gh/act/YYYY/NNN/eng@DATE
 */
export async function fetchActIndex(page = 0): Promise<FetchResult> {
  const url = page === 0
    ? `${BASE_URL}/legislation/`
    : `${BASE_URL}/legislation/?page=${page}`;
  return fetchWithRateLimit(url);
}

/**
 * Fetch an individual act content page from GhanaLII.
 * Accepts AKN URLs like /akn/gh/act/2020/1038/eng@2020-12-29
 */
export async function fetchActContent(actUrl: string): Promise<FetchResult> {
  const url = actUrl.startsWith('http') ? actUrl : `${BASE_URL}${actUrl}`;
  return fetchWithRateLimit(url);
}
