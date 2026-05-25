import { createEvidenceItem } from "@/lib/research/evidence";

type GooglePlaceReview = {
  text?: { text?: string };
  rating?: number;
  relativePublishTimeDescription?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: GooglePlaceReview[];
  photos?: Array<{ name?: string }>;
  location?: { latitude?: number; longitude?: number };
  delivery?: boolean;
  takeout?: boolean;
  dineIn?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
};

export type GooglePlacesResult = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  categories: string[];
  location: { latitude: number; longitude: number } | null;
  hours: string[];
  evidence: ReturnType<typeof createEvidenceItem>[];
  raw: GooglePlace;
};

function googleApiKey() {
  const value = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return value || null;
}

export function googleMapsQueryFromUrl(rawInput: string) {
  try {
    const url = new URL(rawInput);
    if (!url.hostname.includes("google.") && !url.hostname.includes("goo.gl")) {
      return null;
    }

    const q = url.searchParams.get("q") ?? url.searchParams.get("query");
    if (q) return q;

    const placePath = url.pathname.split("/place/")[1];
    if (placePath) {
      return decodeURIComponent(placePath.split("/")[0].replaceAll("+", " "));
    }

    return decodeURIComponent(url.pathname.replaceAll("/", " ").replaceAll("+", " ")).trim() || null;
  } catch {
    return null;
  }
}

async function searchGooglePlace(query: string, apiKey: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      languageCode: "en",
      regionCode: "US",
    }),
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { places?: GooglePlace[] };
  return payload.places?.[0] ?? null;
}

async function getGooglePlaceDetails(placeId: string, apiKey: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,googleMapsUri,types,primaryType,primaryTypeDisplayName,rating,userRatingCount,regularOpeningHours,reviews,photos,location,delivery,takeout,dineIn,servesBeer,servesWine,servesCocktails",
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) return null;
  return (await response.json()) as GooglePlace;
}

export async function lookupGooglePlace(query: string) {
  const apiKey = googleApiKey();
  if (!apiKey) return null;

  const searchResult = await searchGooglePlace(query, apiKey);
  if (!searchResult?.id) return null;
  const details = await getGooglePlaceDetails(searchResult.id, apiKey);
  if (!details?.displayName?.text) return null;

  const categories = [
    details.primaryTypeDisplayName?.text,
    ...(details.types ?? []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const serviceFlags = [
    details.delivery ? "delivery" : null,
    details.takeout ? "takeout" : null,
    details.dineIn ? "dine-in" : null,
    details.servesBeer ? "beer" : null,
    details.servesWine ? "wine" : null,
    details.servesCocktails ? "cocktails" : null,
  ].filter(Boolean);
  const listingSnippet = [
    details.formattedAddress,
    details.rating
      ? `Rating ${details.rating} from ${details.userRatingCount ?? 0} Google ratings`
      : null,
    serviceFlags.length > 0 ? `Signals: ${serviceFlags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const evidence = [
    createEvidenceItem({
      sourceType: "google_places",
      title: "Google Places listing",
      url: details.googleMapsUri,
      snippet: listingSnippet || "Google Places returned listing details.",
      confidence: "high",
    }),
    ...(details.reviews ?? []).slice(0, 2).map((review, index) =>
      createEvidenceItem({
        sourceType: "google_places",
        title: `Google review excerpt ${index + 1}`,
        url: details.googleMapsUri ?? undefined,
        snippet:
          review.text?.text ??
          `Google returned a review excerpt rated ${review.rating ?? "unknown"}.`,
        confidence: "medium",
      }),
    ),
  ];

  return {
    placeId: searchResult.id,
    name: details.displayName.text,
    address: details.formattedAddress ?? null,
    phone: details.nationalPhoneNumber ?? null,
    website: details.websiteUri ?? null,
    mapsUrl: details.googleMapsUri ?? null,
    categories,
    location:
      typeof details.location?.latitude === "number" &&
      typeof details.location?.longitude === "number"
        ? {
            latitude: details.location.latitude,
            longitude: details.location.longitude,
          }
        : null,
    hours: details.regularOpeningHours?.weekdayDescriptions ?? [],
    evidence,
    raw: details,
  } satisfies GooglePlacesResult;
}
