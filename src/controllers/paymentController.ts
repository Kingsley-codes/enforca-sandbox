import { Request, response, Response } from "express";
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
import Payment from "../models/paymentModel.js";
import crypto from "crypto";

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

    // Call Paystack Verify API
    const verificationResponse = await verifyTransaction(reference, hash);

    if (!verificationResponse.status) {
      return res.status(400).json({
        success: false,
        message: "Transaction verification failed",
        error: verificationResponse.message,
      });
    }

    const transactionData = verificationResponse.data;

    // Find donation record by transactionRef
    const payment = await Payment.findOne({ transactionRef: reference });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // If failed → mark failed
    if (transactionData.status === "FAILED") {
      payment.paymentStatus = "Failed";
      await payment.save();

      return res.status(404).json({
        success: false,
        message: "Payment failed",
      });
    }

    // ✅ Only proceed if Paystack says it's successful
    if (transactionData.status === "SUCCESS") {
      if (payment.paymentStatus === "Completed") {
        // ✅ Handle second verification attempt gracefully
        return res.status(200).json({
          success: true,
          message: "Transaction already verified",
          data: {
            paymentID: payment.paymentID,
            menteeEmail: payment.menteeEmail,
            amount: payment.amount,
            paymentType: payment.paymentType,
          },
        });
      }
      payment.paymentStatus = "Completed";
      payment.date = new Date();

      await payment.save();

      const mentee = await User.findById(payment.mentee);

      if (!mentee) {
        console.log("Mentee not found with the userId:", payment.mentee);

        throw new Error("Mentee not found");
      }

      let paymentType = payment.paymentType;

      if (paymentType === "coins") {
        switch (payment.amount) {
          case 5000:
            mentee.unusedCoins = mentee.unusedCoins + 5000;
            break;

          case 10000:
            mentee.unusedCoins = mentee.unusedCoins + 12000;
            break;

          case 15000:
            mentee.unusedCoins = mentee.unusedCoins + 20000;
            break;

          case 35000:
            mentee.unusedCoins = mentee.unusedCoins + 50000;
            break;

          case 60000:
            mentee.unusedCoins = mentee.unusedCoins + 100000;
            break;

          default:
            console.log("unhandled amount type:", payment.amount);
        }

        await mentee.save();
      } else {
        console.log("Payment type is:", paymentType);
        mentee.isPremium = true;
        await mentee.save();
      }

      return res.status(200).json({
        success: true,
        message: "Transaction verified successfully",
        data: {
          paymentID: payment.paymentID,
          menteeEmail: payment.menteeEmail,
          amount: payment.amount,
          paymentType: paymentType,
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Transaction not successful",
      status: transactionData.status,
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
