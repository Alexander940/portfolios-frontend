# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server
npm run dev

# Build (type-check + production build)
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

## Architecture

This is a React + TypeScript + Vite frontend for an investment portfolio management application.

### Tech Stack
- **React 19** with TypeScript
- **Vite 7** for bundling with Tailwind CSS v4
- **Zustand** for state management
- **React Router v7** for routing
- **React Hook Form + Zod** for form handling and validation
- **Axios** for API communication

### Path Alias
The `@/` alias maps to `src/` (configured in `vite.config.ts`).

### Project Structure

```
src/
├── components/ui/       # Reusable UI components (Button, Input, Checkbox)
├── features/            # Feature modules (feature-sliced design)
│   └── auth/            # Authentication feature
│       ├── components/  # Feature-specific components
│       ├── hooks/       # Custom hooks (useAuth)
│       ├── services/    # API service layer
│       ├── stores/      # Zustand stores
│       └── types/       # TypeScript types
├── lib/                 # Utilities (axios client, error handling)
├── pages/               # Page components
├── routes/              # Router configuration + route guards
└── types/               # Global TypeScript types
```

### Key Patterns

**Feature Modules**: Each feature (e.g., `auth`) is self-contained with its own components, hooks, services, stores, and types. Import from feature barrel exports: `import { useAuth, useAuthStore } from '@/features/auth'`.

**Authentication Flow**: The auth store (`useAuthStore`) manages JWT tokens with "remember me" support (localStorage vs sessionStorage). Axios interceptors automatically attach tokens and handle 401 errors.

**Route Guards**: `ProtectedRoute` and `PublicRoute` components handle authentication-based access control.

### Environment Variables
- `VITE_API_URL` - Backend API base URL (default: `http://localhost:8000`)
- `VITE_API_TIMEOUT` - Request timeout in ms (default: `30000`)
