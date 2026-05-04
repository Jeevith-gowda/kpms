export interface FilterDates {
  previousFilterChangeDate: Date | null;
  nextFilterChangeDate: Date;
  quarterKey: string;
  dueMonthKey: string;
}

export function calculateFilterDates(leaseStartDate: Date, referenceDate?: Date): FilterDates {
  const now = referenceDate ?? new Date();
  const start = new Date(leaseStartDate);

  // Find the next due date on or after today
  let candidate = new Date(start);

  // Advance by 3-month increments until we're >= today's month start
  const todayMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  while (candidate < todayMonthStart) {
    candidate = new Date(candidate);
    candidate.setMonth(candidate.getMonth() + 3);
  }

  const nextFilterChangeDate = candidate;

  const previousFilterChangeDate = new Date(nextFilterChangeDate);
  previousFilterChangeDate.setMonth(previousFilterChangeDate.getMonth() - 3);

  const year = nextFilterChangeDate.getFullYear();
  const month = nextFilterChangeDate.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  const quarterKey = `${year}-Q${quarter}`;
  const dueMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return {
    previousFilterChangeDate:
      previousFilterChangeDate < start ? null : previousFilterChangeDate,
    nextFilterChangeDate,
    quarterKey,
    dueMonthKey,
  };
}

export function isDueThisMonth(nextFilterChangeDate: Date, referenceDate?: Date): boolean {
  const now = referenceDate ?? new Date();
  return (
    nextFilterChangeDate.getFullYear() === now.getFullYear() &&
    nextFilterChangeDate.getMonth() === now.getMonth()
  );
}

export function getNextReminderDate(
  lastSentAt: Date,
  frequency: string
): Date {
  const next = new Date(lastSentAt);
  switch (frequency) {
    case "EVERY_DAY":
      next.setDate(next.getDate() + 1);
      break;
    case "EVERY_2_DAYS":
      next.setDate(next.getDate() + 2);
      break;
    case "EVERY_3_DAYS":
      next.setDate(next.getDate() + 3);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

export function detectFilterChanged(text: string): { detected: boolean; confidence: number; interpretedStatus: "CHANGED" | "NOT_CHANGED" | "AMBIGUOUS" } {
  const lower = text.toLowerCase().trim();
  
  const negativePhrases = ["not yet", "will do it", "tomorrow", "later", "soon", "this weekend", "no"];
  for (const phrase of negativePhrases) {
    if (lower.includes(phrase)) {
      return { detected: false, confidence: 0.9, interpretedStatus: "NOT_CHANGED" };
    }
  }

  const positivePhrases = [
    "changed", "done", "completed", "i changed it", "filter replaced",
    "filter changed", "replaced", "finished", "all done", "complete", "yes"
  ];
  for (const phrase of positivePhrases) {
    if (lower.includes(phrase)) {
      return { detected: true, confidence: 0.9, interpretedStatus: "CHANGED" };
    }
  }

  const ambiguousPhrases = ["ok", "okay", "thanks", "got it", "acknowledged", "sure"];
  for (const phrase of ambiguousPhrases) {
    if (lower.includes(phrase)) {
      return { detected: false, confidence: 0.5, interpretedStatus: "AMBIGUOUS" };
    }
  }

  return { detected: false, confidence: 0.1, interpretedStatus: "AMBIGUOUS" };
}
