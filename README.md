# LinguaLoop

A Duolingo-style language app: short, game-like lessons in **14 languages**, all taught from English. You get XP, daily streaks (UK date), a daily XP goal, hearts, a learning-path map with locked and unlocked lessons, a mistakes review at the end of each lesson, a weekly leaderboard and spaced-repetition practice. You can try a lesson as a guest without signing up, and your progress is kept when you create a profile.

Stack: Next.js 14 (pages router, plain JavaScript), PostgreSQL (`pg`), `bcryptjs`, plain CSS. Sessions use an httpOnly cookie backed by the `sessions` table. No other dependencies.

## Languages

| Course | Native name | Speech voice | Romanization | Units | Lessons | Exercises |
|---|---|---|---|---|---|---|
| Spanish | Español | es-ES | - | 9 | 36 | 342 |
| Portuguese (Portugal) | Português europeu | pt-PT | - | 9 | 36 | 342 |
| French | Français | fr-FR | - | 6 | 24 | 228 |
| German | Deutsch | de-DE | - | 6 | 24 | 228 |
| Italian | Italiano | it-IT | - | 6 | 24 | 228 |
| Dutch | Nederlands | nl-NL | - | 6 | 24 | 228 |
| Polish | Polski | pl-PL | - | 6 | 24 | 228 |
| Russian | Русский | ru-RU | transliteration | 6 | 24 | 228 |
| Turkish | Türkçe | tr-TR | - | 6 | 24 | 228 |
| Arabic (MSA, right-to-left) | العربية | ar-SA | transcription | 6 | 24 | 228 |
| Hindi | हिन्दी | hi-IN | romanization | 6 | 24 | 228 |
| Chinese (Mandarin, simplified) | 中文 | zh-CN | pinyin | 6 | 24 | 228 |
| Japanese | 日本語 | ja-JP | romaji | 6 | 24 | 228 |
| Korean | 한국어 | ko-KR | romanization | 6 | 24 | 228 |

**3,420 exercises in total.** The 12 newer courses share one syllabus: Greetings, People and family, Food and drink, Numbers (1-10, prices, the time), Travel and directions, Daily routine. Spanish and Portuguese keep their original nine topics (greetings, introductions, being polite, numbers, food, family, getting around, at the café, days and time). Every unit has 4 lessons (New words, More words, Sentences, Unit review) of 9-10 exercises.

Content uses only common vocabulary and short, simple sentences. Where a sentence depends on the speaker's gender (Arabic, Hindi, Polish, Russian), the masculine form is shown and the feminine form is accepted. **Before launch, have a native speaker skim each course** - see "Content review" below.

## Exercise types

- **Multiple choice** - pick the meaning of a word or sentence, or the right translation (keys 1-4 work).
- **Word bank** - tap word tiles in order to build the sentence, in the new language or in English (Backspace removes the last tile).
- **Type the translation** - checked leniently: case and punctuation are ignored; a missing or wrong accent is accepted with a "watch the accents" note; one typo is forgiven in answers of 6+ letters; listed alternatives (e.g. "Hi" for "Hello", feminine forms) are accepted. For non-Latin scripts you can type the script or the romanization (tone marks and macrons optional). Latin-script courses show a row of special letters (é, ß, ł, ğ, ...).
- **Match pairs** - tap a word and its meaning.
- **Listening** - uses the browser's `speechSynthesis` with the course's language code. Latin-script courses: type what you hear. Non-Latin courses: tap the sentence you heard. "Slower" replays at a slower rate. If the browser has no voice for the language, the exercise is skipped without losing a heart and the learner is told how to add a voice.

Non-Latin text (Russian, Arabic, Hindi, Chinese, Japanese, Korean) always shows its romanization underneath: prompts, options, word tiles, match pairs and answers. Arabic text, tiles and answer rows run right-to-left.

## Project layout

```
components/      Layout, Icons, Exercises (5 exercise types), LessonPlayer
content/<id>.json  one file per course: units -> lessons -> exercises (generated)
scripts/courses/ hand-written course sources (_concepts.py = shared English syllabus)
scripts/gen-content.py  builds content/<id>.json from scripts/courses/<id>.py
db/schema.sql    idempotent schema (applied on every start)
lib/             db, auth/sessions, api wrapper, content loader + validator,
                 grading, path (lesson unlocking), hearts, dates (UK),
                 progress/XP/streaks/SRS, speech, sfx
pages/           landing, courses, signup, login, learn/[course] (path map),
                 lesson/[course]/[lessonId], practice/[course], profile,
                 leaderboard, settings, privacy, admin, api/*
test/            node:test unit tests (grading, path, all course content)
scripts/init-db.js  validate content -> wait for DB -> schema -> admin -> cleanup
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | yes | 16+ random characters. The app refuses to start in production without it. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | recommended | Admin is created on start if missing. An existing user with that email is promoted. Set `ADMIN_RESET_PASSWORD=true` for one deploy to reset the password. |
| `PORT` | no | Default `3000` |
| `DATABASE_SSL` | no | `true` for managed Postgres that needs TLS |
| `COOKIE_SECURE` | no | Cookies are `Secure` in production. Set `false` only when testing over plain `http://`. |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Run locally (Docker Compose)

```sh
cp .env.example .env        # edit SESSION_SECRET, ADMIN_*, POSTGRES_PASSWORD
echo COOKIE_SECURE=false >> .env   # plain http on localhost
docker compose up -d --build
open http://localhost:3000
```

The `pgdata` volume keeps the database between restarts.

## Run without Docker

```sh
npm install
export DATABASE_URL=postgres://... SESSION_SECRET=... ADMIN_EMAIL=... ADMIN_PASSWORD=...
npm run dev                 # development (run `npm run init-db` once first)
npm run build && npm start  # production: start runs init-db, then next start -p $PORT
```

## Deploy to Shipvolta / a Render-style Docker host

1. **Create a PostgreSQL database.** Use the platform's managed Postgres, or a `postgres:16-alpine` service with a persistent volume. Copy its internal connection URL.
2. **Create a web service** from this repository and choose **Dockerfile** as the build method. No build or start command is needed: the image's `CMD` runs `node scripts/init-db.js` and then `next start -p ${PORT:-3000}`.
3. **Set the environment:** `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_SSL=true` if the database needs TLS. Leave `PORT` alone if the platform injects it, otherwise set `PORT=3000` and expose port 3000.
4. **Health check path:** `/api/health` (returns 503 if the database is unreachable).
5. **Domain and HTTPS:** attach the domain and enable TLS on the platform's proxy. Session cookies are `Secure`, so login needs HTTPS in production.
6. **Deploy.** The logs should show `content ok` for all 14 courses, then `schema applied`, then the admin line. If course content is invalid, the deploy fails here instead of breaking at runtime.
7. Log in with the admin account and open `/admin`.

**Updates:** push and redeploy. The schema is idempotent and runs on every start.
**Backups:** run a regular `pg_dump` of the database. All user data is in Postgres.
**Scaling:** the login/sign-up rate limiter is in memory, per container. For more than one replica, also rate-limit at the proxy.

## Course file format

The app reads every `content/*.json` file at start-up; the file name is the course id. There is no list of courses in the code, so **adding a language means adding one file**.

```jsonc
{
  "id": "french",                 // must match the file name
  "title": "French", "shortName": "French", "nativeName": "Français",
  "speechLang": "fr-FR",          // BCP-47 code for speechSynthesis and lang=""
  "dir": "ltr",                   // "rtl" for Arabic, Hebrew, Persian, Urdu
  "romanization": "",             // e.g. "pinyin"; non-empty = show romanization
  "noSpaces": false,              // true for Chinese/Japanese
  "keyboard": ["é", "è", "ç"],    // special-letter buttons when typing
  "order": 30,                    // position on the course page
  "description": "...",
  "units": [
    { "id": "u1", "title": "Greetings", "description": "...", "icon": "wave", "tip": "...",
      "lessons": [
        { "id": "u1l1", "title": "New words", "exercises": [
          { "type": "mc", "instruction": "What does this mean?", "prompt": "bonjour", "promptLang": "target",
            "options": ["Good morning", "Thank you", "Yes", "No"], "answer": "Good morning", "words": ["bonjour"] }
        ] }
      ] }
  ]
}
```

Exercise fields: `mc` (prompt, options, answer, optional promptRoman/optionsRoman), `tap` (prompt, tiles, answer as an array of tiles, accepted alternatives, optional tilesRoman), `type` (prompt, answers), `listen` (text plus either answers to type or options to choose; optional roman), `match` (pairs of [target, English], optional romans). `words` are the vocabulary keys used by spaced-repetition practice. The validator in `lib/content.js` rejects a course whose answers are not among its options/tiles, whose romanization arrays do not line up, or whose ids repeat; it runs in the Docker build and on every start.

## Adding a language

**Option A - write the JSON** by hand in the format above and drop it into `content/`.

**Option B - use the generator (recommended).** Copy an existing source such as `scripts/courses/french.py` (Latin script) or `scripts/courses/russian.py` (non-Latin) to `scripts/courses/<id>.py` and translate every key. The English side, and the English answers that are accepted, live in `scripts/courses/_concepts.py`, so each language file only needs:

```python
COURSE = {"id": "greek", "title": "Greek", "nativeName": "Ελληνικά", "speechLang": "el-GR",
          "description": "...", "order": 150, "romanization": "transliteration", "keyboard": []}
TIPS = {"greetings": "...", "people": "...", "food": "...", "numbers": "...", "travel": "...", "daily": "..."}
T = {
    "hello": "γεια σου | γεια σας @ ya sou",   # main | accepted alternatives @ romanization | other spellings
    "how_are_you": "Τι κάνεις; @ Ti kaneis?",  # sentences: romanization must have the same number of words
    ...
}
```

For Chinese/Japanese-style scripts, put spaces between words (they become the word tiles and are removed for display) and set `"noSpaces": True`. Then:

```sh
python3 scripts/gen-content.py greek     # writes content/greek.json (or no argument = all courses)
npm test                                 # validator + "every answer grades correctly" checks
```

The generator stops with a clear message if a key is missing, a romanization is missing, or a sentence's romanization has a different number of words. Output is deterministic.

## Game rules

- **XP:** 10 per lesson (+5 for no mistakes) and 10 per practice session. The server re-grades every answer before awarding XP.
- **Streak:** goes up on the first XP of each UK calendar day (Europe/London). It is shown as 0 once a whole UK day is missed.
- **Daily goal:** 10, 20, 30 or 50 XP, set in Settings.
- **Hearts:** 5 maximum. You lose one for each wrong answer in a lesson (match-pair slips and practice are free). One heart refills every hour, and finishing a practice session gives one back. Lessons need at least 1 heart.
- **Learning path:** lessons open one after another across the whole course; finishing a lesson opens the next one. Finished lessons stay open for review. Each unit shows its progress and a tips panel.
- **Lesson complete:** shows XP, streak, today's progress towards the daily goal, unit progress, a list of your mistakes with the correct answers, and a Next lesson button.
- **Practice:** 10 exercises from completed lessons, focused on the weakest words. Word strength goes up when you answer right first time and down after mistakes, and it decays when a word goes unseen.
- **Leaderboard:** XP since Monday 00:00 UK time. Guests and people who opt out are hidden.
- **Grading:** typed answers ignore case and punctuation, accept answers that only differ in accents (with a "watch the accents" note), accept the listed alternatives, expand English contractions ("I'm" = "I am") and forgive one typo in answers of 6+ letters. Grading works for every script (Cyrillic, Arabic, Devanagari, CJK, Hangul).
- **Listening:** uses the browser's `speechSynthesis`. If the browser has no voice for the course language, the exercise is skipped without penalty.

## Privacy

`/privacy` has a UK GDPR notice. **Before launch, fill in the operator name and privacy contact email** (search for `[operator name`). Users can download their data (Settings → Download my data) and delete their account. Guest records are deleted after 30 days of inactivity, and expired sessions are cleaned up on each start.

## Tests

```sh
npm test          # node:test, no dependencies: grading, learning path, every course file
```

## Status of this version (November 2026)

Built and checked in the development container: content generation for all 14 courses, the content validator, and `npm test` (grading for all scripts, lesson unlocking, and a check that every one of the 3,420 exercises accepts its own answer and rejects its wrong options). The client components (lesson player, all five exercise types, path map, course picker) were also bundled with esbuild against a locally available React 19 and clicked through in headless Chromium: the first lesson of every course plus several later lessons (with and without a speech voice, including one deliberate mistake), confirming the lesson completes, the mistake is re-asked and listed in the review, and the submitted answers pass the server's re-grading.

**Not run here:** npm could not reach the registry from the container, so `npm install`, `next build`, the API routes with PostgreSQL, the Docker image and the real Next.js app were **not** run for this version. No new npm dependencies were added. Before deploying, run `npm install && npm run build` (or `docker compose up -d --build`) and click through one lesson in a Latin-script course, Arabic and Japanese, including a listening exercise on a phone.

**Upgrade note:** lesson ids changed from the MVP (`u1s1l1` to `u1l1`) when skills were replaced by the learning path, so lesson progress saved by the earlier MVP does not carry over. XP, streaks and accounts are unaffected.

## Content review

The courses use basic, high-frequency material, but they were written without a native-speaker review. Recommended before a public launch: one native speaker per language spends about an hour on `scripts/courses/<id>.py` (every sentence and accepted alternative is on one line), then run `python3 scripts/gen-content.py && npm test`.
