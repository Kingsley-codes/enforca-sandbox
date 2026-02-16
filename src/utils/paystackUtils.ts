import axios from "axios";
import {
  PaystackInitializeResponse,
  PaystackInitializeTransactionPayload,
} from "../interface/allInterfaces.js";

if (!process.env.PAYSTACK_SECRET_KEY) {
  throw new Error("PAYSTACK_SECRET_KEY is not set");
}

const clane = axios.create({
  ...(process.env.CLANE_BASE_URL && {
    baseURL: process.env.CLANE_BASE_URL,
  }),
  headers: {
    "x-business-id": `${process.env.CLANE_BUSINESS_ID}`,
    "Content-Type": "application/json",
  },
});

export const initializePaystackTransaction = async (
  transactionData: PaystackInitializeTransactionPayload,
) => {
  try {
    const response = await clane.post<{
      status: boolean;
      message: string;
      data: PaystackInitializeResponse;
    }>("/", transactionData);

    // Return consistent format
    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data,
    };
  } catch (error: any) {
    console.error(
      "Clane initialize transaction error:",
      error.response?.data || error.message,
    );

    // Return consistent error format
    return {
      status: false,
      message: error.response?.data?.message || error.message,
      error: error.response?.data,
    };
  }
};

export const verifyTransaction = async (reference: string, hash: string) => {
  const response = await clane.get(`/${reference}?hash=${hash}`);
  return response.data;
};
