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

// utils/dateFilters.ts
export type DateFilterType = "day" | "week" | "month";

export const getDateRange = (
  type: DateFilterType,
  referenceDate: Date = new Date(),
  offset: number = 0,
) => {
  let start: Date;
  let end: Date;
  const ref = new Date(referenceDate);

  switch (type) {
    case "day":
      ref.setDate(ref.getDate() + offset);
      start = new Date(ref);
      start.setHours(0, 0, 0, 0);
      end = new Date(ref);
      end.setHours(23, 59, 59, 999);
      break;

    case "week":
      const dayOfWeek = ref.getDay(); // Sunday = 0
      const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      ref.setDate(ref.getDate() + mondayDiff + offset * 7);
      start = new Date(ref);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;

    case "month":
      const month = ref.getMonth() + offset;
      const year = ref.getFullYear();
      start = new Date(year, month, 1, 0, 0, 0, 0);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      break;

    default:
      throw new Error("Invalid date filter type");
  }

  return { start, end };
};


// Helper function to build date filter
export const buildAdminDateFilter = (dateFilter: string, startDate?: string, endDate?: string) => {
  const now = new Date();
  let filter: any = {};

  if (dateFilter === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    filter = { $gte: start, $lte: now };
  }

  if (dateFilter === "week") {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    filter = { $gte: start, $lte: now };
  }

  if (dateFilter === "month") {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    filter = { $gte: start, $lte: now };
  }

  if (dateFilter === "custom" && startDate && endDate) {
    filter = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  return filter;
};