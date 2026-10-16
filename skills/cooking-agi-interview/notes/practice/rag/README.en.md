<!-- source: https://github.com/tianyi-zhang-02/cooking-agi/blob/main/practice/rag/README.en.md -->
# RAG in practice: build an assistant that cites its sources

[中文](README.md) · **English**

> Original teaching project · Fictional documents · Reviewed: 2026-10. Run retrieval and evidence handling without a model API. This is not a production deployment.

Connect a vector database, put its results into an LLM prompt, and you have a RAG demo. Using it exposes different problems: a policy changes but answers still cite the old version; a citation looks convincing but doesn't support the claim; or the retrieved document belongs to someone else.

This series uses a small knowledge base to explain document updates, retrieval, and answer checks. RAG—retrieval-augmented generation—retrieves external material for the model to use in its answer. Finding a passage doesn't establish that it is usable: versions, permissions, and content still matter. [Original paper](https://arxiv.org/abs/2005.11401)

## The deadline changed. Did the assistant notice?

A fictional community has an event policy. Version 1 says registration closes on Friday; version 2 changes it to Wednesday. A separate budget document is visible only to organizers. An ordinary member asks, “What's the registration deadline?”

| Document | Content | Valid evidence for this request? |
| --- | --- | --- |
| rules-v1 | Registration closes Friday | No: superseded |
| rules-v2 | Registration closes Wednesday | Yes: current and visible to members |
| budget-v1 | Internal organizer budget | No: unauthorized and irrelevant |

A good answer is simple: “Wednesday, according to event policy v2.” The difficulty is that a new policy can be effective before indexing finishes. In this project, missing current evidence means reporting that limitation, not filling the gap with the old deadline. Whether another application may show explicitly dated historical information is a separate decision.

## Separate document updates from user requests

- 01 / DOCUMENT UPDATEDeadline becomes WednesdayRecord version and permissions, not just new text.
- 02 / PREPARE EVIDENCESplit by sectionPreserve source locations; encode here if using vectors.
- 03 / UPDATE INDEXv2 becomes currentOld fragments can no longer stand for the current rule.
- 04 / USER REQUESTWhen does registration close?Use identity to search only visible, current content.
- 05 / SELECT EVIDENCEPut v2 into contextMerge, deduplicate, rerank, then pack within budget.
- 06 / ANSWERWednesday, according to v2Report missing evidence instead of silently citing v1.

Steps 1–3 handle document updates; 4–6 handle questions. Source IDs and revisions let us check the resulting answer.

The first three steps update the knowledge base; the next three serve a request. Document embeddings can be computed after an edit. Identity and the question arrive at request time, so an embedding cannot enforce authorization on its own.

The generator should receive more than paragraphs: include citation IDs, versions, and source locations. Those fields let us distinguish missing evidence, outdated evidence, and a model misreading evidence it actually received.

## Start with keyword retrieval

| First implementation | What it helps establish | What it doesn't solve |
| --- | --- | --- |
| Keyword matching with current-version and permission filters | Data ingestion and eligibility work | Paraphrases and complex semantics |
| Add embedding retrieval | Different wording can retrieve the same meaning | Numerical correctness, authorization, citation validity |
| Rerank a small candidate set | Put more useful passages near the top | Evidence missing from the candidate set |
| Add a generator | Turn evidence into a readable answer | Whether access to that evidence is allowed |

“What's the latest I can register?” may not contain the document's word “deadline.” That is a reason to test semantic retrieval. If “Does the new policy say Wednesday?” still retrieves an obsolete version, replacing the model is probably not the first fix.

Compare models with **the same document snapshot, questions, and context budget**. Otherwise, a larger context can be mistaken for a better encoder.

## How to read these three notes

1. This introduction defines the task and unacceptable failures.
2. [From documents to evidence](data-and-retrieval.en.md) covers versions, access, chunking, two retrieval lists, and context budgets, with runnable Python.
3. [A citation isn't proof](evidence-and-evaluation.en.md) covers insufficient or conflicting textual evidence, abstention, and regression tests. We stay with text here; image understanding is not implicitly included.

The code uses only the Python standard library. It exposes intermediate inputs and outputs, not a trained retriever, and it does not measure generated-answer quality.

## What counts as a working first version?

Check these four cases first:

- After an update, the old rule is no longer treated as current evidence.
- An unauthorized user's model context contains no private passages.
- Removing the supporting passage leads the system to report insufficient evidence.
- A retrieval-service failure is reported as a failure, not as “the knowledge base has no answer.”

Then integrate a generator and compare answer quality, latency, and cost. When something fails, you'll know where to start looking.

[Back to engineering practice](../README.en.md) · [Review retrieval foundations](../../04-search/README.en.md)
