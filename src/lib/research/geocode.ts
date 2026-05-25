import { createEvidenceItem } from "@/lib/research/evidence";

export type CensusGeocodeResult = {
  matchedAddress: string;
  latitude: number;
  longitude: number;
  evidence: ReturnType<typeof createEvidenceItem>;
};

export async function geocodeAddressWithCensus(
  address: string,
): Promise<CensusGeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  const response = await fetch(
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params.toString()}`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        coordinates?: { x?: number; y?: number };
      }>;
    };
  };
  const match = payload.result?.addressMatches?.[0];
  const longitude = match?.coordinates?.x;
  const latitude = match?.coordinates?.y;

  if (
    !match?.matchedAddress ||
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return null;
  }

  return {
    matchedAddress: match.matchedAddress,
    latitude,
    longitude,
    evidence: createEvidenceItem({
      sourceType: "census",
      title: "U.S. Census geocode match",
      snippet: `Matched address "${match.matchedAddress}" to coordinates ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`,
      confidence: "high",
      url: "https://geocoding.geo.census.gov/",
    }),
  };
}
