# vLLM and SGLang: what a generation engine actually does

[中文](inference-frameworks.md) · **English**

> Checked 2026-10-11 against public vLLM V1 and SGLang materials. Numbers below are teaching examples, not framework benchmark results.

If `generate()` can answer a question, why add an engine? A service has many users: short and long requests arrive together, clients disconnect, and several questions may share the same document. An engine organizes that work rather than giving each request exclusive use of the GPU from scratch.

Start with [prefill, decode, and KV caching](../00-foundations/deep-dives/kv-cache-and-inference.en.md). [A request through the service](llm-serving.en.md) follows execution more closely; this page focuses on architecture and selection.

## Application, engine, and kernels {#layers}

<figure class="worked-update" lang="en">
<ol>
<li><small>01 / Application</small><strong>Decide what to do</strong><span>Authorization, retrieval, tools, prompts, and deadlines. Do not pass unauthorized evidence to a model and hope it keeps it secret.</span></li>
<li><small>02 / Generation engine</small><strong>Schedule work and reuse state</strong><span>Queues, batches, KV management, workers, sampling, and output: the role of vLLM or SGLang.</span></li>
<li><small>03 / Runtime and kernels</small><strong>Execute the current work</strong><span>Model execution, attention, matrix multiplication, and communication. A faster kernel may leave queueing untouched.</span></li>
</ol>
<figcaption>These are responsibilities, not a required process layout. The engine is not the entire production security boundary.</figcaption>
</figure>

[vLLM V1 architecture](https://docs.vllm.ai/en/v0.21.0/design/arch_overview/) separates input/output handling in API servers, scheduling and cache management in engine cores, and model execution in GPU workers. Process counts depend on deployment. SGLang has its own request, scheduling, and execution paths; vLLM class names are not universal terminology.

More concretely, the [pinned SGLang Engine](https://github.com/sgl-project/sglang/blob/436d73ddda02d17d6d56e770a5362ebd5dd95ac0/python/sglang/srt/entrypoints/engine.py#L237) separates tokenization, scheduling, and detokenization:

```text
request → TokenizerManager → Scheduler → model execution
            ↑                                ↓
      response text ← DetokenizerManager ← output token IDs
```

TokenizerManager handles inputs and request results; Scheduler selects batches; the execution path runs forward passes; DetokenizerManager converts tokens to text. This omits multi-GPU topology and cross-instance routing, rather than promising exactly three processes in every deployment. It also helps diagnosis: low GPU load with slow requests may call for inspecting input preparation and output handling, not only attention kernels.

## Refill a batch as requests finish {#batching}

Take an idealized decode schedule. A and B have completed prefill and need two and five more tokens. C is ready and needs three. Each round accommodates two requests, producing one token each; ignore every other cost.

| Rounds | Wait for the entire batch | Refill between rounds |
| --- | --- | --- |
| 1–2 | A, B | A, B |
| 3–5 | B, with one empty slot | B, C |
| 6–8 | C | Finished |

Eight rounds versus five is a scheduling result under these assumptions, not a measured speedup. Real prefill, KV capacity, and history reads matter. Continuous batching does not admit unlimited work: requests still need queues, limits, or rejection when budgets are exhausted.

## Two ways to organize prefix reuse {#prefix}

Both engines support prefix reuse. “vLLM manages memory; SGLang does caching” is not a useful distinction.

| Question | vLLM V1 | SGLang RadixCache path |
| --- | --- | --- |
| How is reusable state organized? | Prefix-dependent block hashes and a block pool | A tree of shared token paths |
| What is the reuse boundary? | Full KV blocks in the referenced version | Depends on page size; not always single tokens |
| How is state managed? | References, free blocks, eviction, allocation | Locking, references, node splitting, eviction |
| What cannot be inferred? | Blocks do not prove better service performance | Trees do not prove better performance for every workload |

See the pinned implementations and page-alignment example in [cache lifecycle](../00-foundations/deep-dives/attention-kernels.en.md#cache-lifecycle). The [original SGLang paper](https://arxiv.org/abs/2312.07104) explains RadixAttention's context, not the complete feature boundary of today's products.

Suppose two requests share a 2,000-token document and each appends a 100-token question. The second may avoid recomputing shared prefill. Its new answer still attends to prefix KV. Reuse saves computation; it does not remove history. Weights, adapters, token IDs, positions, and multimodal inputs must be compatible too. Visually identical text is not sufficient.

Multi-tenant reuse also needs isolation. Cache-dependent timing can reveal whether content was present; caching is not authorization. [vLLM cache salting](https://docs.vllm.ai/en/v0.21.0/design/prefix_caching/) provides one reuse-isolation mechanism. The service must still assign trusted groups rather than letting clients claim another tenant's group.

## HiCache moves beyond GPU memory {#hicache}

[SGLang HiCache](https://docs.sglang.io/docs/advanced_features/hicache_design) extends KV storage across GPU memory, host memory, and storage backends. GPU and host tiers belong to inference instances; cross-instance reuse depends on the storage backend and namespace configuration. Two machines' RAM is not automatically one shared cache.

Consider hypothetical serial costs: recomputing a prefix takes 80 ms; restoring its KV takes 30 ms plus 5 ms for lookup and scheduling. Reuse could save about 45 ms. If transfer takes 100 ms instead, this reuse can lose. Real overlap needs a trace; this arithmetic only explains the decision.

Measure reused tokens, transferred bytes, restore time, and miss overhead alongside hit rate. Many short-prefix hits may save less work than a few long-prefix hits.

## Diagnose before adding another optimization {#bottlenecks}

| Symptom | Inspect first | Options to compare | Possible cost |
| --- | --- | --- | --- |
| Slow first token | Queueing, tokenization, prefill, cache | Chunking, prefix reuse, replicas | TTFT / ITL tradeoff; more memory |
| Uneven streaming | Decode batches, KV reads, contention | Scheduling, quantization, kernels, prefill/decode separation | Quality, transfers, operational complexity |
| Model does not fit | Weights, KV, workspace separately | Quantization, TP / PP | Communication and hardware constraints |
| Invalid JSON | Whether output constraints are enabled | Constrained decoding and validation | Valid syntax still permits false content |
| Speculative decoding is slower | Draft cost, acceptance, verification batch | Change or disable the draft method | Extra state and verification work |

Both engines evolve in model support, quantization, structured output, parallelism, and speculative decoding. Compare a **versioned model/hardware/feature combination**, not slogans about which engine is for agents or concurrency. FSDP handles [training state](training-frameworks.en.md); it is not another generation engine in this comparison.

## Design a meaningful comparison {#benchmark}

A single “hello” request is insufficient. Include short questions, long documents, shared-prefix conversations, bursts, and cancellations. Record input and actual output lengths. Fix weights, tokenizer, chat template, sampling, and hardware; separate cold starts from warmed runs.

| Report | Reason |
| --- | --- |
| TTFT, ITL, end-to-end p50 / p95 / p99 | Throughput hides waiting; short outputs still contribute TTFT |
| Input and output token throughput separately | They represent different computation |
| Requests/s meeting quality and latency requirements | Timeouts do not have the same value as useful completions |
| Timeouts, cancellations, rejections, OOMs, errors | Successful requests alone create survivor bias |
| GPU / CPU memory, network traffic, total cost | The bottleneck may move away from the GPU |

An open-arrival test keeps sending on schedule and exposes queue buildup. A closed-loop test waits for prior completions, so offered load can fall when the system slows. Both are useful if labeled, with offered and completed work reported. A shared seed does not guarantee identical generated text across engines, batches, or kernels; run quality and format regressions separately.

The outcome should be a reproducible record: versions, configuration, inputs, results, and failures. Continue with [serving and feedback](../practice/ml-system/serving-and-feedback.en.md) to place the engine inside a product.
