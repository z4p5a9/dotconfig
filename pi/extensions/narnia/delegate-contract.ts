import { Type } from "typebox";

export type DelegateChildStatus = "running" | "completed" | "failed";

export type DelegateTask = {
	title: string;
	content: string;
};

export type DelegateChildDetails = {
	index: number;
	title: string;
	content: string;
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

export type DelegateDetails = Omit<DelegateChildDetails, "index" | "title" | "content" | "status"> & {
	tasks: DelegateTask[];
	children: DelegateChildDetails[];
};

export const CHILD_REQUIRED_SECTIONS = [
	"## Result",
	"## Changed",
	"## Inspected",
	"## Commands",
	"## Decisions",
	"## Risks",
	"## Needs Parent/User",
];

export const CHILD_BOOTSTRAP = `You are a Narnia child Pi process. Complete the delegated task directly with the available tools. Do not use delegate or ask for recursive delegation. Keep work bounded to the task. Final output must use this exact markdown shape:

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

export const DELEGATE_OVERLAP_MESSAGE = "Delegate already has an active call. Combine all currently-known independent work into one delegate call with multiple titled tasks, or wait for prior delegate results before making dependent follow-up calls.";

export const DELEGATE_TOOL_PARAMETERS = Type.Object(
	{
		tasks: Type.Array(
			Type.Object(
				{
					title: Type.String({
						description: "Required. 1-4 word task title.",
						minLength: 1,
					}),
					content: Type.String({
						description: "Required. Non-empty task content.",
						minLength: 1,
					}),
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

export function validateDelegateParams(params: unknown): { ok: true; tasks: DelegateTask[] } | { ok: false; returnedOutput: string } {
	const paramsObject = params && typeof params === "object" ? (params as Record<string, unknown>) : {};

	if ("task" in paramsObject) {
		return {
			ok: false,
			returnedOutput: "Delegate accepts only tasks: { title: string; content: string }[]. Use delegate({ tasks: [{ title, content }] }).",
		};
	}

	if (!("tasks" in paramsObject)) return { ok: false, returnedOutput: "Delegate tasks is required." };
	if (!Array.isArray(paramsObject.tasks)) return { ok: false, returnedOutput: "Delegate tasks must be an array." };
	if (paramsObject.tasks.length === 0) return { ok: false, returnedOutput: "Delegate tasks must contain at least one task." };

	const tasks: DelegateTask[] = [];
	for (let index = 0; index < paramsObject.tasks.length; index++) {
		const rawTask = paramsObject.tasks[index];
		if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) {
			return { ok: false, returnedOutput: `Delegate task ${index + 1} must be an object with title and content.` };
		}

		const rawTaskObject = rawTask as { title?: unknown; content?: unknown };
		if (typeof rawTaskObject.title !== "string" || typeof rawTaskObject.content !== "string") {
			return { ok: false, returnedOutput: `Delegate task ${index + 1} must be an object with title and content.` };
		}

		const title = rawTaskObject.title.trim().replace(/\s+/g, " ");
		const titleWordCount = title ? title.split(" ").length : 0;
		if (titleWordCount < 1 || titleWordCount > 4) {
			return { ok: false, returnedOutput: `Delegate task ${index + 1} title must be 1-4 words.` };
		}

		const content = rawTaskObject.content.trim();
		if (!content) return { ok: false, returnedOutput: `Delegate task ${index + 1} content is empty.` };

		tasks.push({ title, content });
	}

	return { ok: true, tasks };
}

export function makeRejectedDelegateDetails(startedAt: number, returnedOutput: string): DelegateDetails {
	const endedAt = Date.now();
	return {
		tasks: [],
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
		contractMissingSections: [],
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
}
