# AI Prediction Market - Implementation Guide

> Complete technical specification for the AI-driven prediction market system.
>
> **Last Updated:** 2024-12-07
> **AI Version:** v1.0 (stored in database)

---

## Table of Contents

1. [Goals & Assumptions](./1-Goals%20%26%20Assumptions.md)
2. [High-Level Architecture](./2-High-Level%20Architecture.md)
3. [Data Models](./3-Data%20Models%20(Updated%20with%20Detailed%20Rules).md)
4. [API Endpoints](./4-API%20Endpoints%20(Enhanced%20with%20Full%20Rule%20Awareness).md)
5. [Worker Flows](./5-Worker%20Flows.md)
6. [Prompt Templates](./6-Prompt%20Templates.md)
7. [Rule & Schema Templates](./7-Rule%20%26%20Schema%20Templates.md)
8. [Oracles & Deterministic Resolution](./8-Oracles%20%26%20Deterministic%20Resolution.md)
9. [User Proposal Flow](./9-User%20Proposal%20Flow.md)
10. [Security, Rate Limits & Governance](./10-Security%2C%20Rate%20Limits%20%26%20Governance.md)
11. [Logging, Monitoring & Testing](./11-Logging%2C%20Monitoring%20%26%20Analytics.md)
12. [Deployment & Scaling](./12-Deployment%20%26%20Scaling.md)
13. [Maintenance & Model Updates](./13-Maintenance%20%26%20Model%20Updates.md)
14. [Database Schema](./14-Database%20Schema.md) *(NEW)*
15. [Frontend Specifications](./15-Frontend%20Specifications.md) *(NEW)*

---

## Quick Reference

### Repository Structure (Monorepo)

```
x402-ploymarket/
├── ai-prediction-market-front-end/   # Next.js frontend
├── prediction-market-back-end/       # Fastify API server
├── contract/                         # Anchor smart contract
├── workers/                          # NEW: AI worker processes
│   ├── crawler.ts
│   ├── extractor.ts
│   ├── generator.ts
│   ├── validator.ts
│   ├── publisher.ts
│   ├── resolver.ts
│   └── dispute-agent.ts
├── packages/                         # NEW: Shared packages
│   └── shared-types/
│       └── src/
│           ├── market.ts
│           ├── proposal.ts
│           ├── resolution.ts
│           ├── news.ts
│           └── queue.ts
├── package.json                      # Workspace root
└── implement-AI-plans/               # This documentation
```

### Key Technology Decisions

| Component | Technology |
|-----------|------------|
| Message Queue | RabbitMQ |
| Database | PostgreSQL (same instance) |
| LLM Provider | OpenAI (gpt-3.5-turbo) |
| Shared Types | npm workspace package |
| Worker Auth | API-issued JWT (5-15 min expiry) |
| Resolution Scheduler | Cron job (1 min interval) |
| Evidence Storage | Hash + raw data in PostgreSQL |

### API Versioning

- Existing endpoints: `/api/config`, `/api/markets`, etc.
- New AI endpoints: `/api/v1/propose`, `/api/v1/worker/*`, etc.

### Categories

```
politics | product_launch | finance | sports | entertainment | technology | misc
```

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/v1/propose` | 3/min, 20/hr, 100/day per user |
| Worker endpoints | API key authenticated, no public limit |

---

## Implementation Order (Recommended)

1. **Phase 1: Foundation**
   - Set up monorepo workspace
   - Create shared-types package
   - Add database schema migrations
   - Set up RabbitMQ

2. **Phase 2: Core Workers**
   - Generator worker (LLM integration)
   - Validator worker
   - Publisher worker

3. **Phase 3: User Flow**
   - Proposal API endpoint
   - Frontend proposal UI
   - Admin review panel

4. **Phase 4: Resolution**
   - Resolver worker
   - Cron scheduler
   - Dispute agent

5. **Phase 5: Crawler**
   - Manual ingest API
   - Basic RSS polling
   - Extractor worker
