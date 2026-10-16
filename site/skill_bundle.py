"""Build the installable interview skill in skills/cooking-agi-interview/ from the notes.

The notes stay the single source. This script copies the English notes into the skill (stripped of
site-only markup, so an agent can read them as plain markdown) and pulls their questions into a
question bank:

- interview Q&A: <details class="interview"> / <details class="qa"> anywhere, plus any top-level
  <details> under an "interview" heading (answer included)
- quick-learning cards: <details> under a "Quick learning" heading (answer included)
- self-check items: the <li> of a note's taste-check box (no answer: grade against the note)

Topics follow site/nav.toml, so the skill's topic list matches the site's sidebar.

    python site/skill_bundle.py           # rebuild the skill bundle
    python site/skill_bundle.py --check   # exit 1 if the committed bundle is stale

Standard library only: the skill is installed on machines that have nothing but Python.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SKILL = ROOT / "skills" / "cooking-agi-interview"
GENERATED = ("data", "notes")
REPO_URL = "https://github.com/tianyi-zhang-02/cooking-agi/blob/main/"
# folders that are about the project itself rather than interview material
SKIP_DIRS = {"community", "templates", "papers"}
# note folders the site does not list in its sidebar but that still hold review material
EXTRA = {"quant": ("Quant review", "量化复习")}


def published_sources(nav):
    """(nav section, zh source) in sidebar order; mirrors site/paritycheck.py."""
    claimed = {s for sec in nav["section"] for s in sec.get("include", [])}
    seen = set()
    for sec in nav["section"]:
        d = ROOT / sec["dir"]
        files = [p for p in d.glob("*.md") if not p.name.endswith(".en.md")
                 and p.relative_to(ROOT).as_posix() not in claimed] if d.exists() else []
        files += [ROOT / s for s in sec.get("include", []) if (ROOT / s).exists()]
        if sec["dir"] == ".":
            files = [p for p in files if p.name in sec.get("order", [])]
        rank = {n: i for i, n in enumerate(sec.get("order", []))}
        for src in sorted(files, key=lambda p: (rank.get(p.name, 999), p.name)):
            if src not in seen:
                seen.add(src)
                yield sec, src


def extra_sources():
    """(pseudo nav section, zh source) for EXTRA folders, one topic per subfolder."""
    for top, (en, zh) in EXTRA.items():
        for src in sorted((ROOT / top).rglob("*.md")):
            if src.name.endswith(".en.md"):
                continue
            sub = src.parent.relative_to(ROOT).as_posix()
            name = src.parent.name.replace("-", " ")
            yield ({"dir": sub, "en": en if sub == top else f"{en}: {name}",
                    "zh": zh if sub == top else f"{zh}：{name}", "group": top}, src)


def topic_id(directory: str) -> str:
    """'00-foundations/core' -> 'foundations-core'"""
    parts = [re.sub(r"^\d+-", "", p) for p in directory.split("/")]
    return re.sub(r"[^a-z0-9]+", "-", "-".join(parts).lower()).strip("-") or "start-here"


def text_of(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def top_level_details(body: str):
    """(opening tag, summary text, inner markdown) for each outermost <details>."""
    out, depth, start, tag = [], 0, None, ""
    for m in re.finditer(r"<details[^>]*>|</details>", body):
        if m.group(0).startswith("<details"):
            if depth == 0:
                start, tag = m.end(), m.group(0)
            depth += 1
        elif depth:
            depth -= 1
            if depth == 0 and start is not None:
                block = body[start:m.start()]
                s = re.search(r"<summary>(.*?)</summary>", block, flags=re.S)
                if s:
                    out.append((tag, text_of(s.group(1)), block[s.end():].strip()))
                start = None
    return out


def clean_md(md: str) -> str:
    """Site markup out, readable markdown in. Relative links between notes keep working because
    the bundle keeps the repository's folder layout."""
    md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
    md = re.sub(r"<svg\b.*?</svg>", "", md, flags=re.S)
    md = re.sub(r"<(script|style)\b.*?</\1>", "", md, flags=re.S)
    md = re.sub(r"(?m)^(#{1,6} .*?)[ \t]*\{#[^}]*\}[ \t]*$", r"\1", md)
    md = re.sub(r"<a\b[^>]*>(.*?)</a>", r"\1", md, flags=re.S)
    md = re.sub(r"<nav\b.*?</nav>", "", md, flags=re.S)
    md = re.sub(r"!\[([^\]]*)\]\([^)]*\)", lambda m: f"[figure: {m.group(1)}]" if m.group(1) else "", md)
    md = re.sub(r"<summary>(.*?)</summary>", lambda m: f"\n**{text_of(m.group(1))}**\n", md, flags=re.S)
    md = re.sub(r"</?(details|div|span|figure|figcaption|section|aside|p|ol|ul|strong|em|b|i|small|code|br)\b[^>]*>",
                lambda m: {"<li>": "- "}.get(m.group(0), ""), md)
    md = re.sub(r"<li\b[^>]*>", "- ", md).replace("</li>", "")
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip() + "\n"


def note_title(text: str, fallback: str) -> str:
    m = re.search(r"(?m)^# (.+)$", text)
    return m.group(1).strip() if m else fallback


def note_questions(text: str):
    """(kind, section heading, question, answer markdown) for every question a note contains."""
    out, seen = [], set()
    parts = re.split(r"(?m)^(#{2,3} .*)$", text)
    sections = [("", parts[0])] + [(parts[i], parts[i + 1]) for i in range(1, len(parts), 2)]
    for head, body in sections:
        h = re.sub(r"\s*\{#.*", "", head.lstrip("# ")).strip()
        is_interview = bool(re.search(r"interview", h, re.I))
        is_quick = bool(re.search(r"quick (learning|review)", h, re.I))
        for tag, q, answer in top_level_details(body):
            if not q or re.match(r"(deep dive|deeper|code|show|full|derivation)", q, re.I):
                continue
            if 'class="interview"' in tag or 'class="qa"' in tag or is_interview:
                kind = "interview"
            elif is_quick:
                kind = "concept"
            else:
                continue
            q = re.sub(r"^(Q?\d+[.、:)]|Q:)\s*", "", q)
            if q not in seen:
                seen.add(q)
                out.append((kind, h, q, clean_md(answer)))
    box = re.search(r'<div class="taste-check[^"]*">(.*?)</div>', text, flags=re.S)
    if box:
        for li in re.findall(r"<li>(.*?)</li>", box.group(1), flags=re.S):
            q = text_of(li)
            if q and q not in seen:
                seen.add(q)
                out.append(("self-check", "Self-check", q, ""))
    return out


def build(dest: Path) -> dict:
    nav = tomllib.loads((SITE / "nav.toml").read_text(encoding="utf-8"))
    topics, bank = {}, []
    for sec, src in [*published_sources(nav), *extra_sources()]:
        en = src.with_name(src.stem + ".en.md")
        rel = en.relative_to(ROOT).as_posix()
        if not en.exists() or rel.split("/")[0] in SKIP_DIRS or "/" not in rel:
            continue
        text = en.read_text(encoding="utf-8")
        tid = topic_id(sec["dir"] if sec["dir"] != "." else "")
        topic = topics.setdefault(tid, {"id": tid, "title": sec["en"], "title_zh": sec["zh"],
                                        "group": sec.get("group", ""), "notes": [], "questions": 0})
        if rel in {n["path"] for t in topics.values() for n in t["notes"]}:
            continue
        out = dest / "notes" / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f"<!-- source: {REPO_URL}{rel} -->\n" + clean_md(text), encoding="utf-8")
        title = note_title(text, en.stem)
        qs = note_questions(text)
        topic["notes"].append({"path": rel, "title": title, "questions": len(qs)})
        topic["questions"] += len(qs)
        for kind, section, q, answer in qs:
            qid = hashlib.sha1(f"{rel}\n{q}".encode()).hexdigest()[:8]
            bank.append({"id": qid, "topic": tid, "kind": kind, "question": q, "answer": answer,
                         "note": rel, "note_title": title, "section": section})
    topics = [t for t in topics.values() if t["notes"]]
    (dest / "data").mkdir(parents=True, exist_ok=True)
    dump = lambda obj: json.dumps(obj, ensure_ascii=False, indent=1) + "\n"
    (dest / "data" / "topics.json").write_text(dump(topics), encoding="utf-8")
    (dest / "data" / "bank.json").write_text(dump(bank), encoding="utf-8")
    return {"topics": len(topics), "notes": sum(len(t["notes"]) for t in topics),
            "questions": len(bank), "with_answers": sum(1 for b in bank if b["answer"])}


def tree(d: Path) -> dict:
    return {p.relative_to(d).as_posix(): p.read_bytes() for g in GENERATED for p in (d / g).rglob("*") if p.is_file()}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="fail if the committed bundle is stale")
    args = ap.parse_args()
    if args.check:
        with tempfile.TemporaryDirectory() as tmp:
            stats = build(Path(tmp))
            if tree(Path(tmp)) != tree(SKILL):
                print("skill bundle is stale: run  python site/skill_bundle.py", file=sys.stderr)
                return 1
        print("skill bundle is up to date", stats)
        return 0
    for g in GENERATED:
        shutil.rmtree(SKILL / g, ignore_errors=True)
    print(build(SKILL))
    return 0


if __name__ == "__main__":
    sys.exit(main())
