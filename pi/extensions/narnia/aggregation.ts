import { CHILD_REQUIRED_SECTIONS, type DelegateChildDetails, type DelegateDetails, type DelegateTask } from "./delegate-contract.ts";

const RETURNED_OUTPUT_CAP_BYTES = 12 * 1024;

export function createInitialChildren(tasks: DelegateTask[], startedAt: number): DelegateChildDetails[] {
	return tasks.map((task, index) => ({
		index,
		title: task.title,
		content: task.content,
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
}

export function updateChildContract(child: DelegateChildDetails): void {
	const lines = child.finalOutput.split(/\r?\n/).map((line) => line.trim());
	child.contractMissingSections = CHILD_REQUIRED_SECTIONS.filter((section) => !lines.includes(section));
}

export function childFailed(child: DelegateChildDetails): boolean {
	return (
		child.status === "failed" ||
		(child.exitCode !== -1 && (child.exitCode !== 0 || child.metadata.stopReason === "error" || child.metadata.stopReason === "aborted"))
	);
}

export function childSucceeded(child: DelegateChildDetails): boolean {
	return child.status === "completed" || (child.exitCode !== -1 && !childFailed(child));
}

export function buildChildReturnedOutput(child: DelegateChildDetails): string {
	const failed = childFailed(child);
	const output = child.finalOutput || child.metadata.errorMessage || child.stderr.trim() || "(no output)";
	return failed
		? `Delegate failed${child.metadata.stopReason ? ` (${child.metadata.stopReason})` : ""}${child.exitCode !== -1 && child.exitCode !== 0 ? ` [exit ${child.exitCode}]` : ""}.\n\n${output}`
		: output;
}

function capReturnedOutput(returnedOutput: string): string {
	if (Buffer.byteLength(returnedOutput, "utf8") <= RETURNED_OUTPUT_CAP_BYTES) return returnedOutput;

	const truncationNotice = "\n\n[Delegate output truncated to 12KB. Full per-child output preserved in tool details.]";
	let cappedOutput = returnedOutput.slice(0, RETURNED_OUTPUT_CAP_BYTES - Buffer.byteLength(truncationNotice, "utf8"));
	while (Buffer.byteLength(`${cappedOutput}${truncationNotice}`, "utf8") > RETURNED_OUTPUT_CAP_BYTES) cappedOutput = cappedOutput.slice(0, -1);
	return `${cappedOutput.trimEnd()}${truncationNotice}`;
}

export function buildAggregateReturnedOutput(children: DelegateChildDetails[]): string {
	let returnedOutput = `${children.filter(childSucceeded).length}/${children.length} tasks succeeded.`;
	for (const child of children) returnedOutput += `\n\n## ${child.title}\n\n${child.returnedOutput || "Delegate child running..."}`;
	return capReturnedOutput(returnedOutput);
}

function cloneChild(child: DelegateChildDetails, endedAt: number): DelegateChildDetails {
	const childEndedAt = child.exitCode === -1 ? endedAt : child.endedAt;
	return {
		index: child.index,
		title: child.title,
		content: child.content,
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
}

export function makeDelegateDetails(
	tasks: DelegateTask[],
	children: DelegateChildDetails[],
	startedAt: number,
	endedAt: number,
	returnedOutput: string,
): DelegateDetails {
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
		if (child.stderr.trim()) stderr += `${stderr ? "\n\n" : ""}${child.title} stderr:\n${child.stderr.trim()}`;
		if (child.metadata.provider) provider = child.metadata.provider;
		if (child.metadata.model) model = child.metadata.model;
		if (child.metadata.stopReason && !stopReason) stopReason = child.metadata.stopReason;
		if (child.metadata.errorMessage) errorMessages.push(`${child.title}: ${child.metadata.errorMessage}`);
	}

	const aggregateExitCode = children.some((child) => child.exitCode === -1) ? -1 : children.some(childFailed) ? 1 : 0;
	const firstChild = children[0];

	return {
		tasks: tasks.map((task) => ({ title: task.title, content: task.content })),
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
		contractMissingSections: CHILD_REQUIRED_SECTIONS.filter((section) => children.some((child) => child.contractMissingSections.includes(section))),
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
}
