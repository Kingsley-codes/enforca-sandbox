import { Types } from "mongoose";
import Discussion from "../models/discussionsModel.js";

type UserType = "mentee" | "mentor";

export interface SendDiscussionMessageInput {
  discussionId: string;
  userId: string | Types.ObjectId;
  userType: UserType;
  message: string;
}

export const sendDiscussionMessage = async ({
  discussionId,
  userId,
  userType,
  message,
}: SendDiscussionMessageInput) => {
  try {
    const discussion = await Discussion.findById(discussionId);
    if (!discussion) throw new Error("Discussion not found");

    // Permission check
    if (userType === "mentee") {
      if (!discussion.mentee?.equals(userId)) {
        throw new Error("Unauthorized");
      }
    }

    if (userType === "mentor") {
      if (!discussion.mentor?.equals(userId)) {
        throw new Error("Admin not assigned to this ticket");
      }
    }

    const newMessage = {
      senderRole: userType,
      sender: new Types.ObjectId(userId),
      message,
    };

    discussion.conversation.push(newMessage);

    await discussion.save();

    return discussion.conversation.at(-1);
  } catch (error) {
    console.error("sendDiscussionMessage error:", error);
    throw error;
  }
};
