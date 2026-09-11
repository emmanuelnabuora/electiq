# ElectIQ — minimal infrastructure-as-code skeleton (AWS)
#
# Section 12: "infrastructure-as-code." This is a starting-point skeleton
# for the core resources a production deployment needs — RDS (with the
# PostGIS extension the schema requires), an ECS Fargate service running
# the container from ../../Dockerfile, secrets, and a load balancer — not
# a complete, hardened production IaC suite. It has not been applied
# against a real AWS account (this environment has no cloud credentials
# to do so) and its HCL syntax was checked with a parser, not with
# `terraform validate` or `terraform plan` against a real provider. Real
# deployment specifics (VPC layout, subnet CIDRs, instance sizing,
# autoscaling policy, exact security group rules) are deliberately left
# as variables/TODOs rather than guessed defaults that would look
# authoritative but weren't tested against anything real.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.medium"
  description = "Size appropriately for expected polling-day write volume — this is a starting point, not a sizing recommendation."
}

variable "container_image" {
  type        = string
  description = "Full ECR image URI, e.g. <account>.dkr.ecr.<region>.amazonaws.com/electiq:<tag> — built from the repo's Dockerfile."
}

# ── Database ────────────────────────────────────────────────────────────
# RDS PostgreSQL. The PostGIS extension itself is created by the app's
# own migrations (`CREATE EXTENSION IF NOT EXISTS postgis`) once the
# instance is reachable — RDS Postgres ships the PostGIS extension files,
# it just needs to be enabled, which the migration already does.
resource "aws_db_instance" "electiq" {
  identifier             = "electiq-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 50
  storage_encrypted      = true # Section 11 — encryption at rest for the database itself
  db_name                = "electiq"
  username               = "electiq_app"
  manage_master_user_password = true # AWS-managed rotation via Secrets Manager, not a static password in this file
  backup_retention_period = 7
  multi_az               = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  deletion_protection    = var.environment == "production"

  # TODO: set vpc_security_group_ids and db_subnet_group_name to match
  # your actual VPC — deliberately omitted rather than guessed.
}

# ── Secrets ─────────────────────────────────────────────────────────────
# NEXTAUTH_SECRET and EVIDENCE_ENCRYPTION_KEY (Section 11) belong in a
# real secret store, never as plain Terraform variables committed to a
# repo. This resource creates the Secrets Manager entries; populating
# their actual values happens out-of-band (AWS console, CLI, or a
# separate secrets-rotation pipeline), never in this file.
resource "aws_secretsmanager_secret" "nextauth_secret" {
  name = "electiq/${var.environment}/nextauth-secret"
}

resource "aws_secretsmanager_secret" "evidence_encryption_key" {
  name = "electiq/${var.environment}/evidence-encryption-key"
}

# ── Compute ─────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "electiq" {
  name = "electiq-${var.environment}"
}

resource "aws_ecs_task_definition" "electiq_app" {
  family                   = "electiq-app-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024

  container_definitions = jsonencode([
    {
      name  = "electiq-app"
      image = var.container_image
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "NEXTAUTH_URL", value = "https://electiq.example.com" },
      ]
      secrets = [
        { name = "NEXTAUTH_SECRET", valueFrom = aws_secretsmanager_secret.nextauth_secret.arn },
        { name = "EVIDENCE_ENCRYPTION_KEY", valueFrom = aws_secretsmanager_secret.evidence_encryption_key.arn },
      ]
    }
  ])
}

resource "aws_ecs_service" "electiq_app" {
  name            = "electiq-app-${var.environment}"
  cluster         = aws_ecs_cluster.electiq.id
  task_definition = aws_ecs_task_definition.electiq_app.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  # TODO: network_configuration (subnets/security groups) and
  # load_balancer block, both dependent on your actual VPC/ALB setup.
}

output "db_endpoint" {
  value       = aws_db_instance.electiq.endpoint
  description = "RDS endpoint — used to assemble DATABASE_URL alongside the RDS-managed credentials secret."
}
