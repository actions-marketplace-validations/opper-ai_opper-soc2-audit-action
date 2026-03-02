# SOC2 Security - Common Criteria (CC1-CC9)

This file covers the AICPA Trust Services Criteria for Security (Common Criteria). Every
control listed here can be evaluated by inspecting artifacts present in a Git repository:
source code, configuration files, CI/CD workflows, infrastructure-as-code, dependency
manifests, and documentation. Controls that require interviewing people, reviewing AWS
console settings, examining org charts, or inspecting physical infrastructure are excluded.

---

## CC1: Control Environment

**1. CC1.1 - Code of conduct / security policy documentation**
- What to look for: A `SECURITY.md` file at the repository root, or a `docs/security/`
  directory containing a security policy, responsible disclosure policy, or code of conduct.
- Finding: No `SECURITY.md` and no security policy document found anywhere in the repository.

**2. CC1.4 - Onboarding and competency documentation**
- What to look for: `docs/` or `runbooks/` directories containing onboarding guides,
  architecture decision records (ADRs), or engineering standards documents.
- Finding: No onboarding documentation or engineering standards found in the repository.

**3. CC1.5 - Accountability through audit trail configuration**
- What to look for: Audit/structured logging is initialized in application source code
  (e.g., every HTTP request logged with user identity, action, and timestamp). Look for
  log middleware, correlation IDs, and structured log formatting in code.
- Finding: No structured audit logging middleware found in application code; request
  attribution (user ID, action) is absent from log statements.

---

## CC2: Communication and Information

**4. CC2.2 - Internal communication channels for security events**
- What to look for: Alerting configuration in CI/CD workflows (e.g., Slack/PagerDuty
  notifications on pipeline failure), or incident runbooks in `docs/runbooks/` describing
  how security events are escalated internally.
- Finding: No incident notification configuration found in workflow files and no runbook
  describing internal escalation paths.

**5. CC2.3 - External security contact**
- What to look for: `SECURITY.md` includes a contact email or link to a bug bounty program
  for external parties to report vulnerabilities. The file should be at the repository root.
- Finding: `SECURITY.md` is missing or does not include a responsible disclosure contact.

---

## CC3: Risk Assessment

**6. CC3.2 - Dependency vulnerability scanning**
- What to look for: A `dependabot.yml` or `renovate.json` file in `.github/` or the
  repository root configuring automated dependency update scanning. Alternatively, a
  CI step that runs `npm audit`, `pip-audit`, `trivy`, `snyk`, `govulncheck`, or
  equivalent.
- Example (`.github/dependabot.yml`):
  ```yaml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
  ```
- Finding: No Dependabot/Renovate configuration found and no dependency vulnerability
  scan step present in any workflow file.

**7. CC3.2 - Container image vulnerability scanning**
- What to look for: CI/CD workflow steps that scan Docker images using `trivy`, `grype`,
  `snyk container`, or similar tools before pushing to a registry.
- Example:
  ```yaml
  - name: Scan image
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: myapp:latest
      exit-code: '1'
      severity: 'CRITICAL,HIGH'
  ```
- Finding: No container image vulnerability scan step found in workflow files.

**8. CC3.4 - Infrastructure-as-code drift and change tracking**
- What to look for: Terraform, Helm, or other IaC files committed to the repository.
  Changes to these files should pass through the same PR review process as code.
  Look for a CI workflow that runs `terraform plan` or `helm diff` on PRs.
- Finding: No IaC files found in the repository, or IaC changes are not gated by CI
  validation.

---

## CC4: Monitoring Activities

**9. CC4.1 - Static application security testing (SAST)**
- What to look for: A CI/CD workflow step running a SAST tool such as CodeQL,
  Semgrep, Bandit (Python), gosec (Go), ESLint security plugin (JS), or Brakeman (Ruby).
  GitHub Advanced Security CodeQL analysis workflows are stored in `.github/workflows/`.
- Example:
  ```yaml
  - name: Initialize CodeQL
    uses: github/codeql-action/init@v3
    with:
      languages: python
  - name: Perform CodeQL Analysis
    uses: github/codeql-action/analyze@v3
  ```
- Finding: No SAST tool configured in any CI/CD workflow file.

**10. CC4.1 - Secret scanning**
- What to look for: GitHub Advanced Security secret scanning enabled (evidenced by a
  `.github/secret_scanning.yml` file, or references in workflow files). Pre-commit hooks
  running `detect-secrets`, `truffleHog`, or `gitleaks`. A `.gitleaks.toml` or
  `.secrets.baseline` file at the repository root.
- Example (`.pre-commit-config.yaml`):
  ```yaml
  repos:
    - repo: https://github.com/Yelp/detect-secrets
      rev: v1.4.0
      hooks:
        - id: detect-secrets
  ```
- Finding: No secret scanning configuration found (no `.secrets.baseline`,
  `.gitleaks.toml`, or pre-commit secret detection hook).

**11. CC4.2 - Automated security finding notifications**
- What to look for: Workflow steps that post results of security scans to GitHub Security
  tab (SARIF upload), create issues on failure, or send notifications to a Slack/Teams
  channel when scans find vulnerabilities.
- Example:
  ```yaml
  - name: Upload SARIF
    uses: github/codeql-action/upload-sarif@v3
    with:
      sarif_file: results.sarif
  ```
- Finding: Security scan results are not uploaded to the GitHub Security tab (no SARIF
  upload step).

---

## CC5: Control Activities

**12. CC5.2 - Pre-commit hooks**
- What to look for: A `.pre-commit-config.yaml` file at the repository root defining
  hooks for linting, secret detection, and security checks. A `Makefile` or
  `package.json` script that installs pre-commit hooks as part of dev setup.
- Example (`.pre-commit-config.yaml`):
  ```yaml
  repos:
    - repo: https://github.com/pre-commit/pre-commit-hooks
      rev: v4.5.0
      hooks:
        - id: detect-private-key
        - id: check-merge-conflict
    - repo: https://github.com/zricethezav/gitleaks
      rev: v8.18.0
      hooks:
        - id: gitleaks
  ```
- Finding: No `.pre-commit-config.yaml` found; no local gate prevents committing
  secrets or malformed configuration.

**13. CC5.3 - Branch protection and required reviews (CODEOWNERS)**
- What to look for: A `CODEOWNERS` file at the repository root or in `.github/` or
  `docs/` that assigns ownership of sensitive paths (e.g., `/.github/workflows/`,
  `/terraform/`, `/k8s/`). Branch protection rules are not directly readable from the
  repo, but CODEOWNERS signals that review requirements exist.
- Example (`CODEOWNERS`):
  ```
  /.github/workflows/   @security-team
  /terraform/           @platform-team
  /k8s/                 @platform-team
  ```
- Finding: No `CODEOWNERS` file found; no ownership is assigned to security-sensitive
  paths.

**14. CC5.3 - Pull request templates**
- What to look for: A `.github/pull_request_template.md` file that includes a security
  checklist (e.g., "Does this PR introduce new dependencies?", "Does this PR handle
  secrets correctly?", "Has this been tested?").
- Finding: No pull request template found; reviewers have no structured checklist to
  follow.

---

## CC6: Logical and Physical Access Controls

**15. CC6.1 - Secrets management - no hardcoded credentials**
- What to look for: Source code and configuration files must not contain hardcoded
  passwords, API keys, tokens, or private keys. Environment variables or secret manager
  references should be used instead. Check `.env.example` to confirm it uses placeholder
  values only. Verify `.gitignore` excludes `.env`, `*.pem`, `*.key`, and similar files.
- Example (`.gitignore`):
  ```
  .env
  .env.local
  *.pem
  *.key
  secrets/
  ```
- Finding: `.env` file not in `.gitignore`, or actual credential values found in source
  files or configuration files.

**16. CC6.1 - Encryption in transit enforced in code**
- What to look for: HTTP clients in source code use TLS (HTTPS endpoints, not HTTP).
  Server configuration files (nginx.conf, Caddyfile, etc.) redirect HTTP to HTTPS or
  enforce TLS. Kubernetes Ingress manifests specify TLS termination.
- Example (k8s Ingress):
  ```yaml
  tls:
    - hosts:
        - api.example.com
      secretName: tls-secret
  ```
- Finding: HTTP (non-TLS) endpoints referenced in configuration, or TLS not enforced
  in server configuration files.

**17. CC6.1 - Encryption at rest configuration**
- What to look for: Terraform resources for databases, object storage, and message queues
  specify encryption settings (e.g., `storage_encrypted = true` on RDS, `sse_algorithm`
  on S3 bucket, `encrypt_at_rest` on Elasticsearch). Kubernetes Secrets referenced
  rather than ConfigMaps for sensitive values.
- Example (Terraform):
  ```hcl
  resource "aws_db_instance" "main" {
    storage_encrypted = true
    kms_key_id        = var.kms_key_arn
  }
  ```
- Finding: Database or storage Terraform resources do not enable encryption at rest.

**18. CC6.1 - Least privilege in IaC IAM definitions**
- What to look for: Terraform IAM policies, Kubernetes RBAC manifests, or Helm values
  that follow least-privilege principles (no `*` actions on `*` resources, no
  `cluster-admin` ClusterRoleBindings for application service accounts).
- Example (bad pattern to flag):
  ```hcl
  actions   = ["*"]
  resources = ["*"]
  ```
- Finding: Overly permissive IAM policies (wildcard actions/resources) found in IaC files.

**19. CC6.2 - Multi-factor authentication enforcement**
- What to look for: CI/CD workflow files or Terraform configurations that enforce MFA
  for deployments (e.g., OIDC-based authentication, required MFA for sensitive
  environment workflows). Documentation or runbooks stating MFA is required for
  privileged access.
- Finding: No evidence of MFA enforcement for CI/CD access to production environments.

**20. CC6.3 - Role-based access control in application code**
- What to look for: Application source code implements authorization checks tied to
  roles or permissions before performing sensitive operations. Middleware or decorators
  that verify roles (e.g., `@require_role("admin")`, `authorize(ctx, "write:data")`).
- Finding: No authorization middleware or RBAC enforcement found in application code;
  endpoints appear to be accessible without role checks.

**21. CC6.6 - Network policy definitions**
- What to look for: Kubernetes `NetworkPolicy` manifests that restrict ingress/egress
  between pods. Terraform security group rules that follow deny-by-default with explicit
  allow rules. No `0.0.0.0/0` ingress rules on sensitive ports (databases, internal APIs).
- Example (bad pattern to flag in Terraform):
  ```hcl
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ```
- Finding: Database ports exposed to `0.0.0.0/0` in Terraform security group rules.

**22. CC6.7 - Data in transit protection (TLS version)**
- What to look for: Server configuration files, nginx/Apache configs, or Terraform
  listener definitions specify a minimum TLS version of 1.2 or higher, and disable
  weak cipher suites.
- Example (nginx):
  ```
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ```
- Finding: TLS 1.0 or 1.1 not explicitly disabled, or weak ciphers included.

**23. CC6.8 - Dependency pinning (supply chain integrity)**
- What to look for: Dependency manifests pin exact versions (not ranges) for production
  dependencies (`package-lock.json`, `poetry.lock`, `go.sum`, `Pipfile.lock`,
  `requirements.txt` with `==` versions). Docker base images reference a specific digest
  or version tag (not `latest`).
- Example (Dockerfile):
  ```dockerfile
  FROM python:3.12.3-slim@sha256:abc123...
  ```
- Finding: Dockerfile uses `FROM python:latest` or dependency file uses version ranges
  (`^1.0.0`) without a lockfile.

**24. CC6.8 - Software Bill of Materials (SBOM) generation**
- What to look for: A CI workflow step that generates an SBOM using `syft`, `cyclonedx`,
  or similar and attaches it as a build artifact or publishes it.
- Finding: No SBOM generation step found in CI/CD workflow files.

---

## CC7: System Operations

**25. CC7.1 - Configuration standards in IaC**
- What to look for: Terraform uses `tfsec`, `checkov`, or `terrascan` in CI to enforce
  configuration standards. Kubernetes manifests are validated with `kube-score`,
  `kubeconform`, or `polaris`. These tools should be run as CI steps on pull requests.
- Example:
  ```yaml
  - name: Run tfsec
    uses: aquasecurity/tfsec-action@v1.0.0
    with:
      soft_fail: false
  ```
- Finding: No IaC security scanner configured in CI workflow files.

**26. CC7.1 - Dockerfile security best practices**
- What to look for: Dockerfiles do not run as root (use `USER nonroot` or equivalent),
  do not use `--privileged` in compose files, specify explicit base image versions, and
  use multi-stage builds to minimize the attack surface.
- Example:
  ```dockerfile
  RUN addgroup --system app && adduser --system --group app
  USER app
  ```
- Finding: Dockerfile runs as root (no `USER` directive found), or privileged mode
  enabled in docker-compose.yml.

**27. CC7.2 - Logging and monitoring configuration in code**
- What to look for: Application code ships structured logs (JSON format) with severity
  levels. Logging configuration files (e.g., `log4j2.xml`, `logging.yml`,
  `logback.xml`) are present. CI/CD workflows configure log shipping to a central
  destination (CloudWatch, Datadog, Splunk).
- Finding: Logging uses unstructured plain text with no severity levels, or no logging
  configuration file found.

**28. CC7.3 - Security event detection in CI**
- What to look for: Workflow files include steps that fail the build on CRITICAL or HIGH
  severity findings from security scanners (non-zero exit codes block merges).
- Finding: Security scan steps use `continue-on-error: true` or `soft_fail: true`,
  meaning vulnerabilities do not block deployment.

**29. CC7.4 - Incident response runbooks**
- What to look for: `docs/runbooks/` or `docs/incident-response/` directory containing
  documented procedures for security incident handling (containment, escalation,
  communication, recovery). Files should reference roles, timelines, and communication
  channels.
- Finding: No incident response runbook found in the repository.

**30. CC7.5 - Post-incident review documentation**
- What to look for: A `docs/postmortems/` or `docs/post-incident/` directory containing
  post-mortem templates or completed post-mortems with root cause analysis and
  remediation action items.
- Finding: No post-mortem template or completed post-mortem documents found.

---

## CC8: Change Management

**31. CC8.1 - Required CI checks before merge**
- What to look for: Workflow files define required status checks. Branch protection
  is implied by the presence of CI workflows that run on pull requests targeting the
  default branch. All security scan, test, and lint jobs should be required.
- Example (workflow trigger):
  ```yaml
  on:
    pull_request:
      branches: [main]
  ```
- Finding: Security scan or test workflows only run on push to `main`, not on pull
  requests, meaning they cannot block merges.

**32. CC8.1 - Signed commits**
- What to look for: A `.gitconfig` or developer setup documentation requiring GPG or
  SSH commit signing. A `CONTRIBUTING.md` that instructs contributors to sign commits.
  A CI check that verifies commit signatures (e.g., using `git verify-commit`).
- Finding: No commit signing requirement documented or enforced via CI.

**33. CC8.1 - Automated testing coverage**
- What to look for: Test files present in the repository (directories named `tests/`,
  `test/`, `spec/`, `__tests__/`). A CI workflow step runs tests with a coverage
  threshold configured (e.g., `--cov-fail-under=80` for pytest, `--coverage` for Jest).
- Finding: No test directory found, or tests are present but CI does not enforce a
  minimum coverage threshold.

**34. CC8.1 - Staging/production environment separation**
- What to look for: CI/CD workflow files deploy to separate named environments
  (`staging`, `production`). Production deployments require manual approval (GitHub
  Actions `environment` with `required_reviewers` configuration) or are gated behind
  a separate workflow triggered only by tagged releases.
- Example:
  ```yaml
  environment:
    name: production
    url: https://api.example.com
  ```
- Finding: No environment separation in workflow files; all branches deploy directly
  to production without approval gates.

**35. CC8.1 - Change documentation (CHANGELOG)**
- What to look for: A `CHANGELOG.md` or `CHANGELOG/` directory documenting changes
  by version. Alternatively, release notes generated automatically from conventional
  commits in CI.
- Finding: No CHANGELOG found; changes are not documented for auditors or customers.

---

## CC9: Risk Mitigation

**36. CC9.1 - Backup and recovery configuration in IaC**
- What to look for: Terraform resources for databases enable automated backups
  (`backup_retention_period > 0` on RDS) and point-in-time recovery. Documentation
  references backup schedules and retention periods.
- Example:
  ```hcl
  resource "aws_db_instance" "main" {
    backup_retention_period = 7
    backup_window           = "03:00-04:00"
  }
  ```
- Finding: Database Terraform resources have `backup_retention_period = 0` (backups
  disabled).

**37. CC9.2 - Third-party dependency review**
- What to look for: A `DEPENDENCIES.md` or `docs/third-party/` document listing key
  third-party services and libraries with their data access level. Alternatively, a CI
  step using `pip-licenses`, `license-checker`, or `go-licenses` to audit dependency
  licenses.
- Finding: No third-party dependency documentation or license audit step found.

**38. CC9.2 - Vendor security assessment artifacts**
- What to look for: References to vendor SOC 2 reports or security questionnaire
  responses stored in `docs/vendor-assessments/` or referenced in a vendor registry
  document.
- Finding: No vendor security assessment documentation found in the repository.
