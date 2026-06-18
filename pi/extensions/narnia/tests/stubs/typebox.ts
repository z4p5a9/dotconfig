export const Type = {
	Object: (properties: unknown, options?: unknown) => ({ type: "object", properties, options }),
	Array: (items: unknown, options?: unknown) => ({ type: "array", items, options }),
	String: (options?: unknown) => ({ type: "string", options }),
};
