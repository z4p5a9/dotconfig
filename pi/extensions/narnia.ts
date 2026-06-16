import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getMarkdownTheme, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type NarniaState = {
	enabled: boolean;
};

type DelegateDetails = {
	task: string;
	startedAt: number;
	endedAt: number;
	durationMs: number;
	exitCode: number;
	stdoutEvents: unknown[];
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

const CUSTOM_TYPE = "narnia";
const BLOCK_REASON = "Narnia Mode: root session cannot call tools directly. Use delegate with a bounded task.";
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
	let delegateRunning = false;

	function updateStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		const usage = ctx.getContextUsage();
		const tokens = usage?.tokens === null || usage?.tokens === undefined ? "" : ` · ctx ${formatTokens(usage.tokens)}`;
		const status = delegateRunning ? "child running" : state?.enabled ? "on" : "off";
		ctx.ui.setStatus(CUSTOM_TYPE, ctx.ui.theme.fg(delegateRunning ? "warning" : "dim", `Narnia: ${status}${tokens}`));
	}

	function ensureDelegateRegistered(): void {
		if (delegateRegistered) return;
		delegateRegistered = true;

		pi.registerTool({
			name: "delegate",
			label: "Delegate",
			description: "Delegate a bounded task to an isolated child Pi process.",
			promptSnippet: "Run bounded file, shell, web, edit, and test work outside the root session.",
			promptGuidelines: [
				"Use delegate for bounded file, shell, web, edit, and test work while Narnia mode is enabled.",
				"Do not ask delegate to recursively delegate.",
			],
			parameters: Type.Object({
				task: Type.String({ description: "Bounded task for the child Pi process." }),
			}),
			async execute(
				_toolCallId,
				params,
				signal,
				onUpdate,
				ctx,
			): Promise<{ content: [{ type: "text"; text: string }]; details: DelegateDetails }> {
				const startedAt = Date.now();
				const task = params.task.trim();
				const stdoutEvents: unknown[] = [];
				let stderr = "";
				let finalOutput = "";
				const filesRead: string[] = [];
				const filesModified: string[] = [];
				const tools: Array<{ name: string; args: unknown }> = [];
				const commands: Array<{ command: string; exitCode?: number; isTest: boolean }> = [];
				const commandIndexByToolCallId = new Map<string, number>();
				const fileToolByToolCallId = new Map<string, { name: string; path: string }>();
				const usage = {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					cost: 0,
					contextTokens: 0,
					turns: 0,
				};
				let provider: string | undefined;
				let model: string | undefined;
				let stopReason: string | undefined;
				let errorMessage: string | undefined;

				const makeDetails = (
					endedAt: number,
					exitCode: number,
					currentFinalOutput: string,
					returnedOutput: string,
				): DelegateDetails => ({
					task,
					startedAt,
					endedAt,
					durationMs: endedAt - startedAt,
					exitCode,
					stdoutEvents,
					stderr,
					finalOutput: currentFinalOutput,
					returnedOutput,
					contractMissingSections: (() => {
						const lines = currentFinalOutput.split(/\r?\n/).map((line) => line.trim());
						return CHILD_REQUIRED_SECTIONS.filter((section) => !lines.includes(section));
					})(),
					metadata: {
						filesRead: [...filesRead],
						filesModified: [...filesModified],
						tools: tools.map((tool) => ({ name: tool.name, args: tool.args })),
						commands: commands.map((command) => ({ ...command })),
						usage: { ...usage },
						provider,
						model,
						stopReason,
						errorMessage,
					},
				});

				if (!task) {
					const returnedOutput = "Delegate task is empty.";
					const endedAt = Date.now();
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeDetails(endedAt, 1, returnedOutput, returnedOutput),
					};
				}

				if (delegateRunning) {
					const returnedOutput = "Delegate already has a child running.";
					const endedAt = Date.now();
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeDetails(endedAt, 1, returnedOutput, returnedOutput),
					};
				}

				delegateRunning = true;
				updateStatus(ctx);

				try {
					const childTools = Array.from(
						new Set(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate")),
					);
					const args = ["--mode", "json", "-p", "--no-session"];
					if (childTools.length > 0) args.push("--tools", childTools.join(","));
					else args.push("--no-tools");
					args.push("--append-system-prompt", CHILD_BOOTSTRAP);
					if (ctx.model) args.push("--model", `${ctx.model.provider}/${ctx.model.id}`);
					args.push("--thinking", pi.getThinkingLevel());
					args.push(ctx.isProjectTrusted() ? "--approve" : "--no-approve");
					args.push(`Task: ${task}`);

					onUpdate?.({
						content: [{ type: "text", text: "Delegate child running..." }],
						details: makeDetails(Date.now(), -1, "", "Delegate child running..."),
					});

					const exitCode = await new Promise<number>((resolve, reject) => {
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

						const proc = spawn(command, commandArgs, {
							cwd: ctx.cwd,
							env: { ...process.env, PI_NARNIA_CHILD: "1" },
							shell: false,
							stdio: ["ignore", "pipe", "pipe"],
						});
						let buffer = "";
						let closed = false;
						let abortTimer: ReturnType<typeof setTimeout> | undefined;
						let abortListener: (() => void) | undefined;

						const cleanup = () => {
							if (abortTimer) clearTimeout(abortTimer);
							if (abortListener && signal) signal.removeEventListener("abort", abortListener);
						};

						const fail = (error: unknown) => {
							cleanup();
							reject(error);
						};

						const processLine = (line: string) => {
							if (!line.trim()) return;

							let event: unknown;
							try {
								event = JSON.parse(line);
							} catch {
								return;
							}

							stdoutEvents.push(event);
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
								if (text) finalOutput = text;

								usage.turns += 1;
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
									if (typeof messageUsage.input === "number" && Number.isFinite(messageUsage.input)) usage.input += messageUsage.input;
									if (typeof messageUsage.output === "number" && Number.isFinite(messageUsage.output)) usage.output += messageUsage.output;
									if (typeof messageUsage.cacheRead === "number" && Number.isFinite(messageUsage.cacheRead)) {
										usage.cacheRead += messageUsage.cacheRead;
									}
									if (typeof messageUsage.cacheWrite === "number" && Number.isFinite(messageUsage.cacheWrite)) {
										usage.cacheWrite += messageUsage.cacheWrite;
									}
									if (messageUsage.cost && typeof messageUsage.cost === "object") {
										const cost = messageUsage.cost as { total?: unknown };
										if (typeof cost.total === "number" && Number.isFinite(cost.total)) usage.cost += cost.total;
									} else if (typeof messageUsage.cost === "number" && Number.isFinite(messageUsage.cost)) usage.cost += messageUsage.cost;
									if (typeof messageUsage.totalTokens === "number" && Number.isFinite(messageUsage.totalTokens)) {
										usage.contextTokens = messageUsage.totalTokens;
									} else if (typeof messageUsage.contextTokens === "number" && Number.isFinite(messageUsage.contextTokens)) {
										usage.contextTokens = messageUsage.contextTokens;
									}
								}

								if (typeof typedEvent.message.provider === "string") provider = typedEvent.message.provider;
								if (typeof typedEvent.message.model === "string") model = typedEvent.message.model;
								if (typeof typedEvent.message.stopReason === "string") stopReason = typedEvent.message.stopReason;
								if (typeof typedEvent.message.errorMessage === "string") errorMessage = typedEvent.message.errorMessage;

								onUpdate?.({
									content: [{ type: "text", text: finalOutput || "Delegate child running..." }],
									details: makeDetails(Date.now(), -1, finalOutput, finalOutput || "Delegate child running..."),
								});
							}

							if (typedEvent.type === "tool_execution_start" && typeof typedEvent.toolName === "string") {
								const args = typedEvent.args;
								tools.push({ name: typedEvent.toolName, args });

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
										const commandIndex = commands.length;
										commands.push({
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
								onUpdate?.({
									content: [{ type: "text", text: `Delegate child running: ${toolName}` }],
									details: makeDetails(Date.now(), -1, finalOutput, `Delegate child running: ${toolName}`),
								});
							}

							if (typedEvent.type === "tool_execution_end" && typeof typedEvent.toolCallId === "string" && typedEvent.isError === false) {
								const fileTool = fileToolByToolCallId.get(typedEvent.toolCallId);
								if (fileTool && fileTool.name === "read" && !filesRead.includes(fileTool.path)) filesRead.push(fileTool.path);
								if (fileTool && (fileTool.name === "edit" || fileTool.name === "write") && !filesModified.includes(fileTool.path)) {
									filesModified.push(fileTool.path);
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
									if (exitCode !== undefined) commands[commandIndex] = { ...commands[commandIndex], exitCode };
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
									if (text) finalOutput = text;
									if (typeof (message as { provider?: unknown }).provider === "string") {
										provider = (message as { provider: string }).provider;
									}
									if (typeof (message as { model?: unknown }).model === "string") model = (message as { model: string }).model;
									if (typeof (message as { stopReason?: unknown }).stopReason === "string") {
										stopReason = (message as { stopReason: string }).stopReason;
									}
									if (typeof (message as { errorMessage?: unknown }).errorMessage === "string") {
										errorMessage = (message as { errorMessage: string }).errorMessage;
									}
								}
							}
						};

						proc.stdout.on("data", (data) => {
							buffer += data.toString();
							const lines = buffer.split("\n");
							buffer = lines.pop() || "";
							for (const line of lines) processLine(line);
						});
						proc.stdout.on("error", fail);

						proc.stderr.on("data", (data) => {
							stderr += data.toString();
						});
						proc.stderr.on("error", fail);

						proc.on("error", fail);
						proc.on("close", (code, exitSignal) => {
							closed = true;
							cleanup();
							if (buffer.trim()) processLine(buffer);
							if (code !== null) resolve(code);
							else if (exitSignal === "SIGKILL") resolve(137);
							else if (exitSignal === "SIGTERM") resolve(143);
							else resolve(1);
						});

						abortListener = () => {
							try {
								if (closed) return;
								proc.kill("SIGTERM");
								abortTimer = setTimeout(() => {
									try {
										if (!closed) proc.kill("SIGKILL");
									} catch (error) {
										fail(error);
									}
								}, 5000);
							} catch (error) {
								fail(error);
							}
						};

						if (signal?.aborted) abortListener();
						else if (signal) signal.addEventListener("abort", abortListener, { once: true });
					});

					const failed = exitCode !== 0 || stopReason === "error" || stopReason === "aborted";
					const output = finalOutput || errorMessage || stderr.trim() || "(no output)";
					let returnedOutput = failed
						? `Delegate failed${stopReason ? ` (${stopReason})` : ""}${exitCode !== 0 ? ` [exit ${exitCode}]` : ""}.\n\n${output}`
						: output;

					if (Buffer.byteLength(returnedOutput, "utf8") > RETURNED_OUTPUT_CAP_BYTES) {
						const truncationNotice = "\n\n[Delegate output truncated to 12KB. Full output preserved in tool details.]";
						let cappedOutput = returnedOutput.slice(
							0,
							RETURNED_OUTPUT_CAP_BYTES - Buffer.byteLength(truncationNotice, "utf8"),
						);
						while (Buffer.byteLength(`${cappedOutput}${truncationNotice}`, "utf8") > RETURNED_OUTPUT_CAP_BYTES) {
							cappedOutput = cappedOutput.slice(0, -1);
						}
						returnedOutput = `${cappedOutput.trimEnd()}${truncationNotice}`;
					}

					const endedAt = Date.now();

					return {
						content: [{ type: "text", text: returnedOutput }],
						details: makeDetails(endedAt, exitCode, finalOutput, returnedOutput),
					};
				} finally {
					delegateRunning = false;
					updateStatus(ctx);
				}
			},

			renderCall(args, theme, context) {
				const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
				const task = typeof args.task === "string" ? args.task.trim().replace(/\s+/g, " ") : "";
				const preview = task.length > 100 ? `${task.slice(0, 97)}...` : task || "...";
				text.setText(`${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg("dim", preview)}`);
				return text;
			},

			renderResult(result, { expanded, isPartial }, theme, context) {
				const details = result.details as Partial<DelegateDetails> | undefined;
				const content = result.content.find((part) => part.type === "text");
				const contentText = content?.type === "text" ? content.text : "";
				const task =
					typeof details?.task === "string" && details.task.trim()
						? details.task
						: typeof context.args.task === "string"
							? context.args.task
							: "";
				const normalizedTask = task.trim().replace(/\s+/g, " ");
				const taskPreview = normalizedTask.length > 100 ? `${normalizedTask.slice(0, 97)}...` : normalizedTask || "...";
				const metadata = details?.metadata;
				const filesRead = Array.isArray(metadata?.filesRead) ? metadata.filesRead : [];
				const filesModified = Array.isArray(metadata?.filesModified) ? metadata.filesModified : [];
				const tools = Array.isArray(metadata?.tools) ? metadata.tools : [];
				const commands = Array.isArray(metadata?.commands) ? metadata.commands : [];
				const usage = metadata?.usage;
				const exitCode = typeof details?.exitCode === "number" ? details.exitCode : undefined;
				const stopReason = typeof metadata?.stopReason === "string" ? metadata.stopReason : undefined;
				const failed = context.isError || (exitCode !== undefined && exitCode !== 0 && exitCode !== -1) || stopReason === "error" || stopReason === "aborted";
				const running = isPartial || exitCode === -1;
				const fullOutput =
					(typeof details?.finalOutput === "string" && details.finalOutput) ||
					(typeof details?.returnedOutput === "string" && details.returnedOutput) ||
					contentText;
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
				if (!resultExcerpt) resultExcerpt = outputLines.map((line) => line.trim()).find(Boolean) || contentText.trim() || "(no result yet)";
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
				const icon = running ? theme.fg("warning", "⏳") : failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const status = running ? "running" : failed ? "failed" : "done";
				const duration = typeof details?.durationMs === "number" && details.durationMs >= 0 ? `${(details.durationMs / 1000).toFixed(1)}s` : undefined;

				if (!expanded) {
					const stats = [
						usageText,
						`${filesRead.length} read`,
						`${filesModified.length} changed`,
						`${commands.length} cmd${commands.length === 1 ? "" : "s"}`,
					].filter(Boolean);
					let text = `${icon} ${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg(failed ? "error" : running ? "warning" : "success", status)} ${theme.fg("dim", taskPreview)}`;
					if (resultExcerpt) text += `\n${theme.fg("toolOutput", resultExcerpt)}`;
					if (stats.length > 0) text += `\n${theme.fg("dim", stats.join(" · "))}`;
					return new Text(text, 0, 0);
				}

				const container = new Container();
				container.addChild(
					new Text(
						`${icon} ${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg(failed ? "error" : running ? "warning" : "success", status)}`,
						0,
						0,
					),
				);
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
				container.addChild(new Text(theme.fg("dim", task || "(missing task)"), 0, 0));
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "─── Final Output ───"), 0, 0));
				if (fullOutput.trim()) container.addChild(new Markdown(fullOutput.trim(), 0, 0, getMarkdownTheme()));
				else container.addChild(new Text(theme.fg("muted", "(no final output yet)"), 0, 0));

				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "─── Tool Timeline ───"), 0, 0));
				if (tools.length === 0) {
					container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
				} else {
					let commandIndex = 0;
					for (let index = 0; index < tools.length; index++) {
						const tool = tools[index];
						const args = tool.args && typeof tool.args === "object" ? (tool.args as Record<string, unknown>) : undefined;
						let line = `${index + 1}. ${tool.name}`;
						if (tool.name === "bash") {
							const command = typeof args?.command === "string" ? args.command.replace(/\s+/g, " ").trim() : "";
							const preview = command.length > 140 ? `${command.slice(0, 137)}...` : command || "...";
							const commandMeta = commands[commandIndex++];
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

				const metadataLines = [
					`Exit: ${exitCode ?? "unknown"}${duration ? ` · Duration: ${duration}` : ""}`,
					`Usage: ${usageText || "none"}`,
					`Files read (${filesRead.length}): ${filesRead.join(", ") || "none"}`,
					`Files modified (${filesModified.length}): ${filesModified.join(", ") || "none"}`,
					`Commands: ${commands.length} (${commands.filter((command) => command.isTest).length} tests)`,
				];
				if (metadata?.provider || metadata?.model) metadataLines.push(`Model: ${[metadata.provider, metadata.model].filter(Boolean).join("/")}`);
				if (stopReason) metadataLines.push(`Stop: ${stopReason}`);
				if (metadata?.errorMessage) metadataLines.push(`Error: ${metadata.errorMessage}`);
				if (Array.isArray(details?.contractMissingSections) && details.contractMissingSections.length > 0) {
					metadataLines.push(`Missing sections: ${details.contractMissingSections.join(", ")}`);
				}
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("muted", "─── Metadata ───"), 0, 0));
				container.addChild(new Text(metadataLines.map((line) => theme.fg("dim", line)).join("\n"), 0, 0));

				if (typeof details?.stderr === "string" && details.stderr.trim()) {
					let stderrText = details.stderr.trim();
					if (stderrText.length > 4000) stderrText = `${stderrText.slice(0, 4000).trimEnd()}\n... [stderr truncated in view; full stderr preserved in details]`;
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── stderr ───"), 0, 0));
					container.addChild(new Text(theme.fg("toolOutput", stderrText), 0, 0));
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
			systemPrompt: `${event.systemPrompt}\n\nNarnia mode is enabled. Root session is a delegate-only orchestrator. Use only delegate for file, shell, web, edit, and test work. Delegate bounded tasks with enough context. Keep root context compact. Do not ask child agents to recursively delegate.`,
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
