import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const coversationSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "senderRole",
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["Mentor", "Mentee"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  },
);

const discussionSchema = new Schema(
  {
    submission: {
      type: Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
    },
    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
    },
    mentee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: [coversationSchema],
  },
  { timestamps: true },
);

export type Discussion = InferSchemaType<typeof discussionSchema>;
export type DiscussionDocument = HydratedDocument<Discussion>;

const Discussion = model<Discussion>("Discussion", discussionSchema);

export default Discussion;
