# Chronicle research: scope and unresolved checks

Checked 2026-10-12. This is a research log, not a claim that the tree now covers every AI-related field. The current iteration's accepted additions and evidence are recorded in [CHRONICLE_EVIDENCE.md](CHRONICLE_EVIDENCE.md). The main tree should stay readable; additional depth belongs in expandable branches and linked notes.

## What cross-checking means here

Separate four questions: **when did the event happen, what did the system actually do, where was it used, and what can we infer from it?** A paper can establish its own method and reported result, but not universal usefulness. A vendor archive can date a release, but cannot alone establish widespread adoption. Two pages from the same project can reconcile details without becoming independent validation.

| Area | Useful questions for the next expansion | Avoid |
| --- | --- | --- |
| Power and facilities | How did supply, cooling and facility design constrain deployable compute? | Treating FLOPS as usable capacity or forecasts as delivered power |
| Chips and memory | What changed in compute, bandwidth, capacity and data movement? | A company-product ladder presented as a universal history |
| Networks and distributed systems | What makes communication, failure handling and synchronization practical? | Claiming a protocol or consistency model is required for every ML job |
| Software and data systems | How do compilers, operating systems, databases and storage support repeatable work? | Calling every precursor an AI invention |
| Statistics, learning and evaluation | Which task, objective, dataset and measurement made the result meaningful? | A benchmark score presented as general intelligence |
| Robotics, control and sensing | How do perception, control, power and operator decisions work together? | Equating autonomy with RL or with end-to-end learned control |
| Speech, recommendation and search | How did deployed tasks shape objectives and evaluation? | Treating these fields as mere stepping stones to LLMs |

These are editorial prompts, not automatic agents that add nodes from a news feed. A contribution should explain the historical problem, the mechanism, and the boundary before proposing a place on the tree.

## ALVINN: a date worth explaining, not silently flattening

The [NeurIPS archive](https://proceedings.neurips.cc/paper/1988/hash/812b4ba287f5ee0bc9d43bbf5bbe87fb-Abstract.html) places the original ALVINN work in NIPS 1988. [CMU's publication record](https://publications.ri.cmu.edu/alvinn-an-autonomous-land-vehicle-in-a-neural-network) lists December 1989. The [1990 follow-up](https://proceedings.neurips.cc/paper/1990/hash/248e844336797ec98478f85e7626de4a-Abstract.html) describes learning from a driver's behavior; its paper explicitly refers back to the 1988 conference presentation.

Before adding a node, label the date convention as conference presentation versus publication record. Keep the original simulated-image training setup separate from the later real-time demonstration. The reported road-following tests do not establish unrestricted autonomous driving. Added on 2026-10-12 as `alvinn-1988`, dated by the NIPS 1988 paper with the CMU record noted.

## Speech evaluation: still an open reading task

[NIST's project overview](https://www.nist.gov/programs-projects/ai-measurement-and-evaluation/nist-ai-measurement-and-evaluation-projects) distinguishes ASR, speaker recognition and language recognition. Those are different tasks; a speaker-recognition evaluation is not an ASR milestone. A targeted historical ASR publication page could not be fetched in this pass. No guessed date or unread paper has been promoted to a node.

Next: inspect an accessible original evaluation report, its task and scoring procedure, then a separate contemporary use of that benchmark. The aim is to show why common datasets and comparable evaluations mattered, not merely list the first neural speech paper we find.

## Recommendation: another branch to develop carefully

The [2009 matrix-factorization article](https://ieeexplore.ieee.org/abstract/document/5197422/citations) is a candidate for explaining latent factors, implicit feedback and temporal effects in recommendation. The publisher metadata and abstract were checked, **not the complete article**. Do not turn its Netflix Prize framing into a claim that matrix factorization always beats neighborhood methods, or that recommendation began in 2009. Added on 2026-10-12 as `netflix-prize-matrix-factorization-2009` after reading the full article; what Netflix put into production is still unverified.

## Review remains bounded

This log and the source ledger distinguish accepted edits from candidate material and failed fetches. Structural tests establish valid IDs, translations and links, not the truth of the historical narrative. Do not turn the number of sources, agents or passing tests into a confidence score.
