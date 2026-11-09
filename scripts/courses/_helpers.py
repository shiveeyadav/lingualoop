"""Small helpers shared by the course source files (dev-time only)."""


def V(t, e, ealt=None, talt=None, r=None):
    """One vocabulary item or sentence: target text, English, English alternatives,
    target alternatives, romanization (non-Latin scripts only)."""
    return {"t": t, "e": e, "ealt": list(ealt or []), "talt": list(talt or []), "r": r}


S = V  # same shape for sentences


def parse_entry(spec):
    """Parses the compact form used by concept-based courses:

        "main | alternative | alternative @ romanization"

    Alternatives and romanization are optional. Returns (main, [alts], roman or None).
    """
    roman = None
    if "@" in spec:
        spec, roman = spec.split("@", 1)
        roman = roman.strip()
    parts = [p.strip() for p in spec.split("|")]
    parts = [p for p in parts if p]
    return parts[0], parts[1:], roman
