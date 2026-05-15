/**
 * Settlement system — server-side helpers (uses firebase-admin).
 * All date math is in IST (UTC+5:30). The settlement "day" runs
 * from 7:00 AM IST → next day 7:00 AM IST.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000 ms

/** Returns 'YYYY-MM-DD' string for the current date in IST. */
export function getTodayIST(): string {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const y = nowIST.getUTCFullYear();
    const m = String(nowIST.getUTCMonth() + 1).padStart(2, '0');
    const d = String(nowIST.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Given a settlement date string 'YYYY-MM-DD' (IST), returns the UTC Date
 * objects for the period boundaries:
 *   period_start = previous day 7:00 AM IST  (= prev day 01:30 UTC)
 *   period_end   = settlement date 7:00 AM IST (= settlement date 01:30 UTC)
 */
export function getSettlementPeriod(settlementDateIST: string): { start: Date; end: Date } {
    const [year, month, day] = settlementDateIST.split('-').map(Number);
    // 7AM IST = 1:30 AM UTC → UTC hours=1, minutes=30
    const periodEnd = new Date(Date.UTC(year, month - 1, day, 1, 30, 0));
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
    return { start: periodStart, end: periodEnd };
}

/**
 * Human-readable label for a settlement period.
 * e.g. "8 May 7:00 AM → 9 May 7:00 AM"
 */
export function formatSettlementPeriod(start: Date, end: Date): string {
    const fmt = (d: Date) => {
        const ist = new Date(d.getTime() + IST_OFFSET_MS);
        const day = ist.getUTCDate();
        const month = ist.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
        return `${day} ${month} 7:00 AM`;
    };
    return `${fmt(start)} → ${fmt(end)}`;
}

/** Returns previous day's 'YYYY-MM-DD' IST string (used to mark overdue). */
export function getYesterdayIST(): string {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ist = new Date(yesterday.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
