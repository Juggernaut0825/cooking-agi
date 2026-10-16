# System design: reading and trade-offs

[中文](system-design.md) · **English**

> Reading time: ~2 min · Last reviewed: 2026-10

> **Read this first**: interview formats and emphases change fast, so this is time-sensitive; it lists public resources and my own understanding only, with no company's questions or process.

I'm still learning system design too. This page keeps the public resources and ideas I've found useful. For hands-on practice, start with the [system-design exercises](../learn/system-design/README.en.md): a feed, a RAG knowledge base, or an assistant with memory.

## There is no fixed formula

I have not found a template that replaces reasoning about the problem. In practice, I check two things first: **can I explain the trade-offs behind each choice**, and **can I connect the system end to end**? These are my preparation priorities, not a scoring rubric shared by every employer.

So start from the basics:

1. What problem are we solving? What does success look like?
2. What data do we have? What data do we not have?
3. What are the constraints — scale, latency, cost, freshness?
4. For each step, what does this choice give up?

## An example: recommendation

Say you are building recommendations. Start from what you have:

- **If follows, friendships, or interactions are available**, use those relationships to find candidates. A graph need not be a social graph: [PinSage](https://arxiv.org/abs/1806.01973) uses Pinterest's item–board relationships. Keep these different data structures distinct.
- **No social graph, but some behavioral history?** Start with item–item co-occurrence or two-tower retrieval trained on interactions. Clicks and saves themselves define relationships; no social graph does not mean no interaction data.
- **Very few interactions at all?** New items can use titles, categories, or multimodal embeddings; new users can start with explicitly chosen interests or non-personalized candidates. A popularity fallback still needs other users' history—it is not available from nothing in a brand-new service. Content, manual rules, and popularity are baselines to compare, not guaranteed winners over complex models. [The YouTube recommendation paper (2016), §3.2–3.3](https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/) distinguishes watch history, side information, and training signals.

Every layer below that is a trade-off: how fast retrieval has to be, how large a model ranking can afford, how fresh the features must be, whether an offline gain will show up online, and whether the complexity is worth maintaining. Saying those clearly is worth more than reciting an architecture diagram.

## Public resources

General system design:

- [System Design Primer](https://github.com/donnemartin/system-design-primer): free, broad, good for building the skeleton
- [ByteByteGo](https://bytebytego.com): Alex Xu's *System Design Interview* series, heavily illustrated and easy to read
- [Designing Data-Intensive Applications, second edition](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/): a deeper treatment of data-system trade-offs, by Martin Kleppmann and Chris Riccomini, published by O'Reilly in 2026. Cross-check the edition against [the author's bibliography](https://martin.kleppmann.com/#publications). The publisher lists February 2026 and the author lists March; those records should not be presented as one precise release date

ML and recommendation:

- [Designing Machine Learning Systems](https://huyenchip.com/books/) (Chip Huyen)
- [Evidently's ML system design case collection](https://www.evidentlyai.com/ml-system-design): hundreds of public write-ups of real systems
- [Eugene Yan: system design for discovery](https://eugeneyan.com/writing/system-design-for-discovery/): the layered design of search and recommender systems
- [Twitter's open-sourced recommendation algorithm](https://github.com/twitter/the-algorithm): public components of a recommendation pipeline, not a complete deployable production service

## Related notes here

- [Search: how a model finds what it does not currently know](../04-search/README.en.md)
- [Modern AI systems: the model is only one part](../06-systems/README.en.md)
- [Agents: how they are used in different settings](../10-agents/scenarios.en.md)
- [Evaluation: why should we believe the system improved](../07-evaluation/README.en.md)
- [Kubernetes and GPU clusters](../12-infra/kubernetes.en.md): why distributed training needs gang scheduling, and why scaling inference is more than adding replicas (draft, pending review)
