import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en-GB">
      <Head>
        <meta name="description" content="LinguaLoop: short, game-like lessons in Spanish and European Portuguese." />
        <meta name="theme-color" content="#4338ca" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
