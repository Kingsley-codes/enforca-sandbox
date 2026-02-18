import cron from "node-cron";
import Assignment from "../models/assignmentModel.js";

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
