import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Icon, BrandMark } from './Icons';
import { postJson } from '../lib/client';

export function HeaderStats({ user, todayXp }) {
  if (!user) return null;
  return (
    <div className="stats" aria-label="Your stats">
      <span className={'stat stat-streak' + (user.streak ? '' : ' off')} title="Day streak">
        <Icon name="flame" />
        {user.streak}
        <span className="sr-only"> day streak</span>
      </span>
      <span className="stat stat-xp" title="XP today / daily goal">
        <Icon name="bolt" />
        {todayXp}
        <span className="sr-only"> XP today, daily goal {user.dailyGoal}</span>
      </span>
      <span className="stat stat-hearts" title="Hearts">
        <Icon name="heart" />
        {user.hearts}
        <span className="sr-only"> hearts</span>
      </span>
    </div>
  );
}

function Brand({ href }) {
  return (
    <Link href={href} className="brand">
      <span className="mark" aria-hidden="true">
        <BrandMark className="brand-mark" />
      </span>
      <span>LinguaLoop</span>
    </Link>
  );
}

function Tabs({ user }) {
  const router = useRouter();
  const learnHref = user.currentCourse ? '/learn/' + user.currentCourse : '/courses';
  const practiceHref = user.currentCourse ? '/practice/' + user.currentCourse : '/courses';
  const items = [
    { href: learnHref, match: ['/learn', '/courses', '/guide'], label: 'Learn', icon: 'path' },
    { href: practiceHref, match: ['/practice'], label: 'Practice', icon: 'dumbbell' },
    { href: '/leaderboard', match: ['/leaderboard'], label: 'Ranks', icon: 'trophy' },
    { href: '/profile', match: ['/profile'], label: 'Profile', icon: 'person' },
    { href: '/settings', match: ['/settings', '/admin'], label: 'Settings', icon: 'gear' },
  ];
  return (
    <nav className="tabs" aria-label="Main">
      {items.map((it) => {
        const active = it.match.some((m) => router.pathname.startsWith(m));
        return (
          <Link key={it.label} href={it.href} className="tab" aria-current={active ? 'page' : undefined}>
            <Icon name={it.icon} className="ico" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout({ title, user, todayXp = 0, children, narrow = false }) {
  const router = useRouter();
  const learnHref = user && user.currentCourse ? '/learn/' + user.currentCourse : '/courses';

  async function logout() {
    try {
      await postJson('/api/auth/logout');
    } finally {
      router.push('/');
    }
  }

  return (
    <>
      <Head>
        <title>{title ? title + ' · LinguaLoop' : 'LinguaLoop'}</title>
      </Head>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className={'shell' + (user ? ' has-tabs' : '')}>
        {user ? (
          <aside className="side">
            <Brand href={learnHref} />
            <Tabs user={user} />
            <div className="side-foot">
              {user.role === 'admin' ? <Link href="/admin">Admin</Link> : null}
              {user.isGuest ? (
                <Link href="/signup">Save progress</Link>
              ) : (
                <button type="button" className="linkbtn" onClick={logout}>
                  Log out
                </button>
              )}
            </div>
          </aside>
        ) : null}

        <header className="topbar">
          <div className="topbar-in">
            <Brand href={user ? learnHref : '/'} />
            {user ? (
              <HeaderStats user={user} todayXp={todayXp} />
            ) : (
              <nav className="guest-nav" aria-label="Main">
                <Link href="/courses">Courses</Link>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="btn small">
                  Sign up
                </Link>
              </nav>
            )}
          </div>
        </header>

        <main id="main" className={'container' + (narrow ? ' narrow' : '')} tabIndex={-1}>
          {children}
          <footer className="site-footer">
            <span>© LinguaLoop</span>
            <Link href="/privacy">Privacy notice</Link>
            <Link href="/courses">Courses</Link>
            {user && user.isGuest ? <Link href="/signup">Save progress</Link> : null}
            {user && !user.isGuest ? (
              <button type="button" className="linkbtn" onClick={logout}>
                Log out
              </button>
            ) : null}
          </footer>
        </main>

        {user ? <Tabs user={user} /> : null}
      </div>
    </>
  );
}
