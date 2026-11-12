import rawCatalog from "./featureCatalog.json";

interface FeatureDefinition {
  key: string;
  labelKey: string;
  rpcs: string[];
  tables: string[];
  writeTables: string[];
  functions: string[];
  storageBuckets: string[];
}
const catalog: FeatureDefinition[] = rawCatalog;

export const FEATURE_CATALOG = catalog;

export function modalFeatures(modal: string): string[] {
  if (modal === "prepare") return ["world-map", "enter-area"];
  return catalog.some(feature => feature.key === modal) ? [modal] : [];
}

// Shared data (profile, wallet, equipment, fish catalog) remains readable by
// other features. Mutations and feature-specific reads are gated centrally.
export function requestFeatures(url: URL, method: string): string[] {
  const verb = method.toUpperCase();
  if (verb === "OPTIONS") return [];
  const rest = url.pathname.split("/rest/v1/")[1]?.replace(/\/+$/, "");
  const edge = url.pathname.split("/functions/v1/")[1]?.split("/")[0];
  const storagePath = url.pathname.split("/storage/v1/object/")[1];
  // Signed URL creation/listing uses POST too, but only reads existing assets.
  const storage = storagePath && !/^(?:sign|list|info|authenticated|public)(?:\/|$)/.test(storagePath)
    ? storagePath.split("/")[0] : undefined;
  return catalog.filter(feature => {
    if (rest?.startsWith("rpc/")) return feature.rpcs.includes(rest.slice(4));
    if (rest) return feature.tables.includes(rest) ||
      (!["GET", "HEAD"].includes(verb) && feature.writeTables.includes(rest));
    return (edge && feature.functions.includes(edge)) ||
      (storage && !["GET", "HEAD"].includes(verb) && feature.storageBuckets.includes(storage));
  }).map(feature => feature.key);
}
