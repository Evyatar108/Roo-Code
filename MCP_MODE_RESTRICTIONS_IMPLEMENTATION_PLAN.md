# Per-Mode MCP Server/Tool Restrictions Implementation Plan

## Overview

This document outlines the implementation plan for adding per-custom-mode MCP server and tool restrictions to Roo Code. This feature will allow users to configure which MCP servers and specific tools each custom mode can access, providing granular control over available functionality per mode.

## Current State Analysis

### MCP System Architecture

- **McpHub**: Manages MCP server connections, tools, and resources
- **McpServerManager**: Singleton manager for MCP server instances
- **Configuration**: Global via `.roo/mcp.json` (project) or global settings
- **Tool Filtering**: Currently at server level only (`alwaysAllow`, `disabledTools`)

### Mode System Architecture

- **Tool Groups**: Modes define allowed tool groups (`["read", "edit", "mcp"]`)
- **Validation**: `isToolAllowedForMode()` checks group-level permissions
- **Custom Modes**: Stored in `.roomodes` (project) or global settings
- **Current Limitation**: MCP tools are all-or-nothing via `mcp` group

## Implementation Plan

### Phase 1: Schema and Type Definitions

#### 1.1 Update ModeConfig Type Definition

**File**: `packages/types/src/mode.ts`

```typescript
export interface McpRestrictions {
	// Server-level restrictions
	allowedServers?: string[] // Whitelist of allowed servers
	disallowedServers?: string[] // Blacklist of disallowed servers

	// Tool-level restrictions (more granular)
	allowedTools?: Array<{
		serverName: string
		toolName: string
	}>
	disallowedTools?: Array<{
		serverName: string
		toolName: string
	}>
}

export interface ModeConfig {
	// ... existing fields
	mcpRestrictions?: McpRestrictions
}
```

#### 1.2 Update Schema Validation

**File**: `packages/types/src/mode.ts`

Add validation schema for `mcpRestrictions` in `customModesSettingsSchema`.

### Phase 2: Core Logic Implementation

#### 2.1 Update Tool Validation Logic

**File**: `src/shared/modes.ts`

```typescript
export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>,
	experiments?: Record<string, boolean>,
	mcpContext?: { serverName?: string; toolName?: string }, // NEW
): boolean {
	// ... existing logic

	// NEW: MCP-specific restriction checking
	if (tool === "use_mcp_tool" && mcpContext?.serverName) {
		const mode = getModeBySlug(modeSlug, customModes)
		const restrictions = mode?.mcpRestrictions

		if (restrictions) {
			// Check server-level restrictions
			if (!isServerAllowedForMode(mcpContext.serverName, restrictions)) {
				return false
			}

			// Check tool-level restrictions
			if (
				mcpContext.toolName &&
				!isToolAllowedForModeAndServer(mcpContext.serverName, mcpContext.toolName, restrictions)
			) {
				return false
			}
		}
	}

	return true // Existing logic continues
}

function isServerAllowedForMode(serverName: string, restrictions: McpRestrictions): boolean {
	// If allowedServers is defined, server must be in the list
	if (restrictions.allowedServers && !restrictions.allowedServers.includes(serverName)) {
		return false
	}

	// If disallowedServers is defined, server must not be in the list
	if (restrictions.disallowedServers && restrictions.disallowedServers.includes(serverName)) {
		return false
	}

	return true
}

function isToolAllowedForModeAndServer(serverName: string, toolName: string, restrictions: McpRestrictions): boolean {
	// If allowedTools is defined, tool must be in the list
	if (restrictions.allowedTools) {
		const isAllowed = restrictions.allowedTools.some((t) => t.serverName === serverName && t.toolName === toolName)
		if (!isAllowed) return false
	}

	// If disallowedTools is defined, tool must not be in the list
	if (restrictions.disallowedTools) {
		const isDisallowed = restrictions.disallowedTools.some(
			(t) => t.serverName === serverName && t.toolName === toolName,
		)
		if (isDisallowed) return false
	}

	return true
}
```

#### 2.2 Update Tool Use Validation

**File**: `src/core/tools/validateToolUse.ts`

```typescript
export function validateToolUse(
	toolName: ToolName,
	mode: Mode,
	customModes?: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, unknown>,
	mcpContext?: { serverName?: string; toolName?: string }, // NEW
): void {
	if (
		!isToolAllowedForMode(
			toolName,
			mode,
			customModes ?? [],
			toolRequirements,
			toolParams,
			undefined,
			mcpContext, // Pass MCP context
		)
	) {
		const restriction = mcpContext ? ` (server: ${mcpContext.serverName}, tool: ${mcpContext.toolName})` : ""
		throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode${restriction}.`)
	}
}
```

### Phase 3: MCP Tool Execution Updates

#### 3.1 Update MCP Tool Execution

**File**: `src/core/tools/useMcpToolTool.ts`

```typescript
export async function useMcpToolTool(/* ... existing params */) {
	try {
		// ... existing parameter validation

		// NEW: Validate against mode restrictions before execution
		try {
			validateToolUse("use_mcp_tool", cline.currentMode, cline.customModes, undefined, undefined, {
				serverName,
				toolName,
			})
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")

			pushToolResult(formatResponse.toolError(`Mode restriction: ${error.message}`))
			return
		}

		// ... rest of existing execution logic
	} catch (error) {
		await handleError("executing MCP tool", error)
	}
}
```

#### 3.2 Update MCP Resource Access

**File**: `src/core/tools/accessMcpResourceTool.ts`

Apply similar validation for MCP resource access.

### Phase 4: Tool Description and Prompt Updates

#### 4.1 Update Tool Descriptions

**File**: `src/core/prompts/tools/use-mcp-tool.ts`

```typescript
export function getUseMcpToolDescription(args: ToolArgs): string {
	const { mcpHub, currentMode, customModes } = args
	if (!mcpHub) return ""

	let availableServers = mcpHub.getServers()

	// NEW: Filter servers based on mode restrictions
	if (currentMode && customModes) {
		const mode = getModeBySlug(currentMode, customModes)
		const restrictions = mode?.mcpRestrictions

		if (restrictions) {
			availableServers = availableServers.filter((server) => isServerAllowedForMode(server.name, restrictions))
		}
	}

	// Generate description with filtered servers and their available tools
	const serverDescriptions = availableServers
		.map((server) => {
			let availableTools = server.tools || []

			// Filter tools based on mode restrictions
			if (currentMode && customModes) {
				const mode = getModeBySlug(currentMode, customModes)
				const restrictions = mode?.mcpRestrictions

				if (restrictions) {
					availableTools = availableTools.filter((tool) =>
						isToolAllowedForModeAndServer(server.name, tool.name, restrictions),
					)
				}
			}

			return `Server "${server.name}": ${availableTools.map((t) => t.name).join(", ")}`
		})
		.join("\n")

	return `## use_mcp_tool

Use tools provided by Model Context Protocol (MCP) servers.

Available servers and tools for current mode:
${serverDescriptions}

Parameters:
- server_name: Name of the MCP server
- tool_name: Name of the tool to execute  
- arguments: JSON string of tool arguments`
}
```

#### 4.2 Update Tool Args Interface

**File**: `src/core/prompts/tools/types.ts`

```typescript
export interface ToolArgs {
	// ... existing fields
	currentMode?: string // NEW: Current mode for restriction checking
	customModes?: ModeConfig[] // NEW: Custom modes for restriction lookup
}
```

### Phase 5: Configuration Management

#### 5.1 Update Custom Modes Manager

**File**: `src/core/config/CustomModesManager.ts`

```typescript
// Add validation for mcpRestrictions during mode parsing
private validateModeConfig(config: any, availableServers: string[]): ModeConfig {
  // ... existing validation

  if (config.mcpRestrictions) {
    const restrictions = config.mcpRestrictions

    // Validate server names exist
    if (restrictions.allowedServers) {
      const invalidServers = restrictions.allowedServers.filter(s =>
        !availableServers.includes(s)
      )
      if (invalidServers.length > 0) {
        console.warn(`Invalid servers in allowedServers: ${invalidServers.join(", ")}`)
      }
    }

    if (restrictions.disallowedServers) {
      const invalidServers = restrictions.disallowedServers.filter(s =>
        !availableServers.includes(s)
      )
      if (invalidServers.length > 0) {
        console.warn(`Invalid servers in disallowedServers: ${invalidServers.join(", ")}`)
      }
    }

    // Validate tool configurations
    // (Requires integration with McpHub to get available tools per server)
  }

  return config
}
```

### Phase 6: UI Components

#### 6.1 MCP Restrictions Editor Component

**File**: `webview-ui/src/components/modes/McpRestrictionsEditor.tsx`

```typescript
interface McpRestrictionsEditorProps {
	restrictions?: McpRestrictions
	availableServers: Array<{ name: string; tools: Array<{ name: string }> }>
	onChange: (restrictions: McpRestrictions) => void
}

export function McpRestrictionsEditor({ restrictions, availableServers, onChange }: McpRestrictionsEditorProps) {
	// Implementation for editing:
	// - Server allowlist/blocklist
	// - Individual tool allowlist/blocklist
	// - Visual indication of current selections
	// - Validation of conflicting rules
}
```

#### 6.2 Server Selector Component

**File**: `webview-ui/src/components/modes/McpServerSelector.tsx`

Multi-select component for choosing allowed/disallowed servers.

#### 6.3 Tool Selector Component

**File**: `webview-ui/src/components/modes/McpToolSelector.tsx`

Hierarchical selector for choosing specific tools per server.

#### 6.4 Integration into Mode Editor

**File**: `webview-ui/src/components/modes/ModeEditor.tsx`

Add MCP restrictions section to existing mode editor.

### Phase 7: WebView Message Handling

#### 7.1 New Message Types

**File**: `src/core/webview/webviewMessageHandler.ts`

```typescript
// Add new message handlers
case "getMcpServersForMode":
  // Return available servers and tools for specific mode
  const mode = message.modeSlug
  const servers = await provider.getMcpHub()?.getServers() || []
  const filteredServers = filterServersForMode(servers, mode, customModes)

  await provider.postMessageToWebview({
    type: "mcpServersForMode",
    servers: filteredServers
  })
  break

case "updateModeRestrictions":
  // Handle updating mode MCP restrictions
  const { modeSlug, restrictions } = message
  await provider.customModesManager.updateModeRestrictions(modeSlug, restrictions)
  break

case "validateMcpRestrictions":
  // Validate proposed restrictions against available servers/tools
  const validation = await validateMcpRestrictions(message.restrictions, provider.getMcpHub())
  await provider.postMessageToWebview({
    type: "mcpRestrictionsValidation",
    validation
  })
  break
```

## Testing Strategy

### Unit Tests

#### Core Logic Tests

**File**: `src/shared/__tests__/modes.spec.ts`

- Test `isToolAllowedForMode` with various MCP restriction scenarios
- Test server and tool filtering logic
- Test edge cases (empty restrictions, conflicting rules)

#### Tool Execution Tests

**File**: `src/core/tools/__tests__/useMcpToolTool.spec.ts`

- Test tool execution with mode restrictions
- Test validation error handling
- Test restriction bypass attempts

#### Configuration Tests

**File**: `src/core/config/__tests__/CustomModesManager.spec.ts`

- Test MCP restriction parsing and validation
- Test mode merging with restrictions
- Test invalid configuration handling

### Integration Tests

#### E2E Tests

**File**: `apps/vscode-e2e/src/suite/mcp-restrictions.test.ts`

- Test complete workflow: configure mode → restrict MCP → verify behavior
- Test UI components for restriction management
- Test restriction persistence and loading

## Migration Strategy

### Backward Compatibility

- Existing modes without `mcpRestrictions` field work unchanged
- No restrictions = all MCP servers/tools allowed (current behavior)
- Existing MCP configurations remain functional

### Migration Helpers

- Add migration function to detect and suggest MCP restrictions for existing modes
- Provide templates for common restriction patterns
- Add validation warnings for potentially unsafe configurations

## Documentation Updates

### User Documentation

- Add section to mode configuration guide
- Include examples of common restriction patterns
- Document security considerations

### Developer Documentation

- Update API documentation for new interfaces
- Add examples for restriction validation
- Document testing patterns for MCP restrictions

## Implementation Status

### ✅ Phase 1: Foundation (COMPLETED)

- [x] **Update ModeConfig type definition** - Added `mcpRestrictions` field with TypeScript types
- [x] **Enhanced schema validation** - Added Zod schemas with conflict detection for MCP restrictions
- [x] **Implement core validation logic** - Enhanced `isToolAllowedForMode()` with MCP context support
- [x] **Update tool validation** - Modified `validateToolUse()` to pass MCP context for restriction checking
- [x] **Enhanced MCP tool execution** - Updated both `useMcpToolTool.ts` and `accessMcpResourceTool.ts` with restriction validation

### ✅ Phase 2: Tool Description Updates (COMPLETED)

- [x] **Extended ToolArgs interface** - Added `currentMode` and `customModes` fields for mode context
- [x] **Updated getUseMcpToolDescription()** - Now filters available servers and tools based on mode restrictions
- [x] **Updated getAccessMcpResourceDescription()** - Now filters available servers based on mode restrictions
- [x] **Enhanced getToolDescriptionsForMode()** - Now passes mode context to tool description functions

### 🚧 Phase 3: UI Development (PENDING)

- [ ] Create restriction editor components (`McpRestrictionsEditor.tsx`)
- [ ] Implement server selector component (`McpServerSelector.tsx`)
- [ ] Implement tool selector component (`McpToolSelector.tsx`)
- [ ] Integrate MCP restrictions into mode editor
- [ ] Add webview message handling for restriction management

### 🚧 Phase 4: Testing & Polish (PENDING)

- [ ] Comprehensive testing suite
- [ ] Documentation updates
- [ ] Performance optimization
- [ ] Bug fixes and edge cases

## Current Implementation Status

### ✅ **COMPLETED FEATURES:**

#### **Core Functionality**

- **Type Definitions**: Complete TypeScript interfaces for `McpRestrictions` in `@roo-code/types`
- **Schema Validation**: Zod schemas with conflict detection between allowedServers/disallowedServers and allowedTools/disallowedTools
- **Validation Logic**: Enhanced `isToolAllowedForMode()` function with MCP context parameter support
- **Tool Execution**: Both `use_mcp_tool` and `access_mcp_resource` tools now validate against mode restrictions before execution
- **Server Default Behavior**: NEW - `defaultEnabled` setting for MCP servers controls their default availability in modes

#### **Dynamic AI Prompts**

- **Server Filtering**: MCP tool descriptions only show servers available for the current mode
- **Tool Filtering**: Individual MCP tools are filtered based on allowedTools/disallowedTools restrictions
- **Graceful Degradation**: Clear messaging when no MCP servers/tools are available for a mode
- **Context Awareness**: Tool descriptions dynamically adjust based on current mode and custom mode configurations
- **Default Behavior Respect**: Server filtering now respects `defaultEnabled` setting during mode restriction evaluation

#### **Key Files Modified**

- `packages/types/src/mode.ts` - Added `McpRestrictions` interface and schema validation
- `src/shared/modes.ts` - Enhanced `isToolAllowedForMode()` with MCP context support including `serverDefaultEnabled`
- `src/core/tools/validateToolUse.ts` - Updated to pass MCP context for restriction checking
- `src/core/tools/useMcpToolTool.ts` - Added restriction validation before tool execution with server default behavior
- `src/core/tools/accessMcpResourceTool.ts` - Added server restriction validation with default behavior support
- `src/core/prompts/tools/types.ts` - Extended `ToolArgs` interface with mode context
- `src/core/prompts/tools/use-mcp-tool.ts` - Dynamic filtering of servers and tools with default behavior logic
- `src/core/prompts/tools/access-mcp-resource.ts` - Dynamic filtering of servers with default behavior logic
- `src/core/prompts/tools/index.ts` - Passes mode context to tool description functions
- `src/services/mcp/McpHub.ts` - Added `defaultEnabled` field to server schema and `getServerConfig()` method

### 🎯 **WORKING FEATURES:**

Users can now configure MCP restrictions in their custom modes (via `.roomodes` or global settings):

```typescript
{
  "slug": "secure-mode",
  "name": "Secure Mode",
  "groups": ["read", "mcp"],
  "mcpRestrictions": {
    "allowedServers": ["weather-server", "docs-server"],
    "disallowedServers": ["admin-server"],
    "allowedTools": [
      { "serverName": "weather-server", "toolName": "get_forecast" },
      { "serverName": "docs-server", "toolName": "search_docs" }
    ],
    "disallowedTools": [
      { "serverName": "weather-server", "toolName": "admin_function" }
    ]
  }
}
```

**NEW: MCP Server Default Behavior Control**

Users can now configure MCP servers with a `defaultEnabled` setting to control their default availability in modes:

```json
{
	"mcpServers": {
		"weather-server": {
			"type": "stdio",
			"command": "weather-mcp-server",
			"args": ["--port", "3000"],
			"defaultEnabled": true // ← Default: Available in all modes unless explicitly disallowed
		},
		"admin-server": {
			"type": "stdio",
			"command": "admin-mcp-server",
			"args": ["--admin-mode"],
			"defaultEnabled": false // ← Must be explicitly allowed in modes to be available
		},
		"docs-server": {
			"type": "sse",
			"url": "https://docs.example.com/mcp",
			"defaultEnabled": true // ← Available by default
		}
	}
}
```

**Behavior Examples:**

1. **`defaultEnabled: true` (Default Behavior)**:

    - Server is available in ALL modes unless explicitly blocked
    - Mode can use `disallowedServers` to block access
    - Backward compatible with existing configurations

2. **`defaultEnabled: false` (Opt-in Behavior)**:
    - Server is available ONLY in modes that explicitly allow it
    - Mode must use `allowedServers` to enable access
    - Perfect for sensitive/admin servers that should be restricted by default

**Real-world Use Cases:**

```typescript
// Example: Security-focused mode configuration
{
  "slug": "production-mode",
  "name": "Production Mode",
  "groups": ["read", "edit", "mcp"],
  "mcpRestrictions": {
    // Only explicitly allow safe servers
    "allowedServers": ["docs-server", "weather-server"],
    // Block any admin servers (even if defaultEnabled: true)
    "disallowedServers": ["admin-server", "database-admin"]
  }
}

// With this configuration and the server settings above:
// ✅ docs-server: Available (defaultEnabled: true + in allowedServers)
// ✅ weather-server: Available (defaultEnabled: true + in allowedServers)
// ❌ admin-server: Blocked (defaultEnabled: false + not in allowedServers)
// ❌ database-admin: Blocked (explicitly in disallowedServers)
```

When this mode is active:

- AI only sees and can use `weather-server` and `docs-server`
- `admin-server` is completely hidden from AI prompts (due to `defaultEnabled: false`)
- Only `get_forecast` and `search_docs` tools are available
- All restriction validation happens before tool execution

### 📋 **REMAINING WORK:**

#### **Phase 3: UI Development**

- Create React components for editing MCP restrictions in the webview
- Add visual interface for selecting servers and tools per mode
- Integrate restriction editor into the existing mode configuration UI
- Add real-time validation of restriction configurations

#### **Phase 4: Testing & Polish**

- Comprehensive unit and integration test suite
- Performance optimization for restriction checking
- Enhanced error handling and user feedback
- Documentation and usage examples

### **Next Steps Recommendation:**

The core functionality is complete and working. The next logical step would be **Phase 3: UI Development** to provide a user-friendly interface for configuring these restrictions, making the feature accessible to end users through the webview interface.

## Security Considerations

### Restriction Enforcement

- Validate restrictions at multiple layers (UI, tool execution, validation)
- Prevent restriction bypass through parameter manipulation
- Log restriction violations for audit purposes

### Configuration Security

- Validate server and tool names against actual available resources
- Prevent injection attacks through configuration fields
- Secure storage of restriction configurations

## Future Enhancements

### Advanced Features

- **Time-based restrictions**: Allow/disallow tools based on time of day
- **Context-aware restrictions**: Dynamic restrictions based on current task context
- **Inheritance patterns**: Mode hierarchies with restriction inheritance
- **Audit logging**: Track MCP tool usage per mode for compliance

### Performance Optimizations

- **Caching**: Cache restriction evaluations for frequently used modes
- **Lazy loading**: Load restrictions only when needed
- **Batch validation**: Validate multiple tools/servers at once

This implementation plan provides a comprehensive roadmap for adding granular MCP server and tool restrictions to Roo Code's custom modes system while maintaining backward compatibility and ensuring robust security.
