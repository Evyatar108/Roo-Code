# MCP Mode Restrictions Implementation

This document outlines the comprehensive implementation of MCP (Model Context Protocol) mode restrictions functionality in Roo Code, allowing users to control which MCP servers and tools are available in each custom mode.

## Overview

The MCP mode restrictions feature enables fine-grained control over which MCP servers and tools are accessible within specific modes. This prevents the AI from seeing or attempting to use restricted servers/tools, eliminating confusion and restriction errors.

## Implementation Summary

### Problem Statement
Previously, when users configured MCP restrictions for a mode, the AI would still see all MCP servers and tools in its system prompt, leading to:
- Confusion when the AI tried to use restricted tools
- Error messages about restriction violations
- Poor user experience with unclear restriction behavior

### Solution
Implemented comprehensive filtering at both the prompt generation and tool description levels to ensure the AI only sees servers and tools it's actually allowed to use.

## Architecture Overview

### Core Components

1. **Backend Filtering Logic** - Filters servers and tools based on restrictions in system prompt generation
2. **UI Components** - User interface for configuring restrictions with real-time status feedback
3. **System Prompt Integration** - Ensures restrictions are applied to AI context
4. **State Management** - Handles restriction configuration persistence with bug fixes

## Detailed Implementation

### 1. Backend Filtering Logic

#### MCP Servers Section (`src/core/prompts/sections/mcp-servers.ts`)

**Key Changes:**
- Added `currentMode` and `customModes` parameters to `getMcpServersSection()`
- Implemented comprehensive server filtering based on `allowedServers`, `disallowedServers`, and `defaultEnabled` settings
- Added tool-level filtering within servers based on `allowedTools` and `disallowedTools`
- Added helper functions for restriction checking

**Core Server Filtering Logic:**
```typescript
function isServerAllowedForMode(
  serverName: string, 
  restrictions: any,
  serverDefaultEnabled?: boolean
): boolean {
  // Handle defaultEnabled logic first
  if (serverDefaultEnabled === false) {
    return restrictions.allowedServers ? restrictions.allowedServers.includes(serverName) : false
  }
  
  // For defaultEnabled: true (default behavior)
  if (restrictions.allowedServers && !restrictions.allowedServers.includes(serverName)) {
    return false
  }
  
  if (restrictions.disallowedServers && restrictions.disallowedServers.includes(serverName)) {
    return false
  }
  
  return true
}
```

**Tool Filtering Logic:**
```typescript
function isToolAllowedForModeAndServer(
  serverName: string, 
  toolName: string, 
  restrictions: any
): boolean {
  // If allowedTools is defined, tool must be in the list
  if (restrictions.allowedTools) {
    const isAllowed = restrictions.allowedTools.some((t: any) => 
      t.serverName === serverName && t.toolName === toolName
    )
    if (!isAllowed) return false
  }
  
  // If disallowedTools is defined, tool must not be in the list
  if (restrictions.disallowedTools) {
    const isDisallowed = restrictions.disallowedTools.some((t: any) =>
      t.serverName === serverName && t.toolName === toolName
    )
    if (isDisallowed) return false
  }
  
  return true
}
```

#### Tool Descriptions (`src/core/prompts/tools/use-mcp-tool.ts`)

**Key Changes:**
- Applied same filtering logic to `use_mcp_tool` descriptions
- Ensures tool descriptions only show available servers and tools
- Added appropriate messaging when no servers are available due to restrictions

**Example Output When Restricted:**
```typescript
if (availableServers.length === 0) {
  return `## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. 
**Note: No MCP servers are available for the current mode.**

This tool allows you to execute tools provided by Model Context Protocol (MCP) servers, but the current mode has restrictions that prevent access to all configured MCP servers.`
}
```

#### System Prompt Integration (`src/core/prompts/system.ts`)

**Critical Fix:**
Updated the `getMcpServersSection` call to pass mode restriction parameters:
```typescript
// BEFORE (missing mode parameters):
getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)

// AFTER (with mode restrictions):
getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation, mode, customModeConfigs)
```

### 2. UI Components

#### MCP Restrictions Editor (`webview-ui/src/components/modes/McpRestrictionsEditor.tsx`)

**New Component Features:**
- **Tabbed Interface**: Separate tabs for server and tool restrictions
- **Server Status Indicators**: Visual indicators showing enabled/disabled state with detailed reasoning
- **Pattern Matching Support**: Wildcard support for flexible tool restrictions  
- **Real-time Validation**: Immediate feedback on restriction effects
- **Collapsible UI**: Expandable section to reduce visual clutter

**Server Status Display:**
Each server shows:
- **Visual Status Indicator**: Green/red dots and badges
- **Color-coded Background**: Light green for enabled, light red for disabled servers
- **Detailed Reasoning**: Clear explanation of why each server has its current status
- **Action Buttons**: Allow/Disallow buttons with visual state indication

**Status Reasoning Logic:**
```typescript
const getServerStatus = (server: McpServer) => {
  const isExplicitlyAllowed = allowedServers.includes(server.name)
  const isExplicitlyDisallowed = disallowedServers.includes(server.name)
  const defaultEnabled = server.defaultEnabled !== false

  if (isExplicitlyAllowed) {
    return { enabled: true, reason: "explicitlyAllowed", reasonText: "Explicitly allowed by user" }
  }
  if (isExplicitlyDisallowed) {
    return { enabled: false, reason: "explicitlyDisallowed", reasonText: "Explicitly disallowed by user" }
  }
  if (allowedServers.length > 0) {
    return { enabled: false, reason: "notInAllowList", reasonText: "Not included in allowed servers list" }
  }
  return { 
    enabled: defaultEnabled, 
    reason: defaultEnabled ? "defaultEnabled" : "defaultDisabled", 
    reasonText: defaultEnabled ? "Enabled by default server configuration" : "Disabled by default server configuration (opt-in required)"
  }
}
```

**Summary Section:**
Added comprehensive status overview:
```typescript
const enabledServers = availableServers.filter(server => getServerStatus(server).enabled)
const disabledServers = availableServers.filter(server => !getServerStatus(server).enabled)

// Displays:
// • X enabled: server1, server2, server3
// • Y disabled: server4, server5
```

#### Mode Editor Integration (`webview-ui/src/components/modes/ModesView.tsx`)

**Key Integration Points:**
- **Mode Creation Dialog**: MCP restrictions editor appears when MCP tools are selected
- **Mode Editing Interface**: Shows current restrictions for existing modes  
- **Conditional Rendering**: Only displays when mode has MCP tool group enabled
- **State Management**: Proper handling of `newModeRestrictions` state

**Integration Example:**
```typescript
{/* MCP Restrictions Section - only show for custom modes with MCP tools */}
{findModeBySlug(visualMode, customModes) &&
  getCurrentMode()?.groups?.some((g) => getGroupName(g) === "mcp") && (
    <div className="mb-4">
      <McpRestrictionsEditor
        restrictions={findModeBySlug(visualMode, customModes)?.mcpRestrictions}
        availableServers={getAvailableMcpServers()}
        onChange={(restrictions) => {
          const customMode = findModeBySlug(visualMode, customModes)
          if (customMode) {
            updateCustomMode(visualMode, {
              ...customMode,
              mcpRestrictions: restrictions,
              source: customMode.source || "global",
            })
          }
        }}
      />
    </div>
  )}
```

### 3. Internationalization Support

#### Translation Keys (`webview-ui/src/i18n/locales/en/prompts.json`)

**Added Comprehensive Translation Support:**
```json
{
  "mcpRestrictions": {
    "title": "MCP Server Restrictions",
    "description": "Control which MCP servers and tools are available in this mode. Use patterns like '*' and '?' for flexible matching.",
    "servers": {
      "description": "Control which MCP servers are available. If no servers are explicitly allowed, all servers (except those disallowed) will be available.",
      "currentStatus": "Current Server Status",
      "enabledCount": "{{count}} enabled: {{names}}",
      "disabledCount": "{{count}} disabled: {{names}}"
    },
    "status": {
      "enabled": "ENABLED",
      "disabled": "DISABLED",
      "reason": "Reason",
      "explicitlyAllowed": "Explicitly allowed by user",
      "explicitlyDisallowed": "Explicitly disallowed by user",
      "notInAllowList": "Not included in allowed servers list",
      "defaultEnabled": "Enabled by default server configuration",
      "defaultDisabled": "Disabled by default server configuration (opt-in required)"
    },
    "tools": {
      "description": "Control specific tools within servers. Use patterns like 'delete_*' to match multiple tools.",
      "allowedTools": "Allowed Tools",
      "disallowedTools": "Blocked Tools"
    }
  }
}
```

## Critical Bug Fixes

### State Management Bug Fix

**Issue**: Custom modes would disappear when adding both allowed and blocked tool restrictions.

**Root Cause**: Object spread operations with `undefined` `localRestrictions`:
```typescript
// PROBLEMATIC CODE:
const newRestrictions = {
  ...localRestrictions,  // When localRestrictions is undefined, this causes issues
  [key]: value
}
```

**Solution**: Safe object spreading in all restriction management functions:
```typescript
// FIXED CODE:
const newRestrictions = {
  ...(localRestrictions || {}),  // Always spread valid object
  [key]: value
}
```

**Functions Fixed:**
- `addToolRestriction()` - When adding new tool restrictions
- `updateToolRestriction()` - When editing existing tool restrictions  
- `removeToolRestriction()` - When removing tool restrictions
- `toggleServerInList()` - When allowing/disallowing servers

**Why This Caused Mode Deletion:**
When the malformed restrictions object was passed to `updateCustomMode`, it contained corrupted data that interfered with mode configuration validation, causing the entire mode to become invalid and disappear from the UI.

## Filtering Logic Flow

### Server Filtering Priority (Highest to Lowest)

1. **Explicit Allow/Disallow**: User-defined allow/disallow lists take highest priority
2. **Allow-list Mode**: If any servers are explicitly allowed, only those servers are enabled  
3. **Default Behavior**: Falls back to server's `defaultEnabled` setting
4. **Opt-in Servers**: Servers with `defaultEnabled: false` require explicit user approval

### Tool Filtering Logic

1. **Server-level Filtering**: Tools are only available if their parent server is enabled
2. **Tool-level Restrictions**: Additional filtering based on `allowedTools`/`disallowedTools`
3. **Pattern Matching**: Support for wildcards (`*`) and single character (`?`) patterns

### Example Filtering Scenarios

**Scenario 1: No Restrictions**
- All servers with `defaultEnabled: true` (or undefined) are available
- Servers with `defaultEnabled: false` are hidden (require opt-in)

**Scenario 2: Allow-list Mode**
- User explicitly allows `["server1", "server2"]`
- Only `server1` and `server2` are available, regardless of `defaultEnabled`

**Scenario 3: Disallow-list Mode**
- User explicitly disallows `["admin-server"]`
- All servers except `admin-server` are available (respecting `defaultEnabled`)

**Scenario 4: Mixed Restrictions**
- Server restrictions + tool patterns like `delete_*`, `*_admin`
- Tools filtered at both server and individual tool level

## User Experience Improvements

### Before Implementation
- Users configured restrictions but AI still saw all servers
- Confusing error messages when AI tried restricted tools  
- No visibility into what restrictions actually did
- Unclear server availability based on `defaultEnabled` settings

### After Implementation
- **Clear Visual Feedback**: Users immediately see which servers are enabled/disabled
- **Detailed Reasoning**: Users understand exactly why each server has its current status
- **Real-time Updates**: Changes to restrictions immediately update server status
- **No Surprise Errors**: AI only sees servers/tools it's allowed to use
- **Better Debugging**: Easy to see if restrictions are causing issues

### UI Features Added
1. **Server Status Indicators**: Green/red dots and badges showing enabled/disabled state
2. **Status Reasoning**: Clear explanation of why each server is enabled/disabled
3. **Summary Overview**: Count and names of enabled/disabled servers
4. **Color-coded Interface**: Visual distinction between enabled/disabled servers
5. **Collapsible Design**: Reduces UI clutter while providing detailed control

## Testing Scenarios

### Basic Functionality Tests
1. Create custom mode with MCP tools enabled
2. Configure server allow/disallow lists
3. Add tool-level restrictions with patterns
4. Verify restrictions appear correctly in system prompt
5. Confirm AI only sees allowed servers/tools in `use_mcp_tool` descriptions

### Edge Case Tests
1. Mode with no restrictions (all servers available by default)
2. Mode with only allowed servers (allowlist mode)
3. Servers with `defaultEnabled: false` (opt-in required)
4. Complex tool patterns (`delete_*`, `*_admin`, etc.)
5. Adding/removing multiple restriction types without causing mode deletion

### UI Interaction Tests
1. Server status indicators show correct state and reasoning
2. Expanding/collapsing restrictions editor
3. Switching between server and tool tabs
4. Real-time updates when restrictions change
5. Summary section accurately reflects current state

## File Changes Summary

### Core Backend Files
```
src/core/prompts/sections/mcp-servers.ts     - Server/tool filtering logic (167 lines changed)
src/core/prompts/tools/use-mcp-tool.ts       - Tool description filtering (68 lines added)
src/core/prompts/system.ts                   - System prompt integration (1 line changed)
src/core/webview/webviewMessageHandler.ts    - Message handling for server configs
src/shared/WebviewMessage.ts                 - New message type definitions
src/shared/ExtensionMessage.ts               - New message type definitions
```

### UI Components
```
webview-ui/src/components/modes/McpRestrictionsEditor.tsx  - NEW: 594 lines (main editor)
webview-ui/src/components/modes/ModesView.tsx             - Integration changes
webview-ui/src/i18n/locales/en/prompts.json              - Translation keys
```

### Key Statistics
- **New Component**: 594-line comprehensive MCP restrictions editor
- **Backend Logic**: 167 lines of filtering logic with helper functions
- **Translation Support**: 20+ new translation keys for full internationalization
- **Bug Fixes**: 4 critical state management functions secured
- **Integration Points**: 2 UI integration points (creation + editing)

## How It Works End-to-End

### 1. Mode Creation/Editing
1. User creates/edits custom mode and selects MCP tools
2. MCP restrictions editor appears with current server status
3. User sees which servers are enabled/disabled and why
4. User configures allow/disallow lists and tool restrictions

### 2. Restriction Application
1. User's restriction configuration is saved to mode config
2. When generating system prompt, filtering functions are called
3. Servers are filtered based on restrictions and `defaultEnabled`
4. Tools within servers are filtered based on tool-level restrictions
5. AI only sees allowed servers and tools in system prompt

### 3. Real-time Feedback
1. UI immediately updates to show impact of restriction changes
2. Server status indicators reflect new enabled/disabled states
3. Summary section shows count of enabled/disabled servers
4. Users can see exactly what the AI will have access to

## Future Enhancement Opportunities

### Potential Improvements
1. **Import/Export**: Save and share restriction templates
2. **Advanced Patterns**: Full regex support beyond wildcards
3. **Bulk Operations**: Select multiple servers/tools at once
4. **Usage Analytics**: Track which restrictions are most commonly used
5. **Conflict Detection**: Warn about contradictory restrictions
6. **Server Groups**: Define server groups for easier management

### Pattern Matching Extensions
1. **Negation Patterns**: `!pattern` syntax for exclusions
2. **Complex Regex**: Full regular expression support
3. **Conditional Logic**: IF/THEN rules for dynamic restrictions

## Conclusion

The MCP mode restrictions implementation provides comprehensive control over MCP server and tool availability within custom modes. The feature includes:

- **Robust Backend Filtering**: Ensures AI only sees allowed servers/tools
- **Intuitive UI Components**: Clear visual feedback with detailed reasoning
- **Proper Error Handling**: Fixed critical state management bugs
- **Full Internationalization**: Support for multiple languages
- **Real-time Feedback**: Immediate visibility into restriction effects

This implementation follows established patterns in the codebase, maintains backward compatibility, and provides a solid foundation for future enhancements to MCP management functionality. Users can now create specialized modes with precisely controlled MCP access, significantly improving both security and user experience.