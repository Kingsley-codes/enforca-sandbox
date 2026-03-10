import crypto from "crypto";
import Payment, { PaymentDocument } from "../models/paymentModel.js";
import { PaystackEventData } from "../interface/allInterfaces.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";

// Helper function to generate unique donation IDs
export const generatePaymentID = () =>
  "ENF-" + Math.random().toString(36).substring(2, 10).toUpperCase();

export const generateReference = (prefix = "clnx") => {
  const unique = crypto.randomBytes(15).toString("hex"); // 15-char random string
  return `${prefix}_${unique}`;
};

export function buildHash(
  amount: string | number,
  email: string,
  invoiceRequestReference: string,
  secretKey: string,
) {
  const plain = `${amount}|${email}|${invoiceRequestReference}|${secretKey}`;

  const hash = crypto.createHash("sha512").update(plain).digest("hex");

  return hash;
}

export function buildverifyHash(
  invoiceRequestReference: string,
  secretKey: string,
) {
  const plain = `${invoiceRequestReference}|${secretKey}`;

  const hash = crypto.createHash("sha512").update(plain).digest("hex");

  return hash;
}

export const handleChargeSuccess = async (
  eventData: PaystackEventData,
): Promise<PaymentDocument | null> => {
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      // ✅ only one worker can move this payment to Completed
      const payment = await Payment.findOneAndUpdate(
        {
          transactionRef: eventData.invoiceRequestReference,
          paymentStatus: "Pending",
        },
        {
          $set: {
            paymentStatus: "Completed",
            date: new Date(eventData.transactionDate),
          },
        },
        {
          new: true,
          session,
        },
      );

      // already processed OR not found
      if (!payment) return null;

      if (payment.paymentType === "coins") {
        const coinPackages: Record<number, number> = {
          5000: 5000,
          10000: 12000,
          15000: 20000,
          35000: 50000,
          60000: 100000,
        };

        const coinsToAdd = coinPackages[payment.amount] || 0;

        if (coinsToAdd > 0) {
          await Payment.updateOne(
            { _id: payment._id },
            { $set: { coinsAmount: coinsToAdd } },
            { session },
          );

          await User.updateOne(
            { _id: payment.mentee },
            { $inc: { unusedCoins: coinsToAdd } },
            { session },
          );
        }
      } else {
        await User.updateOne(
          { _id: payment.mentee },
          { $set: { isPremium: true } },
          { session },
        );
      }

      return payment;
    });

    return result;
  } catch (error: any) {
    console.error("Error updating successful payment:", error.message);
    throw error;
  } finally {
    session.endSession();
  }
};

export const handleChargeFailed = async (eventData: PaystackEventData) => {
  console.log(
    "Charge failed or was abandoned for ref:",
    eventData.invoiceRequestReference,
  );

  const payment = await Payment.findOne({
    transactionRef: eventData.invoiceRequestReference,
  });

  if (payment && payment.paymentStatus === "Pending") {
    payment.paymentStatus = "Failed";
    await payment.save();
    console.log(`Payment ${eventData.invoiceRequestReference} marked Failed.`);
  }
};
