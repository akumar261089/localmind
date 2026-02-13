export class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(tool) {
        this.tools.set(tool.name, tool);
        console.log(`[ToolRegistry] Registered: ${tool.name}`);
    }

    get(name) {
        return this.tools.get(name);
    }

    list() {
        return Array.from(this.tools.values());
    }
}
