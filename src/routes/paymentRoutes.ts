import express from "express";
import {
  handleWebhook,
  initializePayment,
  verifyPayment,
} from "../controllers/paymentController.js";

const paymentRouter = express.Router();

paymentRouter.post("/clane/payment", initializePayment);
paymentRouter.get("/clane/verify/:reference", verifyPayment);
paymentRouter.post("/clane/webhook", handleWebhook);

export default paymentRouter;
