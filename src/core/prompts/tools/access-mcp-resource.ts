import { ToolArgs } from "./types"
import { getModeBySlug } from "../../../shared/modes"

// Helper function for MCP server restriction checking
function isServerAllowedForMode(
	serverName: string,
	restrictions: any,
	serverDefaultEnabled?: boolean, // NEW: Server's defaultEnabled setting
): boolean {
	// NEW: Handle defaultEnabled logic first
	// If server has defaultEnabled: false, it must be explicitly allowed
	if (serverDefaultEnabled === false) {
		// Only allowed if explicitly in allowedServers list
		return restrictions.allowedServers ? restrictions.allowedServers.includes(serverName) : false
	}

	// EXISTING LOGIC: For defaultEnabled: true (default behavior)
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

export function getAccessMcpResourceDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}

	let availableServers = args.mcpHub.getServers()

	// Filter servers based on mode restrictions
	if (args.currentMode && args.customModes) {
		const mode = getModeBySlug(args.currentMode, args.customModes)
		const restrictions = mode?.mcpRestrictions || {} // Use empty object if no restrictions defined

		// Always filter based on defaultEnabled, even if no explicit restrictions
		availableServers = availableServers.filter((server) => {
			// Get server configuration to check defaultEnabled setting
			const serverConfig = args.mcpHub?.getServerConfig(server.name)
			const defaultEnabled = serverConfig?.defaultEnabled ?? true // Default to true if not specified

			return isServerAllowedForMode(server.name, restrictions, defaultEnabled)
		})
	}

	// Generate description with filtered servers and their available resources
	if (availableServers.length === 0) {
		return `## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.
**Note: No MCP servers are available for the current mode.**

This tool allows you to access resources provided by Model Context Protocol (MCP) servers, but the current mode has restrictions that prevent access to all configured MCP servers.

Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access`
	}

	const serverDescriptions = availableServers
		.map((server) => {
			const resourceCount = (server.resources || []).length
			const resourceTemplateCount = (server.resourceTemplates || []).length
			const totalResources = resourceCount + resourceTemplateCount

			return `**${server.name}**: ${totalResources} resource${totalResources !== 1 ? "s" : ""} available`
		})
		.join("\n")

	return `## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.

**Available servers for current mode:**
${serverDescriptions}

Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access

Usage:
<access_mcp_resource>
<server_name>server name here</server_name>
<uri>resource URI here</uri>
</access_mcp_resource>

Example: Requesting to access an MCP resource

<access_mcp_resource>
<server_name>weather-server</server_name>
<uri>weather://san-francisco/current</uri>
</access_mcp_resource>`
}
