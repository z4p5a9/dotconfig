export const Type = {
	Object: (properties: unknown, options?: unknown) => ({ type: "object", properties, options }),
	Array: (items: unknown, options?: unknown) => ({ type: "array", items, options }),
	String: (options?: unknown) => ({ type: "string", options }),
	Literal: (value: unknown, options?: unknown) => ({ type: typeof value, const: value, options }),
	Optional: (schema: unknown) => ({ ...(schema as object), optional: true }),
};
