import { Tool } from "../Tool.js";

export class TimeTool extends Tool {
    constructor() {
        super("Time", "Get the current time and date. No input parameters needed.");
    }

    async execute(args) {
        console.log("[TimeTool] Executing");
        return new Date().toLocaleString();
    }
}
