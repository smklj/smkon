export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret?: string;
};

export type MercadoPagoPayer = {
  email: string;
  first_name?: string;
  last_name?: string;
  identification?: {
    type: string;
    number: string;
  };
};

export type MercadoPagoPaymentItem = {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number; // In BRL, e.g. 19.90
  currency_id?: string;
};

export type MercadoPagoPixResponse = {
  id: number | string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_detail?: string;
  qr_code: string;
  qr_code_base64: string;
  ticket_url?: string;
  date_of_expiration?: string;
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};
