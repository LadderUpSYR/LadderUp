# LadderUp Documentation

Welcome to the LadderUp documentation. This directory contains comprehensive documentation for the entire codebase.

## Table of Contents

1. [Architecture Overview](./architecture-overview.md)
2. [Backend Documentation](./backend/README.md)
   - [Server API](./backend/server-api.md)
   - [Authentication System](./backend/authentication.md)
   - [Matchmaking System](./backend/matchmaking.md)
   - [LLM Grading](./backend/llm-grading.md)
   - [Practice Mode STT](./backend/practice-stt.md)
3. [Frontend Documentation](./frontend/README.md)
   - [Components](./frontend/components.md)
   - [Authentication Context](./frontend/auth-context.md)
   - [Custom Hooks](./frontend/hooks.md)
4. [Database Schema](./database-schema.md)
5. [API Reference](./api-reference.md)
6. [Deployment Guide](./deployment.md)

## Quick Links

- **Server**: Main FastAPI application - [Server Documentation](./backend/server-api.md)
- **Frontend**: React application - [Frontend Documentation](./frontend/README.md)
- **Testing**: Unit tests - [Testing Guide](./testing.md)

## Project Structure

```
LadderUp/
├── src/
│   ├── server_comps/       # Backend server components
│   │   ├── server.py       # Main FastAPI server
│   │   ├── matchmaking.py  # Matchmaking logic
│   │   ├── llm_grading.py  # AI grading system
│   │   └── practice_stt_fastapi.py  # Speech-to-text
│   ├── components/         # React components
│   ├── utils/             # Utility functions
│   └── AuthContext.js     # Authentication context
├── unittests/             # Test suite
└── docs/                  # Documentation (this folder)
```

## Getting Started

1. Read the [Architecture Overview](./architecture-overview.md) to understand the system design
2. Check the [Backend Documentation](./backend/README.md) for server-side code
3. Review the [Frontend Documentation](./frontend/README.md) for client-side code
4. See the [API Reference](./api-reference.md) for endpoint details

## Technology Stack

- **Backend**: FastAPI, Python 3.x
- **Frontend**: React, JavaScript
- **Database**: Firebase Firestore
- **Cache/Queue**: Redis
- **AI/ML**: Google Gemini API, Whisper (speech-to-text)
- **Authentication**: Google OAuth 2.0, Email/Password

## Contributing

Please refer to the documentation before making changes to understand the codebase structure and conventions.
