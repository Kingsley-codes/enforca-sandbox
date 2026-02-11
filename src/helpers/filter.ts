// src/utils/sessionDateFilter.ts

export type DateFilter = "daily" | "weekly" | "monthly" | undefined;

export const buildDateFilter = (filter?: DateFilter) => {
  if (!filter) return undefined;

  const now = new Date();

  let start: Date;
  let end: Date;

  if (filter === "daily") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);

    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "weekly") {
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)

    start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    return undefined;
  }

  return {
    $gte: start,
    $lte: end,
  };
};

export const buildSessionTimezoneMatch = (filter?: DateFilter) => {
  if (!filter) return null;

  if (filter === "daily") {
    return {
      $expr: {
        $eq: [
          {
            $dateTrunc: {
              date: "$date",
              unit: "day",
              timezone: "$timezone",
            },
          },
          {
            $dateTrunc: {
              date: "$$NOW",
              unit: "day",
              timezone: "$timezone",
            },
          },
        ],
      },
    };
  }

  if (filter === "weekly") {
    return {
      $expr: {
        $eq: [
          {
            $dateTrunc: {
              date: "$date",
              unit: "week",
              timezone: "$timezone",
            },
          },
          {
            $dateTrunc: {
              date: "$$NOW",
              unit: "week",
              timezone: "$timezone",
            },
          },
        ],
      },
    };
  }

  if (filter === "monthly") {
    return {
      $expr: {
        $eq: [
          {
            $dateTrunc: {
              date: "$date",
              unit: "month",
              timezone: "$timezone",
            },
          },
          {
            $dateTrunc: {
              date: "$$NOW",
              unit: "month",
              timezone: "$timezone",
            },
          },
        ],
      },
    };
  }

  return null;
};
