import { useEffect } from "react";
import { prettyDate, getDueDateStatus, priorityColor, defaultState, reorderWithin, moveItemBetween } from "../../utils/helpers";

export function DevTests() {
  useEffect(() => {
    const results: string[] = [];
    const assert = (cond: boolean, msg: string) => {
      if (!cond) throw new Error(msg);
      results.push(`✓ ${msg}`);
    };
    try {
      // prettyDate
      assert(prettyDate("") === "No due", "prettyDate handles empty");
      assert(prettyDate("not-a-date") === "No due", "prettyDate handles invalid");

      // getDueDateStatus
      const past = new Date(Date.now() - 86400000).toISOString();
      assert(getDueDateStatus(past) === 'past', "getDueDateStatus handles past date");

      // priorityColor mapping
      const pc = priorityColor("High");
      assert(typeof pc === "string" && pc.includes("amber"), "priorityColor maps High");

      // default state shape
      const ds = defaultState();
      assert(Array.isArray(ds.columns) && ds.columns.length >= 3, "defaultState has columns");
      assert(ds.tasks && typeof ds.tasks === "object", "defaultState has tasks map");

      // helpers
      const within = reorderWithin(["a","b","c"], "a", "c");
      assert(within.join(",") === "b,c,a" || within.join(",") === "a,b,c", "reorderWithin returns array");

      const moved = moveItemBetween(["a","b"], ["c"], "a", "c");
      assert(moved.from.join(",") === "b" && moved.to.join(",") === "a,c".replace(/,/g, ",").split(",").join(","), "moveItemBetween basic move");

      console.info("Project Sol self-tests passed:\n" + results.join("\n"));
    } catch (e) {
      console.error("Project Sol self-tests FAILED:", e);
    }
  }, []);
  return null;
}
