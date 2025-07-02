import React, { useState, useEffect } from "react"
import { VSCodeCheckbox, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { ChevronDown, ChevronUp, Info, Plus, X } from "lucide-react"

import { McpRestrictions, McpToolRestriction } from "@roo-code/types"

import { Button, StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"

export interface McpServer {
	name: string
	status: "connected" | "disconnected" | "error"
	tools: Array<{ name: string; description?: string }>
	defaultEnabled?: boolean
}

interface McpRestrictionsEditorProps {
	restrictions?: McpRestrictions
	availableServers: McpServer[]
	onChange: (restrictions: McpRestrictions | undefined) => void
	disabled?: boolean
}

export function McpRestrictionsEditor({
	restrictions,
	availableServers,
	onChange,
	disabled = false,
}: McpRestrictionsEditorProps) {
	const { t } = useAppTranslation()

	// Local state for UI management
	const [isExpanded, setIsExpanded] = useState(false)
	const [activeTab, setActiveTab] = useState<"servers" | "tools">("servers")
	const [showAdvanced, setShowAdvanced] = useState(false)

	// Initialize local state when restrictions change
	const [localRestrictions, setLocalRestrictions] = useState<McpRestrictions | undefined>(restrictions)

	useEffect(() => {
		setLocalRestrictions(restrictions)
		// Auto-expand if there are existing restrictions
		if (restrictions && Object.keys(restrictions).length > 0) {
			setIsExpanded(true)
		}
	}, [restrictions])

	// Helper to update restrictions and notify parent
	const updateRestrictions = (newRestrictions: McpRestrictions | undefined) => {
		setLocalRestrictions(newRestrictions)
		onChange(newRestrictions)
	}

	// Helper to check if any restrictions are configured
	const hasRestrictions = localRestrictions && Object.keys(localRestrictions).length > 0

	// Helper to get current server lists
	const allowedServers = localRestrictions?.allowedServers ?? []
	const disallowedServers = localRestrictions?.disallowedServers ?? []
	const allowedTools = localRestrictions?.allowedTools ?? []
	const disallowedTools = localRestrictions?.disallowedTools ?? []

	// Helper to determine server status and reasoning
	const getServerStatus = (server: McpServer) => {
		const isExplicitlyAllowed = allowedServers.includes(server.name)
		const isExplicitlyDisallowed = disallowedServers.includes(server.name)
		const defaultEnabled = server.defaultEnabled !== false // Default to true if not specified

		if (isExplicitlyAllowed) {
			return {
				enabled: true,
				reason: "explicitlyAllowed" as const,
				reasonText: t("prompts:mcpRestrictions.status.explicitlyAllowed")
			}
		}

		if (isExplicitlyDisallowed) {
			return {
				enabled: false,
				reason: "explicitlyDisallowed" as const,
				reasonText: t("prompts:mcpRestrictions.status.explicitlyDisallowed")
			}
		}

		// If allowedServers list exists, server must be in it to be enabled
		if (allowedServers.length > 0) {
			return {
				enabled: false,
				reason: "notInAllowList" as const,
				reasonText: t("prompts:mcpRestrictions.status.notInAllowList")
			}
		}

		// No explicit restrictions, use defaultEnabled
		if (defaultEnabled) {
			return {
				enabled: true,
				reason: "defaultEnabled" as const,
				reasonText: t("prompts:mcpRestrictions.status.defaultEnabled")
			}
		} else {
			return {
				enabled: false,
				reason: "defaultDisabled" as const,
				reasonText: t("prompts:mcpRestrictions.status.defaultDisabled")
			}
		}
	}

	// Server management functions
	const toggleServerInList = (serverName: string, listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedServers : disallowedServers
		const otherListType = listType === "allowed" ? "disallowed" : "allowed"
		const otherList = listType === "allowed" ? disallowedServers : allowedServers

		let newRestrictions = { ...(localRestrictions || {}) } // Ensure we always have a valid object to spread

		if (currentList.includes(serverName)) {
			// Remove from current list
			const updatedList = currentList.filter((s) => s !== serverName)
			if (listType === "allowed") {
				newRestrictions.allowedServers = updatedList.length > 0 ? updatedList : undefined
			} else {
				newRestrictions.disallowedServers = updatedList.length > 0 ? updatedList : undefined
			}
		} else {
			// Add to current list and remove from other list if present
			const updatedCurrentList = [...currentList, serverName]
			const updatedOtherList = otherList.filter((s) => s !== serverName)

			if (listType === "allowed") {
				newRestrictions.allowedServers = updatedCurrentList
				newRestrictions.disallowedServers = updatedOtherList.length > 0 ? updatedOtherList : undefined
			} else {
				newRestrictions.disallowedServers = updatedCurrentList
				newRestrictions.allowedServers = updatedOtherList.length > 0 ? updatedOtherList : undefined
			}
		}

		// Clean up empty restrictions
		if (Object.values(newRestrictions).every((list) => !list || list.length === 0)) {
			newRestrictions = {}
		}

		updateRestrictions(Object.keys(newRestrictions).length > 0 ? newRestrictions : undefined)
	}

	// Tool management functions
	const addToolRestriction = (listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const newTool: McpToolRestriction = { serverName: "", toolName: "" }
		const updatedList = [...currentList, newTool]

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]: updatedList,
		}

		updateRestrictions(newRestrictions)
	}

	const updateToolRestriction = (
		index: number,
		listType: "allowed" | "disallowed",
		field: "serverName" | "toolName",
		value: string,
	) => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const updatedList = [...currentList]
		updatedList[index] = { ...updatedList[index], [field]: value }

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]: updatedList,
		}

		updateRestrictions(newRestrictions)
	}

	const removeToolRestriction = (index: number, listType: "allowed" | "disallowed") => {
		const currentList = listType === "allowed" ? allowedTools : disallowedTools
		const updatedList = currentList.filter((_, i) => i !== index)

		const newRestrictions = {
			...(localRestrictions || {}), // Ensure we always have a valid object to spread
			[listType === "allowed" ? "allowedTools" : "disallowedTools"]:
				updatedList.length > 0 ? updatedList : undefined,
		}

		// Clean up empty restrictions
		if (Object.values(newRestrictions).every((list) => !list || list.length === 0)) {
			updateRestrictions(undefined)
		} else {
			updateRestrictions(newRestrictions)
		}
	}

	const clearAllRestrictions = () => {
		updateRestrictions(undefined)
		setIsExpanded(false)
	}

	if (availableServers.length === 0) {
		return (
			<div className="mb-4">
				<div className="font-bold mb-1">{t("prompts:mcpRestrictions.title")}</div>
				<div className="text-sm text-vscode-descriptionForeground p-3 border border-vscode-widget-border rounded">
					<Info className="inline w-4 h-4 mr-2" />
					{t("prompts:mcpRestrictions.noServersAvailable")}
				</div>
			</div>
		)
	}

	return (
		<div className="mb-4">
			<div className="flex justify-between items-center mb-1">
				<div className="font-bold">{t("prompts:mcpRestrictions.title")}</div>
				<div className="flex gap-2">
					{hasRestrictions && (
						<StandardTooltip content={t("prompts:mcpRestrictions.clearAll")}>
							<Button variant="ghost" size="icon" onClick={clearAllRestrictions} disabled={disabled}>
								<X className="w-4 h-4" />
							</Button>
						</StandardTooltip>
					)}
					<StandardTooltip
						content={isExpanded ? t("prompts:mcpRestrictions.collapse") : t("prompts:mcpRestrictions.expand")}>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsExpanded(!isExpanded)}
							disabled={disabled}>
							{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
						</Button>
					</StandardTooltip>
				</div>
			</div>

			<div className="text-sm text-vscode-descriptionForeground mb-2">
				{t("prompts:mcpRestrictions.description")}
			</div>

			{hasRestrictions && !isExpanded && (
				<div className="text-sm text-vscode-foreground mb-2 p-2 bg-vscode-editor-background border border-vscode-widget-border rounded">
					{t("prompts:mcpRestrictions.restrictionsConfigured", {
						count: [allowedServers, disallowedServers, allowedTools, disallowedTools].filter(
							(list) => list.length > 0,
						).length,
					})}
				</div>
			)}

			{isExpanded && (
				<div className="border border-vscode-widget-border rounded p-3 space-y-4">
					{/* Tab Navigation */}
					<div className="flex gap-1 border-b border-vscode-widget-border">
						<Button
							variant={activeTab === "servers" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("servers")}
							disabled={disabled}
							className="rounded-b-none">
							{t("prompts:mcpRestrictions.tabs.servers")}
						</Button>
						<Button
							variant={activeTab === "tools" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setActiveTab("tools")}
							disabled={disabled}
							className="rounded-b-none">
							{t("prompts:mcpRestrictions.tabs.tools")}
						</Button>
					</div>

					{/* Server Restrictions Tab */}
					{activeTab === "servers" && (
						<div className="space-y-4">
							<div className="text-sm text-vscode-descriptionForeground">
								{t("prompts:mcpRestrictions.servers.description")}
							</div>

							{/* Server List */}
							<div className="space-y-2">
								{availableServers.map((server) => {
									const isAllowed = allowedServers.includes(server.name)
									const isDisallowed = disallowedServers.includes(server.name)
									const status = getServerStatus(server)

									return (
										<div
											key={server.name}
											className={`flex items-center justify-between p-3 border rounded ${
												status.enabled 
													? "border-green-600/30 bg-green-600/5" 
													: "border-red-600/30 bg-red-600/5"
											}`}>
											<div className="flex items-center gap-3">
												{/* Status Indicator */}
												<div className="flex items-center gap-2">
													<div className={`w-3 h-3 rounded-full ${
														status.enabled 
															? "bg-green-500" 
															: "bg-red-500"
													}`} />
													<div className="flex flex-col">
														<div className="font-medium flex items-center gap-2">
															{server.name}
															<span className={`text-xs px-2 py-0.5 rounded ${
																status.enabled 
																	? "bg-green-600/20 text-green-300" 
																	: "bg-red-600/20 text-red-300"
															}`}>
																{status.enabled ? t("prompts:mcpRestrictions.status.enabled") : t("prompts:mcpRestrictions.status.disabled")}
															</span>
														</div>
														<div className="text-xs text-vscode-descriptionForeground">
															{server.tools.length} {t("prompts:mcpRestrictions.servers.toolsCount")}
															{server.defaultEnabled === false && (
																<span className="ml-2 text-vscode-editorWarning-foreground">
																	({t("prompts:mcpRestrictions.servers.optIn")})
																</span>
															)}
														</div>
														<div className="text-xs text-vscode-descriptionForeground mt-1">
															<strong>{t("prompts:mcpRestrictions.status.reason")}:</strong> {status.reasonText}
														</div>
													</div>
												</div>
											</div>
											<div className="flex gap-2">
												<Button
													variant={isAllowed ? "secondary" : "ghost"}
													size="sm"
													onClick={() => toggleServerInList(server.name, "allowed")}
													disabled={disabled}
													className={isAllowed ? "bg-green-600/20 border-green-600/50" : ""}>
													{t("prompts:mcpRestrictions.servers.allow")}
												</Button>
												<Button
													variant={isDisallowed ? "secondary" : "ghost"}
													size="sm"
													onClick={() => toggleServerInList(server.name, "disallowed")}
													disabled={disabled}
													className={isDisallowed ? "bg-red-600/20 border-red-600/50" : ""}>
													{t("prompts:mcpRestrictions.servers.disallow")}
												</Button>
											</div>
										</div>
									)
								})}
							</div>

							{/* Server Restrictions Summary */}
							<div className="text-sm text-vscode-descriptionForeground p-3 bg-vscode-editor-background border border-vscode-widget-border rounded">
								<div className="font-medium mb-2">{t("prompts:mcpRestrictions.servers.currentStatus")}</div>
								{(() => {
									const enabledServers = availableServers.filter(server => getServerStatus(server).enabled)
									const disabledServers = availableServers.filter(server => !getServerStatus(server).enabled)
									
									return (
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 rounded-full bg-green-500" />
												<span>
													{t("prompts:mcpRestrictions.servers.enabledCount", { 
														count: enabledServers.length,
														names: enabledServers.map(s => s.name).join(", ") || "None"
													})}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="w-2 h-2 rounded-full bg-red-500" />
												<span>
													{t("prompts:mcpRestrictions.servers.disabledCount", { 
														count: disabledServers.length,
														names: disabledServers.map(s => s.name).join(", ") || "None"
													})}
												</span>
											</div>
										</div>
									)
								})()}
							</div>
							
							{/* Legacy Server Restrictions Summary */}
							{(allowedServers.length > 0 || disallowedServers.length > 0) && (
								<div className="text-sm text-vscode-descriptionForeground p-2 bg-vscode-editor-background border border-vscode-widget-border rounded">
									{allowedServers.length > 0 && (
										<div>
											<strong>{t("prompts:mcpRestrictions.servers.allowedServers")}:</strong>{" "}
											{allowedServers.join(", ")}
										</div>
									)}
									{disallowedServers.length > 0 && (
										<div>
											<strong>{t("prompts:mcpRestrictions.servers.disallowedServers")}:</strong>{" "}
											{disallowedServers.join(", ")}
										</div>
									)}
								</div>
							)}
						</div>
					)}

					{/* Tool Restrictions Tab */}
					{activeTab === "tools" && (
						<div className="space-y-4">
							<div className="text-sm text-vscode-descriptionForeground">
								{t("prompts:mcpRestrictions.tools.description")}
							</div>

							{/* Allowed Tools */}
							<div>
								<div className="flex justify-between items-center mb-2">
									<div className="font-medium text-sm">
										{t("prompts:mcpRestrictions.tools.allowedTools")}
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => addToolRestriction("allowed")}
										disabled={disabled}>
										<Plus className="w-4 h-4 mr-1" />
										{t("prompts:mcpRestrictions.tools.addAllowed")}
									</Button>
								</div>
								{allowedTools.length === 0 ? (
									<div className="text-sm text-vscode-descriptionForeground p-2 border border-vscode-widget-border rounded">
										{t("prompts:mcpRestrictions.tools.noAllowedTools")}
									</div>
								) : (
									<div className="space-y-2">
										{allowedTools.map((tool, index) => (
											<ToolRestrictionRow
												key={index}
												tool={tool}
												availableServers={availableServers}
												onUpdate={(field, value) =>
													updateToolRestriction(index, "allowed", field, value)
												}
												onRemove={() => removeToolRestriction(index, "allowed")}
												disabled={disabled}
											/>
										))}
									</div>
								)}
							</div>

							{/* Disallowed Tools */}
							<div>
								<div className="flex justify-between items-center mb-2">
									<div className="font-medium text-sm">
										{t("prompts:mcpRestrictions.tools.disallowedTools")}
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => addToolRestriction("disallowed")}
										disabled={disabled}>
										<Plus className="w-4 h-4 mr-1" />
										{t("prompts:mcpRestrictions.tools.addDisallowed")}
									</Button>
								</div>
								{disallowedTools.length === 0 ? (
									<div className="text-sm text-vscode-descriptionForeground p-2 border border-vscode-widget-border rounded">
										{t("prompts:mcpRestrictions.tools.noDisallowedTools")}
									</div>
								) : (
									<div className="space-y-2">
										{disallowedTools.map((tool, index) => (
											<ToolRestrictionRow
												key={index}
												tool={tool}
												availableServers={availableServers}
												onUpdate={(field, value) =>
													updateToolRestriction(index, "disallowed", field, value)
												}
												onRemove={() => removeToolRestriction(index, "disallowed")}
												disabled={disabled}
											/>
										))}
									</div>
								)}
							</div>

							{/* Advanced Patterns */}
							<div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowAdvanced(!showAdvanced)}
									disabled={disabled}
									className="w-full justify-start">
									{showAdvanced ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
									{t("prompts:mcpRestrictions.tools.advancedPatterns")}
								</Button>
								{showAdvanced && (
									<div className="mt-2 p-3 bg-vscode-editor-background border border-vscode-widget-border rounded text-sm">
										<div className="font-medium mb-2">{t("prompts:mcpRestrictions.patterns.title")}</div>
										<div className="space-y-1 text-vscode-descriptionForeground">
											<div>
												<code>*</code> - {t("prompts:mcpRestrictions.patterns.wildcard")}
											</div>
											<div>
												<code>?</code> - {t("prompts:mcpRestrictions.patterns.singleChar")}
											</div>
											<div className="mt-2">
												<strong>{t("prompts:mcpRestrictions.patterns.examples")}:</strong>
											</div>
											<div>
												<code>docs-*</code> - {t("prompts:mcpRestrictions.patterns.example1")}
											</div>
											<div>
												<code>*-admin</code> - {t("prompts:mcpRestrictions.patterns.example2")}
											</div>
											<div>
												<code>delete_*</code> - {t("prompts:mcpRestrictions.patterns.example3")}
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// Helper component for tool restriction rows
interface ToolRestrictionRowProps {
	tool: McpToolRestriction
	availableServers: McpServer[]
	onUpdate: (field: "serverName" | "toolName", value: string) => void
	onRemove: () => void
	disabled?: boolean
}

function ToolRestrictionRow({ tool, availableServers, onUpdate, onRemove, disabled }: ToolRestrictionRowProps) {
	const { t } = useAppTranslation()

	// Get tools for selected server
	const selectedServer = availableServers.find((s) => s.name === tool.serverName)
	const availableTools = selectedServer?.tools ?? []

	return (
		<div className="flex items-center gap-2 p-2 border border-vscode-widget-border rounded">
			{/* Server Name Input */}
			<div className="flex-1">
				<input
					type="text"
					value={tool.serverName}
					onChange={(e) => onUpdate("serverName", e.target.value)}
					placeholder={t("prompts:mcpRestrictions.tools.serverNamePlaceholder")}
					disabled={disabled}
					className="w-full px-2 py-1 text-sm bg-vscode-input-background border border-vscode-input-border rounded"
					list={`servers-${tool.serverName}-${tool.toolName}`}
				/>
				<datalist id={`servers-${tool.serverName}-${tool.toolName}`}>
					{availableServers.map((server) => (
						<option key={server.name} value={server.name} />
					))}
				</datalist>
			</div>

			{/* Tool Name Input */}
			<div className="flex-1">
				<input
					type="text"
					value={tool.toolName}
					onChange={(e) => onUpdate("toolName", e.target.value)}
					placeholder={t("prompts:mcpRestrictions.tools.toolNamePlaceholder")}
					disabled={disabled}
					className="w-full px-2 py-1 text-sm bg-vscode-input-background border border-vscode-input-border rounded"
					list={`tools-${tool.serverName}-${tool.toolName}`}
				/>
				<datalist id={`tools-${tool.serverName}-${tool.toolName}`}>
					{availableTools.map((toolItem) => (
						<option key={toolItem.name} value={toolItem.name} />
					))}
				</datalist>
			</div>

			{/* Remove Button */}
			<StandardTooltip content={t("prompts:mcpRestrictions.tools.remove")}>
				<Button variant="ghost" size="icon" onClick={onRemove} disabled={disabled}>
					<X className="w-4 h-4" />
				</Button>
			</StandardTooltip>
		</div>
	)
}