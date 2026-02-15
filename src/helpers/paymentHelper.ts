import crypto from "crypto";
import Payment from "../models/paymentModel.js";
import { PaystackEventData } from "../interface/allInterfaces.js";

// Helper function to generate unique donation IDs
export const generatePaymentID = () =>
  "ENF-" + Math.random().toString(36).substring(2, 10).toUpperCase();

export const generateReference = (prefix = "ps") => {
  const unique = crypto.randomBytes(12).toString("hex"); // 12-char random string
  return `${prefix}_${unique}`;
};

export const handleChargeSuccess = async (eventData: PaystackEventData) => {
  let payment = null;

  try {
    payment = await Payment.findOne({
      transactionRef: eventData.reference,
    });

    if (!payment) {
      console.log(
        "Payent not found for this transaction reference:",
        eventData.reference,
      );
      throw new Error("Payent not found");
    }

    payment.date = new Date(eventData.paid_at);
    payment.paymentStatus = "Completed";
    await payment.save();

    // Send notification email
    //     await sendDonationAcknowledgement(donation)
  } catch (error: any) {
    console.error("Error updating successful payment:", error.message);
  }

  return payment;
};

export const handleChargeFailed = async (eventData: PaystackEventData) => {
  console.log("Charge failed or was abandoned for ref:", eventData.reference);

  const payment = await Payment.findOne({
    transactionRef: eventData.reference,
  });

  if (payment && payment.paymentStatus === "Pending") {
    payment.paymentStatus = "Failed";
    await payment.save();
    console.log(`Payment ${eventData.reference} marked Failed.`);
  }
};
