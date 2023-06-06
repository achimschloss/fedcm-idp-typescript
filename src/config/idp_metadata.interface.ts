export interface IDPMetadata {
  accounts_endpoint: string;
  client_metadata_endpoint: string;
  id_assertion_endpoint: string;
  revocation_endpoint: string;
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
  