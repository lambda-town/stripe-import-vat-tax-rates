export interface APIResponse<T> {
  data: T[];
}

export interface VATSenseRate {
  object: "rate";
  country_code: string;
  country_name: string;
  eu: boolean;
  standard: {
    rate: number;
  };
}