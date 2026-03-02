# SOC2 Processing Integrity - Criteria PI1

This file covers the AICPA Trust Services Criteria for Processing Integrity (PI1). Every
control listed here can be evaluated by inspecting artifacts present in a Git repository:
source code, test files, CI/CD workflows, configuration files, and documentation.
Controls requiring direct observation of running systems, runtime log analysis, or
operational interviews are excluded.

---

## PI1.1: Processing Definitions and Specifications

**1. PI1.1 - API specification documentation**
- What to look for: An OpenAPI/Swagger specification file (`openapi.yaml`,
  `swagger.json`, `openapi.json`) or equivalent (AsyncAPI for event-driven systems,
  GraphQL schema files) that formally defines inputs, outputs, data types, and
  constraints for each operation. The spec should be committed to the repository and
  kept up to date.
- Finding: No API specification file found in the repository. Processing inputs and
  outputs are not formally documented, making it impossible to verify that processing
  is complete and accurate against a defined specification.

**2. PI1.1 - Processing documentation in README or docs**
- What to look for: `README.md` or `docs/architecture.md` describes what the system
  does, what data it processes, and what outputs it produces. Data pipeline components
  should document their expected inputs, transformations applied, and output schema.
- Finding: No processing documentation found describing what the system processes or
  what the expected outputs are.

---

## PI1.2: Input Controls (Completeness and Accuracy)

**3. PI1.2 - Input validation in application code**
- What to look for: All external inputs (HTTP request bodies, query parameters, form
  data, file uploads, queue messages) are validated for type, format, range, and
  required fields before processing. Validation errors should return structured error
  responses rather than silently ignoring bad input. Look for validation libraries
  (e.g., Joi, Zod, Pydantic, `express-validator`, Bean Validation, `go-playground/validator`).
- Example (Python with Pydantic):
  ```python
  class CreateOrderRequest(BaseModel):
    product_id: UUID
    quantity: int = Field(gt=0, le=1000)
    currency: str = Field(regex=r'^[A-Z]{3}$')
  ```
- Finding: HTTP handler functions accept raw request body without schema validation;
  missing required fields or incorrect types are not rejected before processing.

**4. PI1.2 - Input validation tested in unit/integration tests**
- What to look for: Test files include test cases for invalid inputs: missing required
  fields, out-of-range values, wrong types, malformed identifiers. These tests assert
  that the system rejects invalid input with an appropriate error response.
- Finding: Test files only cover happy-path scenarios; no tests verify that invalid or
  malformed inputs are rejected.

**5. PI1.2 - Schema validation for data pipeline inputs**
- What to look for: Data pipeline code (ETL scripts, Spark jobs, Kafka consumers,
  Airflow DAGs) validates the schema of incoming records before processing. Records
  that fail schema validation are routed to a dead-letter queue or error table rather
  than silently dropped or processed incorrectly.
- Finding: Data pipeline code processes records without schema validation; corrupt or
  malformed records would be silently processed or dropped without logging.

**6. PI1.2 - Idempotency keys for critical operations**
- What to look for: Source code for operations that must not be duplicated (payment
  processing, order creation, email sending) uses idempotency keys. The API accepts
  a client-supplied idempotency key header and the server deduplicates requests using
  it. Database inserts for these operations use unique constraints or conditional
  writes.
- Example:
  ```python
  # Handler checks idempotency key before processing
  idempotency_key = request.headers.get("Idempotency-Key")
  if idempotency_key:
    existing = db.get_idempotent_result(idempotency_key)
    if existing:
      return existing
  ```
- Finding: Payment or order creation endpoints do not implement idempotency keys;
  network retries could result in duplicate charges or duplicate records.

---

## PI1.3: Processing Controls

**7. PI1.3 - Error handling in processing code**
- What to look for: Processing functions handle errors explicitly rather than relying
  on unhandled exception propagation. Errors are logged with sufficient context (input
  reference, error type, timestamp) to enable investigation. Critical processing errors
  trigger alerts rather than silently failing.
- Patterns to flag:
  - `except Exception: pass` (silently swallows errors)
  - `catch (e) {}` (empty catch blocks in JavaScript/TypeScript)
  - Functions that return `null` on error without logging
- Finding: Empty catch blocks or bare `pass` statements found in critical processing
  paths; errors are silently swallowed rather than logged and alerted.

**8. PI1.3 - Transaction integrity in database code**
- What to look for: Database operations that must be atomic (multi-table updates,
  financial transfers, state transitions) are wrapped in database transactions.
  ORM usage should use explicit transaction blocks for multi-step operations.
- Example (Python SQLAlchemy):
  ```python
  with db.begin():
    debit_account(source, amount)
    credit_account(destination, amount)
    record_transaction(source, destination, amount)
  ```
- Finding: Multi-step database operations are not wrapped in transactions; a failure
  partway through would leave data in an inconsistent state.

**9. PI1.3 - Data pipeline processing completeness checks**
- What to look for: Data pipeline code records the number of records received, processed
  successfully, and failed. Reconciliation checks compare source record counts to
  destination record counts. Scripts that move data between systems include a
  post-transfer count validation step.
- Finding: No reconciliation or count validation found in data pipeline code; partial
  processing failures would not be detected.

**10. PI1.3 - Audit trail for data modifications**
- What to look for: Application code writes an audit log entry for every create, update,
  and delete operation on records containing business-critical or regulated data. The
  audit log records the entity ID, the user performing the action, the timestamp, the
  operation type, and optionally the before/after values. Database schema may include
  an `audit_log` table or triggers.
- Finding: No audit logging found for data modification operations; it is not possible
  to reconstruct the history of changes to critical records.

**11. PI1.3 - Checksums or hashes for data integrity**
- What to look for: Files transferred between systems (batch uploads, data exports,
  inter-service file transfers) include a checksum (MD5, SHA-256) that is verified
  after transfer. Application code or scripts verify checksums before processing
  imported data.
- Finding: No checksum generation or verification found for file-based data transfers;
  file corruption during transfer would not be detected.

**12. PI1.3 - Retry logic with exponential backoff**
- What to look for: Code that calls external services or processes jobs from queues
  implements retry logic with exponential backoff and a maximum retry limit. Dead-letter
  queues capture messages that exhaust retries for manual review.
- Example:
  ```python
  @retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
  )
  def call_external_service(payload):
    ...
  ```
- Finding: No retry logic found for external service calls; transient failures cause
  permanent data processing failures without any recovery mechanism.

---

## PI1.4: Output Controls

**13. PI1.4 - Output validation before delivery**
- What to look for: Application code validates the structure and content of outputs
  before sending them to clients or downstream systems. API responses are serialized
  through a schema (e.g., Pydantic model, Marshmallow schema, protobuf definition)
  that enforces output completeness and type correctness.
- Finding: API handlers return raw database model objects or dictionaries without output
  schema validation; incomplete or malformed responses could be delivered to clients.

**14. PI1.4 - Access control on output delivery**
- What to look for: Output delivery endpoints verify that the requesting principal is
  authorized to receive the specific output (not just authenticated). Multi-tenant
  systems must verify tenant isolation before returning data.
- Finding: Output endpoints return data based only on authentication (who the caller is)
  without verifying authorization (whether that caller is entitled to this specific
  record).

**15. PI1.4 - Output delivery audit trail**
- What to look for: Application code logs when data is exported, downloaded, or
  transmitted to an external party, including the recipient identity, the data
  reference, the timestamp, and the output format.
- Finding: No logging found for data export or transmission operations; it is not
  possible to determine what data was sent to whom.

**16. PI1.4 - Report generation tests**
- What to look for: Unit or integration tests verify that generated reports, exports,
  or output files contain the expected records, correct calculations, and proper
  formatting. Tests should include edge cases (empty datasets, maximum record counts,
  special characters in data).
- Finding: No tests found for report generation or data export functionality.

---

## PI1.5: Storage Integrity Controls

**17. PI1.5 - Database schema migrations tracked in version control**
- What to look for: All database schema changes are managed through a migration tool
  (Flyway, Liquibase, Alembic, golang-migrate, Prisma Migrate) with migration files
  committed to the repository in sequential order. Each migration file is immutable
  once merged to the default branch.
- Finding: No database migration files found in the repository; schema changes are
  applied manually without version control, making it impossible to audit the history
  of schema evolution.

**18. PI1.5 - Migration rollback scripts**
- What to look for: Each forward migration (`up`) has a corresponding rollback
  migration (`down`) that restores the schema to its previous state. CI workflow
  tests both the up and down migrations against a test database.
- Finding: Only `up` migrations exist with no `down` counterparts; rolling back a
  failed schema change during an incident requires manual, error-prone intervention.

**19. PI1.5 - Soft-delete vs hard-delete consistency**
- What to look for: The codebase consistently applies either soft-delete (logical
  deletion flag) or hard-delete for each entity type, and the approach is documented.
  If soft-delete is used, queries consistently filter out deleted records using a
  global scope or query builder default. The absence of this filter in a query should
  be explicit and intentional.
- Finding: Some queries include the `deleted_at IS NULL` filter while others do not,
  creating risk that logically deleted records are included in processing results.

**20. PI1.5 - Encryption of stored processing records**
- What to look for: Terraform resources for storage backing processing records
  (databases, object stores, queues) enable encryption at rest. Application-level
  encryption is used for particularly sensitive fields (e.g., column-level encryption
  for SSNs or health data).
- Finding: No encryption at rest configured for storage resources containing business
  processing records.

**21. PI1.5 - Data pipeline tests in CI**
- What to look for: CI workflow runs automated tests for data pipeline code before
  merge. Tests verify that transformation logic produces correct outputs for known
  inputs, including edge cases (null values, type coercions, boundary conditions).
- Finding: Data pipeline code is not covered by automated tests in CI; correctness of
  processing logic is unverified before deployment.
