export interface FeatureDefinition {
  key: string;
  labelKey: string;
  rpcs: string[];
  tables: string[];
  writeTables: string[];
  functions: string[];
  storageBuckets: string[];
}
