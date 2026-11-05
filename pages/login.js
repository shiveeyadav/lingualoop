import { useState } from 'react';
import Link from 'next/link';
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

export default function Login({ user, todayXp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await postJson('/api/auth/login', { email, password });
      // Full reload so every page picks up the new session.
      window.location.assign('/courses');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Layout title="Log in" user={user} todayXp={todayXp} narrow>
      <h1>Log in</h1>
      {user && user.isGuest ? (
        <p className="alert alert-info">
          You are learning as a guest. Logging in to another account leaves this guest progress behind - to keep it,{' '}
          <Link href="/signup">create a profile</Link> instead.
        </p>
      ) : null}
      <form className="card" onSubmit={onSubmit}>
        {error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="center">
        New here? <Link href="/signup">Create a profile</Link> or <Link href="/courses">try a lesson</Link>.
      </p>
    </Layout>
  );
}
