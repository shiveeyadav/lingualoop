"""Small helpers shared by the course source files (dev-time only)."""


def V(t, e, ealt=None, talt=None, r=None):
    """One vocabulary item or sentence: target text, English, English alternatives,
    target alternatives, romanization (non-Latin scripts only)."""
    return {"t": t, "e": e, "ealt": list(ealt or []), "talt": list(talt or []), "r": r}


S = V  # same shape for sentences


def parse_entry(spec):
    """Parses the compact form used by concept-based courses:

        "main | alternative | alternative @ romanization | other spelling"

    Alternatives and romanization are optional. Extra romanizations after the
    first are accepted when typing (e.g. Japanese "arigatō | arigatou").
    Returns (main, [alts], roman or None, [roman alts]).
    """
    roman, ralts = None, []
    if "@" in spec:
        spec, rpart = spec.split("@", 1)
        rs = [r.strip() for r in rpart.split("|") if r.strip()]
        roman, ralts = rs[0], rs[1:]
    parts = [p.strip() for p in spec.split("|")]
    parts = [p for p in parts if p]
    return parts[0], parts[1:], roman, ralts
