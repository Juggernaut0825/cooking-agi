# Agents: how they are used in different settings

[中文](scenarios.md) · **English**

> Reading time: ~3 min · Level: advanced · Last reviewed: 2026-10

## The key difference: can the result be checked automatically?

Writing code and booking a flight are both called agents, yet they are entirely different jobs. The biggest difference is **whether you can tell automatically, once it is done, whether it was right**: where results can be verified, an agent can try several times in a sandbox, and a person still reviews the diff once the tests pass; where they cannot, every step leans more on a person.

| Setting | Environment and tools | Automatically verifiable? | Most common failure | Guardrails |
| --- | --- | --- | --- | --- |
| Coding | repository, shell, tests | partly: tests check covered behavior | tests pass but the logic is wrong; editing tests to make them pass | sandboxed execution; diff review; restricted credentials and network |
| Search and research | search, reading web pages | partly: sources can be checked | invented citations; not knowing when to stop | require sources; set a budget |
| Customer support | order and user systems, policy documents | partly: rules can be checked | breaking policy; answering the same question differently each time | limit tool permissions; hand hard cases to a person |
| Data analysis | SQL, notebooks | partly: queries run, but results still need checking | a wrong join or filter whose result still looks plausible | show the query; check row counts and definitions |
| Using a computer or browser | web pages, graphical interfaces | weakly | breaking when the interface changes; instructions injected by page content | confirm irreversible actions; isolated environment |
| Personal assistant | email, calendar, memory | weakly | acting on stale memory; leaking private data | confirm before sending; memory can be corrected |

## Coding: the strongest verification signal

Compilers, tests, and static checks provide repeatable feedback for many coding steps, but not every step has an adequate grader, and tests can be wrong. SWE-bench evaluates changes against real GitHub issues and tests. On 2026-02-23, OpenAI stopped reporting Verified and recommended [SWE-bench Pro](https://arxiv.org/abs/2509.16941), citing flawed grading and evidence of training contamination, not proof that all tasks were solved ([source](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)). See [Test-time compute: reading the numbers](../11-frontier/test-time-compute/measuring.en.md) for benchmark discrimination and contamination. Real projects still need requirements coverage, security checks, and diff review; passing tests cannot replace them.

## Customer support: reliability beats one-off success

Answering the same customer question correctly once and incorrectly next time undermines reliability. τ-bench simulates users and tools under policy constraints. Its pass^k is the probability that k independent runs of the same task all succeed, averaged over tasks. One task with 90% per-run success succeeds in all eight runs with probability $0.9^8\approx0.43$. Do not raise the overall average success rate to the eighth power: tasks differ in difficulty. [τ²-bench](https://arxiv.org/abs/2506.07982) adds telecom support with dual control, where the user must operate a device under the agent's guidance. As of October 2026 the [repository](https://github.com/sierra-research/tau2-bench) has released τ³-bench. Its July 2026 v1.0.1 corrected banking_knowledge task errors: **that domain's** scores are not comparable across the fix; the maintainers explicitly say other domains are unaffected.

## Agents that read outside content: beware of injection

Web pages, email, and documents can carry indirect prompt injection. Outside text cannot expand authorization, but stating that in a prompt is not a security boundary. The execution layer must constrain readable resources, credentials, outbound destinations, and action scope; confirm concrete parameters before high-risk actions or actions beyond existing authorization. Read-only tools can still disclose private text in search queries or URLs. Test those exfiltration paths, not only file writes. [OWASP: layered defenses and tool checks](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

## How to evaluate

- code: choose SWE-bench / SWE-bench Pro for the task, recording versions and contamination limits;
- web tasks: WebArena;
- using a computer: OSWorld;
- dialogue and tools under policy constraints: τ-bench and its successors τ²/τ³-bench.

Public benchmarks are only a start: before launch, build an evaluation set on your own tasks and look at complete run traces; see [Agent Observability](../06-systems/agent-observability.en.md) and [Evaluation](../07-evaluation/README.en.md).
