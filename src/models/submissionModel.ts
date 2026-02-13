import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const discussionSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "senderRole",
    },
    senderRole: {
      type: String,
      required: true,
      enum: ["Mentor", "User"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

const submissionSchema = new Schema({
  assignment: {
    type: Schema.Types.ObjectId,
    ref: "Assignment",
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
  title: {
    type: String,
    required: true,
  },
  submissionNotes: {
    type: String,
    required: true,
  },
  submissionDate: {
    type: Date,
    required: true,
  },
  submittedFiles: [
    {
      fileName: String,
      url: String,
      publicId: String,
      _id: false,
    },
  ],
  submittedLinks: [
    {
      linkName: String,
      url: String,
      _id: false,
    },
  ],
  grade: {
    type: Number,
  },
  gradeDate: {
    type: Date,
  },
  mentorFeedback: {
    type: String,
  },
});

export type Submission = InferSchemaType<typeof submissionSchema>;
export type SubmissionDocument = HydratedDocument<Submission>;

const Submission = model<Submission>("Submission", submissionSchema);

export default Submission;
