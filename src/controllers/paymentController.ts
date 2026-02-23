import { Request, Response } from "express";
import User from "../models/userModel.js";
import {
  buildHash,
  buildverifyHash,
  generatePaymentID,
  generateReference,
  handleChargeFailed,
  handleChargeSuccess,
} from "../helpers/paymentHelper.js";
import {
  initializeClaneTransaction,
  verifyTransaction,
} from "../utils/paystackUtils.js";
import Payment, { PaymentDocument } from "../models/paymentModel.js";
import mongoose from "mongoose";

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const { menteeId, menteeEmail, paymentType, amount, currency } = req.body;

    if (!menteeId || !menteeEmail || !paymentType || !amount) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: menteeId, menteeEmail, paymentType, amount",
      });
    }

    const mentee = await User.findById(menteeId);

    if (!mentee) {
      return res.status(404).json({
        success: false,
        message: "Mentee account not found",
      });
    }

    const paymentID = generatePaymentID();

    const invoiceReference = generateReference();

    const hash = buildHash(
      amount,
      menteeEmail,
      invoiceReference,
      process.env.CLANE_SECRET_KEY!,
    );

    const transactionData = {
      email: menteeEmail,
      amount: amount,
      description: paymentType,
      currency: currency,
      firstName: mentee.firstName,
      lastName: mentee.lastName,
      invoiceRequestReference: invoiceReference,
      hash: hash,
    };

    // Call Paystack API
    const claneResponse = await initializeClaneTransaction(transactionData);

    if (!claneResponse.status || !("data" in claneResponse)) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize transaction",
        error: claneResponse.message,
        reference: invoiceReference,
      });
    }

    const payment = await Payment.create({
      mentee: menteeId,
      paymentID: paymentID,
      menteeEmail: menteeEmail,
      paymentType: paymentType,
      amount: amount,
      currency: currency,
      transactionRef: invoiceReference,
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Transaction initialized successfully",
      data: {
        paymentUrl: claneResponse.data.paymentUrl,
        reference: invoiceReference,
        paymentID: payment.paymentID,
      },
    });
  } catch (error: any) {
    console.log("Error initializing payment:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference as string | undefined;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    const hash = buildverifyHash(reference, process.env.CLANE_SECRET_KEY!);

    const verificationResponse = await verifyTransaction(reference, hash);

    if (!verificationResponse.status) {
      return res.status(400).json({
        success: false,
        message: "Transaction verification failed",
        error: verificationResponse.message,
      });
    }

    const transactionData = verificationResponse.data;

    // ---- Handle failed payment from gateway
    if (transactionData.status === "FAILED") {
      await Payment.updateOne(
        { transactionRef: reference },
        { $set: { paymentStatus: "Failed" } },
      );

      return res.status(400).json({
        success: false,
        message: "Payment failed",
      });
    }

    if (transactionData.status !== "SUCCESS") {
      return res.status(400).json({
        success: false,
        message: "Transaction not successful",
        status: transactionData.status,
      });
    }

    const mongoSession = await mongoose.startSession();

    const updatedPayment = await mongoSession.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
        {
          transactionRef: reference,
          paymentStatus: "Pending",
        },
        {
          $set: {
            paymentStatus: "Completed",
            date: new Date(),
          },
        },
        {
          new: true,
          session: mongoSession,
        },
      );

      if (!payment) return null;

      if (payment.paymentType === "coins") {
        let coinsToAdd = 0;

        switch (payment.amount) {
          case 5000:
            coinsToAdd = 5000;
            break;
          case 10000:
            coinsToAdd = 12000;
            break;
          case 15000:
            coinsToAdd = 20000;
            break;
          case 35000:
            coinsToAdd = 50000;
            break;
          case 60000:
            coinsToAdd = 100000;
            break;
        }

        if (coinsToAdd > 0) {
          await User.updateOne(
            { _id: payment.mentee },
            { $inc: { unusedCoins: coinsToAdd } },
            { session: mongoSession },
          );
        }
      } else {
        await User.updateOne(
          { _id: payment.mentee },
          { $set: { isPremium: true } },
          { session: mongoSession },
        );
      }

      return payment;
    });

    mongoSession.endSession();

    // ---- Nothing was updated inside the transaction
    if (!updatedPayment) {
      const existing = await Payment.findOne({
        transactionRef: reference,
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found",
        });
      }

      // ✅ already processed safely
      if (existing.paymentStatus === "Completed") {
        return res.status(200).json({
          success: true,
          message: "Transaction already verified",
          data: {
            paymentID: existing.paymentID,
            menteeEmail: existing.menteeEmail,
            amount: existing.amount,
            paymentType: existing.paymentType,
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: "Payment is not in a verifiable state",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Transaction verified successfully",
      data: {
        paymentID: updatedPayment.paymentID,
        menteeEmail: updatedPayment.menteeEmail,
        amount: updatedPayment.amount,
        paymentType: updatedPayment.paymentType,
      },
    });
  } catch (error: any) {
    console.error("Verify transaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Handle webhook from Paystack (idempotent, final source of truth)
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const eventData = req.body;

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Empty webhook body",
      });
    }

    console.log("Received Webhook Event:", eventData);

    const status = eventData.status?.toLowerCase();

    // Process the event asynchronously after acknowledging
    switch (status) {
      case "success":
        await handleChargeSuccess(eventData);
        break;

      case "failed":
        await handleChargeFailed(eventData);
        break;

      default:
        console.log(`Unhandled event type: ${eventData}`);
    }

    // Always respond to Clane quickly to prevent retries
    return res.status(200).json({ received: true });
  } catch (error) {
    // IMPORTANT: We already sent a 200, so we can only log the error.
    console.error("Error in async webhook processing:", error);

    // If something fails before we sent 200
    return res.status(500).send("Webhook processing error");
  }
};
