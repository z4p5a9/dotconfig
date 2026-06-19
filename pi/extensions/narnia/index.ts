import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { runDelegateTask, type DelegateDetails, type DelegateTaskInput, type DelegateTaskResult } from "./child-runner.ts";
import { renderDelegateCall, renderDelegateResult } from "./render.ts";

const CUSTOM_TYPE = "narnia";
const BLOCK_REASON = "Narnia Mode: root session cannot call tools directly. Use one delegate call with tasks: { title: string; content: string }[]; batch currently-known independent work into multiple titled tasks.";
const NARNIA_ROOT_PROMPT = "Narnia mode is enabled. Root session is a delegate-only orchestrator. Use only delegate for file, shell, web, edit, and test work. Use one delegate call containing multiple titled tasks for all currently-known independent work. Do not make multiple delegate calls in the same turn unless later work depends on earlier delegate results. Always look for work that can be parallelized before delegating. Each task object needs a concise title and full content. Delegate bounded tasks with enough context. Keep root context compact. Do not ask child agents to recursively delegate.";
const DELEGATE_OVERLAP_MESSAGE = "Delegate already has an active call. Combine all currently-known independent work into one delegate call with multiple titled tasks, or wait for prior delegate results before making dependent follow-up calls.";

function narniaExtension(pi: ExtensionAPI): void {
	if (process.env.PI_NARNIA_CHILD === "1") return;

	let enabled = false;
	let previousActiveTools: string[] | undefined;
	let delegateRegistered = false;
	let activeDelegateCalls = 0;

	const allConfiguredExceptDelegate = () => pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate");
	const currentActiveExceptDelegate = () => {
		const activeTools = typeof pi.getActiveTools === "function" ? pi.getActiveTools() : allConfiguredExceptDelegate();
		return activeTools.filter((name) => name !== "delegate");
	};
	const detailsFrom = (tasks: DelegateTaskResult[]): DelegateDetails => ({
		tasks: tasks.map((task) => ({
			title: task.title,
			exitCode: task.exitCode,
			text: task.text,
			durationMs: task.durationMs,
			tools: task.tools.map((tool) => ({ name: tool.name, args: tool.args })),
		})),
		exitCode: tasks.some((task) => task.exitCode === -1) ? -1 : tasks.some((task) => task.exitCode !== 0) ? 1 : 0,
	});
	const textFrom = (tasks: DelegateTaskResult[]) => {
		const doneTasks = tasks.filter((task) => task.exitCode !== -1);
		const succeededTasks = doneTasks.filter((task) => task.exitCode === 0).length;
		return [`${succeededTasks}/${tasks.length} tasks succeeded.`, ...tasks.map((task) => task.text.trim() ? `## ${task.title}\n\n${task.text}` : `## ${task.title}`)].join("\n\n");
	};

	function updateStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;

		const usage = ctx.getContextUsage();
		let tokens = "";
		if (usage?.tokens !== null && usage?.tokens !== undefined) {
			const count = Math.max(0, Number.isFinite(usage.tokens) ? usage.tokens : 0);
			let formatted = `${Math.round(count)}`;
			if (count >= 1_000 && count < 10_000) formatted = `${(count / 1_000).toFixed(1)}k`;
			else if (count >= 10_000 && count < 1_000_000) formatted = `${Math.round(count / 1_000)}k`;
			else if (count >= 1_000_000 && count < 10_000_000) formatted = `${(count / 1_000_000).toFixed(1)}M`;
			else if (count >= 10_000_000) formatted = `${Math.round(count / 1_000_000)}M`;
			tokens = ` · ctx ${formatted}`;
		}

		const running = activeDelegateCalls > 0;
		ctx.ui.setStatus(CUSTOM_TYPE, ctx.ui.theme.fg(running ? "warning" : "dim", `Narnia: ${running ? "child running" : enabled ? "on" : "off"}${tokens}`));
	}

	function restoreFromBranch(ctx: ExtensionContext): void {
		let savedState: { enabled: boolean; previousActiveTools?: string[] } | undefined;

		for (const entry of ctx.sessionManager.getBranch()) {
			if (!entry || typeof entry !== "object") continue;
			const customEntry = entry as { type?: unknown; customType?: unknown; data?: unknown };
			if (customEntry.type !== "custom" || customEntry.customType !== CUSTOM_TYPE || !customEntry.data || typeof customEntry.data !== "object") continue;
			const data = customEntry.data as { enabled?: unknown; previousActiveTools?: unknown };
			if (typeof data.enabled !== "boolean") continue;
			savedState = {
				enabled: data.enabled,
				previousActiveTools: Array.isArray(data.previousActiveTools) ? data.previousActiveTools.filter((name): name is string => typeof name === "string" && name !== "delegate") : undefined,
			};
		}

		enabled = savedState?.enabled ?? false;
		previousActiveTools = savedState?.previousActiveTools;

		if (savedState?.enabled) {
			ensureDelegateRegistered();
			pi.setActiveTools(["delegate"]);
		} else if (savedState) {
			ensureDelegateRegistered();
			pi.setActiveTools(previousActiveTools ?? allConfiguredExceptDelegate());
		}

		updateStatus(ctx);
	}

	function ensureDelegateRegistered(): void {
		if (delegateRegistered) return;
		delegateRegistered = true;

		const delegateParameters = Type.Object(
			{
				tasks: Type.Array(
					Type.Object(
						{
							title: Type.String({ description: "Required. 1-4 word task title.", minLength: 1 }),
							content: Type.String({ description: "Required. Non-empty task content.", minLength: 1 }),
						},
						{ additionalProperties: false },
					),
					{
						description: "Required. Array of { title: string; content: string } task objects. Batch currently-known independent work into one call. Titles must be concise, 1-4 words. Content must be complete and non-empty.",
						minItems: 1,
					},
				),
			},
			{ additionalProperties: false },
		);

		pi.registerTool({
			name: "delegate",
			label: "Delegate",
			description: "Delegate bounded tasks to isolated child Pi processes. Batch currently-known independent work into one call with multiple tasks: { title: string; content: string }[].",
			promptSnippet: "Run bounded titled file, shell, web, edit, and test work outside the root session.",
			promptGuidelines: [
				"Use one delegate call with tasks: [{ title, content }] for all currently-known independent file, shell, web, edit, and test work while Narnia mode is enabled.",
				"Do not make multiple delegate calls in the same turn unless later work depends on earlier delegate results.",
				"Each task object must have a concise title and full task content.",
				"Do not ask delegate to recursively delegate.",
			],
			parameters: delegateParameters,
			async execute(_toolCallId, params: Static<typeof delegateParameters>, signal, onUpdate, ctx): Promise<{ content: [{ type: "text"; text: string }]; details: DelegateDetails }> {
				if (activeDelegateCalls > 0) {
					return {
						content: [{ type: "text", text: DELEGATE_OVERLAP_MESSAGE }],
						details: { tasks: [], exitCode: 1 },
					};
				}

				let validationError = "";
				const tasks: DelegateTaskInput[] = [];

				for (let index = 0; index < params.tasks.length; index++) {
					const task = params.tasks[index];
					const taskNumber = index + 1;
					const title = task.title.trim().replace(/\s+/g, " ");
					const content = task.content.trim();

					if (!title) {
						validationError = `Delegate task ${taskNumber} title is empty.`;
						break;
					}

					if (title.split(" ").length > 4) {
						validationError = `Delegate task ${taskNumber} title must be 1-4 words.`;
						break;
					}

					if (!content) {
						validationError = `Delegate task ${taskNumber} content is empty.`;
						break;
					}

					tasks.push({ title, content });
				}

				if (validationError) {
					return {
						content: [{ type: "text", text: validationError }],
						details: { tasks: [], exitCode: 1 },
					};
				}

				const taskResults = tasks.map((task): DelegateTaskResult => ({ title: task.title, exitCode: -1, text: "", durationMs: 0, tools: [] }));
				const emitUpdate = () => {
					try {
						onUpdate?.({ content: [{ type: "text", text: textFrom(taskResults) }], details: detailsFrom(taskResults) });
					} catch (error) {
						console.error("[narnia] delegate partial update failed", error);
					}
				};

				activeDelegateCalls += 1;
				updateStatus(ctx);

				try {
					emitUpdate();
					const childTools = Array.from(new Set(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate")));
					await Promise.allSettled(tasks.map((task, index) =>
						runDelegateTask(task, {
							childTools,
							cwd: ctx.cwd,
							model: ctx.model,
							thinkingLevel: pi.getThinkingLevel(),
							projectTrusted: ctx.isProjectTrusted(),
							signal,
							onUpdate: (result) => {
								taskResults[index] = result;
								emitUpdate();
							},
						}).then((result) => {
							taskResults[index] = result;
							emitUpdate();
						}).catch((error) => {
							const message = error instanceof Error ? error.message : String(error);
							taskResults[index] = {
								title: task.title,
								exitCode: 1,
								text: `Delegate failed.\n\n${message}`,
								durationMs: taskResults[index].durationMs,
								tools: taskResults[index].tools,
							};
							emitUpdate();
						}),
					));

					const returnedOutput = textFrom(taskResults);
					return {
						content: [{ type: "text", text: returnedOutput }],
						details: detailsFrom(taskResults),
					};
				} finally {
					activeDelegateCalls = Math.max(0, activeDelegateCalls - 1);
					updateStatus(ctx);
				}
			},
			renderCall: renderDelegateCall,
			renderResult: renderDelegateResult,
		});
	}

	pi.registerCommand("narnia", {
		description: "Enable/disable Narnia delegate-only root mode",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();

			if (!command) {
				updateStatus(ctx);
				ctx.ui.notify(`Narnia: ${enabled ? "on" : "off"}\nUsage: /narnia on | /narnia off`, "info");
				return;
			}

			if (command === "on") {
				if (!enabled) previousActiveTools = currentActiveExceptDelegate();
				ensureDelegateRegistered();
				enabled = true;
				pi.appendEntry(CUSTOM_TYPE, { enabled: true, previousActiveTools });
				pi.setActiveTools(["delegate"]);
				updateStatus(ctx);
				ctx.ui.notify("Narnia enabled. Root tools restricted to delegate; paste/! output can still pollute root context.", "warning");
				return;
			}

			if (command === "off") {
				ensureDelegateRegistered();
				const restoredTools = previousActiveTools ?? allConfiguredExceptDelegate();
				enabled = false;
				previousActiveTools = restoredTools;
				pi.appendEntry(CUSTOM_TYPE, { enabled: false, previousActiveTools: restoredTools });
				pi.setActiveTools(restoredTools);
				updateStatus(ctx);
				ctx.ui.notify("Narnia disabled.", "info");
				return;
			}

			ctx.ui.notify("Usage: /narnia on | /narnia off", "warning");
		},
	});

	pi.on("session_start", (_event, ctx) => {
		try {
			restoreFromBranch(ctx);
		} catch (error) {
			console.error("[narnia] failed during session_start", error);
		}
	});

	pi.on("session_tree", (_event, ctx) => {
		try {
			restoreFromBranch(ctx);
		} catch (error) {
			console.error("[narnia] failed during session_tree", error);
		}
	});

	pi.on("before_agent_start", (event, ctx) => {
		updateStatus(ctx);
		if (!enabled) return undefined;
		return { systemPrompt: `${event.systemPrompt}\n\n${NARNIA_ROOT_PROMPT}` };
	});

	pi.on("tool_call", (event) => {
		if (!enabled || event.toolName === "delegate") return undefined;
		return { block: true, reason: BLOCK_REASON };
	});

	pi.on("session_shutdown", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus(CUSTOM_TYPE, undefined);
		enabled = false;
		previousActiveTools = undefined;
		activeDelegateCalls = 0;
	});
}

export default narniaExtension;
