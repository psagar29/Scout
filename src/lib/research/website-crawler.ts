import * as cheerio from "cheerio";

import type { EvidenceItem } from "@/lib/risk/report-schema";
import { createEvidenceItem } from "@/lib/research/evidence";

const PAGE_HINTS = [
  "/",
  "/about",
  "/services",
  "/menu",
  "/products",
  "/events",
  "/classes",
  "/contact",
  "/location",
  "/faq",
  "/booking",
  "/reservations",
];

const PHONE_PATTERN =
  /(?:\+1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/u;
const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[A-Za-z0-9.'# -]+,\s*[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/u;

export type CrawledWebsite = {
  website: string;
  pages: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
  extractedName: string | null;
  address: string | null;
  phone: string | null;
  categories: string[];
  evidence: EvidenceItem[];
  combinedText: string;
};

function ensureWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeText(value: string, maxLength = 320) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).replace(/\s+\S*$/u, "")}...`;
}

function extractMetaFacts($: cheerio.CheerioAPI) {
  const meta: Record<string, string> = {};
  const selectors: Array<[string, string]> = [
    ['meta[name="description"]', "content"],
    ['meta[property="og:description"]', "content"],
    ['meta[property="og:title"]', "content"],
    ['meta[name="keywords"]', "content"],
    ['meta[property="og:site_name"]', "content"],
    ['meta[name="author"]', "content"],
  ];
  for (const [selector, attr] of selectors) {
    const value = $(selector).attr(attr)?.trim();
    if (value) {
      const key = selector.replace(/^meta\[(?:name|property)="([^"]+)"\]$/u, "$1");
      meta[key] = value;
    }
  }
  return meta;
}

function isSpaShell($: cheerio.CheerioAPI) {
  const bodyText = normalizeWhitespace($("body").text());
  return bodyText.length < 50;
}

function extractJsonLdFacts($: cheerio.CheerioAPI) {
  const scripts = $('script[type="application/ld+json"]')
    .map((_, node) => $(node).text())
    .get();

  const categories = new Set<string>();
  let name: string | null = null;
  let address: string | null = null;
  let phone: string | null = null;

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script) as unknown;
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "@graph" in parsed
          ? ((parsed as { "@graph"?: unknown[] })["@graph"] ?? [])
          : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;

        if (!name && typeof record.name === "string") {
          name = normalizeWhitespace(record.name);
        }
        if (!phone && typeof record.telephone === "string") {
          phone = normalizeWhitespace(record.telephone);
        }
        const type = record["@type"];
        if (typeof type === "string") categories.add(type.toLowerCase());
        if (Array.isArray(type)) {
          for (const entry of type) {
            if (typeof entry === "string") categories.add(entry.toLowerCase());
          }
        }

        if (!address && record.address && typeof record.address === "object") {
          const addressRecord = record.address as Record<string, unknown>;
          const parts = [
            addressRecord.streetAddress,
            addressRecord.addressLocality,
            addressRecord.addressRegion,
            addressRecord.postalCode,
          ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
          if (parts.length > 0) address = normalizeWhitespace(parts.join(", "));
        }
      }
    } catch {
      continue;
    }
  }

  return {
    name,
    address,
    phone,
    categories: [...categories],
  };
}

function scoreCandidateLink(url: URL) {
  const pathname = url.pathname.toLowerCase();
  return PAGE_HINTS.findIndex((hint) =>
    hint === "/" ? pathname === "/" : pathname.includes(hint),
  );
}

function collectCandidateLinks(
  $: cheerio.CheerioAPI,
  baseUrl: URL,
  currentUrl: string,
) {
  const links = new Set<string>([currentUrl]);

  $("a[href]")
    .map((_, node) => $(node).attr("href"))
    .get()
    .forEach((href) => {
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      try {
        const url = new URL(href, baseUrl);
        if (url.origin !== baseUrl.origin) return;
        links.add(url.toString());
      } catch {
        return;
      }
    });

  return [...links]
    .sort((left, right) => {
      const leftScore = scoreCandidateLink(new URL(left));
      const rightScore = scoreCandidateLink(new URL(right));
      return (leftScore === -1 ? Number.MAX_SAFE_INTEGER : leftScore) -
        (rightScore === -1 ? Number.MAX_SAFE_INTEGER : rightScore);
    })
    .slice(0, 8);
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BrokerScout/0.1 (+https://github.com/psagar29/scout)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`Website fetch failed with ${response.status}.`);
  }

  return response.text();
}

function extractPageData(url: string, html: string) {
  const $ = cheerio.load(html);
  const meta = extractMetaFacts($);
  const spa = isSpaShell($);

  $("script, style, noscript, svg").remove();
  const title =
    normalizeWhitespace($("title").first().text()) ||
    meta["og:title"] ||
    normalizeWhitespace($("h1").first().text()) ||
    new URL(url).hostname;
  const bodyText = normalizeWhitespace($("body").text());

  // For SPA shells, build text from meta tags instead of empty body.
  // Deduplicate — description and og:description are often identical.
  const metaParts: string[] = [];
  if (meta["description"]) metaParts.push(meta["description"]);
  if (meta["og:description"] && meta["og:description"] !== meta["description"]) {
    metaParts.push(meta["og:description"]);
  }
  if (meta["keywords"]) metaParts.push(meta["keywords"]);
  const metaText = metaParts.join(". ");

  const effectiveText = spa && metaText.length > 0 ? metaText : bodyText;
  const pageText = summarizeText(effectiveText, 480);
  const facts = extractJsonLdFacts($);

  // Extract categories from meta keywords for SPAs
  const metaCategories = [...facts.categories];
  if (meta["keywords"]) {
    for (const keyword of meta["keywords"].split(",")) {
      const trimmed = keyword.trim().toLowerCase();
      if (trimmed.length > 0 && trimmed.length < 40) {
        metaCategories.push(trimmed);
      }
    }
  }

  const nameFromMeta =
    facts.name ?? meta["og:site_name"] ?? meta["author"] ?? null;

  return {
    $,
    title,
    pageText,
    spa,
    phone: facts.phone ?? effectiveText.match(PHONE_PATTERN)?.[0] ?? null,
    address: facts.address ?? effectiveText.match(ADDRESS_PATTERN)?.[0] ?? null,
    name: nameFromMeta,
    categories: metaCategories,
  };
}

export async function crawlWebsite(rawUrl: string): Promise<CrawledWebsite | null> {
  const website = ensureWebsiteUrl(rawUrl);
  const baseUrl = new URL(website);

  try {
    const homeHtml = await fetchHtml(baseUrl.toString());
    const homeData = extractPageData(baseUrl.toString(), homeHtml);

    const pages: CrawledWebsite["pages"] = [];
    const evidence: EvidenceItem[] = [];
    const categories = new Set<string>(homeData.categories);
    let extractedName = homeData.name ?? null;
    let address = homeData.address;
    let phone = homeData.phone;
    let combinedText = "";

    // Add the home page data
    if (homeData.pageText) {
      pages.push({
        url: baseUrl.toString(),
        title: homeData.title,
        snippet: homeData.pageText,
      });
      evidence.push(
        createEvidenceItem({
          sourceType: "website",
          title: homeData.spa
            ? `${homeData.title} (meta tags)`
            : homeData.title,
          url: baseUrl.toString(),
          snippet: homeData.pageText || `Fetched ${baseUrl.toString()}`,
          confidence: homeData.spa ? "medium" : "high",
        }),
      );
      combinedText += ` ${homeData.title} ${homeData.pageText}`;
    }

    // For SPAs, subpages return the same empty shell — skip crawling them.
    // For static sites, crawl candidate links for richer evidence.
    if (!homeData.spa) {
      const candidateLinks = collectCandidateLinks(
        homeData.$,
        baseUrl,
        baseUrl.toString(),
      );

      for (const link of candidateLinks) {
        if (link === baseUrl.toString()) continue; // already processed
        try {
          const html = await fetchHtml(link);
          const data = extractPageData(link, html);
          if (data.spa) continue; // subpage is also a SPA shell
          pages.push({
            url: link,
            title: data.title,
            snippet: data.pageText,
          });
          evidence.push(
            createEvidenceItem({
              sourceType: "website",
              title: data.title,
              url: link,
              snippet: data.pageText || `Fetched ${link}`,
              confidence: "medium",
            }),
          );
          combinedText += ` ${data.title} ${data.pageText}`;
          if (!extractedName && data.name) extractedName = data.name;
          if (!address && data.address) address = data.address;
          if (!phone && data.phone) phone = data.phone;
          for (const category of data.categories) categories.add(category);
        } catch {
          continue;
        }
      }
    }

    return {
      website: baseUrl.toString(),
      pages,
      extractedName,
      address,
      phone,
      categories: [...categories],
      evidence,
      combinedText: normalizeWhitespace(combinedText),
    };
  } catch {
    return null;
  }
}
