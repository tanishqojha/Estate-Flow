import type { AttendanceService, GeoPoint } from "@/lib/services/types";
import type { AttendanceStatus } from "@/lib/types/database";

/**
 * attendanceService — GPS validation + status derivation (PRD §6.10).
 * Pure logic (browser supplies coordinates), so prod = dry-run.
 */

/** Check-ins at or after this local hour are marked late. */
const LATE_CUTOFF_HOUR = 10;

export const attendanceService: AttendanceService = {
  validateLocation(point: GeoPoint): boolean {
    return (
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      point.lng >= -180 &&
      point.lng <= 180 &&
      // (0,0) is the classic "geolocation failed" coordinate
      !(point.lat === 0 && point.lng === 0)
    );
  },

  deriveCheckInStatus(checkInTime: Date, timezone: string): AttendanceStatus {
    let localHour: number;
    try {
      localHour = Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: timezone,
        }).format(checkInTime),
      );
    } catch {
      localHour = checkInTime.getHours();
    }
    return localHour >= LATE_CUTOFF_HOUR ? "late" : "present";
  },

  buildSelfiePath(organizationId: string, userId: string, workDate: string): string {
    return `${organizationId}/${userId}/${workDate}-selfie.jpg`;
  },
};
