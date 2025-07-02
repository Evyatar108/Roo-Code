import React, { useState, useEffect, useRef } from "react"
import { VSCodeCheckbox, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { ChevronDown, ChevronUp, Info, Plus, X, Server, Wrench } from "lucide-react"

import { McpRestrictions, McpToolRestriction } from "@roo-code/types"

import { Button, StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn, patternMatching } from "@/lib/utils"

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

// ServerToolPicker component for enhanced server/tool selection
interface ServerToolPickerProps {
	value: string
	onSelect: (value: string) => void
	placeholder: string
	type: "server" | "tool"
	availableServers: McpServer[]
	selectedServerName?: string
	disabled?: boolean
}

function ServerToolPicker({ 
	value, 
	onSelect, 
	placeholder, 
	type, 
	availableServers, 
	selectedServerName, 
	disabled 
}: ServerToolPickerProps) {
	const { t } = useAppTranslation()
	const [isOpen, setIsOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const dropdownRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Get available options based on type
	const getOptions = () => {
		if (type === "server") {
			return availableServers.map(server => ({
				value: server.name,
				label: server.name,
				description: `${server.tools.length} tools available`,
				status: server.status,
				icon: <Server className="w-4 h-4" />
			}))
		} else {
			// Tool type - find tools for the selected server
			const server = availableServers.find(s => s.name === selectedServerName)
			if (!server) return []
			
			return server.tools.map(tool => ({
				value: tool.name,
				label: tool.name,
				description: tool.description || "No description available",
				status: "available" as const,
				icon: <Wrench className="w-4 h-4" />
			}))
		}
	}

	// Filter options based on search term with pattern support
	const filteredOptions = getOptions().filter(option => {
		const searchValue = value || searchTerm  // Use current input value or search term
		return patternMatching.matchesPattern(option.label, searchValue) || 
			   patternMatching.matchesPattern(option.description, searchValue)
	})

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Handle option selection
	const handleSelect = (optionValue: string) => {
		onSelect(optionValue)
		setIsOpen(false)
		setSearchTerm("")
	}

	// Handle input change - allow manual typing and searching
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value
		onSelect(inputValue)
		setSearchTerm(inputValue)
		setIsOpen(true)
	}

	// Show placeholder when no value is selected
	const displayValue = value || ""

	return (
		<div className="relative" ref={dropdownRef}>
			<div className="relative">
				<input
					ref={inputRef}
					type="text"
					value={displayValue}
					onChange={handleInputChange}
					onFocus={() => setIsOpen(true)}
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						"w-full px-3 py-2 text-sm bg-vscode-input-background border border-vscode-input-border rounded",
						"focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						"pr-8" // Make room for the dropdown arrow
					)}
				/>
				<Button
					variant="ghost"
					size="icon"
					className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
					onClick={() => setIsOpen(!isOpen)}
					disabled={disabled}>
					<ChevronDown className={cn("w-3 h-3 transition-transform", { "rotate-180": isOpen })} />
				</Button>
			</div>

			{/* Dropdown */}
			{isOpen && !disabled && (
				<div className={cn(
					"absolute z-50 w-full mt-1 bg-vscode-dropdown-background",
					"border border-vscode-dropdown-border rounded shadow-lg",
					"max-h-64 overflow-y-auto"
				)}>
					{filteredOptions.length === 0 ? (
						<div className="px-3 py-2 text-sm text-vscode-descriptionForeground">
							{type === "server" 
								? t("prompts:mcpRestrictions.picker.noServers")
								: selectedServerName 
									? t("prompts:mcpRestrictions.picker.noTools") 
									: t("prompts:mcpRestrictions.picker.selectServerFirst")
							}
						</div>
					) : (
						filteredOptions.map((option, index) => (
							<div
								key={option.value}
								className={cn(
									"flex items-center gap-3 px-3 py-2 cursor-pointer",
									"hover:bg-vscode-list-hoverBackground",
									"border-b border-vscode-dropdown-border last:border-b-0",
									{ "bg-vscode-list-activeSelectionBackground": value === option.value }
								)}
								onClick={() => handleSelect(option.value)}>
								
								{/* Icon */}
								<div className="flex-shrink-0 text-vscode-descriptionForeground">
									{option.icon}
								</div>

								{/* Content */}
								<div className="flex-grow min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-vscode-foreground truncate">
											{option.label}
										</span>
										{type === "server" && option.status && (
											<div className={cn("w-2 h-2 rounded-full flex-shrink-0", {
												"bg-green-500": option.status === "connected",
												"bg-red-500": option.status === "error",
												"bg-yellow-500": option.status === "disconnected"
											})} />
										)}
									</div>
									<div className="text-xs text-vscode-descriptionForeground truncate">
										{option.description}
									</div>
								</div>

								{/* Selection indicator */}
								{value === option.value && (
									<div className="flex-shrink-0 text-vscode-foreground">
										<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
										</svg>
									</div>
								)}
							</div>
						))
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

	return (
		<div className="flex items-center gap-2 p-3 border border-vscode-widget-border rounded bg-vscode-editor-background">
			{/* Server Name Picker */}
			<div className="flex-1">
				<div className="text-xs text-vscode-descriptionForeground mb-1">
					{t("prompts:mcpRestrictions.tools.serverName")}
				</div>
				<ServerToolPicker
					value={tool.serverName}
					onSelect={(value) => onUpdate("serverName", value)}
					placeholder={t("prompts:mcpRestrictions.tools.serverNamePlaceholder")}
					type="server"
					availableServers={availableServers}
					disabled={disabled}
				/>
			</div>

			{/* Tool Name Picker */}
			<div className="flex-1">
				<div className="text-xs text-vscode-descriptionForeground mb-1">
					{t("prompts:mcpRestrictions.tools.toolName")}
				</div>
				<ServerToolPicker
					value={tool.toolName}
					onSelect={(value) => onUpdate("toolName", value)}
					placeholder={t("prompts:mcpRestrictions.tools.toolNamePlaceholder")}
					type="tool"
					availableServers={availableServers}
					selectedServerName={tool.serverName}
					disabled={disabled}
				/>
			</div>

			{/* Remove Button */}
			<div className="flex-shrink-0 pt-4">
				<StandardTooltip content={t("prompts:mcpRestrictions.tools.remove")}>
					<Button variant="ghost" size="icon" onClick={onRemove} disabled={disabled}>
						<X className="w-4 h-4" />
					</Button>
				</StandardTooltip>
			</div>
		</div>
	)
}