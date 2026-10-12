# Chronicle evidence ledger

Checked: **2026-10-12**. Scope: six infrastructure additions, Sojourner, and four earlier speech / vision / search / representation milestones. This is not a fresh audit of every existing node or external link. The data-level `reviewed` date records this bounded update, not complete coverage through that date.

## Selection and evidence rules

- Add missing questions, not recent-paper rankings: data independence; reusable compilation; protected remote data transfer; light-load power; CPU/memory performance bounds; durable distributed storage. Sojourner adds a non-learning autonomy example.
- `historical` describes a dated paper, report, specification, or mission. It does not claim present-day deployment, obsolescence, universal adoption, or optimality.
- A paper and its mirror are one intellectual source. An author's bibliography or institutional catalog can cross-check dates but is not an independent replication. Later system papers establish their own reported use, not an inevitable historical lineage.
- Each added node has multiple useful sources. The entries below distinguish original evidence, date checks, independently authored follow-up, and same-institution evidence. No new `connections` are inferred from chronology; the existing connections remain unchanged.
- Chinese and English node text are newly written summaries. Source titles identify works, not copied explanatory prose. Later AI examples stay explicitly later, rather than being attributed to the earlier publication.

## 1. Relational model — `databases-relational-model-1970`

Checked: **2026-10-12**. Placement: `early-ai / field-distributed`; topic `distributed`. This is the existing software/systems grouping, not a claim that the relational model is inherently distributed.

**Claims retained**

1. Codd's CACM article appeared in **June 1970** and described data through relations while addressing dependence on ordering, indexes, and access paths.
2. Data independence separates application logic from changes in storage representation; the article is not a SQL or product release.
3. **MADlib (2012)** is a concrete later ML/database intersection: regression and clustering implementations inside PostgreSQL and Greenplum.

**Evidence and roles**

- [Codd, original article](https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf): read the first-page issue date, §§1.1–1.2 and the relation discussion. This is original text hosted by a university, not a separate Penn study. The introduction explicitly excludes implementation details from its scope.
- [IBM Research publication record](https://research.ibm.com/publications/a-relational-model-of-data-for-large-shared-data-banks): institutional record gives June 1, 1970; the node conservatively uses the issue month/year. This checks metadata against the scan, not independent adoption.
- [MADlib, PVLDB 2012](https://dsf.berkeley.edu/cs286/papers/madlib-vldb2012.pdf): independently authored primary system report; §§3–4, especially §§4.2–4.3, document in-database logistic regression and k-means. It supports the later implementation example, not a direct causal edge from Codd to MADlib.

**Uncertainty / exclusions:** no claim that relational databases originated all AI data pipelines, that the model guarantees good data, or that all implementations share SQL, transaction, or physical execution semantics. The ACM DOI redirect failed during this check; technical claims were checked in the readable original scan instead.

## 2. LLVM — `software-llvm-paper-2004`

Checked: **2026-10-12**. Placement: `connected-computing / field-software`; topic `software`.

**Claims retained**

1. The **CGO 2004** paper describes a typed, low-level SSA representation and a framework supporting analysis and transformations across compilation stages.
2. This is not LLVM's project-start date: its official archive records **LLVM 1.0 on November 18, 2003**.
3. **TVM (OSDI 2018)** includes an LLVM IR code-generation path, while treating tensor graphs, operator transformations, and scheduling as additional compiler work.

**Evidence and roles**

- [LLVM paper](https://llvm.org/pubs/2004-01-30-CGO-LLVM.pdf): original technical account, especially §§2–3 and conclusion.
- [LLVM publication record](https://llvm.org/pubs/2004-01-30-CGO-LLVM.html): lists March 2004 at CGO and notes an earlier technical report. The `2004-01-30` URL component is not treated as the conference date.
- [LLVM historical announcements](https://www.llvm.org/OldNews.html): separate project record for the 2003 release boundary, not independent research corroboration.
- [TVM paper](https://www.usenix.org/system/files/osdi18-chen.pdf): independently authored primary implementation evidence, Figure 2 and §§3–4. Its graph/low-level-IR distinction prevents attributing a complete neural-network compiler to the 2004 framework.

**Uncertainty / exclusions:** no assertion that LLVM invented intermediate representations, that all AI compilers use it, or that its presence guarantees a speedup. The sources do not establish a LLVM-to-CUDA invention chain; their shared era branch is a reading arrangement only.

## 3. RDMAP — `networks-rdmap-rfc-2007`

Checked: **2026-10-12**. Placement: `connected-computing / field-networks`; topic `networks`.

**Claims retained**

1. **RFC 5040 (October 2007)** specifies protected access to advertised remote buffers, layered over DDP, with reducing copies and CPU overhead as design goals.
2. This dates a particular RDMA protocol specification, not RDMA's invention or the origin of InfiniBand/RoCE.
3. **TensorFlow (OSDI 2016), §5**, reports both gRPC/TCP and RoCE for inter-task communication. This establishes an ML use of the broader RDMA family, **not use of RFC 5040 RDMAP**.

**Evidence and roles**

- [RFC 5040](https://www.rfc-editor.org/rfc/rfc5040.html): primary normative document; header and §§1–3 establish date, protection, buffer advertisement, and layering. Statements of design goals are not benchmark measurements.
- [IETF document history](https://datatracker.ietf.org/doc/rfc5040/history/): records RFC publication on October 31, 2007, followed by a November 5 workflow-state update. These are different administrative events; the node retains the RFC's October publication month. Same standards process, not independent corroboration.
- [TensorFlow system paper](https://www.usenix.org/system/files/conference/osdi16/osdi16-abadi.pdf): separately authored primary ML implementation report; §5, printed p. 275, names the communication protocols. It does not identify the deployment as RFC 5040.

**Uncertainty / exclusions:** no RDMAP-to-TensorFlow dependency edge, claim of zero communication cost, or assertion that current TensorFlow versions retain the same transports. InfiniBand, RoCE, switched fabrics, and PCIe still need their own histories.

## 4. Energy proportionality — `energy-proportional-computing-2007`

Checked: **2026-10-12**. Placement: `connected-computing / field-energy`; topic `energy`.

**Claims retained**

1. Barroso and Hölzle's **December 2007** article argues that power should fall with workload, rather than evaluating only full-load efficiency; memory and disk power matter alongside CPUs.
2. **PowerNap (2009)** investigates a different approach to reducing idle power, rather than establishing that energy proportionality was already achieved everywhere.
3. The **2017 TPU report**, §§5–6, distinguishes power including the host from incremental accelerator power and examines changes with offered load. It supplies an AI-specific example, not current-device measurements.

**Evidence and roles**

- [Original IEEE Computer article](https://storage.googleapis.com/gweb-sustainability.appspot.com/pdf/33387.pdf): printed pp. 33–37; publication month is visible in the original page headers. Figures 2–4 and accompanying text distinguish existing server behavior from a proposed design goal.
- [Google Research publication record](https://research.google/pubs/the-case-for-energy-proportional-computing/): confirms authors, venue, and 2007; same institution, not independent verification.
- [PowerNap, ASPLOS 2009](https://web.eecs.umich.edu/~twenisch/papers/asplos09.pdf): independently authored Michigan/CMU primary research, abstract and §1. It investigates short idle intervals and active/idle transitions. Its reference [1] says **January 2007**, conflicting with the original's **December 2007** header; use the original for the month. It corroborates the year and problem, not the incorrect month or a universal solution. A first fetch failed; a retry returned readable text.
- [TPU report, fixed April 2017 v1](https://arxiv.org/pdf/1704.04760v1): §§5–6 and reference [Bar07]. This is later Google-authored implementation/measurement evidence, not institutionally independent replication of Google's 2007 observations.

**Uncertainty / exclusions:** no historic power percentage or speedup is generalized to today's fleet. Energy proportionality, full-load efficiency, facility provisioning, and electricity consumed over time are distinct questions. The shared era branch with warehouse-scale computing is not an asserted causal genealogy.

## 5. Roofline — `chips-roofline-report-2008`

Checked: **2026-10-12**. Placement: `connected-computing / field-chips`; topic `chips`. This fills a CPU/memory performance-analysis gap, not the still-missing CPU microarchitecture history.

**Claims retained**

1. **UCB/EECS-2008-134 is dated October 17, 2008**. The subsequent CACM article appeared in **April 2009**; the node uses the public report date rather than silently treating journal publication as the beginning.
2. The basic model bounds throughput by the smaller of peak computation and memory bandwidth times operations per DRAM byte. It distinguishes computation limits from memory-supply limits on multicore systems.
3. The **2017 TPU report, §4**, explicitly adapts Roofline to neural-network workloads and compares CPU, GPU, and TPU behavior.

**Evidence and roles**

- [Original Berkeley report](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/Archive/EECS-2008-134.pdf): cover dates the report; §§2–3 give the intensity definition, basic bound, and additional ceilings. The model is an explanatory bound, not an exact runtime simulator.
- [Berkeley report catalog](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/EECS-2008-134.html): matching date and report number; an archive cross-check of the same work, not a second study.
- [Berkeley Lab publication list](https://amcr.lbl.gov/departments/computer-science-department/ppan/roofline-performance-model/ppan-roofline-publications/): inspected the 2008 and 2009 entries. It distinguishes the earlier report/presentation from the April 2009 journal publication; same research lineage, not independent corroboration.
- [TPU report, fixed April 2017 v1](https://arxiv.org/pdf/1704.04760v1): §4, Figures 5–7, and reference [Wil09] document the adaptation. David Patterson is an author of both works, so this is follow-on primary evidence, **not an independent replication**.

**Uncertainty / exclusions:** no claim of first-ever performance modeling or multicore invention. The report itself mentions earlier submission/revision dates; none is used as a product launch. No independent reproduction of the original performance measurements was established in this bounded review. The era grouping with AMD GCN does not imply GCN was caused by Roofline.

## 6. HDFS — `storage-hdfs-paper-2010`

Checked: **2026-10-12**. Placement: `connected-computing / field-memory`; topic `memory`, whose existing title includes storage.

**Claims retained**

1. The **MSST 2010** paper describes NameNode metadata, DataNode block storage, replication for failure tolerance, and storage/computation colocation.
2. This is a paper date, not HDFS's project start. The described file I/O model is single-writer/multiple-reader and supports append rather than arbitrary rewriting of existing bytes.
3. **Spark's RDD paper (NSDI 2012), §6.1**, reads initial input from HDFS in logistic-regression and k-means experiments, then benefits from in-memory reuse between iterations.

**Evidence and roles**

- [MSST original paper](https://msstconference.org/MSST-history/2010/Papers/MSST/Shvachko.pdf): original conference-hosted document, 2010 copyright, §§I–III. This distinguishes filesystem persistence/recovery from computation scheduling and database transaction semantics.
- [Shvachko publication list](https://shvachko.github.io/Publications.html): the author's separate bibliography identifies MSST and **May 2010**; it is a date cross-check, not independent adoption evidence.
- [RDDs, NSDI 2012](https://www.usenix.org/system/files/conference/nsdi12/nsdi12-final138.pdf): independently authored primary ML systems evidence; §6 and §6.1 identify storage, workloads, and first versus subsequent iterations. This is an observed use in the reported experiments, not evidence that all training uses HDFS.

**Uncertainty / exclusions:** no universal throughput claim; no equation of replicated files with GPU memory, model caches, or database transactions. The note does not date Flash/SSD, object storage, or checkpoint-system origins; those remain open coverage gaps.

## 7. Sojourner — `applications-sojourner-1997`

Checked: **2026-10-12**. Added following the explicit supplemental request. Placement: `learning / field-applications`; topic `applications`. The existing era ID is chronological; placement there does not label the rover as a learning system. The bilingual node is intentionally short, without a separate `detail` expansion.

**Claims retained**

1. Sojourner arrived with Pathfinder on **July 4, 1997**.
2. Its onboard navigation used commanded goals plus terrain and position sensing, integrating limited onboard computation with mobility and communications.
3. These sources describe navigation behaviors and ground support, **not reinforcement-learning training**. Autonomy is not synonymous with RL.

**Evidence and roles**

- [JPL Robotics subsystem account](https://www-robotics.jpl.nasa.gov/what-we-do/flight-projects/pathfinder/software-electronics/): engineering-team account describes simple navigation behaviors, sensors, processor constraints, and operator corrections.
- [NASA mission history](https://www.nasa.gov/history/25-years-of-continuous-robotic-mars-exploration-from-pathfinder-to-perseverance/): retrospective dated September 13, 2022; its Pathfinder section dates the landing to July 4, 1997. The article publication year is not the event year.
- [JPL archived rover description](https://planetarydata.jpl.nasa.gov/img/data/mpfr-m-rvreng-2_3-edr_rdr-v1.0/mprv_0001/document/insthost.htm): mission archive, “Instrument Host Overview” and “Control and Navigation Subsystem,” independently checks the textual landing date within the same institutional lineage and describes navigation/hazard-avoidance experiments.

**Uncertainty / exclusions:** all three sources are NASA/JPL accounts, not institutionally independent adoption evidence. Landing is not the same event as driving off the lander. No first-rover claim, self-learning claim, or lineage to modern robot foundation models is added.

## Compatibility and validation scope

- Preserve version 3, all pre-existing node/era/topic/branch IDs, the original node contents, and the four existing evidence-backed connections.
- Each new node has one canonical, chronologically ordered era branch, bilingual required fields, an existing topic, and HTTPS sources. Relevant coverage descriptions acknowledge additions without declaring their broader histories complete.
- `site/tests/test_technology_tree.py` has no fixed total-node expectation to update and was left byte-for-byte unchanged.
- Data validation passed with **73 nodes**. A baseline comparison confirmed that all **66 original node objects**, existing canonical placements, featured selections, layers, and four connections were preserved. Each new event appears exactly once in each language's rendered markup.
- **14 focused tests passed**, using Python 3.12.2 and the existing `TechnologyTreeTests`: evidence/schema, world-tree fields, era summaries, optional explanations/escaping, invalid taxonomy/connections, branch targets/determinism, sparse-domain counts, exhibit data, exhibit behavior, reading routes, server-rendered stable IDs, date/coverage/source rejection, atlas behavior, and branch-navigation behavior. The behavior tests invoke the existing Node.js harnesses. No full site build was run.
- The first focused run caught an ASCII possessive apostrophe in new coverage text conflicting with a test's literal HTML assertion. Rephrasing that sentence fixed the failure without changing renderer behavior or tests. The system Python 3.9 was not used; Python 3.13 lacked `markdown`, so the existing Python 3.12 environment supplied the test dependencies without installation.
- Only the JSON data and this ledger were edited. No renderer/JS/CSS/dashboard/global checklist changes, commits, or pushes. Structural tests do not establish historical truth or reproduce published experiments.

## Follow-up: histories before current language models

The earlier validation log above describes the 73-node infrastructure update. This follow-up adds four nodes for **77 total**, while separately replacing the decorative tree with a navigable canvas. New entries have their own bilingual mechanisms and limits; no causal edges were inferred.

| Entry | Evidence actually checked | Boundary retained |
|---|---|---|
| `hmm-rabiner-tutorial-1989` | [Rabiner's original tutorial](https://web.mit.edu/6.435/www/Rabiner89.pdf), issue header, introduction, definitions and three-problem discussion; [CMU's 1994 software archive](https://www.cs.cmu.edu/afs/cs/project/ai-repository/ai/areas/speech/systems/hmm/0.html) supplies a separately authored implementation record | The tutorial itself says the theory and speech applications predate 1989. The software archive is evidence of an implementation, not a replication of all reported recognition results. |
| `lenet5-1998` | [Original document-recognition paper](https://leon.bottou.org/publications/pdf/ieee-1998.pdf), LeNet-5 architecture diagram and convolution/subsampling description; [coauthor's bibliography](https://bottou.org/papers/lecun-98h) confirms publication metadata | The bibliography is not an independent study. The PDF text extraction is partly garbled; no accuracy or speed number was carried over. Do not call 1998 the invention of CNNs or describe LeNet-5 using a modern max-pooling/softmax recipe. |
| `google-search-prototype-1998` | [Brin and Page's paper](https://snap.stanford.edu/class/cs224w-readings/Brin98Anatomy.pdf), §§2.1–2.2 and §4 architecture; [Google Research record](https://research.google/pubs/the-anatomy-of-a-large-scale-hypertextual-web-search-engine/) for year and venue | The catalog describes the same work, not independent validation. The node explains the prototype and does not repeat its subjective search-quality comparison or claim to describe current production Google. |
| `word2vec-2013` | [January 2013 v1](https://arxiv.org/pdf/1301.3781v1), §§3.1–3.2; [arXiv version history](https://arxiv.org/abs/1301.3781) for the January / March / September revision boundary | CBOW and Skip-gram are explained from the initial version. No claim that embeddings originated here, no later negative-sampling result backdated to January, and no semantic-understanding claim inferred from analogy examples. |

These are original short explanations, not reproductions of the sources. The additions repair a few gaps in the reading route; they do not complete speech, search, CNN, or representation-learning history. Canonical placements, topic summaries and gap statements were updated together.
