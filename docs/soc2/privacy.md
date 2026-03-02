# SOC2 Privacy - Criteria P1-P8

This file covers the AICPA Trust Services Criteria for Privacy (P1-P8). Every control
listed here can be evaluated by inspecting artifacts present in a Git repository: source
code, configuration files, CI/CD workflows, documentation, and infrastructure-as-code.
Controls requiring live database queries, reviewing executed consent records, or
organizational process interviews are excluded.

---

## P1: Notice

**1. P1.1 - Privacy notice linked from application code or documentation**
- What to look for: Application source code includes a reference to a privacy policy
  URL (e.g., in sign-up flows, API terms, consent dialogs). A `docs/privacy-policy.md`
  or equivalent exists in the repository, or the README links to the hosted privacy
  policy. The policy document covers: what data is collected, purpose, retention,
  disclosure, and data subject rights.
- Finding: No privacy policy document found in the repository and no reference to one
  in application code or documentation.

**2. P1.1 - Privacy notice version tracking**
- What to look for: The privacy policy document includes a `Last Updated` date and/or
  a version number. If stored in the repository, its history is tracked via Git commits.
  Application code that displays the notice references a version identifier so that
  consent can be re-collected when the notice changes.
- Finding: Privacy policy has no version or date field; auditors cannot determine when
  it was last reviewed or whether users were notified of changes.

---

## P2: Choice and Consent

**3. P2.1 - Consent capture in application code**
- What to look for: Application code contains a consent capture flow before collecting
  personal information. The consent record should include: user identifier, timestamp,
  consent purpose, and the version of the privacy notice accepted. Consent state should
  be stored in a database model or schema that is visible in the codebase.
- Example (schema):
  ```sql
  CREATE TABLE consent_records (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    purpose     TEXT NOT NULL,
    notice_ver  TEXT NOT NULL,
    granted_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
  );
  ```
- Finding: No consent capture logic found in application code; user agreement to data
  processing is not recorded in a verifiable way.

**4. P2.1 - Consent withdrawal (opt-out) mechanism**
- What to look for: Application code implements an endpoint or flow that allows users
  to withdraw consent or opt out of data processing. The withdrawal sets a revocation
  timestamp in the consent record and triggers downstream effects (stopping marketing
  emails, disabling analytics tracking, etc.).
- Finding: No consent withdrawal mechanism found in source code; users have no
  programmatic way to revoke consent.

**5. P2.1 - Consent check enforcement in code**
- What to look for: Functions or middleware that perform personal data processing
  (analytics, marketing, profiling) check that a valid, unrevoked consent record exists
  for the user before executing. Consent checks should gate non-essential processing,
  not just essential processing.
- Finding: No consent check found before non-essential data processing operations;
  data may be processed regardless of consent status.

---

## P3: Collection

**6. P3.1 - Data minimization evident in code**
- What to look for: Data models and API request schemas collect only fields necessary
  for the stated purpose. Optional fields that are collected but never used are a
  data minimization finding. Database migration files should not add PII columns
  without a documented purpose.
- Finding: User registration schema collects fields (e.g., date of birth, phone number,
  physical address) with no corresponding business logic that uses them, indicating
  data is collected beyond the stated purpose.

**7. P3.1 - PII not collected in logs**
- What to look for: Application logging code does not write raw PII (email addresses,
  names, phone numbers, IP addresses in certain jurisdictions, health data) to log
  output. Structured log fields that could contain PII should be masked or hashed.
- Patterns to flag:
  - `logger.info(f"User registered: email={user.email}")`
  - Logging full HTTP request headers that include `Authorization` or `Cookie`
  - Logging raw query strings that may contain user-submitted PII
- Finding: Email addresses or other PII found in log statements without masking.

**8. P3.2 - Explicit consent enforced for sensitive data collection**
- What to look for: Collection of special category data (health, biometric, racial or
  ethnic origin, political opinions, religious beliefs, sexual orientation) is gated
  behind an explicit consent step in application code. The consent record for sensitive
  data is stored separately and linked to a specific, granular purpose.
- Finding: Health or biometric data is collected without a separate, explicit consent
  check distinguishing it from general consent.

---

## P4: Use, Retention, and Disposal

**9. P4.1 - Purpose limitation in code**
- What to look for: Personal data collected for one purpose (e.g., order fulfillment)
  is not passed to functions or modules serving a different purpose (e.g., marketing
  analytics) without a corresponding consent check. Look for data being shared across
  service boundaries or passed to third-party SDKs without purpose validation.
- Finding: User PII passed directly to third-party analytics or advertising SDK calls
  without a consent check specific to that purpose.

**10. P4.2 - Data retention periods defined and implemented**
- What to look for: A `docs/data-retention.md` specifies retention periods for each
  category of personal data. IaC (Terraform S3 lifecycle rules, DynamoDB TTL
  configuration) or application-level cron jobs/scheduled tasks implement automatic
  expiry aligned with those periods.
- Example (DynamoDB TTL in Terraform):
  ```hcl
  resource "aws_dynamodb_table" "user_sessions" {
    ttl {
      attribute_name = "expires_at"
      enabled        = true
    }
  }
  ```
- Finding: No retention period defined in documentation, or no automated expiry
  mechanism configured in IaC or application code.

**11. P4.3 - Secure deletion code paths**
- What to look for: Deletion functions in application code perform hard deletes
  (permanent removal) rather than only soft deletes for data subject to retention
  policy or data subject requests. For encrypted data, the deletion function may
  destroy the encryption key (cryptographic erasure). Delete operations should be
  logged for audit purposes.
- Finding: All delete operations set a `deleted_at` flag without permanently removing
  data; no permanent deletion code path exists, making it impossible to fulfill
  erasure requests.

**12. P4.3 - Anonymization and pseudonymization utilities**
- What to look for: Source code contains utility functions for anonymizing or
  pseudonymizing personal data (e.g., replacing real email with hashed equivalent,
  zeroing out name fields, replacing IP with a subnet). These are used in test data
  generation, data exports, and staging environment setup.
- Finding: No anonymization utilities found; personal data is used in full in test
  datasets and non-production environments.

---

## P5: Access (Data Subject Access Requests)

**13. P5.1 - DSAR (Data Subject Access Request) handling code**
- What to look for: Application code or scripts implement a DSAR workflow: an endpoint
  or process that accepts a request, verifies the requestor's identity, queries all
  stores for the user's personal data, and assembles a response package. The workflow
  should be documented in `docs/runbooks/dsar.md` or equivalent.
- Finding: No DSAR handling code or runbook found; the organization has no automated
  or documented process for responding to subject access requests.

**14. P5.1 - Identity verification before data access**
- What to look for: The DSAR workflow or personal data access endpoint requires strong
  identity verification before returning personal data. This should be more than a
  simple session cookie check (e.g., re-authentication, email confirmation loop,
  support ticket with identity proof).
- Finding: Personal data access endpoint relies only on session authentication without
  additional identity verification, allowing any logged-in session to retrieve personal
  data without proof of identity.

**15. P5.2 - Data correction/amendment endpoint**
- What to look for: Application code provides an endpoint or admin workflow for
  correcting personal data upon a data subject's request. Changes should be logged
  with the requestor identity, timestamp, and fields changed.
- Finding: No data correction endpoint or administrative workflow found for amending
  personal data records on behalf of a data subject.

---

## P6: Disclosure and Notification

**16. P6.1 - Third-party data sharing gated on consent**
- What to look for: Application code that transmits personal data to third-party
  services (analytics, CRM, advertising, support tools) checks consent status before
  the transmission. Look for consent checks immediately before SDK calls or API calls
  to third parties.
- Finding: User data is sent to third-party analytics or marketing services without
  a consent check; data is shared regardless of user preferences.

**17. P6.2 - Disclosure audit log**
- What to look for: Application code logs each disclosure of personal data to a third
  party, including: the recipient service name, the data categories shared, the legal
  basis (consent ID or legitimate interest reference), and the timestamp.
- Finding: No disclosure logging found; there is no audit trail of what personal data
  was shared with which third parties.

**18. P6.3 - Unauthorized disclosure / breach detection patterns**
- What to look for: CI/CD workflows or application code include mechanisms to detect
  accidental data exposure: secret scanning prevents credentials from being pushed,
  SAST tools flag code that writes PII to public locations, and monitoring
  configuration alerts on unexpected data access patterns.
- Finding: No breach detection patterns found in code or workflow configuration;
  accidental disclosure would not be programmatically detected.

**19. P6.6 - Breach notification runbook**
- What to look for: `docs/runbooks/breach-notification.md` or equivalent that describes
  the steps to take when a data breach is detected: who to notify internally, timeline
  for regulator notification (72 hours under GDPR), template communications for
  affected individuals, and the evidence to preserve.
- Finding: No breach notification runbook found; the organization has no documented
  procedure for notifying regulators and data subjects in the event of a breach.

**20. P6.4 / P6.5 - Vendor data processing agreements referenced**
- What to look for: `docs/vendor-assessments/` or a `docs/data-processors.md` that
  lists third-party processors of personal data, what data each processor receives,
  and confirms a Data Processing Agreement (DPA) is in place. References to DPAs
  for key vendors (cloud provider, email provider, analytics platform).
- Finding: No vendor data processor list found; auditors cannot confirm DPAs are in
  place for all third parties that process personal data.

---

## P7: Quality

**21. P7.1 - Input validation ensures personal data accuracy at collection**
- What to look for: Registration and data collection forms/APIs validate personal
  data fields for format correctness: email addresses validated with a proper regex
  or library, phone numbers validated for format, dates validated for plausibility.
  Validation errors return informative messages that help users correct data.
- Finding: Personal data fields accepted without format validation; users can submit
  malformed email addresses or nonsensical date values that corrupt data quality.

**22. P7.1 - Data quality tests for personal data pipelines**
- What to look for: Test files include data quality assertions for pipelines that
  process personal data: checks for null required fields, duplicate record detection,
  referential integrity checks (user ID exists before creating a personal data record).
- Finding: No data quality tests found for personal data handling code paths.

---

## P8: Monitoring and Enforcement

**23. P8.1 - Privacy complaint intake endpoint or documentation**
- What to look for: Application code includes a contact endpoint, form, or documented
  process (in `SECURITY.md`, `docs/privacy.md`, or README) for data subjects to submit
  privacy complaints or inquiries. The contact mechanism should be clearly described
  and monitored.
- Finding: No privacy inquiry or complaint mechanism found in the codebase or
  documentation.

**24. P8.1 - Privacy compliance checks in CI**
- What to look for: CI/CD workflow includes steps that enforce privacy-relevant checks:
  secret scanning (to prevent credential exposure), dependency scanning for known
  vulnerabilities in libraries handling personal data, or SAST rules that detect
  logging of PII.
- Finding: No privacy-relevant automated checks in CI/CD workflow files.

**25. P8.1 - Privacy impact assessment documentation**
- What to look for: `docs/` contains a Privacy Impact Assessment (PIA) or Data
  Protection Impact Assessment (DPIA) for high-risk processing activities (profiling,
  large-scale processing of sensitive data, systematic monitoring). New features
  involving personal data should reference whether a DPIA was conducted.
- Finding: No PIA/DPIA documentation found in the repository for any processing
  activity.
