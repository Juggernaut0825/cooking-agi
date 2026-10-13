# AI-assisted preliminary review

This is an optional, **maintainer-run advisory tool**, not a GitHub bot or a required merge check. It does not assign labels, post comments, approve PRs, merge, deploy, browse links, or execute submitted code. Human CODEOWNER review remains separate. Three model passes are not three independent human reviewers and may share the same blind spots.

## Three small roles

| Role | What it looks for |
| --- | --- |
| Technical | Mechanisms, equations, implementation reasoning, assumptions, and useful counterexamples |
| Teaching | Prerequisites, examples, progressive depth, natural bilingual explanation, and navigation |
| Evidence and safety | Claims needing sources or current-version checks, attribution, privacy, and non-public company information |

Each produces findings with a path and exact quote from the supplied text, a suggested next action, and uncertainty. Missing context becomes a question or limitation. A deterministic aggregator keeps all three reports, including disagreements and failed passes. It does not vote on truth or generate an approval score. The implemented flow is **selected snapshot → independent role outputs → local validation → deterministic evidence groups and coverage → human triage**. There is no model-based judge or automatic repair/retry loop.

## Prepare locally first

Use a trusted checkout of this script. Do not run a contributor's modified review script with an API key. A maintainer prepares a small JSON snapshot containing **only material approved for public review**:

```json
{
  "title": "Clarify a padding example",
  "question": "Does the explanation distinguish attention masking from loss masking?",
  "excerpts": [
    {"path": "example.md:12", "text": "The specific paragraph being reviewed."}
  ]
}
```

Paths are labels, not files to open. The runner reads only this selected snapshot and, in offline aggregation mode, the explicitly selected review bundle; never the parent workspace, entire repository, browser progress, environment files, or linked pages. Include relevant source excerpts yourself when a claim needs checking, within their reuse permissions. A URL alone does not count as source verification.

```sh
python site/review_assist.py /path/to/public-snapshot.json \
  --dry-run --output .local-review/first-pass
```

`--dry-run` is explicit but optional: it is the default when neither `--reviews` nor `--send-public-input` is supplied. It creates three request files plus `report.json` and `report.md`, without making a network call or looking up API credentials. **No reviewers actually run in dry-run mode**: every role and excerpt is marked `not-run`, not passed. Read the requests first. They can also be used with an approved review tool; that tool's data handling and permissions are separate. `.local-review/` is ignored by Git, but is not encrypted or a privacy guarantee. Requests and reports can contain the supplied text; do not publish them automatically.

## Aggregate saved reviews without an API

Save role outputs in one UTF-8 JSON bundle. Copy `snapshot_sha256` from the dry-run `report.json` for the **same snapshot**. Each supplied role contains the raw review object, not a request payload or a previous full report:

```json
{
  "snapshot_sha256": "COPY_THE_64_CHARACTER_HASH_FROM_REPORT_JSON",
  "roles": {
    "technical": {
      "findings": [{
        "priority": "normal",
        "path": "example.md:12",
        "quote": "The specific paragraph being reviewed.",
        "concern": "The paragraph does not state which mask it describes.",
        "suggestion": "Identify attention masking or loss masking explicitly.",
        "uncertainty": "The surrounding explanation was not supplied."
      }],
      "questions": ["Does the preceding paragraph define the mask?"],
      "limits": ["Only this excerpt was supplied; no code or source was verified."]
    }
  }
}
```

```sh
python site/review_assist.py /path/to/public-snapshot.json \
  --reviews /path/to/saved-reviews.json --output .local-review/triage
```

This is entirely local, requires no model or credentials, and never falls back to the API. The example intentionally supplies only one role: the useful technical finding is retained, the other two roles are `not-run`, and the command exits with code 2 for incomplete role coverage. Supply `teaching` and `evidence-safety` in the same format when available. An empty but valid review is `{"findings": [], "questions": [], "limits": []}`; it is a returned output, not evidence of correctness.

- The hash binds the title, question, and ordered excerpts, including whitespace in their text. JSON object key order and formatting do not affect it. It detects accidental snapshot mismatch; it does **not** authenticate a reviewer or prove what they read.
- Unknown role names, malformed bundle structure, hash mismatch, invalid JSON, and oversized input fail before creating an output directory. Snapshot files are limited to 100,000 bytes and saved bundles to 1,000,000 bytes.
- A missing role is `not-run`. A supplied malformed or ungrounded role is `needs-human-review`; its entire output is discarded with a generic error, while valid sibling roles survive. Fix or rerun that role explicitly. Exception details and rejected content are not copied into reports.
- Each valid role retains up to eight findings, ten questions, and ten limits, with the existing length bounds. Every finding requires an exact, case-sensitive quote of at most 500 characters from its named excerpt; whitespace and Unicode are not normalized.
- `--dry-run`, `--reviews`, and `--send-public-input` are mutually exclusive. Every run requires a fresh output directory; previous reports are never overwritten.

## Reading the triage artifacts

Every successful preparation or aggregation writes three `*.request.json` files, a machine-readable `report.json`, and a human-readable `report.md`. The Markdown renders supplied text as literal blocks, not executable HTML or clickable source/asset links. The JSON retains original validated review text.

**Evidence groups:** findings group only by identical `(path, quote)` and have stable quote-derived IDs. Groups sort by the highest reported priority (`important`, `normal`, `minor`), then path and excerpt position; the number of agreeing roles never affects priority. Every role's concern, suggestion, uncertainty, and original one-based finding index remains visible, including duplicate or opposing suggestions. `perspectives_differ` means the reported priority or wording differs, not that a contradiction has been proven. Overlapping quotes, paraphrases, and contradictions across different quotes remain separate; a human must compare them. There is no automatic dispute resolution or vote-to-approve.

**Quote locations:** character offsets are zero-based and end-exclusive; line numbers are one-based within the supplied excerpt. They are not byte offsets or whole-file line numbers, even when a path label resembles `file.md:12`. All exact occurrences, including overlaps, are counted; repeated quotes are explicitly ambiguous. To bound report size, only the first 20 locations per group are listed and truncation is marked.

**Coverage:** each excerpt lists its character count and all three role states: `findings-reported`, `no-findings-reported`, `not-run`, or `needs-human-review`. Counts measure returned findings, not correctness, source verification, or whether every part of the excerpt received attention. A valid role with no findings for an excerpt is not a pass. Unseen files and omitted context have no coverage.

**Role notes:** questions and limits stay attached to their originating role. Failed and missing roles are explicit. `execution_status` is `complete` only when all three roles returned valid outputs, `partial` when at least one did, `failed` when only failed outputs are available, and `not-run` when none were supplied. These describe availability, not an acceptance decision. Local aggregation and Markdown rendering are deterministic for the same snapshot and role outputs; optional remote execution also includes its existing generation timestamp and model metadata.

Exit code 0 means local preparation succeeded, or all three role outputs validated. Exit code 2 means invalid CLI/input or an incomplete review. For incomplete reviews, both reports are still saved; input/argument errors happen before output creation. **No exit code means approved.**

## Optional remote execution

Only after checking the complete snapshot, choose an API model that supports Responses structured outputs and configure `OPENAI_API_KEY` through your normal secret management. Do not paste the key into an issue, snapshot, source file, or command history. Use a **new** output directory:

```sh
python site/review_assist.py /path/to/public-snapshot.json \
  --output .local-review/second-pass --model "$REVIEW_MODEL" --send-public-input
```

The explicit flag sends the selected snapshot to the OpenAI API in up to three parallel, billed calls. There are no automatic retries, no tools, and a bounded output budget. No paid calls are part of normal CI or tests. This integration has local mocked tests; a live call still needs your selected model, credentials, and an approved public snapshot. Do not describe it as an activated service before it has been configured and tested.

The runner uses [Responses structured output](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), validates returned quote locations locally, and sets `store: false`. This does **not** make a remote request local or guarantee zero retention; check the provider's [data controls](https://developers.openai.com/api/docs/guides/your-data) and your account settings. The endpoint is fixed and redirects are not followed. No key is included in the saved requests or report.

Untrusted text can still manipulate a model's conclusions. Disabling tools and writes limits consequences but does not solve prompt injection or prove factual correctness. Do not auto-publish the raw report: even a review can repeat private text or contain a malicious suggestion. Read it, verify useful findings against sources and tests, then decide what to share.

## Human follow-through

1. Check the issue type and area; add missing context without making beginners complete a technical questionnaire.
2. Select and sanitize excerpts. Public issues are public immediately; AI review is not a privacy gate.
3. Run the optional roles. A failed, refused, or malformed response is an incomplete review, never a pass.
4. Reproduce code issues and open the actual sources for factual claims. Record what was checked and what remains uncertain.
5. Post only the findings you verified, explicitly marked as AI-assisted if relevant. Humans make assignments, approvals, and release decisions.

For a future GitHub integration, start with maintainer-triggered runs on trusted default-branch code and read-only permissions. Never execute a PR checkout with secrets or use an untrusted issue body as shell input. No such workflow is enabled by this change.

## Separate planning system: design only

The shared boundaries and proposed planning contract are in [AGENT_SYSTEMS.md](AGENT_SYSTEMS.md). The dashboard's editable route preview is deterministic; it does not invoke planning agents.

Content review is implemented first. A future planning system should consume an explicitly supplied goal, time budget, constraints, and public resource catalog—not browser records or inferred personal progress. Keep its roles separate: a prerequisite mapper proposes dependencies with resource references; a sequencer proposes milestones and order; a feasibility critic checks workload, missing prerequisites, and alternatives.

Its deterministic coordinator should validate resource IDs, dependency cycles, and budget arithmetic, preserve alternative sequences and unresolved constraints, and mark missing or failed role outputs as incomplete. A human chooses a plan rather than a majority vote selecting one. It must not treat review agreement as resource quality verification, silently schedule work, or write progress records. This is a design boundary only: this runner does not implement planning agents, scheduling, dashboard changes, or progress ingestion.

## 中文说明

这是维护者手动使用的三角色初审工具：分别看技术、讲解，以及依据与公开边界。先挑出可以公开的段落，再生成审核请求；默认只在本地生成文件，不调用模型。只有明确提供模型、密钥并加上 `--send-public-input`，才会发送到 API，最多三次付费调用。

`--dry-run` 会明确标记三个角色均未运行，并生成 JSON/Markdown 报告。已有角色输出可通过 `--reviews` 离线汇总，需匹配原始快照哈希；缺失或失败的角色不会使其他有效结果丢失。报告保留逐字引文、段落内位置、各角色不同意见及覆盖边界，不把无发现、意见一致或退出码 0 当作批准。规划系统仅在上文划定设计边界，尚未实现。

AI 只读你给的文字，不会替你查链接、跑代码或证明论文结论。三份意见会一起保留，失败和分歧也会写出来，不做投票式批准。模型可能被输入中的指令误导，所以不能自动发布报告、给权限或合并；维护者仍需核实问题，正常走人类审核。

日常反馈分为：内容纠错、信息过时、解释不清、想加主题、网站问题。Issue 一发出就公开，不要等初审帮你脱敏，也别提交私人进度 JSON。更具体的参与方式见 [CONTRIBUTING.md](../CONTRIBUTING.md)。
