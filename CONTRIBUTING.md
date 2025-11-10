# Contributing to Wine Club SaaS

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Code Style

- We use Prettier for code formatting
- ESLint for code quality
- TypeScript for type safety

Run linting before committing:

```bash
pnpm lint
```

## Commit Messages

Use conventional commits:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

Example:
```
feat: add email notifications for failed payments
```

## Testing

Always add tests for new features:

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md if applicable
5. Submit PR with clear description

## Areas for Contribution

- **Features**: Rate limiting, email notifications, analytics
- **Tests**: Increase test coverage
- **Documentation**: Improve guides and examples
- **Bug Fixes**: Check open issues

## Questions?

Open an issue for discussion before starting major work.

