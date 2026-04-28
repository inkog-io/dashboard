import { ImageResponse } from "next/og";
import { getAnonymousScanById } from "@/lib/db";

export const alt = "Inkog Security Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  let repoName = "AI Agent";
  let findingsCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let riskScore = 0;
  let govScore = 0;

  try {
    const row = await getAnonymousScanById(params.id);
    if (row) {
      repoName = row.repo_name || repoName;
      const result =
        typeof row.scan_result === "string"
          ? JSON.parse(row.scan_result)
          : row.scan_result;
      findingsCount = result?.findings_count ?? 0;
      criticalCount = result?.critical_count ?? 0;
      highCount = result?.high_count ?? 0;
      mediumCount = result?.medium_count ?? 0;
      lowCount = result?.low_count ?? 0;
      riskScore = result?.risk_score ?? 0;
      govScore = result?.governance_score ?? 0;
    }
  } catch {
    // Fall back to generic image
  }

  const isClean = findingsCount === 0;
  const scoreColor =
    riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#22c55e";

  const pills: { label: string; count: number; color: string }[] = [];
  if (criticalCount > 0) pills.push({ label: "Critical", count: criticalCount, color: "#ef4444" });
  if (highCount > 0) pills.push({ label: "High", count: highCount, color: "#f97316" });
  if (mediumCount > 0) pills.push({ label: "Medium", count: mediumCount, color: "#f59e0b" });
  if (lowCount > 0) pills.push({ label: "Low", count: lowCount, color: "#3b82f6" });

  const findingsText = isClean
    ? "No vulnerabilities found"
    : `${findingsCount} ${findingsCount === 1 ? "vulnerability" : "vulnerabilities"} found`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0c",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              I
            </div>
            <span style={{ color: "#71717a", fontSize: "18px" }}>inkog.io</span>
          </div>
          <span style={{ color: "#52525b", fontSize: "16px" }}>Security Report</span>
        </div>

        {/* Repo name */}
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            fontFamily: "monospace",
            color: "#e4e4e7",
            marginBottom: "32px",
            letterSpacing: "-0.02em",
          }}
        >
          {repoName}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "60px",
            flex: 1,
          }}
        >
          {/* Risk Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "96px",
                fontWeight: 800,
                color: isClean ? "#22c55e" : scoreColor,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              {isClean ? "0" : String(riskScore)}
            </div>
            <div style={{ display: "flex", fontSize: "20px", color: "#71717a" }}>
              /100 Risk
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "1px",
              height: "120px",
              backgroundColor: "#27272a",
            }}
          />

          {/* Stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "32px",
                fontWeight: 700,
                color: isClean ? "#22c55e" : "#e4e4e7",
              }}
            >
              {findingsText}
            </div>

            {pills.length > 0 && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {pills.map((pill) => (
                  <div
                    key={pill.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 16px",
                      borderRadius: "9999px",
                      backgroundColor: `${pill.color}20`,
                      border: `1px solid ${pill.color}40`,
                    }}
                  >
                    <span
                      style={{ fontSize: "18px", fontWeight: 700, color: pill.color }}
                    >
                      {String(pill.count)}
                    </span>
                    <span style={{ fontSize: "16px", color: pill.color }}>
                      {pill.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", fontSize: "18px", color: "#71717a" }}>
              {`Governance: ${govScore}/100`}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #27272a",
            paddingTop: "24px",
          }}
        >
          <span style={{ fontSize: "18px", color: "#6366f1" }}>
            Scan your AI agent free — inkog.io
          </span>
          <span style={{ fontSize: "14px", color: "#52525b" }}>
            EU AI Act · NIST · OWASP
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
