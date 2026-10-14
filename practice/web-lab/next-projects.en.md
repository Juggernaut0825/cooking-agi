# Pick one small feature you'd actually use

[中文](next-projects.md) · **English**

Once the reading list works, it doesn't need to become a large AI platform. Pick a feature you want, define what working means, and build it. The [evaluation report](eval-report.en.md) now has runnable code. Pagination, search, and background jobs below remain **extension exercises**, not implemented or deployed features.

## Choose the part you want to understand {#choose}

| What to learn | Small project | First-version boundary | A useful check |
| --- | --- | --- | --- |
| Requests and storage | Paginate the reading list | Fetch the next page by ID, without accounts | Insert new rows between pages; don't repeat or skip existing rows |
| Why search fails | Search ten chosen notes | Keyword search over titles and summaries, without an LLM | Write five queries with expected results; observe missed synonyms |
| Evaluation in engineering | [Run the report](eval-report.en.md), then add a slice-specific gate | Fixed examples, paired old/new outputs | Block the change under a pre-agreed rule when the overall score rises but one slice regresses |
| Background work | Import a document list | A local queue and one worker, no paid API | Restart midway without inserting completed work twice |

This isn't a difficulty ladder. Stop at [CI/CD](static-and-ci.en.md) if publishing a website was your question. Go straight to the evaluation report if that's closer to your ML work.

## Search: make the mistakes visible first {#search}

Choose ten public notes and keep `id, title, summary, url` in a small JSON file. Skip the vector database. A query about “splitting text into tokens” may miss a title containing only “Tokenization.” A small synonym mapping can demonstrate a change without an embedding API.

Record the top results for each query, not just whether the endpoint returned 200. If you add BM25 or embeddings later, hold the document snapshot, queries, and candidate count fixed. Inspect which queries improved and which got worse.

Crawling external sites adds licensing, access restrictions, versions, and untrusted content. Start with text you have the right to use rather than turning this into a crawler project. Continue with [TF-IDF / BM25](../../04-search/tfidf-and-bm25.en.md) or [the existing RAG exercise](../rag/README.en.md).

## Evaluation reports: look inside a one-point gain {#evaluation}

The [evaluation-report chapter](eval-report.en.md) turns “two improvements, one regression” into a runnable CLI and page. Missing cases, duplicate IDs, and incorrect label types fail validation. Start there rather than with an empty file.

A useful next step is a slice-specific gate: hold the change when the non-required `evidence` slice regresses even if the overall score holds. (Both `no-evidence` cases are required, so the current rule already blocks any regression there.) Write a failing example first, change the decision, and update the report's explanation of the rule too. Don't change the exit code while the page still describes the old policy.

You could also add runtime and token usage, but don't add quantities with different units into an unexplained “combined score.” For reliability beyond the teaching examples, read [evaluation protocols](../../07-evaluation/benchmark-protocols.en.md). One small-sample gain is not proof of better model quality.

## Background jobs: accepted isn't finished {#jobs}

Suppose an import handles 100 files. A browser waiting for the whole operation loses track when the page closes. Instead, return a job ID with `queued`, let a worker process it, and let the page query `running / succeeded / failed`.

| Change | Rule to add |
| --- | --- |
| Return `202` | It means accepted, not “Import complete” |
| A worker exits midway | Persist enough state to recover, not just in memory |
| A job is retried | Use stable file/version identifiers to avoid duplicate writes |
| One file fails | Record that failure rather than calling the whole batch successful |

Start with local files or SQLite for job state and demonstrate a restart before choosing a queue service. Locks, leases, backoff, and idempotency matter, but the first version doesn't need to solve every distributed-systems problem. [Post-training recovery](../post-training/checkpoint-and-resume.en.md) offers a different setting for comparing which state cannot be lost.

## Finish one before starting ten {#finish}

Leave four things in your README: a run command, one normal result, one failure example, and what remains unsolved. Ask a friend to run it using only those instructions and notice where they get stuck. That feedback often says more about the project's clarity than another homepage animation.

[Back to the project introduction](README.en.md)
