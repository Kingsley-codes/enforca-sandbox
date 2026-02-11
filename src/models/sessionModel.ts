import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const sessionSchema = new Schema(
  {
    mentorId: {
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
    fileAttachments: [
      {
        filename: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ mentorId: 1, date: 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<Session>;

const Session = model("Session", sessionSchema);

export default Session;
