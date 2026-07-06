/*
 * systems.js — content data layer for the classic system-design deck.
 *
 * Pure DATA (no functions), same contract as challenges.js. index.html reads
 * window.SYSTEMS_DECK and appends each pool to its inline arrays AFTER the
 * AI-engineering items, so existing mastery keys (f:/b:/q: indexes in
 * localStorage) stay stable. Only ever append here — never insert or reorder.
 *
 * Source: donnemartin/system-design-primer (CC BY 4.0) — converted from the
 * repo's Anki decks ("System Design", "System Design Exercises") and README.
 * The 8 worked interview questions live in challenges.js as design challenges.
 *
 * Schemas (must match the consumers in index.html):
 *   flash  : { topic, q, a:[str], metric }
 *   match  : [term, definition]            (match pairs carry no topic)
 *   blanks : { topic, text with ____, answer:[accepted], hint }
 *   mcq    : { topic, q, options:[4], answer:index, why }
 * Every topic must exist in TOPIC_COLOR and belong to a MASTERY_DOMAINS entry.
 */
window.SYSTEMS_DECK = {

  flash: [
    {
      topic: "Scalability",
      q: "The app is fast for a single user but crawls under heavy load. Performance problem or scalability problem?",
      a: [
        "Scalability problem. A performance problem means the system is slow even for one user.",
        "A service is scalable if added resources buy proportionally more performance — more units of work served, or larger units of work handled as datasets grow.",
        "Diagnose them differently: profile the single-request path for performance; find the saturated shared resource for scalability."
      ],
      metric: "p95 latency at 1x vs 10x load; throughput gained per node added."
    },
    {
      topic: "Scalability",
      q: "Latency vs throughput — what is each, and what do you actually aim for?",
      a: [
        "Latency is the time to perform an action; throughput is how many such actions complete per unit of time.",
        "They trade off: batching boosts throughput but adds latency to individual requests.",
        "The standard goal is maximal throughput with acceptable latency, not minimal latency at any cost."
      ],
      metric: "p95/p99 latency alongside requests per second — never one without the other."
    },
    {
      topic: "Scalability",
      q: "Why split the web layer from the application (platform) layer?",
      a: [
        "Each layer scales and is configured independently — adding a new API adds app servers without adding web servers.",
        "The single responsibility principle applied to services: small, autonomous, independently deployable — this is the microservices argument.",
        "Needs service discovery (e.g. Zookeeper, Consul) to track registered names, addresses, and ports.",
        "Cost: loosely coupled services demand different architecture, ops, and deployment discipline than a monolith."
      ],
      metric: "Deploy frequency per service; cross-service call latency; ops incidents from service sprawl."
    },
    {
      topic: "CAP",
      q: "A network partition hits your distributed datastore. What does CAP actually force you to pick?",
      a: [
        "You can only have two of: Consistency (every read gets the most recent write or an error), Availability (every request gets a response, maybe stale), Partition tolerance (system operates despite network failures).",
        "Networks aren't reliable, so partition tolerance is mandatory — the real tradeoff is consistency vs availability.",
        "CP: wait for the partitioned node and risk timeout errors — right when the business needs atomic reads and writes.",
        "AP: respond with the most recent data the node has, which may be stale — right when the business tolerates eventual consistency or must keep working through failures."
      ],
      metric: "Error rate during partition drills; staleness window (replication lag) under AP."
    },
    {
      topic: "Consistency",
      q: "Weak vs eventual vs strong consistency — what does each guarantee, and where does each fit?",
      a: [
        "Weak: after a write, reads may or may not see it — best effort. Fits realtime media like VoIP, video chat, multiplayer games: a dropped few seconds is simply lost.",
        "Eventual: after a write, reads see it within some window (async replication, typically ms). Fits highly available systems: DNS, email.",
        "Strong: after a write, every read sees it (sync replication). Fits transactions: file systems, RDBMSes.",
        "Pick per data type, not per system — account balances and view counters don't need the same guarantee."
      ],
      metric: "Replication lag distribution; stale-read rate observed by clients."
    },
    {
      topic: "Availability",
      q: "Active-passive vs active-active fail-over — how do they differ and what can still go wrong?",
      a: [
        "Active-passive: heartbeats between active and standby; on interruption the passive takes over the active's IP. Downtime depends on hot vs cold standby.",
        "Active-active: both nodes serve traffic and share load; DNS or app logic must know about both.",
        "Fail-over adds hardware and complexity, and you can lose data written by the active node before it replicated.",
        "Rule of thumb: fail-over handles machine death; replication handles data survival — you need both."
      ],
      metric: "Failover time (RTO), data loss window (RPO), heartbeat false-positive rate."
    },
    {
      topic: "Availability",
      q: "Master-slave vs master-master replication — the tradeoff?",
      a: [
        "Master-slave: one master serves writes and replicates to read-only slaves; if the master dies you run read-only until a slave is promoted. Promotion logic is the extra complexity.",
        "Master-master: both serve reads and writes and coordinate; survive either failure, but you need a load balancer or app-level write routing, and you get loose consistency (ACID violation) or higher write latency, plus conflict resolution as write nodes grow.",
        "Both: data loss if a master dies before replicating; many slaves means more replication traffic and greater lag; replicas bogged down replaying writes serve fewer reads."
      ],
      metric: "Replication lag; failed-promotion drills; write conflict rate (master-master)."
    },
    {
      topic: "SQL Scaling",
      q: "What is federation (functional partitioning) and when does it stop working?",
      a: [
        "Split the monolith database by function — e.g. separate forums, users, and products databases.",
        "Wins: less read/write traffic per DB, less replication lag, better cache locality from smaller working sets, and parallel writes with no single central master serializing them.",
        "Stops working with huge tables or functions that won't split; and you pay for it in app-level routing logic and painful cross-database joins (server links)."
      ],
      metric: "Per-database load and replication lag; count of cross-database join queries."
    },
    {
      topic: "Sharding",
      q: "You shard the users table. What do you gain and what breaks?",
      a: [
        "Each shard manages a subset of the data: less read/write traffic per node, less replication, more cache hits, smaller indexes, faster queries, parallel writes.",
        "One shard down doesn't kill the rest (still replicate within shards to avoid data loss).",
        "Breaks: app logic must route to shards, cross-shard joins get complex, and data can go lopsided — a shard of power users becomes a hot spot.",
        "Shard by a consistent-hashing function to cut the data moved when rebalancing."
      ],
      metric: "Per-shard load skew (hottest/median), rebalancing data moved, cross-shard query rate."
    },
    {
      topic: "SQL Scaling",
      q: "When is denormalization the right call, and what's the bill?",
      a: [
        "It trades write performance for read performance: redundant copies avoid expensive joins, which matters when reads outnumber writes 100:1 or 1000:1.",
        "Once data is federated or sharded, cross-datacenter joins get so complex that denormalization often circumvents them entirely.",
        "Materialized views (PostgreSQL, Oracle) can maintain the redundant copies for you.",
        "Bill: duplicated data, constraints to keep copies in sync, and under heavy writes it can perform worse than the normalized version."
      ],
      metric: "Join cost on hot read paths before/after; write amplification; copy-drift incidents."
    },
    {
      topic: "SQL Scaling",
      q: "The relational DB is slow. What does SQL tuning look like before you reach for new infrastructure?",
      a: [
        "Benchmark (simulate load, e.g. ab) and profile (slow query log) first — measure, don't guess.",
        "Tighten the schema: CHAR for fixed-length fields, TEXT for large blocks, INT/DECIMAL where they belong (DECIMAL for currency), NOT NULL where applicable, no BLOBs in rows — store object locations instead.",
        "Add indices on columns you SELECT/GROUP BY/ORDER BY/JOIN — B-trees give log-time access — but they cost memory and slow writes.",
        "Then: avoid expensive joins (denormalize where performance demands), partition hot spots into their own tables, and treat the query cache with suspicion."
      ],
      metric: "Slow-query log volume, p95 query time, index hit rate."
    },
    {
      topic: "NoSQL",
      q: "What is BASE, and how does it relate to CAP?",
      a: [
        "The NoSQL counterpart to ACID: Basically available (the system guarantees availability), Soft state (state may change even without input), Eventually consistent (it becomes consistent over time).",
        "In CAP terms, BASE chooses availability over consistency.",
        "Most NoSQL stores lack true ACID transactions: data is denormalized and joins move into application code."
      ],
      metric: "Staleness window; app-level join cost on read paths."
    },
    {
      topic: "NoSQL",
      q: "Key-value store — why is it fast, and where does the complexity go?",
      a: [
        "Hash-table abstraction: O(1) reads and writes, backed by memory or SSD — the engine behind caches and rapidly-changing data.",
        "Some stores keep keys in lexicographic order, so key ranges are efficient too.",
        "It only offers a limited operation set, so any richer behavior (queries, relationships) shifts complexity up into the application layer.",
        "It's the base layer for fancier stores — document stores, and some graph databases, are built on KV."
      ],
      metric: "p99 get/set latency; hit rate when used as a cache tier."
    },
    {
      topic: "NoSQL",
      q: "Document vs wide-column vs graph store — pick the right NoSQL flavor.",
      a: [
        "Document (MongoDB, CouchDB, DynamoDB documents): all info for an object in one document, queried by its internal structure — high flexibility, occasionally-changing data.",
        "Wide column (Bigtable, HBase, Cassandra): columns grouped in column families, keyed by row, timestamped for versioning; keys in lexicographic order for range reads — built for very large datasets needing high availability and scalability.",
        "Graph (Neo4j, FlockDB): nodes are records, arcs are relationships — wins when the model is many-to-many relationships, like a social network.",
        "Choose by data shape and query pattern, not fashion."
      ],
      metric: "Query patterns actually served natively vs emulated in app code."
    },
    {
      topic: "NoSQL",
      q: "SQL or NoSQL — what actually decides it?",
      a: [
        "SQL: structured relational data, strict schema, complex joins, transactions, established tooling, fast index lookups, and clear scaling patterns (replication, federation, sharding, denormalization, tuning).",
        "NoSQL: semi-structured data, flexible schema, no join requirement, TB–PB volumes, data-intensive workloads, very high IOPS throughput.",
        "Classic NoSQL fits: rapid clickstream/log ingest, leaderboards, temporary data like shopping carts, frequently-accessed hot tables, metadata/lookup tables.",
        "Real systems mix both — the interview answer is the decision procedure, not a brand."
      ],
      metric: "For each dataset: join/transaction needs vs volume and throughput demands."
    },
    {
      topic: "Caching",
      q: "Where can you cache, and what should you put there?",
      a: [
        "Levels: client (browser/OS), CDN, web server (reverse proxies like Varnish), database (its default config), and application (Redis/Memcached in RAM, LRU-evicted).",
        "Two categories of app caching: database query level (hash the query as key — but invalidation on any cell change is brutal) and object level (assemble objects from the DB, remove on change — enables async worker assembly).",
        "Worth caching: user sessions, fully rendered pages, activity streams, user graph data.",
        "A cache in front of the database absorbs the uneven load and traffic spikes that popular items create."
      ],
      metric: "Hit rate per cache level; origin/database load shed; stale-serve rate."
    },
    {
      topic: "Caching",
      q: "Cache-aside vs write-through — who talks to the database, and what goes wrong in each?",
      a: [
        "Cache-aside (lazy loading): the app checks the cache, on miss loads from DB and fills the cache. Memcached-style. Only requested data gets cached — but every miss costs three trips, and DB updates leave stale entries until TTL or write-through fixes them.",
        "Write-through: the app writes to the cache, the cache synchronously writes to the DB. Reads of fresh writes are fast and data is never stale — but writes are slow, and a new/replacement node is cold until the DB updates it (pair with cache-aside).",
        "Most written data may never be read — cap that waste with a TTL."
      ],
      metric: "Hit rate, miss penalty (trips), stale-read rate, write latency."
    },
    {
      topic: "Caching",
      q: "Write-behind and refresh-ahead — when do the exotic cache strategies pay off?",
      a: [
        "Write-behind (write-back): write to cache, ack immediately, flush to the datastore asynchronously. Fast writes — but you lose data if the cache dies before flushing, and it's the most complex to implement.",
        "Refresh-ahead: auto-refresh recently accessed entries before their TTL expires. Cuts latency vs read-through — but only if you predict what will be needed; bad prediction is pure wasted load.",
        "Both are optimizations on top of a working cache-aside/write-through baseline, not starting points."
      ],
      metric: "Unflushed-write window (write-behind); prediction hit rate (refresh-ahead)."
    },
    {
      topic: "Async",
      q: "When does a request become a queue job, and what keeps the queue healthy?",
      a: [
        "If an operation is too slow inline, publish a job to a message queue, tell the user its status, and let a worker process it — e.g. a tweet appears on your timeline instantly but fans out to followers over time.",
        "Message queues: Redis (simple broker, can lose messages), RabbitMQ (AMQP, manage your own nodes), SQS (hosted, higher latency, at-least-once so duplicates happen).",
        "Task queues (e.g. Celery) add scheduling and run compute-heavy jobs in the background.",
        "Back pressure: once the queue fills, return 503 so clients retry with exponential backoff — bounded queues keep throughput high and latency predictable.",
        "Don't queue cheap, realtime operations — the queue adds delay and complexity."
      ],
      metric: "Queue depth, job age (oldest unprocessed), worker utilization, 503/backoff rate."
    },
    {
      topic: "Protocols",
      q: "TCP or UDP — how do you choose?",
      a: [
        "TCP: connection via handshake; sequence numbers, checksums, acks and retransmission guarantee ordered, uncorrupted delivery; flow and congestion control. The guarantees cost latency and efficiency.",
        "UDP: connectionless, best-effort datagrams, may arrive out of order or not at all; supports broadcast (DHCP needs it — no IP address yet); no congestion control, so it's leaner.",
        "TCP when you need all data intact and want the network throughput managed for you: web servers, DB info, SMTP, FTP, SSH.",
        "UDP when you need lowest latency, late data is worse than lost data, or you'll do your own error correction: VoIP, video chat, streaming, multiplayer games.",
        "Ops note: web servers holding many open TCP connections get memory-expensive — pool connections, or use UDP where it applies."
      ],
      metric: "Retransmission/loss rate, connection memory footprint, p99 latency."
    },
    {
      topic: "Protocols",
      q: "RPC vs REST — what does each expose, and where does each belong?",
      a: [
        "RPC exposes behaviors: the client calls a remote procedure as if local (stub marshals id + args; frameworks like Protobuf, Thrift, Avro). Common for internal comms — you can hand-craft calls for performance.",
        "RPC costs: tight coupling to the implementation, a new API per operation, hard to debug, and awkward to cache with off-the-shelf infrastructure.",
        "REST exposes data: a client/server model manipulating resources through a uniform interface — identify resources by URI, act through verbs (GET/POST/PUT/PATCH/DELETE), self-descriptive status codes, HATEOAS. Stateless and cacheable, so it horizontally scales — the default for public APIs.",
        "REST costs: awkward for non-hierarchical operations ('archive all expired documents' maps to no clean verb+path), and the few verbs sometimes just don't fit."
      ],
      metric: "For public APIs: cacheability and client coupling; for internal: call latency and schema-change blast radius."
    },
    {
      topic: "DNS",
      q: "What happens in DNS between typing a domain and getting an IP — and what can bite you?",
      a: [
        "DNS translates www.example.com to an IP address, hierarchically: a few authoritative servers at the top, lower-level servers and your router/ISP caching below, plus browser/OS caches — all governed by TTL.",
        "Records: A (name → IP), CNAME (name → name), NS (delegates the domain's DNS servers), MX (mail servers).",
        "Managed services (Route 53, CloudFlare) route by weighted round robin, latency, or geolocation — useful for maintenance draining, uneven cluster sizes, and A/B tests.",
        "Bites: lookup delay (mitigated by caching), stale entries during propagation, and DNS as a DDoS target (you're unreachable without your IP being known)."
      ],
      metric: "Lookup latency, cache TTL vs propagation lag, resolver failure rate."
    },
    {
      topic: "CDN",
      q: "Push or pull CDN — and what does a CDN buy you in the first place?",
      a: [
        "A CDN is a globally distributed proxy network serving content from close to the user; DNS resolution tells clients which edge to hit. Users get nearby data centers AND your servers stop serving those requests.",
        "Push: you upload content on change and rewrite URLs — you own expiry/updates. Minimal traffic, maximal storage: good for small-traffic or rarely-updated content, placed once.",
        "Pull: the CDN fetches from your origin on first request, cached per TTL; first hit is slow, storage is minimal, but expired-then-unchanged files get re-pulled redundantly. Good for heavy traffic — only recently-requested content stays hot.",
        "Costs: CDN bills can be significant, content can be stale if updated before TTL expiry, and all static URLs must point at the CDN."
      ],
      metric: "Cache hit ratio at edge, origin offload %, stale-content incidents."
    },
    {
      topic: "Load Balancing",
      q: "Layer 4 vs layer 7 load balancing — what does each see, and when do you pay for L7?",
      a: [
        "LBs distribute requests away from unhealthy or overloaded servers, kill single points of failure, and can also do SSL termination (no X.509 certs on every backend) and session persistence via cookies.",
        "L4 sees transport info only — source/dest IPs and ports, not content — and NATs packets through. Cheaper, less flexible.",
        "L7 terminates the connection, reads headers/message/cookies, picks a server, opens a new connection — e.g. video traffic to video hosts, billing traffic to hardened servers.",
        "Routing options: random, least loaded, session/cookies, (weighted) round robin, L4, L7. Run LBs in pairs (active-passive/active-active) or the LB itself is your new single point of failure.",
        "Horizontal-scaling corollary: backends must be stateless — sessions live in a centralized store (SQL/NoSQL/Redis) — and downstream caches/DBs must absorb more simultaneous connections."
      ],
      metric: "Per-backend load spread, LB saturation, health-check flap rate."
    },
    {
      topic: "Load Balancing",
      q: "You have ONE app server. Why might you still want a reverse proxy in front?",
      a: [
        "A reverse proxy centralizes internal services behind one public interface — useful even with a single backend, unlike a load balancer which earns its keep with multiple servers.",
        "Wins: security (hide backend info, blacklist IPs, cap connections per client), flexibility (clients only see the proxy's IP — scale or reconfigure servers freely), SSL termination, compression, response caching, and direct static-content serving.",
        "NGINX and HAProxy do both L7 reverse proxying and load balancing.",
        "Costs: one more component's complexity, and a single reverse proxy is itself a single point of failure — HA pairs add more complexity still."
      ],
      metric: "Origin requests shed (cache + static), TLS handshake cost moved off backends."
    },
    {
      topic: "Security",
      q: "The security basics every system design answer should include — what's the floor?",
      a: [
        "Encrypt in transit and at rest.",
        "Sanitize all user input and any user-exposed parameters to block XSS and SQL injection; use parameterized queries for SQLi specifically.",
        "Apply the principle of least privilege everywhere — services, DB users, tools.",
        "This is the floor, not the ceiling — say it unprompted in an interview before going deep on the workload-specific threats."
      ],
      metric: "% endpoints behind input validation and parameterized queries; privilege audit findings."
    }
  ],

  match: [
    ["Active-passive fail-over", "Heartbeats between an active server and a standby; on interruption the passive takes over the active's IP address."],
    ["Master-master replication", "Both nodes serve reads and writes and coordinate on writes; loose consistency or higher write latency comes with it."],
    ["Federation", "Splits databases by function (users, forums, products) for less traffic, less replication lag, and better cache locality."],
    ["Consistent hashing", "Sharding function that minimizes the data moved when shards are added, removed, or rebalanced."],
    ["Denormalization", "Duplicates data across tables to avoid expensive joins, trading write performance for read performance."],
    ["Materialized view", "RDBMS feature that stores redundant query results and keeps the copies consistent for you."],
    ["BASE", "Basically available, soft state, eventually consistent — NoSQL's answer to ACID, choosing availability over consistency."],
    ["Wide column store", "Columns grouped in families under a row key, each value timestamped — Bigtable, HBase, Cassandra."],
    ["Graph database", "Nodes are records, arcs are relationships — built for many-to-many models like social networks."],
    ["Cache-aside", "The app checks the cache, on miss loads from the database and fills the cache — lazy loading, three trips per miss."],
    ["Write-through", "The app writes to the cache, which synchronously writes to the database — never stale, but slow writes."],
    ["Write-behind", "Write to cache, ack immediately, flush to the datastore asynchronously — fast writes, data loss if the cache dies first."],
    ["Refresh-ahead", "The cache auto-refreshes recently used entries before their TTL expires — a bet on predicting future reads."],
    ["Back pressure", "Bounding queue size and rejecting with 503 + retry/backoff once full, to protect throughput and latency."],
    ["Layer 7 load balancing", "Terminates traffic, reads headers/message/cookies, then opens a connection to the chosen server."],
    ["Reverse proxy", "Centralizes internal services behind one public interface — worth having even with a single backend server."],
    ["Pull CDN", "Edge fetches content from your origin on first request and caches it per TTL — suits heavy-traffic sites."],
    ["TTL", "How long a cached entry (DNS record, CDN object, cache key) may be served before it must be refreshed."],
    ["CNAME record", "DNS record pointing a name to another name; an A record points a name to an IP."],
    ["HATEOAS", "Hypertext as the engine of application state — REST responses carry links to the actions currently allowed."],
    ["Base 62", "Encodes to [a-zA-Z0-9] — URL-safe short links with no characters needing escaping, unlike Base 64's + and /."],
    ["MD5", "Widely used, uniformly distributed 128-bit hash — hash the content, then take the first characters for a short link."]
  ],

  blanks: [
    { topic: "CAP", text: "Networks are unreliable, so under a partition CAP really forces a choice between consistency and ____.", answer: ["availability"], hint: "Every request gets a response — maybe a stale one." },
    { topic: "Consistency", text: "After a write, reads will see it within milliseconds via async replication — ____ consistency.", answer: ["eventual"], hint: "DNS and email live here." },
    { topic: "Availability", text: "In active-passive fail-over, ____ between the servers decide when the standby takes over.", answer: ["heartbeats", "heartbeat"], hint: "The signal whose silence triggers takeover." },
    { topic: "Availability", text: "With master-slave replication, losing the master leaves the system running in read-____ mode until a slave is promoted.", answer: ["only"], hint: "Writes stop; reads continue." },
    { topic: "SQL Scaling", text: "Splitting one monolithic database into forums, users, and products databases is called ____.", answer: ["federation", "functional partitioning"], hint: "Partitioning by function, not by key." },
    { topic: "Sharding", text: "A sharding function based on consistent ____ reduces the data transferred when rebalancing.", answer: ["hashing"], hint: "Ring-based key placement." },
    { topic: "SQL Scaling", text: "Denormalization improves ____ performance at the expense of some write performance.", answer: ["read"], hint: "Reads can outnumber writes 1000:1." },
    { topic: "NoSQL", text: "BASE stands for basically available, soft state, and ____ consistency.", answer: ["eventual", "eventually"], hint: "Same word as the consistency pattern." },
    { topic: "Caching", text: "In cache-____, the application loads an entry from the database on a miss and adds it to the cache.", answer: ["aside"], hint: "Also called lazy loading." },
    { topic: "Caching", text: "Write-____ caching acks immediately and flushes asynchronously — losing data if the cache dies before the flush.", answer: ["behind", "back"], hint: "The async-write strategy." },
    { topic: "Async", text: "When a queue fills up, back ____ rejects new work with a 503 so clients retry with exponential backoff.", answer: ["pressure"], hint: "Keeps queue size bounded and latency sane." },
    { topic: "Load Balancing", text: "Layer ____ load balancers read headers, message contents, and cookies to decide where a request goes.", answer: ["7", "seven"], hint: "The application layer." },
    { topic: "Protocols", text: "Choose UDP over TCP when late data is worse than ____ of data.", answer: ["loss"], hint: "VoIP, video chat, multiplayer games." },
    { topic: "Protocols", text: "RPC is focused on exposing behaviors; REST is focused on exposing ____.", answer: ["data", "resources"], hint: "Nouns, not verbs." },
    { topic: "CDN", text: "____ CDNs grab content from your server when the first user requests it, then cache it per TTL.", answer: ["pull"], hint: "The opposite uploads on every change." },
    { topic: "DNS", text: "An ____ record points a domain name to an IP address, while a CNAME points a name to another name.", answer: ["a", "a record", "address"], hint: "The most basic DNS record type." },
    { topic: "Classic Builds", text: "Hash the paste content with MD5, encode in Base ____, and take the first 7 characters for a URL-safe shortlink.", answer: ["62"], hint: "[a-zA-Z0-9] — no characters to escape." },
    { topic: "Scalability", text: "To scale horizontally behind a load balancer, servers must be ____ — sessions move to a centralized store like Redis.", answer: ["stateless"], hint: "No user data living on any one box." }
  ],

  mcq: [
    {
      topic: "CAP",
      q: "You're designing account transfers for a bank. A network partition splits your datastore. Which CAP stance is right?",
      options: ["AP — keep serving, reconcile later", "CP — atomic reads/writes, accept timeout errors", "Drop partition tolerance and run one big node", "Weak consistency with client-side retries"],
      answer: 1,
      why: "Money movement needs atomic reads and writes: consistency over availability under partition. AP suits systems that tolerate eventual consistency — not ledgers."
    },
    {
      topic: "Caching",
      q: "Popular items skew reads and hammer specific database partitions. Cheapest effective fix?",
      options: ["Shard the database further", "Put a cache in front of the database to absorb the uneven load", "Move everything to a wide column store", "Vertical-scale the database server"],
      answer: 1,
      why: "Caches exist precisely to absorb uneven loads and traffic spikes from hot items. Resharding or migrating stores is a far bigger hammer for the same symptom."
    },
    {
      topic: "Sharding",
      q: "One users shard runs hot because a set of power users landed together. What's the primer-approved mitigation?",
      options: ["Denormalize the users table", "Add a read-through cache per shard", "Rebalance with a consistent-hashing shard function to limit data moved", "Switch the shard to master-master"],
      answer: 2,
      why: "Lopsided shards need rebalancing, and consistent hashing keeps the rebalance cheap by minimizing transferred data. The others treat different problems."
    },
    {
      topic: "Protocols",
      q: "Which workload belongs on UDP, not TCP?",
      options: ["Database replication traffic", "SMTP mail delivery", "Live video chat", "File transfer (FTP)"],
      answer: 2,
      why: "Realtime media prefers lowest latency and tolerates loss — late frames are worse than dropped frames. The others need every byte to arrive intact and ordered."
    },
    {
      topic: "CDN",
      q: "A high-traffic news site wants a CDN with minimal storage overhead and even traffic spread. Which type?",
      options: ["Push CDN", "Pull CDN", "Client-side caching only", "A reverse proxy per region"],
      answer: 1,
      why: "Pull CDNs keep only recently-requested content at the edge, spreading traffic naturally — the fit for heavy traffic. Push suits small-traffic sites with rarely-changing content."
    },
    {
      topic: "Load Balancing",
      q: "You must route /video requests to media servers and /billing to security-hardened servers. What do you need?",
      options: ["Layer 4 load balancing", "Layer 7 load balancing", "DNS weighted round robin", "Client-side server selection"],
      answer: 1,
      why: "Routing by URL path means reading application-layer content — that's L7. L4 only sees IPs and ports; DNS round robin can't see the request at all."
    },
    {
      topic: "Load Balancing",
      q: "Single app server, and you want SSL termination, response caching, and static file serving without touching app code. Add what?",
      options: ["A load balancer", "A reverse proxy (e.g. NGINX)", "A pull CDN", "Memcached"],
      answer: 1,
      why: "Reverse proxies deliver exactly that bundle and are worth it even with one backend. A load balancer earns its keep only once there are multiple servers."
    },
    {
      topic: "NoSQL",
      q: "Rapid ingest of clickstream and log data with no joins and huge volume. Best-fit store per the primer?",
      options: ["RDBMS with master-slave replication", "NoSQL (e.g. wide column / key-value)", "Graph database", "RDBMS with materialized views"],
      answer: 1,
      why: "Clickstream/log ingest is the canonical NoSQL fit: semi-structured, join-free, data-intensive, high-throughput. Relational scaling patterns solve a different problem."
    },
    {
      topic: "NoSQL",
      q: "Your data model is dominated by many-to-many relationships (a social network). Which store fits natively?",
      options: ["Key-value store", "Document store", "Wide column store", "Graph database"],
      answer: 3,
      why: "Graph databases make nodes records and arcs relationships — complex, foreign-key-heavy models query naturally. The others emulate relationships in app code."
    },
    {
      topic: "SQL Scaling",
      q: "Reads outnumber writes 100:1 and hot pages die on a 5-table join. First structural move?",
      options: ["Denormalize the hot read path into a redundant table or materialized view", "Shard all five tables", "Move the join into application code", "Add a write-behind cache"],
      answer: 0,
      why: "Read-heavy ratios are the textbook case for denormalization: pay some write cost to delete the join. Sharding adds the complexity without removing the join."
    },
    {
      topic: "Caching",
      q: "The main drawback of write-through caching?",
      options: ["Data in the cache can go stale", "Reads after writes are slow", "Higher write latency, and most written data may never be read", "It can't survive a cache node failure"],
      answer: 2,
      why: "Write-through is synchronous — writes pay the round trip, and unread writes waste cache (mitigate with TTL). Staleness is cache-aside's problem; data loss is write-behind's."
    },
    {
      topic: "Async",
      q: "Posting a tweet must feel instant, but delivering it to a million followers is slow. Pattern?",
      options: ["Synchronous fanout in the request path", "Publish to a message queue; workers fan out in the background while the timeline shows it immediately", "Bigger app servers", "Refresh-ahead caching of timelines"],
      answer: 1,
      why: "The primer's own example: ack the user instantly, queue the expensive fanout for workers. Inline fanout couples user latency to follower count."
    },
    {
      topic: "SQL Scaling",
      q: "Your single RDBMS is read-saturated but writes are fine. First scaling step?",
      options: ["Master-master replication", "Sharding", "Master-slave replication with read replicas", "Federation"],
      answer: 2,
      why: "Read replicas directly absorb read load with the least complexity. Master-master helps writes/failover; sharding and federation split data — bigger moves for a later problem."
    },
    {
      topic: "Scalability",
      q: "After adding a load balancer, users keep getting logged out when requests hit different servers. Root cause?",
      options: ["Missing SSL termination", "Servers hold sessions locally instead of a centralized store", "The LB should use layer 4 instead of layer 7", "DNS TTL too low"],
      answer: 1,
      why: "Horizontal scaling requires stateless servers — sessions belong in a centralized store (Redis/Memcached/DB) or via LB session persistence. State on one box breaks behind an LB."
    }
  ]
};
