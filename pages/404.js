import Head from 'next/head';
import Link from 'next/link';
import { BrandMark } from '../components/Icons';

// Static 404 (no database access) so it can be prerendered at build time.
export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page not found · LinguaLoop</title>
      </Head>
      <main id="main" className="container narrow center">
        <BrandMark className="hero-art" />
        <h1>Page not found</h1>
        <p>That page does not exist, or you do not have access to it.</p>
        <Link href="/" className="btn">
          Go home
        </Link>
      </main>
    </>
  );
}
