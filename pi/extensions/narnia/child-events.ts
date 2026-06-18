import type { DelegateChildDetails } from "./delegate-contract.ts";

const NODE_TEST_COMMAND_PATTERN = /(^|[;&|\n]\s*)(npm|pnpm|yarn|bun)\s+(test|run\s+[^;&|\n]*test|exec\s+(vitest|jest|mocha)|vitest|jest|mocha)\b/i;
const OTHER_TEST_COMMAND_PATTERN = /(^|[;&|\n]\s*)((python\s+-m\s+)?pytest|go\s+test|cargo\s+test|swift\s+test|deno\s+test|zig\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|ctest|rspec|make\s+test)\b/i;

type ChildJsonEvent = {
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
	const typedEvent = event as ChildJsonEvent;
	const eventType = typeof typedEvent.type === "string" ? typedEvent.type : "unknown";
	child.trace.stdoutEventCounts[eventType] = (child.trace.stdoutEventCounts[eventType] ?? 0) + 1;

	if (eventType === "message_end") {
		const message = typedEvent.message;
		if (message?.role !== "assistant") return { assistantMessageChanged: false, toolExecutionStarted: false };

		let text = "";
		if (Array.isArray(message.content)) {
			for (const part of message.content) {
				if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
					text += (part as { text: string }).text;
				}
			}
		}
		if (text) {
			child.finalOutput = text;
			child.returnedOutput = text;
		}

		child.metadata.usage.turns += 1;
		if (message.usage && typeof message.usage === "object") {
			const messageUsage = message.usage as {
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

		if (typeof message.provider === "string") child.metadata.provider = message.provider;
		if (typeof message.model === "string") child.metadata.model = message.model;
		if (typeof message.stopReason === "string") child.metadata.stopReason = message.stopReason;
		if (typeof message.errorMessage === "string") child.metadata.errorMessage = message.errorMessage;

		return { assistantMessageChanged: true, toolExecutionStarted: false };
	}

	if (eventType === "tool_execution_start") {
		if (typeof typedEvent.toolName === "string") {
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
						isTest: NODE_TEST_COMMAND_PATTERN.test(command) || OTHER_TEST_COMMAND_PATTERN.test(command),
					});
					if (typeof typedEvent.toolCallId === "string") state.commandIndexByToolCallId.set(typedEvent.toolCallId, commandIndex);
				}
			}
		}

		const toolName = typeof typedEvent.toolName === "string" ? typedEvent.toolName : "tool";
		child.returnedOutput = `Delegate child running: ${toolName}`;
		return { assistantMessageChanged: false, toolExecutionStarted: true };
	}

	if (eventType === "tool_execution_end") {
		if (typeof typedEvent.toolCallId !== "string") return { assistantMessageChanged: false, toolExecutionStarted: false };

		if (typedEvent.isError === false) {
			const fileTool = state.fileToolByToolCallId.get(typedEvent.toolCallId);
			if (fileTool && fileTool.name === "read" && !child.metadata.filesRead.includes(fileTool.path)) child.metadata.filesRead.push(fileTool.path);
			if (fileTool && (fileTool.name === "edit" || fileTool.name === "write") && !child.metadata.filesModified.includes(fileTool.path)) {
				child.metadata.filesModified.push(fileTool.path);
			}
		}

		if (typedEvent.toolName === "bash") {
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

		return { assistantMessageChanged: false, toolExecutionStarted: false };
	}

	if (eventType === "agent_end") {
		if (!Array.isArray(typedEvent.messages)) return { assistantMessageChanged: false, toolExecutionStarted: false };

		for (const message of typedEvent.messages) {
			if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "assistant") continue;

			const messageObject = message as { content?: unknown; provider?: unknown; model?: unknown; stopReason?: unknown; errorMessage?: unknown };
			let text = "";
			if (Array.isArray(messageObject.content)) {
				for (const part of messageObject.content) {
					if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
						text += (part as { text: string }).text;
					}
				}
			}
			if (text) {
				child.finalOutput = text;
				child.returnedOutput = text;
			}
			if (typeof messageObject.provider === "string") child.metadata.provider = messageObject.provider;
			if (typeof messageObject.model === "string") child.metadata.model = messageObject.model;
			if (typeof messageObject.stopReason === "string") child.metadata.stopReason = messageObject.stopReason;
			if (typeof messageObject.errorMessage === "string") child.metadata.errorMessage = messageObject.errorMessage;
		}
	}

	return { assistantMessageChanged: false, toolExecutionStarted: false };
}
