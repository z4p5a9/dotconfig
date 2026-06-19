import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import type { DelegateDetails, DelegateTaskResult } from "./child-runner.ts";

export function renderDelegateCall(args: unknown, theme: { fg?: (color: string, text: string) => string; bold?: (text: string) => string }, context: { lastComponent?: unknown }): Text {
	const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
	const color = theme.fg ?? ((_color: string, value: string) => value);
	const bold = theme.bold ?? ((value: string) => value);
	const rawTasks = args && typeof args === "object" && Array.isArray((args as { tasks?: unknown }).tasks) ? (args as { tasks: unknown[] }).tasks : [];
	const titles: string[] = [];

	for (const rawTask of rawTasks) {
		if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) {
			titles.push("...");
			continue;
		}
		const title = typeof (rawTask as { title?: unknown }).title === "string" ? (rawTask as { title: string }).title.trim().replace(/\s+/g, " ") : "";
		titles.push(title || "...");
	}

	let output = `${color("toolTitle", bold("delegate"))}: ${titles.length} task${titles.length === 1 ? "" : "s"}`;
	for (const title of titles) output += `\n  - ${color("toolTitle", title.length > 100 ? `${title.slice(0, 97)}...` : title)}`;
	text.setText(output);
	return text;
}

export function renderDelegateResult(
	result: { content: Array<{ type: string; text?: string }>; details?: unknown },
	{ expanded, isPartial }: { expanded: boolean; isPartial: boolean },
	theme: { fg: (color: string, text: string) => string; bold: (text: string) => string },
	context: { args?: unknown; isError?: boolean },
): Text | Container {
	const details = result.details && typeof result.details === "object" ? (result.details as Partial<DelegateDetails>) : undefined;
	const rawTasks = Array.isArray(details?.tasks) ? details.tasks : [];
	const tasks: DelegateTaskResult[] = [];

	for (const rawTask of rawTasks) {
		if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) continue;
		const task = rawTask as Partial<DelegateTaskResult>;
		tasks.push({
			title: typeof task.title === "string" && task.title.trim() ? task.title.trim().replace(/\s+/g, " ") : `Task ${tasks.length + 1}`,
			exitCode: typeof task.exitCode === "number" && Number.isFinite(task.exitCode) ? task.exitCode : -1,
			text: typeof task.text === "string" ? task.text : "",
			durationMs: typeof task.durationMs === "number" && Number.isFinite(task.durationMs) ? Math.max(0, task.durationMs) : 0,
			tools: Array.isArray(task.tools) ? task.tools.filter((tool): tool is { name: string; args: unknown } => !!tool && typeof tool === "object" && typeof (tool as { name?: unknown }).name === "string").map((tool) => ({ name: tool.name, args: tool.args })) : [],
		});
	}

	if (tasks.length === 0 && context.args && typeof context.args === "object" && Array.isArray((context.args as { tasks?: unknown }).tasks)) {
		for (const rawTask of (context.args as { tasks: unknown[] }).tasks) {
			if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) continue;
			const title = typeof (rawTask as { title?: unknown }).title === "string" && (rawTask as { title: string }).title.trim() ? (rawTask as { title: string }).title.trim().replace(/\s+/g, " ") : `Task ${tasks.length + 1}`;
			tasks.push({ title, exitCode: -1, text: "", durationMs: 0, tools: [] });
		}
	}

	const contentText = result.content.find((part) => part.type === "text")?.text ?? "";
	const aggregateExitCode = typeof details?.exitCode === "number" && Number.isFinite(details.exitCode) ? details.exitCode : undefined;
	const running = isPartial || aggregateExitCode === -1 || tasks.some((task) => task.exitCode === -1);
	const failed = context.isError || (aggregateExitCode !== undefined && aggregateExitCode !== 0 && aggregateExitCode !== -1) || tasks.some((task) => task.exitCode !== 0 && task.exitCode !== -1);
	const succeededTasks = tasks.filter((task) => task.exitCode === 0).length;
	const icon = running ? theme.fg("warning", "⏳") : failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
	const status = running ? "" : failed ? "failed" : "done";
	const statusColor = failed ? "error" : "success";

	if (!expanded) {
		let output = "";
		for (const task of tasks) {
			const taskIcon = task.exitCode === -1 ? theme.fg("warning", "⏳") : task.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
			const title = task.title.length > 100 ? `${task.title.slice(0, 97)}...` : task.title;
			const meta: string[] = [];
			if (task.exitCode !== 0 && task.exitCode !== -1) meta.push("failed");
			if (task.tools.length > 0) meta.push(`${task.tools.length} tool${task.tools.length === 1 ? "" : "s"}`);
			if (task.durationMs > 0) meta.push(`${(task.durationMs / 1000).toFixed(1)}s`);
			const suffix = meta.length ? ` ${theme.fg("dim", `· ${meta.join(" · ")}`)}` : "";
			let excerpt = task.text.trim();
			if (task.exitCode !== 0 && task.exitCode !== -1 && excerpt.startsWith("Delegate failed")) {
				const body = excerpt.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim();
				excerpt = body;
			}
			if (excerpt.length > 320) excerpt = `${excerpt.slice(0, 317).trimEnd()}...`;
			const lines = excerpt ? excerpt.split(/\r?\n/) : [];
			if (lines.length > 4) excerpt = `${lines.slice(0, 4).join("\n").trimEnd()}...`;
			output += `${output ? "\n" : ""}  ${taskIcon} ${theme.fg("toolTitle", title)}${suffix}`;
			if (excerpt) for (const line of excerpt.split(/\r?\n/)) output += `\n    ${theme.fg("toolOutput", line)}`;
		}
		if (tasks.length === 0 && contentText.trim()) output = theme.fg("toolOutput", contentText.trim());
		return new Text(output, 0, 0);
	}

	const container = new Container();
	container.addChild(new Text(`${icon}${status ? ` ${theme.fg(statusColor, status)}` : ""} ${theme.fg("dim", `${succeededTasks}/${tasks.length} tasks succeeded`)}`, 0, 0));

	if (tasks.length === 0) {
		if (contentText.trim()) {
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("muted", "─── Result ───"), 0, 0));
			container.addChild(new Text(theme.fg("toolOutput", contentText.trim()), 0, 0));
		}
		return container;
	}

	for (const task of tasks) {
		const taskIcon = task.exitCode === -1 ? theme.fg("warning", "⏳") : task.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
		const meta: string[] = [];
		if (task.exitCode !== 0 && task.exitCode !== -1) meta.push(`failed (exit ${task.exitCode})`);
		if (task.durationMs > 0) meta.push(`${(task.durationMs / 1000).toFixed(1)}s`);
		if (task.tools.length > 0) meta.push(`${task.tools.length} tool${task.tools.length === 1 ? "" : "s"}`);
		const suffix = meta.length ? ` ${theme.fg("dim", `· ${meta.join(" · ")}`)}` : "";
		container.addChild(new Spacer(1));
		container.addChild(new Text(`${taskIcon} ${theme.fg("toolTitle", task.title)}${suffix}`, 0, 0));
		const taskText = task.text.trim();
		if (taskText || task.exitCode !== -1) {
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
			if (taskText) container.addChild(new Markdown(taskText, 0, 0, getMarkdownTheme()));
			else container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
		}
		if (task.tools.length > 0 || task.exitCode !== -1) {
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("muted", "─── Tools ───"), 0, 0));
			if (task.tools.length === 0) {
				container.addChild(new Text(theme.fg("muted", "(none)"), 0, 0));
			} else {
				for (let index = 0; index < task.tools.length; index++) {
					const tool = task.tools[index];
					let preview = "";
					try {
						preview = tool.args === undefined ? "" : JSON.stringify(tool.args);
					} catch {
						preview = "[unserializable args]";
					}
					if (preview.length > 160) preview = `${preview.slice(0, 157)}...`;
					container.addChild(new Text(theme.fg("toolOutput", `${index + 1}. ${tool.name}${preview ? ` ${preview}` : ""}`), 0, 0));
				}
			}
		}
	}

	return container;
}
