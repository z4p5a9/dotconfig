import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildChildReturnedOutput, childFailed, updateChildContract } from "./aggregation.ts";
import { createChildEventState, processChildJsonLine } from "./child-events.ts";
import { CHILD_BOOTSTRAP, type DelegateChildDetails } from "./delegate-contract.ts";

export function runDelegateChild(
	child: DelegateChildDetails,
	options: {
		childTools: string[];
		getCwd: () => string;
		getModel: () => { provider: string; id: string } | undefined;
		getThinkingLevel: () => string;
		isProjectTrusted: () => boolean;
		signal?: AbortSignal;
		emitAggregateUpdate: () => void;
	},
): Promise<void> {
	return new Promise<void>((resolve) => {
		const state = createChildEventState();
		const args = ["--mode", "json", "-p", "--no-session"];
		if (options.childTools.length > 0) args.push("--tools", options.childTools.join(","));
		else args.push("--no-tools");
		args.push("--append-system-prompt", CHILD_BOOTSTRAP);
		const model = options.getModel();
		if (model) args.push("--model", `${model.provider}/${model.id}`);
		args.push("--thinking", options.getThinkingLevel());
		args.push(options.isProjectTrusted() ? "--approve" : "--no-approve");
		args.push(`Task title: ${child.title}\n\nTask:\n${child.content}`);

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
			if (abortListener && options.signal) options.signal.removeEventListener("abort", abortListener);
		};

		const processLine = (line: string) => {
			const result = processChildJsonLine(child, state, line);
			if (result.assistantMessageChanged || result.toolExecutionStarted) options.emitAggregateUpdate();
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
			options.emitAggregateUpdate();
			resolve();
		};

		let proc;
		try {
			proc = spawn(command, commandArgs, {
				cwd: options.getCwd(),
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
			options.emitAggregateUpdate();

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

		proc.stdout.on("data", (data: Buffer) => {
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
		proc.stdout.on("error", (error: unknown) => requestFailure(error, true));

		proc.stderr.on("data", (data: Buffer) => {
			try {
				child.stderr += data.toString();
			} catch (error) {
				requestFailure(error, true);
			}
		});
		proc.stderr.on("error", (error: unknown) => requestFailure(error, true));

		proc.on("error", (error: unknown) => requestFailure(error, false));
		proc.on("close", (code: number | null, exitSignal: string | null) => {
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

		if (options.signal?.aborted) abortListener();
		else if (options.signal) options.signal.addEventListener("abort", abortListener, { once: true });
	});
}
