export class Text {
	text: string;
	x: number;
	y: number;

	constructor(text = "", x = 0, y = 0) {
		this.text = text;
		this.x = x;
		this.y = y;
	}

	setText(text: string) {
		this.text = text;
	}
}

export class Markdown extends Text {}

export class Spacer {
	size: number;

	constructor(size = 1) {
		this.size = size;
	}
}

export class Container {
	children: unknown[] = [];

	addChild(child: unknown) {
		this.children.push(child);
	}
}
