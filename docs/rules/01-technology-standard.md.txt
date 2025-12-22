# TECHNOLOGY STANDARD

You MUST follow these technology standards for all projects in this workspace.

---

## 1) Backend language standard

**1.1 Python is the default and primary language for all backend and server-side work.**

All of this MUST be implemented in Python:

- HTTP APIs and microservices  
- Business logic and domain services  
- Background jobs and workers  
- CLI tools and automation scripts  
- Data pipelines, ETL and analytics jobs  
- AI and ML services and glue code  
- Internal tooling that runs on the server side  

**1.2 When you need a new backend component, you MUST:**

- Assume Python as the implementation language  
- Choose appropriate Python frameworks and libraries based on the use case, for example:  
  - FastAPI or similar for modern APIs  
  - Django or similar for full stack web apps when appropriate  
  - SQLAlchemy or native drivers for database access  
  - Python ecosystem for AI, data and automation  

**1.3** Infrastructure as code, maintenance scripts and integration tools SHOULD also be written in Python whenever reasonable, to keep the stack coherent.

---

## 2) Database standard: Supabase Postgres

**2.1 Supabase Postgres is the default and primary database.**

All primary relational data MUST live in Supabase Postgres, including:

- Core business entities  
- User accounts and profiles, unless fully delegated to an external auth provider  
- Billing and subscription data, or at least references to provider objects  
- Logging and audit tables when persistent logs are required  
- Any structured product data  

**2.2 You MUST NOT introduce another primary database technology**  
(such as MySQL, MongoDB, Firestore, DynamoDB or others) unless there is a strong, explicit and documented technical constraint.

If you ever propose a non-Supabase primary database, you MUST:

- Explain why Supabase Postgres cannot be used  
- Keep the alternative as narrow and minimal as possible  
- Document the exception clearly in `docs/architecture.md`  

**2.3 Supabase is the single source of truth for the relational data model.**

Any other data store:

- Is a derived or auxiliary layer  
- Must not become the canonical source of structured data  

---

## 3) Supabase projects and environments

**3.1 For each environment (dev, staging, production), you MUST assume:**

- One dedicated Supabase project  
- Each with its own database, credentials and configuration  

**3.2 When starting a new project or environment, you MUST:**

- Check if the corresponding Supabase project already exists  
- If it does not exist, describe the steps to create it:
  - Organization  
  - Region  
  - Project name  
  - Environment type (dev, staging, prod)  
- Ensure connection details are stored only in environment variables or secure config, never hardcoded  

**3.3 All schema design, migrations and RLS policies MUST target the Supabase database.**

You MUST:

- Use migrations that can be applied to the Supabase Postgres instance  
- Avoid ad hoc manual changes in production without tracked migrations  
- Keep `docs/db/` in sync with the actual Supabase schema  

---

## 4) Python backend and Supabase integration

**4.1 All backend services in Python MUST integrate with Supabase Postgres for data access.**

You should:

- Use official Supabase client libraries where appropriate  
- Or use Postgres drivers such as `psycopg` pointing at the Supabase connection  
- Follow database and Supabase role rules for schema, migrations and RLS  

**4.2 Business logic MUST treat Supabase as the database layer.**

When designing APIs, background jobs or workers in Python, always:

- Read and write data through Supabase or a direct Postgres connection to Supabase  
- Respect constraints, RLS policies and indexes defined in Supabase  

**4.3 For local development you may:**

- Use a local Postgres for quick prototyping  
- But you MUST keep schema definitions and migrations aligned with Supabase  
- Clearly mark anything that is local only in `docs/` or config  

---

## 5) Frontend technology standard

**5.1 Frontend code is explicitly allowed and expected to use modern web technologies, in particular:**

- React with TypeScript as the default choice  
- Or another modern framework only if the project’s `README.md` clearly defines it  

**5.2 Frontend is responsible for:**

- PWA behavior  
- Multi-device UX (phone, tablet, desktop, TV)  
- Light and dark themes  
- Brand and visual consistency based on `brandrules`  

**5.3 Frontend code MUST NOT implement backend business logic that belongs in Python.**

It can:

- Call APIs exposed by the Python backend  
- Handle presentation state and client-side UX logic  
- Run lightweight validation that mirrors backend rules  

The source of truth for business rules remains in the Python backend and Supabase database.

---

## 6) Other storage, caching and search

**6.1 You MAY use other storage systems in addition to Supabase Postgres, but only as supporting layers, for example:**

- Supabase storage buckets for files and assets  
- In-memory cache or external cache such as Redis for performance  
- Search indices, such as Algolia or Elasticsearch, for full-text search or advanced search features  

**6.2 For every supporting data store you introduce, you MUST:**

- Keep Supabase Postgres as the canonical source of structured data  
- Document in `docs/architecture.md`:
  - What the auxiliary store is used for  
  - How it stays in sync with Supabase  
- Define reconciliation strategies if the auxiliary store and Supabase diverge  

---

## 7) Stack consistency and library selection

**7.1 When choosing libraries and tools for:**

- APIs  
- Authentication  
- Data access  
- AI and ML  
- Background processing  
- Analytics and ETL  

You MUST:

- Prefer mature Python libraries on the backend  
- Prefer the chosen frontend stack libraries for UI concerns  

**7.2 Do NOT mix multiple backend languages for similar concerns.**

Avoid:

- Creating new backend services in other languages just because of habit or preference  
- Splitting the same domain across multiple backend languages  

**7.3 When integrating third-party services:**

- Wrap them with Python services where possible  
- Treat provider SDKs as implementation details behind a Python interface  

---

## 8) Edge runtimes and forced exceptions

**8.1 If a platform or provider only supports a specific language or runtime for some edge component, for example:**

- Edge functions that must run in JavaScript or TypeScript  
- Platform-specific runtimes that only accept one language  

Then you MAY:

- Implement that minimal integration in the required language  
- Keep the non-Python part as thin as possible  
- Delegate complex logic back to a Python service whenever possible  

**8.2 When you introduce any non-Python backend or non-Supabase primary storage, you MUST:**

- Explain why the exception is needed  
- Document it in `docs/architecture.md`  
- Treat it as an exception, not a new default  

---

## 9) Environment configuration standard (`.env` and `.env.example`)

**9.1 All secrets and environment-specific configuration MUST live in environment variables, never hardcoded in code or committed as real values.**

**9.2 Every project MUST have a `.env.example` file at the root with:**

- The full list of supported environment variables  
- No real secret values, only empty values or safe placeholders  
- Section headers grouping variables by integration  

**9.3 The default `.env.example` for this workspace MUST follow this structure:**

- GOOGLE API  
- GOOGLE EMAIL ACCESS  
- LLM SERVICE  
- DATABASE SERVICE (Supabase)  
- SMS SERVICE (Twilio or similar)  

You MUST keep this structure as a baseline and extend it when new integrations are added.

**9.4 For any new service or integration you introduce, you MUST:**

- Add the required variables to `.env.example`  
- Document their meaning in `docs/infra/config.md` or a similar config doc  
- Ensure that all code reads configuration exclusively from environment variables  

**9.5 You MUST NEVER:**

- Commit a real `.env` file  
- Log full secrets (API keys, passwords, tokens)  
- Echo secrets in error messages or debug output  

**9.6 All Python backend code and Supabase-related code MUST read connection and credential information from these environment variables, using the naming defined in `.env.example`.**

---

## 10) Documentation and communication

**10.1 All architecture decisions related to technology MUST:**

- Clearly state that:
  - Python is the primary backend language  
  - Supabase Postgres is the primary database  
  - Configuration is driven by environment variables defined in `.env.example`  
- Be documented in `docs/architecture.md` and, when relevant:
  - `docs/backend/overview.md`  
  - `docs/db/overview.md`  
  - `docs/infra/config.md`  

**10.2 When describing APIs, services, background jobs or data flows, you MUST:**

- Assume Python backend and Supabase database  
- Refer to the relevant environment variables from the standard `.env.example`  

**10.3 When other roles (Product, AI, Analytics, Marketing, Legal, Frontend, DevOps) make decisions, they MUST:**

- Assume this technology and configuration standard as the baseline  
- Align their choices with:
  - Python backend  
  - Supabase database  
  - Environment-based configuration via `.env` / `.env.example`  

---

If you are about to design or propose a backend solution that is not in Python, a primary database that is not Supabase Postgres, or configuration that ignores the environment variable standard, STOP and justify the exception. By default, all backend work is in Python, all primary database work is in Supabase, and all sensitive configuration lives in environment variables following the shared `.env.example` structure.
