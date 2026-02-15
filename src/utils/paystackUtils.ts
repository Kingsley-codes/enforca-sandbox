import axios from "axios";
import {
  PaystackInitializeResponse,
  PaystackInitializeTransactionPayload,
} from "../interface/allInterfaces.js";

if (!process.env.PAYSTACK_SECRET_KEY) {
  throw new Error("PAYSTACK_SECRET_KEY is not set");
}

const paystack = axios.create({
  ...(process.env.PAYSTACK_BASE_URL && {
    baseURL: process.env.PAYSTACK_BASE_URL,
  }),
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

export const initializePaystackTransaction = async (
  transactionData: PaystackInitializeTransactionPayload,
) => {
  try {
    const response = await paystack.post<{
      status: boolean;
      message: string;
      data: PaystackInitializeResponse;
    }>("/transaction/initialize", transactionData);

    // Return consistent format
    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data,
    };
  } catch (error: any) {
    console.error(
      "Paystack initialize transaction error:",
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

export const verifyTransaction = async (reference: string) => {
  const response = await paystack.get(`/transaction/verify/${reference}`);
  return response.data;
};
