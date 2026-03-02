# SOC2 Confidentiality - Criteria C1

This file covers the AICPA Trust Services Criteria for Confidentiality (C1). Every control
listed here can be evaluated by inspecting artifacts present in a Git repository: source
code, configuration files, CI/CD workflows, infrastructure-as-code, and documentation.
Controls requiring direct inspection of storage systems, database queries against live data,
or organizational process reviews are excluded.

---

## C1.1: Identification and Maintenance of Confidential Information

**1. C1.1 - Data classification documentation**
- What to look for: A `docs/data-classification.md` or equivalent document that defines
  data sensitivity tiers (e.g., Public, Internal, Confidential, Restricted) and provides
  examples of what falls into each category. The document should state handling
  requirements for each tier (encryption, access controls, retention).
- Finding: No data classification documentation found. Without defined categories,
  engineers have no guidance on how to handle sensitive data in code or configuration.

**2. C1.1 - Data flow documentation**
- What to look for: A `docs/data-flow.md`, architecture diagram, or equivalent that maps
  where confidential data (PII, credentials, financial data, health data) enters the
  system, how it is processed, where it is stored, and to whom it is transmitted. This
  can be a Markdown file with a Mermaid diagram.
- Example (Mermaid in Markdown):
  ```mermaid
  flowchart LR
    Client -->|HTTPS| API
    API -->|encrypted| DB[(PostgreSQL)]
    API -->|tokenized| ThirdParty[Payment Processor]
  ```
- Finding: No data flow documentation found; auditors cannot determine where
  confidential data resides or how it moves through the system.

**3. C1.1 - Secrets not stored in source code**
- What to look for: Source code, configuration files, and IaC files do not contain
  hardcoded secrets (passwords, API keys, tokens, private keys, connection strings with
  credentials). Environment variable references or secret manager lookups should be used.
  Check `.env.example` to confirm it uses only placeholder values.
- Patterns to flag:
  - `password = "..."` in any non-test source file
  - `api_key = "sk-..."` or similar
  - Connection strings with embedded credentials: `postgres://user:password@host/db`
  - Private key material (`-----BEGIN RSA PRIVATE KEY-----`)
- Finding: Hardcoded credential or secret value found in source code or configuration.

**4. C1.1 - `.gitignore` excludes sensitive files**
- What to look for: `.gitignore` at the repository root explicitly excludes files likely
  to contain confidential information: `.env`, `.env.*` (except `.env.example`), `*.pem`,
  `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `credentials.json`, `secrets/`.
- Example (`.gitignore` entries):
  ```
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
  *.p12
  id_rsa
  secrets/
  credentials.json
  ```
- Finding: `.env` or private key file extensions are not excluded in `.gitignore`,
  creating risk that confidential files are accidentally committed.

**5. C1.1 - Encryption of confidential data in IaC**
- What to look for: Terraform resources for databases, object storage, message queues,
  and caches specify encryption at rest. KMS key references should use customer-managed
  keys rather than default service keys where required by classification policy.
- Example:
  ```hcl
  resource "aws_s3_bucket_server_side_encryption_configuration" "confidential" {
    bucket = aws_s3_bucket.confidential.id
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm     = "aws:kms"
        kms_master_key_id = var.kms_key_arn
      }
    }
  }
  ```
- Finding: S3 buckets, RDS instances, or other storage resources in Terraform do not
  have server-side encryption enabled.

**6. C1.1 - TLS enforced for confidential data in transit**
- What to look for: HTTP clients in application code use HTTPS endpoints. Server
  configuration files (nginx, Caddy, Traefik) redirect HTTP to HTTPS. Terraform load
  balancer listeners redirect port 80 to 443. TLS minimum version is 1.2 or higher.
- Example (Terraform ALB listener):
  ```hcl
  resource "aws_lb_listener" "http_redirect" {
    port     = "80"
    protocol = "HTTP"
    default_action {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
  ```
- Finding: HTTP listener does not redirect to HTTPS, or Terraform resources allow
  unencrypted communication paths for confidential data.

**7. C1.1 - DLP patterns - PII not logged**
- What to look for: Application logging code does not log sensitive fields such as
  passwords, full credit card numbers, SSNs, or unmasked email addresses in log
  statements. Look for log sanitization utilities, field redaction middleware, or
  documented conventions that exclude PII from logs.
- Patterns to flag:
  - `log.info("User password: {}", password)`
  - Logging entire request bodies that may contain PII without redaction
  - Logging JWT tokens or session tokens in full
- Finding: Log statements found that include plaintext passwords, full PAN data, or
  unredacted PII fields.

**8. C1.1 - Access control enforcement for confidential data paths**
- What to look for: Application routes or functions that handle confidential data
  require authentication and authorization checks. API endpoints serving confidential
  data must verify the caller's identity and permissions before returning data.
- Finding: Endpoints returning confidential data do not check authentication tokens or
  role membership before responding.

**9. C1.1 - Kubernetes Secrets used (not ConfigMaps) for sensitive values**
- What to look for: Sensitive configuration values (database passwords, API keys) are
  referenced via Kubernetes `Secret` objects, not `ConfigMap`. Helm values files use
  `secretKeyRef` for sensitive values, not `configMapKeyRef`.
- Example:
  ```yaml
  env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
  ```
- Finding: Sensitive values such as database passwords found in `ConfigMap` definitions
  or passed as plain environment variable literals in pod specs.

**10. C1.1 - Dependency license compliance for confidential data libraries**
- What to look for: A CI step or script audits the licenses of dependencies used to
  handle confidential data, ensuring no GPL-licensed libraries are used in commercial
  proprietary systems without review.
- Finding: No license audit step found in CI; licenses of dependencies handling
  confidential data are unreviewed.

---

## C1.2: Disposal of Confidential Information

**11. C1.2 - Data retention policy documentation**
- What to look for: A `docs/data-retention.md` or equivalent document that specifies
  how long each category of confidential data is retained and what happens when retention
  expires (deletion, anonymization, archival). Retention periods should align with legal
  and contractual obligations.
- Finding: No data retention policy document found in the repository.

**12. C1.2 - Automated retention and expiry in IaC**
- What to look for: Terraform resources for object storage define lifecycle rules that
  expire objects after the documented retention period. Database Terraform resources
  configure automated backups with a bounded retention period (not indefinite).
- Example (Terraform S3 lifecycle):
  ```hcl
  resource "aws_s3_bucket_lifecycle_configuration" "retention" {
    bucket = aws_s3_bucket.confidential_data.id
    rule {
      id     = "expire-confidential-data"
      status = "Enabled"
      expiration {
        days = 365
      }
    }
  }
  ```
- Finding: No lifecycle rules on S3 buckets storing confidential data, or database
  backup retention is set to indefinite.

**13. C1.2 - Secure deletion patterns in application code**
- What to look for: Application code that handles deletion requests overwrites or
  cryptographically erases confidential data rather than only setting a soft-delete
  flag. Hard-delete database functions exist alongside or instead of soft-delete for
  data subject to retention policy. For cryptographic erasure, the application destroys
  the encryption key associated with the data record.
- Finding: All deletion operations in the codebase are soft-delete (setting an
  `is_deleted` flag) with no mechanism to permanently erase the underlying data,
  making it impossible to fulfill data disposal requirements.

**14. C1.2 - Log retention limits for confidential data in logs**
- What to look for: Logging configuration (e.g., `logrotate.conf`, `logging.yml`,
  FluentBit config, CloudWatch log group Terraform resource) sets a bounded retention
  period for logs that may contain confidential information.
- Example (Terraform CloudWatch log group):
  ```hcl
  resource "aws_cloudwatch_log_group" "app" {
    name              = "/app/production"
    retention_in_days = 90
  }
  ```
- Finding: Log group retention is set to `0` (never expire), meaning confidential data
  potentially present in logs is retained indefinitely.

**15. C1.2 - Media and object disposal references in runbooks**
- What to look for: `docs/runbooks/` contains a procedure for decommissioning storage
  resources (databases, S3 buckets, EBS volumes) that verifies confidential data is
  erased before disposal. The runbook should reference secure deletion steps for each
  storage type.
- Finding: No decommissioning runbook found; there is no documented procedure to ensure
  confidential data is erased when storage resources are retired.

**16. C1.2 - Tokenization or masking of confidential data in non-production environments**
- What to look for: Documentation or scripts that describe how production data is
  anonymized or masked before being loaded into development or staging environments.
  Look for data masking scripts in `scripts/`, references to anonymization tools, or
  IaC that provisions non-production environments with synthetic data only.
- Finding: No data masking or anonymization procedure found for non-production
  environments; production confidential data may be accessible to developers without
  a need-to-know.
