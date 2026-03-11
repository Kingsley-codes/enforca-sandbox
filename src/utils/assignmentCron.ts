import cron from "node-cron";
import Assignment from "../models/assignmentModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";


/**
 * Assignment status update: assigned -> overdue
 * Runs every hour
 */
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();

    // 1️⃣ Find overdue assignments directly in MongoDB
    const assignments = await Assignment.aggregate([
      {
        $match: {
          "mentees.status": "assigned",
        },
      },
      {
        $addFields: {
          dueDateTime: {
            $dateFromString: {
              dateString: {
                $concat: [
                  { $dateToString: { format: "%Y-%m-%d", date: "$dueDate" } },
                  "T",
                  "$dueTime",
                  ":00",
                ],
              },
            },
          },
        },
      },
      {
        $match: {
          dueDateTime: { $lt: now },
        },
      },
      {
        $project: { _id: 1 },
      },
    ]);

    const overdueAssignmentIds = assignments.map((a) => a._id);

    if (!overdueAssignmentIds.length) return;

    // 2️⃣ Update only mentees whose status is still "assigned"
    const result = await Assignment.updateMany(
      {
        _id: { $in: overdueAssignmentIds },
      },
      {
        $set: {
          "mentees.$[m].status": "overdue",
        },
      },
      {
        arrayFilters: [{ "m.status": "assigned" }],
      }
    );

    console.log(
      `[cron] Overdue check complete. Modified assignments: ${result.modifiedCount}`
    );
  } catch (err) {
    console.error("[cron] Overdue assignment check failed:", err);
  }
});



/**
 * Session status update: pending -> done
 * Runs every hour
 */
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();

    // 1️⃣ Find sessions already past
    const sessions = await Session.aggregate([
      {
        $match: { status: "pending" }
      },
      {
        $addFields: {
          sessionDateTime: {
            $dateFromString: {
              dateString: {
                $concat: [
                  { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                  "T",
                  "$time",
                  ":00"
                ]
              }
            }
          }
        }
      },
      {
        $match: {
          sessionDateTime: { $lt: now }
        }
      },
      {
        $project: { _id: 1 }
      }
    ]);

    const doneSessionIds = sessions.map((s) => s._id);

    if (!doneSessionIds.length) return;

    // 2️⃣ Mark sessions done
    const sessionResult = await Session.updateMany(
      { _id: { $in: doneSessionIds } },
      { $set: { status: "done" } }
    );

    // 3️⃣ Mark missed attendance
    const userResult = await User.updateMany(
      { "sessions.session": { $in: doneSessionIds } },
      {
        $set: {
          "sessions.$[elem].attendance": "missed"
        }
      },
      {
        arrayFilters: [
          {
            "elem.session": { $in: doneSessionIds },
            "elem.attendance": "pending"
          }
        ]
      }
    );

    console.log(
      `[cron] Sessions updated: ${sessionResult.modifiedCount}, Missed attendance updated: ${userResult.modifiedCount}`
    );

  } catch (error) {
    console.error("[cron] Session update failed:", error);
  }
});