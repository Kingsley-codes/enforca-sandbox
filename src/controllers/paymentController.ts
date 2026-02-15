import { Request, response, Response } from "express";
import User from "../models/userModel.js";
import {
  generatePaymentID,
  generateReference,
  handleChargeFailed,
  handleChargeSuccess,
} from "../helpers/paymentHelper.js";
import {
  initializePaystackTransaction,
  verifyTransaction,
} from "../utils/paystackUtils.js";
import Payment from "../models/paymentModel.js";
import crypto from "crypto";

export const initializePayment = async (req: Request, res: Response) => {
  try {
    const { menteeId, menteeEmail, paymentType, amount } = req.body;

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

    const menteeName = mentee.firstName + "" + mentee.lastName;

    const amountKobo = Math.round(Number(amount) * 100);

    const paymentID = generatePaymentID();

    const transactionData = {
      email: menteeEmail,
      amount: amountKobo,
      reference: generateReference(),
      metadata: {
        mentee_id: mentee,
        mentee_name: menteeName,
        mentee_email: menteeEmail,
        payment_type: paymentType,
        amount: amount,
        payment_id: paymentID,
        custom_fields: [
          {
            display_name: "Mentee Name",
            variable_name: "mentee_name",
            value: menteeName,
          },
          {
            display_name: "Payment Type",
            variable_name: "payment_type",
            value: paymentType,
          },
          {
            display_name: "Amount",
            variable_name: "amount",
            value: amount,
          },
        ],
      },

      callback_url: `${process.env.FRONTEND_URL}/donors/verifyPayment`,
      // callback_url: "http://localhost:3000/donors/verifyPayment"
    };

    // Call Paystack API
    const paystackResponse =
      await initializePaystackTransaction(transactionData);

    if (!paystackResponse.status || !("data" in paystackResponse)) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize transaction",
        error: paystackResponse.message,
        reference: transactionData.reference,
      });
    }

    const payment = await Payment.create({
      mentee: menteeId,
      paymentID: paymentID,
      menteeEmail: menteeEmail,
      paymentType: paymentType,
      amount: amount,
      transactionRef: paystackResponse.data.reference,
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Transaction initialized successfully",
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference,
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
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Transaction reference is required",
      });
    }

    // Call Paystack Verify API
    const verificationResponse = await verifyTransaction(reference);

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

    // If cancelled already, don't proceed
    if (payment.paymentStatus === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Transaction was already marked as cancelled",
        status: payment.paymentStatus,
      });
    }

    // If failed → mark failed
    if (transactionData.status === "failed") {
      payment.paymentStatus = "Failed";
      await payment.save();

      return res.status(404).json({
        success: false,
        message: "Payment failed",
      });
    }

    // ✅ Only proceed if Paystack says it's successful
    if (transactionData.status === "success") {
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

      return res.status(200).json({
        success: true,
        message: "Transaction verified successfully",
        data: {
          paymentID: payment.paymentID,
          menteeEmail: payment.menteeEmail,
          amount: payment.amount,
          paymentType: payment.paymentType,
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
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(400).send("No signature");
    }

    if (!secret) {
      return res.status(500).send("Paystack secret key not configured");
    }

    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      return res.status(400).send("Invalid signature");
    }

    const event = req.body;
    const eventData = event.data;

    console.log(`Received Webhook Event: ${event.event}`, eventData.reference);

    // Acknowledge receipt immediately to prevent Paystack retries
    res.sendStatus(200);

    // Process the event asynchronously after acknowledging
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event.data);
        break;

      case "charge.failed":
      case "charge.abandoned":
        await handleChargeFailed(event.data);
        break;

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return res;
  } catch (error) {
    // IMPORTANT: We already sent a 200, so we can only log the error.
    console.error("Error in async webhook processing:", error);

    // If something fails before we sent 200
    return res.status(500).send("Webhook processing error");
  }
};
