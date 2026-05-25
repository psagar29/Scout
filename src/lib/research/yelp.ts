import { createEvidenceItem } from "@/lib/research/evidence";

type YelpBusiness = {
  id: string;
  name: string;
  url?: string;
  display_phone?: string;
  phone?: string;
  rating?: number;
  review_count?: number;
  categories?: Array<{ title?: string; alias?: string }>;
  location?: {
    display_address?: string[];
  };
};

type YelpReview = {
  text?: string;
  rating?: number;
  time_created?: string;
  url?: string;
};

export type YelpResult = {
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  url: string | null;
  categories: string[];
  evidence: ReturnType<typeof createEvidenceItem>[];
  raw: YelpBusiness;
};

function yelpApiKey() {
  const value = process.env.YELP_API_KEY?.trim();
  return value || null;
}

function splitTermAndLocation(query: string) {
  const [term, ...locationParts] = query.split(",").map((part) => part.trim());
  return {
    term: term || query,
    location: locationParts.join(", ") || undefined,
  };
}

async function fetchYelpJson<T>(path: string, apiKey: string) {
  const response = await fetch(`https://api.yelp.com/v3${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function lookupYelpBusiness(input: {
  query: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const apiKey = yelpApiKey();
  if (!apiKey) return null;

  const { term, location } = splitTermAndLocation(input.query);
  const searchParams = new URLSearchParams({
    term,
    limit: "1",
    sort_by: "best_match",
  });
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    searchParams.set("latitude", String(input.latitude));
    searchParams.set("longitude", String(input.longitude));
  } else if (location) {
    searchParams.set("location", location);
  } else {
    return null;
  }

  const search = await fetchYelpJson<{ businesses?: YelpBusiness[] }>(
    `/businesses/search?${searchParams.toString()}`,
    apiKey,
  );
  const business = search?.businesses?.[0];
  if (!business?.id) return null;

  const details = await fetchYelpJson<YelpBusiness>(
    `/businesses/${business.id}`,
    apiKey,
  );
  if (!details?.id) return null;
  const reviews = await fetchYelpJson<{ reviews?: YelpReview[] }>(
    `/businesses/${business.id}/reviews`,
    apiKey,
  );

  const evidence = [
    createEvidenceItem({
      sourceType: "yelp",
      title: "Yelp business listing",
      url: details.url,
      snippet: `${details.name}. ${details.location?.display_address?.join(", ") ?? ""}. Yelp rating ${details.rating ?? "unknown"} from ${details.review_count ?? 0} reviews.`,
      confidence: "medium",
    }),
    ...((reviews?.reviews ?? []).slice(0, 2).map((review, index) =>
      createEvidenceItem({
        sourceType: "yelp",
        title: `Yelp review excerpt ${index + 1}`,
        url: review.url,
        snippet:
          review.text ??
          `Yelp returned a review excerpt rated ${review.rating ?? "unknown"}.`,
        confidence: "medium",
      }),
    ) ?? []),
  ];

  return {
    businessId: details.id,
    name: details.name,
    address: details.location?.display_address?.join(", ") ?? null,
    phone: details.display_phone ?? details.phone ?? null,
    url: details.url ?? null,
    categories:
      details.categories
        ?.map((category) => category.title ?? category.alias)
        .filter((value): value is string => Boolean(value)) ?? [],
    evidence,
    raw: details,
  } satisfies YelpResult;
}
