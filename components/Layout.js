import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Icon, BrandMark } from './Icons';
import { postJson } from '../lib/client';

function NavLink({ href, children, match }) {
  const router = useRouter();
  const active = match ? router.pathname.startsWith(match) : router.pathname === href;
  return (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined}>
        {children}
      </Link>
    </li>
  );
}

export function HeaderStats({ user, todayXp }) {
  if (!user) return null;
  return (
    <div className="stats" aria-label="Your stats">
      <span className="stat stat-streak" title="Day streak">
        <Icon name="flame" />
        {user.streak}
        <span className="sr-only"> day streak</span>
      </span>
      <span className="stat stat-xp" title="XP today / daily goal">
        <Icon name="bolt" />
        {todayXp}/{user.dailyGoal}
        <span className="sr-only"> XP today of your daily goal</span>
      </span>
      <span className="stat stat-hearts" title="Hearts">
        <Icon name="heart" />
        {user.hearts}
        <span className="sr-only"> hearts</span>
      </span>
    </div>
  );
}

export default function Layout({ title, user, todayXp = 0, children, narrow = false }) {
  const router = useRouter();
  const learnHref = user && user.currentCourse ? '/learn/' + user.currentCourse : '/courses';
  const practiceHref = user && user.currentCourse ? '/practice/' + user.currentCourse : '/courses';

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
      <header className="site-header">
        <div className="header-inner">
          <Link href={user ? learnHref : '/'} className="brand">
            <BrandMark className="brand-mark" />
            LinguaLoop
          </Link>
          <HeaderStats user={user} todayXp={todayXp} />
          <nav className="main-nav" aria-label="Main">
            <ul>
              {user ? (
                <>
                  <NavLink href={learnHref} match="/learn">
                    Learn
                  </NavLink>
                  <NavLink href={practiceHref} match="/practice">
                    Practice
                  </NavLink>
                  <NavLink href="/leaderboard">Leaderboard</NavLink>
                  <NavLink href="/profile">Profile</NavLink>
                  <NavLink href="/settings">Settings</NavLink>
                  {user.role === 'admin' ? <NavLink href="/admin">Admin</NavLink> : null}
                  {user.isGuest ? (
                    <NavLink href="/signup">Save progress</NavLink>
                  ) : (
                    <li>
                      <button type="button" className="btn-link" onClick={logout}>
                        Log out
                      </button>
                    </li>
                  )}
                </>
              ) : (
                <>
                  <NavLink href="/courses">Courses</NavLink>
                  <NavLink href="/login">Log in</NavLink>
                  <NavLink href="/signup">Sign up</NavLink>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className={'container' + (narrow ? ' narrow' : '')} tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <span>© LinguaLoop</span>
        <Link href="/privacy">Privacy notice</Link>
        <Link href="/courses">Courses</Link>
      </footer>
    </>
  );
}
