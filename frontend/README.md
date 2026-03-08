# VaidyaLink Frontend

Production-ready Next.js 14 application for VaidyaLink healthcare platform.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: TanStack Query + Zustand
- **UI Components**: Radix UI + shadcn/ui
- **Forms**: React Hook Form + Zod
- **API Client**: Axios
- **i18n**: next-i18next (22 Indian languages)
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── scan/             # Scanning components
│   ├── voice/            # Voice interface components
│   └── shared/           # Shared components
├── lib/                   # Utilities and configurations
│   ├── api/              # API client and types
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Utility functions
├── public/               # Static assets
└── styles/               # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm run format` - Format code with Prettier
- `npm test` - Run Jest tests
- `npm run test:e2e` - Run Playwright E2E tests

## Environment Variables

See `.env.example` for all available environment variables.

## Features

- 📱 Progressive Web App (PWA)
- 🌐 Multilingual support (22 Indian languages)
- 🔒 AWS Cognito authentication
- 📸 Camera integration for document scanning
- 🎤 Voice interface with Bhashini API
- 🏥 ABDM integration with ABHA ID
- 📊 Real-time updates via WebSocket
- ♿ WCAG 2.1 Level AA accessibility

## Development Guidelines

- Follow the existing code structure
- Use TypeScript for type safety
- Write tests for new features
- Follow the Prettier configuration
- Use semantic commit messages

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
- [Radix UI](https://www.radix-ui.com/)
