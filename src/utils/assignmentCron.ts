import cron from "node-cron";
import Assignment from "../models/assignmentModel.js";
import Session from "../models/sessionModel.js";

/**
 * Helper: build a real JS Date from assignment.dueDate + assignment.dueTime
 * dueTime is assumed to be in "HH:mm" format (e.g. "14:30")
 */
function buildDueDateTime(dueDate: Date, dueTime: string) {
  const [hour, minute] = dueTime.split(":").map(Number);

  const d = new Date(dueDate);
  d.setHours(hour || 0, minute || 0, 0, 0);

  return d;
}

/**
 * Runs every hour
 */
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();

    // Only pull assignments that still have at least one "assigned" mentee
    const assignments = await Assignment.find({
      "mentees.status": "assigned",
    }).select("_id dueDate dueTime");

    const overdueAssignmentIds: string[] = [];

    for (const assignment of assignments) {
      const dueAt = buildDueDateTime(assignment.dueDate, assignment.dueTime);

      if (now > dueAt) {
        overdueAssignmentIds.push(assignment._id.toString());
      }
    }

    if (!overdueAssignmentIds.length) {
      return;
    }

    /**
     * Update ONLY mentees with status === "assigned"
     */
    const result = await Assignment.updateMany(
      {
        _id: { $in: overdueAssignmentIds },
        "mentees.status": "assigned",
      },
      {
        $set: {
          "mentees.$[m].status": "overdue",
        },
      },
      {
        arrayFilters: [{ "m.status": "assigned" }],
      },
    );

    console.log(
      `[cron] Overdue check complete. Modified assignments: ${result.modifiedCount}`,
    );
  } catch (err) {
    console.error("[cron] Overdue assignment check failed:", err);
  }
});

function buildSessionDateTime(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);

  const d = new Date(date);
  d.setHours(hour || 0, minute || 0, 0);

  return d;
}

/**
 * Runs every hour
 */
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();

    const sessions = await Session.find({
      status: "pending",
    }).select("_id date time");

    const doneSessionIds: string[] = [];

    for (const session of sessions) {
      const sessionDateTime = buildSessionDateTime(session.date, session.time);

      if (now > sessionDateTime) {
        doneSessionIds.push(session._id.toString());
      }
    }

    if (!doneSessionIds.length) {
      return;
    }

    const result = await Session.updateMany(
      {
        _id: { $in: doneSessionIds },
        status: "pending",
      },
      {
        $set: { status: "done" },
      },
    );

    console.log(
      `[cron] Session status update complete. Modified sessions: ${result.modifiedCount}`,
    );
  } catch (error: any) {
    console.error("[cron] Session status update failed:", error);
  }
});
