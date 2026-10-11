import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import sys


MAX_BYTES = 2 * 1024 * 1024
MAX_CASES = 1000
LABELS = {
    "en": {
        "title": "What changed between two runs?", "toy": "LOCAL EVAL LAB · FIXED TEACHING LABELS",
        "blocked": "Hold this change", "ready": "This gate passed", "overall": "Overall",
        "improved": "Improved", "regressed": "Regressed", "unchanged": "Unchanged",
        "passed": "Pass", "failed": "Fail", "critical": "Required case", "slices": "By slice",
        "cases": "Case details", "baseline": "Baseline", "candidate": "Candidate",
        "expectation": "Expected behavior", "count": "Cases", "slice": "Slice",
        "rule": "Every required case must pass, and the overall pass count must not fall.",
        "limits": "This report compares supplied labels, not general model quality. It does not grade answers or call a model. The bundled six-case data is a teaching example.",
        "critical_failures": "Failed required cases", "overall_drop": "Overall pass count fell",
        "yes": "Yes", "no": "No", "none": "None", "provenance": "Input versions",
        "hashes": "SHA-256 identifies the input bytes; it does not certify label quality.",
    },
    "zh": {
        "title": "两次结果，到底哪里变了？", "toy": "本地评估练习 · 人工写好的教学标签",
        "blocked": "这次先别发布", "ready": "通过了这条检查", "overall": "整体结果",
        "improved": "答对了以前错的", "regressed": "以前会，现在错了", "unchanged": "结果没变",
        "passed": "通过", "failed": "未通过", "critical": "必须通过的题", "slices": "分开看两类问题",
        "cases": "具体是哪几题？", "baseline": "旧版本", "candidate": "新版本",
        "expectation": "预期行为", "count": "题数", "slice": "分类（slice）",
        "rule": "关键题必须全部通过，整体答对的题数也不能下降。",
        "limits": "这份报告只比较输入中的标签，不代表模型的整体水平，也不会判断答案对错或调用模型。附带的六道题是教学例子。",
        "critical_failures": "未通过的关键题", "overall_drop": "整体答对题数下降",
        "yes": "是", "no": "否", "none": "没有", "provenance": "这份报告用了哪些输入",
        "hashes": "SHA-256 用于核对输入文件是否相同，不能证明标签正确。",
    },
}
STYLE = """
:root {color-scheme:dark; --ink:#edece8; --muted:#b8b4ad; --line:#37342e; --accent:#e5b888}
* {box-sizing:border-box} body {margin:0;background:#141311;color:var(--ink);font:16px/1.65 system-ui,sans-serif}
main {max-width:1080px;margin:auto;padding:48px 24px 72px} h1 {font-size:clamp(28px,5vw,44px);line-height:1.2;margin:12px 0 24px}
h2 {margin-top:36px} h3,p {margin:10px 0} .eyebrow {color:var(--accent);font-size:12px;letter-spacing:.08em}
.muted,small {color:var(--muted)} .gate {padding:20px;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px}
.stats {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:20px 0}
.stat {background:#201e1a;padding:16px;border:1px solid var(--line);border-radius:10px} .stat strong {font-size:27px;display:block}
.cases {display:grid;gap:12px} details {background:#201e1a;border:1px solid var(--line);border-radius:10px;padding:16px}
summary {cursor:pointer;overflow-wrap:anywhere} summary:focus-visible {outline:2px solid var(--accent);outline-offset:5px}
.badge {display:inline-block;margin:0 10px 6px 0;font-size:12px;padding:2px 8px;border:1px solid currentColor;border-radius:20px}
.regressed {color:#f1aeaa} .improved {color:#b9d6b5} .unchanged {color:#c9c7c0}
.answers {display:grid;grid-template-columns:1fr 1fr;gap:16px}.answer {padding:12px;background:#141311;border-radius:6px}
.output {white-space:pre-wrap;overflow-wrap:anywhere}.table-wrap {overflow-x:auto} table {border-collapse:collapse;width:100%}
th,td {text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)} th {color:var(--muted);font-weight:500}
code {overflow-wrap:anywhere;font-size:.86em} dd {margin:0 0 12px;overflow-wrap:anywhere} dt {color:var(--muted)}
@media(max-width:600px) {main {padding:28px 16px 48px}.stats,.answers {grid-template-columns:1fr}.stat {padding:12px 16px} th,td {padding:8px}}
"""


def exact_keys(value, keys, context):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{context}: expected fields {', '.join(keys)}")


def text_value(value, context, limit=2000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"{context}: expected nonempty text up to {limit} characters")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError as error:
        raise ValueError(f"{context}: invalid Unicode") from error
    if any(ord(character) < 32 and character not in "\n\t\r" for character in value):
        raise ValueError(f"{context}: unsupported control character")


def reject_constant(value):
    raise ValueError(f"nonstandard JSON constant: {value}")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON field: {key}")
        result[key] = value
    return result


def read_document(path):
    with Path(path).open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("input exceeds 2 MiB")
    try:
        document = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object, parse_constant=reject_constant)
    except (UnicodeDecodeError, RecursionError) as error:
        raise ValueError("input must be bounded UTF-8 JSON") from error
    return document, hashlib.sha256(raw).hexdigest()


def indexed_rows(rows, fields, context):
    if not isinstance(rows, list) or not 1 <= len(rows) <= MAX_CASES:
        raise ValueError(f"{context}: expected 1..{MAX_CASES} rows")
    result = {}
    for row in rows:
        exact_keys(row, fields, context)
        identifier = row["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}", identifier):
            raise ValueError(f"{context}: invalid case ID")
        if identifier in result:
            raise ValueError(f"{context}: duplicate case ID {identifier}")
        for key in set(fields) - {"id", "passed", "critical"}:
            text_value(row[key], f"{context}.{key}", 80 if key == "slice" else 2000)
        for key in set(fields) & {"passed", "critical"}:
            if type(row[key]) is not bool:
                raise ValueError(f"{context}.{key}: expected JSON true or false")
        result[identifier] = row
    return result


def compare(suite, baseline, candidate):
    exact_keys(suite, ("suite", "cases"), "suite")
    text_value(suite["suite"], "suite name", 128)
    cases = indexed_rows(suite["cases"], ("id", "slice", "prompt", "expected", "critical"), "cases")
    runs = []
    for name, document in (("baseline", baseline), ("candidate", candidate)):
        exact_keys(document, ("suite", "run", "results"), name)
        text_value(document["run"], f"{name}.run", 128)
        if document["suite"] != suite["suite"]:
            raise ValueError(f"{name}: suite version differs")
        rows = indexed_rows(document["results"], ("id", "passed", "output"), name)
        if rows.keys() != cases.keys():
            raise ValueError(f"{name}: case IDs differ from the suite")
        runs.append(rows)
    old, new = runs
    rows = []
    for identifier, case in cases.items():
        before, after = old[identifier], new[identifier]
        change = "unchanged" if before["passed"] == after["passed"] else "improved" if after["passed"] else "regressed"
        rows.append({**case, "baseline": before, "candidate": after, "change": change})

    def summarize(selected):
        return {"count": len(selected),
                "baseline_passed": sum(row["baseline"]["passed"] for row in selected),
                "candidate_passed": sum(row["candidate"]["passed"] for row in selected)}

    overall = summarize(rows)
    critical_failures = [row["id"] for row in rows if row["critical"] and not row["candidate"]["passed"]]
    overall_drop = overall["candidate_passed"] < overall["baseline_passed"]
    return {
        "suite": suite["suite"], "baseline_run": baseline["run"], "candidate_run": candidate["run"],
        "overall": overall,
        "slices": {label: summarize([row for row in rows if row["slice"] == label]) for label in sorted({row["slice"] for row in rows})},
        "changes": {change: sum(row["change"] == change for row in rows) for change in ("improved", "regressed", "unchanged")},
        "gate": {"passed": not critical_failures and not overall_drop, "critical_failures": critical_failures, "overall_drop": overall_drop},
        "cases": rows,
    }


def render(report, language):
    labels = LABELS[language]
    escape = html.escape
    overall = report["overall"]
    count = overall["count"]
    before, after = overall["baseline_passed"], overall["candidate_passed"]
    stats = "".join(f'<div class="stat"><span>{labels[key]}</span><strong>{report["changes"][key]}</strong></div>'
                    for key in ("improved", "regressed", "unchanged"))
    slices = "".join(f'<tr><th scope="row">{escape(label)}</th><td>{values["count"]}</td><td>{values["baseline_passed"]}/{values["count"]}</td><td>{values["candidate_passed"]}/{values["count"]}</td></tr>'
                     for label, values in report["slices"].items())
    cards = []
    order = {"regressed": 0, "improved": 1, "unchanged": 2}
    for row in sorted(report["cases"], key=lambda item: order[item["change"]]):
        answers = "".join(f'<div class="answer"><small>{labels[side]} · {labels["passed" if row[side]["passed"] else "failed"]}</small><p class="output">{escape(row[side]["output"])}</p></div>' for side in ("baseline", "candidate"))
        critical = f' · {labels["critical"]}' if row["critical"] else ""
        opened = " open" if row["change"] == "regressed" else ""
        cards.append(f'<details{opened}><summary><span class="badge {row["change"]}">{labels[row["change"]]}</span><strong>{escape(row["id"])}</strong> · {escape(row["prompt"])}{critical}</summary><p class="muted">{labels["expectation"]}: {escape(row["expected"])}</p><div class="answers">{answers}</div></details>')
    hashes = "".join(f'<dt>{escape(name)}</dt><dd><code>{escape(digest)}</code></dd>' for name, digest in report["input_sha256"].items())
    failures = ", ".join(report["gate"]["critical_failures"]) or labels["none"]
    return f'''<!doctype html>
<html lang="{language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>{labels["title"]}</title><style>{STYLE}</style></head><body><main>
<p class="eyebrow">{labels["toy"]}</p><h1>{labels["title"]}</h1>
<p class="muted">{escape(report["suite"])} · {escape(report["baseline_run"])} → {escape(report["candidate_run"])}</p>
<section class="gate"><h2>{labels["ready" if report["gate"]["passed"] else "blocked"]}</h2>
<p>{labels["overall"]}: <strong>{before}/{count} → {after}/{count}</strong> ({before/count:.1%} → {after/count:.1%}, {(after-before)/count*100:+.1f} pp)</p>
<p>{labels["rule"]}</p><p>{labels["critical_failures"]}: {escape(failures)} · {labels["overall_drop"]}: {labels["yes" if report["gate"]["overall_drop"] else "no"]}</p></section>
<div class="stats">{stats}</div><p class="muted">{labels["limits"]}</p>
<h2>{labels["slices"]}</h2><div class="table-wrap"><table><thead><tr><th scope="col">{labels["slice"]}</th><th scope="col">{labels["count"]}</th><th scope="col">{labels["baseline"]}</th><th scope="col">{labels["candidate"]}</th></tr></thead><tbody>{slices}</tbody></table></div>
<h2>{labels["cases"]}</h2><div class="cases">{"".join(cards)}</div>
<h2>{labels["provenance"]}</h2><p class="muted">{labels["hashes"]}</p><dl>{hashes}</dl>
</main></body></html>'''


def main(arguments=None):
    parser = argparse.ArgumentParser(description="Compare supplied labels; no model calls or automatic grading.")
    parser.add_argument("--suite", required=True, type=Path)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--lang", choices=tuple(LABELS), default="en")
    options = parser.parse_args(arguments)
    try:
        documents, hashes = {}, {}
        for name in ("suite", "baseline", "candidate"):
            documents[name], hashes[name] = read_document(getattr(options, name))
        report = compare(**documents)
        report["input_sha256"] = hashes
        report["schema_version"] = 1
        markup = render(report, options.lang)
        serialized = json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        options.out_dir.mkdir(parents=True, exist_ok=False)
        (options.out_dir / "report.html").write_text(markup, encoding="utf-8")
        (options.out_dir / "report.json").write_text(serialized, encoding="utf-8")
    except (OSError, ValueError) as error:
        print(f"Input/output error; report not ready: {error}", file=sys.stderr)
        return 2
    print(f'{"PASS" if report["gate"]["passed"] else "BLOCKED"}: {options.out_dir / "report.html"}')
    return 0 if report["gate"]["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
