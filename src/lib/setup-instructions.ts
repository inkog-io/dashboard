/**
 * Shared setup instruction constants used by both the onboarding page
 * and the persistent setup checklist on the dashboard.
 */

export const SETUP_INSTRUCTIONS = {
  cli: {
    install: "go install github.com/inkog-io/inkog/cmd/inkog@latest",
    envVar: (apiKey: string) => `export INKOG_API_KEY="${apiKey}"`,
    scan: "inkog scan ./my-agent",
  },
  mcp: {
    config: (apiKey: string) =>
      JSON.stringify(
        {
          mcpServers: {
            inkog: {
              command: "npx",
              args: ["@inkog-io/mcp"],
              env: { INKOG_API_KEY: apiKey },
            },
          },
        },
        null,
        2
      ),
  },
  githubActions: `name: Inkog Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: inkog-io/action@v1
        with:
          api-key: \${{ secrets.INKOG_API_KEY }}`,
};
