export interface InformationModalField {
  label: string;
  value: string;
}

export interface InformationModalContent {
  name: string;
  image?: string;
  icon?: string;
  description: string;
  itemDetails?: {
    badges: string[];
    stats: InformationModalField[];
    metadata: InformationModalField[];
  };
}
