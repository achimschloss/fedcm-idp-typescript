export interface IDPMetadata {
  branding: {
    background_color: string;
    color: string;
    icons: {
      url: string;
      size: number;
    }[];
  };
}

export interface IDPMetadataConfig {
  [hostname: string]: IDPMetadata;
}
