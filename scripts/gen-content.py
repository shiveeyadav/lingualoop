#!/usr/bin/env python3
"""
Dev-time content generator for LinguaLoop.

The app only reads content/<course>.json (units -> lessons -> exercises). This
script builds those files from the hand-written sources in scripts/courses/:

  * scripts/courses/<id>.py with a T dict  -> concept-based course. The English
    side lives in scripts/courses/_concepts.py; the file only gives translations
    (and romanization for non-Latin scripts).
  * scripts/courses/<id>.py with units/skills -> older layout (Spanish,
    Portuguese); every skill becomes a unit.

    python3 scripts/gen-content.py            # all courses
    python3 scripts/gen-content.py french     # just one

Output is deterministic (seeded RNG). Not used at runtime.
"""
import importlib
import json
import os
import random
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "courses")
OUT = os.path.join(HERE, "..", "content")
sys.path.insert(0, SRC)

from _helpers import parse_entry  # noqa: E402
import _concepts  # noqa: E402

LESSON_TITLES = ["New words", "More words", "Sentences", "Unit review"]


# ---------------------------------------------------------------- text helpers

def is_punct(ch):
    return unicodedata.category(ch).startswith("P") and ch not in "'’-"


def tokens(s):
    """Words of a sentence, punctuation trimmed. Spaces mark word boundaries,
    also in Chinese/Japanese sources (they are removed for display)."""
    out = []
    for raw in s.split():
        t = raw
        while t and is_punct(t[0]):
            t = t[1:]
        while t and is_punct(t[-1]):
            t = t[:-1]
        if t:
            out.append(t)
    return out


def strip_latin_marks(s):
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[̀-ͯ]", "", s)
    return unicodedata.normalize("NFC", s)


def norm(s):
    """Loose form used to keep distractors distinct (accents ignored)."""
    s = strip_latin_marks(s.lower()).replace("-", " ")
    s = re.sub(r"[^\w\s']", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def norm_keep_accents(s):
    # Accents matter here: "te" is not "té" (tea) and "el" is not "él" (he).
    s = unicodedata.normalize("NFC", s.lower()).replace("-", " ")
    s = re.sub(r"[^\w\s']", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def cap(s):
    return s[0].upper() + s[1:] if s else s


def words_in(text, vocab):
    """Vocabulary items (target form) that appear in a target-language text."""
    n = " " + norm_keep_accents(text) + " "
    found = []
    for v in vocab:
        for form in [v["t"]] + v["talt"]:
            if " " + norm_keep_accents(form) + " " in n:
                found.append(v["t"])
                break
    return found


# ---------------------------------------------------------------- sources

def item(t, e, ealt, talt, r, ralt=()):
    return {"t": t, "e": e, "ealt": list(ealt), "talt": list(talt), "r": r, "ralt": list(ralt)}


def from_concepts(mod):
    meta = dict(mod.COURSE)
    T = mod.T
    tips = getattr(mod, "TIPS", {})
    missing = [k for u in _concepts.UNITS for k, _, _ in u["vocab"] + u["sentences"] if k not in T]
    if missing:
        raise SystemExit("%s: missing translations for %s" % (meta["id"], ", ".join(missing)))
    units = []
    for u in _concepts.UNITS:
        def conv(rows):
            out = []
            for key, e, ealt in rows:
                t, talt, r, ralt = parse_entry(T[key])
                out.append(item(t, e, ealt, talt, r, ralt))
            return out
        units.append({
            "title": u["title"],
            "description": u["description"],
            "icon": u["icon"],
            "tip": tips.get(u["key"], ""),
            "vocab": conv(u["vocab"]),
            "sentences": conv(u["sentences"]),
        })
    meta["units"] = units
    return meta


def from_skills(mod):
    """Older layout: units -> skills; each skill becomes one unit."""
    c = mod.COURSE
    units = []
    for u in c["units"]:
        for sk in u["skills"]:
            units.append({
                "title": sk["title"],
                "description": u["description"],
                "icon": sk["icon"],
                "tip": sk["tip"],
                "vocab": [item(v["t"], v["e"], v["ealt"], v["talt"], v.get("r")) for v in sk["vocab"]],
                "sentences": [item(s["t"], s["e"], s["ealt"], s["talt"], s.get("r")) for s in sk["sentences"]],
            })
    meta = {k: v for k, v in c.items() if k != "units"}
    meta.setdefault("shortName", c["title"].split(" ")[0])
    meta["units"] = units
    return meta


def load(course_id):
    mod = importlib.import_module(course_id)
    spec = from_concepts(mod) if hasattr(mod, "T") else from_skills(mod)
    spec.setdefault("shortName", spec["title"])
    spec.setdefault("dir", "ltr")
    spec.setdefault("romanization", "")
    spec.setdefault("noSpaces", False)
    spec.setdefault("keyboard", [])
    check_source(spec)
    return spec


def check_source(c):
    roman = bool(c["romanization"])
    for u in c["units"]:
        where = c["id"] + " / " + u["title"]
        if len(u["vocab"]) < 8 or len(u["sentences"]) != 7:
            raise SystemExit("%s: need 8+ vocabulary items and exactly 7 sentences" % where)
        for it in u["vocab"] + u["sentences"]:
            if roman and not it["r"]:
                raise SystemExit("%s: '%s' needs a romanization" % (where, it["t"]))
        if roman:
            for s in u["sentences"]:
                a, b = tokens(s["t"]), tokens(s["r"])
                if len(a) != len(b):
                    raise SystemExit("%s: '%s' has %d words but romanization '%s' has %d" % (where, s["t"], len(a), s["r"], len(b)))


# ---------------------------------------------------------------- builder

class Builder:
    def __init__(self, course, rng):
        self.c = course
        self.rng = rng
        self.roman = bool(course["romanization"])
        self.nospace = bool(course["noSpaces"])
        self.allvocab = [v for u in course["units"] for v in u["vocab"]]
        self.lang = course["shortName"]

    # display form (Chinese/Japanese sources keep spaces between words for tiles)
    def d(self, text):
        return text.replace(" ", "") if self.nospace else text

    def tag(self, text):
        """SRS keys for a sentence: course vocabulary it contains, else the sentence itself."""
        found = words_in(text, self.allvocab)
        return found or [self.d(text)]

    def shuffled(self, items):
        items = list(items)
        self.rng.shuffle(items)
        return items

    def with_roman(self, ex, field, it):
        if self.roman:
            ex[field] = it["r"]
        return ex

    def options_with_roman(self, ex, items):
        """Shuffle option items, write options (+ optionsRoman for non-Latin scripts)."""
        items = self.shuffled(items)
        ex["options"] = [self.d(x["t"]) for x in items]
        if self.roman:
            ex["optionsRoman"] = [x["r"] for x in items]
        return ex

    def mc_vocab(self, v, vocab, direction):
        # Skip distractors that collapse to the same text without accents (avó / avô).
        others = [x for x in vocab if x is not v and norm(x["t"]) != norm(v["t"]) and norm(x["e"]) != norm(v["e"])]
        picks = self.rng.sample(others, 3)
        if direction == "t2e":
            opts = [cap(v["e"])] + [cap(x["e"]) for x in picks]
            ex = {
                "type": "mc",
                "instruction": "What does this mean?",
                "prompt": self.d(v["t"]),
                "promptLang": "target",
                "options": self.shuffled(opts),
                "answer": cap(v["e"]),
                "words": [v["t"]],
            }
            return self.with_roman(ex, "promptRoman", v)
        ex = {
            "type": "mc",
            "instruction": "Pick the correct translation",
            "prompt": cap(v["e"]),
            "promptLang": "en",
            "answer": self.d(v["t"]),
            "words": [v["t"]],
        }
        return self.options_with_roman(ex, [v] + picks)

    def mc_sentence(self, s, sentences):
        others = [x for x in sentences if x is not s]
        picks = self.rng.sample(others, 3)
        ex = {
            "type": "mc",
            "instruction": "What does this sentence mean?",
            "prompt": self.d(s["t"]),
            "promptLang": "target",
            "options": self.shuffled([s["e"]] + [x["e"] for x in picks]),
            "answer": s["e"],
            "words": self.tag(s["t"]),
        }
        return self.with_roman(ex, "promptRoman", s)

    def match(self, items):
        ex = {
            "type": "match",
            "instruction": "Match the pairs",
            "pairs": [[self.d(v["t"]), cap(v["e"])] for v in items],
            "words": [v["t"] for v in items],
        }
        if self.roman:
            ex["romans"] = [v["r"] for v in items]
        return ex

    def _target_tokens(self, s):
        toks = tokens(s["t"])
        romans = tokens(s["r"]) if self.roman else [None] * len(toks)
        return list(zip(toks, romans))

    def tap_target(self, s, sentences):
        ans = self._target_tokens(s)
        have = {t.lower() for t, _ in ans}
        pool = []
        for x in sentences:
            if x is s:
                continue
            for t, r in self._target_tokens(x):
                if t.lower() not in have and t.lower() not in {p[0].lower() for p in pool}:
                    pool.append((t, r))
        self.rng.shuffle(pool)
        tiles = self.shuffled(ans + pool[:3])
        ex = {
            "type": "tap",
            "instruction": "Build the sentence in " + self.lang,
            "prompt": s["e"],
            "promptLang": "en",
            "tiles": [t for t, _ in tiles],
            "answer": [t for t, _ in ans],
            "accepted": [self.d(a) for a in s["talt"]],
            "words": self.tag(s["t"]),
        }
        if self.roman:
            ex["tilesRoman"] = [r for _, r in tiles]
        if self.nospace:
            ex["joiner"] = ""
            ex["looseSpaces"] = True
        return ex

    def tap_english(self, s, sentences):
        ans = tokens(s["e"])
        have = {t.lower() for t in ans}
        pool = []
        for x in sentences:
            if x is s:
                continue
            for t in tokens(x["e"]):
                if t.lower() not in have and t.lower() not in {p.lower() for p in pool}:
                    pool.append(t)
        self.rng.shuffle(pool)
        ex = {
            "type": "tap",
            "instruction": "Build the sentence in English",
            "prompt": self.d(s["t"]),
            "promptLang": "target",
            "tiles": self.shuffled(ans + pool[:3]),
            "answer": ans,
            "accepted": s["ealt"],
            "words": self.tag(s["t"]),
        }
        return self.with_roman(ex, "promptRoman", s)

    def type_t2e(self, it, is_vocab=False):
        ex = {
            "type": "type",
            "instruction": "Type this in English",
            "prompt": self.d(it["t"]),
            "promptLang": "target",
            "answers": [cap(it["e"])] + [cap(a) for a in it["ealt"]],
            "words": [it["t"]] if is_vocab else self.tag(it["t"]),
        }
        return self.with_roman(ex, "promptRoman", it)

    def type_e2t(self, it, sentences, is_vocab=False):
        if self.roman and not is_vocab:
            # Typing whole sentences in a new script is not realistic for beginners;
            # build them from tiles instead.
            return self.tap_target(it, sentences)
        answers = [self.d(it["t"])] + [self.d(a) for a in it["talt"]]
        ex = {
            "type": "type",
            "instruction": "Type this in " + self.lang,
            "prompt": cap(it["e"]),
            "promptLang": "en",
            "answers": answers,
            "words": [it["t"]] if is_vocab else self.tag(it["t"]),
        }
        if self.roman:
            ex["answers"] += [it["r"]] + it["ralt"]
            ex["looseSpaces"] = True
            ex["romanAllowed"] = True
        return ex

    def listen(self, s, sentences):
        if self.roman:
            others = self.rng.sample([x for x in sentences if x is not s], 3)
            ex = {
                "type": "listen",
                "instruction": "Tap what you hear",
                "text": self.d(s["t"]),
                "roman": s["r"],
                "translation": s["e"],
                "words": self.tag(s["t"]),
            }
            return self.options_with_roman(ex, [s] + others)
        return {
            "type": "listen",
            "instruction": "Type what you hear",
            "text": s["t"],
            "translation": s["e"],
            "answers": [s["t"]],
            "words": self.tag(s["t"]),
        }

    def lessons_for_unit(self, unit):
        v, s = unit["vocab"], unit["sentences"]
        extra = v[8:] if len(v) > 8 else [v[1]]
        L1 = [
            self.mc_vocab(v[0], v, "t2e"),
            self.mc_vocab(v[1], v, "t2e"),
            self.mc_vocab(v[2], v, "e2t"),
            self.mc_vocab(v[3], v, "t2e"),
            self.match(v[0:4]),
            self.tap_target(s[0], s),
            self.listen(s[1], s),
            self.tap_english(s[2], s),
            self.type_t2e(s[0]),
        ]
        L2 = [
            self.mc_vocab(v[4], v, "t2e"),
            self.mc_vocab(v[5], v, "e2t"),
            self.mc_vocab(v[6], v, "t2e"),
            self.mc_vocab(v[7], v, "e2t"),
            self.match(v[4:8]),
            self.tap_target(s[3], s),
            self.tap_english(s[4], s),
            self.listen(s[3], s),
            self.type_t2e(s[5]),
            self.type_e2t(v[0], s, is_vocab=True),
        ]
        L3 = [
            self.mc_sentence(s[6], s),
            self.mc_vocab(extra[0], v, "t2e"),
            self.match(self.rng.sample(v, 5)),
            self.tap_target(s[6], s),
            self.tap_english(s[1], s),
            self.listen(s[5], s),
            self.type_e2t(s[4], s),
            self.type_t2e(s[2]),
            self.type_e2t(extra[-1], s, is_vocab=True),
            self.tap_target(s[5], s),
        ]
        rv = self.rng.sample(v, 6)
        L4 = [
            self.mc_sentence(s[0], s),
            self.match(rv[0:4]),
            self.mc_vocab(rv[4], v, "e2t"),
            self.tap_target(s[2], s),
            self.listen(s[6], s),
            self.tap_english(s[3], s),
            self.type_e2t(rv[5], s, is_vocab=True),
            self.type_t2e(s[1]),
            self.listen(s[4], s),
        ]
        return [L1, L2, L3, L4]


def build(spec):
    rng = random.Random("lingualoop:" + spec["id"])
    b = Builder(spec, rng)
    units = []
    for ui, unit in enumerate(spec["units"], start=1):
        uid = "u%d" % ui
        units.append({
            "id": uid,
            "title": unit["title"],
            "description": unit["description"],
            "icon": unit["icon"],
            "tip": unit["tip"],
            "lessons": [
                {"id": "%sl%d" % (uid, li), "title": LESSON_TITLES[li - 1], "exercises": ex}
                for li, ex in enumerate(b.lessons_for_unit(unit), start=1)
            ],
        })
    out = {
        "id": spec["id"],
        "title": spec["title"],
        "shortName": spec["shortName"],
        "nativeName": spec["nativeName"],
        "fromLanguage": "en",
        "speechLang": spec["speechLang"],
        "dir": spec["dir"],
        "romanization": spec["romanization"],
        "noSpaces": spec["noSpaces"],
        "keyboard": spec["keyboard"],
        "order": spec.get("order", 1000),
        "description": spec["description"],
        "units": units,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, spec["id"] + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    n = sum(len(l["exercises"]) for u in units for l in u["lessons"])
    print("%-12s %d units, %d lessons, %d exercises" % (spec["id"], len(units), len(units) * 4, n))


def all_ids():
    return sorted(f[:-3] for f in os.listdir(SRC) if f.endswith(".py") and not f.startswith("_"))


if __name__ == "__main__":
    ids = sys.argv[1:] or all_ids()
    for cid in ids:
        build(load(cid))
    print("Content written to", os.path.normpath(OUT))
