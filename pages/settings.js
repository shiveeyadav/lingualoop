import { useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';
import { postJson } from '../lib/client';
import { DAILY_GOALS } from '../lib/constants';

export async function getServerSideProps(ctx) {
  const r = await loadUser(ctx, { required: true });
  if (!r.user) return r;
  return { props: { user: r.user, todayXp: r.todayXp } };
}

const GOAL_NAMES = { 10: 'Casual', 20: 'Regular', 30: 'Serious', 50: 'Intense' };

export default function Settings({ user, todayXp }) {
  const [prefs, setPrefs] = useState({
    displayName: user.displayName,
    dailyGoal: user.dailyGoal,
    soundOn: user.soundOn,
    showOnLeaderboard: user.showOnLeaderboard,
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState({ password: '', confirm: '' });
  const [delError, setDelError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const body = { dailyGoal: prefs.dailyGoal, soundOn: prefs.soundOn, showOnLeaderboard: prefs.showOnLeaderboard };
    if (!user.isGuest) body.displayName = prefs.displayName;
    try {
      await postJson('/api/account/settings', body);
      setMsg({ ok: true, text: 'Settings saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    setDelError('');
    try {
      await postJson('/api/account/delete', { password: del.password, confirm: del.confirm });
      window.location.assign('/');
    } catch (err) {
      setDelError(err.message);
    }
  }

  return (
    <Layout title="Settings" user={user} todayXp={todayXp} narrow>
      <h1>Settings</h1>
      <form className="card" onSubmit={save}>
        {msg ? (
          <div className={'alert ' + (msg.ok ? 'alert-ok' : 'alert-error')} role={msg.ok ? 'status' : 'alert'}>
            {msg.text}
          </div>
        ) : null}
        {!user.isGuest ? (
          <div className="form-field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="input"
              maxLength={30}
              value={prefs.displayName}
              onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            />
          </div>
        ) : null}
        <fieldset>
          <legend>Daily goal</legend>
          <div className="choice-group">
            {DAILY_GOALS.map((g) => (
              <label key={g}>
                <input
                  type="radio"
                  name="dailyGoal"
                  value={g}
                  checked={prefs.dailyGoal === g}
                  onChange={() => setPrefs({ ...prefs, dailyGoal: g })}
                />
                <span>
                  {GOAL_NAMES[g]} · {g} XP
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-field">
          <label className="checkbox" htmlFor="soundOn">
            <input id="soundOn" type="checkbox" checked={prefs.soundOn} onChange={(e) => setPrefs({ ...prefs, soundOn: e.target.checked })} />
            <span>Sound effects and automatic read-aloud</span>
          </label>
        </div>
        <div className="form-field">
          <label className="checkbox" htmlFor="showOnLeaderboard">
            <input
              id="showOnLeaderboard"
              type="checkbox"
              checked={prefs.showOnLeaderboard}
              onChange={(e) => setPrefs({ ...prefs, showOnLeaderboard: e.target.checked })}
            />
            <span>Show me on the weekly leaderboard</span>
          </label>
        </div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <section className="card" aria-labelledby="data-h">
        <h2 id="data-h">Your data</h2>
        <p>
          Download a copy of everything we hold about you, or read the <Link href="/privacy">privacy notice</Link>.
        </p>
        <a className="btn btn-secondary" href="/api/account/export" download>
          Download my data (JSON)
        </a>
      </section>

      <section className="card" aria-labelledby="delete-h">
        <h2 id="delete-h">Delete account</h2>
        <p>
          This permanently deletes your {user.isGuest ? 'guest progress' : 'account'}, streak, XP and learning history.
          It cannot be undone.
        </p>
        <form onSubmit={deleteAccount}>
          {delError ? (
            <div className="alert alert-error" role="alert">
              {delError}
            </div>
          ) : null}
          {!user.isGuest ? (
            <div className="form-field">
              <label htmlFor="delPassword">Your password</label>
              <input
                id="delPassword"
                type="password"
                className="input"
                autoComplete="current-password"
                value={del.password}
                onChange={(e) => setDel({ ...del, password: e.target.value })}
              />
            </div>
          ) : null}
          <div className="form-field">
            <label htmlFor="delConfirm">Type DELETE to confirm</label>
            <input
              id="delConfirm"
              className="input"
              autoComplete="off"
              value={del.confirm}
              onChange={(e) => setDel({ ...del, confirm: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-danger" disabled={del.confirm !== 'DELETE'}>
            Delete permanently
          </button>
        </form>
      </section>
    </Layout>
  );
}
