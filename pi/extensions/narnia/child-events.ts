import { updateChildContract } from "./aggregation.ts";
import type { DelegateChildDetails } from "./delegate-contract.ts";

export type ChildEventState = {
	commandIndexByToolCallId: Map<string, number>;
	fileToolByToolCallId: Map<string, { name: string; path: string }>;
};

export function createChildEventState(): ChildEventState {
	return {
		commandIndexByToolCallId: new Map<string, number>(),
		fileToolByToolCallId: new Map<string, { name: string; path: string }>(),
	};
}

export function processChildJsonLine(child: DelegateChildDetails, state: ChildEventState, line: string): { assistantMessageChanged: boolean; toolExecutionStarted: boolean } {
	if (!line.trim()) return { assistantMessageChanged: false, toolExecutionStarted: false };

	let event: unknown;
	try {
		event = JSON.parse(line);
	} catch {
		return { assistantMessageChanged: false, toolExecutionStarted: false };
	}

	child.trace.stdoutBytes += Buffer.byteLength(line, "utf8") + 1;
	const eventType = typeof (event as { type?: unknown }).type === "string" ? (event as { type: string }).type : "unknown";
	child.trace.stdoutEventCounts[eventType] = (child.trace.stdoutEventCounts[eventType] ?? 0) + 1;
	const typedEvent = event as {
		type?: unknown;
		message?: {
			role?: unknown;
			content?: unknown;
			provider?: unknown;
			model?: unknown;
			usage?: unknown;
			stopReason?: unknown;
			errorMessage?: unknown;
		};
		toolCallId?: unknown;
		toolName?: unknown;
		args?: unknown;
		result?: unknown;
		isError?: unknown;
		messages?: unknown;
	};
	let assistantMessageChanged = false;
	let toolExecutionStarted = false;

	if (typedEvent.type === "message_end" && typedEvent.message?.role === "assistant") {
		assistantMessageChanged = true;
		let text = "";
		if (Array.isArray(typedEvent.message.content)) {
			for (const part of typedEvent.message.content) {
				if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
					text += (part as { text: string }).text;
				}
			}
		}
		if (text) {
			child.finalOutput = text;
			child.returnedOutput = text;
			updateChildContract(child);
		}

		child.metadata.usage.turns += 1;
		if (typedEvent.message.usage && typeof typedEvent.message.usage === "object") {
			const messageUsage = typedEvent.message.usage as {
				input?: unknown;
				output?: unknown;
				cacheRead?: unknown;
				cacheWrite?: unknown;
				totalTokens?: unknown;
				contextTokens?: unknown;
				cost?: unknown;
			};
			if (typeof messageUsage.input === "number" && Number.isFinite(messageUsage.input)) child.metadata.usage.input += messageUsage.input;
			if (typeof messageUsage.output === "number" && Number.isFinite(messageUsage.output)) child.metadata.usage.output += messageUsage.output;
			if (typeof messageUsage.cacheRead === "number" && Number.isFinite(messageUsage.cacheRead)) child.metadata.usage.cacheRead += messageUsage.cacheRead;
			if (typeof messageUsage.cacheWrite === "number" && Number.isFinite(messageUsage.cacheWrite)) child.metadata.usage.cacheWrite += messageUsage.cacheWrite;
			if (messageUsage.cost && typeof messageUsage.cost === "object") {
				const cost = messageUsage.cost as { total?: unknown };
				if (typeof cost.total === "number" && Number.isFinite(cost.total)) child.metadata.usage.cost += cost.total;
			} else if (typeof messageUsage.cost === "number" && Number.isFinite(messageUsage.cost)) child.metadata.usage.cost += messageUsage.cost;
			if (typeof messageUsage.totalTokens === "number" && Number.isFinite(messageUsage.totalTokens)) {
				child.metadata.usage.contextTokens = messageUsage.totalTokens;
			} else if (typeof messageUsage.contextTokens === "number" && Number.isFinite(messageUsage.contextTokens)) {
				child.metadata.usage.contextTokens = messageUsage.contextTokens;
			}
		}

		if (typeof typedEvent.message.provider === "string") child.metadata.provider = typedEvent.message.provider;
		if (typeof typedEvent.message.model === "string") child.metadata.model = typedEvent.message.model;
		if (typeof typedEvent.message.stopReason === "string") child.metadata.stopReason = typedEvent.message.stopReason;
		if (typeof typedEvent.message.errorMessage === "string") child.metadata.errorMessage = typedEvent.message.errorMessage;
	}

	if (typedEvent.type === "tool_execution_start" && typeof typedEvent.toolName === "string") {
		const args = typedEvent.args;
		child.metadata.tools.push({ name: typedEvent.toolName, args });

		if (args && typeof args === "object") {
			const objectArgs = args as { path?: unknown; file_path?: unknown; command?: unknown };
			const filePath = typeof objectArgs.path === "string" ? objectArgs.path : typeof objectArgs.file_path === "string" ? objectArgs.file_path : undefined;

			if (
				(typedEvent.toolName === "read" || typedEvent.toolName === "edit" || typedEvent.toolName === "write") &&
				filePath &&
				typeof typedEvent.toolCallId === "string"
			) {
				state.fileToolByToolCallId.set(typedEvent.toolCallId, { name: typedEvent.toolName, path: filePath });
			}

			if (typedEvent.toolName === "bash" && typeof objectArgs.command === "string") {
				const command = objectArgs.command;
				const commandIndex = child.metadata.commands.length;
				child.metadata.commands.push({
					command,
					isTest:
						/(^|[;&|\n]\s*)(npm|pnpm|yarn|bun)\s+(test|run\s+[^;&|\n]*test|exec\s+(vitest|jest|mocha)|vitest|jest|mocha)\b/i.test(command) ||
						/(^|[;&|\n]\s*)((python\s+-m\s+)?pytest|go\s+test|cargo\s+test|swift\s+test|deno\s+test|zig\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|ctest|rspec|make\s+test)\b/i.test(command),
				});
				if (typeof typedEvent.toolCallId === "string") state.commandIndexByToolCallId.set(typedEvent.toolCallId, commandIndex);
			}
		}
	}

	if (typedEvent.type === "tool_execution_start") {
		const toolName = typeof typedEvent.toolName === "string" ? typedEvent.toolName : "tool";
		child.returnedOutput = `Delegate child running: ${toolName}`;
		toolExecutionStarted = true;
	}

	if (typedEvent.type === "tool_execution_end" && typeof typedEvent.toolCallId === "string" && typedEvent.isError === false) {
		const fileTool = state.fileToolByToolCallId.get(typedEvent.toolCallId);
		if (fileTool && fileTool.name === "read" && !child.metadata.filesRead.includes(fileTool.path)) child.metadata.filesRead.push(fileTool.path);
		if (fileTool && (fileTool.name === "edit" || fileTool.name === "write") && !child.metadata.filesModified.includes(fileTool.path)) {
			child.metadata.filesModified.push(fileTool.path);
		}
	}

	if (typedEvent.type === "tool_execution_end" && typedEvent.toolName === "bash" && typeof typedEvent.toolCallId === "string") {
		const commandIndex = state.commandIndexByToolCallId.get(typedEvent.toolCallId);
		if (commandIndex !== undefined) {
			let exitCode: number | undefined;
			if (typedEvent.result && typeof typedEvent.result === "object") {
				const result = typedEvent.result as { content?: unknown; details?: unknown; exitCode?: unknown; code?: unknown; status?: unknown };
				for (const value of [result.exitCode, result.code, result.status]) {
					if (typeof value === "number" && Number.isFinite(value)) exitCode = value;
				}
				if (result.details && typeof result.details === "object") {
					const details = result.details as { exitCode?: unknown; code?: unknown; status?: unknown };
					for (const value of [details.exitCode, details.code, details.status]) {
						if (typeof value === "number" && Number.isFinite(value)) exitCode = value;
					}
				}
				let text = "";
				if (Array.isArray(result.content)) {
					for (const part of result.content) {
						if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
							text += (part as { text: string }).text;
						}
					}
				}
				const exitCodeMatch = text.match(/(?:Command exited with code|exited with code|exit code|exit status|\[exit)\s*(-?\d+)/i);
				if (exitCodeMatch) exitCode = Number(exitCodeMatch[1]);
			}
			if (exitCode === undefined && typedEvent.isError === false) exitCode = 0;
			if (exitCode !== undefined) child.metadata.commands[commandIndex] = { ...child.metadata.commands[commandIndex], exitCode };
		}
	}

	if (typedEvent.type === "agent_end" && Array.isArray(typedEvent.messages)) {
		for (const message of typedEvent.messages) {
			if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "assistant") continue;

			let text = "";
			const content = (message as { content?: unknown }).content;
			if (Array.isArray(content)) {
				for (const part of content) {
					if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
						text += (part as { text: string }).text;
					}
				}
			}
			if (text) {
				child.finalOutput = text;
				child.returnedOutput = text;
				updateChildContract(child);
			}
			if (typeof (message as { provider?: unknown }).provider === "string") child.metadata.provider = (message as { provider: string }).provider;
			if (typeof (message as { model?: unknown }).model === "string") child.metadata.model = (message as { model: string }).model;
			if (typeof (message as { stopReason?: unknown }).stopReason === "string") child.metadata.stopReason = (message as { stopReason: string }).stopReason;
			if (typeof (message as { errorMessage?: unknown }).errorMessage === "string") {
				child.metadata.errorMessage = (message as { errorMessage: string }).errorMessage;
			}
		}
	}

	return { assistantMessageChanged, toolExecutionStarted };
}
