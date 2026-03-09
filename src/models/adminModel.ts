import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";
import validator from "validator";

const adminSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      sparse: true,
      trim: true,
      validator: function (value: string) {
        // Allow empty phone numbers (since sparse: true)
        if (!value) return true;
        return validator.isMobilePhone(value, "any");
      },
    },
    password: {
      type: String,
      minlength: 8,
    },
    profilePhoto: {
      publicId: { type: String },
      url: { type: String },
    },
  },
  { timestamps: true },
);

export type Admin = InferSchemaType<typeof adminSchema>;

export type AdminDocument = HydratedDocument<Admin>;

const Admin = model<Admin>("Admin", adminSchema);

export default Admin;
