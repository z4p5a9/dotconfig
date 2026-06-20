import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export type DelegateTaskInput = {
	title: string;
	content: string;
	profile?: "fast";
};

export type DelegateTaskResult = {
	title: string;
	exitCode: number;
	text: string;
	durationMs: number;
	tools: Array<{ name: string; args: unknown }>;
};

export type DelegateDetails = {
	tasks: DelegateTaskResult[];
	exitCode: number;
};

const CHILD_BOOTSTRAP = "Follow the delegated task exactly. Do not delegate further. Return only what the parent needs.";
const FAST_PROFILE_PROMPT = "Fast profile: deterministic concise execution. Do exactly requested; no exploration; return only relevant result.";

export function runDelegateTask(
	task: DelegateTaskInput,
	options: {
		childTools: string[];
		cwd: string;
		model: { provider: string; id: string } | undefined;
		thinkingLevel: string;
		projectTrusted: boolean;
		signal?: AbortSignal;
		onUpdate?: (result: DelegateTaskResult) => void;
	},
): Promise<DelegateTaskResult> {
	return new Promise<DelegateTaskResult>((resolve) => {
		const startedAt = Date.now();
		const tools: Array<{ name: string; args: unknown }> = [];
		const args = ["--mode", "json", "-p", "--no-session"];
		let stdoutBuffer = "";
		let stderr = "";
		let finalOutput = "";
		let returnedText = "";
		let stopReason: string | undefined;
		let errorMessage: string | undefined;
		let processClosed = false;
		let promiseSettled = false;
		let failureRequested = false;
		let terminationTimer: ReturnType<typeof setTimeout> | undefined;
		let abortListener: (() => void) | undefined;

		if (options.childTools.length > 0) args.push("--tools", options.childTools.join(","));
		else args.push("--no-tools");

		args.push("--append-system-prompt", task.profile === "fast" ? `${CHILD_BOOTSTRAP}\n\n${FAST_PROFILE_PROMPT}` : CHILD_BOOTSTRAP);
		if (options.model) args.push("--model", `${options.model.provider}/${options.model.id}`);
		args.push("--thinking", options.thinkingLevel);
		args.push(options.projectTrusted ? "--approve" : "--no-approve");
		args.push(`Task title: ${task.title}\n\nTask:\n${task.content}`);

		const currentScript = process.argv[1];
		const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
		const canRunCurrentScript = currentScript && !isBunVirtualScript && fs.existsSync(currentScript);
		let command = "pi";
		let commandArgs = args;

		if (canRunCurrentScript) {
			command = process.execPath;
			commandArgs = [currentScript, ...args];
		} else {
			const execName = path.basename(process.execPath).toLowerCase();
			if (!/^(node|bun)(\.exe)?$/.test(execName)) command = process.execPath;
		}

		const snapshot = (exitCode = -1): DelegateTaskResult => ({
			title: task.title,
			exitCode,
			text: returnedText,
			durationMs: Math.max(0, Date.now() - startedAt),
			tools: tools.map((tool) => ({ name: tool.name, args: tool.args })),
		});

		const appendError = (error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			errorMessage = errorMessage ? `${errorMessage}\n${message}` : message;
			returnedText = errorMessage;
		};

		const textFromContent = (content: unknown): string => {
			let text = "";
			if (!Array.isArray(content)) return text;
			for (const part of content) {
				if (part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string") {
					text += (part as { text: string }).text;
				}
			}
			return text;
		};

		const processJsonLine = (line: string) => {
			if (!line.trim()) return;

			let event: unknown;
			try {
				event = JSON.parse(line);
			} catch {
				return;
			}

			if (!event || typeof event !== "object") return;
			const typedEvent = event as {
				type?: unknown;
				message?: { role?: unknown; content?: unknown; provider?: unknown; model?: unknown; stopReason?: unknown; errorMessage?: unknown };
				assistantMessageEvent?: unknown;
				toolName?: unknown;
				args?: unknown;
				messages?: unknown;
			};

			if (typedEvent.type === "tool_execution_start") {
				const toolName = typeof typedEvent.toolName === "string" ? typedEvent.toolName : "tool";
				tools.push({ name: toolName, args: typedEvent.args });
				options.onUpdate?.(snapshot());
				return;
			}

			if (typedEvent.type === "message_update") {
				const message = typedEvent.message;
				if (message?.role !== "assistant") return;
				let text = textFromContent(message.content);
				if (!text && typedEvent.assistantMessageEvent && typeof typedEvent.assistantMessageEvent === "object") {
					const streamEvent = typedEvent.assistantMessageEvent as { partial?: unknown; type?: unknown; content?: unknown };
					if (streamEvent.partial && typeof streamEvent.partial === "object") text = textFromContent((streamEvent.partial as { content?: unknown }).content);
					if (!text && streamEvent.type === "text_end" && typeof streamEvent.content === "string") text = streamEvent.content;
				}
				if (text && text !== returnedText) {
					returnedText = text;
					options.onUpdate?.(snapshot());
				}
				return;
			}

			if (typedEvent.type === "message_end") {
				const message = typedEvent.message;
				if (message?.role !== "assistant") return;
				const text = textFromContent(message.content);
				if (text) {
					finalOutput = text;
					returnedText = text;
				}
				if (typeof message.stopReason === "string") stopReason = message.stopReason;
				if (typeof message.errorMessage === "string") errorMessage = message.errorMessage;
				options.onUpdate?.(snapshot());
				return;
			}

			if (typedEvent.type === "agent_end" && Array.isArray(typedEvent.messages)) {
				for (const message of typedEvent.messages) {
					if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "assistant") continue;
					const messageObject = message as { content?: unknown; stopReason?: unknown; errorMessage?: unknown };
					const text = textFromContent(messageObject.content);
					if (text) {
						finalOutput = text;
						returnedText = text;
					}
					if (typeof messageObject.stopReason === "string") stopReason = messageObject.stopReason;
					if (typeof messageObject.errorMessage === "string") errorMessage = messageObject.errorMessage;
				}
				options.onUpdate?.(snapshot());
			}
		};

		const cleanup = () => {
			if (terminationTimer) clearTimeout(terminationTimer);
			if (abortListener && options.signal) options.signal.removeEventListener("abort", abortListener);
		};

		const finish = (exitCode: number) => {
			if (promiseSettled) return;
			promiseSettled = true;
			cleanup();

			if (stdoutBuffer.trim()) {
				try {
					processJsonLine(stdoutBuffer);
				} catch (error) {
					appendError(error);
					exitCode = 1;
				}
			}

			const failed = exitCode !== 0 || stopReason === "error" || stopReason === "aborted";
			const normalizedExitCode = failed && exitCode === 0 ? 1 : exitCode;
			const output = finalOutput || returnedText || errorMessage || stderr.trim() || "(no output)";
			if (failed) {
				let failureLine = "Delegate failed";
				if (stopReason) failureLine += ` (${stopReason})`;
				if (exitCode !== 0) failureLine += ` [exit ${exitCode}]`;
				returnedText = `${failureLine}.\n\n${output}`;
			} else {
				returnedText = output;
			}

			const result = snapshot(normalizedExitCode);
			options.onUpdate?.(result);
			resolve(result);
		};

		let proc;
		try {
			proc = spawn(command, commandArgs, {
				cwd: options.cwd,
				env: { ...process.env, PI_NARNIA_CHILD: "1" },
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (error) {
			appendError(error);
			finish(1);
			return;
		}

		const requestFailure = (error: unknown, waitForClose: boolean) => {
			if (promiseSettled || failureRequested) return;
			failureRequested = true;
			appendError(error);
			options.onUpdate?.(snapshot());

			if (!waitForClose || processClosed) {
				finish(1);
				return;
			}

			try {
				proc.kill("SIGTERM");
				terminationTimer = setTimeout(() => {
					try {
						if (!processClosed && !promiseSettled) proc.kill("SIGKILL");
					} catch (killError) {
						appendError(killError);
						finish(1);
					}
				}, 5000);
			} catch (killError) {
				appendError(killError);
				finish(1);
			}
		};

		proc.stdout.on("data", (data: Buffer) => {
			if (failureRequested) return;
			try {
				stdoutBuffer += data.toString();
				const lines = stdoutBuffer.split("\n");
				stdoutBuffer = lines.pop() || "";
				for (const line of lines) processJsonLine(line);
			} catch (error) {
				requestFailure(error, true);
			}
		});
		proc.stdout.on("error", (error: unknown) => requestFailure(error, true));

		proc.stderr.on("data", (data: Buffer) => {
			try {
				stderr += data.toString();
			} catch (error) {
				requestFailure(error, true);
			}
		});
		proc.stderr.on("error", (error: unknown) => requestFailure(error, true));

		proc.on("error", (error: unknown) => requestFailure(error, false));
		proc.on("close", (code: number | null, exitSignal: string | null) => {
			processClosed = true;
			if (code !== null) finish(code);
			else if (exitSignal === "SIGKILL") finish(137);
			else if (exitSignal === "SIGTERM") finish(143);
			else finish(1);
		});

		abortListener = () => {
			try {
				if (processClosed || promiseSettled) return;
				proc.kill("SIGTERM");
				terminationTimer = setTimeout(() => {
					try {
						if (!processClosed && !promiseSettled) proc.kill("SIGKILL");
					} catch (error) {
						requestFailure(error, false);
					}
				}, 5000);
			} catch (error) {
				requestFailure(error, false);
			}
		};

		if (options.signal?.aborted) abortListener();
		else if (options.signal) options.signal.addEventListener("abort", abortListener, { once: true });
	});
}
