export type MelhorEnvioCalculateParams = {
  originPostalCode: string;
  destinationPostalCode: string;
  items: Array<{
    id: string;
    width: number; // cm
    height: number; // cm
    length: number; // cm
    weight: number; // kg
    insurance_value: number; // R$
    quantity: number;
  }>;
  accessToken?: string;
  isSandbox?: boolean;
};

export type ShippingOption = {
  serviceId: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryDays: number;
  description?: string;
  currency: string;
};
