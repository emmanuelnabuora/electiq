/**
 * Section 11: "Secret management." Rather than a hard crash at import
 * time (which would break every test and page that transitively imports
 * this), this returns a list of warnings a security dashboard can show —
 * checked on demand, not silently ignored.
 */
export type SecurityConfigWarning = { key: string; message: string; severity: "critical" | "warning" };

export function checkSecurityConfig(): SecurityConfigWarning[] {
  const warnings: SecurityConfigWarning[] = [];

  if (!process.env.NEXTAUTH_SECRET) {
    warnings.push({
      key: "NEXTAUTH_SECRET",
      message: "NEXTAUTH_SECRET is not set — sessions cannot be signed securely.",
      severity: "critical",
    });
  } else if (process.env.NEXTAUTH_SECRET.length < 32) {
    warnings.push({
      key: "NEXTAUTH_SECRET",
      message: "NEXTAUTH_SECRET is shorter than 32 characters — generate a longer one for production.",
      severity: "warning",
    });
  }

  if (!process.env.DATABASE_URL) {
    warnings.push({
      key: "DATABASE_URL",
      message: "DATABASE_URL is not set.",
      severity: "critical",
    });
  }

  if (!process.env.EVIDENCE_ENCRYPTION_KEY) {
    warnings.push({
      key: "EVIDENCE_ENCRYPTION_KEY",
      message: "EVIDENCE_ENCRYPTION_KEY is not set — evidence uploads and MFA secrets cannot be encrypted at rest.",
      severity: "critical",
    });
  } else {
    try {
      const decoded = Buffer.from(process.env.EVIDENCE_ENCRYPTION_KEY, "base64");
      if (decoded.length !== 32) {
        warnings.push({
          key: "EVIDENCE_ENCRYPTION_KEY",
          message: `EVIDENCE_ENCRYPTION_KEY decodes to ${decoded.length} bytes, not the required 32 (AES-256).`,
          severity: "critical",
        });
      }
    } catch {
      warnings.push({
        key: "EVIDENCE_ENCRYPTION_KEY",
        message: "EVIDENCE_ENCRYPTION_KEY is not valid base64.",
        severity: "critical",
      });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push({
      key: "ANTHROPIC_API_KEY",
      message: "ANTHROPIC_API_KEY is not set — the Copilot will report itself as unconfigured (this is expected in development).",
      severity: "warning",
    });
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL?.startsWith("http://")) {
    warnings.push({
      key: "NEXTAUTH_URL",
      message: "NEXTAUTH_URL uses http:// in production — sessions should only ever be issued over https://.",
      severity: "critical",
    });
  }

  return warnings;
}
