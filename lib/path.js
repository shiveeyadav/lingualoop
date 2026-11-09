// Learning-path state (pure: safe on client and server, unit-tested).

// Lessons form one path through the course: a lesson opens once the one before it
// has been completed. Finished lessons stay open for review.
// Returns { lessons: { id: { times, unlocked } }, units: { id: { done, total } }, nextLessonId, finished }
export function computeCourseMap(course, times) {
  const lessons = {};
  let prevDone = true;
  let nextLessonId = null;
  course.lessonOrder.forEach((lid) => {
    const t = times[lid] || 0;
    const unlocked = prevDone || t > 0;
    lessons[lid] = { times: t, unlocked };
    if (!nextLessonId && unlocked && t === 0) nextLessonId = lid;
    prevDone = t > 0;
  });
  const units = {};
  course.units.forEach((u) => {
    units[u.id] = { done: u.lessons.filter((l) => (times[l.id] || 0) > 0).length, total: u.lessons.length };
  });
  const finished = !nextLessonId;
  return { lessons, units, nextLessonId: nextLessonId || course.lessonOrder[0], finished };
}
