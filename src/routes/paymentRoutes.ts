import express from "express";
import {
  handleWebhook,
  initializePayment,
  verifyPayment,
} from "../controllers/paymentController.js";

const paymentRouter = express.Router();

paymentRouter.post("/paystack/payment", initializePayment);
paymentRouter.post("/paystack/verify", verifyPayment);
paymentRouter.post("/paystack/webhook", handleWebhook);

export default paymentRouter;
