/*
 * challenges.js — content data layer for the "System Design Lab" mode.
 *
 * Pure DATA (no functions). Read via loadChallenges() (window.CHALLENGE_DB).
 * A scraper (scraper/normalize.py) appends more challenges over time; a future
 * Supabase migration only changes loadChallenges() — this schema is stable.
 *
 * Model: a challenge is a PROBLEM STATEMENT + a suggested skeleton of STAGES.
 * The user edits the skeleton (add / remove / reorder) and, at each stage,
 * PICKS one option and JUSTIFIES it. Grading rewards defensible picks + the
 * quality of the trade-off reasoning (LLM-grilled).
 *
 * Schema (all JSON-serializable):
 *   id, topic (must match DOMAIN_OF for mastery), title, brief
 *   constraints : [str]        the constraints that make the choices non-trivial
 *   skeleton    : [stageId]    default ordered stages shown on load
 *   addable     : [stageId]    stages not in the skeleton the user may add
 *   stages      : { stageId: {
 *       name, prompt, required:bool,
 *       options: [{ id, label, verdict:"best"|"solid"|"weak", why }]
 *                   best  = ideal for these constraints
 *                   solid = defensible with good justification
 *                   weak  = poor fit / trap for these constraints
 *       mustMention: [str]     points a strong justification should cover
 *   }}
 *   grills : [{ q, a }]        overall follow-up interrogation (offline reference)
 */
window.CHALLENGE_DB = [
  {
    id: "rag-system",
    topic: "RAG",
    title: "Design a RAG system",
    brief: `Build retrieval-augmented generation over an enterprise knowledge base so employees get accurate, cited answers. Walk the stages of the system and, at each one, choose an approach and defend the trade-off.`,
    constraints: [
      "~10M documents across 500 tenants",
      "p95 retrieval < 300ms",
      "Answers must cite sources — no hallucinated facts",
      "Documents change often; freshness matters",
      "Strict per-tenant isolation (compliance)"
    ],
    skeleton: ["ingest", "chunk", "embed", "store", "retrieve", "rerank", "generate", "guardrail"],
    addable: ["cache", "observability"],
    stages: {
      ingest: {
        name: "Ingestion & freshness", prompt: "How do documents get in and stay current?", required: true,
        options: [
          { id: "stream", label: "Event-driven ingestion (queue + idempotent workers)", verdict: "best", why: `Near-real-time freshness with idempotent workers that scale with load. Here staleness is a correctness bug, so push-based beats polling.` },
          { id: "batch", label: "Nightly batch ETL", verdict: "solid", why: `Simple and cheap, but up to 24h stale — only acceptable if the corpus changes slowly, which it doesn't here.` },
          { id: "manual", label: "Manual re-upload / re-index", verdict: "weak", why: `Doesn't scale and guarantees stale answers; no change detection at all.` }
        ],
        mustMention: ["freshness / staleness window", "idempotency / exactly-once", "change detection — re-embed only what changed"]
      },
      chunk: {
        name: "Chunking", prompt: "How do you split documents for retrieval?", required: true,
        options: [
          { id: "structure", label: "Structure-aware (keep headings/tables intact)", verdict: "best", why: `Preserves meaning and keeps tables and atomic facts whole, so fewer broken or misleading retrievals.` },
          { id: "fixed", label: "Fixed-size with overlap", verdict: "solid", why: `Easy and predictable, but splits tables and sentences and needs overlap tuning to avoid boundary loss.` },
          { id: "whole", label: "Whole document as one chunk", verdict: "weak", why: `Blows the context window and destroys retrieval precision — you retrieve the whole doc for one fact.` }
        ],
        mustMention: ["retrieval granularity vs context size", "table / structure integrity", "overlap / boundary loss"]
      },
      embed: {
        name: "Embedding strategy", prompt: "How do you embed, and future-proof it?", required: true,
        options: [
          { id: "versioned", label: "Versioned embeddings, model swappable via backfill", verdict: "best", why: `An embedding_version on every chunk makes a model upgrade a backfill job, not a re-architecture. Reversible beats optimal on day 0.` },
          { id: "single", label: "Pick one strong model, no versioning", verdict: "solid", why: `Fine until you want to switch models — then it's a full re-index with a stale-serving window.` },
          { id: "lexical", label: "No embeddings — BM25/keyword only", verdict: "weak", why: `Misses semantic matches; only defensible as one signal in a hybrid, never alone for this.` }
        ],
        mustMention: ["embedding versioning / backfill path", "domain fit (general vs finance/code)", "re-embed cost when docs change"]
      },
      store: {
        name: "Vector store", prompt: "Where do the embeddings live?", required: true,
        options: [
          { id: "pgvector", label: "pgvector on Postgres + row-level security", verdict: "best", why: `DB-enforced tenant isolation (RLS), one fewer service to run, and fine to ~100M vectors. Multi-tenant compliance makes this the call.` },
          { id: "managed", label: "Managed vector DB (Pinecone / Weaviate)", verdict: "solid", why: `Fast ANN that scales, but tenant isolation is now your app's job and it's another service to secure and operate.` },
          { id: "faiss", label: "FAISS in-process", verdict: "weak", why: `No persistence, no multi-node, no isolation — a POC tool, not multi-tenant production.` }
        ],
        mustMention: ["per-tenant isolation", "scale ceiling / ANN index type", "ops & cost of another service"]
      },
      retrieve: {
        name: "Retrieval", prompt: "How do you fetch candidate chunks?", required: true,
        options: [
          { id: "hybrid", label: "Hybrid: BM25 + dense, fused with RRF", verdict: "best", why: `Catches exact terms, IDs and acronyms AND semantics; fusion beats either alone on enterprise jargon.` },
          { id: "dense", label: "Dense (vector) only", verdict: "solid", why: `Strong semantics, but misses exact IDs, acronyms and rare terms users actually search for.` },
          { id: "keyword", label: "Keyword / BM25 only", verdict: "weak", why: `No semantic matching — brittle to paraphrase and synonyms.` }
        ],
        mustMention: ["exact-match vs semantic recall", "fusion / RRF", "recall before you rerank"]
      },
      rerank: {
        name: "Reranking", prompt: "How do you order candidates before the model?", required: true,
        options: [
          { id: "cross", label: "Cross-encoder reranker, proven on a golden set", verdict: "best", why: `Big precision win. Prove it offline (recall@k, context precision) per doc type — never trust the vendor benchmark. Cut 40 candidates to ~6.` },
          { id: "none", label: "No rerank — trust the vector scores", verdict: "solid", why: `Lower latency and cost; fine if retrieval is already precise, risky for nuanced queries.` },
          { id: "llmrank", label: "LLM reranks every candidate", verdict: "weak", why: `Accurate but too slow and expensive at p95 < 300ms and this volume.` }
        ],
        mustMention: ["precision@k vs latency / cost", "proving it on a golden set", "how many candidates reach the context window"]
      },
      generate: {
        name: "Generation & grounding", prompt: "How does the model actually answer?", required: true,
        options: [
          { id: "grounded", label: "Grounded with citations; refuse if unsupported", verdict: "best", why: `Every claim ties to a retrieved chunk, and low confidence returns 'I don't know'. Meets the must-cite / no-hallucination constraint.` },
          { id: "plainrag", label: "Standard RAG prompt (context in, answer out)", verdict: "solid", why: `Works, but without enforced citation and refusal it can still fabricate confidently.` },
          { id: "nogr", label: "No grounding constraints", verdict: "weak", why: `Invites hallucinated facts — disqualifying for a system that must cite.` }
        ],
        mustMention: ["citation / provenance per claim", "refusal on low support", "prompt injection from retrieved docs is untrusted"]
      },
      guardrail: {
        name: "Quality / safety gate", prompt: "What checks the answer before the user sees it?", required: true,
        options: [
          { id: "evalgate", label: "Groundedness + citation eval, human review on low confidence", verdict: "best", why: `Catches unsupported claims and PII before delivery and escalates the uncertain ones to a person.` },
          { id: "basic", label: "Basic PII / profanity filter only", verdict: "solid", why: `Necessary but not sufficient — it won't catch a well-phrased fabrication.` },
          { id: "none", label: "No gate", verdict: "weak", why: `Ships fabrications and leaks straight to the user.` }
        ],
        mustMention: ["groundedness / faithfulness check", "PII / safety", "escalation path to a human"]
      },
      cache: {
        name: "Caching", prompt: "Do you cache, and how?", required: false,
        options: [
          { id: "semantic", label: "Semantic + exact response cache, invalidate on doc change", verdict: "best", why: `Cuts cost and p95 for repeat and near-repeat queries; the hard part is invalidating when a source doc changes.` },
          { id: "exact", label: "Exact-match cache only", verdict: "solid", why: `Simple, but misses paraphrased repeats which are most of the real traffic.` },
          { id: "nocache", label: "No cache (yet)", verdict: "solid", why: `Fine early; revisit once cost or latency actually bite.` }
        ],
        mustMention: ["invalidation when a source doc changes", "hit rate vs staleness risk"]
      },
      observability: {
        name: "Observability & feedback", prompt: "How do you know it's working?", required: false,
        options: [
          { id: "traces", label: "Per-query traces + thumbs + an offline eval set", verdict: "best", why: `You can debug why one answer was wrong and catch regressions before shipping a prompt change.` },
          { id: "logs", label: "Basic logs only", verdict: "weak", why: `Can't trace a single bad answer or detect a quality regression from a prompt tweak.` }
        ],
        mustMention: ["trace a single answer end to end", "regression eval before shipping changes"]
      }
    },
    grills: [
      { q: "p95 latency creeps to 900ms. Where do you look first?", a: `Rerank and candidate count first — cross-encoder cost scales with k — then ANN params (HNSW ef_search) and cache hit rate. Measure per-stage latency; don't guess.` },
      { q: "A tenant reports seeing another firm's document in results. What failed?", a: `Tenant isolation. The filter must be enforced server-side at the DB (RLS) or index partition, never caller-optional. Add a cross-tenant retrieval regression test.` },
      { q: "Answers occasionally cite the wrong source. Fix?", a: `Bind citations to chunk IDs and verify each generated claim maps to a retrieved chunk in a post-generation check; refuse or flag when it doesn't. It's a grounding+verification problem, not a prompt tweak.` }
    ]
  },
  {
    id: "eval-platform",
    topic: "Evals",
    title: "Design an LLM quality-gate platform",
    brief: `Every AI-generated report must pass a quality gate before a human acts on it. Design the gate so a fabricated figure or a missing disclosure can never pass as a false green, the judge itself can't silently drift, and the people downstream actually trust the output.`,
    constraints: [
      "~550 generated reports/week must be gated",
      "A fabricated figure or missing disclosure must never pass as a false green",
      "The judge itself must not silently drift over time",
      "Downstream users must trust and act on the result",
      "Human review capacity ~8–12 reports/day"
    ],
    skeleton: ["intake", "l0", "l1", "aggregate", "route", "humanqa", "calibration", "trust"],
    addable: [],
    stages: {
      intake: {
        name: "Intake", prompt: "What actually arrives at the gate?", required: true,
        options: [
          { id: "bundle", label: "Report + evidence bundle (provenance)", verdict: "best", why: `The gate can only verify a claim it can trace back to a source, so provenance must come with the report.` },
          { id: "reportonly", label: "Just the report text", verdict: "weak", why: `You can't verify figures without the evidence they were derived from.` }
        ],
        mustMention: ["provenance / traceable claims", "what the gate needs to verify"]
      },
      l0: {
        name: "Deterministic gates (L0)", prompt: "What does code check before any model runs?", required: true,
        options: [
          { id: "det", label: "Deterministic checks first (identity, arithmetic, sections, dates)", verdict: "best", why: `Never spend model judgment on what code can prove. Every check you move to L0 is a check that cannot drift.` },
          { id: "skip", label: "Skip straight to the LLM judge", verdict: "weak", why: `The judge will occasionally miss an arithmetic or identity error that a one-line assertion always catches.` }
        ],
        mustMention: ["deterministic-first", "drift resistance", "cheap and exact checks"]
      },
      l1: {
        name: "LLM judge (L1)", prompt: "How does the model judge what code can't?", required: true,
        options: [
          { id: "percriterion", label: "Per-criterion, strict JSON, evidence quotes, 'unknown' allowed", verdict: "best", why: `Structured, quotable, and able to abstain. The judge reads only the residual — grounding and adequacy — that L0 can't prove.` },
          { id: "holistic", label: "One holistic 'is this good?' score", verdict: "weak", why: `Unauditable and gameable; you can't tell which criterion failed or why.` }
        ],
        mustMention: ["per-criterion scoring", "mandatory evidence quotes", "abstain / unknown option"]
      },
      aggregate: {
        name: "Aggregation", prompt: "How do you combine the criterion scores?", required: true,
        options: [
          { id: "mingate", label: "Min-gate — each critical criterion ≥ threshold", verdict: "best", why: `An average lets style bury a fabricated income figure. Critical criteria each pass or the report doesn't ship.` },
          { id: "average", label: "Average into one overall score", verdict: "weak", why: `A high average hides the single catastrophic failure that matters most.` }
        ],
        mustMention: ["never average critical criteria", "threshold ≈ review capacity", "false-pass rate is the number that matters"]
      },
      route: {
        name: "Routing", prompt: "Where do reports go after scoring?", required: true,
        options: [
          { id: "passfail", label: "Auto-pass + audit sample; uncertain or failing → human", verdict: "best", why: `Unknown routes to a human, never default-pass; a 2–5% audit sample measures the real false-pass rate.` },
          { id: "autopassall", label: "Auto-pass unless clearly failing", verdict: "weak", why: `Default-passing the uncertain ones is exactly how a missed disclosure ships.` }
        ],
        mustMention: ["unknown → human, never default-pass", "audit sample", "flag volume bounded by capacity"]
      },
      humanqa: {
        name: "Human QA", prompt: "What do the humans in the loop do?", required: true,
        options: [
          { id: "calibrate", label: "Review flagged + audit set, and calibrate the judge", verdict: "best", why: `Humans are the ground truth that keeps the judge honest — a calibration source, not just a backstop.` },
          { id: "nohuman", label: "No humans — fully automated", verdict: "weak", why: `No ground truth to detect judge drift or catch novel failure modes.` }
        ],
        mustMention: ["human as calibration source", "capacity-bounded flag volume"]
      },
      calibration: {
        name: "Calibration & versioning", prompt: "How do you stop the judge drifting?", required: true,
        options: [
          { id: "pinned", label: "Pinned model+prompt; frozen calibration set + seeded defects re-run on every change", verdict: "best", why: `The judge is a versioned release artifact. Benchmarks are bound to template versions — never grade a 17-section report against a 20-section rubric.` },
          { id: "latest", label: "Always use the latest model", verdict: "weak", why: `Every model update silently moves your scores; you can't separate a quality change from a judge change.` }
        ],
        mustMention: ["pinned / versioned judge", "frozen calibration + seeded defects", "benchmarks bound to template version"]
      },
      trust: {
        name: "What the human sees", prompt: "What do you surface to the person who acts on it?", required: true,
        options: [
          { id: "evidence", label: "Trust evidence: pass/fail gates, citations, unresolved warnings", verdict: "best", why: `'95%' means nothing to a reviewer; show why it passed and exactly what to double-check.` },
          { id: "rawscore", label: "The raw judge score", verdict: "weak", why: `Uninterpretable and falsely precise — raw scores stay internal.` }
        ],
        mustMention: ["trust evidence, not scores", "surface unresolved warnings", "what still needs a human look"]
      }
    },
    grills: [
      { q: "Eval was 87 on 50 reports; someone tweaks a prompt and it's 91. Is quality better?", a: `Only if the SAME frozen 50 improved on the intended criteria with no regression in seeded-defect recall or false-pass rate. Per-criterion deltas + read the prompt diff + spot-check. A score without decomposition is a vibe.` },
      { q: "Each report section is a separate one-shot prompt with no shared state — how do you stop a figure leaking across sections?", a: `Prompt-contract per section: expected facts + allowed sources + INCLUDE/SUPPRESS rules. Diff generated sections against the resolution map and fail any fact appearing where its contract suppresses it. Deterministic, per prompt ID.` }
    ]
  },
  {
    id: "agent-system",
    topic: "Agents",
    title: "Design an AI agent system",
    brief: `Build an assistant that handles both one-line lookups and open-ended research over internal systems — fast and cheap on the easy path, fully auditable on the hard one, and never performing a silent write. Choose an approach at each stage and defend it.`,
    constraints: [
      "Mix of trivial lookups and multi-step research",
      "Every step must be auditable (regulated)",
      "No silent write actions to systems of record",
      "Cost-bounded — the easy 80% must stay cheap",
      "Answers must be accurate and cite evidence"
    ],
    skeleton: ["entry", "router", "orchestration", "data", "knowledge", "analysis", "action", "synthesis"],
    addable: [],
    stages: {
      entry: {
        name: "Entry point", prompt: "How does a query enter the system?", required: true,
        options: [
          { id: "sse", label: "Session with streaming (SSE)", verdict: "best", why: `Long research tasks need progressive output and a stable session to checkpoint against.` },
          { id: "reqresp", label: "Single request/response", verdict: "solid", why: `Fine for lookups, poor for multi-step work that takes several seconds to assemble.` }
        ],
        mustMention: ["streaming for long tasks", "session / state to resume against"]
      },
      router: {
        name: "Router / tiering", prompt: "How do you decide the path for a query?", required: true,
        options: [
          { id: "tiered", label: "One small classify call → tier (direct / one specialist / orchestrated)", verdict: "best", why: `Keeps the easy 80% on a ~$0.0002 path and only escalates cost when the query actually needs it.` },
          { id: "alwaysbig", label: "Send everything through the full agent stack", verdict: "weak", why: `Pays orchestration cost on trivial lookups and blows the budget.` }
        ],
        mustMention: ["cost tiering", "cheap path for easy queries", "escalation is one-way upward"]
      },
      orchestration: {
        name: "Orchestration", prompt: "What runs the multi-step plans?", required: true,
        options: [
          { id: "code", label: "Durable code orchestrator (checkpointed plan DAG)", verdict: "best", why: `Deterministic, replayable and auditable — a regulator can ask 'why did it do that?'. Reserve LLM planning for the open-ended ~5% tail.` },
          { id: "llm", label: "An LLM orchestrator plans and calls tools freely", verdict: "weak", why: `Flexible but non-deterministic and hard to audit or replay under a compliance regime.` }
        ],
        mustMention: ["determinism / auditability", "checkpoint & resume", "LLM planning only for the tail"]
      },
      data: {
        name: "Client-data access", prompt: "How do agents read the systems of record?", required: true,
        options: [
          { id: "readonly", label: "Read-only tool via scoped MCP", verdict: "best", why: `Least privilege — the data path physically can't mutate state.` },
          { id: "readwrite", label: "Read/write access for convenience", verdict: "weak", why: `One prompt injection or bug away from corrupting a system of record.` }
        ],
        mustMention: ["least privilege", "read-only by default", "scoped per-agent permissions"]
      },
      knowledge: {
        name: "Knowledge access", prompt: "How do agents get documents into reasoning?", required: true,
        options: [
          { id: "packets", label: "Retrieval returns evidence packets (claims + provenance)", verdict: "best", why: `Token-disciplined and citable; every claim carries provenance a downstream judge can verify.` },
          { id: "rawdocs", label: "Dump raw documents into the context", verdict: "weak", why: `Expensive and uncitable — you can't prove which source backed which claim.` }
        ],
        mustMention: ["evidence packets vs raw docs", "provenance / citability", "token budget"]
      },
      analysis: {
        name: "Analysis / reasoning", prompt: "How does the reasoning agent get its data?", required: true,
        options: [
          { id: "notools", label: "Analysis agent has NO direct tools (one governed fetch point)", verdict: "best", why: `Costs one latency hop, but buys a single logged, scope-checked fetch and no runaway retrieval loops.` },
          { id: "tools", label: "Give it tools to fetch what it needs", verdict: "solid", why: `Faster, but scatters retrieval across an agent you can't easily bound or audit.` }
        ],
        mustMention: ["single governed fetch point", "no runaway retrieval loops", "latency vs control"]
      },
      action: {
        name: "Write actions", prompt: "How are writes to systems of record handled?", required: true,
        options: [
          { id: "gated", label: "Appendix-only, propose → confirm → execute", verdict: "best", why: `No silent writes — a human confirms before the system of record changes.` },
          { id: "autonomous", label: "Agents write autonomously when confident", verdict: "weak", why: `Unauditable side effects — disqualifying under the no-silent-write constraint.` }
        ],
        mustMention: ["no silent writes", "human confirm step", "least-privilege write scope"]
      },
      synthesis: {
        name: "Synthesis", prompt: "How is the final answer assembled?", required: true,
        options: [
          { id: "cited", label: "Synthesis with citations; refuse unsupported claims", verdict: "best", why: `Per-step verification plus refusal stops errors compounding into a confident wrong answer.` },
          { id: "freeform", label: "Free-form summary of everything gathered", verdict: "weak", why: `No provenance and no refusal — hallucinations slip straight through.` }
        ],
        mustMention: ["per-step verification", "citations", "refuse, don't guess, on low confidence"]
      }
    },
    grills: [
      { q: "The CRM dies mid-query. What does the user actually see?", a: `Product answer first: "Live values unavailable — this answer is incomplete, based on retrieved reports only." Never present partial as complete. Checkpoint completed steps and resume from the failed one.` },
      { q: "How do you manage lots of agents?", a: `Don't have lots. A small capability-bounded set (~4), a durable orchestrator running typed checkpointed plans, and scoped tool permissions per agent. Hundreds of free-running agents are unauditable.` }
    ]
  },

  /* ==== Classic Builds — the 8 worked interview questions from
     donnemartin/system-design-primer (CC BY 4.0), converted to stage walks.
     Appended AFTER the AI challenges so d:index mastery keys stay stable. ==== */
  {
    id: "pastebin",
    topic: "Classic Builds",
    title: "Design Pastebin.com (or Bit.ly)",
    brief: `Users paste text and get a short, fast link that others can read. Design the shortlink scheme, storage, read path, expiry, and monthly analytics — and keep the read path fast at a 10:1 read-to-write ratio.`,
    constraints: [
      "10M users; 10M paste writes and 100M reads per month (10:1 read:write)",
      "Following a short link must be fast",
      "Pastes are text only, ~1 KB each (~12.7 GB new content/month, ~360M shortlinks in 3 years)",
      "Analytics (view counts) are monthly, not realtime",
      "Pastes can expire; traffic is not evenly distributed"
    ],
    skeleton: ["api", "shortlink", "store", "readpath", "expiry", "analytics"],
    addable: ["cache", "cdn"],
    stages: {
      api: {
        name: "API style", prompt: "How do clients talk to the service?", required: true,
        options: [
          { id: "rest", label: "Public REST API; RPC for internal service calls", verdict: "best", why: `REST fits a public resource API (create paste, GET shortlink) and stays cacheable and loosely coupled; hand-tuned RPC is for internal hops where you control both ends.` },
          { id: "restonly", label: "REST everywhere, including internal calls", verdict: "solid", why: `Perfectly workable and simpler to operate — you just forgo RPC's performance headroom on hot internal paths.` },
          { id: "rpcpub", label: "RPC-style public endpoints", verdict: "weak", why: `Tightly couples every client to your implementation, needs a new procedure per operation, and is awkward to cache — the primer reserves RPC for internal comms.` }
        ],
        mustMention: ["REST for public resources", "RPC only for internal hot paths", "cacheability of GETs"]
      },
      shortlink: {
        name: "Shortlink generation", prompt: "How do you mint a unique, URL-safe short code?", required: true,
        options: [
          { id: "md5b62", label: "MD5 of content+timestamp → Base62 → first 7 chars", verdict: "best", why: `MD5 is uniformly distributed; Base62 is URL-safe ([a-zA-Z0-9], nothing to escape); 62^7 ≈ 3.5 trillion codes dwarfs 360M links in 3 years. Deterministic, no coordination point.` },
          { id: "autoinc", label: "Auto-incrementing DB id, Base62-encoded", verdict: "solid", why: `Simple and collision-free, but guessable/enumerable (paste 12345 invites scraping) and serializes minting through one counter you now have to scale.` },
          { id: "b64", label: "Base64 of the hash", verdict: "weak", why: `Base64's + and / need URL escaping — the primer calls this out explicitly as the reason to prefer Base62.` }
        ],
        mustMention: ["URL-safe alphabet (Base62 vs Base64)", "collision handling / uniqueness check", "capacity math: 62^7 vs links needed"]
      },
      store: {
        name: "Storage layout", prompt: "Where do paste metadata and content live?", required: true,
        options: [
          { id: "sqlobj", label: "SQL row (shortlink PK, expiry, created_at, path) + content in an Object Store", verdict: "best", why: `Relational metadata gets indexes, constraints, and expiry queries; the 1 KB blobs go to an object store (S3-style) that scales storage independently and cheaply.` },
          { id: "allsql", label: "Everything in one SQL table, content included", verdict: "solid", why: `Fine at 12.7 GB/month for a while — but you're growing a table with blobs, which bloats the working set and slows the hot lookup path as it grows.` },
          { id: "localdisk", label: "Paste files on the web server's local disk", verdict: "weak", why: `Breaks horizontal scaling — servers must stay stateless and clonable; file-based storage makes cloning and auto-scaling difficult.` }
        ],
        mustMention: ["metadata vs content split", "index on shortlink", "stateless web tier"]
      },
      readpath: {
        name: "Read path", prompt: "A short link arrives — how does the paste come back fast?", required: true,
        options: [
          { id: "indexed", label: "Indexed shortlink lookup → object store fetch; expired check inline", verdict: "best", why: `One indexed SQL hit for metadata (returning an error if expired) plus one object-store read. At 40 reads/sec average this is comfortably fast and stays fast with an index.` },
          { id: "directobj", label: "Fetch straight from the object store keyed by shortlink", verdict: "solid", why: `Fewer hops, but you skip the metadata row — so expiry, ownership, and analytics hooks all have to be reinvented elsewhere.` },
          { id: "scan", label: "Query the pastes table by shortlink without an index", verdict: "weak", why: `A table scan per read; the primer's first tuning move is an index on the lookup column precisely because reads dominate 10:1.` }
        ],
        mustMention: ["index on the lookup key", "expiry checked at read time", "read:write ratio drives the design"]
      },
      expiry: {
        name: "Expiration", prompt: "How do expired pastes actually disappear?", required: true,
        options: [
          { id: "lazysweep", label: "Expiry timestamp checked on read + periodic cleanup job", verdict: "best", why: `Lazy checks make expired links dead immediately without a race; the background sweep reclaims storage. Nothing user-visible depends on the sweep being on time.` },
          { id: "crononly", label: "Hourly cron DELETE scan only", verdict: "solid", why: `Works, but a paste can be served for up to an hour after expiring, and big DELETE scans on a hot table need care (batching, off-peak).` },
          { id: "never", label: "No expiry", verdict: "weak", why: `Ignores a stated requirement — and unbounded retention means dead links, storage creep, and eventually privacy complaints.` }
        ],
        mustMention: ["lazy check on read vs background sweep", "what the user sees at expiry moment", "delete cost on a hot table"]
      },
      analytics: {
        name: "View analytics", prompt: "How do you produce monthly view counts?", required: true,
        options: [
          { id: "mapreduce", label: "MapReduce over web server logs, monthly", verdict: "best", why: `Analytics are explicitly not realtime, so batch over logs you already have: map (shortlink, 1), reduce to counts. Zero cost added to the hot read path.` },
          { id: "counter", label: "Increment a hits column on every read", verdict: "solid", why: `Simple, but it turns every read into a write on your busiest path — 100M extra writes/month to serve a monthly report.` },
          { id: "stream", label: "Realtime streaming analytics pipeline", verdict: "weak", why: `Kafka-and-friends to answer a question the requirements say is monthly — pure over-engineering for these constraints.` }
        ],
        mustMention: ["requirements say monthly, not realtime", "keep writes off the read path", "logs as the raw event source"]
      },
      cache: {
        name: "Hot-paste cache", prompt: "Do you cache popular pastes?", required: false,
        options: [
          { id: "memcache", label: "Memory cache for hot pastes (cache-aside)", verdict: "best", why: `Traffic is uneven — a viral paste dominates reads. A memory cache absorbs the spike so SQL and the object store see the long tail.` },
          { id: "nocache", label: "No cache yet; revisit when p95 or DB load bites", verdict: "solid", why: `At 40 avg reads/sec, defensible — as long as you're watching for the viral-paste spike that will eventually force it.` }
        ],
        mustMention: ["uneven traffic / viral paste", "cache-aside + TTL", "what invalidates on expiry"]
      },
      cdn: {
        name: "CDN", prompt: "Do public pastes go behind a CDN?", required: false,
        options: [
          { id: "pull", label: "Pull CDN for popular public pastes", verdict: "best", why: `Pull CDNs keep only recently-requested content at the edge — a natural fit for a read-heavy service with unpredictable hits.` },
          { id: "nocdn", label: "Skip the CDN until traffic demands it", verdict: "solid", why: `Reasonable at this scale; the memory cache covers the hot set. Revisit when geography or egress cost becomes the complaint.` }
        ],
        mustMention: ["pull vs push for unpredictable popularity", "TTL vs paste expiry interaction"]
      }
    },
    grills: [
      { q: "A paste goes viral and reads spike 100x. Walk the request path and name what saturates first.", a: `LB → web tier scales horizontally; the indexed SQL lookup and object store are next. The fix is the memory cache (cache-aside) absorbing the hot key, then SQL read replicas. The paste content itself is immutable — perfect cache food.` },
      { q: "Why Base62 over Base64, and why only the first 7 characters of the MD5?", a: `Base64's + and / require URL escaping; Base62 is clean [a-zA-Z0-9]. Seven chars gives 62^7 ≈ 3.5 trillion combinations against ~360M links in 3 years — huge headroom with short links. Collisions are possible, so keep a unique constraint and retry with new input on conflict.` },
      { q: "Two users paste identical content at the same second. Same shortlink?", a: `Hash input includes content plus timestamp (and ideally user/ip salt), so collisions are rare — but the DB unique constraint is the real guarantee: on conflict, regenerate. Never rely on the hash alone.` }
    ]
  },
  {
    id: "twitter-timeline",
    topic: "Classic Builds",
    title: "Design the Twitter timeline and search",
    brief: `Users post tweets that fan out to followers' home timelines, and search across all tweets. Posting and reading must both feel instant — including when the author has millions of followers.`,
    constraints: [
      "100M active users; 500M tweets/day (~6k writes/sec)",
      "Average fanout 10 → 60k timeline deliveries/sec",
      "250B reads/month (~100k reads/sec) — heavily read-dominated",
      "10B searches/month",
      "Celebrity accounts have millions of followers; fanout must not melt"
    ],
    skeleton: ["writepath", "timelinestore", "fanout", "celebrity", "readpath", "search", "media"],
    addable: [],
    stages: {
      writepath: {
        name: "Write path", prompt: "What happens the instant a tweet is posted?", required: true,
        options: [
          { id: "asyncfan", label: "Write API stores the tweet (SQL) then hands to an async Fan Out Service", verdict: "best", why: `The user's own timeline is durable immediately; the expensive O(n) delivery to followers happens off the request path via the fanout service and queues.` },
          { id: "pull", label: "Store once; build home timelines at read time (pull model)", verdict: "solid", why: `No fanout cost at write — but at 100k reads/sec you pay a multi-user merge on every timeline view, which is the far bigger number here.` },
          { id: "syncfan", label: "Deliver to every follower synchronously in the request", verdict: "weak", why: `Ties post latency to follower count; 60k deliveries/sec inside user requests overloads any relational write path.` }
        ],
        mustMention: ["ack fast, fan out async", "O(n) fanout cost", "write vs read volume comparison"]
      },
      timelinestore: {
        name: "Home timeline store", prompt: "Where do home timelines live?", required: true,
        options: [
          { id: "redislist", label: "Memory cache lists (e.g. Redis): tweet_id + user_id + meta per entry", verdict: "best", why: `Timeline reads are the hottest path; memory is ~4x faster than SSD and ~80x faster than disk. Keep a few hundred entries per user of just IDs — hydrate the rest on read.` },
          { id: "widecol", label: "NoSQL wide-column table, one row-range per user", verdict: "solid", why: `Durable and scales writes fine, but adds read latency vs RAM on the single hottest query in the system.` },
          { id: "sqljoin", label: "SQL join at read (follows ⨝ tweets, ordered)", verdict: "weak", why: `A multi-way join executed 100k times/sec — exactly what the fanout precomputation exists to avoid.` }
        ],
        mustMention: ["memory vs SSD vs disk latency", "store IDs, hydrate on read", "bounded timeline length per user"]
      },
      fanout: {
        name: "Fanout mechanics", prompt: "How does one tweet reach a million timelines?", required: true,
        options: [
          { id: "queue", label: "Queue + workers: look up followers (User Graph Service), insert into each timeline list", verdict: "best", why: `Workers absorb the 60k/sec delivery load, retry safely, and also feed the Search Index Service, Object Store (media), and Notification Service — one place orchestrates all post-tweet effects.` },
          { id: "batch", label: "Micro-batch fanout every 30–60s", verdict: "solid", why: `Cheaper and smoother under load, but followers see your tweet up to a minute late — a real product tradeoff to defend.` },
          { id: "inline", label: "Fan out inside the Write API process", verdict: "weak", why: `No isolation, no retry story, and a celebrity tweet stalls the API server for everyone.` }
        ],
        mustMention: ["queue-based async delivery", "retries / idempotent inserts", "fanout also feeds search index + notifications"]
      },
      celebrity: {
        name: "Celebrity problem", prompt: "A user has 20M followers. Still fanning out?", required: true,
        options: [
          { id: "hybrid", label: "Hybrid: precompute for normal users; merge celebrity tweets at read time", verdict: "best", why: `20M timeline inserts per tweet is the pathological case. Skip fanout for high-follower accounts and merge their recent tweets into followers' timelines on read — pay a small read cost to avoid a catastrophic write storm.` },
          { id: "throttled", label: "Fan out everyone, but rate-limit and spread celebrity fanout over minutes", verdict: "solid", why: `Keeps one code path, but celebrities' tweets arrive late and the queue still absorbs 20M inserts per tweet.` },
          { id: "fanall", label: "Fan out uniformly regardless of follower count", verdict: "weak", why: `One Messi tweet = tens of millions of writes in a burst. This is the known failure mode of naive fanout.` }
        ],
        mustMention: ["fanout-on-write vs fanout-on-read hybrid", "threshold for 'celebrity'", "read-time merge cost"]
      },
      readpath: {
        name: "Timeline read path", prompt: "How does a timeline view get assembled?", required: true,
        options: [
          { id: "hydrate", label: "Read the ID list from memory cache, hydrate via multiget (Tweet Info + User Info services)", verdict: "best", why: `IDs in RAM keep the timeline store small; batched multigets hydrate text/author efficiently and those services sit behind their own caches.` },
          { id: "denorm", label: "Store fully denormalized tweets in every follower's timeline", verdict: "solid", why: `One read, zero joins — but tweet edits/deletes must chase every copy, and memory cost multiplies by fanout.` },
          { id: "sqlread", label: "Read timelines from SQL every view", verdict: "weak", why: `Puts the 100k reads/sec back onto the database the memory tier exists to shield.` }
        ],
        mustMention: ["multiget batching", "IDs + hydration vs denormalized copies", "cache layers in front of info services"]
      },
      search: {
        name: "Search", prompt: "10B searches/month across everything ever tweeted. How?", required: true,
        options: [
          { id: "inverted", label: "Search API → Search Index Service: tokenize/normalize the query, scatter-gather over a sharded inverted index, rank and merge", verdict: "best", why: `The classic design: fanout writes tweets into the index near-realtime; queries parse (markup stripped, typos fixed, boolean ops), hit all shards in parallel, then merge ranked results.` },
          { id: "recent", label: "Index only the last N days; batch-index history", verdict: "solid", why: `Most searches want recency, so this bounds cost — but historical search degrades to a slower tier you must still build.` },
          { id: "like", label: "SQL LIKE '%term%' over tweets", verdict: "weak", why: `Unindexable full scans at 10B queries/month — not a search architecture.` }
        ],
        mustMention: ["inverted index, sharded", "scatter-gather + merge", "indexing lag from the fanout path"]
      },
      media: {
        name: "Media", prompt: "Photos and videos attach to tweets. Where do they go?", required: true,
        options: [
          { id: "objcdn", label: "Object Store + CDN", verdict: "best", why: `Media is immutable static content at ~10 KB average per tweet — object storage scales it, the CDN serves it from near the user.` },
          { id: "objonly", label: "Object Store, no CDN", verdict: "solid", why: `Correct storage, but every media view pays origin latency and egress from your object store.` },
          { id: "blob", label: "BLOBs in the tweets SQL table", verdict: "weak", why: `150 TB/month of new content in the relational database destroys the working set — the primer's schema advice is to store object locations, not objects.` }
        ],
        mustMention: ["object store for blobs", "CDN for delivery", "media size dominates tweet size"]
      }
    },
    grills: [
      { q: "A user with 20M followers tweets. Trace exactly what your system does.", a: `Write API persists the tweet, but the fanout service recognizes a high-follower account and skips per-follower inserts. Followers' timeline reads merge the celebrity's recent tweets (from a small hot cache of celebrity activity) with their precomputed list. The threshold and the merge cost are the design decisions to defend.` },
      { q: "Home timeline p99 jumps from 80ms to 800ms. Where do you look?", a: `In order: memory-cache hit rate (cold or evicted timelines force rebuilds), multiget fanout size to the info services, a hot shard in the timeline cluster, then queue lag making reads trigger fallback merges. Measure each hop — the timeline path has exactly four suspects.` },
      { q: "How stale is search allowed to be, and how do you bound it?", a: `The fanout path writes to the search index, so freshness = fanout lag. Track indexing lag as a first-class SLO (seconds, not minutes); if it grows, shard the index hotter or prioritize index writes over notification writes — search staleness is more visible than late push notifications.` }
    ]
  },
  {
    id: "web-crawler",
    topic: "Classic Builds",
    title: "Design a web crawler",
    brief: `Crawl a billion links on a weekly refresh cycle, without loops, without hammering anyone's servers, and store what you fetch so a search index can use it. Prioritize popular sites for freshness.`,
    constraints: [
      "1B links to crawl; ~weekly refresh → 4B crawls/month (~1,600 fetches/sec)",
      "~500 KB per page → ~2 PB stored per month",
      "Must not loop forever — the web graph has cycles",
      "Politeness: don't overload crawled domains",
      "Popular sites refresh more often than obscure ones"
    ],
    skeleton: ["frontier", "dedupe", "fetch", "parse", "store", "freshness"],
    addable: ["politeness"],
    stages: {
      frontier: {
        name: "URL frontier", prompt: "What decides which link gets crawled next?", required: true,
        options: [
          { id: "priority", label: "links_to_crawl as a priority queue (popularity-ranked), NoSQL/Redis-backed", verdict: "best", why: `A billion links won't sit in one SQL table happily; a sorted-set frontier ranked by popularity/staleness serves the 'popular sites refresh faster' requirement directly.` },
          { id: "fifo", label: "Simple FIFO queue of discovered links", verdict: "solid", why: `Easy and fair, but with no priority, a celebrity homepage and an abandoned blog get equal freshness — violating a stated constraint.` },
          { id: "dfs", label: "Recursive depth-first from seed URLs, in memory", verdict: "weak", why: `Unbounded depth into one site, dies on restart, and cycles trap it — everything a frontier exists to prevent.` }
        ],
        mustMention: ["priority by popularity / staleness", "durable frontier that survives restarts", "scale beyond one machine"]
      },
      dedupe: {
        name: "Duplicate & loop defense", prompt: "What stops infinite loops and duplicate work?", required: true,
        options: [
          { id: "sig", label: "crawled_links store with URL + page signature; check similarity before crawling", verdict: "best", why: `The primer's design: before fetching, check if a URL with a similar page signature was crawled recently. Catches both revisits and same-content-different-URL — the actual loop vectors.` },
          { id: "exact", label: "Exact seen-URL set only", verdict: "solid", why: `Blocks literal revisits, but ?session=123 variants and mirrored content sail through — you'll re-crawl the same page under a thousand URLs.` },
          { id: "depth", label: "Just cap crawl depth", verdict: "weak", why: `A depth cap bounds the damage but doesn't dedupe anything — you still burn your 1,600 fetches/sec on repeats.` }
        ],
        mustMention: ["URL normalization/variants", "page signature similarity", "recently-crawled time window"]
      },
      fetch: {
        name: "Fetch workers", prompt: "How is the actual crawling parallelized?", required: true,
        options: [
          { id: "workers", label: "Fleet of Crawler Service workers: pop highest-priority link, fetch, hand off; idempotent + resumable", verdict: "best", why: `1,600 pages/sec needs horizontal workers pulling from the shared frontier. Idempotency matters: a worker dying mid-page must not lose or double-crawl the URL.` },
          { id: "threads", label: "One beefy multi-threaded crawler box", verdict: "solid", why: `Simple to reason about, but a single box caps throughput and is one crash away from a stalled crawl.` },
          { id: "lambda", label: "Spawn a serverless function per URL", verdict: "weak", why: `4B invocations/month of 500 KB downloads — cost and connection churn make this the expensive way to do a worker pool.` }
        ],
        mustMention: ["horizontal workers off a shared frontier", "crash recovery / idempotent processing", "throughput math (~1,600/sec)"]
      },
      parse: {
        name: "Parse & extract", prompt: "A page arrives. What do you extract and where do new links go?", required: true,
        options: [
          { id: "pipeline", label: "Parse once: extract child links → frontier; strip markup; compute signature; queue for the reverse index + snippet services", verdict: "best", why: `One parse feeds everything downstream: new URLs into links_to_crawl, cleaned text to indexing, the signature to dedupe. Keep ranking/NLP out of the crawl loop.` },
          { id: "rawlater", label: "Store raw HTML now; parse in a separate batch job", verdict: "solid", why: `Decouples crawl speed from parse cost, but discovered links wait for the batch — your frontier starves and freshness lags.` },
          { id: "inline-nlp", label: "Full analysis (ranking, classification) inline per page", verdict: "weak", why: `Heavy per-page compute inside the fetch loop throttles crawl throughput — the crawl and the analysis have different scaling curves.` }
        ],
        mustMention: ["child links feed the frontier", "signature computed at parse time", "keep heavy analysis out of the crawl loop"]
      },
      store: {
        name: "Page storage", prompt: "Where do 2 PB/month of pages go?", required: true,
        options: [
          { id: "docstore", label: "Object/Document Store for page content; NoSQL for crawled_links signatures", verdict: "best", why: `Petabyte blobs belong in object storage; the signature/timestamp lookups need a fast key-value check on every crawl decision.` },
          { id: "textonly", label: "Keep extracted text only, discard raw HTML", verdict: "solid", why: `~10x cheaper, but you can never re-parse with better extraction — a real tradeoff to state, not hide.` },
          { id: "sql", label: "Pages as rows in a relational database", verdict: "weak", why: `2 PB/month of blobs in an RDBMS — backups, replication, and the buffer pool all die. Store locations, not objects.` }
        ],
        mustMention: ["object store for content", "fast KV for crawl-decision lookups", "raw vs extracted retention tradeoff"]
      },
      freshness: {
        name: "Freshness / re-crawl", prompt: "How do pages get re-crawled at the right rate?", required: true,
        options: [
          { id: "adaptive", label: "Timestamp every crawl; re-enqueue with priority weighted by popularity and observed change rate", verdict: "best", why: `Pages that change often and matter get crawled more; static pages decay to rare visits. The weekly average emerges instead of being forced uniformly.` },
          { id: "uniform", label: "Re-crawl everything weekly, uniformly", verdict: "solid", why: `Meets the average but wastes fetches on dead pages while popular news pages sit stale for a week.` },
          { id: "once", label: "Crawl once, refresh manually", verdict: "weak", why: `The requirement is regular freshness; a one-shot crawl is a snapshot, not a crawler.` }
        ],
        mustMention: ["change-rate signal", "popularity-weighted schedules", "timestamps on pages and links"]
      },
      politeness: {
        name: "Politeness", prompt: "How do you avoid becoming a DDoS?", required: false,
        options: [
          { id: "polite", label: "Respect robots.txt; per-domain rate limits + crawl-delay; identifying user-agent", verdict: "best", why: `Politeness is a correctness requirement: per-domain token buckets stop you flooding one host even when its URLs dominate the frontier, and robots.txt keeps you out of forbidden paths.` },
          { id: "global", label: "One global rate limit across all domains", verdict: "weak", why: `Global throughput says nothing about per-victim load — 1,600/sec aimed at one small site is still a flood.` }
        ],
        mustMention: ["robots.txt", "per-domain rate limiting", "identifiable user-agent + backoff"]
      }
    },
    grills: [
      { q: "Your crawler is stuck generating infinite URLs on one site (a calendar widget). What failed and what do you add?", a: `That's a crawler trap: infinite unique URLs with near-identical content. The page-signature similarity check should be catching it; add per-domain page budgets and URL-pattern heuristics (repeating path segments, exploding query params) so one site can't monopolize the frontier.` },
      { q: "The same article appears at 40 URLs (mirrors, tracking params). How much do you store?", a: `Once. Normalize URLs (strip tracking params, canonical host), then the content signature check marks the rest as duplicates pointing at the canonical copy. Store the URL→canonical mapping — search still needs to know all 40 exist.` },
      { q: "How do you coordinate so two workers don't crawl the same URL simultaneously?", a: `The frontier pop must be atomic (e.g. Redis ZPOPMAX or a lease/visibility-timeout pattern like SQS). A crawled-at lease with timeout handles worker death: if the lease expires without completion, the URL returns to the frontier. Idempotent downstream writes make the rare double-crawl harmless.` }
    ]
  },
  {
    id: "mint",
    topic: "Classic Builds",
    title: "Design Mint.com",
    brief: `A personal-finance service: connect bank accounts, pull transactions daily, categorize them, track budgets, and notify users when they approach overspend. Write-heavy and privacy-sensitive.`,
    constraints: [
      "10M users, 30M financial accounts, 50k known sellers",
      "5B transactions/month (~2,000 writes/sec) vs 500M reads/month — 10:1 WRITE-heavy",
      "Daily automatic refresh, but only for users active in the past 30 days",
      "Manual category overrides; no automatic re-categorization",
      "Budget notifications need not be instant"
    ],
    skeleton: ["sync", "extraction", "categorize", "budget", "notify", "store"],
    addable: ["cache"],
    stages: {
      sync: {
        name: "Account sync trigger", prompt: "When and for whom do you pull bank data?", required: true,
        options: [
          { id: "active30", label: "Daily scheduled pull, only for users active in the last 30 days, via a queue", verdict: "best", why: `The constraint says exactly this: dormant users don't burn 30M account pulls a day. Enqueue per-account jobs so failures retry independently.` },
          { id: "all", label: "Pull all 30M accounts nightly", verdict: "solid", why: `Simple and uniform, but most of that work is for users who won't look — cost without product value.` },
          { id: "onlogin", label: "Sync only when the user logs in", verdict: "weak", why: `Budget notifications are the product; on-login sync means a user only learns they blew the budget after they've blown it and logged in.` }
        ],
        mustMention: ["active-user filter", "per-account queue jobs", "notifications need data before login"]
      },
      extraction: {
        name: "Transaction extraction", prompt: "How do transactions actually get pulled and recorded?", required: true,
        options: [
          { id: "workers", label: "Queue + Transaction Extraction Service workers; idempotent writes, checkpoint per account", verdict: "best", why: `2,000 writes/sec of financial data demands retry-safety: a re-run must never double-import a transaction (idempotency key on account+txn id), and a checkpoint resumes a half-finished account.` },
          { id: "monolith", label: "One nightly batch job over all accounts", verdict: "solid", why: `Works until it doesn't: one bad account aborts the run, and retries are all-or-nothing at 30M-account scale.` },
          { id: "inline", label: "Extract synchronously during a web request", verdict: "weak", why: `Bank scraping takes seconds-to-minutes and fails often — exactly what must never sit inside a user-facing request.` }
        ],
        mustMention: ["idempotent import (no double transactions)", "checkpoint/resume per account", "isolation of failures"]
      },
      categorize: {
        name: "Categorization", prompt: "How does 'STARBUCKS #4321' become 'Food'?", required: true,
        options: [
          { id: "sellermap", label: "Seller→category map (50k sellers) + per-user override table; overrides never auto-revert", verdict: "best", why: `The constraints hand you this: sellers determine category, users can override, and the system must not re-categorize behind their back. A lookup table plus an override layer is fast, explainable, and respects user intent.` },
          { id: "ml", label: "ML classifier on transaction descriptions", verdict: "solid", why: `Handles unknown sellers, but adds drift and explainability problems to something a 50k-row table mostly solves — and you still need the override layer.` },
          { id: "userall", label: "Users categorize everything manually", verdict: "weak", why: `5B transactions/month of homework for users — categorization is the product's core automation.` }
        ],
        mustMention: ["seller map as base truth", "user override precedence", "no automatic re-categorization"]
      },
      budget: {
        name: "Budget engine", prompt: "How is 'you've spent $180 of $200 on Food' computed?", required: true,
        options: [
          { id: "aggregate", label: "Precomputed monthly_spending aggregates by (user, category), updated as transactions land", verdict: "best", why: `Reads hit a tiny aggregate table, and threshold checks for notifications ride the same update path. Recommended budgets seed from income-percentile category allocations, then user overrides stick.` },
          { id: "batch", label: "Recompute all budgets in a nightly MapReduce", verdict: "solid", why: `Clean and replayable, but intraday spending doesn't move the needle until tomorrow — notifications lag a day.` },
          { id: "onread", label: "Sum raw transactions per category on page load", verdict: "weak", why: `Scanning slices of 5B monthly transactions per view — aggregation exists precisely to avoid this.` }
        ],
        mustMention: ["aggregate table keyed (user, category, month)", "update-on-write vs batch freshness", "default budget from income percentile, then overrides"]
      },
      notify: {
        name: "Notifications", prompt: "How does the overspend warning reach the user?", required: true,
        options: [
          { id: "threshold", label: "Threshold check when aggregates update → Notification Service via queue, batched", verdict: "best", why: `'Not instant' is in the constraints, so piggyback on the aggregate update: crossing 80%/100% enqueues a notification, and batching respects rate limits and quiet hours.` },
          { id: "poll", label: "Poll every user's budgets every minute", verdict: "weak", why: `10M users × categories, re-checked forever, to detect events the write path already sees — polling at scale is the tell of a missing event.` },
          { id: "onvisit", label: "Show warnings only when the user visits", verdict: "solid", why: `Cheap and simple, but the proactive warning is the differentiating feature; you've quietly cut it.` }
        ],
        mustMention: ["event-driven from the aggregate update", "batching / rate limits", "'not instant' ≠ 'only on visit'"]
      },
      store: {
        name: "Storage layout", prompt: "Where does all of this live?", required: true,
        options: [
          { id: "hybrid", label: "SQL for users/accounts/budgets/overrides; raw transaction log to Object Store; MapReduce for heavy analytics", verdict: "best", why: `Relational integrity where money-adjacent correctness matters; the firehose of raw transactions lands cheaply in object storage as the replayable source of truth for analytics.` },
          { id: "allsql", label: "Everything in one relational database", verdict: "solid", why: `Fine to start, but 5B writes/month strains a single master — you'll be partitioning or offloading the raw stream soon, so plan the seams now.` },
          { id: "allnosql", label: "Everything in a NoSQL document store", verdict: "weak", why: `Budgets, overrides, and account links are relational and transactional; giving up constraints on financial data to speed up a write path you can buffer is the wrong trade.` }
        ],
        mustMention: ["write-heavy → buffer/offload raw stream", "relational integrity for money data", "replayable raw log for analytics"]
      },
      cache: {
        name: "Read cache", prompt: "Do reads need a cache at all?", required: false,
        options: [
          { id: "session", label: "Memory cache for hot user objects and current-month aggregates", verdict: "best", why: `Reads are the small side (200/sec average) but bursty around paydays and mornings; caching the current month's aggregates makes the dashboard instant.` },
          { id: "none", label: "No cache — reads are only ~200/sec", verdict: "solid", why: `Genuinely defensible at this ratio; add the cache when dashboard p95 says so, not before.` }
        ],
        mustMention: ["read volume is the small side here", "cache the aggregate, not raw transactions"]
      }
    },
    grills: [
      { q: "5B transactions/month is write-heavy. Where does the write path bottleneck first, and what's your fix sequence?", a: `The SQL master ingesting transaction rows. Sequence: buffer through the queue (absorb spikes), move raw transactions to append-only object storage with only aggregates in SQL, then partition/shard the transactional tables by user if still needed. Don't shard first — it's the most expensive move.` },
      { q: "A bank feed is down for 36 hours. What does the user see and what does the system do?", a: `User sees 'as of <timestamp>' on affected accounts — stale, labeled, never silently wrong. System: the per-account job retries with backoff, resumes from its checkpoint, and idempotent import guarantees the catch-up doesn't double-count. Budgets recompute automatically as data lands.` },
      { q: "A user recategorizes Starbucks from Food to Coffee. What happens to past and future transactions?", a: `Per the constraints: the override applies to that seller for that user going forward, and past transactions update only if the user asks — never automatic re-categorization. The override lives in its own table with precedence over the seller map, and the audit trail records who changed what.` }
    ]
  },
  {
    id: "social-graph",
    topic: "Classic Builds",
    title: "Design the data structures for a social network",
    brief: `100M users, 5B friendships: show the shortest friend-path between any two people. The graph won't fit on one machine — and you may not reach for a graph database.`,
    constraints: [
      "100M users × 50 friends average = 5B unweighted edges",
      "Graph data cannot fit on a single machine",
      "1B friend-path searches/month (~400/sec)",
      "Shortest path = fewest hops (unweighted BFS)",
      "Exercise traditional systems — no Neo4j/GraphQL shortcuts"
    ],
    skeleton: ["model", "partition", "lookup", "traversal", "api"],
    addable: ["cache", "bounds"],
    stages: {
      model: {
        name: "Graph representation", prompt: "How is the friendship graph stored?", required: true,
        options: [
          { id: "adjlist", label: "Adjacency lists: person_id → [friend_ids] on Person Servers", verdict: "best", why: `50-friend averages make adjacency lists compact and BFS-native: one lookup returns exactly the neighbors to expand next.` },
          { id: "sqledge", label: "Normalized SQL friendships(user_a, user_b) with indexes", verdict: "solid", why: `Correct and transactional, but each BFS hop becomes an indexed query, and once you shard, hops cross servers through SQL — heavier than a purpose-held list.` },
          { id: "matrix", label: "Adjacency matrix", verdict: "weak", why: `100M × 100M bits for a graph that's 0.00005% dense — the textbook wrong structure for sparse graphs.` }
        ],
        mustMention: ["sparse graph → adjacency lists", "neighbor expansion is THE query", "edge writes touch two lists (bidirectional)"]
      },
      partition: {
        name: "Partitioning", prompt: "5B edges won't fit on one box. How do you split them?", required: true,
        options: [
          { id: "hashshard", label: "Shard people across Person Servers by consistent hash of person_id", verdict: "best", why: `Even distribution, cheap rebalancing when servers join/leave, and every person's friend list lives in exactly one known place.` },
          { id: "geo", label: "Shard by geography/community", verdict: "solid", why: `Friend locality means fewer cross-shard hops — but regions are lopsided, people move, and celebrity nodes still break the locality assumption.` },
          { id: "replicate", label: "Full copy of the graph on every server", verdict: "weak", why: `The constraint says it doesn't fit on one machine — replication multiplies what already doesn't fit.` }
        ],
        mustMention: ["consistent hashing", "rebalancing cost", "cross-shard hops are the tax"]
      },
      lookup: {
        name: "Routing", prompt: "Given person_id 42, which server holds them?", required: true,
        options: [
          { id: "lookupsvc", label: "Lookup Service maps person_id → server (hash-based), results cached", verdict: "best", why: `The primer's structure: User Graph Service asks the Lookup Service, then fetches the person from the right Person Server. Hash-based mapping keeps the lookup stateless and cacheable.` },
          { id: "central", label: "A central SQL mapping table", verdict: "solid", why: `Works, but it's a hop and a hot spot on every single neighbor expansion — hash functions don't need a database.` },
          { id: "broadcast", label: "Broadcast every lookup to all shards", verdict: "weak", why: `Every BFS hop × every shard = a scatter storm; the whole point of partitioning is knowing where things are.` }
        ],
        mustMention: ["deterministic id→server mapping", "no per-hop hot spot", "cache the mapping client-side"]
      },
      traversal: {
        name: "Shortest path", prompt: "How do you actually find the path?", required: true,
        options: [
          { id: "bfs", label: "BFS with a visited set; batch neighbor fetches per server per level", verdict: "best", why: `Unweighted shortest path = BFS, full stop. The distributed trick is batching: group each frontier level's lookups by owning server into multigets instead of one RPC per person.` },
          { id: "bidir", label: "Bidirectional BFS from both ends", verdict: "solid", why: `Explores ~√ the nodes — a real win at scale — at the cost of trickier frontier-meeting logic. Great answer if you can defend the complexity.` },
          { id: "dfs", label: "DFS with backtracking", verdict: "weak", why: `DFS doesn't find shortest paths in unweighted graphs and happily dives 80 hops deep into 100M people.` }
        ],
        mustMention: ["BFS gives shortest unweighted path", "visited set across servers", "batch/multiget per frontier level"]
      },
      api: {
        name: "API surface", prompt: "How do clients and internal services communicate?", required: true,
        options: [
          { id: "restrpc", label: "Public REST (GET /friend_search) + internal RPC between graph services", verdict: "best", why: `Public surface stays uniform and cacheable; the chatty hop-by-hop internal traffic uses RPC where you control both ends and latency matters.` },
          { id: "restall", label: "REST everywhere including service-to-service", verdict: "solid", why: `Operationally simpler; you pay HTTP overhead on the highest-frequency internal calls in the system.` },
          { id: "direct", label: "Clients query Person Servers directly", verdict: "weak", why: `Exposes shard topology to clients — every rebalance is now a breaking API change.` }
        ],
        mustMention: ["public REST, internal RPC", "hide shard topology", "the traversal service owns the algorithm"]
      },
      cache: {
        name: "Caching", prompt: "What's worth keeping in memory?", required: false,
        options: [
          { id: "personcache", label: "Memory cache for person objects + friend lists; cache full BFS results for hot pairs", verdict: "best", why: `Celebrity nodes and repeat searches dominate; caching friend lists slashes Person Server load, and popular path queries repeat enough to cache whole results briefly.` },
          { id: "nocache", label: "No cache", verdict: "weak", why: `400 searches/sec × dozens of lookups per BFS = tens of thousands of fetches/sec hitting Person Servers raw — the cache is load-bearing here, not optional.` }
        ],
        mustMention: ["friend lists are the hot read", "invalidate on edge change", "hot-pair result caching"]
      },
      bounds: {
        name: "Search bounds", prompt: "What stops one query from eating the cluster?", required: false,
        options: [
          { id: "budget", label: "Depth cap + time budget; return partial/'no close path' beyond it", verdict: "best", why: `Six degrees means depth >6 is almost never useful, but the frontier at depth 5 can be millions of nodes. A hop cap and wall-clock budget bound the blast radius; the product answer for distant pairs is honesty.` },
          { id: "unbounded", label: "Search exhaustively every time", verdict: "weak", why: `Two unconnected users = traversing the entire 5B-edge graph before saying 'no path'. One query, whole cluster.` }
        ],
        mustMention: ["frontier explosion at depth 4–5", "time + hop budgets", "what the user sees on give-up"]
      }
    },
    grills: [
      { q: "Both endpoints are celebrities with 5M friends each. BFS explodes at hop two. Now what?", a: `Bidirectional BFS (meet in the middle cuts the frontier exponentially), expand the lower-degree side first, lean on cached friend lists for the hub nodes, and enforce the time budget. If this query class is common, precompute distances to a small set of landmark nodes and answer approximately.` },
      { q: "An unfriend happens mid-search. Is your answer wrong, and does it matter?", a: `Possibly — the path may include the just-removed edge. That's acceptable staleness for a social feature: state it, bound it (edge changes invalidate the friend-list cache), and don't buy distributed-snapshot consistency for a result whose value is social, not financial.` },
      { q: "How do you keep both adjacency lists consistent when A friends B across two shards?", a: `Write both lists via an idempotent two-step (queue the second write with retry), tolerate brief asymmetry, and run a reconciliation sweep for orphaned half-edges. A distributed transaction per friend-click is the over-engineered answer; eventual symmetric convergence is the right one.` }
    ]
  },
  {
    id: "query-cache",
    topic: "Classic Builds",
    title: "Design a key-value cache for search results",
    brief: `Put a memory cache in front of a search engine's reverse-index and document services so popular queries return instantly — with limited memory, smart expiry, and no cold-start collapse.`,
    constraints: [
      "10B queries/month (~4,000/sec); popular queries must almost always hit",
      "Limited memory: ~270 bytes per cached entry, but 2.7 TB/month if everything unique were kept — you can't keep it all",
      "Cache must expire/refresh stale entries as the index updates",
      "Low latency between machines assumed",
      "Serving from cache must be O(1)-fast"
    ],
    skeleton: ["datastructure", "placement", "partition", "invalidation"],
    addable: ["warmup", "hotkeys"],
    stages: {
      datastructure: {
        name: "Cache structure", prompt: "What data structure is the cache itself?", required: true,
        options: [
          { id: "lru", label: "Hash map + doubly linked list = O(1) LRU", verdict: "best", why: `The canonical answer: hash table for O(1) lookup into list nodes; hits move to the head, evictions pop the tail. Recency-based eviction is exactly right when popular queries must stay resident.` },
          { id: "ttlmap", label: "Hash map with TTLs only", verdict: "solid", why: `O(1) and simple, but eviction under memory pressure is arbitrary rather than recency-aware — a popular query can vanish while a one-off lingers until TTL.` },
          { id: "sorted", label: "List sorted by access timestamp", verdict: "weak", why: `O(n) reordering on every hit at 4,000/sec — the linked list exists to make recency updates O(1).` }
        ],
        mustMention: ["O(1) get and put", "recency eviction (LRU) vs TTL-only", "normalize the query to make good keys"]
      },
      placement: {
        name: "Cache placement", prompt: "Where does this cache physically sit?", required: true,
        options: [
          { id: "cluster", label: "Dedicated Memory Cache cluster between the Query API and the index/document services", verdict: "best", why: `A shared tier gives one coherent hit rate: every web server benefits from every other server's misses. Per-box caches at this query volume mean N cold copies of the same hot entries.` },
          { id: "perbox", label: "Local in-process cache on each web/API server", verdict: "solid", why: `Zero network hop, but the hit rate fragments across the fleet and hot entries duplicate per box — the primer's scale section walks exactly this tradeoff.` },
          { id: "indb", label: "Rely on the database/index engine's internal cache", verdict: "weak", why: `You can't control its eviction, can't size it for query results, and the request still pays the full trip to the backend service.` }
        ],
        mustMention: ["shared tier vs per-box hit-rate fragmentation", "extra network hop tradeoff", "cache shields the reverse-index AND document services"]
      },
      partition: {
        name: "Partitioning", prompt: "One box can't hold it. How does the cluster split the keyspace?", required: true,
        options: [
          { id: "consistent", label: "Consistent hashing of the normalized query key across nodes", verdict: "best", why: `Node joins/leaves move only a sliver of keys instead of reshuffling everything — critical when a reshuffle means a cluster-wide cold start.` },
          { id: "modn", label: "hash(key) mod N", verdict: "solid", why: `Fine until N changes: add one node and nearly every key remaps — a self-inflicted total cache flush.` },
          { id: "random", label: "Write to any node, read by broadcast", verdict: "weak", why: `If reads can't compute where a key lives, every lookup is a scatter — you've built a slower broadcast, not a cache.` }
        ],
        mustMention: ["consistent hashing limits remap blast radius", "what happens on node add/remove", "replicas for hot shards"]
      },
      invalidation: {
        name: "Expiry & invalidation", prompt: "The index updates and cached results go stale. What now?", required: true,
        options: [
          { id: "versioned", label: "TTL + invalidate/version keys when the underlying index segment updates", verdict: "best", why: `TTL bounds worst-case staleness; index-update hooks (or an index-version component in the key) kill known-stale entries immediately instead of waiting the TTL out.` },
          { id: "ttl", label: "TTL only", verdict: "solid", why: `Simple and often enough — the tradeoff is a full TTL window of stale results after every index refresh, which you must consciously accept.` },
          { id: "evictonly", label: "No expiry — entries die only by LRU eviction", verdict: "weak", why: `A popular query is exactly the one that never gets evicted — so your most-seen result is your stalest. Backwards.` }
        ],
        mustMention: ["staleness bound (TTL) vs event invalidation", "popular entries never evict naturally", "key versioning as invalidation"]
      },
      warmup: {
        name: "Warm-up", prompt: "A node is replaced and starts empty. Do you care?", required: false,
        options: [
          { id: "logwarm", label: "Pre-warm replacements from recent query logs before taking traffic", verdict: "best", why: `A cold node is a hole in the hit rate exactly where consistent hashing sends real traffic; replaying the last hour's hot queries fills it before users notice.` },
          { id: "coldok", label: "Let it warm organically", verdict: "solid", why: `Acceptable if a single node is a small keyspace slice — quantify the p99 dip and backend spike before deciding it's fine.` }
        ],
        mustMention: ["cold node = hit-rate hole + backend spike", "query logs as the warm-up source"]
      },
      hotkeys: {
        name: "Hot keys", prompt: "One viral query hits a single cache node at 1,000/sec. Then what?", required: false,
        options: [
          { id: "replicate", label: "Replicate hot keys to multiple nodes + tiny L1 cache on API servers; coalesce misses", verdict: "best", why: `Consistent hashing sends one key to one node by design — hot keys need explicit replication or a front-line micro-cache, and request coalescing stops a miss stampede from hammering the backend.` },
          { id: "ignore", label: "Accept the hot node", verdict: "weak", why: `One key saturating one node degrades every other key that hashes there — the incident writes itself.` }
        ],
        mustMention: ["single-node hot key by design", "L1 micro-cache / replication", "miss stampede coalescing"]
      }
    },
    grills: [
      { q: "Personalized search results arrive next quarter. Does your cache survive?", a: `Only deliberately. Either the key gains personalization dimensions (user cohort, locale) — fragmenting the hit rate and memory math — or personalized queries bypass the shared cache and only the anonymous layer stays cached. Quantify the hit-rate hit before agreeing to the feature.` },
      { q: "Cache hit rate drops from 85% to 60% after a deploy. Diagnose.", a: `Suspects in order: key normalization changed (same query, new key), cluster membership changed and remapped the keyspace (check consistent-hash ring), entry size grew so LRU evicts more, or TTLs shortened. The hit-rate dashboard should break down by miss type: cold, evicted, invalidated.` },
      { q: "How would you size this cluster from first principles?", a: `Working set, not total volume: queries follow a power law, so find the top-K queries covering ~80–90% of traffic from logs, multiply by entry size (~270 bytes), add headroom for skew and replication. Then validate with observed hit rate — sizing is empirical after day one.` }
    ]
  },
  {
    id: "sales-rank",
    topic: "Classic Builds",
    title: "Design Amazon's sales rank by category",
    brief: `Compute each product's sales rank per category, updated hourly, while serving 40,000 reads/sec of rankings. Raw purchases stream in at 400/sec; items live in multiple categories.`,
    constraints: [
      "10M products, 1,000 categories; items can be in multiple categories",
      "1B transactions/month (~400 writes/sec)",
      "100B read requests/month (~40,000 reads/sec) — 100:1 read:write",
      "Ranks refresh hourly; hot categories may need faster",
      "Raw transaction data must remain reprocessable"
    ],
    skeleton: ["capture", "aggregate", "store", "api", "freshness"],
    addable: ["warehouse"],
    stages: {
      capture: {
        name: "Event capture", prompt: "Where does the raw sales data land first?", required: true,
        options: [
          { id: "logs", label: "Sales API writes tab-delimited log files to a managed Object Store (S3)", verdict: "best", why: `The primer's call: don't run your own distributed filesystem; append-only logs in object storage are cheap, durable, and the replayable input MapReduce wants.` },
          { id: "sqlrow", label: "Insert each transaction into an analytics SQL table", verdict: "solid", why: `Queryable immediately, but now the analytics store must absorb 400 inserts/sec forever, and reprocessing means expensive table scans instead of parallel file reads.` },
          { id: "counters", label: "Increment in-memory per-product counters", verdict: "weak", why: `A restart erases sales history, and there's no raw record to recompute from when the ranking logic changes.` }
        ],
        mustMention: ["append-only raw log as source of truth", "replayability for logic changes", "object store over self-managed DFS"]
      },
      aggregate: {
        name: "Aggregation", prompt: "How do raw purchase lines become ranks?", required: true,
        options: [
          { id: "mapreduce", label: "Multi-step MapReduce: map to ((category, product), qty) → sum → distributed sort per category", verdict: "best", why: `Embarrassingly parallel over log files, restartable, and multi-category items fall out naturally since the key includes category. The sort step yields the rank order directly.` },
          { id: "groupby", label: "Hourly SQL GROUP BY over raw transactions", verdict: "solid", why: `Fine at 1B rows/month for a while — but each run rescans a growing window on the same box serving other work, and the sort competes with reads.` },
          { id: "onread", label: "Compute the rank when someone asks", verdict: "weak", why: `Aggregating a month of sales inside a request path serving 40k reads/sec — the precompute exists because of exactly this ratio.` }
        ],
        mustMention: ["key = (category, product) handles multi-category", "distributed sort produces the rank", "incremental window vs full recompute"]
      },
      store: {
        name: "Rank storage", prompt: "Where do finished ranks live for serving?", required: true,
        options: [
          { id: "sqlagg", label: "sales_rank(category_id, rank, product_id, total_sold) SQL table, indexed, behind read replicas", verdict: "best", why: `A small hot aggregate table with an index on (category_id, rank) serves 'top of category X' as a pure index range scan, and replicas fan the 40k reads/sec out.` },
          { id: "kv", label: "KV store: category_id → ordered product list", verdict: "solid", why: `Blazing point reads, but ad-hoc questions (a product's rank across all its categories) become application-side work.` },
          { id: "files", label: "Serve straight from the MapReduce output files", verdict: "weak", why: `Object storage isn't a 40k-reads/sec serving tier, and every read re-parses flat files.` }
        ],
        mustMention: ["index shaped like the query (category, rank)", "read replicas for the 100:1 ratio", "keep the serving table small — aggregates only"]
      },
      api: {
        name: "Read API", prompt: "40,000 reads/sec want the top of a category. What's the path?", required: true,
        options: [
          { id: "restcache", label: "REST GET /popular?category=X with a memory cache in front of the replicas", verdict: "best", why: `Rank pages are identical for everyone and change hourly — the perfect cache: huge hit rate, trivially invalidated on each rank refresh.` },
          { id: "cdnjson", label: "Publish static per-category JSON to a CDN hourly", verdict: "solid", why: `Genuinely clever for fully public ranks — but personalization, auth, or partial updates all break the static model the moment product asks.` },
          { id: "direct", label: "Clients query the SQL replicas directly", verdict: "weak", why: `No cache tier and clients coupled to the schema — 40k/sec of identical queries the database answers over and over.` }
        ],
        mustMention: ["identical-for-everyone → cache aggressively", "invalidate on refresh, not TTL guesswork", "replicas behind the cache, not instead of it"]
      },
      freshness: {
        name: "Refresh cadence", prompt: "How does 'hourly, faster for hot categories' actually run?", required: true,
        options: [
          { id: "windowed", label: "Hourly incremental MapReduce over the last window; hot categories re-run more often", verdict: "best", why: `Process the new hour's logs and fold into running totals rather than recomputing a month; popularity-weighted scheduling gives trending categories their faster refresh without recomputing the world.` },
          { id: "fullhourly", label: "Full recompute of everything, every hour", verdict: "solid", why: `Simple and self-healing (no drift), but burns compute proportional to history every hour and gets slower as history grows.` },
          { id: "daily", label: "Recompute daily", verdict: "weak", why: `The requirement is hourly — a daily job fails the spec before any architecture discussion starts.` }
        ],
        mustMention: ["incremental vs full recompute", "popularity-weighted refresh schedules", "meeting the stated hourly SLO"]
      },
      warehouse: {
        name: "Analytics warehouse", prompt: "Product wants arbitrary sales questions next. Where do those go?", required: false,
        options: [
          { id: "warehouse", label: "Load the raw logs into a warehouse/analytics DB for ad-hoc queries", verdict: "best", why: `The rank pipeline stays lean and purpose-built; analysts get SQL over the same raw source of truth without touching the serving path.` },
          { id: "reuse", label: "Point analysts at the sales_rank serving table", verdict: "weak", why: `The serving table holds only aggregates — and analyst scans competing with 40k reads/sec is how ranking pages start timing out.` }
        ],
        mustMention: ["separate serving from analytics", "raw logs feed both"]
      }
    },
    grills: [
      { q: "A product sits in 4 categories. Where does your design count it once vs 4 times, and is that correct?", a: `The MapReduce key is (category, product), so it ranks independently in each category — correct, since rank is per-category by definition. Total-sales analytics must instead key by product alone; same raw data, different aggregation, which is why the raw log stays the source of truth.` },
      { q: "Product wants 'trending in the last 15 minutes' for the homepage. What changes?", a: `Hourly batch can't see 15 minutes. Add a small streaming path — counters over a sliding window feeding a separate trending list — alongside the batch ranks. Don't rebuild ranking as streaming; trending and rank are different products with different freshness and accuracy needs.` },
      { q: "The hourly job fails at 3am and nobody notices until 9am. What did users see, and what do you add?", a: `Users saw 3am ranks all morning — stale but coherent, which is the graceful-degradation upside of precompute. Add: job success/lateness alerts, a freshness timestamp exposed on the API (and dashboarded), and idempotent catch-up runs that process the missed windows in order.` }
    ]
  },
  {
    id: "scaling-aws",
    topic: "Classic Builds",
    title: "Design a system that scales to millions of users on AWS",
    brief: `Take one service from a single box to tens of millions of users. At each step, add only what a measured bottleneck justifies — the discipline is the design.`,
    constraints: [
      "1 user → 10M+ users over time; relational data",
      "1B writes/month (~400/sec); 100B reads/month (~40k/sec); 100:1 read:write",
      "1 KB per write ≈ 1 TB new content/month",
      "Every addition must be justified by a measured bottleneck",
      "Availability expectations grow with the user count"
    ],
    skeleton: ["day1", "separate", "horizontal", "static", "readscale", "elastic"],
    addable: ["writescale"],
    stages: {
      day1: {
        name: "Day one", prompt: "1–2 users. What do you actually deploy?", required: true,
        options: [
          { id: "singlebox", label: "One EC2 box: web + MySQL together, vertical scaling, monitoring from day one", verdict: "best", why: `The primer starts exactly here on purpose: simplicity first, a bigger box when metrics say so, and CloudWatch/top/statsd installed now so every later step is evidence-based.` },
          { id: "micro", label: "Microservices + Kubernetes from day zero", verdict: "weak", why: `Distributed-systems tax with zero users: you'll debug service discovery instead of finding product-market fit.` },
          { id: "lbday0", label: "Two boxes behind a load balancer from the start", verdict: "solid", why: `Buys redundancy early at modest cost — defensible if downtime already matters, premature if it doesn't.` }
        ],
        mustMention: ["start simple, scale on evidence", "monitoring before bottlenecks", "vertical scaling's ceiling and cost"]
      },
      separate: {
        name: "First split", prompt: "The box is straining. What's the first structural change?", required: true,
        options: [
          { id: "splitdb", label: "Move MySQL to its own host (RDS), keep web on EC2; static IP + DNS (Route 53)", verdict: "best", why: `Web and database scale independently and stop competing for the same RAM/IO; managed RDS takes backups and patching off your plate.` },
          { id: "bigger", label: "Keep one box, keep upgrading it", verdict: "solid", why: `Works surprisingly long, but the cost curve steepens, the ceiling is real, and one box is still zero redundancy.` },
          { id: "shardnow", label: "Shard MySQL immediately", verdict: "weak", why: `Sharding is the most complex scaling tool — reaching for it before replication, caching, or even a second box is sequence malpractice.` }
        ],
        mustMention: ["web/DB resource contention", "managed services offload ops", "scaling-move sequencing"]
      },
      horizontal: {
        name: "Going horizontal", prompt: "More users. How does the web tier grow?", required: true,
        options: [
          { id: "elb", label: "ELB + multiple stateless web servers across availability zones; sessions externalized", verdict: "best", why: `The LB spreads load, health-checks out the sick, and multi-AZ survives a datacenter loss. Statelessness is the precondition — sessions move to a shared store so any server can serve anyone.` },
          { id: "dnsrr", label: "DNS round robin across servers", verdict: "solid", why: `No LB to run, but no health checks either — dead servers keep receiving traffic until TTLs expire, which users experience as an outage.` },
          { id: "vertical", label: "One ever-bigger instance", verdict: "weak", why: `Redundancy stays at zero and the price-per-increment climbs — horizontal scaling on commodity boxes is the whole lesson of this exercise.` }
        ],
        mustMention: ["stateless servers, externalized sessions", "health checks", "multi-AZ redundancy"]
      },
      static: {
        name: "Static content", prompt: "Where do JS/CSS/images/media live now?", required: true,
        options: [
          { id: "s3cdn", label: "S3 for static assets + CloudFront CDN; web servers do dynamic work only", verdict: "best", why: `Object storage plus edge caching strips the highest-volume, lowest-value requests off your fleet — users get closer bytes, your servers get their CPU back.` },
          { id: "webserve", label: "Web servers keep serving static files", verdict: "solid", why: `Works, but you're scaling app servers to push images — the priciest possible file server.` },
          { id: "local", label: "Static files on each server's local disk", verdict: "weak", why: `Servers must stay clones of each other; per-box files drift and break autoscaling — the primer's rule against file-based state.` }
        ],
        mustMention: ["object store + CDN offload", "keep servers clonable", "separate static from dynamic load"]
      },
      readscale: {
        name: "Read scaling", prompt: "MySQL groans under 100:1 reads. What absorbs them?", required: true,
        options: [
          { id: "cachereplica", label: "ElastiCache (memory cache) for hot data + MySQL read replicas; sessions in the cache too", verdict: "best", why: `The cache eats repeated reads in RAM; replicas absorb what misses. Two independent shock absorbers before the master feels anything — this is the canonical 100:1 answer.` },
          { id: "moreweb", label: "Add more web servers", verdict: "solid", why: `Helps only if the web tier is the bottleneck — more app servers pointed at the same saturated database just queue faster.` },
          { id: "biggerdb", label: "Keep upgrading the RDS instance", verdict: "weak", why: `Vertical scaling again, now at database prices, with the same ceiling — and it does nothing for redundancy.` }
        ],
        mustMention: ["cache-aside in front of the DB", "read replicas + replication lag awareness", "find the actual bottleneck first"]
      },
      elastic: {
        name: "Elasticity & async", prompt: "Traffic swings daily and spikes on launches. How does the fleet cope?", required: true,
        options: [
          { id: "asg", label: "Autoscaling groups on CloudWatch metrics + SQS queues with worker fleets for expensive operations", verdict: "best", why: `The fleet tracks demand instead of peak-provisioning, and slow work (emails, thumbnails, reports) moves to queues + workers so user requests never wait on it.` },
          { id: "overprov", label: "Fixed fleet sized for peak", verdict: "solid", why: `Simple and predictable — you're just paying peak price at 4am, which at scale is real money.` },
          { id: "manual", label: "Scale by hand when alerts fire", verdict: "weak", why: `Humans are the slowest autoscaler: the spike finishes (or the site falls over) before the on-call finishes clicking.` }
        ],
        mustMention: ["scale on metrics, not vibes", "async work via queues + workers", "cost of peak provisioning"]
      },
      writescale: {
        name: "Write scaling", prompt: "Eventually writes outgrow one master. Then what?", required: false,
        options: [
          { id: "sequence", label: "Move suitable data to NoSQL; then federation; sharding last", verdict: "best", why: `First relieve the master of data that never needed relational guarantees (sessions, logs, counters), then split by function, and only then shard — each step defers the most complex option.` },
          { id: "mastermaster", label: "Master-master replication", verdict: "solid", why: `Buys write availability, but brings loose consistency or added write latency plus conflict resolution — the primer flags it as trickier than it looks.` }
        ],
        mustMention: ["offload non-relational data first", "federation before sharding", "master-master consistency tradeoffs"]
      }
    },
    grills: [
      { q: "Black Friday brings 10x traffic for 48 hours. Which parts of your final architecture flex, and which fall over first?", a: `Flex: autoscaled web tier, CDN, cache cluster, queue workers. First to fall: the relational master (writes don't autoscale) and replication lag as replicas fall behind. Pre-warm the cache, raise ASG limits ahead of time, and shed non-critical writes to queues — the master is the fixed asset everything else protects.` },
      { q: "Your MySQL master hits 100% write utilization. Order your next three moves and justify the order.", a: `1) Buffer and batch through SQS so spikes become steady-state (cheapest, reversible). 2) Move non-relational write traffic (sessions, logs, events) to NoSQL/object storage — often half the volume. 3) Federate by function; shard only if a single function still exceeds one master. Complexity is spent in ascending order.` },
      { q: "When is it honest to introduce NoSQL into this stack?", a: `When a specific access pattern demands it: session state (KV), append-heavy logs/clickstreams, counters at high write rates — not 'because scale'. The constraint said relational data; NoSQL earns its place per-dataset by throughput and shape, while the relational core keeps its transactions.` }
    ]
  }
];
