# A higher score, but a failing CI check

[中文](eval-report.md) · **English**

> Runnable project · Python 3.12 standard library · Reviewed 2026-10. Six fictional questions demonstrate a regression report. No model calls or API keys. Answers and pass/fail labels are hand-written teaching data.

You change a question-answering system. It goes from four correct answers out of six to five. That sounds ready to ship—until you open the results and notice that a question it previously handled with “I don't know” now gets an invented answer.

We'll build a small tool rather than introduce another evaluation framework. It reads two runs, pairs their cases, and produces an HTML report. If the result violates an agreed rule, it exits with a failure status that CI can use.

## One change worth opening {#example}

The fictional task is library question answering. Some questions include evidence; others deliberately don't. Case q5 asks whether the library opens on Sunday without providing a Sunday schedule. The expected behavior is to acknowledge the missing information, not guess.

| View | Baseline | Candidate | What changed |
| --- | --- | --- | --- |
| All six cases | 4/6 | 5/6 | About 16.7 percentage points higher |
| Four `evidence` cases | 2/4 | 4/4 | q1 and q2 improved |
| Two `no-evidence` cases | 2/2 | 1/2 | q5 now asserts Sunday opening without support |

**Two improvements and one regression give one more passing case.** A 16.7-percentage-point increase and a 25% relative increase use different denominators. Showing 4/6 → 5/6 keeps the counts visible.

For this exercise, we choose the rule first: every required case must pass, and the overall pass count must not fall. We mark q5 and q6 as required. The candidate therefore fails the gate despite its higher overall score. A real project needs its own requirements, not these six cases or a threshold chosen afterward to make a result look good.

### A green check is not evidence of general improvement {#gate-and-evidence}

Fix q5 and these rules will let the candidate through. That means this set of six questions meets the agreed conditions, not that the system will answer real users' questions better in general.

<div class="worked-table" markdown="1">

| Question | This report | Still needed |
| --- | --- | --- |
| Did a known critical failure recur? | Whether q5 and q6 pass this time | Representative new questions and missing failure types |
| What changed in this batch? | Two improvements, one regression, and the original answers | A check that the passed labels are correct |
| Will the improvement hold on other questions? | Six cases cannot establish that | Data kept out of debugging and an appropriate paired analysis |

</div>

Even if we temporarily treat the six questions as independent, identically distributed samples, two gains and one regression give p = 1 in a two-sided exact McNemar test. That does not show the models are equivalent; these data do not distinguish them under the test. The cases are handwritten anyway, not a measurement of real deployment traffic. [Two ways to get the same gain](../../07-evaluation/metric-robustness.en.md#paired-binary) has the derivation and two further comparisons; you do not need it to run this project.

That is why the comparator does not automatically add a p-value threshold. Catching known unacceptable failures and estimating overall benefit are separate jobs.

## Three inputs with separate jobs {#inputs}

<figure class="worked-update worked-update--pairs">
<ol>
<li><small>Fixed cases</small><strong>suite.json</strong><span>IDs, prompts, expected behavior, slices, and required-case flags.</span></li>
<li><small>Earlier run</small><strong>baseline.json</strong><span>An output and passed label for each case.</span></li>
<li><small>Proposed run</small><strong>candidate.json</strong><span>The same cases, paired by ID rather than line number.</span></li>
<li><small>Comparison</small><strong>HTML + JSON</strong><span>Counts, slices, individual changes, and the gate decision.</span></li>
</ol>
<figcaption>Slices and required cases belong to the fixed suite, not the candidate's results. All three files name the same suite version. After changing questions or grading rules, regenerate both runs before comparing them.</figcaption>
</figure>

The implementation is [eval_report.py](code/eval_report.py), with data under [eval-fixtures](code/eval-fixtures/suite.json). A result is small:

```json
{"id": "q5", "passed": false, "output": "Yes, it opens every Sunday."}
```

The script does not infer `passed` from `output`. **Grading and comparison are separate.** Bad labels can produce a polished report with a wrong conclusion. A real pipeline should record output provenance, model and prompt versions, and judge or human-grading rules. The `run` field here is only a name, not evidence that a model ran.

## Run the intentionally blocked example {#run}

Run from the repository root; no extra packages are needed. These commands use a macOS/Linux shell. On Windows, choose a fresh local output directory instead.

```bash
LAB=practice/web-lab/code
RUN_DIR=$(mktemp -d)
python3 "$LAB/eval_report.py" \
  --suite "$LAB/eval-fixtures/suite.json" \
  --baseline "$LAB/eval-fixtures/baseline.json" \
  --candidate "$LAB/eval-fixtures/candidate.json" \
  --out-dir "$RUN_DIR/blocked" --lang en
```

It prints `BLOCKED` and exits with **1**. That's the expected decision, not a broken program. Open `report.html` at the printed path. It needs no server and makes no external requests. The regressed q5 is expanded; click or press Enter to open other cases and compare their answers.

Keep the suite and baseline fixed, then use the corrected teaching result:

```bash
python3 "$LAB/eval_report.py" \
  --suite "$LAB/eval-fixtures/suite.json" \
  --baseline "$LAB/eval-fixtures/baseline.json" \
  --candidate "$LAB/eval-fixtures/candidate-fixed.json" \
  --out-dir "$RUN_DIR/fixed" --lang en
```

This prints `PASS`, exits with **0**, and gives 6/6 for the candidate. We changed q5's output and label in a fixture; **we didn't train a model**. Use `--lang zh` for a Chinese interface. Prompts and answers remain the original data rather than being translated automatically.

Use a fresh output directory each time. The script refuses to overwrite an existing one so an old report isn't mistaken for a new result. `report.json` contains the paired cases, gate decision, and SHA-256 of all three inputs. Hashes identify input bytes; they don't tell you whether an answer is correct.

## Don't silently score these inputs {#validation}

| Try this | Expected behavior | Why |
| --- | --- | --- |
| Remove q5 from the candidate | Exit 2 without a new report | Taking an intersection must not hide missing cases |
| Duplicate a case ID | Exit 2 | Arbitrarily keeping one row changes the evaluation |
| Replace `false` with `"false"` or `0` | Exit 2 | Accept JSON booleans explicitly, not implicit conversions |
| Reverse the result list | Same comparison | IDs, not positions, establish the pairing |
| Put `<script>…</script>` in an output | Display it as text | Model output is data, not executable HTML |
| Change the suite version without regenerating results | Exit 2 | Catch an explicit suite-version mismatch |

A version-name check cannot stop someone forgetting to update a name or deliberately reusing it. Input hashes also don't prove that the outputs came from that suite. In a real generation pipeline, record the actual suite-content hash at generation time rather than asking someone to type a matching name.

The teaching tool limits each file to 2 MiB and the suite to 1,000 cases. It isn't a large-scale evaluation service. Invalid input creates no output directory. A disk-write error exits with 2 and may leave an incomplete directory; don't treat that as a ready report. Run the boundary tests with:

```bash
python3 -m unittest discover -s site/tests -p 'test_eval_report.py'
```

## Keep the report when CI fails {#ci}

In **your own fork**, save this as `.github/workflows/eval-lab.yml`. It runs the comparator, not a website deployment. Fixed fixtures demonstrate the pipeline; this is not an LLM evaluation rerun on every PR. A real setup needs generation and grading steps first, with reviewed test sets, baselines, and release rules.

```yaml
name: Eval lab
on: [pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  compare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Compare supplied results
        run: |
          python practice/web-lab/code/eval_report.py \
            --suite practice/web-lab/code/eval-fixtures/suite.json \
            --baseline practice/web-lab/code/eval-fixtures/baseline.json \
            --candidate practice/web-lab/code/eval-fixtures/candidate.json \
            --out-dir eval-output
      - name: Keep the report, including a failed comparison
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: eval-report
          path: eval-output/
          if-no-files-found: error
```

The comparison exits with 1, failing the job. Upload still runs unless canceled, but doesn't turn the failed check green. Download the artifact and open its HTML to see which case triggered the rule. If invalid input prevented report creation, upload also fails; start with the earlier validation error. See GitHub's [exit-code documentation](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/set-exit-codes) and [status conditions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions).

These action tags illustrate the configuration, not a claim about the newest releases. Pin full commit SHAs and update them under your repository's policy for real use. The [artifact documentation](https://github.com/actions/upload-artifact/tree/v4) covers file upload and retention. **A report is another copy of the data**: don't include real private conversations, keys, or unauthorized data, and don't publish it automatically. This is a fork exercise; no new workflow is installed in this site's repository.

## Why no database, chart library, or LLM judge yet? {#tradeoffs}

| Choice | What it gives you | What it leaves out |
| --- | --- | --- |
| Fixed JSON, no database | The same inputs can be rerun by someone else | Multi-user access, queries, and large result storage |
| Python-generated static HTML | No server or frontend dependencies; a portable failure report | Live updates or editing grades in the browser |
| Supplied pass/fail labels | Focus on pairing, counting, and release rules | Automatic grading of open-ended answers |
| Escape outputs before display | Answers aren't executed as HTML | Sensitive information already present in the text is not removed |

Rendering uses Python's [`html.escape`](https://docs.python.org/3.12/library/html.html). The JSON reader explicitly rejects duplicate fields and nonstandard numeric constants rather than silently overwriting data; see the relevant [`json` behavior](https://docs.python.org/3.12/library/json.html). Understand the data flow before adding more components.

## Two questions to ask after it runs {#next}

First, does “unchanged” mean both versions passed or both failed? It only means the pass/fail labels match, not that the answer texts are identical. Open the case and read it. If a required case was already failing, this tool still blocks the change; “not worse” isn't enough.

Second, can one non-required slice regress while gains elsewhere compensate for it? **Yes.** This gate doesn't require every slice to hold its score. The slice table exposes the change. If your product needs a per-slice rule, agree on it before inspecting results and add tests; don't choose metrics afterward based on which version they favor.

Continue with [LLM-as-a-Judge](../../07-evaluation/llm-as-a-judge/README.en.md) for where labels come from, or [evaluation protocols](../../07-evaluation/benchmark-protocols.en.md) for splits, repeated runs, and uncertainty. This project makes results inspectable; it doesn't prove a model is better in general.

[Back to the project introduction](README.en.md)
