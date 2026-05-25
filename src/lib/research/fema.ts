import { createEvidenceItem } from "@/lib/research/evidence";

const SPECIAL_FLOOD_ZONES = new Set([
  "A",
  "A99",
  "AE",
  "AH",
  "AO",
  "AR",
  "V",
  "VE",
]);

export type FemaFloodResult = {
  zone: string | null;
  subType: string | null;
  isSpecialFloodHazardArea: boolean;
  evidence: ReturnType<typeof createEvidenceItem>;
};

export async function lookupFemaFloodZone(
  latitude: number,
  longitude: number,
): Promise<FemaFloodResult | null> {
  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH,SOURCE_CIT",
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetch(
    `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${params.toString()}`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    features?: Array<{
      attributes?: {
        FLD_ZONE?: string;
        ZONE_SUBTY?: string;
        SFHA_TF?: string;
        STATIC_BFE?: number;
        DEPTH?: number;
        SOURCE_CIT?: string;
      };
    }>;
  };
  const attributes = payload.features?.[0]?.attributes;
  if (!attributes) return null;

  const zone = attributes.FLD_ZONE ?? null;
  const isSpecialFloodHazardArea =
    attributes.SFHA_TF === "T" || (zone !== null && SPECIAL_FLOOD_ZONES.has(zone));
  const detailBits = [
    zone ? `Zone ${zone}` : null,
    attributes.ZONE_SUBTY ? attributes.ZONE_SUBTY : null,
    attributes.STATIC_BFE && attributes.STATIC_BFE > 0
      ? `BFE ${attributes.STATIC_BFE}`
      : null,
  ].filter(Boolean);

  return {
    zone,
    subType: attributes.ZONE_SUBTY ?? null,
    isSpecialFloodHazardArea,
    evidence: createEvidenceItem({
      sourceType: "fema",
      title: "FEMA NFHL flood lookup",
      snippet: detailBits.join("; ") || "FEMA returned flood map data for the location.",
      confidence: "high",
      url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
    }),
  };
}
