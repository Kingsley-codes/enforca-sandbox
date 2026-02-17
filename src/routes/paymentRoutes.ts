import express from "express";
import {
  handleWebhook,
  initializePayment,
  verifyPayment,
} from "../controllers/paymentController.js";

const paymentRouter = express.Router();

paymentRouter.post("/clane/payment", initializePayment);
paymentRouter.post("/clane/verify", verifyPayment);
paymentRouter.post("/clane/webhook", handleWebhook);

export default paymentRouter;
