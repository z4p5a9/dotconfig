import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { formatTokens } from "./mode.ts";
import type { DelegateChildDetails, DelegateDetails, DelegateTask } from "./delegate-contract.ts";

function normalizeTasks(tasks: unknown): DelegateTask[] {
	const normalizedTasks: DelegateTask[] = [];
	if (!Array.isArray(tasks)) return normalizedTasks;

	for (const task of tasks) {
		if (!task || typeof task !== "object" || Array.isArray(task)) {
			normalizedTasks.push({ title: "", content: "" });
			continue;
		}

		const taskObject = task as { title?: unknown; content?: unknown };
		normalizedTasks.push({
			title: typeof taskObject.title === "string" ? taskObject.title.trim().replace(/\s+/g, " ") : "",
			content: typeof taskObject.content === "string" ? taskObject.content.trim() : "",
		});
	}

	return normalizedTasks;
}

function resultExcerptFrom(fullOutput: string, running: boolean): string {
	let resultExcerpt = fullOutput.trim() || (running ? "Delegate child running..." : "(no output)");
	if (resultExcerpt.length > 320) resultExcerpt = `${resultExcerpt.slice(0, 317).trimEnd()}...`;

	const excerptLines = resultExcerpt.split(/\r?\n/);
	if (excerptLines.length > 4) resultExcerpt = `${excerptLines.slice(0, 4).join("\n").trimEnd()}...`;

	return resultExcerpt;
}

function formatUsageSummary(usage: DelegateChildDetails["metadata"]["usage"] | undefined): string {
	const usageParts: string[] = [];

	if (usage?.turns) usageParts.push(`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`);
	if (usage?.input) usageParts.push(`↑${formatTokens(usage.input)}`);
	if (usage?.output) usageParts.push(`↓${formatTokens(usage.output)}`);
	if (usage?.cacheRead) usageParts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage?.cacheWrite) usageParts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage?.cost) usageParts.push(`$${usage.cost.toFixed(4)}`);
	if (usage?.contextTokens) usageParts.push(`ctx:${formatTokens(usage.contextTokens)}`);

	return usageParts.join(" ");
}

export function renderDelegateCall(_args: unknown, _theme: unknown, context: { lastComponent?: unknown }): Text {
	const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
	text.setText("");
	return text;
}

export function renderDelegateResult(
	result: { content: Array<{ type: string; text?: string }>; details?: unknown },
	{ expanded, isPartial }: { expanded: boolean; isPartial: boolean },
	theme: { fg: (color: string, text: string) => string; bold: (text: string) => string },
	context: { args?: unknown; isError?: boolean },
): Text | Container {
	const details = result.details as Partial<DelegateDetails> | undefined;
	const content = result.content.find((part) => part.type === "text");
	const contentText = content?.type === "text" ? content.text : "";

	const argsObject = context.args && typeof context.args === "object" ? (context.args as { tasks?: unknown }) : {};
	const argsTasks = normalizeTasks(argsObject.tasks);
	const detailTasks = normalizeTasks(details?.tasks);
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

	const aggregateExitCode = typeof details?.exitCode === "number" ? details.exitCode : undefined;
	const rejectedWithoutChildren = !!details && !isPartial && detailChildren.length === 0 && aggregateExitCode !== undefined && aggregateExitCode !== 0;
	const totalTasks = rejectedWithoutChildren ? 0 : Math.max(detailTasks.length, argsTasks.length, maxChildIndex + 1, detailChildren.length);
	const rows = Array.from({ length: totalTasks }, (_, index) => {
		const child = childrenByIndex.get(index) ?? detailChildren[index];
		const childTitle = typeof child?.title === "string" && child.title.trim() ? child.title : detailTasks[index]?.title || argsTasks[index]?.title || "";
		const title = childTitle.trim().replace(/\s+/g, " ");
		const titlePreview = title.length > 100 ? `${title.slice(0, 97)}...` : title || "...";
		const childContent = typeof child?.content === "string" && child.content.trim() ? child.content.trim() : "";
		const content = childContent || detailTasks[index]?.content || argsTasks[index]?.content || "";
		const metadata = child?.metadata;
		const filesRead = Array.isArray(metadata?.filesRead) ? metadata.filesRead : [];
		const filesModified = Array.isArray(metadata?.filesModified) ? metadata.filesModified : [];
		const tools = Array.isArray(metadata?.tools) ? metadata.tools : [];
		const commands = Array.isArray(metadata?.commands) ? metadata.commands : [];
		const usage = metadata?.usage;
		const exitCode = typeof child?.exitCode === "number" ? child.exitCode : undefined;
		const stopReason = typeof metadata?.stopReason === "string" ? metadata.stopReason : undefined;
		const childStatus = child?.status === "running" || child?.status === "completed" || child?.status === "failed" ? child.status : undefined;
		const inferredRunning = child ? exitCode === -1 || (isPartial && exitCode === undefined) : isPartial;
		const inferredFailed = (exitCode !== undefined && exitCode !== 0 && exitCode !== -1) || stopReason === "error" || stopReason === "aborted";
		const running = childStatus ? childStatus === "running" : inferredRunning;
		const failed = childStatus ? childStatus === "failed" : context.isError || inferredFailed;
		const fullOutput =
			(typeof child?.finalOutput === "string" && child.finalOutput) ||
			(typeof child?.returnedOutput === "string" && child.returnedOutput) ||
			"";
		const resultExcerpt = resultExcerptFrom(fullOutput, running);
		const usageText = formatUsageSummary(usage);
		const stats = [`${filesRead.length} read`, `${filesModified.length} changed`, `${commands.length} cmds`];
		const duration = typeof child?.durationMs === "number" && child.durationMs >= 0 ? `${(child.durationMs / 1000).toFixed(1)}s` : undefined;

		return {
			index,
			child,
			title,
			titlePreview,
			content,
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

	const running = isPartial || aggregateExitCode === -1 || rows.some((row) => row.running);
	const failed = context.isError || (aggregateExitCode !== undefined && aggregateExitCode !== 0 && aggregateExitCode !== -1) || rows.some((row) => row.failed);
	const succeededTasks = rows.filter((row) => !row.running && !row.failed).length;
	const parentSummary = totalTasks > 0 ? `${succeededTasks}/${totalTasks} tasks succeeded` : failed ? "rejected" : "no tasks";
	const icon = running ? theme.fg("warning", "⏳") : failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
	const status = running ? "running" : failed ? "failed" : "done";
	const statusColor = running ? "warning" : failed ? "error" : "success";

	if (!expanded) {
		let text = `${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg("dim", `${totalTasks} tasks`)}`;

		for (const row of rows) {
			const childIcon = row.running ? theme.fg("warning", "⏳") : row.failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
			text += `\n  ${childIcon} ${theme.fg("toolTitle", row.titlePreview)} ${theme.fg("dim", "|")} ${theme.fg("dim", row.stats.join(" · "))}`;
			if (row.resultExcerpt) {
				for (const line of row.resultExcerpt.split(/\r?\n/)) text += `\n    ${theme.fg("toolOutput", line)}`;
			}
		}

		if (rows.length === 0 && contentText.trim()) text += `\n${theme.fg("toolOutput", contentText.trim())}`;
		return new Text(text, 0, 0);
	}

	const container = new Container();
	container.addChild(new Text(`${icon} ${theme.fg("toolTitle", theme.bold("delegate"))} ${theme.fg(statusColor, status)} ${theme.fg("dim", parentSummary)}`, 0, 0));
	container.addChild(new Spacer(1));
	container.addChild(new Text(theme.fg("muted", "─── Tasks ───"), 0, 0));

	if (rows.length === 0) {
		container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
	} else {
		for (const row of rows) {
			const childIcon = row.running ? theme.fg("warning", "⏳") : row.failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
			container.addChild(new Text(`  ${childIcon} ${theme.fg("toolTitle", row.titlePreview)} ${theme.fg("dim", "|")} ${theme.fg("dim", row.stats.join(" · "))}`, 0, 0));
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
		container.addChild(new Text(theme.fg("muted", `─── ${row.title || `Task ${row.index + 1}`} ───`), 0, 0));
		container.addChild(new Text(theme.fg("dim", row.content || "(missing task content)"), 0, 0));
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
}
