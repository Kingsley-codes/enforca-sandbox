import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const fileAttachmentsSchema = new Schema(
  {
    filename: { type: String },
    url: { type: String },
    publicId: { type: String },
  },
  { _id: false },
);

const sessionSchema = new Schema(
  {
    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      required: true,
    },
    meetingLink: {
      type: String,
      required: true,
    },
    objectives: [
      {
        type: String,
        required: true,
      },
    ],
    course: {
      type: String,
      required: true,
    },
    attendees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    notes: {
      type: String,
    },
    fileAttachments: [fileAttachmentsSchema],
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ mentor: 1, date: 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<Session>;

const Session = model("Session", sessionSchema, "mentor_sessions");

export default Session;
