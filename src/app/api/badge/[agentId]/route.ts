import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.inkog.io";
const API_KEY = process.env.INKOG_API_KEY;

function makeBadgeSvg(label: string, value: string, color: string): string {
  const labelWidth = label.length * 6.5 + 14;
  const valueWidth = value.length * 6.5 + 14;
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const { agentId } = params;
  const type = request.nextUrl.searchParams.get("type") || "secured";

  // Generic "secured" badge — no data fetch needed
  if (type === "secured") {
    const svg = makeBadgeSvg("Inkog", "Secured", "#22c55e");
    return new NextResponse(svg, { headers: CACHE_HEADERS });
  }

  // "criticals" badge — fetch agent data
  if (type === "criticals") {
    if (!API_KEY) {
      // No API key configured — return generic badge
      const svg = makeBadgeSvg("Inkog", "Secured", "#22c55e");
      return new NextResponse(svg, { headers: CACHE_HEADERS });
    }

    try {
      const res = await fetch(`${API_URL}/v1/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        next: { revalidate: 3600 },
      });

      if (!res.ok) {
        const svg = makeBadgeSvg("Inkog", "Secured", "#22c55e");
        return new NextResponse(svg, { headers: CACHE_HEADERS });
      }

      const data = await res.json();
      const criticals = data.agent?.critical_count ?? data.critical_count ?? 0;

      if (criticals === 0) {
        const svg = makeBadgeSvg("Inkog", "0 Criticals", "#22c55e");
        return new NextResponse(svg, { headers: CACHE_HEADERS });
      } else {
        const svg = makeBadgeSvg("Inkog", `${criticals} Critical${criticals > 1 ? "s" : ""}`, "#ef4444");
        return new NextResponse(svg, { headers: CACHE_HEADERS });
      }
    } catch {
      const svg = makeBadgeSvg("Inkog", "Secured", "#22c55e");
      return new NextResponse(svg, { headers: CACHE_HEADERS });
    }
  }

  // Unknown type — return generic
  const svg = makeBadgeSvg("Inkog", "Secured", "#22c55e");
  return new NextResponse(svg, { headers: CACHE_HEADERS });
}
