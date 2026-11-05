import Link from 'next/link';
import Layout from '../components/Layout';
import { loadUser } from '../lib/ssr';

export async function getServerSideProps(ctx) {
  try {
    const r = await loadUser(ctx);
    return { props: { user: r.user, todayXp: r.todayXp } };
  } catch (_) {
    // The privacy notice must stay readable even if the database is unavailable.
    return { props: { user: null, todayXp: 0 } };
  }
}

export default function Privacy({ user, todayXp }) {
  return (
    <Layout title="Privacy notice" user={user} todayXp={todayXp}>
      <article className="prose">
        <h1>Privacy notice</h1>
        <p className="muted">Last updated: November 2026</p>
        <p>
          This notice explains what personal data LinguaLoop collects, why, and your rights under the UK General Data
          Protection Regulation (UK GDPR) and the Data Protection Act 2018.
        </p>

        <h2>Who we are</h2>
        <p>
          LinguaLoop is the data controller for the personal data described here. Contact for privacy questions:{' '}
          <strong>[operator name and privacy contact email - to be completed by the operator before launch]</strong>.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> email address, display name and a one-way hash of your password (we never
            store the password itself).
          </li>
          <li>
            <strong>Learning data:</strong> courses you take, lessons completed, XP, streak, hearts, daily goal, and
            which words you get right or wrong (used for practice).
          </li>
          <li>
            <strong>Settings:</strong> sound on/off and whether you appear on the leaderboard.
          </li>
          <li>
            <strong>Guest use:</strong> if you try a lesson without signing up we create an anonymous guest record linked
            to a cookie on your device. It holds learning data only.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address is processed briefly in memory to limit abuse (for example,
            repeated login attempts) and may appear in short-lived server logs.
          </li>
        </ul>
        <p>
          We do not collect special category data, we do not sell data, and we do not use advertising or analytics
          trackers. Listening exercises use your browser&apos;s built-in text-to-speech; no audio is sent to us.
        </p>

        <h2>Why we use it (lawful basis)</h2>
        <ul>
          <li>
            <strong>Contract</strong> (Article 6(1)(b)): to provide your account, lessons, progress, streaks and
            practice.
          </li>
          <li>
            <strong>Legitimate interests</strong> (Article 6(1)(f)): to keep the service secure, prevent abuse, and
            show the weekly leaderboard (you can opt out in Settings).
          </li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use one strictly necessary cookie, <code>ll_session</code>, to keep you signed in (or to keep your guest
          progress). It is HttpOnly, lasts up to 30 days and is not used for tracking. Because it is strictly
          necessary, no consent banner is required.
        </p>

        <h2>Who we share it with</h2>
        <p>
          Only our hosting and database providers, who process data on our behalf under contract. Your display name and
          weekly XP are visible to other learners on the leaderboard unless you turn this off. We do not transfer data
          outside the UK/EEA unless our hosting provider does so with appropriate safeguards.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Account and learning data: until you delete your account.</li>
          <li>Guest records: deleted automatically after 30 days of inactivity.</li>
          <li>Sign-in sessions: up to 30 days, removed when you log out or they expire.</li>
        </ul>

        <h2>Your rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>access your data and receive it in a portable format (Settings → Download my data);</li>
          <li>correct inaccurate data (Settings → Display name, or contact us);</li>
          <li>erase your data (Settings → Delete account, which removes it immediately);</li>
          <li>object to or restrict processing based on legitimate interests;</li>
          <li>
            complain to the Information Commissioner&apos;s Office (ICO) at{' '}
            <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer">
              ico.org.uk
            </a>
            .
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          LinguaLoop is intended for people aged 13 and over. If you are under 13, please ask a parent or guardian
          before creating an account.
        </p>

        <h2>Changes</h2>
        <p>We will update this page if our practices change and show the new date at the top.</p>
        <p>
          <Link href="/">Back to LinguaLoop</Link>
        </p>
      </article>
    </Layout>
  );
}
