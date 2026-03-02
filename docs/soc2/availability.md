# SOC2 Availability - Criteria A1

This file covers the AICPA Trust Services Criteria for Availability (A1). Every control
listed here can be evaluated by inspecting artifacts present in a Git repository: source
code, configuration files, CI/CD workflows, infrastructure-as-code, and documentation.
Controls requiring AWS console access, infrastructure monitoring dashboards, or
operational interviews are excluded.

---

## A1.1: Capacity Management

**1. A1.1 - Auto-scaling configuration in IaC**
- What to look for: Terraform or Helm values that configure auto-scaling for compute
  resources (e.g., `aws_appautoscaling_target`, `aws_autoscaling_group`,
  Kubernetes `HorizontalPodAutoscaler` manifests). Scaling thresholds and min/max
  replica counts should be defined.
- Example (Kubernetes HPA):
  ```yaml
  apiVersion: autoscaling/v2
  kind: HorizontalPodAutoscaler
  spec:
    minReplicas: 2
    maxReplicas: 10
    metrics:
      - type: Resource
        resource:
          name: cpu
          target:
            type: Utilization
            averageUtilization: 70
  ```
- Finding: No auto-scaling configuration found; workloads are defined with fixed replica
  counts only, with no mechanism to handle increased load.

**2. A1.1 - Resource requests and limits in Kubernetes manifests**
- What to look for: All Kubernetes `Deployment`, `StatefulSet`, and `Job` manifests
  define `resources.requests` and `resources.limits` for CPU and memory on every
  container. Missing limits allow a single pod to exhaust node resources and cause
  availability degradation.
- Example:
  ```yaml
  resources:
    requests:
      cpu: "250m"
      memory: "256Mi"
    limits:
      cpu: "1000m"
      memory: "512Mi"
  ```
- Finding: Container manifests found without resource requests/limits defined, risking
  resource exhaustion under load.

**3. A1.1 - SLA / SLO documentation**
- What to look for: A `docs/sla.md`, `docs/slo.md`, or equivalent file that defines
  uptime targets, error budget, and latency objectives for the system. Ideally, SLO
  definitions are also expressed as code (e.g., OpenSLO YAML files, Prometheus
  recording rules).
- Finding: No SLA or SLO documentation found in the repository. There is no documented
  uptime commitment auditors or customers can reference.

**4. A1.1 - Rate limiting in code or configuration**
- What to look for: Application code or API gateway configuration implements rate
  limiting to prevent a single consumer from exhausting capacity. Look for middleware,
  annotations, or IaC definitions referencing rate limits or throttling.
- Example (nginx config):
  ```
  limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
  limit_req zone=api burst=20 nodelay;
  ```
- Finding: No rate limiting configuration found in API gateway, ingress, or application
  middleware.

---

## A1.2: Environmental Protections and Recovery Infrastructure

**5. A1.2 - RTO and RPO documentation**
- What to look for: A `docs/disaster-recovery.md`, `docs/runbooks/recovery.md`, or
  equivalent that explicitly states Recovery Time Objective (RTO) and Recovery Point
  Objective (RPO) for each critical system component. These values should be tied to
  backup frequency and failover configuration in IaC.
- Finding: No RTO/RPO documentation found. Backup configuration in Terraform cannot
  be validated against stated recovery objectives.

**6. A1.2 - Database backup configuration in IaC**
- What to look for: Terraform resources for relational databases define a non-zero
  backup retention period and a backup window. For NoSQL stores, point-in-time recovery
  should be enabled. Cross-region replication configuration indicates geographic
  redundancy.
- Example (Terraform RDS):
  ```hcl
  resource "aws_db_instance" "main" {
    backup_retention_period    = 7
    backup_window              = "02:00-03:00"
    multi_az                   = true
    deletion_protection        = true
  }
  ```
- Finding: `backup_retention_period = 0` found on a production database resource, or
  `deletion_protection = false` on a database that handles production data.

**7. A1.2 - Multi-AZ / multi-region architecture in IaC**
- What to look for: Terraform resources reference multiple availability zones or regions.
  Kubernetes cluster configuration references multiple node groups spread across AZs.
  Load balancer or ingress configuration spreads traffic across multiple targets.
- Finding: All compute and database resources are defined in a single availability zone,
  creating a single point of failure.

**8. A1.2 - Graceful shutdown handling in application code**
- What to look for: Application entry points handle OS signals (`SIGTERM`, `SIGINT`)
  by draining in-flight requests before exiting. Look for signal handler registration
  and a configurable shutdown timeout. Kubernetes `terminationGracePeriodSeconds`
  should be set appropriately and match the application's drain timeout.
- Example (Go):
  ```go
  quit := make(chan os.Signal, 1)
  signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
  <-quit
  ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
  defer cancel()
  server.Shutdown(ctx)
  ```
- Example (Kubernetes):
  ```yaml
  spec:
    terminationGracePeriodSeconds: 60
  ```
- Finding: Application does not handle `SIGTERM`; Kubernetes will force-kill pods
  immediately, dropping in-flight requests during deployments or scaling events.

**9. A1.2 - Health check endpoints**
- What to look for: Application code exposes a `/health`, `/healthz`, or `/ready`
  endpoint. Kubernetes manifests reference this endpoint in `livenessProbe` and
  `readinessProbe` definitions. Docker Compose files include a `healthcheck` directive.
- Example (Kubernetes):
  ```yaml
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 15
  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 10
  ```
- Finding: No liveness or readiness probes configured; Kubernetes cannot detect
  unhealthy pods and will route traffic to failing instances.

**10. A1.2 - Circuit breaker patterns in code**
- What to look for: Source code uses a circuit breaker library (e.g., `resilience4j`,
  `pybreaker`, `gobreaker`, `polly`) when calling downstream services. HTTP client
  configuration includes timeouts and retry limits rather than infinite waits.
- Example (Go HTTP client):
  ```go
  client := &http.Client{
    Timeout: 10 * time.Second,
  }
  ```
- Finding: HTTP clients have no timeout configured (`http.Client{}` with default zero
  timeout), or no circuit breaker pattern is used for external service calls.

**11. A1.2 - Queue and async processing for availability decoupling**
- What to look for: IaC or application code uses message queues (SQS, RabbitMQ, Kafka)
  for non-synchronous workloads, decoupling producers from consumers and improving
  availability under load spikes.
- Finding: All operations are synchronous with no queue-based decoupling; downstream
  failures will cascade to the caller.

**12. A1.2 - Deployment strategy for zero-downtime releases**
- What to look for: Kubernetes `Deployment` manifests use `RollingUpdate` strategy with
  appropriate `maxSurge` and `maxUnavailable` values. CI/CD workflows use blue/green or
  canary deployment steps rather than in-place replacement.
- Example:
  ```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  ```
- Finding: Deployment strategy is `Recreate`, which causes downtime during every release,
  or `maxUnavailable: 100%` effectively terminates all pods before starting new ones.

---

## A1.3: Recovery Plan Testing

**13. A1.3 - Disaster recovery runbook**
- What to look for: A `docs/runbooks/disaster-recovery.md` or equivalent that describes
  step-by-step recovery procedures for each system component, references the RTO/RPO
  targets defined in A1.2, and specifies who is responsible for each step.
- Finding: No disaster recovery runbook found. Recovery procedures are not documented
  for auditors or on-call engineers.

**14. A1.3 - Backup restoration testing in CI or runbooks**
- What to look for: A CI workflow or documented runbook procedure that periodically
  tests restoring from backup. Automated restore tests should verify data integrity
  after restoration. Evidence could be a workflow file scheduled with `cron` that
  runs restore validation.
- Example (GitHub Actions scheduled workflow):
  ```yaml
  on:
    schedule:
      - cron: '0 3 * * 0'  # Weekly on Sunday at 03:00
  jobs:
    test-restore:
      runs-on: ubuntu-latest
      steps:
        - name: Restore from latest backup and verify integrity
          run: ./scripts/test-backup-restore.sh
  ```
- Finding: No backup restoration test workflow or runbook procedure found.

**15. A1.3 - Chaos engineering or resilience testing**
- What to look for: A chaos engineering tool configuration (e.g., `chaos-mesh` YAML
  experiments, `litmus` chaos workflows, `gremlin` configuration, `toxiproxy` test
  setup) or resilience test scripts in `tests/resilience/` or `tests/chaos/`.
  Documentation referencing planned chaos experiments.
- Finding: No chaos engineering configuration or resilience test scripts found in the
  repository.

**16. A1.3 - Database migration safety**
- What to look for: Database migration files (e.g., Flyway, Liquibase, Alembic,
  golang-migrate) are present and each migration is reversible (a corresponding
  `down` migration exists). CI workflow runs migrations against a test database before
  allowing merge to the default branch.
- Finding: Migration `down` scripts are missing, meaning rollback of a bad migration
  during an incident is not possible. Or migrations are not tested in CI.

**17. A1.3 - Incident response and on-call documentation**
- What to look for: `docs/runbooks/` directory containing on-call runbooks for common
  failure scenarios (database connection exhaustion, high error rate, disk full, etc.).
  Each runbook should list symptoms, diagnostic steps, and remediation actions.
- Finding: No on-call runbooks found. Engineers responding to incidents have no
  documented playbooks to follow.
