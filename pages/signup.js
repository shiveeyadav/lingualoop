import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { postJson } from '../lib/client';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx);
  if (r.user && !r.user.isGuest) {
    return { redirect: { destination: r.user.currentCourse ? '/learn/' + r.user.currentCourse : '/courses', permanent: false } };
  }
  return { props: { user: r.user, todayXp: r.todayXp } };
}

export default function Signup({ user, todayXp }) {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', acceptPrivacy: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (!form.acceptPrivacy) return setError('Please accept the privacy notice');
    setBusy(true);
    try {
      await postJson('/api/auth/signup', form);
      router.push(user && user.currentCourse ? '/learn/' + user.currentCourse : '/courses');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Layout title="Create your profile" user={user} todayXp={todayXp} narrow>
      <h1>Create your profile</h1>
      {user && user.isGuest ? (
        <p className="alert alert-info">Your guest progress ({user.xpTotal} XP) will be saved to your new profile.</p>
      ) : null}
      <form className="card" onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="form-field">
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" className="input" required maxLength={30} autoComplete="nickname" value={form.displayName} onChange={set('displayName')} />
          <p className="muted small">Shown on the leaderboard. Avoid using your full name.</p>
        </div>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" required maxLength={254} autoComplete="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} aria-describedby="pw-help" />
          <p id="pw-help" className="muted small">
            At least 8 characters.
          </p>
        </div>
        <div className="form-field">
          <label className="checkbox" htmlFor="acceptPrivacy">
            <input id="acceptPrivacy" type="checkbox" checked={form.acceptPrivacy} onChange={set('acceptPrivacy')} />
            <span>
              I have read the{' '}
              <Link href="/privacy" target="_blank">
                privacy notice
              </Link>
              .
            </span>
          </label>
        </div>
        <button type="submit" className="btn btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create profile'}
        </button>
      </form>
      <p className="center">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </Layout>
  );
}
