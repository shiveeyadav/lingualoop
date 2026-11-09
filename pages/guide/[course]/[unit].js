// Unit guidebook: the unit's key words and phrases (with meanings and audio) and tips.
import Link from 'next/link';
import Layout from '../../../components/Layout';
import { Icon } from '../../../components/Icons';
import { SpeakButton, TargetText } from '../../../components/Exercises';
import { loadUser } from '../../../lib/ssr';
import { getCourse, courseClientInfo, unitGuide } from '../../../lib/content';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx);
  const courseId = String(ctx.params.course || '');
  const course = getCourse(courseId);
  const guide = course ? unitGuide(courseId, String(ctx.params.unit || '')) : null;
  if (!guide) return { notFound: true };
  return { props: { user: r.user, todayXp: r.todayXp, course: courseClientInfo(course), guide } };
}

function Entries({ items, course, label }) {
  if (!items.length) return null;
  return (
    <section className="card" aria-labelledby={'h-' + label}>
      <h2 id={'h-' + label}>{label}</h2>
      <ul className="guide-list">
        {items.map((it) => (
          <li key={it.t}>
            <span className="guide-speak">
              <SpeakButton text={it.t} lang={course.speechLang} label={"Listen: " + it.t} />
            </span>
            <TargetText text={it.t} roman={it.r} course={course} className="guide-target" />
            <span className="guide-meaning" lang="en">
              {it.e}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Guide({ user, todayXp, course, guide }) {
  return (
    <Layout title={'Guidebook: ' + guide.title + ' · ' + course.title} user={user} todayXp={todayXp} narrow>
      <p className="small">
        <Link href={user ? '/learn/' + course.id : '/courses'}>← Back to {course.title}</Link>
      </p>
      <p className="unit-kicker" style={{ color: 'var(--muted)' }}>
        {course.title} · Unit {guide.number} guidebook
      </p>
      <h1>{guide.title}</h1>
      {guide.description ? <p className="lead">{guide.description}</p> : null}
      {guide.tips.length ? (
        <section className="card tips-card" aria-labelledby="h-tips">
          <h2 id="h-tips">
            <Icon name="star" /> Tips
          </h2>
          <ul>
            {guide.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <Entries items={guide.words} course={course} label="Key words" />
      <Entries items={guide.phrases} course={course} label="Key phrases" />
      <p className="muted small">Tap the speaker to hear each one. If you hear nothing, your browser has no {course.shortName} voice.</p>
    </Layout>
  );
}
