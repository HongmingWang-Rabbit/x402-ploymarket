# 13. Maintenance & Model Updates

This document describes procedures for maintaining the AI prediction market system, updating models/prompts, and ensuring long-term reliability.

---

## 13.1 AI Version Management

### Version Tracking

All AI-generated content is tagged with an `ai_version` stored in the `ai_config` database table:

```typescript
// Current ai_version format
"ai_v1.0.0_gpt35_20240601"

// Components:
// - ai_v1.0.0: System version
// - gpt35: Model identifier
// - 20240601: Date of last prompt update
```

### Database Storage

```sql
-- ai_config table stores the current version
SELECT * FROM ai_config WHERE key = 'ai_version';

-- All AI-generated records reference this version
SELECT ai_version, COUNT(*)
FROM ai_markets
GROUP BY ai_version;
```

### Version Update Process

```typescript
// scripts/update-ai-version.ts

async function updateAIVersion(newVersion: string, reason: string): Promise<void> {
  // 1. Validate version format
  if (!validateVersionFormat(newVersion)) {
    throw new Error('Invalid version format');
  }

  // 2. Update ai_config table
  await db.query(`
    UPDATE ai_config
    SET value = $1, updated_at = NOW(), updated_by = 'admin'
    WHERE key = 'ai_version'
  `, [newVersion]);

  // 3. Log the change
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, actor, details)
    VALUES ('ai_version_update', 'config', 'ai_version', 'admin', $1)
  `, [JSON.stringify({ old_version: oldVersion, new_version: newVersion, reason })]);

  // 4. Notify workers to refresh config
  await publishMessage('config.refresh', { key: 'ai_version' });
}
```

---

## 13.2 Prompt Updates

### Prompt Storage

Prompts are stored in the workers codebase and versioned with git:

```
workers/src/prompts/
├── market-generation.ts
├── validation.ts
├── entity-extraction.ts
├── dispute-review.ts
├── resolution.ts
└── safety-check.ts
```

### Update Procedure

1. **Modify prompt** in the appropriate file
2. **Test in staging** with representative inputs
3. **Update ai_version** to reflect prompt change
4. **Deploy** workers with new prompts
5. **Monitor** for quality changes

### A/B Testing Prompts

For significant prompt changes:

```typescript
// workers/src/shared/llm-client.ts

async function callLLMWithABTest(
  promptType: string,
  input: any,
  abTestId?: string
): Promise<LLMResponse> {
  // 10% traffic to new prompt (configurable)
  const useVariant = abTestId && Math.random() < 0.1;

  const promptVersion = useVariant ? 'variant' : 'control';
  const prompt = getPrompt(promptType, promptVersion);

  const result = await callLLM(prompt, input);

  // Log for analysis
  await logABTestResult({
    test_id: abTestId,
    prompt_type: promptType,
    variant: promptVersion,
    input_hash: hashInput(input),
    output_quality: result.confidence_score
  });

  return result;
}
```

---

## 13.3 Model Updates

### Current Model: gpt-3.5-turbo

The system is designed with model abstraction for future updates:

```typescript
// workers/src/shared/llm-client.ts

interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

const MODEL_CONFIGS: Record<string, LLMConfig> = {
  'gpt35': {
    model: 'gpt-3.5-turbo',
    temperature: 0.1,
    maxTokens: 2000,
    timeout: 30000
  },
  'gpt4': {
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 4000,
    timeout: 60000
  }
};

// Current model is configured in ai_config table
async function getCurrentModel(): Promise<string> {
  const result = await db.query(
    `SELECT value FROM ai_config WHERE key = 'llm_model'`
  );
  return result.rows[0]?.value || 'gpt35';
}
```

### Model Migration Procedure

1. **Add new model config** to `MODEL_CONFIGS`
2. **Test all prompts** with new model in staging
3. **Compare outputs** for quality and consistency
4. **Update `llm_model`** in `ai_config` table
5. **Update `ai_version`** to reflect model change
6. **Monitor** resolution accuracy and processing times

---

## 13.4 Schema Updates

### Migration Process

Schema changes require database migrations:

```typescript
// migrations/20240601_add_new_field.ts

export async function up(db: Pool): Promise<void> {
  await db.query(`
    ALTER TABLE ai_markets
    ADD COLUMN new_field VARCHAR(255)
  `);
}

export async function down(db: Pool): Promise<void> {
  await db.query(`
    ALTER TABLE ai_markets
    DROP COLUMN new_field
  `);
}
```

### TypeScript Type Updates

When schema changes:

1. Update types in `packages/shared-types/src/`
2. Rebuild shared-types: `pnpm --filter @x402/shared-types build`
3. Update dependent services
4. Deploy in order: shared-types → backend → workers → frontend

---

## 13.5 Rule Updates

### Updating Resolution Rules

Resolution rules can be updated for future markets without affecting existing ones:

```typescript
// Admin endpoint for rule template updates
// POST /api/v1/admin/rule-templates

interface RuleTemplateUpdate {
  category: MarketCategory;
  must_meet_all_defaults: string[];
  must_not_count_defaults: string[];
  source_patterns: {
    pattern: string;
    method: 'html_scrape' | 'api_check' | 'social_post';
  }[];
}
```

### Rule Validation

Before applying rule changes:

```typescript
async function validateRuleUpdate(rules: ResolutionRules): Promise<ValidationResult> {
  const issues: string[] = [];

  // Check sources are reachable
  for (const source of rules.criteria.allowed_sources) {
    const reachable = await checkUrlReachable(source.url);
    if (!reachable) {
      issues.push(`Source unreachable: ${source.url}`);
    }
  }

  // Check conditions are parseable
  for (const condition of rules.criteria.must_meet_all) {
    if (!isValidCondition(condition)) {
      issues.push(`Invalid condition: ${condition}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
```

---

## 13.6 System Maintenance

### Daily Tasks

- Monitor queue depths (should stay < 100)
- Check worker health endpoints
- Review error logs for anomalies
- Verify resolution jobs are running

### Weekly Tasks

- Review audit logs
- Check LLM API costs and usage
- Analyze resolution success rates
- Review markets flagged `needs_human`

### Monthly Tasks

- Rotate worker API keys
- Review and optimize database queries
- Analyze market quality metrics
- Update dependencies

### Quarterly Tasks

- Security audit
- Performance benchmarking
- Disaster recovery testing
- Documentation review

---

## 13.7 Monitoring Dashboards

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Queue backlog | < 50 | > 100 |
| LLM latency (p95) | < 5s | > 10s |
| Resolution success rate | > 95% | < 90% |
| Validation approval rate | 60-80% | < 40% or > 95% |
| Dispute rate | < 5% | > 10% |

### Grafana Dashboard Panels

1. **System Health**
   - Worker status (up/down)
   - Queue depths
   - Error rates

2. **AI Performance**
   - LLM latency histogram
   - Confidence score distribution
   - Validation outcomes pie chart

3. **Market Operations**
   - Markets created per day
   - Resolutions per day
   - Disputes per day

4. **Costs**
   - LLM API costs (daily/monthly)
   - Infrastructure costs

---

## 13.8 Human Review Workflow

### Markets Requiring Review

Markets are flagged `needs_human` when:
- Confidence score < 0.6
- Multiple validation issues
- Potentially sensitive topic
- Source verification failed

### Admin Review Process

1. **Access** `/admin/proposals` in frontend
2. **Review** draft market and validation details
3. **Modify** resolution rules if needed
4. **Decide**: Approve, Reject, or Request Changes
5. **Document** reason in audit log

### Review SLA

| Priority | Response Time |
|----------|---------------|
| High (active dispute) | 4 hours |
| Medium (needs_human) | 24 hours |
| Low (periodic audit) | 1 week |

---

## 13.9 Incident Response

### Incident Severity Levels

| Level | Description | Response |
|-------|-------------|----------|
| P1 | System down, no markets resolving | Immediate (15 min) |
| P2 | Partial outage, some workers down | 1 hour |
| P3 | Degraded performance | 4 hours |
| P4 | Minor issue, no user impact | 24 hours |

### Response Procedures

#### P1: System Down

1. Check infrastructure (DB, RabbitMQ)
2. Check worker logs for errors
3. Restart affected services
4. Verify recovery
5. Post-incident review

#### Resolution Failure

1. Check resolver worker logs
2. Verify allowed sources are reachable
3. Check LLM API status
4. Manual resolution if needed
5. Re-queue failed markets

---

## 13.10 Backup and Recovery

### Automated Backups

```bash
# Daily database backup (cron job)
0 2 * * * /scripts/backup-database.sh

# backup-database.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump $DATABASE_URL | gzip > /backups/db_${DATE}.sql.gz
aws s3 cp /backups/db_${DATE}.sql.gz s3://x402-backups/daily/
```

### Recovery Procedures

#### Database Recovery

```bash
# Download latest backup
aws s3 cp s3://x402-backups/daily/db_YYYYMMDD.sql.gz /tmp/

# Restore
gunzip /tmp/db_YYYYMMDD.sql.gz
psql $DATABASE_URL < /tmp/db_YYYYMMDD.sql
```

#### DLQ Recovery

```typescript
// scripts/reprocess-dlq.ts
async function reprocessDLQ(queueName: string): Promise<void> {
  const dlqName = `${queueName}.dlq`;

  let message;
  while ((message = await channel.get(dlqName, { noAck: false }))) {
    try {
      // Republish to original queue
      await channel.publish('', queueName, message.content, {
        persistent: true
      });
      channel.ack(message);
    } catch (error) {
      logger.error({ error, message }, 'Failed to reprocess DLQ message');
      channel.nack(message, false, false);
    }
  }
}
```

---

## 13.11 Configuration Management

### ai_config Table

All runtime configuration is stored in the database:

```sql
-- Current configuration
SELECT key, value, updated_at FROM ai_config;

-- Example entries:
-- ai_version: "ai_v1.0.0_gpt35_20240601"
-- llm_model: "gpt35"
-- validation_confidence_threshold: "0.6"
-- max_retries: "3"
-- dispute_window_hours: "24"
```

### Configuration Updates

```typescript
// POST /api/v1/admin/config
async function updateConfig(
  key: string,
  value: string,
  adminId: string
): Promise<void> {
  const oldValue = await getConfig(key);

  await db.query(`
    UPDATE ai_config
    SET value = $1, updated_at = NOW(), updated_by = $2
    WHERE key = $3
  `, [value, adminId, key]);

  await logAudit({
    action: 'config_update',
    entity_type: 'config',
    entity_id: key,
    actor: adminId,
    details: { old_value: oldValue, new_value: value }
  });

  // Notify workers to refresh
  await publishMessage('config.refresh', { key });
}
```

---

## 13.12 Deprecation Policy

### Deprecating AI Versions

When a new AI version is released:

1. New markets use new version immediately
2. Existing markets continue using their original version
3. Resolution uses the version stored with each market
4. Old versions supported for 6 months after deprecation

### API Deprecation

When deprecating API endpoints:

1. Add deprecation header: `Deprecation: true`
2. Log usage of deprecated endpoints
3. Notify users via changelog
4. Remove after 3 months with zero usage
