import Link from 'next/link';
import Layout from '../../components/Layout';
import LessonPlayer from '../../components/LessonPlayer';
import { loadUser } from '../../lib/ssr';
import { getCourse } from '../../lib/content';
import { buildPractice } from '../../lib/progress';
import { prepareExercise } from '../../lib/prepare';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true, redirectTo: '/courses' });
  if (!r.user) return r;
  const courseId = String(ctx.params.course || '');
  const course = getCourse(courseId);
  if (!course) return { notFound: true };
  const practice = await buildPractice(r.user.id, courseId);
  return {
    props: {
      user: r.user,
      todayXp: r.todayXp,
      course: { id: courseId, title: course.meta.title, shortName: course.meta.shortName, speechLang: course.meta.speechLang },
      weakWords: practice.weakWords,
      items: practice.items.map((it) => ({ lessonId: it.lessonId, index: it.index, exercise: prepareExercise(it.exercise) })),
    },
  };
}

export default function PracticePage({ user, todayXp, course, weakWords, items }) {
  const backHref = '/learn/' + course.id;
  if (!items.length) {
    return (
      <Layout title="Practice" user={user} todayXp={todayXp} narrow>
        <h1>Practice</h1>
        <p>Finish your first lesson in {course.title} and practice will bring back the words you find hardest.</p>
        <Link href={backHref} className="btn">
          Go to lessons
        </Link>
      </Layout>
    );
  }
  return (
    <LessonPlayer
      mode="practice"
      course={course}
      title={'Practice' + (weakWords.length ? ': ' + weakWords.slice(0, 3).join(', ') : '')}
      items={items}
      initialHearts={user.hearts}
      heartsNextAt={user.heartsNextAt}
      soundOn={user.soundOn}
      isGuest={user.isGuest}
      backHref={backHref}
    />
  );
}
