# 1. Goals & Assumptions

## Goals

1. **AI-Driven Market Creation**
   - Automate market creation from news sources and user proposals
   - Generate deterministic, machine-resolvable market rules
   - Validate markets for clarity, fairness, and compliance

2. **User Proposal System**
   - Allow users to propose markets in natural language
   - AI generates structured market definition or matches existing markets
   - Provide confidence scores and rule previews before publishing

3. **Automated Resolution**
   - Resolve markets automatically using official sources
   - Apply deterministic `must_meet_all` / `must_not_count` logic
   - Support 24-hour dispute window with AI dispute agent

4. **Full Auditability**
   - Log all AI decisions, validations, and resolutions
   - Store evidence hashes with resolution data
   - Track `ai_version` for reproducibility

5. **Integration with Existing System**
   - Work with existing Solana smart contract (minimal contract changes)
   - Extend current Fastify backend with versioned API
   - Add new frontend modules for proposals and admin review

---

## Assumptions

### Existing Infrastructure
- Frontend (Next.js) and backend (Fastify) already exist and are functional
- Solana smart contract handles on-chain market state and trading
- PostgreSQL database is available (Neon)
- Current market creation is admin/whitelist only

### AI System Design
- AI server generates markets from news or user proposals
- All AI outputs conform to strict JSON schemas
- LLM used: OpenAI `gpt-3.5-turbo` (abstracted for future model changes)
- Workers run as separate Node.js processes

### Resolution Requirements
- Deterministic resolution requires explicit, machine-checkable sources
- Allowed sources: official websites, official social media, official APIs
- Not allowed: screenshots, blogs, user-generated content, shortened links
- 24-hour dispute window before finalization (contract dev will implement)

### Data Storage
- On-chain: minimal market parameters (name, expiry, token mints, etc.)
- Off-chain (PostgreSQL): AI rules, metadata, audit logs, proposals, news
- Evidence: hash + raw data stored in database (no IPFS for now)

### Security
- Rate limits: 3/min, 20/hr, 100/day per user for proposals
- Workers authenticate via API-issued short-lived JWTs (5-15 min)
- Prompt injection protection via pre-filtering and safety verification

### User Flow
- Regular users submit proposals via API
- AI validates and generates draft markets
- Approved markets are published on-chain automatically
- `needs_human` markets go to admin review queue
- Only market participants (YES/NO token holders) can submit disputes

---

## Out of Scope (Phase 1)

- Multi-chain support (EVM, etc.) - existing abstraction layer is ready
- Full evidence storage on IPFS/Arweave
- Social media scraping beyond official accounts
- Real-time streaming resolution (batch cron for now)
- Public market creation (remains admin-controlled via AI)

---

## Success Criteria

1. Users can submit natural language proposals and receive AI-generated market previews
2. 90%+ of AI-generated markets pass validation without human review
3. Resolution matches expected outcome based on official sources
4. Full audit trail from proposal → validation → publish → resolve
5. No security incidents from prompt injection or market manipulation
