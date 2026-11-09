import Link from 'next/link';
import Layout from '../components/Layout';
import { LoopArt, Icon } from '../components/Icons';
import { loadUser } from '../lib/ssr';
import { listCourses } from '../lib/content';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx);
  return { props: { user: r.user, todayXp: r.todayXp, courses: listCourses() } };
}

export default function Home({ user, todayXp, courses }) {
  const continueHref = user && user.currentCourse ? '/learn/' + user.currentCourse : '/courses';
  return (
    <Layout title="Learn languages in short loops" user={user} todayXp={todayXp}>
      <section className="hero">
        <LoopArt className="hero-art" />
        <h1>Learn a language, one short loop at a time</h1>
        <p className="lead">
          Five-minute lessons in {courses.length} languages, from Spanish and French to Arabic, Hindi, Chinese, Japanese and
          Korean. Build a daily streak, earn XP and review the words you find hardest.
        </p>
        <div className="row">
          {user ? (
            <Link href={continueHref} className="btn">
              Continue learning
            </Link>
          ) : (
            <>
              <Link href="/courses" className="btn">
                Try a lesson - no sign-up
              </Link>
              <Link href="/login" className="btn btn-secondary">
                I already have an account
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="features" aria-label="How it works">
        <div className="card">
          <h2>
            <Icon name="bolt" className="crowns" /> Bite-sized
          </h2>
          <p>Multiple choice, word tiles, typing, listening and matching - one exercise at a time.</p>
        </div>
        <div className="card">
          <h2>
            <Icon name="flame" className="crowns" /> Daily streaks
          </h2>
          <p>Set a daily XP goal and keep your streak alive. Days follow UK time.</p>
        </div>
        <div className="card">
          <h2>
            <Icon name="star" className="crowns" /> Smart practice
          </h2>
          <p>Practice mode brings back the words you get wrong most, just before you forget them.</p>
        </div>
      </section>

      <section aria-labelledby="courses-h">
        <h2 id="courses-h">{courses.length} languages</h2>
        <ul className="course-chips">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href="/courses">
                {c.title}
                <span className="muted small" lang={c.speechLang} dir={c.dir}>
                  {c.nativeName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
