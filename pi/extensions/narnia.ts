import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getMarkdownTheme, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type NarniaState = {
	enabled: boolean;
};

type DelegateChildStatus = "running" | "completed" | "failed";

type DelegateChildDetails = {
	index: number;
	task: string;
	status: DelegateChildStatus;
	startedAt: number;
	endedAt: number;
	durationMs: number;
	exitCode: number;
	trace: {
		stdoutBytes: number;
		stdoutEventCounts: Record<string, number>;
	};
	stderr: string;
	finalOutput: string;
	returnedOutput: string;
	contractMissingSections: string[];
	metadata: {
		filesRead: string[];
		filesModified: string[];
		tools: Array<{ name: string; args: unknown }>;
		commands: Array<{ command: string; exitCode?: number; isTest: boolean }>;
		usage: {
			input: number;
			output: number;
			cacheRead: number;
			cacheWrite: number;
			cost: number;
			contextTokens: number;
			turns: number;
		};
		provider?: string;
		model?: string;
		stopReason?: string;
		errorMessage?: string;
	};
};

type DelegateDetails = Omit<DelegateChildDetails, "index" | "task" | "status"> & {
	tasks: string[];
	children: DelegateChildDetails[];
};

const CUSTOM_TYPE = "narnia";
const BLOCK_REASON = "Narnia Mode: root session cannot call tools directly. Use delegate with tasks: string[].";
const RETURNED_OUTPUT_CAP_BYTES = 12 * 1024;
const CHILD_REQUIRED_SECTIONS = [
	"## Result",
	"## Changed",
	"## Inspected",
	"## Commands",
	"## Decisions",
	"## Risks",
	"## Needs Parent/User",
];
const CHILD_BOOTSTRAP = `You are a Narnia child Pi process. Complete the delegated task directly with the available tools. Do not use delegate or ask for recursive delegation. Keep work bounded to the task. Final output must use this exact markdown shape:

## Result
Short outcome.

## Changed
- path: what changed

## Inspected
- path: why relevant

## Commands
- command: pass/fail + important output only

## Decisions
- decision: rationale

## Risks
- unresolved risk / none

## Needs Parent/User
- question / none`;
const NARNIA_ROOT_PROMPT = "Narnia mode is enabled. Root session is a delegate-only orchestrator. Use only delegate for file, shell, web, edit, and test work. Delegate as many independent tasks in parallel as needed. Always look for work that can be parallelized before delegating. Delegate bounded tasks with enough context. Keep root context compact. Do not ask child agents to recursively delegate.";

function formatTokens(count: number): string {
	const tokens = Math.max(0, Number.isFinite(count) ? count : 0);

	if (tokens < 1_000) return `${Math.round(tokens)}`;
	if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	return `${Math.round(tokens / 1_000_000)}M`;
}

function isNarniaState(data: unknown): data is NarniaState {
	return !!data && typeof data === "object" && typeof (data as { enabled?: unknown }).enabled === "boolean";
}

function narniaExtension(pi: ExtensionAPI): void {
	if (process.env.PI_NARNIA_CHILD === "1") return;

	let state: NarniaState | undefined;
	let delegateRegistered = false;
	let activeDelegateCalls = 0;

	function updateStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		const usage = ctx.getContextUsage();
		const tokens = usage?.tokens === null || usage?.tokens === undefined ? "" : ` · ctx ${formatTokens(usage.tokens)}`;
		const hasRunningDelegates = activeDelegateCalls > 0;
		const status = hasRunningDelegates ? "child running" : state?.enabled ? "on" : "off";
		ctx.ui.setStatus(CUSTOM_TYPE, ctx.ui.theme.fg(hasRunningDelegates ? "warning" : "dim", `Narnia: ${status}${tokens}`));
	}

	function ensureDelegateRegistered(): void {
		if (delegateRegistered) return;
		delegateRegistered = true;

		pi.registerTool({
			name: "delegate",
			label: "Delegate",
			description: "Delegate bounded tasks to isolated child Pi processes.",
			promptSnippet: "Run bounded file, shell, web, edit, and test work outside the root session.",
			promptGuidelines: [
				"Use delegate for bounded file, shell, web, edit, and test work while Narnia mode is enabled.",
				"Do not ask delegate to recursively delegate.",
			],
			parameters: Type.Object(
				{
					tasks: Type.Array(Type.String({ description: "Bounded task for a child Pi process." }), {
						description: "Bounded tasks for child Pi processes.",
					}),
				},
				{ additionalProperties: false },
			),
			async execute(
				_toolCallId,
				params,
				signal,
				onUpdate,
				ctx,
			): Promise<{ content: [{ type: "text"; text: string }]; details: DelegateDetails }> {
				const startedAt = Date.now();
				const paramsObject = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
				const makeRejectedDetails = (returnedOutput: string, tasks: string[] = []): DelegateDetails => {
					const endedAt = Date.now();
					const lines = returnedOutput.split(/\r?\n/).map((line) => line.trim());
					return {
						tasks,
						children: [],
						startedAt,
						endedAt,
						durationMs: endedAt - startedAt,
						exitCode: 1,
						trace: {
							stdoutBytes: 0,
							stdoutEventCounts: {},
						},
						stderr: "",
						finalOutput: returnedOutput,
						returnedOutput,
						contractMissingSections: CHILD_REQUIRED_SECTIONS.filter((section) => !lines.includes(section)),
						metadata: {
							filesRead: [],
							filesModified: [],
							tools: [],
							commands: [],
							usage: {
								input: 0,
								output: 0,
								cacheRead: 0,
								cacheWrite: 0,
								cost: 0,
								contextTokens: 0,
								turns: 0,
							},
						},
					};
				};

				if ("task" in paramsObject) {
					const returnedOutput = "Delegate accepts only tasks: string[]. Use delegate({ tasks: [...] }).";
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeRejectedDetails(returnedOutput),
					};
				}

				if (!("tasks" in paramsObject)) {
					const returnedOutput = "Delegate tasks is required.";
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeRejectedDetails(returnedOutput),
					};
				}

				if (!Array.isArray(paramsObject.tasks)) {
					const returnedOutput = "Delegate tasks must be an array.";
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeRejectedDetails(returnedOutput),
					};
				}

				if (paramsObject.tasks.length === 0) {
					const returnedOutput = "Delegate tasks must contain at least one task.";
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeRejectedDetails(returnedOutput),
					};
				}

				const tasks: string[] = [];
				for (let index = 0; index < paramsObject.tasks.length; index++) {
					const rawTask = paramsObject.tasks[index];
					if (typeof rawTask !== "string") {
						const returnedOutput = `Delegate task ${index + 1} must be a string.`;
						return {
							content: [{ type: "text", text: returnedOutput }],
							details: makeRejectedDetails(returnedOutput, tasks),
						};
					}
					const task = rawTask.trim();
					if (!task) {
						const returnedOutput = `Delegate task ${index + 1} is empty.`;
						return {
							content: [{ type: "text", text: returnedOutput }],
							details: makeRejectedDetails(returnedOutput, tasks),
						};
					}
					tasks.push(task);
				}

				// Do not persist raw child JSON events here. They include streaming message_update payloads and can make parent sessions hundreds of MB.
				// If full child traces are needed later, write them to an opt-in external trace file with retention, not session details.
				const children: DelegateChildDetails[] = tasks.map((task, index) => ({
					index,
					task,
					status: "running",
					startedAt,
					endedAt: startedAt,
					durationMs: 0,
					exitCode: -1,
					trace: {
						stdoutBytes: 0,
						stdoutEventCounts: {},
					},
					stderr: "",
					finalOutput: "",
					returnedOutput: "Delegate child running...",
					contractMissingSections: [...CHILD_REQUIRED_SECTIONS],
					metadata: {
						filesRead: [],
						filesModified: [],
						tools: [],
						commands: [],
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							cost: 0,
							contextTokens: 0,
							turns: 0,
						},
					},
				}));

				const updateChildContract = (child: DelegateChildDetails) => {
					const lines = child.finalOutput.split(/\r?\n/).map((line) => line.trim());
					child.contractMissingSections = CHILD_REQUIRED_SECTIONS.filter((section) => !lines.includes(section));
				};

				const childFailed = (child: DelegateChildDetails) =>
					child.status === "failed" ||
					(child.exitCode !== -1 &&
						(child.exitCode !== 0 || child.metadata.stopReason === "error" || child.metadata.stopReason === "aborted"));
				const childSucceeded = (child: DelegateChildDetails) => child.status === "completed" || (child.exitCode !== -1 && !childFailed(child));

				const buildChildReturnedOutput = (child: DelegateChildDetails): string => {
					const failed = childFailed(child);
					const output = child.finalOutput || child.metadata.errorMessage || child.stderr.trim() || "(no output)";
					return failed
						? `Delegate failed${child.metadata.stopReason ? ` (${child.metadata.stopReason})` : ""}${child.exitCode !== -1 && child.exitCode !== 0 ? ` [exit ${child.exitCode}]` : ""}.\n\n${output}`
						: output;
				};

				const capReturnedOutput = (returnedOutput: string): string => {
					if (Buffer.byteLength(returnedOutput, "utf8") <= RETURNED_OUTPUT_CAP_BYTES) return returnedOutput;

					const truncationNotice = "\n\n[Delegate output truncated to 12KB. Full per-child output preserved in tool details.]";
					let cappedOutput = returnedOutput.slice(0, RETURNED_OUTPUT_CAP_BYTES - Buffer.byteLength(truncationNotice, "utf8"));
					while (Buffer.byteLength(`${cappedOutput}${truncationNotice}`, "utf8") > RETURNED_OUTPUT_CAP_BYTES) {
						cappedOutput = cappedOutput.slice(0, -1);
					}
					return `${cappedOutput.trimEnd()}${truncationNotice}`;
				};

				const buildAggregateReturnedOutput = (): string => {
					let returnedOutput = `${children.filter(childSucceeded).length}/${children.length} tasks succeeded.`;
					for (const child of children) {
						returnedOutput += `\n\n## Task ${child.index + 1}\n\n${child.returnedOutput || "Delegate child running..."}`;
					}
					return capReturnedOutput(returnedOutput);
				};

				const cloneChild = (child: DelegateChildDetails, endedAt: number): DelegateChildDetails => {
					const childEndedAt = child.exitCode === -1 ? endedAt : child.endedAt;
					return {
						index: child.index,
						task: child.task,
						status: child.status,
						startedAt: child.startedAt,
						endedAt: childEndedAt,
						durationMs: Math.max(0, childEndedAt - child.startedAt),
						exitCode: child.exitCode,
						trace: {
							stdoutBytes: child.trace.stdoutBytes,
							stdoutEventCounts: { ...child.trace.stdoutEventCounts },
						},
						stderr: child.stderr,
						finalOutput: child.finalOutput,
						returnedOutput: child.returnedOutput,
						contractMissingSections: [...child.contractMissingSections],
						metadata: {
							filesRead: [...child.metadata.filesRead],
							filesModified: [...child.metadata.filesModified],
							tools: child.metadata.tools.map((tool) => ({ name: tool.name, args: tool.args })),
							commands: child.metadata.commands.map((command) => ({ ...command })),
							usage: { ...child.metadata.usage },
							provider: child.metadata.provider,
							model: child.metadata.model,
							stopReason: child.metadata.stopReason,
							errorMessage: child.metadata.errorMessage,
						},
					};
				};

				const makeDetails = (endedAt: number, returnedOutput: string): DelegateDetails => {
					const aggregateStdoutEventCounts: Record<string, number> = {};
					const filesRead = new Set<string>();
					const filesModified = new Set<string>();
					const tools: Array<{ name: string; args: unknown }> = [];
					const commands: Array<{ command: string; exitCode?: number; isTest: boolean }> = [];
					const usage = {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						cost: 0,
						contextTokens: 0,
						turns: 0,
					};
					let stdoutBytes = 0;
					let stderr = "";
					let provider: string | undefined;
					let model: string | undefined;
					let stopReason: string | undefined;
					const errorMessages: string[] = [];

					for (const child of children) {
						stdoutBytes += child.trace.stdoutBytes;
						for (const [eventType, count] of Object.entries(child.trace.stdoutEventCounts)) {
							aggregateStdoutEventCounts[eventType] = (aggregateStdoutEventCounts[eventType] ?? 0) + count;
						}
						for (const filePath of child.metadata.filesRead) filesRead.add(filePath);
						for (const filePath of child.metadata.filesModified) filesModified.add(filePath);
						tools.push(...child.metadata.tools.map((tool) => ({ name: tool.name, args: tool.args })));
						commands.push(...child.metadata.commands.map((command) => ({ ...command })));
						usage.input += child.metadata.usage.input;
						usage.output += child.metadata.usage.output;
						usage.cacheRead += child.metadata.usage.cacheRead;
						usage.cacheWrite += child.metadata.usage.cacheWrite;
						usage.cost += child.metadata.usage.cost;
						usage.contextTokens += child.metadata.usage.contextTokens;
						usage.turns += child.metadata.usage.turns;
						if (child.stderr.trim()) stderr += `${stderr ? "\n\n" : ""}Task ${child.index + 1} stderr:\n${child.stderr.trim()}`;
						if (child.metadata.provider) provider = child.metadata.provider;
						if (child.metadata.model) model = child.metadata.model;
						if (child.metadata.stopReason && !stopReason) stopReason = child.metadata.stopReason;
						if (child.metadata.errorMessage) errorMessages.push(`Task ${child.index + 1}: ${child.metadata.errorMessage}`);
					}

					const aggregateExitCode = children.some((child) => child.exitCode === -1)
						? -1
						: children.some(childFailed)
							? 1
							: 0;
					const firstChild = children[0];

					return {
						tasks: [...tasks],
						children: children.map((child) => cloneChild(child, endedAt)),
						startedAt,
						endedAt,
						durationMs: Math.max(0, endedAt - startedAt),
						exitCode: aggregateExitCode,
						trace: {
							stdoutBytes,
							stdoutEventCounts: aggregateStdoutEventCounts,
						},
						stderr: children.length === 1 ? firstChild.stderr : stderr,
						finalOutput: children.length === 1 ? firstChild.finalOutput : returnedOutput,
						returnedOutput,
						contractMissingSections: CHILD_REQUIRED_SECTIONS.filter((section) =>
							children.some((child) => child.contractMissingSections.includes(section)),
						),
						metadata: {
							filesRead: [...filesRead],
							filesModified: [...filesModified],
							tools,
							commands,
							usage,
							provider,
							model,
							stopReason,
							errorMessage: errorMessages.join("\n") || undefined,
						},
					};
				};

				const emitAggregateUpdate = () => {
					try {
						const returnedOutput = buildAggregateReturnedOutput();
						onUpdate?.({
							content: [{ type: "text", text: returnedOutput }],
							details: makeDetails(Date.now(), returnedOutput),
						});
					} catch (error) {
						console.error("[narnia] delegate partial update failed", error);
					}
				};

				activeDelegateCalls += 1;
				updateStatus(ctx);

				try {
					const childTools = Array.from(
						new Set(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate")),
					);

					emitAggregateUpdate();

					const childPromises = children.map(
						(child) =>
							new Promise<void>((resolve) => {
								const commandIndexByToolCallId = new Map<string, number>();
								const fileToolByToolCallId = new Map<string, { name: string; path: string }>();
								const args = ["--mode", "json", "-p", "--no-session"];
								if (childTools.length > 0) args.push("--tools", childTools.join(","));
								else args.push("--no-tools");
								args.push("--append-system-prompt", CHILD_BOOTSTRAP);
								if (ctx.model) args.push("--model", `${ctx.model.provider}/${ctx.model.id}`);
								args.push("--thinking", pi.getThinkingLevel());
								args.push(ctx.isProjectTrusted() ? "--approve" : "--no-approve");
								args.push(`Task: ${child.task}`);

								const currentScript = process.argv[1];
								const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
								let command = "pi";
								let commandArgs = args;

								if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
									command = process.execPath;
									commandArgs = [currentScript, ...args];
								} else {
									const execName = path.basename(process.execPath).toLowerCase();
									if (!/^(node|bun)(\.exe)?$/.test(execName)) command = process.execPath;
								}

								let buffer = "";
								let closed = false;
								let settled = false;
								let failureRequested = false;
								let abortTimer: ReturnType<typeof setTimeout> | undefined;
								let abortListener: (() => void) | undefined;

								const cleanup = () => {
									if (abortTimer) clearTimeout(abortTimer);
									if (abortListener && signal) signal.removeEventListener("abort", abortListener);
								};

								const processLine = (line: string) => {
									if (!line.trim()) return;

									let event: unknown;
									try {
										event = JSON.parse(line);
									} catch {
										return;
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

									if (typedEvent.type === "message_end" && typedEvent.message?.role === "assistant") {
										let text = "";
										if (Array.isArray(typedEvent.message.content)) {
											for (const part of typedEvent.message.content) {
												if (
													part &&
													typeof part === "object" &&
													(part as { type?: unknown }).type === "text" &&
													typeof (part as { text?: unknown }).text === "string"
												) {
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
											if (typeof messageUsage.cacheRead === "number" && Number.isFinite(messageUsage.cacheRead)) {
												child.metadata.usage.cacheRead += messageUsage.cacheRead;
											}
											if (typeof messageUsage.cacheWrite === "number" && Number.isFinite(messageUsage.cacheWrite)) {
												child.metadata.usage.cacheWrite += messageUsage.cacheWrite;
											}
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

										emitAggregateUpdate();
									}

									if (typedEvent.type === "tool_execution_start" && typeof typedEvent.toolName === "string") {
										const args = typedEvent.args;
										child.metadata.tools.push({ name: typedEvent.toolName, args });

										if (args && typeof args === "object") {
											const objectArgs = args as { path?: unknown; file_path?: unknown; command?: unknown };
											const filePath =
												typeof objectArgs.path === "string"
													? objectArgs.path
													: typeof objectArgs.file_path === "string"
														? objectArgs.file_path
														: undefined;

											if (
												(typedEvent.toolName === "read" || typedEvent.toolName === "edit" || typedEvent.toolName === "write") &&
												filePath &&
												typeof typedEvent.toolCallId === "string"
											) {
												fileToolByToolCallId.set(typedEvent.toolCallId, { name: typedEvent.toolName, path: filePath });
											}

											if (typedEvent.toolName === "bash" && typeof objectArgs.command === "string") {
												const command = objectArgs.command;
												const commandIndex = child.metadata.commands.length;
												child.metadata.commands.push({
													command,
													isTest:
														/(^|[;&|\n]\s*)(npm|pnpm|yarn|bun)\s+(test|run\s+[^;&|\n]*test|exec\s+(vitest|jest|mocha)|vitest|jest|mocha)\b/i.test(
															command,
														) ||
														/(^|[;&|\n]\s*)((python\s+-m\s+)?pytest|go\s+test|cargo\s+test|swift\s+test|deno\s+test|zig\s+test|dotnet\s+test|mvn\s+test|gradle\s+test|ctest|rspec|make\s+test)\b/i.test(
															command,
														),
												});
												if (typeof typedEvent.toolCallId === "string") commandIndexByToolCallId.set(typedEvent.toolCallId, commandIndex);
											}
										}
									}

									if (typedEvent.type === "tool_execution_start") {
										const toolName = typeof typedEvent.toolName === "string" ? typedEvent.toolName : "tool";
										child.returnedOutput = `Delegate child running: ${toolName}`;
										emitAggregateUpdate();
									}

									if (typedEvent.type === "tool_execution_end" && typeof typedEvent.toolCallId === "string" && typedEvent.isError === false) {
										const fileTool = fileToolByToolCallId.get(typedEvent.toolCallId);
										if (fileTool && fileTool.name === "read" && !child.metadata.filesRead.includes(fileTool.path)) child.metadata.filesRead.push(fileTool.path);
										if (fileTool && (fileTool.name === "edit" || fileTool.name === "write") && !child.metadata.filesModified.includes(fileTool.path)) {
											child.metadata.filesModified.push(fileTool.path);
										}
									}

									if (
										typedEvent.type === "tool_execution_end" &&
										typedEvent.toolName === "bash" &&
										typeof typedEvent.toolCallId === "string"
									) {
										const commandIndex = commandIndexByToolCallId.get(typedEvent.toolCallId);
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
														if (
															part &&
															typeof part === "object" &&
															(part as { type?: unknown }).type === "text" &&
															typeof (part as { text?: unknown }).text === "string"
														) {
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
											if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "assistant") {
												continue;
											}

											let text = "";
											const content = (message as { content?: unknown }).content;
											if (Array.isArray(content)) {
												for (const part of content) {
													if (
														part &&
														typeof part === "object" &&
														(part as { type?: unknown }).type === "text" &&
														typeof (part as { text?: unknown }).text === "string"
													) {
														text += (part as { text: string }).text;
													}
												}
											}
											if (text) {
												child.finalOutput = text;
												child.returnedOutput = text;
												updateChildContract(child);
											}
											if (typeof (message as { provider?: unknown }).provider === "string") {
												child.metadata.provider = (message as { provider: string }).provider;
											}
											if (typeof (message as { model?: unknown }).model === "string") child.metadata.model = (message as { model: string }).model;
											if (typeof (message as { stopReason?: unknown }).stopReason === "string") {
												child.metadata.stopReason = (message as { stopReason: string }).stopReason;
											}
											if (typeof (message as { errorMessage?: unknown }).errorMessage === "string") {
												child.metadata.errorMessage = (message as { errorMessage: string }).errorMessage;
											}
										}
									}
								};

								const appendChildError = (error: unknown) => {
									const message = error instanceof Error ? error.message : String(error);
									child.metadata.errorMessage = child.metadata.errorMessage ? `${child.metadata.errorMessage}\n${message}` : message;
								};

								const finishChild = (exitCode: number) => {
									if (settled) return;
									settled = true;
									cleanup();
									if (buffer.trim()) {
										try {
											processLine(buffer);
										} catch (error) {
											appendChildError(error);
											exitCode = 1;
										}
									}
									child.exitCode = exitCode;
									child.status = childFailed(child) ? "failed" : "completed";
									child.endedAt = Date.now();
									child.durationMs = Math.max(0, child.endedAt - child.startedAt);
									child.returnedOutput = buildChildReturnedOutput(child);
									updateChildContract(child);
									emitAggregateUpdate();
									resolve();
								};

								let proc;
								try {
									proc = spawn(command, commandArgs, {
										cwd: ctx.cwd,
										env: { ...process.env, PI_NARNIA_CHILD: "1" },
										shell: false,
										stdio: ["ignore", "pipe", "pipe"],
									});
								} catch (error) {
									appendChildError(error);
									finishChild(1);
									return;
								}

								const requestFailure = (error: unknown, waitForClose: boolean) => {
									if (settled || failureRequested) return;
									failureRequested = true;
									appendChildError(error);
									child.status = "failed";
									child.returnedOutput = buildChildReturnedOutput(child);
									emitAggregateUpdate();

									if (!waitForClose || closed) {
										finishChild(1);
										return;
									}

									try {
										proc.kill("SIGTERM");
										abortTimer = setTimeout(() => {
											try {
												if (!closed && !settled) proc.kill("SIGKILL");
											} catch (killError) {
												appendChildError(killError);
												finishChild(1);
											}
										}, 5000);
									} catch (killError) {
										appendChildError(killError);
										finishChild(1);
									}
								};

								proc.stdout.on("data", (data) => {
									if (failureRequested) return;
									try {
										buffer += data.toString();
										const lines = buffer.split("\n");
										buffer = lines.pop() || "";
										for (const line of lines) processLine(line);
									} catch (error) {
										requestFailure(error, true);
									}
								});
								proc.stdout.on("error", (error) => requestFailure(error, true));

								proc.stderr.on("data", (data) => {
									try {
										child.stderr += data.toString();
									} catch (error) {
										requestFailure(error, true);
									}
								});
								proc.stderr.on("error", (error) => requestFailure(error, true));

								proc.on("error", (error) => requestFailure(error, false));
								proc.on("close", (code, exitSignal) => {
									closed = true;
									if (code !== null) finishChild(code);
									else if (exitSignal === "SIGKILL") finishChild(137);
									else if (exitSignal === "SIGTERM") finishChild(143);
									else finishChild(1);
								});

								abortListener = () => {
									try {
										if (closed || settled) return;
										proc.kill("SIGTERM");
										abortTimer = setTimeout(() => {
											try {
												if (!closed && !settled) proc.kill("SIGKILL");
											} catch (error) {
												requestFailure(error, false);
											}
										}, 5000);
									} catch (error) {
										requestFailure(error, false);
									}
								};

								if (signal?.aborted) abortListener();
								else if (signal) signal.addEventListener("abort", abortListener, { once: true });
							}).catch((error) => {
								if (child.status !== "running") return;
								child.metadata.errorMessage = error instanceof Error ? error.message : String(error);
								child.exitCode = 1;
								child.status = "failed";
								child.endedAt = Date.now();
								child.durationMs = Math.max(0, child.endedAt - child.startedAt);
								child.returnedOutput = buildChildReturnedOutput(child);
								updateChildContract(child);
								emitAggregateUpdate();
							}),
					);

					await Promise.allSettled(childPromises);

					const returnedOutput = buildAggregateReturnedOutput();
					const endedAt = Date.now();

					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeDetails(endedAt, returnedOutput),
					};
				} finally {
					activeDelegateCalls = Math.max(0, activeDelegateCalls - 1);
					updateStatus(ctx);
				}

			},

			renderCall(args, theme, context) {
				const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
				const argsObject = args && typeof args === "object" ? (args as { tasks?: unknown }) : {};
				const rawTasks = Array.isArray(argsObject.tasks) ? argsObject.tasks : [];
				const summary = rawTasks.length === 1 ? "1 task" : rawTasks.length > 1 ? `${rawTasks.length} tasks` : "tasks missing";
				let rendered = `${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg("dim", summary)}`;

				for (let index = 0; index < rawTasks.length; index++) {
					const task = typeof rawTasks[index] === "string" ? rawTasks[index].trim().replace(/\s+/g, " ") : "";
					const preview = task.length > 100 ? `${task.slice(0, 97)}...` : task || "...";
					rendered += `\n  ${theme.fg("dim", `delegate ${index + 1} ${preview}`)}`;
				}

				text.setText(rendered);
				return text;
			},

			renderResult(result, { expanded, isPartial }, theme, context) {
				const details = result.details as Partial<DelegateDetails> | undefined;
				const content = result.content.find((part) => part.type === "text");
				const contentText = content?.type === "text" ? content.text : "";
				const argsObject = context.args && typeof context.args === "object" ? (context.args as { tasks?: unknown }) : {};
				const argsTasks = Array.isArray(argsObject.tasks) ? argsObject.tasks.filter((task): task is string => typeof task === "string") : [];
				const detailTasks = Array.isArray(details?.tasks) ? details.tasks : [];
				const detailChildren: Partial<DelegateChildDetails>[] = Array.isArray(details?.children)
					? (details.children as Partial<DelegateChildDetails>[]).filter((child) => !!child && typeof child === "object")
					: [];
				const childrenByIndex = new Map<number, Partial<DelegateChildDetails>>();
				let maxChildIndex = -1;

				for (let position = 0; position < detailChildren.length; position++) {
					const child = detailChildren[position];
					const childIndex = typeof child.index === "number" && Number.isInteger(child.index) && child.index >= 0 ? child.index : position;
					childrenByIndex.set(childIndex, child);
					if (childIndex > maxChildIndex) maxChildIndex = childIndex;
				}

				const totalTasks = Math.max(detailTasks.length, argsTasks.length, maxChildIndex + 1, detailChildren.length);
				const rows = Array.from({ length: totalTasks }, (_, index) => {
					const child = childrenByIndex.get(index) ?? detailChildren[index];
					const task = typeof child?.task === "string" && child.task.trim() ? child.task : detailTasks[index] || argsTasks[index] || "";
					const normalizedTask = task.trim().replace(/\s+/g, " ");
					const taskPreview = normalizedTask.length > 100 ? `${normalizedTask.slice(0, 97)}...` : normalizedTask || "...";
					const metadata = child?.metadata;
					const filesRead = Array.isArray(metadata?.filesRead) ? metadata.filesRead : [];
					const filesModified = Array.isArray(metadata?.filesModified) ? metadata.filesModified : [];
					const tools = Array.isArray(metadata?.tools) ? metadata.tools : [];
					const commands = Array.isArray(metadata?.commands) ? metadata.commands : [];
					const usage = metadata?.usage;
					const exitCode = typeof child?.exitCode === "number" ? child.exitCode : undefined;
					const stopReason = typeof metadata?.stopReason === "string" ? metadata.stopReason : undefined;
					const childStatus =
						child?.status === "running" || child?.status === "completed" || child?.status === "failed" ? child.status : undefined;
					const inferredRunning = child ? exitCode === -1 || (isPartial && exitCode === undefined) : isPartial;
					const inferredFailed =
						(exitCode !== undefined && exitCode !== 0 && exitCode !== -1) || stopReason === "error" || stopReason === "aborted";
					const running = childStatus ? childStatus === "running" : inferredRunning;
					const failed = childStatus ? childStatus === "failed" : context.isError || inferredFailed;
					const fullOutput =
						(typeof child?.finalOutput === "string" && child.finalOutput) ||
						(typeof child?.returnedOutput === "string" && child.returnedOutput) ||
						"";
					const outputLines = fullOutput.split(/\r?\n/);
					const resultStart = outputLines.findIndex((line) => line.trim() === "## Result");
					let resultExcerpt = "";

					if (resultStart >= 0) {
						const excerptLines: string[] = [];
						for (const line of outputLines.slice(resultStart + 1)) {
							if (/^##\s+/.test(line.trim())) break;
							if (line.trim() || excerptLines.length > 0) excerptLines.push(line);
						}
						resultExcerpt = excerptLines.join("\n").trim();
					}

					if (!resultExcerpt) resultExcerpt = outputLines.map((line) => line.trim()).find(Boolean) || (running ? "Delegate child running..." : "(no output)");
					if (resultExcerpt.length > 320) resultExcerpt = `${resultExcerpt.slice(0, 317).trimEnd()}...`;
					const excerptLines = resultExcerpt.split(/\r?\n/);
					if (excerptLines.length > 4) resultExcerpt = `${excerptLines.slice(0, 4).join("\n").trimEnd()}...`;

					const usageParts: string[] = [];
					if (usage?.turns) usageParts.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
					if (usage?.input) usageParts.push(`↑${formatTokens(usage.input)}`);
					if (usage?.output) usageParts.push(`↓${formatTokens(usage.output)}`);
					if (usage?.cacheRead) usageParts.push(`R${formatTokens(usage.cacheRead)}`);
					if (usage?.cacheWrite) usageParts.push(`W${formatTokens(usage.cacheWrite)}`);
					if (usage?.cost) usageParts.push(`$${usage.cost.toFixed(4)}`);
					if (usage?.contextTokens) usageParts.push(`ctx:${formatTokens(usage.contextTokens)}`);
					const usageText = usageParts.join(" ");
					const stats = [
						usageText,
						`${filesRead.length} read`,
						`${filesModified.length} changed`,
						`${commands.length} cmd${commands.length === 1 ? "" : "s"}`,
					].filter(Boolean);
					const duration = typeof child?.durationMs === "number" && child.durationMs >= 0 ? `${(child.durationMs / 1000).toFixed(1)}s` : undefined;

					return {
						index,
						child,
						task,
						taskPreview,
						metadata,
						filesRead,
						filesModified,
						tools,
						commands,
						usageText,
						exitCode,
						stopReason,
						running,
						failed,
						status: childStatus ?? (running ? "running" : failed ? "failed" : "completed"),
						fullOutput,
						resultExcerpt,
						stats,
						duration,
					};
				});
				const aggregateExitCode = typeof details?.exitCode === "number" ? details.exitCode : undefined;
				const running = isPartial || aggregateExitCode === -1 || rows.some((row) => row.running);
				const failed =
					context.isError ||
					(aggregateExitCode !== undefined && aggregateExitCode !== 0 && aggregateExitCode !== -1) ||
					rows.some((row) => row.failed);
				const succeededTasks = rows.filter((row) => !row.running && !row.failed).length;
				const parentSummary = totalTasks > 0 ? `${succeededTasks}/${totalTasks} tasks succeeded` : failed ? "rejected" : "no tasks";
				const icon = running ? theme.fg("warning", "⏳") : failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const status = running ? "running" : failed ? "failed" : "done";
				const statusColor = running ? "warning" : failed ? "error" : "success";

				if (!expanded) {
					let text = `${icon} ${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg(statusColor, status)} ${theme.fg("dim", parentSummary)}`;

					for (const row of rows) {
						const childIcon = row.running ? theme.fg("warning", "⏳") : row.failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
						const childColor = row.running ? "warning" : row.failed ? "error" : "success";
						text += `\n  ${childIcon} ${theme.fg("toolTitle", `delegate ${row.index + 1}`)} ${theme.fg(childColor, row.status)} ${theme.fg("dim", row.taskPreview)}`;
						if (row.resultExcerpt) text += `\n    ${theme.fg("toolOutput", row.resultExcerpt)}`;
						if (row.stats.length > 0) text += `\n    ${theme.fg("dim", row.stats.join(" · "))}`;
					}

					if (rows.length === 0 && contentText.trim()) text += `\n${theme.fg("toolOutput", contentText.trim())}`;
					return new Text(text, 0, 0);
				}

				const container = new Container();
				container.addChild(
					new Text(
						`${icon} ${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg(statusColor, status)} ${theme.fg("dim", parentSummary)}`,
						0,
						0,
					),
				);
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "─── Children ───"), 0, 0));

				if (rows.length === 0) {
					container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
				} else {
					for (const row of rows) {
						const childIcon = row.running ? theme.fg("warning", "⏳") : row.failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
						const childColor = row.running ? "warning" : row.failed ? "error" : "success";
						container.addChild(
							new Text(
								`  ${childIcon} ${theme.fg("toolTitle", `delegate ${row.index + 1}`)} ${theme.fg(childColor, row.status)} ${theme.fg("dim", row.taskPreview)}`,
								0,
								0,
							),
						);
					}
				}

				if (rows.length === 0) {
					if (contentText.trim()) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("muted", "─── Result ───"), 0, 0));
						container.addChild(new Text(theme.fg("toolOutput", contentText.trim()), 0, 0));
					}
					return container;
				}

				for (const row of rows) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", `─── Task ${row.index + 1} ───`), 0, 0));
					container.addChild(new Text(theme.fg("dim", row.task || "(missing task)"), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Final Output ───"), 0, 0));
					if (row.fullOutput.trim()) container.addChild(new Markdown(row.fullOutput.trim(), 0, 0, getMarkdownTheme()));
					else container.addChild(new Text(theme.fg("muted", row.running ? "(no final output yet)" : "(no output)"), 0, 0));

					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Tool Timeline ───"), 0, 0));
					if (row.tools.length === 0) {
						container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
					} else {
						let commandIndex = 0;
						for (let index = 0; index < row.tools.length; index++) {
							const tool = row.tools[index];
							const args = tool.args && typeof tool.args === "object" ? (tool.args as Record<string, unknown>) : undefined;
							let line = `${index + 1}. ${tool.name}`;
							if (tool.name === "bash") {
								const command = typeof args?.command === "string" ? args.command.replace(/\s+/g, " ").trim() : "";
								const preview = command.length > 140 ? `${command.slice(0, 137)}...` : command || "...";
								const commandMeta = row.commands[commandIndex++];
								line = `${index + 1}. $ ${preview}`;
								if (commandMeta?.exitCode !== undefined) line += ` [exit ${commandMeta.exitCode}]`;
								if (commandMeta?.isTest) line += " [test]";
							} else if (tool.name === "read" || tool.name === "edit" || tool.name === "write" || tool.name === "ls") {
								const filePath = typeof args?.path === "string" ? args.path : typeof args?.file_path === "string" ? args.file_path : "";
								line = `${index + 1}. ${tool.name}${filePath ? ` ${filePath}` : ""}`;
							} else {
								let preview = args ? JSON.stringify(args) : "";
								if (preview.length > 140) preview = `${preview.slice(0, 137)}...`;
								line = `${index + 1}. ${tool.name}${preview ? ` ${preview}` : ""}`;
							}
							container.addChild(new Text(theme.fg("toolOutput", line), 0, 0));
						}
					}

					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Files ───"), 0, 0));
					if (row.filesRead.length === 0 && row.filesModified.length === 0) {
						container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
					} else {
						if (row.filesRead.length > 0) container.addChild(new Text(theme.fg("dim", `Read: ${row.filesRead.join(", ")}`), 0, 0));
						if (row.filesModified.length > 0) container.addChild(new Text(theme.fg("dim", `Modified: ${row.filesModified.join(", ")}`), 0, 0));
					}

					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Commands ───"), 0, 0));
					if (row.commands.length === 0) {
						container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
					} else {
						for (let index = 0; index < row.commands.length; index++) {
							const command = row.commands[index];
							let commandText = command.command.replace(/\s+/g, " ").trim();
							if (commandText.length > 220) commandText = `${commandText.slice(0, 217)}...`;
							let line = `${index + 1}. $ ${commandText || "..."}`;
							if (command.exitCode !== undefined) line += ` [exit ${command.exitCode}]`;
							if (command.isTest) line += " [test]";
							container.addChild(new Text(theme.fg("toolOutput", line), 0, 0));
						}
					}

					const metadataLines = [
						`Exit: ${row.exitCode ?? "unknown"}${row.duration ? ` · Duration: ${row.duration}` : ""}`,
						`Usage: ${row.usageText || "none"}`,
						`Files read: ${row.filesRead.length}`,
						`Files modified: ${row.filesModified.length}`,
						`Commands: ${row.commands.length} (${row.commands.filter((command) => command.isTest).length} tests)`,
					];
					if (row.metadata?.provider || row.metadata?.model) metadataLines.push(`Model: ${[row.metadata.provider, row.metadata.model].filter(Boolean).join("/")}`);
					if (row.stopReason) metadataLines.push(`Stop: ${row.stopReason}`);
					if (row.metadata?.errorMessage) metadataLines.push(`Error: ${row.metadata.errorMessage}`);
					if (Array.isArray(row.child?.contractMissingSections) && row.child.contractMissingSections.length > 0) {
						metadataLines.push(`Missing sections: ${row.child.contractMissingSections.join(", ")}`);
					}
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Metadata ───"), 0, 0));
					container.addChild(new Text(metadataLines.map((line) => theme.fg("dim", line)).join("\n"), 0, 0));

					if (typeof row.child?.stderr === "string" && row.child.stderr.trim()) {
						let stderrText = row.child.stderr.trim();
						if (stderrText.length > 4000) stderrText = `${stderrText.slice(0, 4000).trimEnd()}\n... [stderr truncated in view; full stderr preserved in details]`;
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("muted", "─── stderr ───"), 0, 0));
						container.addChild(new Text(theme.fg("toolOutput", stderrText), 0, 0));
					}
				}

				return container;
			},

		});
	}

	function setAllConfiguredExceptDelegate(): void {
		pi.setActiveTools(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate"));
	}

	function restoreFromBranch(ctx: ExtensionContext): void {
		let savedState: NarniaState | undefined;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === CUSTOM_TYPE && isNarniaState(entry.data)) {
				savedState = entry.data;
			}
		}

		state = savedState;

		if (state?.enabled) {
			ensureDelegateRegistered();
			pi.setActiveTools(["delegate"]);
		} else if (state) {
			ensureDelegateRegistered();
			setAllConfiguredExceptDelegate();
		}

		updateStatus(ctx);
	}

	function handleSessionEvent(label: string) {
		return (_event: unknown, ctx: ExtensionContext) => {
			try {
				restoreFromBranch(ctx);
			} catch (error) {
				console.error(`[narnia] ${label}`, error);
			}
		};
	}

	pi.registerCommand("narnia", {
		description: "Enable/disable Narnia delegate-only root mode",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();

			if (!command) {
				updateStatus(ctx);
				ctx.ui.notify(`Narnia: ${state?.enabled ? "on" : "off"}\nUsage: /narnia on | /narnia off`, "info");
				return;
			}

			if (command === "on") {
				ensureDelegateRegistered();
				state = { enabled: true };
				pi.appendEntry<NarniaState>(CUSTOM_TYPE, state);
				pi.setActiveTools(["delegate"]);
				updateStatus(ctx);
				ctx.ui.notify("Narnia enabled. Root tools restricted to delegate; paste/! output can still pollute root context.", "warning");
				return;
			}

			if (command === "off") {
				ensureDelegateRegistered();
				state = { enabled: false };
				pi.appendEntry<NarniaState>(CUSTOM_TYPE, state);
				setAllConfiguredExceptDelegate();
				updateStatus(ctx);
				ctx.ui.notify("Narnia disabled.", "info");
				return;
			}

			ctx.ui.notify("Usage: /narnia on | /narnia off", "warning");
		},
	});

	pi.on("session_start", handleSessionEvent("failed during session_start"));
	pi.on("session_tree", handleSessionEvent("failed during session_tree"));

	pi.on("before_agent_start", (event, ctx) => {
		updateStatus(ctx);
		if (!state?.enabled) return undefined;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${NARNIA_ROOT_PROMPT}`,
		};
	});

	pi.on("tool_call", (event) => {
		if (!state?.enabled || event.toolName === "delegate") return undefined;
		return { block: true, reason: BLOCK_REASON };
	});

	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus(CUSTOM_TYPE, undefined);
		state = undefined;
	});
}

export default narniaExtension;
