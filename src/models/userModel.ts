import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";
import validator from "validator";

const sessionSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    title: {
      type: String,
    },
    attendance: {
      type: String,
      enum: ["attended", "pending", "missed"],
      default: "pending",},
    date: {
      type: Date,
    },
  },
  { _id: false },
);

const userSchema = new Schema(
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
    isPremium: {
      type: Boolean,
      default: false,
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
    assignedStatus: {
      type: String,
      enum: ["assigned", "unassigned"],
      default: "unassigned",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    totalAttendance: {
      type: Number,
      default: 0,
    },
    aveGrade: {
      type: Number,
      default: 0,
    },
    course: {
      type: String,
      enum: [
        "frontend",
        "backend",
        "product-management",
        "AI-courses",
        "quality-assurance",
        "scrum",
      ],
      index: true,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    unusedCoins: {
      type: Number,
      default: 3000,
    },
    totalCoinsSpent: {
      type: Number,
      default: 0,
    },
    suspendReason: {
      type: String,
    },
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,    
    },
    address: {
      type: String,
    },
    sessions: [sessionSchema],
    gender: {
      type: String,
      enum: ["male", "female"],
    },
  },
  { timestamps: true },
);

userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ isVerified: 1, createdAt: -1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

const User = model("User", userSchema);

export default User;
