"""
Grounded answers: simple BM25 search over official texts that YOU place in
backend/legal_sources/  (see legal_sources/README.md for the file format).

No extra packages, no vector DB. Index is rebuilt automatically when files change.
"""
import math
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List

SOURCES_DIR = Path(__file__).resolve().parents[2] / "legal_sources"
STOP = set("the a an of to in and or is are was were be by for on at as with from that this it its if not no any may shall".split())

_index: Dict = {"sig": None, "chunks": [], "df": Counter(), "avgdl": 0.0}


def _tok(s: str) -> List[str]:
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 1]


def _parse_file(path: Path):
    raw = path.read_text(encoding="utf-8", errors="ignore")
    title, url, body = path.stem, "", []
    for i, line in enumerate(raw.splitlines()):
        up = line.strip().upper()
        if i < 6 and up.startswith("TITLE:"):
            title = line.split(":", 1)[1].strip()
        elif i < 6 and up.startswith("URL:"):
            url = line.split(":", 1)[1].strip()
        else:
            body.append(line)
    return title, url, "\n".join(body)


SECTION_RE = re.compile(r"(?m)^\s*(?:Section\s+|Sec\.?\s+)?(\d{1,3}[A-Z]{0,2})\s*[\.\-–—:]\s+(?=\S)")


def _chunk(body: str):
    """Split at 'NN. Heading' style section starts; fall back to fixed windows."""
    marks = [(m.start(), m.group(1)) for m in SECTION_RE.finditer(body)]
    pieces = []
    if len(marks) >= 3:
        for i, (pos, label) in enumerate(marks):
            end = marks[i + 1][0] if i + 1 < len(marks) else len(body)
            pieces.append((f"Section {label}", body[pos:end].strip()))
    else:
        step = 1400
        for i in range(0, len(body), step):
            pieces.append((f"Part {i // step + 1}", body[i : i + step + 200].strip()))
    out = []
    for label, text in pieces:
        for j in range(0, len(text), 2000):  # cap chunk size
            out.append((label if j == 0 else f"{label} (cont.)", text[j : j + 2000]))
    return out


def _signature():
    if not SOURCES_DIR.exists():
        return ()
    return tuple(sorted((p.name, p.stat().st_mtime_ns) for p in SOURCES_DIR.iterdir() if p.suffix.lower() in (".txt", ".md") and p.name.lower() != "readme.md"))


def load_index(force: bool = False) -> Dict:
    sig = _signature()
    if not force and sig == _index["sig"]:
        return _index
    chunks = []
    if SOURCES_DIR.exists():
        for p in sorted(SOURCES_DIR.iterdir()):
            if p.suffix.lower() not in (".txt", ".md") or p.name.lower() == "readme.md":
                continue
            title, url, body = _parse_file(p)
            for label, text in _chunk(body):
                toks = _tok(label + " " + text)
                chunks.append({"act": title, "section": label, "text": text, "url": url, "tf": Counter(toks), "len": len(toks)})
    df: Counter = Counter()
    for c in chunks:
        df.update(c["tf"].keys())
    _index.update(sig=sig, chunks=chunks, df=df, avgdl=(sum(c["len"] for c in chunks) / len(chunks)) if chunks else 0.0)
    return _index


def status() -> Dict:
    idx = load_index()
    acts = sorted({c["act"] for c in idx["chunks"]})
    return {"acts": acts, "chunks": len(idx["chunks"])}


def search(query: str, k: int = 6) -> List[Dict]:
    idx = load_index()
    chunks, df, avgdl = idx["chunks"], idx["df"], idx["avgdl"]
    if not chunks:
        return []
    q = _tok(query)
    n, k1, b = len(chunks), 1.5, 0.75
    scored = []
    for c in chunks:
        s = 0.0
        for term in q:
            f = c["tf"].get(term, 0)
            if not f:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c["len"] / (avgdl or 1)))
        if s > 0:
            scored.append((s, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"act": c["act"], "section": c["section"], "text": c["text"], "url": c["url"], "score": round(s, 2)}
        for s, c in scored[:k]
    ]
