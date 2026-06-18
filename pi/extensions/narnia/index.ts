import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	buildAggregateReturnedOutput,
	buildChildReturnedOutput,
	createInitialChildren,
	makeDelegateDetails,
	updateChildContract,
} from "./aggregation.ts";
import { runDelegateChild } from "./child-runner.ts";
import {
	DELEGATE_OVERLAP_MESSAGE,
	DELEGATE_TOOL_PARAMETERS,
	makeRejectedDelegateDetails,
	validateDelegateParams,
	type DelegateDetails,
} from "./delegate-contract.ts";
import { registerNarniaModeControls, type NarniaState } from "./mode.ts";
import { renderDelegateCall, renderDelegateResult } from "./render.ts";

function narniaExtension(pi: ExtensionAPI): void {
	if (process.env.PI_NARNIA_CHILD === "1") return;

	let state: NarniaState | undefined;
	let delegateRegistered = false;
	let activeDelegateCalls = 0;

	function ensureDelegateRegistered(): void {
		if (delegateRegistered) return;
		delegateRegistered = true;

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
			parameters: DELEGATE_TOOL_PARAMETERS,
			async execute(
				_toolCallId,
				params,
				signal,
				onUpdate,
				ctx,
			): Promise<{ content: [{ type: "text"; text: string }]; details: DelegateDetails }> {
				const startedAt = Date.now();

				if (activeDelegateCalls > 0) {
					return {
						content: [{ type: "text", text: DELEGATE_OVERLAP_MESSAGE }],
						details: makeRejectedDelegateDetails(startedAt, DELEGATE_OVERLAP_MESSAGE),
					};
				}

				const validation = validateDelegateParams(params);
				if (!validation.ok) {
					return {
						content: [{ type: "text", text: validation.returnedOutput }],
						details: makeRejectedDelegateDetails(startedAt, validation.returnedOutput),
					};
				}

				// Do not persist raw child JSON events here. They include streaming message_update payloads and can make parent sessions hundreds of MB.
				// If full child traces are needed later, write them to an opt-in external trace file with retention, not session details.
				const tasks = validation.tasks;
				const children = createInitialChildren(tasks, startedAt);

				const makeDetails = (endedAt: number, returnedOutput: string): DelegateDetails => makeDelegateDetails(tasks, children, startedAt, endedAt, returnedOutput);

				const emitAggregateUpdate = () => {
					try {
						const returnedOutput = buildAggregateReturnedOutput(children);
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
					emitAggregateUpdate();

					const childTools = Array.from(new Set(pi.getAllTools().map((tool) => tool.name).filter((name) => name !== "delegate")));
					const childPromises = children.map((child) =>
						runDelegateChild(child, {
							childTools,
							getCwd: () => ctx.cwd,
							getModel: () => ctx.model,
							getThinkingLevel: () => pi.getThinkingLevel(),
							isProjectTrusted: () => ctx.isProjectTrusted(),
							signal,
							emitAggregateUpdate,
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

					const returnedOutput = buildAggregateReturnedOutput(children);
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
			renderCall: renderDelegateCall,
			renderResult: renderDelegateResult,
		});
	}

	const updateStatus = registerNarniaModeControls(pi, {
		ensureDelegateRegistered,
		getState: () => state,
		setState: (nextState) => {
			state = nextState;
		},
		getActiveDelegateCalls: () => activeDelegateCalls,
	});
}

export default narniaExtension;
