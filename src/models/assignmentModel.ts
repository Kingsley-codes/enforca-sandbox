import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const assignmentSchema = new Schema(
  {
    mentor: {
      type: Schema.Types.ObjectId,
      ref: "Mentor",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    week: {
      type: Number,
      required: function () {
        return this.category === "task";
      },
    },
    mentees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    resourcesLinks: [
      {
        filename: String,
        url: String,
        _id: false,
      },
    ],
    resourcesAttachments: [
      {
        filename: String,
        url: String,
        publicId: String,
        _id: false,
      },
    ],
    category: {
      type: String,
      enum: ["task", "project"],
      required: true,
    },
    course: {
      type: String,
      required: true,
    },
    dueTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "overdue", "completed", "graded"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

export type Assgnment = InferSchemaType<typeof assignmentSchema>;
export type AssignmentDocument = HydratedDocument<Assgnment>;

const Assignment = model<Assgnment>("Assignment", assignmentSchema);

export default Assignment;
