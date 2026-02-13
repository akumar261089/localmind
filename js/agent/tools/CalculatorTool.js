import { Tool } from "../Tool.js";

export class CalculatorTool extends Tool {
    constructor() {
        super("Calculator", "Perform basic arithmetic calculations. Input should be a JSON object with 'expression' string, e.g. { \"expression\": \"2 + 2\" }");
    }

    async execute(args) {
        console.log("[CalculatorTool] Executing:", args);
        try {
            // Safety: Using Function constructor is safer than eval, but still risky if input is unsanitized.
            // For a local tool running in browser, it's acceptable for now.
            const expr = args.expression || args;
            // Basic sanitization to allow only math chars
            if (!/^[0-9+\-*/().\s]*$/.test(expr)) {
                return "Error: Invalid characters in expression.";
            }
            const result = new Function(`return ${expr}`)();
            return String(result);
        } catch (err) {
            return `Error: ${err.message}`;
        }
    }
}
