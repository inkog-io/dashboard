import type { Metadata } from "next";
import { getAnonymousScanById } from "@/lib/db";

interface Props {
  params: { id: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const defaults: Metadata = {
    title: "Security Report - Inkog",
    description:
      "AI agent security scan results. Detect vulnerabilities, governance gaps, and compliance issues.",
  };

  try {
    const row = await getAnonymousScanById(params.id);
    if (!row) return defaults;

    const scanResult =
      typeof row.scan_result === "string"
        ? JSON.parse(row.scan_result)
        : row.scan_result;

    const findingsCount = scanResult?.findings_count ?? 0;
    const criticalCount = scanResult?.critical_count ?? 0;
    const highCount = scanResult?.high_count ?? 0;
    const riskScore = scanResult?.risk_score ?? 0;

    const severityParts: string[] = [];
    if (criticalCount > 0) severityParts.push(`${criticalCount} Critical`);
    if (highCount > 0) severityParts.push(`${highCount} High`);
    const severitySummary =
      severityParts.length > 0 ? severityParts.join(", ") + " severity" : "";

    const title =
      findingsCount > 0
        ? `${findingsCount} vulnerabilities found in ${row.repo_name}`
        : `No vulnerabilities found in ${row.repo_name}`;

    const description =
      findingsCount > 0
        ? `Security scan: ${severitySummary} issues detected. Risk score: ${riskScore}/100. Scan your own AI agent for free.`
        : `Security scan passed with a risk score of ${riskScore}/100. Scan your own AI agent for free.`;

    return {
      title: `${title} - Inkog`,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "Inkog",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return defaults;
  }
}

export default function ReportLayout({ children }: Props) {
  return children;
}
