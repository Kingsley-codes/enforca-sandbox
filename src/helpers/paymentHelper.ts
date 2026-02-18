import crypto from "crypto";
import Payment from "../models/paymentModel.js";
import { PaystackEventData } from "../interface/allInterfaces.js";
import User from "../models/userModel.js";

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

export const handleChargeSuccess = async (eventData: PaystackEventData) => {
  let payment = null;

  try {
    payment = await Payment.findOne({
      transactionRef: eventData.invoiceRequestReference,
    });

    if (!payment) {
      console.log(
        "Payent not found for this transaction reference:",
        eventData.invoiceRequestReference,
      );
      throw new Error("Payent not found");
    }

    payment.date = new Date(eventData.transactionDate);
    payment.paymentStatus = "Completed";
    await payment.save();

    const mentee = await User.findById(payment.mentee);

    if (!mentee) {
      console.log("Mentee not found with the userId:", payment.mentee);

      throw new Error("Mentee not found");
    }

    let paymentType = payment.paymentType;

    if ((paymentType = "coins")) {
      mentee.unusedCoins += 5000;
      await mentee.save();
    } else {
      mentee.isPremium = true;
      await mentee.save();
    }

    // Send notification email
    //     await sendDonationAcknowledgement(donation)
  } catch (error: any) {
    console.error("Error updating successful payment:", error.message);
  }

  return payment;
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
