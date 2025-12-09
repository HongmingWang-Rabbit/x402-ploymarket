# 4. API Endpoints

This document defines all API endpoints for the AI-driven prediction market system, including public, admin, and internal worker endpoints.

---

## API Design Principles

1. **RESTful conventions**: Use proper HTTP methods and status codes
2. **Consistent response format**: All responses follow the same envelope structure
3. **Snake_case naming**: All JSON fields use snake_case
4. **Pagination**: Use cursor-based pagination for large datasets
5. **Idempotency**: Support idempotency keys for mutation operations
6. **Versioning**: All new endpoints use `/api/v1` prefix

---

## API Versioning Strategy

- **Existing endpoints**: `/api/config`, `/api/markets`, `/api/trading`, `/api/liquidity`, `/api/metadata`
- **New AI endpoints**: `/api/v1/*`

All new AI-related functionality uses the `/api/v1` prefix. When breaking changes are needed, we'll introduce `/api/v2` while maintaining `/api/v1` for a deprecation period.

### Deprecation Policy

- Deprecated endpoints include `Deprecation: true` header
- Minimum 3-month notice before removal
- Sunset date communicated via `Sunset` header

---

## Common Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `Authorization` | Conditional | `Bearer <token>` for authenticated endpoints |
| `X-Idempotency-Key` | Recommended | UUID for POST/PUT/DELETE requests |
| `X-Request-ID` | Optional | Client-provided request tracking ID |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Server-assigned request ID (echoes client ID if provided) |
| `X-RateLimit-Limit` | Request limit for the endpoint |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `Retry-After` | Seconds to wait (only on 429 responses) |

---

## Response Envelope

All API responses follow this structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "has_more": true,
    "next_cursor": "eyJpZCI6MTIzfQ=="
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Human-readable message",
    "details": { ... }
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

## Authentication

| Endpoint Type | Authentication Method |
|---------------|----------------------|
| Public | Optional JWT (wallet signature) |
| Admin | Required JWT with `admin` role |
| Worker | API key → short-lived JWT |

### Worker Authentication Flow

1. Worker starts with API key from `.env`
2. Worker calls `POST /api/v1/auth/worker-token` with API key in header
3. Server validates key and returns short-lived JWT (15 min expiry)
4. Worker uses JWT in `Authorization: Bearer <token>` header
5. Worker refreshes token before expiry (at ~12 min mark)

---

## Rate Limiting

| Endpoint | Limit | Identifier |
|----------|-------|------------|
| `POST /api/v1/propose` | 3/min, 20/hr, 100/day | User ID or IP |
| `POST /api/v1/disputes` | 5/hr, 20/day | User ID (required) |
| `GET /api/v1/markets` | 60/min, 1000/hr | IP |
| Admin endpoints | No limit | N/A (authenticated) |
| Worker endpoints | No limit | N/A (authenticated) |

---

## Health & Status Endpoints

### Health Check

- **Method**: `GET`
- **Path**: `/health`
- **Auth**: None

**Response** (200 OK):
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-06-01T12:00:00Z"
}
```

**Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "checks": {
    "database": "healthy",
    "rabbitmq": "unhealthy",
    "solana_rpc": "healthy"
  }
}
```

### Readiness Check

- **Method**: `GET`
- **Path**: `/ready`
- **Auth**: None

Returns 200 when service is ready to accept traffic, 503 otherwise.

---

## 4.1 Public Endpoints

### 4.1.1 Submit Market Proposal

Submit a natural-language proposal for a new prediction market.

- **Method**: `POST`
- **Path**: `/api/v1/propose`
- **Auth**: Optional JWT (for user tracking)
- **Rate Limit**: 3/min, 20/hr, 100/day

#### Request

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>  (optional)
X-Idempotency-Key: <uuid>      (recommended)
```

**Body**:
```json
{
  "proposal_text": "Will Apple release iPhone 16 before September 2024?",
  "category_hint": "product_launch"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `proposal_text` | string | Yes | 10-500 characters |
| `category_hint` | string | No | One of: `politics`, `product_launch`, `finance`, `sports`, `entertainment`, `technology`, `misc` |

#### Responses

**200 OK** - Draft created:
```json
{
  "success": true,
  "data": {
    "proposal_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "existing_market": null,
    "draft_market": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "iPhone 16 Release by September 2024",
      "description": "Will Apple officially release iPhone 16 for consumer purchase before September 30, 2024?",
      "category": "product_launch",
      "confidence_score": 0.85,
      "resolution": {
        "type": "binary",
        "exact_question": "Will Apple publicly release iPhone 16 for purchase before September 30, 2024 23:59:59 UTC?",
        "criteria": {
          "must_meet_all": [
            "iPhone 16 must be available for purchase on apple.com",
            "Product page must show 'Buy' button (not pre-order)",
            "Release must occur before September 30, 2024 23:59:59 UTC"
          ],
          "must_not_count": [
            "Pre-order availability",
            "Developer or beta devices",
            "Leaked or rumored information",
            "Third-party retailer listings"
          ],
          "allowed_sources": [
            {
              "name": "Apple Official Website",
              "url": "https://www.apple.com/shop/buy-iphone",
              "method": "html_scrape",
              "condition": "Page contains 'iPhone 16' product with active 'Buy' button"
            }
          ],
          "machine_resolution_logic": {
            "if": "All must_meet_all conditions satisfied AND no must_not_count triggered",
            "then": "YES",
            "else": "NO"
          }
        },
        "expiry": "2024-09-30T23:59:59Z"
      }
    },
    "validation_status": "approved",
    "rules_summary": {
      "must_meet_all": ["Available on apple.com", "Buy button visible", "Before deadline"],
      "must_not_count": ["Pre-orders", "Beta devices", "Rumors"],
      "allowed_sources": ["Apple Official Website"]
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**200 OK** - Duplicate found:
```json
{
  "success": true,
  "data": {
    "proposal_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "matched",
    "existing_market": {
      "id": "550e8400-e29b-41d4-a716-446655440099",
      "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "title": "iPhone 16 Release Q3 2024",
      "similarity_score": 0.92
    },
    "draft_market": null,
    "validation_status": null,
    "rules_summary": null
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**200 OK** - Processing (async):
```json
{
  "success": true,
  "data": {
    "proposal_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "existing_market": null,
    "draft_market": null,
    "validation_status": null,
    "rules_summary": null
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**400 Bad Request** - Invalid input:
```json
{
  "success": false,
  "error": {
    "code": "invalid_request",
    "message": "Proposal text must be between 10 and 500 characters",
    "details": {
      "field": "proposal_text",
      "constraint": "length",
      "min": 10,
      "max": 500,
      "actual": 5
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**400 Bad Request** - Unsafe content:
```json
{
  "success": false,
  "error": {
    "code": "unsafe_content",
    "message": "Proposal contains content that cannot be processed",
    "details": {
      "issues": ["Forbidden content detected"]
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**429 Too Many Requests**:
```json
{
  "success": false,
  "error": {
    "code": "rate_limit_exceeded",
    "message": "You have exceeded the hourly proposal limit",
    "details": {
      "limit": 20,
      "window": "hour",
      "retry_after": 1200
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.1.2 Get Proposal Status

Check the status of a submitted proposal.

- **Method**: `GET`
- **Path**: `/api/v1/proposals/{proposal_id}`
- **Auth**: Optional JWT

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "proposal_text": "Will Apple release iPhone 16 before September 2024?",
    "status": "approved",
    "category_hint": "product_launch",
    "draft_market_id": "550e8400-e29b-41d4-a716-446655440001",
    "confidence_score": 0.85,
    "created_at": "2024-06-01T12:00:00Z",
    "processed_at": "2024-06-01T12:00:30Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.1.3 List Markets

Get AI-generated markets with optional filtering.

- **Method**: `GET`
- **Path**: `/api/v1/markets`
- **Auth**: None
- **Rate Limit**: 60/min

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `active` | Comma-separated: `active`, `resolving`, `resolved`, `finalized`, `disputed` |
| `category` | string | - | Filter by category |
| `limit` | integer | 20 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor from previous response |

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "title": "iPhone 16 Release by September 2024",
      "description": "Will Apple officially release iPhone 16...",
      "category": "product_launch",
      "status": "active",
      "ai_version": "ai_v1.0.0_gpt35_20240601",
      "confidence_score": 0.85,
      "expiry": "2024-09-30T23:59:59Z",
      "created_at": "2024-06-01T12:00:00Z",
      "on_chain": {
        "yes_price": 0.65,
        "no_price": 0.35,
        "total_liquidity_usdc": 50000,
        "volume_24h_usdc": 12500
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "has_more": true,
    "next_cursor": "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDA1MCJ9"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.1.4 Get Market Details

Get full details for a specific market including resolution rules.

- **Method**: `GET`
- **Path**: `/api/v1/markets/{market_address}`
- **Auth**: None

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "title": "iPhone 16 Release by September 2024",
    "description": "Will Apple officially release iPhone 16 for consumer purchase before September 30, 2024?",
    "category": "product_launch",
    "status": "active",
    "ai_version": "ai_v1.0.0_gpt35_20240601",
    "confidence_score": 0.85,
    "resolution": {
      "type": "binary",
      "exact_question": "Will Apple publicly release iPhone 16 for purchase before September 30, 2024 23:59:59 UTC?",
      "criteria": {
        "must_meet_all": [
          "iPhone 16 must be available for purchase on apple.com",
          "Product page must show 'Buy' button (not pre-order)",
          "Release must occur before September 30, 2024 23:59:59 UTC"
        ],
        "must_not_count": [
          "Pre-order availability",
          "Developer or beta devices",
          "Leaked or rumored information",
          "Third-party retailer listings"
        ],
        "allowed_sources": [
          {
            "name": "Apple Official Website",
            "url": "https://www.apple.com/shop/buy-iphone",
            "method": "html_scrape",
            "condition": "Page contains 'iPhone 16' product with active 'Buy' button"
          }
        ],
        "machine_resolution_logic": {
          "if": "All must_meet_all conditions satisfied AND no must_not_count triggered",
          "then": "YES",
          "else": "NO"
        }
      },
      "expiry": "2024-09-30T23:59:59Z"
    },
    "validation_decision": {
      "status": "approved",
      "reason": "Clear, deterministic rules with verifiable official sources",
      "validated_at": "2024-06-01T12:05:00Z",
      "validated_by": "validator_worker_v1"
    },
    "resolution_record": null,
    "created_at": "2024-06-01T12:00:00Z",
    "published_at": "2024-06-01T12:10:00Z",
    "on_chain": {
      "yes_price": 0.65,
      "no_price": 0.35,
      "total_liquidity_usdc": 50000,
      "volume_24h_usdc": 12500,
      "yes_token_supply": 75000,
      "no_token_supply": 75000
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "not_found",
    "message": "Market not found",
    "details": {
      "market_address": "invalid_address"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.1.5 Submit Dispute

Submit a dispute for a resolved market. Only token holders can dispute.

- **Method**: `POST`
- **Path**: `/api/v1/disputes`
- **Auth**: Required JWT (must hold YES or NO tokens)
- **Rate Limit**: 5/hr, 20/day per user

#### Request

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: <uuid>
```

**Body**:
```json
{
  "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "reason": "The resolution source was checked before the actual product release. The iPhone 16 was released on September 20, 2024.",
  "evidence_urls": [
    "https://www.apple.com/newsroom/2024/09/apple-introduces-iphone-16"
  ]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `market_address` | string | Yes | Valid Solana public key |
| `reason` | string | Yes | 20-2000 characters |
| `evidence_urls` | array | No | Max 5 URLs, must be allowed sources |

#### Responses

**201 Created**:
```json
{
  "success": true,
  "data": {
    "dispute_id": "550e8400-e29b-41d4-a716-446655440099",
    "status": "pending",
    "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "created_at": "2024-10-01T10:00:00Z",
    "estimated_review_time": "24 hours"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T10:00:00Z"
  }
}
```

**400 Bad Request** - Invalid evidence URL:
```json
{
  "success": false,
  "error": {
    "code": "invalid_evidence",
    "message": "Evidence URL is not from an allowed source",
    "details": {
      "url": "https://twitter.com/user/status/123",
      "allowed_sources": ["apple.com"]
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T10:00:00Z"
  }
}
```

**403 Forbidden** - Not a participant:
```json
{
  "success": false,
  "error": {
    "code": "not_participant",
    "message": "You must hold YES or NO tokens to submit a dispute",
    "details": {
      "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "user_address": "user_wallet_address"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T10:00:00Z"
  }
}
```

**409 Conflict** - Dispute window closed:
```json
{
  "success": false,
  "error": {
    "code": "dispute_window_closed",
    "message": "The 24-hour dispute window has ended",
    "details": {
      "dispute_window_ended": "2024-10-01T00:00:00Z"
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T10:00:00Z"
  }
}
```

---

### 4.1.6 Get Dispute Status

Get the status of a submitted dispute.

- **Method**: `GET`
- **Path**: `/api/v1/disputes/{dispute_id}`
- **Auth**: Required JWT (dispute submitter or admin)

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440099",
    "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "status": "reviewing",
    "reason": "The resolution source was checked before...",
    "evidence_urls": ["https://www.apple.com/newsroom/..."],
    "ai_review": null,
    "admin_review": null,
    "created_at": "2024-10-01T10:00:00Z",
    "resolved_at": null
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T10:00:00Z"
  }
}
```

---

## 4.2 Admin Endpoints

All admin endpoints require JWT with `admin` or `super_admin` role.

### 4.2.1 Ingest News

Manually ingest a news item for AI processing.

- **Method**: `POST`
- **Path**: `/api/v1/admin/ingest`
- **Auth**: Admin JWT

#### Request

```json
{
  "source": "manual",
  "url": "https://www.reuters.com/technology/apple-event-2024",
  "title": "Apple to announce new products in September event",
  "content": "Apple Inc said on Tuesday it will hold its annual fall event...",
  "published_at": "2024-08-15T10:00:00Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `source` | string | Yes | `manual`, `rss`, or source name |
| `url` | string | Yes | Valid HTTPS URL |
| `title` | string | Yes | 1-500 characters |
| `content` | string | Yes | 1-50000 characters |
| `published_at` | string | Yes | ISO 8601 datetime |

#### Response

**201 Created**:
```json
{
  "success": true,
  "data": {
    "news_id": "550e8400-e29b-41d4-a716-446655440088",
    "status": "ingested",
    "content_hash": "sha256:abc123..."
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-08-15T10:00:00Z"
  }
}
```

**409 Conflict** - Duplicate:
```json
{
  "success": false,
  "error": {
    "code": "duplicate_content",
    "message": "This news item has already been ingested",
    "details": {
      "existing_news_id": "550e8400-e29b-41d4-a716-446655440077",
      "content_hash": "sha256:abc123..."
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-08-15T10:00:00Z"
  }
}
```

---

### 4.2.2 List Proposals for Review

Get proposals that need human review.

- **Method**: `GET`
- **Path**: `/api/v1/admin/proposals`
- **Auth**: Admin JWT

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `needs_human` | Filter: `needs_human`, `pending`, `all` |
| `limit` | integer | 20 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor |

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "proposal_text": "Will the Fed raise interest rates?",
      "status": "needs_human",
      "category_hint": "finance",
      "draft_market": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Federal Reserve Interest Rate Decision",
        "confidence_score": 0.55,
        "resolution": { ... }
      },
      "validation_decision": {
        "status": "needs_human",
        "reason": "Ambiguous resolution criteria - multiple Fed meetings in timeframe",
        "evidence": [
          "Proposal does not specify which meeting",
          "Multiple rate decisions possible before expiry"
        ]
      },
      "created_at": "2024-06-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "has_more": false,
    "next_cursor": null
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.2.3 Review Proposal

Approve or reject a proposal that needs human review.

- **Method**: `POST`
- **Path**: `/api/v1/admin/proposals/{proposal_id}/review`
- **Auth**: Admin JWT

#### Request

```json
{
  "decision": "approve",
  "modifications": {
    "title": "Fed September 2024 Rate Decision",
    "resolution": {
      "exact_question": "Will the Federal Reserve raise the federal funds rate at the September 17-18, 2024 FOMC meeting?",
      "criteria": {
        "must_meet_all": [
          "Federal Reserve announces rate increase at September 17-18, 2024 FOMC meeting",
          "New target rate is higher than previous rate of 5.25-5.50%"
        ]
      },
      "expiry": "2024-09-18T23:59:59Z"
    }
  },
  "reason": "Clarified to specific FOMC meeting date"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `decision` | string | Yes | `approve` or `reject` |
| `modifications` | object | No | Partial market updates |
| `reason` | string | Yes | 10-1000 characters |

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "proposal_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "draft_market_id": "550e8400-e29b-41d4-a716-446655440001",
    "queued_for_publishing": true
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.2.4 List Disputes

Get disputes for admin review.

- **Method**: `GET`
- **Path**: `/api/v1/admin/disputes`
- **Auth**: Admin JWT

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `escalated` | Filter: `escalated`, `pending`, `reviewing`, `all` |
| `limit` | integer | 20 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor |

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440099",
      "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "market_title": "iPhone 16 Release by September 2024",
      "status": "escalated",
      "user_address": "user_wallet_address",
      "reason": "The resolution was incorrect...",
      "evidence_urls": ["https://..."],
      "original_result": "NO",
      "ai_review": {
        "decision": "escalate",
        "reasoning": "New evidence suggests timing discrepancy - requires human review",
        "reviewed_at": "2024-10-01T11:00:00Z"
      },
      "created_at": "2024-10-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 20,
    "has_more": false,
    "next_cursor": null
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T12:00:00Z"
  }
}
```

---

### 4.2.5 Review Dispute

Resolve an escalated dispute.

- **Method**: `POST`
- **Path**: `/api/v1/admin/disputes/{dispute_id}/review`
- **Auth**: Admin JWT

#### Request

```json
{
  "decision": "overturn",
  "new_result": "YES",
  "reason": "Evidence confirms iPhone 16 was released on September 20, 2024, before the deadline. Original resolution checked source too early."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `decision` | string | Yes | `uphold` or `overturn` |
| `new_result` | string | Conditional | Required if `overturn`: `YES` or `NO` |
| `reason` | string | Yes | 20-2000 characters |

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "dispute_id": "550e8400-e29b-41d4-a716-446655440099",
    "status": "overturned",
    "new_result": "YES",
    "tx_signature": "5wHu4nGQ2N...",
    "resolved_at": "2024-10-01T14:00:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T14:00:00Z"
  }
}
```

---

### 4.2.6 Get AI Configuration

Get current AI system configuration.

- **Method**: `GET`
- **Path**: `/api/v1/admin/ai-config`
- **Auth**: Admin JWT

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "ai_version": "ai_v1.0.0_gpt35_20240601",
    "llm_model": "gpt-3.5-turbo",
    "validation_confidence_threshold": 0.6,
    "categories": [
      "politics",
      "product_launch",
      "finance",
      "sports",
      "entertainment",
      "technology",
      "misc"
    ],
    "rate_limits": {
      "propose_per_minute": 3,
      "propose_per_hour": 20,
      "propose_per_day": 100,
      "dispute_per_hour": 5,
      "dispute_per_day": 20
    },
    "dispute_window_hours": 24,
    "max_retries": 3,
    "updated_at": "2024-06-01T00:00:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.2.7 Update AI Configuration

Update AI system configuration.

- **Method**: `PATCH`
- **Path**: `/api/v1/admin/ai-config`
- **Auth**: Admin JWT (super_admin for sensitive fields)

#### Request

```json
{
  "validation_confidence_threshold": 0.7,
  "rate_limits": {
    "propose_per_hour": 30
  }
}
```

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "updated_fields": ["validation_confidence_threshold", "rate_limits.propose_per_hour"],
    "ai_version": "ai_v1.0.0_gpt35_20240601"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

## 4.3 Worker Endpoints (Internal)

These endpoints are for internal worker communication. Workers authenticate using API keys to obtain short-lived JWTs.

> **Note**: Workers also have direct database access for reads. These endpoints are primarily for operations that require business logic validation or audit logging.

### 4.3.1 Get Worker Token

Exchange API key for short-lived JWT.

- **Method**: `POST`
- **Path**: `/api/v1/auth/worker-token`
- **Auth**: API key in header

#### Request

**Headers**:
```
Content-Type: application/json
X-Worker-API-Key: wk_abc123def456...
X-Worker-Type: generator
```

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-06-01T12:15:00Z",
    "worker_type": "generator",
    "permissions": ["read_candidates", "create_drafts", "call_llm"]
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

**401 Unauthorized**:
```json
{
  "success": false,
  "error": {
    "code": "invalid_api_key",
    "message": "Invalid or expired API key"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.3.2 Report Draft Generation

Worker reports a generated draft market.

- **Method**: `POST`
- **Path**: `/api/v1/worker/drafts`
- **Auth**: Worker JWT (generator)

#### Request

```json
{
  "candidate_id": "550e8400-e29b-41d4-a716-446655440010",
  "draft_market": {
    "title": "iPhone 16 Release by September 2024",
    "description": "...",
    "category": "product_launch",
    "confidence_score": 0.85,
    "resolution": { ... }
  },
  "llm_request_id": "chatcmpl-abc123"
}
```

#### Response

**201 Created**:
```json
{
  "success": true,
  "data": {
    "draft_market_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "created",
    "queued_for_validation": true
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.3.3 Report Validation Result

Worker reports validation decision.

- **Method**: `POST`
- **Path**: `/api/v1/worker/validations`
- **Auth**: Worker JWT (validator)

#### Request

```json
{
  "draft_market_id": "550e8400-e29b-41d4-a716-446655440001",
  "decision": "approved",
  "reason": "All criteria are clear and deterministic with verifiable sources",
  "evidence": [],
  "llm_request_id": "chatcmpl-def456"
}
```

#### Response

**201 Created**:
```json
{
  "success": true,
  "data": {
    "validation_id": "550e8400-e29b-41d4-a716-446655440020",
    "draft_market_id": "550e8400-e29b-41d4-a716-446655440001",
    "decision": "approved",
    "queued_for_publishing": true
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.3.4 Report Market Published

Worker reports successful on-chain market creation.

- **Method**: `POST`
- **Path**: `/api/v1/worker/markets/{draft_market_id}/published`
- **Auth**: Worker JWT (publisher)

#### Request

```json
{
  "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tx_signature": "5wHu4nGQ2N...",
  "initial_liquidity_usdc": 1000
}
```

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "market_id": "550e8400-e29b-41d4-a716-446655440001",
    "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "status": "active"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-06-01T12:00:00Z"
  }
}
```

---

### 4.3.5 Report Resolution Result

Worker reports market resolution.

- **Method**: `POST`
- **Path**: `/api/v1/worker/resolutions`
- **Auth**: Worker JWT (resolver)

#### Request

```json
{
  "market_id": "550e8400-e29b-41d4-a716-446655440001",
  "market_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "final_result": "YES",
  "resolution_source": "https://www.apple.com/shop/buy-iphone",
  "evidence_hash": "sha256:abc123...",
  "evidence_raw": "<html>...</html>",
  "must_meet_all_results": [
    {
      "condition": "iPhone 16 must be available for purchase on apple.com",
      "met": true,
      "evidence": "Found product listing with 'Buy' button"
    }
  ],
  "must_not_count_results": [
    {
      "condition": "Pre-order availability",
      "triggered": false
    }
  ],
  "tx_signature": "5wHu4nGQ2N...",
  "llm_request_id": "chatcmpl-ghi789"
}
```

#### Response

**201 Created**:
```json
{
  "success": true,
  "data": {
    "resolution_id": "550e8400-e29b-41d4-a716-446655440030",
    "market_id": "550e8400-e29b-41d4-a716-446655440001",
    "final_result": "YES",
    "status": "resolved",
    "dispute_window_ends": "2024-10-01T23:59:59Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-09-30T23:59:59Z"
  }
}
```

---

### 4.3.6 Report Dispute Review

Worker reports AI dispute review result.

- **Method**: `POST`
- **Path**: `/api/v1/worker/disputes/{dispute_id}/review`
- **Auth**: Worker JWT (dispute_agent)

#### Request

```json
{
  "decision": "escalate",
  "reasoning": "New evidence suggests timing discrepancy between source check and actual release. Requires human review to verify timestamps.",
  "llm_request_id": "chatcmpl-jkl012"
}
```

#### Response

**200 OK**:
```json
{
  "success": true,
  "data": {
    "dispute_id": "550e8400-e29b-41d4-a716-446655440099",
    "status": "escalated",
    "escalated_at": "2024-10-01T11:00:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-10-01T11:00:00Z"
  }
}
```

---

## Error Codes Reference

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `invalid_request` | Malformed request body or invalid parameters |
| 400 | `invalid_evidence` | Evidence URL not from allowed source |
| 400 | `unsafe_content` | Proposal contains forbidden content |
| 401 | `unauthorized` | Missing or invalid authentication |
| 401 | `invalid_api_key` | Worker API key invalid or expired |
| 401 | `token_expired` | JWT has expired |
| 403 | `forbidden` | Insufficient permissions for action |
| 403 | `not_participant` | User doesn't hold required tokens |
| 404 | `not_found` | Requested resource not found |
| 409 | `duplicate_content` | Content already exists |
| 409 | `dispute_window_closed` | Dispute window has ended |
| 409 | `already_resolved` | Market already resolved |
| 422 | `unprocessable_entity` | Request understood but cannot be processed |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Unexpected server error |
| 502 | `llm_error` | LLM service error |
| 503 | `service_unavailable` | Service temporarily unavailable |

---

## CORS Configuration

```typescript
// Allowed origins
const CORS_ORIGINS = [
  'https://app.x402.market',
  'https://staging.x402.market',
  process.env.NODE_ENV === 'development' && 'http://localhost:3000'
].filter(Boolean);

// CORS headers
{
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400
}
```
