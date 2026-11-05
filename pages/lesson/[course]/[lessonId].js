import Link from 'next/link';
import Layout from '../../../components/Layout';
import LessonPlayer from '../../../components/LessonPlayer';
import { loadUser } from '../../../lib/ssr';
import { getCourse, getLesson } from '../../../lib/content';
import { canStartLesson } from '../../../lib/progress';
import { prepareExercise } from '../../../lib/prepare';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true, redirectTo: '/courses' });
  if (!r.user) return r;
  const courseId = String(ctx.params.course || '');
  const lessonId = String(ctx.params.lessonId || '');
  const course = getCourse(courseId);
  const ref = course ? getLesson(courseId, lessonId) : null;
  if (!course || !ref) return { notFound: true };
  if (!(await canStartLesson(r.user.id, courseId, lessonId))) {
    return { redirect: { destination: '/learn/' + courseId, permanent: false } };
  }
  const skill = course.skillIndex[ref.skillId].skill;
  const outOfHearts = r.user.hearts <= 0;
  return {
    props: {
      user: r.user,
      todayXp: r.todayXp,
      course: { id: courseId, title: course.meta.title, shortName: course.meta.shortName, speechLang: course.meta.speechLang },
      lessonId,
      title: skill.title + ' · ' + ref.lesson.title,
      outOfHearts,
      items: outOfHearts
        ? []
        : ref.lesson.exercises.map((ex, index) => ({ lessonId, index, exercise: prepareExercise(ex) })),
    },
  };
}

export default function LessonPage({ user, todayXp, course, lessonId, title, outOfHearts, items }) {
  const backHref = '/learn/' + course.id;
  if (outOfHearts) {
    const mins = user.heartsNextAt ? Math.max(1, Math.ceil((user.heartsNextAt - Date.now()) / 60000)) : null;
    return (
      <Layout title="Out of hearts" user={user} todayXp={todayXp} narrow>
        <h1>You are out of hearts</h1>
        <p>
          Lessons need at least one heart. Hearts refill over time
          {mins ? <span suppressHydrationWarning> (next one in about {mins} min)</span> : null}, or you can practise
          words you have already learned to earn one back now.
        </p>
        <div className="row">
          <Link href={'/practice/' + course.id} className="btn">
            Practise to earn a heart
          </Link>
          <Link href={backHref} className="btn btn-secondary">
            Back to course
          </Link>
        </div>
      </Layout>
    );
  }
  return (
    <LessonPlayer
      mode="lesson"
      course={course}
      lessonId={lessonId}
      title={title}
      items={items}
      initialHearts={user.hearts}
      heartsNextAt={user.heartsNextAt}
      soundOn={user.soundOn}
      isGuest={user.isGuest}
      backHref={backHref}
    />
  );
}
