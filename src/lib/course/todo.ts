/**
 * "Courses I have to take" for one member (server only): must-take courses for their member type that they have not finished,
 * plus any course they joined that has a finish-by date and is not finished. Used by the account page (the full list) and the
 * menu bar (a small badge), so the two always agree. A student never has must-take courses.
 */
import { db } from "@/lib/db";
import { dueState, dueText, isMandatoryFor, type DueState } from "./deadline";

export type TodoCourse = {
  id: string;
  title: string;
  must: boolean;
  dueAt: Date | null;
  enrolled: boolean;
  state: DueState;
  due: { text: string; tone: string };
};

export async function getTodoCourses(userId: string, memberType: string, now = new Date()): Promise<TodoCourse[]> {
  const rows = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        ...(memberType !== "STUDENT" ? [{ mandatory: true, audienceTypes: { has: memberType as never } }] : []),
        { dueAt: { not: null }, enrollments: { some: { userId, completedAt: null } } },
      ],
    },
    take: 30,
    select: { id: true, title: true, mandatory: true, dueAt: true, audienceTypes: true, enrollments: { where: { userId }, select: { completedAt: true } } },
  });
  return rows
    .map((c) => {
      const e = c.enrollments[0] ?? null;
      const state = dueState(c.dueAt, now, e?.completedAt ?? null);
      return { id: c.id, title: c.title, must: isMandatoryFor(c, memberType), dueAt: c.dueAt, enrolled: !!e, done: !!e?.completedAt, state, due: dueText(state, c.dueAt, now) };
    })
    .filter((c) => !c.done)
    .map(({ done: _done, ...c }) => c)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) || a.title.localeCompare(b.title, "th"));
}

/** What the menu badge needs: how many, and whether any is due soon / today / overdue (the badge turns red). */
export const todoBadge = (items: Pick<TodoCourse, "state">[]) => ({ count: items.length, urgent: items.some((i) => i.state === "overdue" || i.state === "today" || i.state === "soon") });
