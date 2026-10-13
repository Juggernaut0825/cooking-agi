# Chronicle evidence: 66-node expansion (2026-10-12)

Checked: **2026-10-12**. Seven research passes drafted these nodes from primary sources; one editor merged them. Each section below is the pass's own record of what was read, which claims were kept and what stayed unverified. Edits made at merge time: track assignments, two dropped links into the Whirlwind core-memory node (same storage technology, not a reused design), one dropped LAION → Datasheets link (no explicit citation), and a few branch summaries shortened. Structural tests check IDs, translations, links and geometry, not historical truth.

## Vision / speech / language drafts: evidence log

Reviewed 2026-10-12. All PDFs were downloaded with curl and extracted with `pdftotext -layout`; arXiv dates come from the arXiv export API (`published` = v1). Nothing below was taken from memory alone. "Unverified" lists what I did not open or could not read.

Merge notes for the caller:

- `topics.models.tracks` in the current data already has `vision`, `speech`, `language`; no schema change needed.
- `kind: "open"` in the builder means "open question", so Whisper and SAM are `research`, not `open`.
- Three placements reuse existing branches whose `summary` names only the old works: `learning/statistics` (HMM, SVM; now + IBM models), `branching/language` (Transformer, BERT; now + ELMo), `scale-science/large-lm` (GPT-3; now + scaling laws). Consider a one-clause summary update.
- `public-tools` era summary says "generative models reach more people"; Whisper and SAM are not generative. Consider adjusting the era summary or accept the mismatch.
- `perception-without-finetuning` is defined once (in the Whisper placement) and referenced by id from the SAM placement.
- `topics.models.next` currently says speech history still needs expansion; after merging, it should acknowledge the DNN-HMM, WaveNet and Whisper entries.
- Connections are optional and all `uses`. If you want fewer vines, the most informative are resnet→faster-rcnn, gpt3→scaling-laws, dnn-acoustic→hmm, sam→vit; the LSTM/Transformer ones are generic.

---

## ibm-smt-1993 (language, research, adopted)

Read: Brown, Della Pietra, Della Pietra, Mercer, *The Mathematics of Statistical Machine Translation: Parameter Estimation*, Computational Linguistics 19(2), 1993 (ACL Anthology PDF), §§1–2, 4 (model overview), 5 (results, Table 1, Figures 5–7), 6 (6.1–6.3), 7. Koehn, Och & Marcu, HLT-NAACL 2003 (N03-1017), §§3.1, 4.6.

Claims kept:
- "Many people have been guided by this intuitive picture [understand, then express]" when building MT systems; Bayes split into language model / translation model / search; this paper treats the translation model, search "in a later paper".
- Five models; Models 1–4 are stepping stones to Model 5; EM; Model 1 has a unique local maximum (any initial guess avoiding zeros gives the same result).
- Data: Hansard pairs with ≤30 words each side, 1,778,620 pairs; vocab 42,005 English / 58,016 French; 2,437,020,096 t(f|e) entries; only 25,427,016 pairs co-occur (~1%); 12 EM iterations.
- Figure 5 "nodding" example: Models 1–3 link nodding to signe, oui; Model 5 to faire signe que oui; Il→he correct only in Model 1, later models link Il→It; authors say models lack linguistic sophistication.
- §6: ignoring morphology, one-word cepts only, deficiency → favors short English strings in decoding.
- §2/§7: Weaver 1949; their own 1988 and 1990 papers.
- Koehn 2003: phrase pairs extracted from Giza++ (toolkit for IBM models) word alignments; initial alignment from symmetrized IBM Model 4 (§4.6). Basis for `adopted`.

Unverified / not used: GIZA++ itself; any decoding paper by the IBM group; claims about rule-based MT dominance (not stated in the paper, so not written).

## sift-2004 (vision, research, adopted)

Read: Lowe, *Distinctive Image Features from Scale-Invariant Keypoints*, author PDF dated January 5, 2004 (cs.ubc.ca), §§1–2, 6 (descriptor), 7.1–7.3, 8 (recognition speed/range), 9. Crossref metadata for DOI 10.1023/B:VISI.0000029664.99615.94: IJCV 60(2), pp. 91–110, issued 2004-11. AlexNet NeurIPS 2012 PDF, Tables 1–2 and §6. OpenCV `features2d.hpp` (4.x branch, raw GitHub) and `doc/opencv.bib` entry `Lowe04`.

Claims kept:
- Harris detector very sensitive to scale; Lowe 1999 earlier work, this paper "more in-depth development and analysis ... improvements".
- ~2,000 stable features for a 500×500 image; 16×16 sample array, 4×4 cells × 8 orientations = 128.
- Ratio test 0.8: eliminates 90% of false matches, discards <5% of correct, database of 40,000 keypoints.
- Hough clustering, ≥3 features then verification; <0.3 s on 2GHz Pentium 4; planar ~50°, 3D ~30° rotation in depth.
- Conclusion: monochrome only; systematic testing on full 3D viewpoint/illumination data needed.
- AlexNet tables: "SIFT + FVs" rows for ILSVRC-2010 (Table 1) and ILSVRC-2012 (Table 2, 26.2% top-5 test, text calls it the second-best entry).
- OpenCV 4.x has `class SIFT` documented as "SIFT algorithm by D. Lowe @cite Lowe04". Basis for `adopted` (implementation evidence; not a usage survey).

Unverified: Springer article page (blocked; used Crossref instead); OpenCV HTML docs (Cloudflare challenge; used source on GitHub); the 1999 ICCV paper itself; SIFT patent history (not mentioned).

## dnn-acoustic-2012 (speech, research, historical)

Read: Google-archived draft dated April 27, 2012 (research.google.com/pubs/archive/38131.pdf → static.googleusercontent.com), §§I, II.E, III.D, IV.A–G, VI. Author-hosted magazine proof (cs.toronto.edu/~hinton/absps/DNN-2012-proof.pdf), checked the same numbers. Crossref for DOI 10.1109/MSP.2012.2205597: IEEE SPM 29(6), pp. 82–97, issued 2012-11, 11 authors.

Claims kept:
- GMM-HMM standard; MFCC/PLP engineered features; "GMMs are so successful that it is difficult for any new method to outperform them".
- Two decades earlier single-hidden-layer nets predicted HMM states; hardware/algorithms inadequate for deeper nets.
- Four groups (Toronto, MSR, Google, IBM); TIMIT successes starting 2009; LVCSR results from three groups.
- Posterior → scaled likelihood by dividing by state frequencies in the forced alignment; targets from baseline GMM-HMM forced alignment.
- Voice Input: 4 hidden layers × 2,560 units, 11 frames × 40 log filter-bank, 7,969 states; WER 12.3%, 23% relative better than best GMM.
- Switchboard: 309 h, 27.4% → 18.5% (33% relative), comparable to 18.6% SA multi-pass GMM with 2000 h.
- §VI retrospective: most gain from neighboring frames and tied context-dependent states; pre-training reduces overfitting and fine-tuning time, but similar training-time reductions from scaling initial weights; parallelizing fine-tuning a major issue.
- §IV.G: 1.6 s → 210 ms (8-bit, SIMD) → 66 ms GPU per 1 s of speech. Present in both draft and proof.

Unverified: IEEE Xplore page (not opened); exact online publication date; the individual original papers (Mohamed 2009, Dahl 2012, Seide 2011, Jaitly 2012) behind each result.

## faster-rcnn-2015 (vision, research, adopted)

Read: arXiv 1506.01497v1 (dated 4 Jun 2015 in the PDF stamp), §§1–5, Tables 1–4. NIPS 2015 proceedings page (title only). ResNet arXiv 1512.03385v1, §4.3. Mask R-CNN arXiv 1703.06870 abstract (API).

Claims kept:
- Proposals are the bottleneck; Selective Search 2 s/image on CPU; Fast R-CNN near real-time excluding proposals.
- RPN shares conv features; ~10 ms marginal cost; 5 fps VGG-16 including all steps; 15 fps ZF.
- Anchors: 3 scales (128², 256², 512²) × 3 ratios; ~20k anchors for 1000×600; top 300 proposals at test.
- Table 4 (K40, SS on CPU): SS+Fast R-CNN 1830 ms (proposal 1510); RPN 196 ms (proposal 10).
- Table 2: VOC 2007 test, 07+12 training: RPN shared 73.2% vs SS 70.0%.
- Shared conv layers initialized from ImageNet-classification pretraining (connection to imagenet-2009).
- Rectangles only; joint optimization left for future work.
- ResNet v1 §4.3: "We adopt Faster R-CNN as the detection method"; VGG-16 → ResNet-101 gives +6.0 on COCO mAP@[.5,.95] (28% relative).
- Mask R-CNN abstract: extends Faster R-CNN with a mask branch; code at Detectron. Basis for `adopted`.

Unverified: v3 extended report (only noted that it exists); NIPS camera-ready numbers.

## wavenet-2016 (speech, research, historical)

Read: arXiv 1609.03499v1 (stamp 12 Sep 2016), §§1–2.2, 3.1–3.2, Table 1, §3.4 (TIMIT), Appendix A (TTS background). arXiv API: v2 updated 2016-09-19. Parallel WaveNet 1711.10433v1 abstract.

Claims kept:
- Concatenative vs statistical parametric TTS; parametric "often sounds muffled and has artifacts".
- ≥16,000 samples/s; autoregressive factorization; causal + dilated convolutions, dilations 1…512 repeated, block receptive field 1,024.
- 16-bit → 65,536 values; μ-law to 256 levels; softmax.
- Parallel training / sequential generation.
- Data: NA English 24.6 h, Mandarin 34.8 h, professional female speakers. MOS Table 1: LSTM-RNN parametric 3.67/3.79, HMM concatenative 3.86/3.47, WaveNet (L+F) 4.21/4.08, natural 4.55/4.21.
- 240 ms receptive field; linguistic-only conditioning sometimes stressed wrong words; adding F0 fixed it. External F0/duration models.
- Unconditioned speech: non-existent words; ~300 ms receptive field, last 2–3 phonemes.
- Parallel WaveNet abstract: sequential generation poorly suited to parallel hardware, hard to deploy real-time; probability density distillation; no significant quality difference; >20× faster than real time; deployed in Google Assistant (multiple English and Japanese voices).

Unverified: DeepMind blog post and its date (not opened; the paper links it); Parallel WaveNet body; whether Google Assistant still uses it (not claimed). Status kept `historical` because adoption evidence is for the distilled successor, not the v1 model.

## sparse-moe-2017 (language, research, historical)

Read: arXiv 1701.06538v1 (stamp 23 Jan 2017, header "Under review as a conference paper at ICLR 2017"), §§1–4, 5.1–5.3. Switch Transformer 2101.03961v1 abstract (API).

Claims kept:
- Quadratic blow-up when whole model active per example; conditional computation challenges (branching, shrinking batch, bandwidth, balancing losses, dataset size); "no work to date has yet demonstrated massive improvements".
- MoE of up to thousands of feed-forward experts; trainable gating; applied between stacked LSTM layers; up to 137B parameters.
- Noisy top-k gating (Gaussian noise, keep top k, −∞, softmax); "theoretically scary discontinuities ... not yet observed this to be a problem in practice".
- Imbalance self-reinforcing; L_importance (CV² of batch gate sums) + L_load.
- 1B-word benchmark at ~8M ops/timestep: 4 always-active experts ≈ baseline; 4096 experts 24% lower perplexity; 4 experts active per input.
- 100B-word corpus: 65,536 experts (68B params) 39% lower than compute-matched baseline; 131,072 degrades, "possibly ... too much sparsity".
- WMT'14 BLEU 40.56 En→Fr, 26.03 En→De on modified GNMT.
- Jacobs et al. 1991; Eigen et al. 2013 MoEs as layers in deep models.
- Switch abstract: simplifies MoE routing; "widespread adoption has been hindered by complexity, communication costs and training instability". This is why status is `historical`, not `adopted`.

Unverified: ICLR 2017 acceptance (OpenReview and dblp were blocked by challenge pages), so the limit says only "marked as under review"; Switch Transformer body (e.g., top-1 routing details not claimed); Google affiliation of Switch authors (not claimed).

## elmo-2018 (language, research, historical)

Read: arXiv 1802.05365v1 (stamp 15 Feb 2018), §§1–5, Tables 1, 4 (nearest neighbours of "play"), 5 (WSD), 6 (POS). arXiv API comment: "NAACL 2018. Originally posted to openreview 27 Oct 2017. v2 updated for NAACL camera ready". NAACL PDF header: Proceedings of NAACL-HLT 2018, pp. 2227–2237, June 1–6, 2018. BERT arXiv (current version) §§1–2, Figure 3, Appendix A.4.

Claims kept:
- Traditional word vectors give one context-independent vector per word.
- biLM on ~30 million sentences (1B Word Benchmark); forward and backward LMs; 2 biLSTM layers 4096 units / 512 projection, char CNN.
- Task-specific weighted combination of layers; freeze biLM weights and concatenate ELMo with x_k (paper notes biLM often first fine-tuned on domain text; not detailed in the node).
- New SOTA on all six tasks; SQuAD 81.1 → 85.8 F1.
- "play" neighbours: GloVe sports-sense list; biLM neighbours separate sense and POS (examples paraphrased, not quoted).
- WSD: layer 1 67.4, layer 2 69.0; POS: layer 1 97.0, layer 2 95.8.
- Compares with CoVe and Peters et al. 2017 (not first contextual vectors).
- BERT: ELMo is feature-based; concatenation of independently trained L→R and R→L LSTMs; BERT fine-tunes; only BERT conditions on both sides in all layers.

Not used: the "6–20% relative error reduction" sentence, because Table 1 shows 24.9% for SQuAD and the two statements conflict within the paper.

## scaling-laws-2020 (language, research, historical)

Read: arXiv 2001.08361v1 (stamp 23 Jan 2020), abstract, §1.1–1.2, Figure 1, 3 captions, §2 (WebText2), §3 (model size range). GPT-3 arXiv PDF (current version) §§1, 2.1–2.3, Figures 2.2, 3.1, §6. Chinchilla arXiv 2203.15556v1 abstract, §1, §2, Table 2.

Claims kept:
- Power laws in N, D, C; some trends >7 orders of magnitude (abstract); shape matters weakly; non-embedding params 768 to 1.5B.
- "Researchers typically train smaller models for longer than would be maximally compute-efficient because of hardware constraints."
- 8× model → ~5× data (N^0.74/D); N ∝ C^0.73, B ∝ C^0.24, S ∝ C^0.03; Figure 3 billion-fold illustration; stop before convergence; loss must flatten before zero.
- GPT-3: Figure 2.2 caption ("Based on the analysis in Scaling Laws ... we train much larger models on many fewer tokens than is typical"); §2.3 larger batch / smaller LR "as found in [KMH+20, MKAT18]"; Figure 3.1 trend continues two more orders with small deviations (validation loss).
- Chinchilla: Kaplan implies 10× compute → 5.5× model, 1.8× tokens; 400+ models; equal scaling; fixed tokens/LR schedule critique; 70B vs Gopher 280B, same compute, 4× data, outperforms on many tasks; Table 2 exponents 0.73/0.27 for Kaplan vs ~0.5/0.5.

Unverified: nothing material. GPT-3 statements were read in the current arXiv version, which is what the gpt3 node's `abs` URL serves.

## whisper-2022 (speech, research, historical)

Read: arXiv 2212.04356v1 (stamp 6 Dec 2022), §§1, 2.1–2.4, Table 1, 3.3 (Figure 2, Table 2), 6, 7. GitHub API for openai/whisper (license MIT; earliest commits: "initial commit" 2022-09-21T15:43:20Z; repo `created_at` 2022-09-16, presumably private before release, not used). README (links blog, paper, model card).

Claims kept:
- wav2vec 2.0 self-supervised, up to 1,000,000 h; encoder only, needs fine-tuned decoder; fine-tuning needs skilled practitioner; brittle dataset-specific patterns.
- 680,000 h; 117,000 h in 96 other languages; 125,000 h X→en translation; automated filtering (not quantified in the node).
- 30 s segments; 80-channel log-Mel; off-the-shelf encoder–decoder Transformer (Vaswani 2017) "to avoid confounding our findings"; special tokens (language ×99, nospeech, transcribe/translate, notimestamps).
- Table 2: wav2vec 2.0 Large (no LM) vs Whisper Large V2, within 0.1% on LibriSpeech; 55.2% average relative error reduction; Common Voice 29.9→9.0; CHiME6 65.8→25.5. Warning about overstating capabilities vs humans.
- Table 1 sizes Tiny 39M … Large 1550M; V2 footnote: 2.5× more epochs, SpecAugment, Stochastic Depth, BPE dropout.
- §6: repeat loops, missing first/last words, hallucination; English-heavy, most languages <1000 h, poor on many languages. §2.4 speaker-name guessing.

Unverified: OpenAI blog post date (Cloudflare challenge); I used the public repository's initial commit date instead and say so. Model card not read.

## segment-anything-2023 (vision, research, historical)

Read: arXiv 2304.02643v1 (stamp 5 Apr 2023), §§1–5 (task, model, data engine, dataset), §8 (limitations, conclusion), Appendix A pointers (ViT-H/16, MAE). ICCV 2023 CVF open-access page (title/venue only). SAM 2 arXiv 2408.00714v1 abstract (API).

Claims kept:
- Masks not abundant online / no web-scale source; prior multi-task systems train and test on the same fixed tasks.
- Promptable segmentation (points, boxes, masks, exploratory text); ~50 ms per prompt in a browser after one image-encoder pass.
- Shirt vs person ambiguity; 3 output masks (whole, part, subpart); minimum-loss backprop; IoU prediction head.
- MAE pre-trained ViT-H image encoder; CLIP text encoder for text prompts; lightweight mask decoder.
- Data engine: assisted-manual (retrained 6×, 34 → 14 s per mask, 4.3M masks / 120k images), semi-automatic (5.9M masks / 180k images, not in node), fully automatic (32×32 grid, filtering, NMS); 1.1B masks / 11M images; 99.1% automatic.
- Limitations: fine structures, small disconnected components, less crisp boundaries; not real time overall with heavy encoder; text-to-mask not robust; unclear prompts for semantic/panoptic.
- Release: SAM under Apache 2.0; SA-1B for research purposes.
- SAM 2 abstract: streaming memory, real-time video, video data engine; on images more accurate and 6× faster than SAM.

Unverified: ICCV camera-ready numbers; SAM 2 body.

---

## Skipped candidates

- HOG (Dalal & Triggs 2005): SIFT already covers hand-designed local features in that era; one node is enough.
- YOLO (2015/2016): chose Faster R-CNN because its own v1 text quantifies the proposal bottleneck and later use (ResNet, Mask R-CNN) is sourced; YOLO arXiv metadata checked (v1 2015-06-08) but paper not read.
- T5 (2019): ELMo fills the gap between the existing word2vec and BERT nodes more directly; T5 not read.
- Chinchilla (2022) as its own node: read and used as the correction inside the scaling-laws node instead, to avoid two nodes on one question.

## Evidence log: software and distributed drafts

Drafted 2026-10-12. Draft data is in `software-distributed.json`, with 10 nodes, 10 placements, 12 connections and suggested `topics.next` text. No repository file was edited.

How sources were read: PDFs were fetched, saved locally, converted with `pdftotext -layout` and searched with grep. HTML pages were read through WebFetch, with prompts asking for verbatim sentences. Every number in the drafts comes from text that was read. Where a source could not be opened, this log says so.

## Global caveats

- **Nokia/Bell Labs pages:** `nokia.com/bell-labs/.../chist.html` returns HTTP 403 to the fetcher. Ritchie's C paper was read on the CS:APP mirror at csapp.cs.cmu.edu. Both URLs are cited, and the connection `source` uses the mirror.
- **NumPy paper:** the Nature page (s41586-020-2649-2) redirects to an authentication page and was not read. All NumPy claims come from arXiv v1, 2006.10256v1, dated 2020-06-18. The Nature URL is not cited.
- **TensorFlow 2015 whitepaper:** download.tensorflow.org failed with a TLS certificate mismatch and was not read. The release date comes from the Google Research blog post. TensorFlow details come from the OSDI 2016 paper.
- **ZeRO version:** arxiv.org/pdf/1910.02054v1 returned 404. The unversioned PDF served v3, dated 2020-05-13, and that is what was read. The existing `zero` node cites the unversioned abs URL. The zero → Megatron connection therefore rests on v3 text, and this log does not claim the same wording is in v1.
- **web.archive.org:** this source cannot be fetched in this environment.

## software-fortran-1957

**Read:**
- Backus et al., "The FORTRAN Automatic Coding System", 1957 Western Computer Proceedings, pp. 188–198. This is the OCR'd scan at softwarepreservation.computerhistory.org; the softwarepreservation.org URL redirects there.
- Backus, FORTRAN session transcript from the HOPL 1978 conference (`p45-backus.pdf`, same site), including its reference list.
- MPI 1.1 node5 (included interfaces).
- NumPy arXiv v1.

**Claims kept:**
- Project started in summer 1954.
- About two-thirds of the cost went into problem preparation, and more than 90% of elapsed time into planning, writing and debugging (1957 paper, p. 188).
- Translator efficiency was the source of most of the system's complexity.
- The quadratic-root example is one statement. The compiler computes B/2.0 once and squares it by multiplication.
- DO loop example for I = 1..1000.
- Statements were punched one per card, and the output was a ready-to-run binary deck.
- Case study: one-day course, 47 statements, four hours, six-minute compile, about 1,000 instructions, an estimated three days by hand. The authors say such a case "seldom gives a good measure".
- The ratio of machine instructions to FORTRAN statements was 4–20.
- From the HOPL transcript: the prevailing belief that automatic code could not match hand code; distribution in April 1957; Laning and Zierler's compiler was already running; IT, MATH-MATIC and BACAIC ran before distribution, with more modest goals and no optimization.
- From the HOPL reference list: Preliminary Report dated 1954-11-10, and Programmer's Reference Manual dated 1956-10-15.
- MPI early standard: "Bindings for Fortran 77 and C".
- NumPy arrays can use C or Fortran memory order.

**Not used or unverified:**
- The exact text of the quadratic formula. The OCR leaves the leading minus sign ambiguous, so the drafts describe the formula without quoting it.
- The conference month. The PDF does not say February, so the drafts say only "1957 Western Computer Proceedings".
- Any claim that FORTRAN was first.

## software-c-language-1973

**Read:** Ritchie, "The Development of the C Language", HOPL-II, April 1993, on the CS:APP mirror. Three targeted WebFetch passes asked for verbatim sentences. Also MPI node5 and NumPy arXiv v1.

**Claims kept:**
- C came into being in 1969–1973, and the most creative period was 1972.
- Thompson wrote the original Unix in PDP-7 assembler and recoded the kernel in PDP-11 assembly.
- Thompson created B in 1969–70, derived from BCPL. B and BCPL were typeless, with only the word or cell.
- The PDP-11 exposed B's problems: byte addressing and characters, floating point, and pointers as word indices with a run-time scale conversion.
- Characters were packed into words and unpacked with library procedures.
- B's threaded code was much slower than assembly.
- In 1971 Ritchie began adding a character type. NB had int and char, arrays of them and pointers to them. Then the name became C.
- In 1972 Thompson made a brief attempt at a C kernel "before structures".
- By early 1973 the essentials were complete, and the kernel was rewritten in C that summer.
- The kernel rewrite gave the team confidence to recode utilities.
- Johnson's pcc was a retargetable compiler. The Interdata 8/32 port happened during 1977–79, when portability was being demonstrated.
- K&R was published in 1978 and served as the reference until X3J11's report at the end of 1989.
- Critique, paraphrased: "quirky, flawed, and an enormous success"; inside-out declarations; arrays and pointers trip up beginners.
- Numeric was written in C, and NumPy supports C memory order.

**Not used or unverified:**
- An exact year for the Interdata port. Ritchie gives only the 1977–79 window.
- The `s[i]` byte-access sentence is an illustrative explanation, not a quote.

## software-python-0-9-1991

**Read:**
- docs.python.org general FAQ: "Why was Python created", plus the "What is Python?" paragraph.
- docs.python.org license page, "History of the software".
- Guido van Rossum, "A Brief Timeline of Python", 2009-01-20.
- NumPy arXiv v1 and PyTorch arXiv v1.

**Claims kept:**
- Created at CWI as a successor of ABC.
- Background in the Amoeba group: system calls were not accessible from the Bourne shell, and administration required C programs or shell scripts.
- ABC was not extensible.
- Indentation and very-high-level types came from ABC, with different details.
- Exceptions came from Modula-3, and the Amoeba error-handling experience mattered.
- Python was meant to be generally extensible, not Amoeba-specific.
- Work started over the 1989 Christmas holidays.
- Python was used in Amoeba during the following year.
- Timeline: implementation started December 1989, with early dates marked approximate; 0.9.0 released to alt.sources on 1991-02-20; 1.0.0 on 1994-01-26.
- The FAQ currently describes Python as "extensible in C or C++". The drafts present this as today's FAQ wording, not as a 1991 feature.
- NumPy paper: fast arrays and linear algebra let scientists stay in one language.
- PyTorch paper: since 2014 most frameworks converged on a Python interface; GIL statement.

**Not used:** the Misc/HISTORY file, which was not opened.

## software-numpy-2005

**Read:** Harris et al., arXiv v1, full main text; numpy.org/about; PyTorch arXiv v1, §4.2.

**Claims kept:**
- Numeric started in the mid-1990s, written in C and linking to fast linear algebra.
- Numarray was built for Hubble images and added structured arrays, memory mapping and other features.
- The two packages divided the community until 2005, when NumPy unified them. NumPy combined Numarray's features with Numeric's small-array speed and its C API.
- Array metadata and the strides example: a (4, 3) array of 8-byte values has strides (24, 8).
- Vectorization replaces tens of lines of C.
- Broadcasting includes scaling each column, with no memory copy.
- SciPy, Matplotlib, pandas and scikit-learn are built on NumPy.
- NumPy was used in the gravitational-wave and black-hole imaging software.
- NumPy cannot directly use GPUs or TPUs or data beyond one machine's memory.
- Frameworks built their own arrays, and NumPy's protocols dispatch to them.
- NumPy is not in Python's standard library, and Python added syntax for it.
- numpy.org/about: "created in 2005 building on the early work of the Numeric and Numarray libraries".
- PyTorch: `torch.from_numpy()` and `.numpy()` share memory with no copy, in constant time.

**Unverified:** the NumPy 1.0 release date (the task brief said 2006); the 2006 "Guide to NumPy" is only what the paper cites for 2005. The task brief's "NumPy 2006" was not used because both sources read say 2005.

## software-tensorflow-2015

**Read:**
- Google Research blog post, 2015-11-09, by Dean and Monga.
- Abadi et al., OSDI 2016, the full PDF.
- Horovod arXiv v1 and PyTorch arXiv v1.

**Claims kept:**
- The open-source release was announced 2015-11-09 under Apache 2.0, as "our second-generation machine learning system". DistBelief was developed in 2011.
- DistBelief, as described in OSDI §2.1:
  - It used a parameter server architecture.
  - Layers were C++ classes.
  - New optimizers required modifying the parameter server.
  - Its fixed execution pattern fails for RNNs, adversarial networks and RL.
  - It was heavyweight and hard to scale down.
- TensorFlow uses one dataflow graph of primitive operators plus mutable state. Nodes are mapped across machines and devices (CPUs, GPUs, TPUs), and communication is inserted automatically.
- Figure 1 MNIST program: placeholders, Variables, matmul, relu, softmax cross-entropy, AdagradOptimizer, and a Session run loop.
- Deferred execution lets the runtime issue GPU kernels without waiting.
- "There is no such thing as a parameter server"; PS tasks can run arbitrary graphs.
- Language-model experiment (§6.4): a 512 × 40,000 softmax sharded across PS tasks, with sampled softmax reducing the work by a factor of 78.
- §5: gRPC over TCP and RoCE.
- Conclusion: users chafe at the static graph, especially for deep RL. Mutable state and fault tolerance suffice only for weak consistency.
- §2.3: Theano's model is closest to TensorFlow's, on a single machine.
- Horovod: TensorFlow is "a preferred deep learning library at Uber"; problems with standard distributed TensorFlow.
- PyTorch §1: static-graph frameworks list.

**Excluded:** an RDMAP (RFC 5040) link, following the existing evidence note, and any claim about which features the initial November 2015 release lacked. The whitepaper was unread.

## software-pytorch-2017

**Read:** Paszke et al., arXiv v1 (2019-12-03, NeurIPS 2019), full main text; Megatron-LM arXiv v1; ZeRO arXiv v3, §10.1.

**Claims kept:**
- Static-graph frameworks: Caffe, CNTK, TensorFlow and Theano.
- Chainer paid a performance cost. Torch and DyNet used "a less expressive, faster language".
- Listings 1–2: a layer as a class, and GAN training.
- print, debuggers and matplotlib work as expected.
- libtorch is in C++, and its autograd runs without the GIL.
- Caching CUDA allocator.
- Within 17% of the fastest framework on 6 models, credited to shared cuDNN and cuBLAS.
- §6.4: "initial release of PyTorch in January 2017", with adoption measured by arXiv mentions.
- Chainer and DyNet pioneered the design for model authoring.
- Future work: the PyTorch JIT and distributed primitives.
- Megatron: implemented in native PyTorch with a few communication operations.
- ZeRO: implemented in PyTorch, used by wrapping an existing model.

**Unverified:** the GitHub release tag for January 2017, which was not opened. The date rests on the 2019 paper's own statement.

## distributed-spark-rdd-2012

**Read:** Zaharia et al., NSDI 2012 PDF, §§1–3, 6.1–6.3, 7, 8 (partial), 9; Li et al., OSDI 2014, §1.3; Abadi et al., OSDI 2016, §2.3.

**Claims kept:**
- Data reuse between MapReduce or Dryad jobs needs a distributed file system, with replication, disk I/O and serialization costs.
- Iterative ML and interactive mining suffer.
- An RDD is a read-only partitioned collection, created only by deterministic coarse-grained transformations. Lineage is used for recovery.
- Log-mining example: an HDFS file, filter on ERROR, persist, count, the MySQL and HDFS queries; the base RDD is not loaded.
- §6.1:
  - Setup: m1.xlarge nodes, HDFS with 256 MB blocks, 10 iterations on 100 GB, 25–100 machines.
  - Logistic regression was 25.3× faster than Hadoop and 20.7× faster than HadoopBinMem on 100 machines.
  - k-means was 1.9–3.2× faster.
- §6.3: on 75 nodes, iteration time went 58 s → 80 s → 58 s around a failure, with lineage under 10 KB.
- §2.4 limits: not for asynchronous fine-grained updates, such as web application storage or an incremental crawler.
- §5.4 mentions checkpointing for long lineage.
- §7: MapReduce can be expressed with flatMap and groupByKey.
- §2.3: backup tasks "as in MapReduce".
- Comparison is against Hadoop 0.20.2.
- Reference [33] is a 2011 technical report.
- PS paper: MLI is based on Spark, and preserving state between iterations is a shared goal.
- TensorFlow paper: Spark is better suited to iterative ML when data fits in memory. The immutable-input limitation makes model updates expensive. SparkNet takes 20 s to broadcast and collect from five workers.

**Unverified:** Spark's earlier history (for example a 2010 workshop paper), which was not opened and is not mentioned.

## distributed-parameter-server-2014

**Read:** Li et al., OSDI 2014 PDF, §§1–5 and conclusion; TensorFlow OSDI 2016, §§2.1–2.3; Horovod arXiv v1, §3.

**Claims kept:**
- Training data is 1 TB to 1 PB, with 10^9–10^12 parameters.
- Three challenges: bandwidth, synchronization barriers, and fault tolerance (Table 1 job failure statistics).
- Server and worker groups; push and pull.
- Range-based key-value vectors.
- Algorithm 1, distributed subgradient descent.
- Each worker needs 7.8% of parameters with 100 workers, and 0.15% with 10,000 (Fig. 3).
- Sequential, eventual and bounded-delay consistency, where τ = 0 is sequential and τ = ∞ is eventual.
- §5.1:
  - 170B examples and 65B features, 636 TB uncompressed.
  - 1,000 machines (800 workers, 200 servers), each with 16 cores, 192 GB of memory and 10 GbE.
  - Workers were idle 50% of the time at τ = 0 and 1.7% at τ = 16; τ = 8 was the best trade-off.
  - 300 lines of code versus more than 10K for Systems A and B. System B was developed by an author, and both came from "a large internet company".
- §1.3: "third generation". The first generation [43] is Smola and Narayanamurthy, VLDB 2010, which repurposed memcached. The second generation is YahooLDA and DistBelief.
- The code is at parameterserver.org.
- TensorFlow §2.3: the architecture emerged in topic modeling, DistBelief applied it to DNNs, and Li et al. added consistency models, fault tolerance and elastic rescaling.
- Horovod §3: one parameter server becomes a bottleneck, while many produce all-to-all traffic.

**Not claimed:** that the dataset or Systems A and B are public or private.

## distributed-horovod-2018

**Read:** Sergeev and Del Balso, arXiv v1 (2018-02-15), full text.

**Claims kept:**
- Uber's models mostly fit in one server, but some training took a week or longer.
- Concepts in standard distributed TensorFlow (tf.Server, ClusterSpec and others).
- On 128 Pascal GPUs, about half the resources were lost to communication.
- Data parallelism with ring-allreduce: 2(N−1) steps, an add phase and a replace phase, bandwidth-optimal per Patarasuk and Yuan 2009.
- Baidu promoted the algorithm in early 2017 with a draft TensorFlow fork, and Horovod built on that draft.
- NCCL replaced Baidu's implementation, and MPI (Open MPI) launches the processes.
- Four API changes and the mpirun example with 16 processes on 4 servers.
- Tensor Fusion: a 64 MB default buffer, up to 65% improvement on TCP.
- 88% scaling efficiency, about twice standard distributed TensorFlow.
- RDMA gave +3–4% for Inception V3 and ResNet-101, and +30% for VGG-16.
- Limitations: models that fit in one server; MPI installation difficulty.
- Apache 2.0 at github.com/uber/horovod.

**Unverified:** the date of the first open-source code release (Uber's blog was not opened); independent adoption. Status is `historical` for that reason.

## distributed-megatron-lm-2019

**Read:** Shoeybi et al., arXiv v1 (2019-09-17), §§1–3, 3.2, 4.1, 5, 6; ZeRO arXiv v3, §§1, 10.1–10.2.

**Claims kept:**
- Memory limits, and Adam's extra state.
- GPipe and Mesh-TensorFlow require rewriting models, with custom compilers and frameworks still in development.
- Splitting the MLP's matrix A by rows needs a synchronization before GeLU. Splitting it by columns does not, and the second GEMM is split by rows.
- Attention is split by heads.
- Two all-reduces in the forward pass and two in the backward pass per layer. Code for the f operator.
- 8-way model parallelism within a DGX-2H × 64-way data parallelism = 512 GPUs.
- NVSwitch at 300 GB/s.
- Mixed precision on the V100's Tensor Cores.
- Communication through Python calls to NCCL.
- 39 TFLOPS per GPU (30% of peak), 15.1 PFLOPS, 76% scaling efficiency.
- 8.3B parameters, 174 GB of text, 9.2 days.
- The v1 abstract claims "largest transformer model ever trained".
- Future work needs more efficient optimizers.
- ZeRO v3:
  - Model parallelism degrades beyond a single node; 40B on two DGX-2 nodes gave about 5 TFLOPS per V100 (under 5% of peak).
  - Megatron-LM's open-source version dated September 2019 was the baseline.
  - ZeRO data parallelism was combined with Megatron's model parallelism.
  - Up to 170B parameters on 400 GPUs.

**Not used:** content specific to later Megatron versions (for example BERT experiments), which was not checked.

## Connections

Every `source` is a URL already listed on the `from` node. The script checked this together with referential integrity.

1. spark-rdd → storage-hdfs-paper-2010 (uses): RDD §2.2.1 and §6.1. This matches the existing HDFS evidence note.
2. spark-rdd → mapreduce (adapts): RDD §7 (flatMap/groupByKey) and §2.3 (backup tasks "as in MapReduce").
3. tensorflow → parameter-server (adapts): TensorFlow OSDI §2.2 (PS tasks) and §2.3 (Li et al. [49]).
4. horovod → tensorflow (uses): Horovod §§1–5.
5. horovod → mpi (uses): Horovod §3 (Open MPI) and §5 (mpirun).
6. megatron → pytorch (uses): Megatron abstract and §3.2.
7. megatron → nvidia-volta-2017 (uses): Megatron §5 (512 V100s) and §4.1 (Tensor Cores through mixed precision).
8. megatron → transformer (uses): Megatron §3.
9. zero → megatron (complements): ZeRO §10.1, read in v3. The `zero` node cites the unversioned abs URL.
10. pytorch → numpy (complements): PyTorch §4.2.
11. numpy → python (uses): NumPy paper, "Scientific Python ecosystem" section.
12. c → unix (complements): Ritchie's C history.

Considered and left out:
- MPI → FORTRAN, because Fortran 77 is not the 1957 system, and no source read links them.
- RDMAP → TensorFlow, which the existing evidence explicitly excludes.

## Candidates skipped

- **Theano (2010):** not opened. The TensorFlow and PyTorch papers mention it only as a comparison point. It is listed as a gap in the suggested `topics.next`.
- **JAX (2018):** not opened, and it is listed as a gap.
- **GPipe (2018/2019):** not opened; it appears only through Megatron's related-work section, which was not used as evidence for GPipe itself. It is listed as a gap.
- **Ray (OSDI 2018):** not opened, and it is listed as a gap.

## Placement notes

- **New branch `deep-learning/field-software`:** created for TensorFlow. The deep-learning era had no software branch.
- **New branch `branching/training-code`:** created for PyTorch and Horovod. It mixes software and distributed topics, the same way `public-tools/serving` does.
- **`suggested_summary` fields:** these propose updated summaries for existing branches that would gain works: early-ai/field-software, learning/field-software, connected-computing/field-software, deep-learning/field-distributed and scale-science/training. They are optional.
- **Era `featured` lists and era summaries:** not changed.

## Evidence log: models / applications / ecosystem drafts

Reviewed 2026-10-12. Output: `models-apps-people.json` (10 nodes, 7 placement groups, 12 connections). Checks run: `python3 -m json.tool` passes; a local script confirmed unique lowercase-hyphen ids with no clash against the 77 existing ids, the exact key order, kind/status/topic values, zh/en on every text field, no CJK characters in any English field, equal zh/en `detail` paragraph counts (all 3), HTTPS sources, each work's year falling inside its era's range, new branch ids not already in that era, every connection endpoint existing, and every connection `source` appearing in the `from` node's own `sources`.

Reading method: arXiv, Google, ACL, IBM, GNU, kernel.org, arXiv-info and Caltech pages were downloaded with curl and read in full via `pdftotext -layout` or HTML-to-text extraction. GitHub blog posts were read through curl and text extraction, with exact sentences matched. Some official DOI landing pages (PNAS, APA, ACM, ScienceDirect, PubMed) return 403 or a cookie wall to tools. They are cited as the official records, but their content was read from the copies named below, and bibliographic data was confirmed through the Crossref API.

Decisions the editor should review:
- `kind: "open"` is rendered as "Open question" by `technology_chronicle.py`, so no node uses it. Hugging Face Transformers is `system`. GPL v1 is `product` (rendered "Product / release") because it is a dated, versioned release document; `system` would also be defensible, matching the GNU announcement node.
- The placement format is one object per (era, branch) with `new_branch` either null or a full `{id, title, summary}` object, plus a `works` list and an English editor `note`. Two placements reuse the branch id `field-ecosystem` in new eras (learning, scale-science), following the `field-software` pattern.
- Two connections start from the existing `transformer` node, using that node's existing source `https://arxiv.org/pdf/1706.03762v1`, which I read.

---

## perceptron-1958

Read:
- The full article, Psychological Review 65(6), pp. 386–408, from a scan of the journal pages at `homepages.math.uic.edu/~lreyzin/papers/rosenblatt58.pdf`: introduction, "Organization of a perceptron", Table 1 (α/β/γ systems), bivalent systems, "Improved perceptrons", Conclusions, references, and the received date.
- Crossref metadata for DOI 10.1037/h0042519, which confirms volume, issue, pages, and the year 1958. The APA DOI page itself returns 403 to tools.

Claims kept: earlier logic-style models treated as "logical contrivances" (McCulloch & Pitts, Kleene, Minsky cited); symbolic logic and Boolean algebra "less well suited" to imperfect random networks; the S-points → A-units (random connections) → R-units organization; inhibitory feedback and mutually exclusive responses; learning through changes to A-unit "values"; probability theory instead of symbolic logic; conclusions 1–5 on random versus differentiated environments and generalization; IBM 704 simulations at the Cornell Aeronautical Laboratory that "bore out the theory in all of its main predictions" and were to be reported separately; the limit on relational judgments, with the paper's own examples; the funding note (ONR contract Nonr-2381(00)); adaptation of report VG-1196-G-1 (1958), described as "the first full report on the program"; received April 23, 1958.

Used from the Hopfield paper (read, see below): the p. 2555 contrast with perceptrons (forward connections, backward coupling intractable, synchronous units).

Not stated / avoided: the publication month (PubMed's month was not readable, so it is omitted); the Mark I hardware; the "perceptron learning rule" in its textbook form; Minsky & Papert's 1969 critique, which is only cited in Hopfield's references and which I did not read. The "square / circle" example is labelled as illustrative ("设想" / "Picture"); the paper mentions such stimulus classes, but the two-response walk-through is my framing of the paper's mechanism.

## hopfield-network-1982

Read: the full PNAS paper (pp. 2554–2558) from CaltechAUTHORS (`HOPpnas82.pdf`); the PMC record page (abstract only, since the PMC PDF sits behind a proof-of-work page); the Nobel Prize in Physics 2024 press release (curl with a browser user agent).

Claims kept: content-addressable memory and the Kramers–Wannier reference example; only simple CAM forms existed in hardware; the linear associative net's mixed output (0.6 S1 + 0.4 S2); two-state neurons, the T_ij storage rule, asynchronous random updates; energy E decreasing monotonically for symmetric T; simulations at N = 30 and 100; ~0.15N capacity; n = 5 almost always stable and n = 15 about half within 5 errors (Fig. 2, N = 100); distance ≤ 5 reaching the nearest memory >90% (N = 30, n = 5); 85% / 10% / 5% outcome split; memories 10 bits apart "often fused"; N = 100, n = 500 none stable; sequences longer than four states impossible; T_ij assumed set by "previous experience (or inheritance)"; random memory vectors; "Contributed by John J. Hopfield, January 15, 1982"; April 1982, vol. 79. Nobel: announced 8 October 2024 to Hopfield and Hinton; the press release's spin/energy description; Hinton used the Hopfield network as the foundation for the Boltzmann machine.

Not stated: that Hopfield was "a physicist" (the paper is filed under Biophysics with a Chemistry and Biology affiliation); any claim that this was the first associative-memory network (the paper cites Amari, Kohonen, Cooper, Little and others).

## bahdanau-attention-2014

Read: arXiv v1 PDF (1409.0473v1, 1 Sep 2014) in full through the conclusion and the first page of references; the arXiv abstract page (version history v1–v7; comment "Accepted at ICLR 2015 as oral presentation"); GNMT v1 §3; Transformer v1 §1 and §3.2.1.

Claims kept: the fixed-length vector bottleneck; Cho et al. (2014b) showing degradation with length; bidirectional RNN annotations; weights α_ij, context vector, and an alignment model trained jointly; "this implements a mechanism of attention in the decoder"; the Fig. 3 alignments (European Economic Area, the man → l' homme); Table 1 (RNNenc-50 17.82, RNNsearch-50 26.75, RNNsearch-50* 36.15 no-UNK, Moses 35.63 no-UNK and 33.30 all); Moses' extra 418M-word monolingual corpus; no deterioration beyond 50 words; the Tx×Ty cost note (15–40 words); the 30,000-word shortlist and [UNK]; rare words as future work; Graves (2013) monotonic alignment.

Note: v1 cites "Sutskever et al. (2014)" although Sutskever's arXiv v1 is dated 10 Sep 2014, nine days later. Not mentioned in the node.

Status `adopted` rests on GNMT (2016, "attention module is similar to [2]") and Transformer v1 (additive attention [2] listed as a common attention function).

## deep-blue-1997

Read:
- Campbell, Hoane & Hsu, "Deep Blue", Artificial Intelligence 134 (2002) 57–83, from a course-hosted copy of the published version (27 pages; SUNY Oswego): §§1–3, 7.2–7.3, 8.1–8.3, 9.
- The IBM Heritage "Deep Blue" page.
- The AlphaGo Nature PDF hosted by DeepMind (Discussion paragraph on Deep Blue).
- Crossref metadata for the DOI (Jan 2002, vol. 134, issues 1–2).
- Not readable: ScienceDirect (403), and the NAU copy (TLS certificate failure; certificate checks were not bypassed).

Claims kept: Deep Blue I (36-node SP, 216 chips, 1.6–2M positions/s per chip) lost 4–2 in February 1996; Deep Blue II with a redesigned chip, ~6,400 → over 8,000 features, 2–2.5M positions/s per chip; 30-node SP (28 at 120 MHz, 2 at 135 MHz) and 480 chips, 16 per node; three-layer master/worker/chip search; ~100M (tactical), ~200M (quiet), 126M average in searches over a minute during the 1997 match; highly non-uniform search; hardware evaluation cannot take new features; opening book ~4,000 positions mainly by Joel Benjamin; extended book from a 700,000-game database with the d4 +10 example; mostly hand-tuned weights; the comparison-training tool on pawn shelter; the conclusion that tuning was "far from complete" and pruning "might have significantly improved" search; 3.5–2.5 in 1997. From IBM: May 1997 at the Equitable Center, New York; 1996 match in Philadelphia; IBM's "first computer system to defeat a reigning world champion ... under standard tournament time controls" (attributed to IBM in the node). From AlphaGo: "thousands of times fewer positions than Deep Blue" and "Deep Blue relied on a handcrafted evaluation function".

Not used: the IBM page's "11.38 billion flops" and "approximately 1,040 possible legal moves" (apparently garbled 10^40). The node does not claim Deep Blue was the first chess program to beat a grandmaster; the paper credits Deep Thought (1988) with that.

## gnmt-2016

Read: GNMT arXiv v1 (1609.08144v1, 26 Sep 2016): abstract, §§1–4, §6 (quantized inference), §7 (beam search, Tables 2–3), §8 (datasets, metrics, training, Tables 9–10, production results), conclusion, references [2], [20], [22], [39]; the arXiv version page; the Google Research blog post of 2016-09-27 (fetched with curl; quoted sentences matched exactly).

Claims kept: three weaknesses; 8+8 LSTM layers with residual connections (Fig. 1, §3.1; plain stacks "work well up to 4 layers, barely with 6 layers, and very poorly beyond 8"); attention from the bottom decoder layer to the top encoder layer for parallelism; wordpieces of 8k–32k and the "Jet makers feud" example; shared source/target wordpieces for copying names and numbers; low-precision inference on TPU; the 0–6 side-by-side scale; Table 10 English→Chinese 4.035 / 4.594 / 4.987, 58%; RL raising BLEU without human-rated improvement, and its exclusion from production-data experiments; 500 sampled Wikipedia/news sentences; harder cases and longer inputs left as future work; "approaches the accuracy achieved by average bilingual human translators on some of our test sets". Blog: 100% of Chinese→English in the Google Translate mobile and web apps; ~18M translations per day; errors such as dropping words, proper names, rare terms; sentences translated in isolation.

My computation: "relative improvement" in Table 10 equals (GNMT − PBMT)/(Human − PBMT) for five of six rows (En→Fr 64%, En→Zh 58.7%, Es→En 63%, Fr→En 83%, Zh→En 60.4%). The En→Es row prints 87%, but the formula gives about 82% in v1. The node says the 58% figure "matches" the gap share for English→Chinese and does not quote the Spanish row.

From Transformer v1 (the existing node's source): Table 2 "GNMT + RL" 24.6 EN-DE; 32,000 word-piece vocabulary [34] for EN-FR.

## youtube-dnn-recsys-2016

Read: the full paper PDF hosted by Google (research.google.com/pubs/archive/45530.pdf), all sections and references; the Google Research publication record page (title only rendered); Crossref for ACM DOI 10.1145/2959100.2959190 (RecSys '16, pp. 191–198, published 2016-09-07). The ACM page itself returns 403.

Claims kept: scale, freshness ("many hours of video are uploaded per second") and noise; "we rarely obtain the ground truth of user satisfaction"; the predecessor was matrix factorization under rank loss; the millions → hundreds → dozens funnel; extreme multiclass formulation; implicit feedback (completed watches); sampled softmax with several thousand negatives (>100× speedup); approximate nearest-neighbor serving within tens of milliseconds; "Inspired by continuous bag of words language models [14]" ([14] = Mikolov et al., Distributed Representations, 1310.4546); 50 recent watches and searches; example-age feature set to zero at serving; the "taylor swift" leakage example; predicting the future watch versus a held-out one; watch-time-weighted logistic regression; clickbait under CTR ranking; Table 1 (41.6% → 34.6%; 1024→512→256 best within the CPU budget); +4.1% loss when weighting equally; hundreds of features and continued feature engineering; offline metrics not always correlated with live A/B; "more art than science"; ~1B parameters and hundreds of billions of examples (read but not used in the node).

Not stated: any absolute live A/B numbers (the paper gives none).

## copilot-codex-2021

Read: Codex arXiv v1 (2107.03374v1, 7 Jul 2021): abstract, §§1–3.2, §6 Limitations, §7 Broader Impacts (7.1–7.2, the memorization paragraph, mitigation); the arXiv version page; the GitHub announcement of 2021-06-29 (full article text by curl); the GitHub GA post of 2022-06-21 (curl, exact sentences matched).

Claims kept: GPT-3's simple docstring programs; 0% for GPT-3, 11.4% GPT-J, 28.8% Codex-12B, 37.7% Codex-S (pass@1); 77.5% with 100 samples and unit-test selection, 44.5% by mean log-probability; HumanEval 164 hand-written problems, 7.7 tests on average, hand-written to avoid GitHub contamination; match-based metrics such as BLEU failing on functional equivalence; data from May 2020, 54M repositories, 179 GB → 159 GB; fine-tuning from GPT-3 gave no final gain but faster convergence (used in the connection); chained components cutting the pass rate by roughly 2–3× per step; the `do_work` binding example; the "strong student" comparison; over-reliance and insecure code; <0.1% identical to training data (Ziegler 2021); "A distinct production version of Codex powers GitHub Copilot". GitHub 2021: technical preview, "suggesting whole lines or entire functions", powered by OpenAI Codex, "especially well for Python, JavaScript, TypeScript, Ruby and Go", limited spots. GitHub 2022: generally available to all developers for $10/month or $100/year; >1.2M developers in the preview over 12 months; "nearly 40%" of code in files where it is enabled (labelled a vendor figure).

Not used: the GA post's editor list, because that post was updated in May 2024 and the list may not reflect 2022.

## arxiv-1991

Read: Ginsparg, "It was twenty years ago today ..." arXiv v2 (1108.2700v2, 13 Sep 2011), full text including footnotes; the arXiv abstract page for hep-th/9108001 (submitted 14 Aug 1991); arXiv About page; arXiv Content Moderation page; arXiv Computer Science archive page (info.arxiv.org/help/cs/index.html, redirected from arxiv.org/corr/); arXiv 1409.0473 version page.

Claims kept: photocopies mailed to a small number of people; unequal access for non-elite institutions; the Aspen comment about emailed articles overrunning a disk allocation; xxx.lanl.gov as an automated email server, built from csh scripts, with full texts sent on demand; FTP within months; a Web server after Mosaic (spring 1993); about 100 submissions/year planned versus 400 in the first half year; the three-month deletion plan and `rm 9108*` never installed; identifier 9108001; renamed arXiv.org in late 1998; impact on physicists in less developed countries. About page: founded by Paul Ginsparg in 1991; moderation "not peer-reviewed"; independent nonprofit in 2026 after decades at Cornell. CS page: CS section established in 1998 through a partnership of ACM, NCSTRL and arXiv.

Caveat recorded in the node: the early history is the founder's own recollection.

## gpl-v1-1989

Read: the full GPL v1 text on gnu.org (preamble and §§0–8 onward); the headers of GPL v2 (June 1991) and GPL v3 (29 June 2007); "The GNU Project" essay on gnu.org (the X Window System and "Copyleft and the GNU GPL" sections, plus the Linux 1991/1992 passage); the Linux 0.12 RELNOTES on kernel.org (COPYRIGHT section).

Claims kept: public domain and permissive licenses allowing proprietary modified versions; the X Window System example; v1 permissions (copy, modify, distribute, charge for transfer); §1 notices and copy of the license; §2a modified-file notices; §2b licensing the whole work at no charge to all third parties; §3 source code, or a written offer valid ≥3 years, with source defined as "preferred form ... for making modifications"; mere aggregation; §7 "any later version"; no warranty; Linux 0.12 dropping "you may not distribute it for money" to become compatible with the GNU copyleft; the GNU account that Linux became free software in 1992.

Not stated: that GPL v1 was the first copyleft license (earlier GNU program-specific licenses exist, but I did not read a source on them); which GPL version Linux adopted (0.12 says only "GNU copyleft", and v2 already existed by 1992); any legal-enforceability claims.

## hf-transformers-2019

Read: arXiv v1 (1910.03771v1, 9 Oct 2019) in full through §5; the arXiv version page (v1–v5); the EMNLP 2020 System Demonstrations paper (aclanthology 2020.emnlp-demos.6.pdf): abstract, §1, §4 Community Model Hub, case studies.

Claims kept: the pretrain-then-fine-tune shift; RoBERTa at 160 GB, 1024 × 32GB V100, ~100K USD on AWS (the authors' estimate); a unified API with configuration/model/tokenizer and `from_pretrained()`; PyTorch and TensorFlow 2.0; implementations follow the original computation graphs and are tested against original results; heads such as XXXForSequenceClassification; GLUE/SuperGLUE/SQuAD scripts; renamed from pytorch-pretrained-bert to pytorch-transformers to Transformers; "ten months of existence"; >200 papers; >120 external contributors; Apache 2.0. 2020: 2,097 user models; >400 external contributors; the FlauBERT two-line example; model pages and model cards (Mitchell et al.) covering training, data and known biases ("can be provided"); AllenAI SciBERT on PubMed as a case study; November 16–20, 2020 proceedings.

Status `adopted` rests on the 2020 paper's community data (self-reported snapshot, flagged in `limit`).

---

## Connections: basis

All sources below were read.

| from → to | type | evidence in the `from` node's source |
|---|---|---|
| bahdanau-attention-2014 → seq2seq | adapts | v1 §2.1: "RNN Encoder–Decoder, proposed by Cho et al. (2014a) and Sutskever et al. (2014) upon which we build" |
| gnmt-2016 → lstm | uses | v1 §1: "the recurrent networks are Long Short-Term Memory (LSTM) RNNs [22]" ([22] = Hochreiter & Schmidhuber 1997) |
| gnmt-2016 → bahdanau-attention-2014 | uses | v1 §3: "Our attention module is similar to [2]" |
| gnmt-2016 → resnet | adapts | v1 §3.1: "Motivated by [20], we introduce residual connections" ([20] = He et al.); 4 / 6 / 8-layer statement |
| transformer → bahdanau-attention-2014 | adapts | Transformer v1 §3.2.1: "additive attention [2], and dot-product ... attention" |
| transformer → gnmt-2016 | uses | Transformer v1 §5.1: "32000 word-piece vocabulary [34]"; Table 2 "GNMT + RL [34]" |
| youtube-dnn-recsys-2016 → word2vec-2013 | adapts | §3.2 "Inspired by continuous bag of words language models [14]"; [14] is 1310.4546, not the 1301.3781 paper the word2vec node cites (said in the description) |
| copilot-codex-2021 → gpt3 | adapts | §3.2: "fine-tune from the GPT-3 ... model family"; no final gain, faster convergence |
| hf-transformers-2019 → transformer | uses | arXiv v1 §1: implementations "follow the original computation graphs and are tested" |
| hf-transformers-2019 → model-cards-2018 | uses | EMNLP 2020 §4: "a model card (Mitchell et al., 2018)" |
| gpl-v1-1989 → software-gnu-announcement-1983 | complements | GNU Project essay, "Copyleft and the GNU GPL" |
| arxiv-1991 → networks-web-proposal-1989 | uses | Ginsparg v2 p. 5: became a Web server after Mosaic |

Considered and not added: hopfield → perceptron (a contrast that fits none of uses/adapts/complements; it is described in both nodes' text instead) and alphago → deep-blue (also a contrast; described in the Deep Blue detail with the AlphaGo PDF as a source).

## Candidates skipped

- GAN (2014) and VAE (2013): the brief capped models at two or three. Perceptron, Hopfield and Bahdanau attention cover gaps (no pre-1986 neural node, and attention before Transformer) that GAN and VAE do not; generative modelling already has the diffusion and Stable Diffusion nodes.
- IBM Watson on Jeopardy! (2011): left out to keep applications at four well-verified nodes; not researched.
- NeurIPS/NIPS 1987: the official About page ("founded in 1987") and the 1987 proceedings list (90 papers, edited by D. Anderson; papers ranging from cortex simulations to optical and VLSI hardware and Hopfield-model variants) confirm the date and contents. No official source I could read explains why it was founded or what problem it addressed, so a body would rest on inference. The 2018 rename has only secondary coverage.
- 2018 ACM Turing Award (Bengio, Hinton, LeCun): a recognition rather than a change that explains a problem or a later design, and the date convention is awkward (the 2018 award was announced in March 2019). Not researched further.

## Infra tracks: evidence log (2026-10-12)

Draft: `infra-tracks.json` (9 nodes, 9 placements, 7 connections). Nothing in the repository or in `chronicle/site` was edited.

How it was checked: PDFs were downloaded with curl into an isolated folder and read with `pdftotext -layout` / plain `pdftotext`, then grepped. HTML pages were fetched with curl and stripped to text. Two pages blocked curl (TSMC, OpenAI). TSMC was read through WebFetch plus a verbatim mirror on design-reuse.com. OpenAI was not readable (HTTP 403) and is not cited. The merged draft was checked against the current `technology-tree-data.json` (which had grown to 87 nodes during the run) with `technology_chronicle.validate()` and `render()` for both languages: it passes, and all 9 `event-` anchors render.

## Track IDs (please check)

The brief asked for track `fabrication` (chips) and `compilers` (software). The current data defines neither, and the builder now rejects unknown tracks. I used the existing equivalents:
- chips → `devices` (器件与制程 / Devices and fabrication)
- software → `languages` (语言与编译器 / Languages and compilers; LLVM is already there)
- distributed → `clusters`; ecosystem → `responsibility` (both as requested)

## distributed-xen-paper-2003
- Read: Barham et al., SOSP 2003, Cambridge PDF, all 14 pages (abstract, §§1–3, Table 2, §6). Jeff Barr's EC2 beta post.
- Kept: x86 supervisor instructions "fail silently rather than causing a convenient trap". VMware ESX dynamically rewrites guest machine code. Paravirtualization, with no ABI change, so applications run unmodified. Guest kernel moves to ring 1. Guests read hardware page tables, batch updates into one hypercall, and Xen validates them. VMware uses shadow page tables. Linux port is 2,995 lines (1.36% of the x86 code base). The XP port was incomplete and NetBSD at an early stage. Domain0 holds the control interface. Target is about 100 VMs per server. The authors claim overhead of at most a few percent. The paper compares against VMware Workstation and UML and discusses Denali. Beta "under evaluation by selected parties", with a 1.0 release to be announced. Conference held Oct 19–22, 2003. Later use: Barr says "We built Amazon EC2 using a virtual machine monitor by the name of Xen".
- Not verified, so not stated: the exact public 1.0 release date, and any claim that Xen was first.

## distributed-amazon-ec2-beta-2006
- Read: AWS What's New entry (dated Aug 24, 2006). Barr's "Amazon EC2 Beta" (page dated 25 AUG 2006). Barr's "Happy 15th Birthday Amazon EC2" (23 AUG 2021).
- Kept: resizable compute through a web service, boot in minutes, pay for what you use. Limited beta. A "virtual CPU" equal to a 1.7 GHz Xeon with 1.75 GB RAM, 160 GB disk and 250 Mb/s, at 10 cents per clock hour. Built on Xen. AMIs stored in S3. Up to 20 servers per account during the beta. The fMRI example (15–20 machines, a couple of hours every few weeks) and the 7am–7pm inventory example (about 50% savings) are user quotes in the post. Barr's retrospective adds: one instance type, one region, all storage transient, no block storage, the instance later called m1.small, no CPU model disclosed, EBS in 2008, ELB/Auto Scaling/CloudWatch in 2009, Nitro in 2017.
- Date note: the retrospective, dated Aug 23, 2021, says "fifteen years ago today", but the post page shows Aug 25 and What's New shows Aug 24. The node uses 2006 and names both dates.
- Not verified, so not used: the general-availability date (Oct 2008). I did not open a source for it.

## distributed-borg-paper-2015
- Read: Verma et al., EuroSys 2015, research.google.com PDF (§§1–2, 5.2, 5.5, 6.1–6.2, 7, 8). Joe Beda, "4 Years of K8s" (already a source on the Kubernetes node).
- Kept: Borg "admits, schedules, starts, restarts, and monitors". Run in production for more than a decade. Median cell is about 10k machines. Other organizations separate user-facing and batch work. Prod jobs reserve for rare spikes. Resource reclamation works through a limit and a reservation recomputed every few seconds. About 20% of workload runs in reclaimed resources. Segregation would need 20–30% more machines. Tasks are Linux processes in containers, and now all run in cgroup-based containers. The reasons given for avoiding VMs are virtualization cost and processors without hardware virtualization support. GCE/GAE VMs run as KVM processes inside Borg tasks. §8 says alloc corresponds to pod, and Kubernetes uses labels instead of jobs. Beda says Kubernetes "was built on ideas that had been proven out at Google over the previous ten years with Borg", the prototype was rewritten in Go, and the goal was to "bring the best ideas from Borg out into the open".
- Kind is `system`, with the paper as the dated public account. The caller may prefer `research`.

## software-tvm-paper-2018
- Read: OSDI 2018 USENIX PDF (abstract, §§1–3, figure 2, §4 fusion, §5 cost model, §6). arXiv v1 abstract page (submitted 12 Feb 2018). ASF announcement (30 Nov 2020; also read on the blogsarchive mirror).
- Kept: frameworks rely on graph IRs and vendor operator libraries, and focus on server GPUs. New platforms need manual effort. Frameworks face a dilemma over fused operators missing from libraries. Four operator categories. Fusion speedup of 1.2–2× (Titan X). Tensor expressions and schedule primitives extend Halide's compute/schedule split. The ML cost model is trained on measured runtimes, and on-hardware measurement can take seconds. Figure 2 has LLVM IR and CUDA/Metal/OpenCL back ends. End-to-end speedups of 1.2–3.8×. The evaluations are inference workloads. Baselines include MXNet, TF, TF XLA and Tensor Comprehensions. The authors say it is open-sourced and in production at several companies. ASF: Incubator March 2019, TLP Nov 2020, users list (AMD, ARM, AWS, Microsoft, NVIDIA...).
- Not stated: ASF says the project "originated in 2017 as a research project at Washington University". I left this out because the institution name looks garbled.

## software-triton-mapl-2019
- Read: Tillet, Kung & Cox, MAPL 2019, Harvard PDF (abstract, §1 contributions, §2, §5 passes, §6, §7). The current triton-lang/triton README (raw). PyTorch 2.0 release blog (2023-03-15).
- Kept: experts write kernels for operations outside cuBLAS/cuDNN, at a cost to portability. Existing DSLs are often much slower. Tiles are statically shaped multi-dimensional sub-arrays. Triton-C and the LLVM-based Triton-IR compile to LLVM bitcode. Machine-dependent passes cover tiling, coalescing, shared-memory allocation and synchronization. Auto-tuner. Listing 1 (TM/TN in {16,32,64,128}). Results on a GTX 1070 against cuBLAS 10.0 and cuDNN 7.0. Up to 3× faster than other DSLs, with TVM under 2× slower on some shapes. cuBLAS is faster on shallow transformers. IMPLICIT_GEMM was reimplemented without loss. A fused shift-conv kernel. The README cites MAPL 2019 as the foundation, and kernels are now Python-based. PyTorch 2.0: TorchInductor "with Nvidia and AMD GPUs will rely on OpenAI Triton".
- Not used: OpenAI's 2021 Triton 1.0 post (403, unread). The paper's "first fused kernel" for shift conv appears only as "a fused kernel".

## ecosystem-differential-privacy-2006
- Read: Dwork, McSherry, Nissim & Smith, TCC 2006, Adam Smith's author PDF (§1, §2 Def. 1, Example 1, §3 Def. 2, Example 3, §3.1 Theorem 1, §3.2). U.S. Census Bureau DP overview page.
- Kept: earlier work covered noisy sums. Dinur–Nissim showed that unrestricted subset-count queries with low noise allow near-exact reconstruction. The paper defines ε-indistinguishability over databases differing in one row. Lap(S(f)/ε). ε is chosen by policy. S(f) is independent of the database. Noisy count uses Lap(1/ε). Histogram sensitivity is 2, independent of the number of bins. Previous noise was proportional to dimension. Adaptive query sequences are bounded by the sensitivity of the combined query function, and the server may refuse. The trusted server assumption. The smoking/heart disease example. Census page: noise added since the 1990 Census, a DP-based framework for 2020, "first developed in 2006", and it cites this paper (TCC, March 2006, pp. 265–284).
- Wording choice: the node says the paper's term is ε-indistinguishability and the later common name is differential privacy (used by the Census page). I did not cite or claim which paper coined "differential privacy".

## ecosystem-federated-learning-2016
- Read: arXiv 1602.05629v1 PDF (17 Feb 2016; §1, §1.1–1.2, §2, §3 data, Tables 2–3 text). PMLR AISTATS 2017 page. Google Research blog (April 6, 2017). Bonawitz et al. arXiv 1902.01046v1 abstract.
- Kept: the motivation (privacy-sensitive, large on-device data). Distributed optimization assumes data-center networks and IID data. The FedAvg loop (fraction C, local epochs E, batch B, weighting by n_k/n). Shakespeare: 1,146 clients, unbalanced. Communication-round speedups of 95× (non-IID) and 13× (IID) over FedSGD at 54% accuracy. Footnote on bag-of-words gradients revealing words. DP, local DP and secure MPC are described as enhancements. Deployment issues are explicitly out of scope. Zinkevich et al. is cited as a similar averaging algorithm. Blog: Gboard testing, query suggestions, training only when idle, plugged in and on free Wi-Fi. Bonawitz: "We have built a scalable production system ... based on TensorFlow".
- Not claimed: that this paper coined the term. The paper says "We term this...", but I did not check earlier uses.
- Connection FL → DP: the FL paper cites Dwork & Roth 2014 for DP, not the 2006 paper directly. The link targets the DP concept node.

## chips-intel-trigate-22nm-2011
- Read: Intel press release on intc.com (May 4, 2011, full text). Intel 3rd Gen Core launch release (Apr 23, 2012). Samsung 7LPP release (for the "10nm FinFET" naming only).
- Kept: Tri-Gate was first disclosed in 2002 and was to enter high-volume manufacturing at 22 nm. The fin rises vertically, with a gate on three sides. Lower voltage and lower leakage. Up to 37% performance at low voltage versus Intel 32 nm planar, or under half the power at the same performance. Ivy Bridge was demonstrated in laptop, server and desktop and was "slated for high-volume production readiness by the end of this year". Physical limits at small dimensions. Fins allow closer packing. 2012: quad-core 3rd Gen Core available, which Intel called "the first chips in the world" with 22 nm tri-gate. Performance gains are "due in part" to the transistor.
- All performance and "first" statements are attributed to Intel. Intel calls the 22 nm name "in reference to the size of individual transistor features". I did not contradict or interpret this.

## chips-euv-volume-production-2019
- Read: TSMC release of 2019-10-07. pr.tsmc.com blocks curl, so I read it through WebFetch and the full verbatim text on design-reuse.com, and cite the TSMC URL. Samsung 7LPP release (2018-10-18, full text). ASML "Making EUV: from lab to fab" (2022-03-30, full text). ASML EUV product page. ASML "light and lasers" page (read for context, not cited).
- Kept: TSMC: N7+ is "the industry's first commercially available EUV lithography technology" (a vendor claim). Volume production from Q2 2019. Yields similar to N7. 15–20% more density. EUV tools above 250 W. N6 risk production in Q1 2020. Samsung: 13.5 nm versus ArF immersion at 193 nm with multi-patterning. One mask versus up to 4. About 20% fewer total masks. Wafer production started at S3 Hwaseong. It also mentions "10nm FinFET predecessors". ASML: mid-1980s origins (Kinoshita). Program started 1997. NXE:3100 pre-production system shipped 2010 to Samsung research. NXE:3300 in 2013. Benschop's remark that "the machine basics were there" but productivity was the problem. Reticle, photoresist and EDA had to mature. First EUV-enabled commercial product in 2019 (Galaxy Note10). 127 EUV machines in use at end of 2021. Absorption, vacuum, mirrors, 4× reduction, and a tin-droplet source at up to 50,000 per second. EUV prints the most intricate layers and DUV the rest.
- Deliberately not resolved: the conflicting "first" claims (TSMC, Samsung, ASML). The node reports all three as vendor statements.

## Placements and connections
- New twigs: `connected-computing/rented-servers` (Xen, EC2), `connected-computing/field-ecosystem` (DP), `branching/field-software` (TVM), `scale-science/field-software` (Triton).
- Added to existing twigs: `connected-computing/field-chips` (Tri-Gate after GCN), `deep-learning/field-distributed` (Borg before Kubernetes), `branching/field-ecosystem` (FL before Model Cards), `scale-science/field-chips` (EUV first).
- `summary_update` is a proposed replacement for the existing twig summary, so it still describes every work in that twig. It is optional.
- Each connection's `source` is a URL already in its `from` node. Kubernetes → Borg uses Beda's post, which is already a source on the existing Kubernetes node.

## Skipped
- CoWoS: no primary TSMC source was opened in this run, and the brief allowed it only with one.
- XLA: overlaps with the TensorFlow and JAX drafts that other helpers are writing. TVM and Triton were better sourced.
- Alternate Intel/EUV framings, such as an ASML-only 2019 node, were folded into the single EUV node.

## Evidence log: algorithms and data drafts

Read on 2026-10-12. PDFs were downloaded into a scratch folder and converted with `pdftotext -layout`. Scanned pages without a text layer (Robbins–Monro, one page of Bellman) were rendered to images with `pdftoppm` and read directly. Everything below lists what was actually read. Claims not listed here were not used.

Draft file: `algorithms-data.json`. It has 10 nodes, 10 placements, and 7 connections. `python3 -m json.tool` passes. A script also checked the following: ids are new; every year falls inside its era; new branch ids are not already used in their era; English fields contain no CJK characters; zh and en `detail` have the same number of paragraphs; every connection's `from`/`to` exists; and every connection's `source` is one of the `from` node's own source URLs.

---

## shannon-information-theory-1948 (origins / new branch `noise-chance-decisions`)

**Read:** the Harvard-hosted text, “Reprinted with corrections from The Bell System Technical Journal, Vol. 27, pp. 379–423, 623–656, July, October, 1948”. Sections read: Introduction, §2–3 (approximations to English), §6 (Theorem 2, H = −K Σ p log p), §7 (redundancy), §9 (Theorem 9), §11–14 (equivocation, capacity, Theorem 11, discussion).
**Kept:**
- PCM/PPM trade bandwidth for signal-to-noise ratio.
- Meaning is “irrelevant to the engineering problem”.
- Tukey suggested the word “bit”.
- The 1,000 symbols/s, 1% error example. Equivocation is 0.081 bits/symbol, so the rate is 919 bits/s, not 990; with fully random output the rate is 0, and Shannon makes the coin-flip comparison.
- English redundancy is about 50% within about 8 letters; the deletion test; telegraph could save about 50% but redundancy helps against noise.
- Shannon's own expectation-then-refutation that error → 0 needs rate → 0.
- Theorem 11 (below C, arbitrarily small error; above C, no).
- §14: following the proof to construct codes is “generally impractical”.

**Also read:**
- Shannon 1951, “Prediction and Entropy of Printed English” (BSTJ, Jan 1951; Princeton-hosted OCR scan, §1). Kept: the earlier estimate of 2.3 bits/letter and 50%; the new prediction method; long-range statistics give about 1 bit/letter and about 75% redundancy.
- MacKay & Neal 1996 preprint (author site). Kept: Gallager 1962 LDPC codes “generally forgotten”; the authors reinvented them; Berrou et al. 1993 turbo-code paper title “Near Shannon limit…”; LDPC performance “almost as close to the Shannon limit as that of Turbo codes” on Gaussian channels.

**Not verified / not claimed:**
- No claim about LDPC in Wi-Fi/5G or any deployment.
- No IEEE Xplore page opened. The dates come from the reprint header.

## robbins-monro-stochastic-approximation-1951 (origins / `noise-chance-decisions`)

**Read:** the full paper, all 8 pages, rendered as images from Project Euclid's open PDF (scan, no text layer). Project Euclid metadata: Ann. Math. Statist. 22(3), 1951/09, pp. 400–407.
**Kept:**
- §1–2: problem statement, with M(x) unknown and monotone. Classical methods use exact M(x_i) and possibly derivatives.
- §3: (4) bounded Y; (6) Σa_n² < ∞; (26)/(27), so Σa_n = ∞; “type 1/n” defined with 1/n as the example.
- Theorem 2 needs (33)–(35): nondecreasing, M(θ)=α, M′(θ)>0.
- Authors say (4) “could be considerably weakened” but they do not know if the theorems hold.
- p. 401: “No claim is made that the procedure … has any optimum properties”.
- §4: quantile with response/no-response data (bioassay, sensitivity data); rule (45); the estimator is consistent and “distribution-free”. The paper credits Anderson, McCarthy & Tukey, Naval Ordnance Report 65-46 (1946), with first mentioning a convergent sequential process.

**Note:** the 50% dose and α = 0.5 are my illustration of §4, not an experiment in the paper.

**Also read:** Bottou, “Large-Scale Machine Learning with Stochastic Gradient Descent” (author PDF, file name compstat-2010; the venue is not printed in the PDF), §2.2 and §5/Fig. 1.
- Kept: SGD convergence “studied extensively in the stochastic approximation literature”; conditions Σγ² < ∞ and Σγ = ∞; slow or fast gain-decay trade-off.
- Kept: RCV1, 781,265 training docs; SGD 1.4 s at 6.02% vs SVMLight 23,642 s at 6.02%.
- Bottou does not cite Robbins–Monro 1951 by name. The text says only “stochastic approximation literature”, and the node is worded accordingly.

## metropolis-monte-carlo-1953 (origins / `noise-chance-decisions`)

**Read:** the full text of J. Chem. Phys. 21(6), June 1953, pp. 1087–1092, received March 6, 1953. I read it via a university-hosted copy (zhanggroup.org) that carries an AIP redistribution notice, so the node cites the DOI (`https://doi.org/10.1063/1.1699114`, which resolves to pubs.aip.org) rather than that copy.
**Kept:**
- Several-hundred-dimensional integral impractical by usual methods.
- Naive random configurations have very small weight for close-packed systems.
- The move/accept rule with exp(−ΔE/kT); count the old configuration again after a rejected move.
- Ergodicity and approach to the canonical distribution. The argument “does not … specify how rapidly”.
- Choice of the maximum displacement.
- N = 224 on MANIAC; about 3 min per cycle; 4–5 h per pressure point; about 3% error; 56 vs 224 particles agree.
- Middle-square random numbers.
- Footnote: method proposed independently by Mayer and by Ulam; Alder, Kirkwood, Frankel, Lewinson discussed a very similar application.
- Lennard-Jones and 3-D work were in progress.

**Note:** the 37%/5% acceptance figures are my arithmetic illustration.

**Also read:** Kirkpatrick, Gelatt & Vecchi, Science 220 (13 May 1983), pp. 671–680, via a Duke course-site JSTOR copy; cited by DOI.
- Kept: Metropolis algorithm as a tool for optimization; downhill-only search gets stuck in local optima; Metropolis allows controlled uphill steps; temperature as a control parameter; melt-then-cool; applications to partitioning, placement, and wiring; traveling salesman discussed.

## bellman-dynamic-programming-1954 (origins / `noise-chance-decisions`)

**Read:** Bull. AMS 60(6), Nov 1954, pp. 503–515 (AMS open PDF).
- The footnote says it is an address at the Summer Meeting in Laramie, September 3, 1953, received by the editors August 27, 1954.
- Read §1–8, §12, §13, and the bibliography.

**Kept:**
- Multistage decision processes; examples: production lines, inventory, replacement of machinery, “programming of training policies”.
- The classical enumeration approach; the “price of excessive dimensionality … makes even a modern computing machine cringe”.
- Principle of optimality, verbatim meaning.
- (3.3) f_N(p) = max f_{N−1}(T_k(p)); stochastic version with expectation.
- §8 gold-mining problem and the qualitative rule (immediate expected gain over immediate expected loss); Karlin–Shapiro counterexample.
- §12: equations “analytically intransigent”; approximation in function space; approximation in policy space with monotone convergence.
- Bibliography lists Bellman, PNAS 38 (1952) 716–719, and RAND R-245 (1953).

**Deliberately not reproduced:** the printed formula in (8.3) reads prx/(1−r) vs qsy/(1−s). I checked it against the page image. It does not match the “gain over loss” description in the next sentence, so it may be a typo. The node describes the rule in words only.

**Not verified:**
- The 1952 PNAS paper itself: PMC served a bot-check page, and the pnas.org PDF did not download.
- The 1957 book was not used.
- The phrase “curse of dimensionality” does not appear in this paper and is not used.
- The limit sentence about f needing a value for every state is my explanation of the paper's definitions, not a quotation.

**Also read:** Watkins & Dayan, Machine Learning 8 (1992), 279–292, abstract and §1 (the existing `qlearning` node's own source).
- Kept: “incremental method for dynamic programming”; “asynchronous dynamic programming”.
- Kept: DP theory (cited as Bellman & Dreyfus 1962) guarantees an optimal stationary policy but needs R and P; Watkins “classes Q-learning as incremental dynamic programming”.

## cooley-tukey-fft-1965 (early-ai / existing `field-algorithms`)

**Read:** Math. Comp. 19 (1965), 297–301 (AMS open PDF, all 5 pages; AMS landing page for the citation). Received August 17, 1964.
**Kept:**
- Builds on Yates, Box et al., and Good.
- N² operations directly, where an operation is a complex multiply followed by an add.
- Fewer than 2N log₂N operations, in place.
- N(r₁+…+r_m) count; r = 3 formally best but only about 6% better than 2 or 4, which suit binary machines.
- Bit-reversed output order (eq. 22).
- IBM 7094 timing table: 2¹³ points in 0.10–0.13 min, depending on the split.
- Useful when N is “highly composite”.

**Note:** the N = 1024 and N = 4096 operation counts and the N = 8 bit-reversal example are my arithmetic.

**Also read:** Frigo & Johnson, “The Design and Implementation of FFTW3”, Proc. IEEE 93(2), 2005, §I–II.
- Kept: FFTW is widely used free software and mainly uses Cooley–Tukey.
- Kept: Cooley and Tukey “rediscovered and popularized it in 1965”, and it was known to Gauss as early as 1805, with later re-inventors.
- Kept: discontiguous access and reordering hinder caches; the planner measures run times of many plans.
- Kept: Rader's and Bluestein's algorithms for prime n are distinct from Cooley–Tukey.

**Not used:** the CUDA 1.0 Programming Guide names a library “CUFFT”, but the passage I read does not say “FFT”, so I proposed no connection from `nvidia-cuda-2006`.

## adam-optimizer-2014 (deep-learning / new branch `field-algorithms`)

**Read:**
- arXiv v1 (2014-12-22, “Under review … ICLR 2015”): Algorithm 1, §1–6.
- v2: default line only.
- v9 (2017-01-30, “Published as a conference paper at ICLR 2015”): Algorithm 1 defaults.
- arXiv abs page: version history; comment says ICLR 2015, San Diego.

**Kept:**
- AdaGrad (sparse) and RMSProp (online/non-stationary) combined.
- Per-parameter moving averages; bias correction; step approximately bounded by α; invariant to gradient rescaling.
- RMSProp lacks bias correction, which matters with slow second-moment decay and leads to large steps and divergence.
- The convergence analysis is online convex (Theorem 4.1), and §6.2 says it “does not apply to non-convex problems”.
- Experiments: MNIST and IMDB logistic regression, MNIST MLP, CIFAR-10 CNN.
- v1/v2 defaults are α = 0.0002, β1 = 0.1, β2 = 0.001, with β weighting the new gradient. v9 defaults are α = 0.001, β1 = 0.9, β2 = 0.999.

**Note:** the two-parameter example and the 3.16× first-step figure are my arithmetic illustration in the later notation.

**Also read:**
- Transformer v1 §5.3: Adam with β1 = 0.9, β2 = 0.98, ε = 1e−9; warmup of 4000 steps, then inverse-sqrt decay.
- BERT v1 §3.4: Adam with lr 1e−4, β1 = 0.9, β2 = 0.999, L2 weight decay 0.01, 10,000 warmup steps.
- Reddi, Kale & Kumar, “On the Convergence of Adam and Beyond” (header: ICLR 2018; arXiv posting 2019-04-19), abstract and §1. Kept: an explicit convex counterexample; problems in the previous analysis; the exponential moving average as one cause; rare large gradients fade.

**Not claimed:** “most popular optimizer”, generalization comparisons, AMSGrad by name, AdamW.

## penn-treebank-1993 (learning / new branch `field-data`)

**Read:** Marcus, Santorini & Marcinkiewicz, Computational Linguistics 19(2), 1993, pp. 313–330 (ACL Anthology J93-2004), §1–5.
**Kept:**
- Over 4.5 million words; first phase 1989–1992; LDC distribution.
- Footnote 1: the material forms a “collection”, which may be “opportunistic”.
- Brown Corpus: 87 simple tags, 187 counting compound tags.
- 36 POS tags plus 12 others; recoverability (for example, be/do/have).
- PARTS automatic stage; Fidditch parser.
- Manual-vs-correcting experiment: four annotators with graduate linguistics training; 20 vs 44 min per 1,000 words; disagreement 4.1% vs 7.2%.
- Correction speed exceeds 3,000 words/h after a month.
- Bracketing: example sentence, Figures 4–5, “?” chunks, pseudo-attachment of “blown ashore 375 years ago”.
- Argument/adjunct distinction dropped; about 750 to over 1,000 words/h after 3–4 months.
- Skeletal NP structure.
- Table 4 (as of 11/92): 4,885,798 tokens POS-tagged and 2,881,188 skeletally parsed; Dow Jones Newswire 3,065,776 tokens.
- POS error about 3%.

**Not used:** the paper's accuracy figures (5.4%/4.0%/9.6%). The paragraph mixes “accuracy” and “disagreement” and appears internally inconsistent.

**Also read:**
- Collins 1997 (ACL Anthology P97-1003), abstract and §4: WSJ sections 02–21, about 40,000 sentences; section 23, 2,416 sentences; 88.1/87.5 constituent precision/recall.
- Zaremba, Sutskever & Vinyals, arXiv 1409.2329v1 (2014-09-08), §4.1: PTB with 929k training words and a 10k vocabulary.

**Not verified / not claimed:**
- Whether the 1993 “Dow Jones Newswire” block is identical to the later “WSJ portion”. The node states the two facts separately.
- Details of later treebank releases.

## squad-2016 (branching / new branch `language-benchmarks`)

**Read:** arXiv 1606.05250v1 (2016-06-16), §1–3. EMNLP 2016 version (ACL Anthology D16-1264), header (Austin, Nov 1–5, 2016), §6, Table 5.
**Kept:**
- MCTest 2,640 questions; CNN/Daily Mail 1.4M cloze questions; Chen et al. showed less reasoning was needed.
- 107,785 QA pairs; 536 articles; 23,215 paragraphs; span answers; no choices.
- Precipitation examples (“gravity”, “within a cloud”).
- Copy-paste disabled; 4 min per paragraph; $9/h.
- EM and F1.
- Logistic regression 51.0% F1; sliding window about 20%; human F1 86.8% on the v1.0 test set, from the second answer as prediction; mismatches mostly about non-essential phrases.
- The paper admits span answers exclude highly interpretive questions.

**Also read:**
- BERT v1 §4.2 and Table 2: start/end vectors only; ensemble + TriviaQA test F1 93.2; leaderboard human 91.2 (Oct 8, 2018).
- Jia & Liang arXiv 1707.07328v1, abstract: 16 models drop from 75% to 36% F1. I did not confirm where the sentence is inserted, so the node says only “inserted”.
- SQuAD 2.0 arXiv 1806.03822v1, abstract: over 50,000 adversarial unanswerable questions; 86% → 66% F1.

## glue-2018 (branching / `language-benchmarks`)

**Read:** arXiv 1804.07461v1 (2018-04-20), §1–3.5, Table 1, Table 5, and abstract. v3 (2019-02-22, ICLR 2019): QNLI section and footnote. arXiv abs page: version history.
**Kept:**
- Single-task models struggle out of domain; SentEval evaluates only sentence encoders.
- Nine tasks with sizes from Table 1 (WNLI 706 to QQP 400k).
- Private test labels; online server; macro-average, with multi-metric tasks averaged first; model-agnostic; diagnostic set.
- Authors “cannot entirely rule out” superficial strategies.
- QNLI was converted from SQuAD.
- Best v1 baseline average 60.3 (single-task BiLSTM + ELMo); CoLA baselines near 0; SST-2 above 80.
- Naive multi-task learning gives no overall gain but helps low-data tasks.
- Diagnostic: lexical signals handled, logic not.
- v3 footnote: an earlier QNLI release had an artifact, and an updated version was released.

**Also read:**
- BERT v1 abstract and §4.1: GLUE 80.4, +7.6; WNLI excluded, with majority-class prediction submitted; 65.1 majority baseline.
- SuperGLUE arXiv 1905.00537v1, abstract and §1: SOTA 83.8 (MT-DNN), 3.3 below the human estimate of 87.1, exceeding it on QQP, MRPC, and QNLI; keeps 2 of 9 tasks.
- The SuperGLUE text also gives 87.3 elsewhere for the human estimate. I used 87.1, the figure tied to the 3.3-point gap.

## laion-5b-2022 (public-tools / new branch `field-data`)

**Read:** arXiv 2210.08402v1 (2022-10-16; arXiv comment: NeurIPS 2022 Datasets and Benchmarks track): abstract, §1, §3 (collection, post-processing, safety), §4–5 excerpts, §6–8, Appendix A (datasheet) excerpts, Table 1.
**Kept:**
- CLIP 400M, ALIGN 1.8B, BASIC 6.6B private.
- Public English datasets: YFCC100M 100M (text quality unclear), CC12M/RedCaps 12M, and smaller.
- Research concentrated in industrial labs.
- 5.85B pairs: 2.32B English, 2.26B multilingual, 1.27B no language.
- WAT `<img>` alt text; filters on text under 5 characters and images under 5 KB.
- ViT-B/32 CLIP thresholds 0.28 (English) and 0.26 (other); about 90% of about 50B removed.
- Tags rather than removal; filters “far from perfect”; academic use only, not deployment.
- LAION-400M CLIP matches or comes close to OpenAI's; ViT-L/14 is the first open-source reproduction.
- Stable Diffusion used LAION-2B-en, laion-high-resolution, and laion-aesthetics.
- Alt text is not necessarily a good description (Birhane et al.).
- Links only, with no guarantee images still exist; about 7 days on 10 nodes with img2dataset.

**Also read:** LAION blog “Releasing Re-LAION-5B” (2024-08-30).
- Kept: Stanford Internet Observatory findings (David Thiel, 19 Dec 2023); LAION withdrew LAION-5B; Re-LAION-5B removed 2,236 links (subsuming 1,008 from the SIO report) using partner hash lists; 5,526,641,167 pairs.
- This is LAION's own account. I did not open the SIO report itself.

---

## Connections: basis for each

| from → to | type | evidence in `from` node's source |
|---|---|---|
| transformer → adam-optimizer-2014 | uses | Transformer v1 §5.3 names the Adam optimizer and cites Kingma & Ba |
| bert → glue-2018 | uses | BERT abs page (current abstract): “pushing the GLUE score to 80.5%” |
| bert → squad-2016 | uses | Same abstract: SQuAD v1.1 test F1 93.2 and v2.0 83.1 |
| qlearning → bellman-dynamic-programming-1954 | adapts | Watkins & Dayan: “incremental method for dynamic programming”, “asynchronous DP”. They cite Bellman & Dreyfus 1962, not the 1954 paper; the description says so |
| laion-5b-2022 → clip | uses | §3 filtering with OpenAI ViT-B/32 CLIP; §5 retrains CLIP on LAION subsets |
| laion-5b-2022 → datasheets-2018 | uses | Appendix A, “Datasheet for LAION-5B dataset”, uses the datasheet question wording, and ref. [68] is “Can machines help us answering question 16 in datasheets…”. **Weaker link:** the reference list does not cite Gebru et al.'s Datasheets paper by name. Drop it if an explicit citation is required |
| glue-2018 → squad-2016 | adapts | GLUE v1 §3: QNLI is an automatic conversion of SQuAD |

## Placement notes

- **Origins era, four nodes:** Shannon, Robbins–Monro, Metropolis, and Bellman all go into one new branch, `noise-chance-decisions`. I did not use the existing `field-algorithms` branch because its summary is written specifically about Turing. The origins **era summary** currently names only the power station, Turing, and the transistor, so the maintainer may want to extend it.
- **Cooley–Tukey:** goes into the existing early-ai `field-algorithms` branch beside Dijkstra. Its theme (better order of computation, not more hardware) fits. I added an optional `branch_summary_suggestion` that mentions both works; ignore it if placements must carry only `branch`.
- **New branch ids:** they reuse the per-era convention `field-algorithms` / `field-data` where that id is free in the era (deep-learning, learning, public-tools). The branching era already has `field-data` (Datasheets), so SQuAD and GLUE get `language-benchmarks`.
- **Topic texts:** the `next` texts for topics `algorithms` and `data` will be out of date if these nodes are merged. For example, they say information theory, optimization, and dynamic programming “still need dedicated histories”.

## Candidates skipped

- **The Pile (2020):** arXiv v1 (2020-12-31) was downloaded but not drafted. I capped at 10 nodes and preferred LAION-5B, which links to existing nodes (CLIP, Datasheets, Stable Diffusion) and has a documented governance history.
- **MNIST (1998):** not drafted. Its primary description is in LeCun et al. 1998, which is already the source of the existing `lenet5-1998` node, and I did not open the dataset page.
- **Common Crawl:** not attempted.

## Physical foundations drafts: evidence log

Draft file: `physical.json` (9 nodes, 9 placements, 7 connections). Checked 2026-10-12.
Downloaded PDFs were converted with `pdftotext -layout` and read directly. Web pages were read with WebFetch, which returns quoted extracts, not the full page. A claim was kept only if I read it in one of the sources listed for that node.

Checks run: valid JSON; ids unique and not already in the tree; every connection `from`/`to` exists and its `source` is one of the `from` node's URLs; no CJK in English fields; zh/en `detail` paragraph counts match (2–3); every source URL is https; banned words absent; each year falls inside its era's range.

---

## memory-whirlwind-core-1953 (origins → new branch `field-memory`)

**Read**
- Project Whirlwind Summary Report No. 35, Q3 1953 (bitsavers scan, OCR text): introduction ("The Whirlwind Computers"), §1 quarterly review, §3 operation of WWI and §3.1 high-speed storage, §3.3 electrostatic storage, §4.11.
- Summary Report No. 37, Q1 1954: introduction, §3 operation, §3.1.1–3.1.2 (matrix cathode followers, new sense amplifier).
- Forrester, US 2,736,880 (Google Patents, read via WebFetch extracts): bibliographic data, background paragraph, 2-D coincident-current description, 3-D passage ("Two of these currents coinciding will not be sufficient…", "Only core (111)…"). The OCR is garbled in places; I did not use the exact current fractions for the 3-D case.
- An Wang, US 2,708,722 (WebFetch summary): title, dates, statement that reading flips the core and the information is lost unless transferred.
- Amdahl/Blaauw/Brooks 1964, p. 96 (registers "physically realized in core storage, local high-speed storage, or transistors"), Figure 1 (checked from a rendered page image).
- Liptay 1968, pp. 15–16.

**Kept**: 8 Aug 1953 first core bank (from the Memory Test Computer); 5 Sep second bank; electrostatic storage removed; access time 9 µs vs about 25 µs; better reliability and less maintenance; ES troubles (deflection shift, positive switching) with no permanent cure; 1954 capacity 32,768 binary digits; read must be followed by rewrite plus a post-write disturb, which caused transients and a new sense amplifier; patent filing and grant dates.

**Not used / unverified**: who invented core memory first; ferrite composition; non-volatility (no source I read states it explicitly); Forrester's 1951 J. Appl. Phys. paper (paywalled, not read). The Q1 1954 report also gives 40,000 operations/s against 20,000 in 1953, but it does not attribute the speedup to core memory, so I left it out.

## memory-ibm-ramac-disk-1956 (early-ai → `field-memory`)

**Read**
- IBM 305 RAMAC Manual of Operation, Form 22-6264-1, April 1957 (bitsavers, 152 pp.; OCR text): opening definition, "In-line processing", "IBM Punched-Card Approach" (seven machines), RAMAC advantages (no sorting, console inquiry), magnetic disk storage description (50 disks, about 2 ft, 1,200 rpm, 100 tracks, 10 sectors, 100-character records, 5,000,000 characters, 62,500 cards, outer five inches, forked arm), sample invoicing program timing (600 ms approximate access, about 450 invoices/hour).
- ETHW IEEE Milestone "RAMAC, 1956" (WebFetch extract): announcement of disk technology on 6 May 1955; first 350 commercially available on 4 Sep 1956; "5 million 6-bit characters".
- IBM History, RAMAC (WebFetch extract): 7 bits per character; goal half a second; engineer's recollection of about 800 ms.

**Kept**: all of the above, with the date convention stated (1956 = commercial availability per the IEEE record).
**Conflict noted**: IBM's page says the team "stacked 16 disks", which disagrees with the manual's 50. That may describe a prototype; I used the manual. IBM's and the IEEE plaque's "first" claims were left out. The September 14, 1956 press-release date reported by secondary sites was not verified.

## chips-ibm-system360-1964 (early-ai → `field-chips`)

**Read**
- Amdahl, Blaauw & Brooks, "Architecture of the IBM System/360", IBM J. Res. Dev., April 1964 (UC Davis course scan): abstract, introduction and definition of "architecture", design objectives, intermodel compatibility (definition of "strictly program compatible"), Figure 1 (rendered page image checked by eye), data format (4/8 vs 6 bit, 1961 decision, 32/64-bit floating point, hex radix), multiple accumulators (16 × 32-bit GPRs, 4 × 64-bit FPRs; registers physically in core / local store / transistors), storage hierarchies. Crossref confirms DOI 10.1147/rd.82.0087, pp. 87–101.
- IBM History, System/360 (WebFetch): launched 7 Apr 1964; six processor models, fiftyfold range; replaced five existing product lines; "for the first time…" claim (attributed to IBM).
- Liptay 1968, p. 15: cache handled without program assistance "since the Model 85 must be compatible with the rest of the SYSTEM/360 line".

**Not verified**: first shipment dates; sales figures.

## chips-moore-cramming-1965 (early-ai → `field-chips`)

**Read**: the full 1998 Proc. IEEE reprint (UT Austin course copy, pp. 82–85): sections I–IX. Crossref confirms DOI 10.1109/JPROC.1998.658762; the reprint footnote gives Electronics, pp. 114–117, 19 Apr 1965.
**Kept**: minimum cost at 50 components per circuit; 1970 cost per component a tenth of 1965's; roughly a factor of two per year; 65,000 by 1975; "a bit more uncertain" over the longer term but at least ten years; two-mil squares, 500 per inch, a quarter million per square inch, about 1/4 square inch; optical techniques suffice; heat argument; smaller functions packaged separately; home computers and portable communications.
**Negative claims** (no two-year doubling, no 18-month performance claim, no "Moore's Law" name) were checked against the full reprint text.
**Not used**: the 1975 IEDM revision (no readable primary copy found).

## energy-pue-metric-2007 (connected-computing → `field-energy`)

**Read**
- The Green Grid White Paper #49 (2012), LBNL-hosted PDF: executive summary; §I introduction (2007 publication of PUE and DCiE; the 2009 harmonization task forces and member list; comparisons not initially recommended; virtualization example); §II metric list; §4 measurement points and the PUE range 1.0 to infinity, the 22 LBNL datacenters at 1.3–3.0, the 1.6 design figure; §4.10 power vs energy; §6.6.2–6.6.3 (energy metric, "better-than-perfect" values, no credit for reused waste heat, official reports below 1.0 rejected).
- Google Data Centers "Efficiency" page (WebFetch extract): fleet TTM PUE 1.09 and 2025 annual average 1.09; overhead included (substations, transformers, water treatment); Uptime Institute 2025 survey average 1.54 as cited by Google.

**Gap**: the original 2007 Green Grid white paper ("Green Grid Metrics: Describing Datacenter Power Efficiency", Feb 2007) was not read; the Internet Archive was offline. The 2007 date rests on WP49's statement. The limit says so.
**Status `adopted`**: based on WP49's task-force agreement and The Green Grid's own adoption claim, which the text attributes to The Green Grid. This is not a deployment survey.

## networks-fat-tree-paper-2008 (connected-computing → `field-networks`)

**Read**
- Al-Fares, Loukissas & Vahdat, SIGCOMM 2008: published version (ccr.sigcomm.org, http only) and author copy (cseweb.ucsd.edu, https). I checked that the key figures match in both. Sections read: abstract, §1, §2.1–2.3, §3.1–3.6, §3.9 (power and heat), §4.2, §5 (experiment, Table 2, Table 3), §6 opening, §8. Crossref confirms DOI 10.1145/1402958.1402967.
- Singh et al., "Jupiter Rising", SIGCOMM 2015: abstract, §1, §2, Table 2, §3.1–3.2, reference list (cites [2] Al-Fares).

**Kept**: 2.5:1–8:1 oversubscription (400–125 Mbps); 27,648 hosts with 48-port switches; $8.64M vs $37M (the $37M is for 20,000 hosts, as the text says); k-ary structure; 576 paths; two-level tables and host-ID spreading; Click emulation on ten machines with 96 Mbit/s links; Table 2 random results 53.4 / 75.0 / 93.5%; cabling excluded from cost; Clos "more than fifty years ago"; fat-tree from Leiserson [23]. From Jupiter: five generations, 100× over ten years, more than 1 Pbps; Firehose 1.1 was the first production Clos, first deployed 2006 (Table 2).
**Not used**: Leiserson's paper (not read; its year is not stated in the text).

## networks-nvlink-p100-2016 (branching → new branch `field-networks`)

**Read**
- NVIDIA Tesla P100 whitepaper WP-08019-001_v01.1 (© 2016): pp. 7–8 (multi-GPU trend, PCIe bottleneck, InfiniBand and 100 Gb Ethernet between systems, 160 GB/s and 5×, pre-production note), pp. 20–24 (NVHS signaling, links and sub-links, hybrid cube mesh, POWER8, HSHUB), Appendix A pp. 35–36 (layers, flits, 25-bit CRC, replay buffer, 80 GB/s per direction).
- NVIDIA press release, 5 Apr 2016 (WebFetch extracts): 5× bandwidth, eight GPUs per node, IBM POWER8; DGX-1 general availability in June; server makers early 2017.
- V100 whitepaper v1.1, p. 19: NVLink introduced 2016 with P100; 20→25 Gb/s, 4→6 links, 300 GB/s; CPU load/store/atomics to HBM2.
- NVIDIA Hopper press release, 22 Mar 2022 (WebFetch extracts): fourth-generation NVLink, 900 GB/s per GPU in DGX H100, NVLink Switch up to 256 H100s across 32 DGX H100 nodes.

**Vendor claims** (5×, 900 GB/s, availability plans) are attributed as such. NVLink's first disclosure (it was reportedly on NVIDIA's roadmap in 2014) was not verified and is not claimed.

## chips-tpu-v1-paper-2017 (branching → `field-chips`)

**Read**
- Jouppi et al., arXiv 1704.04760v1 (submitted 16 Apr 2017, per the arXiv abstract page): abstract, §§1–8 (Tables 1–7, rooflines, response time, perf/W, energy proportionality, alternative designs, fallacies), §9 related work, §10 conclusion.
- Jouppi et al., ISCA 2021 "Ten Lessons…" (full text read from a course-hosted copy of the IEEE download; the node cites the DOI, which Crossref confirms): Table 1 (TPUv2 first deployed Q3 2017, training and inference, 256 chips).
- Jouppi et al., arXiv 2606.15870v1 (submitted 14 Jun 2026): introduction ("The announcement in May 2016 of the first Tensor Processing Unit").

**Not verified directly**: Google's May 2016 blog post. The date comes from the 2026 paper by Google authors.

## energy-tpu-v3-liquid-cooling-2018 (branching → new branch `field-energy`)

**Read**
- Google, "100 things we announced at I/O '18", 10 May 2018 (WebFetch): item 19, third-generation TPUs are liquid-cooled.
- ISCA 2021 "Ten Lessons…": Table 1 (TDP 75/280/450/175 W; v3 first deployed Q4 2018; v4i Q1 2020) and lesson ⑤ (air-cooled v1/v2, liquid-cooled v3; adjacent racks; inference DSAs should be air-cooled). Also the remark that provisioning power costs about twice the electricity.
- Padilla & Iyengar (Google), Hot Chips 2025 tutorial PDF: slide 4 timeline (1960–1990 industry liquid cooling; 2018 Google's first public announcement), slide 5, slide 7 (CDU, manifolds, cold plates, heat rejected to datacenter water, UPS), slide 8 (TPUv3 cold plates in series, passive, lidded package), slide 10 (density doubled; supercomputer 4×; TDP 1.6×; frequency +30%; pump power under 5% of fan power; 256 chips in 4 racks vs 1,024 in 8).
- Google Cloud blog, 29 Apr 2025 (WebFetch extracts): first used liquid cooling in TPU v3, deployed 2018; doubled density, 4× supercomputer; in-row CDUs isolating the rack loop from the facility loop; about 99.999% availability since 2020.
- arXiv 2606.15870v1: Table 1 (cooling and pod size per generation) and the conclusion ("liquid cooling exclusively for training since TPU v3 in 2018").

**Not used**: secondary press accounts (Data Center Knowledge, HPCwire) of Pichai's keynote wording; the Cloud TPU v3 beta date (October 2018), which was not read in a primary source.
**Caveat**: the generic CDU description in the Hot Chips slides is not specific to the 2018 v3 deployment. In the body I kept only the v3-specific cold-plate facts and moved the CDU material to the "later" paragraph and the limit.

---

## Placements and branch notes

- New branches proposed: `field-memory` in `origins`, and `field-networks` and `field-energy` in `branching`.
- The `origins` era summary currently says the period had three things; adding the core-memory branch means it needs one more clause. Flagged in the placement note; not drafted.
- The existing `connected-computing / field-networks` branch title and summary describe only RDMAP. A combined title and summary are suggested.
- Suggested summary updates (optional) for `early-ai/field-memory`, `early-ai/field-chips`, `connected-computing/field-energy`, and `branching/field-chips`.
- The topic `next` texts for energy, chips, memory, and networks would need updating if these nodes land (for example, "TPU / ASIC designs" and "liquid cooling" stop being gaps). Not drafted.

## Connections (all sources are URLs listed on the `from` node)

1. chips-tpu-v1-paper-2017 → chips-roofline-report-2008 (adapts): TPU paper §4, "we adapt the Roofline Performance model".
2. chips-tpu-v1-paper-2017 → energy-proportional-computing-2007 (uses): §6 cites [Bar07] and measures power from 0% to 100% load.
3. nvidia-volta-2017 → networks-nvlink-p100-2016 (adapts): V100 whitepaper p. 19 (URL already on the Volta node).
4. networks-fat-tree-paper-2008 → distributed-mapreduce-paper-2004 (complements): §1, MapReduce shuffle as the bandwidth example.
5. ibm-model85-cache-1968 → chips-ibm-system360-1964 (uses): Liptay p. 15, compatibility with the System/360 line.
6. ibm-model85-cache-1968 → memory-whirlwind-core-1953 (uses): Liptay, "large core storage yields the desired storage capacity". The description says this shares the technology and does not mean Whirlwind's design was reused.
7. chips-ibm-system360-1964 → memory-whirlwind-core-1953 (uses): registers in core storage (p. 96) and core arrays in Figure 1, with the same caveat.

Connections 6 and 7 link to a node dated by the Whirlwind event, not to core memory in general. If the editor prefers stricter links, drop them.

## Candidates skipped

- **Flash memory (Masuoka, Toshiba, IEDM 1984 / NAND 1987)**: the IEDM papers are paywalled. Readable material was secondary: the Semiconductor History Museum of Japan and Kioxia's corporate page. Those two disagree on the NAND date (1987 vs 1988, even across two pages from the same museum).
- **InfiniBand Architecture Specification 1.0 (2000)**: the spec is sold by the IBTA, not free. Only press reprints were found, and they give conflicting dates (Volume 1 on 26 Sep vs a release on 24/25 Oct 2000).
- **Google Jupiter (SIGCOMM 2015) as a separate node**: read in full, but used inside the fat-tree node (later practice, plus the 2006 Firehose 1.1 caveat) to avoid two overlapping datacenter-topology nodes. It could become its own node in the `deep-learning` era with a new `field-networks` branch.
- **AC power transmission**: no readable primary source checked in the time available.

## Applications tracks: evidence log

Checked 2026-10-12. Drafts are in `applications-tracks.json` (8 nodes, 8 placements, 2 connections). Nothing in the repository or in `chronicle/site/static/technology-tree-data.json` was edited.

The merged result was checked only in a temporary copy: the draft was merged into the current data file (which already declares `applications.tracks`), then `technology_chronicle.validate()` and `render()` were run in both languages. Validation passed, and all eight `event-*` anchors rendered. That check covers structure only; the facts below were checked by reading the sources.

## Schema note

- The current data file names the science track `science-health` (used by `mycin` and `alphafold2`), not `science`. Using `science` fails validation, so DENDRAL and GraphCast use `science-health`.
- Placements follow the shape other drafts use: `{node, era, branch}`, plus `new_branch` when the branch is new, and an optional `suggested_summary` when an existing branch's summary would otherwise leave out the new work. `filtering-ranking` is defined once (on `grouplens-1994`) and reused by `okapi-bm25-1994`.

## dendral-1969

- **Read:** Buchanan, Sutherland & Feigenbaum, "Heuristic DENDRAL", *Machine Intelligence 4* (1969), pp. 209–254: the full 46-page scan in the NLM Lederberg Papers. The NLM catalog record confirms Edinburgh University Press, 1969, editors Meltzer and Michie. Also read Buchanan & Shortliffe (1984), *Rule-Based Expert Systems*, chapter 1 (author-hosted).
- **Claims kept:** the 1964 DENDRAL algorithm enumerates acyclic structures without redundancy and knows only valences, and the original program used no real data. The pipeline is preliminary inference maker → data adjustor → structure generator → predictor → evaluation function. For C8H16O there are 790 valence-only graphs and 698 stable acyclic structures. The 3-octanone run used GOODLIST ethyl-ketone and BADLIST alcohols, ethers, aldehyde and other ketones, and 3 structures were output, with the correct one first in generator order. The 4-octanone spectrum reduced to 1. In the authors' words the heuristics are "more like suggestions than rules", and nothing guarantees the correct structure is not bypassed. Failed runs led to revisions with chemist informants. QUEST adds functional groups, with an ester example. Lisp on the PDP-6, about 80,000 words. Ring handling was the "major deficiency", and the program approached chemists' level only for a few select classes. Printed output is labeled "JULY-4-1968 VERSION". The 1984 book says DENDRAL had become several interacting programs by the mid-1970s, and that MYCIN was an outgrowth of DENDRAL, with production rules the foremost lesson.
- **Not claimed / unverified:** I did not open Stanford AI Memo AIM-62. A search snippet dates it July 1968, and a 1970 letter in the NLM files cites it as February 1967; the node avoids both. The evaluation function's final ranking for 3-octanone (Table 10, continued) is garbled in the OCR, so the node says only that the correct structure was among the 3. The 1984 book's "first AI program to emphasize ... specialized knowledge" claim is left out.
- **Possible connection, not added:** `mycin` → `dendral-1969` (`adapts`) is supported by the 1984 book chapter, but the validator needs the source on the `from` node, and `mycin`'s only source is a scanned 1975 PDF with no text layer. Adding the chapter URL to `mycin.sources` would make this connection valid.

## shakey-1971

- **Read:** Nilsson (ed.), *Shakey the Robot*, SRI Technical Note 323, April 1984: chapters 1 (goals and ground rules from the 1966 report; the five-level overview from the December 1971 report [11]), 3 (axiom world model), 5 (ILAs, FINDPATH), 8 (STRIPS/PLANEX/MACROP) and 9 (experiments). Also the SRI publication record page.
- **Claims kept:** the project ran 1966–1972; first integrated system 1969 (SDS-940, radio-controlled); second 1971 (PDP-10/PDP-15). Earlier automata used "relatively few, simple, onboard logic circuits". The 1966 goal included "incompletely specified problems" in "realistic environments". The five levels are vehicle and links, LLAs, ILAs, STRIPS and PLANEX. The world model is predicate-calculus clauses, with 170 axioms initially. Task 1 was typed at a teletype and converted to BLOCKED(DPDPCLK, RCLK, BOX2). During it an unknown box was placed in front of DMYSCLK; CLEARPATH and OBLOC added BOX3, and PLANEX found another instance of MACROP1 via RPDP. Task 2 (UNBLOCK DMYSCLK) reused the first four operators of MACROP1. Saving plans is "a form of learning". The experiments were planned in [11] and "later carried out and recorded in a film". FINDPATH chooses the fewest legs rather than minimum distance "to reduce the amount of subsequent thinking and execution time". Vision is restricted to orientation, object detection and location, and there was a ground rule of no extensive visual pattern-recognition research. Room contents are known except RMYS.
- **Year convention:** 1971 = second system completed plus the December 1971 report that describes these experiments. The film's date was not verified.
- **Not claimed:** "first mobile intelligent robot" (an IEEE Milestone title, not checked against primary text), and A* (the 1968 A* paper is a scanned PDF with no text layer, and TN 323 shows FINDPATH using breadth-first search).

## alvinn-1988

- **Read:** the full NIPS 1988 paper (PDF); the NeurIPS record page ("Advances in Neural Information Processing Systems 1 (NIPS 1988)"); the CMU RI record (BibTeX year 1989, month December, Morgan Kaufmann, pp. 305–313); the full NIPS 1990 follow-up ("Rapidly Adapting Artificial Neural Networks for Autonomous Navigation"); and the Stanley paper's citations of Pomerleau 1991/1993.
- **Claims kept (1988):** traditional image processing works under some conditions only, and its processing stays fixed. The network is 3 layers: a 30×32 blue-band video retina, an 8×32 range retina and 1 feedback unit, so 1,217 inputs, 29 hidden units, and 45 direction units plus 1 feedback output. The target is a "hill" (0.10…1.00…0.10). Training used 1,200 simulated snapshots on the Warp simulator; after 40 epochs about 90% were within two units. On the road it drove 1/2 m/s along 400 m of wooded campus in sunny fall conditions. Hidden units act as road filters, and some units watch only the left edge. Half an hour of backpropagation compared with "many months" of tuning. Forks cause oscillation. Wider weather and lighting tests were needed before fair comparison. Obstacle planning and map-based planning were future work.
- **Claims kept (1990):** training on the fly from a human driver; 14 shifted and rotated copies per image; about 5 minutes on a Sun-4; 25 images/s; up to the Navlab's 20 mph maximum. The paper refers back to the 1988 NIPS presentation.
- **Date convention:** follows the backlog caution. Conference paper NIPS 1988 versus CMU record December 1989; the simulated training (1988) is kept separate from on-vehicle learning from a driver (1990).

## stanley-grand-challenge-2005

- **Read:** Thrun et al., "Stanley: The Robot that Won the DARPA Grand Challenge", *J. Field Robotics* 23(9):661–692, 2006 (author PDF): §§1, 2, 5, 6, 10, 11. The Wiley DOI resolves.
- **Claims kept:** the 2004 race (March 13): 15 raced, none beyond 5%. The 2005 race (October 8): 195 registered, 23 raced, 5 finished, and Stanley won in 6:53:58. Rules: no manual intervention, under 10 h, RDDF given 2 h before the start. Laser range is about 22 m, with lasers aimed up to 30 m. Pose errors under 0.5° produced 12.6% of drivable area flagged as obstacle at δ=15 cm, and pose systems costing "hundreds of thousands of dollars" were too costly. The probabilistic test has variance scaling with time difference. Labels came from human driving, "similar in spirit to Pomerleau (1993)", and the false-positive rate fell from 12.6% to 0.002%. Vision finds no corridor within 40 m → 25 mph. 68.2% / 31.8% / 18.1% / 13.1% speed shares; without vision about 7 h 5 min, possibly behind Sandstorm. At Beer Bottle Pass the GPS corridor aligned poorly. 17 laser stalls, 4 significant swerves, no collision. Not able to navigate in traffic; cannot tell tall grass from rocks. Slower robots were paused; no global path planning was needed. Vision is used only for velocity control. Received April 13, 2006.
- **Connection basis:** the paper cites Pomerleau (1991) = the NIPS 3 ALVINN follow-up, and Pomerleau (1993) for the human-driving labels. The connection text names these rather than claiming that Stanley reused the 1988 network.

## grouplens-1994

- **Read:** the author-hosted HTML of the CSCW '94 paper (pp. 175–186), full text. The Figure 5 matrix and the prediction formula are GIF images, which I downloaded and read directly. The ACM DOI resolves to the ACM portal (page not read).
- **Claims kept:** more than 8,000 newsgroups and more than 100 MB/day. Existing mechanisms: newsgroups, moderation, kill files, string search. Ratings run 1–5, under pseudonyms. BBBs correlate past ratings, and ratings are posted as Usenet articles. In the worked example r(Ken,Meg)=+1, r(Ken,Lee)=−0.8 (from the formula image), r(Ken,Nan)=0, and article 6 has Meg 5 and Lee 2, giving a prediction of 4.56 for Ken and 3.75 for Nan. Robustness to scale use, with the advice "assign the rating you wish GroupLens had predicted". The planned benchmark predicts deleted ratings from a fully rated training set. No prediction is possible for unrated articles; there is a start-up interval (four-person Minnesota pilot); there is an incentive to wait for others' ratings; there was a seven-person Schlumberger pilot; the test is "not designed to demonstrate that people prefer" it; Tapestry is "similar in spirit".
- **Editorial link:** describing GroupLens's method as what Koren et al. call a "user-oriented neighborhood method" is a classification by definition. The 2009 article does not cite GroupLens, so no connection was added.

## okapi-bm25-1994

- **Read:** "Okapi at TREC-3", full text (the Microsoft Research-hosted PDF; the MSR record gives January 1995, NIST); the TREC-3 overview (Harman) for the 2 GB TIPSTER collection; the trec.nist.gov proceedings index ("held in Gaithersburg, Maryland, November 2-4, 1994", SP 500-225); the NIST TREC browser for run IDs; the Lucene 6.0.0 CHANGES (LUCENE-6789); the Apache archive listing for the 6.0.0 release files (April 2016); and Brin & Page 1998 on TREC.
- **Claims kept:** TREC-1 used the classical RSJ model "with no account taken of document length or term frequency", and simple weighting favoured long documents (footnote). TREC-2 added tf and length. In TREC-3 BM11 and BM15 were combined into BM25, with the formula tf·(k1+1)/(K+tf), K=k1((1−b)+b·dl/avdl); b=1 → BM11, b=0 → BM15, b≈0.75 usual. "slightly improved results, at the cost of another parameter to be guessed"; results for different parameters were "not explicitly given". Official ad hoc runs: citya2 BM25(2.0,0,1,0.75) AveP 0.337; citya1 with passages and expansion AveP 0.401, better on 35 topics. The worked numbers (1, 2.5, 2.22) are my arithmetic with the paper's formula and its common parameters, labeled as such in the text.
- **Note:** the TREC-3 proceedings page on trec.nist.gov labels the volume SP 500-226 in its header, while the proceedings index and DOIs use SP 500-225. The node uses 500-225.

## netflix-prize-matrix-factorization-2009

- **Read:** Koren, Bell & Volinsky, *IEEE Computer* 42(8), August 2009, full text (read from a university course copy, not listed as a source; the node cites the DOI and the IEEE record). Also the official Netflix Prize home page and leaderboard as archived by the Wayback Machine (home page read via its 2010 capture; leaderboard via the 2011-01-02 capture).
- **Claims kept:** two families, neighborhood and latent factor; "collaborative filtering, a term coined by the developers of Tapestry". 20–100 factors. Biases, with the Joe/Titanic example (3.7 + 0.5 − 0.3 = 3.9). Implicit feedback, temporal dynamics, confidence. Contest data: more than 100M ratings, about 500k users, more than 17k movies, about 3M test ratings, RMSE, 10% for $1M, $50k progress prizes. Earlier public data was orders of magnitude smaller; more than 48,000 teams from 182 countries. BellKor led from summer 2007; the 2007 Progress Prize at 8.43%; 2008 with BigChaos at 9.46%. Winning entries had more than 100 predictor sets, mostly factorization. The two factor axes in Figure 3. Archived official site: grand prize awarded September 21, 2009 to BellKor's Pragmatic Chaos; leaderboard test RMSE 0.8567 (10.06%), with The Ensemble at an identical score submitted 20 minutes later.
- **Unverified / not claimed:** the team membership of BellKor's Pragmatic Chaos beyond its name; what Netflix deployed (the Netflix Tech Blog was blocked: 403 and Cloudflare); Figure 4's grand-prize threshold of 0.8563, which appears to be on a different subset from the leaderboard's 0.8567 and so was left out. The Wayback Machine was intermittently offline during the check, so the cited home-page snapshot URL is the redirect target of the 2010 capture I read.

## graphcast-2023

- **Read:** arXiv v1 (2022-12-24) and v2 (2023-08-04) full text; the DeepMind blog of 2023-11-14 (in full). The Science DOI resolves, but science.org was not readable (bot wall), so the published version itself was not read.
- **Claims kept (v2 unless noted):** NWP "cannot directly use historical weather data to improve the underlying model", and experts improve it by hand. Inputs are the current and −6 h states, and the model predicts +6 h autoregressively. The grid is 0.25° (721×1440), with 227 variables and 37 levels (v1 caption: 1,038,240 points, 235,680,480 values). The multi-mesh is icosahedral, finest 40,962 nodes (v1). The output is a residual update. Training used 1979–2017 data, with tests from 2018. 90% of 1,380 targets against HRES. Cyclone tracking used ECMWF's protocols, with lower median track error over 2018–2021 and paired-significant gains at 18 h–4.75 days. Training took about four weeks on 32 TPU v4 (v1 said about three weeks). Under a minute on one TPU v4. MSE blurring, deterministic only, and depends on NWP-assimilated data; "should not be regarded as a replacement". Evaluated at 0.25° against HRES at 0.1° (v1); precipitation excluded for ERA5 biases. Code and weights are on GitHub. The blog says ECMWF runs a live experiment, and it reports the same 90% / 1,380 figures.
- **Year convention:** 2023, with figures from v2, which match DeepMind's November 2023 description of the Science paper. v1 (2022) used 2,760 combinations and is noted in `limit`.
- **Not claimed:** the blog's Hurricane Lee anecdote (company claim, not in the paper); "first" ML weather model (v1 and v2 name Keisler 2022, FourCastNet and Pangu-Weather as earlier work).

## Connections

1. `alvinn-1988` → `backprop` (`uses`): the ALVINN 1988 PDF says it is a "3-layer back-propagation network" trained with the Warp back-propagation simulator.
2. `stanley-grand-challenge-2005` → `alvinn-1988` (`adapts`): the Stanley PDF, §5.2 ("similar in spirit to Pomerleau (1993)") and §6 (road finding cites Pomerleau 1991). The description says Stanley steered via planner and controller, with vision used only for speed (§6).

No connection was added for GraphCast (its sources do not cite the tree's GCN or GAT as methods it builds on), Netflix → GroupLens (not cited), BM25 → Google prototype (Brin & Page discuss TREC and the vector space model, not BM25), or Shakey (no tree node it cites).

## Skipped candidates

None of the listed candidates was skipped; all eight were verifiable from readable primary text. Deep Blue, Watson, GNMT, YouTube recommendations and Codex/Copilot were left to the other helpers, as instructed.
