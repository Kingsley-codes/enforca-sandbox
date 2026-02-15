import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const PaymentSchema = new Schema(
  {
    mentee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentID: {
      type: String,
      required: true,
      unique: true,
    },
    menteeEmail: {
      type: String,
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["coins", "premium"],
      default: "coins",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    transactionRef: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Refunded", "Completed", "Cancelled", "Failed"],
      default: "Pending",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export type Payment = InferSchemaType<typeof PaymentSchema>;
export type PaymentDocument = HydratedDocument<Payment>;

const Payment = model<Payment>("Payment", PaymentSchema);

export default Payment;
