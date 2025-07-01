# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Package Management

- Use `pnpm` as the package manager (specified in package.json)
- Run `pnpm install` to install dependencies
- Use `pnpm-workspace.yaml` for workspace configuration

### Build and Development

- `pnpm build` - Build all packages using Turbo
- `pnpm bundle` - Bundle the VSCode extension
- `pnpm vsix` - Create a .vsix extension file in the `bin/` directory
- `pnpm vsix:nightly` - Create nightly version VSIX
- `F5` in VSCode - Start debugging to open new window with extension running

### Code Quality

- `pnpm lint` - Run ESLint across all packages
- `pnpm check-types` - Run TypeScript type checking
- `pnpm test` - Run tests using Vitest
- `pnpm format` - Format code with Prettier

### Testing

- Use Vitest for unit testing
- Tests are located in `__tests__` directories
- End-to-end tests are in `apps/vscode-e2e`
- Run individual package tests: `pnpm test --filter=<package-name>`

### Cleanup

- `pnpm clean` - Clean all build artifacts and caches

## Architecture Overview

### Monorepo Structure

This is a monorepo with the following main areas:

**Core Extension (`src/`)**: Main VSCode extension implementation

- Entry point: `src/extension.ts`
- Core logic in `src/core/` with modules for webview, tasks, tools, config
- API providers in `src/api/providers/` supporting multiple LLM providers
- Integrations in `src/integrations/` for editor, terminal, browser
- Services in `src/services/` for code indexing, MCP, marketplace

**Packages (`packages/`)**: Shared libraries

- `@roo-code/types` - TypeScript definitions shared across codebase
- `@roo-code/cloud` - Cloud service integration
- `@roo-code/telemetry` - Analytics and telemetry
- `@roo-code/evals` - Evaluation framework
- Config packages for ESLint and TypeScript

**Apps (`apps/`)**: Supporting applications

- `vscode-e2e` - End-to-end testing
- `web-roo-code` - Marketing website (Next.js)
- `web-evals` - Evaluation dashboard (Next.js)

**Webview UI (`webview-ui/`)**: React frontend for the extension sidebar

### Key Components

**ClineProvider (`src/core/webview/ClineProvider.ts`)**: Main provider class that manages the webview, handles user interactions, and orchestrates AI conversations.

**Task System (`src/core/task/`)**: Manages conversation state and task execution with persistence.

**Tool System (`src/core/tools/`)**: Implements available tools for the AI including:

- File operations (read, write, search)
- Command execution
- Browser automation
- MCP (Model Context Protocol) tools
- Codebase search and indexing

**API Layer (`src/api/`)**: Handles communication with various LLM providers through a unified interface with format transformations and caching strategies.

**Mode System**: Supports different AI personas (Code, Architect, Ask, Debug) with custom instructions.

### Important Files

**Configuration Management**:

- `src/core/config/ContextProxy.ts` - VSCode settings integration
- `src/core/config/CustomModesManager.ts` - Custom mode configurations
- `src/core/config/ProviderSettingsManager.ts` - LLM provider settings

**Internationalization**:

- `src/i18n/` - Multi-language support with JSON translation files

**Extension Lifecycle**:

- `src/extension.ts` - Main activation/deactivation logic
- `src/activate/` - Command registration and initialization

## Testing Guidelines

### Unit Tests

- Located in `__tests__` directories alongside source files
- Use Vitest with `.spec.ts` file extension
- Mock external dependencies using `__mocks__` directories

### Integration Tests

- End-to-end tests in `apps/vscode-e2e/src/suite/`
- Test tool functionality and user workflows
- Use VSCode test framework

### Test Commands

- Single package: `pnpm test --filter=<package-name>`
- Specific test file: `pnpm test <test-file-pattern>`
- Watch mode: `pnpm test --watch`

## Key Patterns

### Dependency Injection

The codebase uses dependency injection patterns, particularly in the core services and provider classes.

### Event-Driven Architecture

Heavy use of VSCode's event system and custom EventEmitters for component communication.

### Modular Design

Clear separation between core functionality, integrations, and UI with well-defined interfaces.

### Type Safety

Comprehensive TypeScript usage with shared types in `@roo-code/types` package.

## Development Workflow

1. Make changes to source code
2. For webview changes: Hot reload occurs automatically
3. For extension changes: Restart debug session (F5)
4. Run tests: `pnpm test`
5. Check types: `pnpm check-types`
6. Format code: `pnpm format`
7. Build for production: `pnpm build`

## Special Considerations

### Webview Development

- React app in `webview-ui/` communicates with extension via message passing
- Use `ExtensionMessage` and `WebviewMessage` types for communication
- Hot reload available during development

### Provider System

- Support for multiple LLM providers with unified interface
- Provider-specific transformations in `src/api/transform/`
- Caching strategies for performance optimization

### MCP Integration

- Model Context Protocol support for extending capabilities
- MCP servers managed in `src/services/mcp/`
- Hub integration for discovering MCP tools

### Internationalization

- Use `t()` function from `src/i18n/` for all user-facing strings
- Support for 15+ languages with JSON translation files
