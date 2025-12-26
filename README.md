# Inkog Dashboard

Enterprise-grade security dashboard for AI agent vulnerability management. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Scan Management**: Upload and scan AI agent code for vulnerabilities
- **Findings Viewer**: Detailed security findings with severity levels, CWE/OWASP mapping
- **Agent Topology**: Visual graph of agent control flow and data paths
- **Governance Scores**: EU AI Act readiness assessment
- **Scan History**: Browse and compare historical scan results
- **API Key Management**: Create and manage API keys for CLI integration
- **Export Options**: JSON, SARIF, and PDF report generation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Radix UI primitives
- **Authentication**: Clerk
- **Analytics**: PostHog
- **Error Tracking**: Sentry
- **Visualization**: React Flow (topology graphs)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Environment Variables

Create a `.env.local` file:

```env
# Required: Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Required: Backend API
NEXT_PUBLIC_API_URL=https://api.inkog.io

# Optional: Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional: Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=inkog-dashboard
SENTRY_AUTH_TOKEN=sntrys_...
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development

```bash
# Run linter
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Protected dashboard pages
│   │   ├── api-keys/       # API key management
│   │   ├── history/        # Scan history viewer
│   │   ├── results/[id]/   # Individual scan results
│   │   └── scan/           # File upload scanner
│   ├── sign-in/            # Clerk sign-in page
│   └── sign-up/            # Clerk sign-up page
├── components/
│   ├── dashboard/          # Dashboard-specific components
│   ├── history/            # History page components
│   ├── layout/             # Shell, sidebar, navigation
│   ├── topology/           # Graph visualization nodes
│   └── ui/                 # Reusable UI primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and API client
└── __tests__/              # Jest test files
```

## Key Components

### API Client (`lib/api.ts`)

Type-safe API client with:
- Automatic token injection (Clerk)
- Exponential backoff retry
- Error handling and typing

```typescript
import { createAPIClient } from '@/lib/api';

const api = createAPIClient(getToken);
const scans = await api.history.list();
```

### Toast Notifications (`hooks/useToast.ts`)

Enterprise-grade toast system:

```typescript
import { useToast } from '@/hooks/useToast';

const toast = useToast();
toast.success({ title: 'Scan complete' });
toast.handleAPIError(error);
```

### Skeleton Loading (`components/ui/skeleton.tsx`)

Loading states for all major components:

```typescript
import { SkeletonMetricCard, SkeletonHistoryTable } from '@/components/ui/skeleton';
```

## Testing

The dashboard uses Jest with React Testing Library:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

### Test Structure

```
src/__tests__/
├── components/            # Component tests
│   ├── FindingCard.test.tsx
│   ├── ErrorBoundary.test.tsx
│   └── dashboard/
│       └── SecurityMetricCard.test.tsx
└── lib/                   # Utility tests
    ├── api.test.ts
    └── export-utils.test.ts
```

## Error Handling

### Sentry Integration

Errors are automatically captured and sent to Sentry in production. Configure with:

```env
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### Error Boundary

Components are wrapped with `ErrorBoundary` to prevent crashes:

```typescript
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';

// Wrap component
<ErrorBoundary>
  <ComponentThatMightFail />
</ErrorBoundary>

// Or use HOC
const SafeComponent = withErrorBoundary(UnsafeComponent);
```

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set environment variables
3. Deploy

### Docker

```bash
docker build -t inkog-dashboard .
docker run -p 3000:3000 inkog-dashboard
```

## API Endpoints

The dashboard connects to `NEXT_PUBLIC_API_URL` for:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/keys` | GET | List API keys |
| `/v1/keys` | POST | Create API key |
| `/v1/keys/:id` | DELETE | Revoke API key |
| `/v1/history` | GET | List scan history |
| `/v1/stats` | GET | Dashboard statistics |
| `/v1/scans/:id` | GET | Full scan details |
| `/v1/scans/:id/export/json` | GET | Export as JSON |
| `/v1/scans/:id/export/sarif` | GET | Export as SARIF |
| `/api/v1/scan` | POST | Upload and scan files |

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Ensure tests pass: `npm test`
4. Create pull request

## License

Proprietary - Inkog Security Ltd.
