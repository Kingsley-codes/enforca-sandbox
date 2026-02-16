export interface LoginRequestBody {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterRequestBody {
  firstName: string;
  lastName: string;
  course: string;
  email: string;
  password: string;
  phoneNumber: string;
}

export interface AuthResponse {
  status: "success" | "fail" | "error";
  message?: string;
  data?: {
    admin?: any;
  };
  details?: string;
  stack?: string;
}

export interface PaystackInitializeTransactionPayload {
  email: string;
  amount: number; // in kobo
  invoiceRequestReference: string;
  description: string;
  firstName: string;
  lastName: string;
  hash: string;
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
    };
  };
}

export interface PaystackEventData {
  reference: string;
  paid_at: string; // ISO date string
}

// export const verifyTransaction = async (reference: string) => {
//   const response = await paystack.get<PaystackVerifyResponse>(
//     `/transaction/verify/${reference}`,
//   );

//   return response.data;
// };
