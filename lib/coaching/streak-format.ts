/**
 * The human chip text for a logging streak (text-only, no emoji per brand —
 * F-116). Client-safe (no server imports) so the Activity Log form can re-render
 * it after a submit. `streak` excludes today; pass `todayLogged` so the chip
 * reflects today's entry once it lands (the visible count then includes today).
 */
export function streakChipText(streak: number, todayLogged: boolean): string {
  if (todayLogged) {
    const total = streak + 1;
    return `Streak: ${total} ${total === 1 ? "day" : "days"} — logged today`;
  }
  if (streak <= 0) return "Streak: 0 days — start a new streak today";
  return `Streak: ${streak} ${streak === 1 ? "day" : "days"} — log today to extend it`;
}
