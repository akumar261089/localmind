/**
 * Assistant Class
 * Implements the ReAct (Reason+Act) loop for Level 2 Assistant Mode.
 */
export class Assistant {
    /**
     * @param {object} engine - The MLCEngine instance
     * @param {ToolRegistry} toolRegistry - The registry of available tools
     * @param {string} systemPrompt - The base system prompt
     */
    constructor(engine, toolRegistry, systemPrompt = "You are a helpful assistant.") {
        this.engine = engine;
        this.toolRegistry = toolRegistry;
        this.baseSystemPrompt = systemPrompt;
        this.maxSteps = 5; // Prevent infinite loops
    }

    /**
     * Compiles the full system prompt with tool instructions.
     * @param {ToolRegistry} toolRegistry - The registry to get tools from
     * @param {string} basePrompt - The base system prompt
     * @returns {string} The full system prompt with tools
     */
    static compileSystemPrompt(toolRegistry, basePrompt) {
        const base = basePrompt || "You are a helpful assistant.";
        const tools = toolRegistry.list();
        const toolDesc = tools.map(t => `${t.name}: ${t.description}`).join("\n");
        const toolNames = tools.map(t => t.name).join(", ");

        return `${base}

You have access to the following tools:
${toolDesc}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [${toolNames}]
Action Input: the input to the action (must be valid JSON)
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!`;
    }

    /**
     * Run the agent loop for a user message.
     * @param {string} userMessage - The user's input
     * @param {Array} history - Previous chat history
     * @param {string} overriddenSystemPrompt - (Optional) The specific system prompt to use for this run
     * @param {function} onThought - Callback when agent thinks (returns promise)
     * @param {function} onAction - Callback when agent acts (returns promise)
     */
    async *run(userMessage, history, overriddenSystemPrompt = null, onThought, onAction) {
        let loopCount = 0;
        const messages = [...history, { role: "user", content: userMessage }];

        // Use the overridden prompt if provided, otherwise compile one
        const systemPrompt = overriddenSystemPrompt || Assistant.compileSystemPrompt(this.toolRegistry, this.baseSystemPrompt);

        // Replace the original system prompt or prepend if user history doesn't feature one?
        // In LocalMind, history[0] is usually system. Let's override it for this turn.
        if (messages[0].role === 'system') {
            messages[0].content = systemPrompt;
        } else {
            messages.unshift({ role: "system", content: systemPrompt });
        }

        while (loopCount < this.maxSteps) {

            // 1. Model Inference
            // 1. Model Inference
            console.log("🔥 [Assistant] Request Payload:", messages); // DEBUG LOG
            const response = await this.engine.chat.completions.create({
                messages: messages,
                stream: false, // For now, no streaming intermediate steps to keep parsing simple
                stop: ["Observation:"] // Stop before hallucinating an observation
            });

            const content = response.choices[0].message.content;
            messages.push({ role: "assistant", content: content });

            // 2. Parse Logic
            // Regex to capture multiline action inputs and be more robust
            // Expected: "Action: [Name]" ... "Action Input: [JSON]"
            const actionMatch = content.match(/Action:\s*([^\n]+)/i);
            const inputMatch = content.match(/Action Input:\s*(\{[\s\S]*\}|"[^"]*"|[\s\S]+)/i); // Try to capture JSON block or string

            console.log(`[Assistant] Step ${loopCount + 1} Raw Output:`, content);

            if (content.includes("Final Answer:")) {
                const finalAns = content.split("Final Answer:")[1].trim();
                yield finalAns; // Yield the final result
                return;
            }

            if (actionMatch && inputMatch) {
                const toolName = actionMatch[1].trim();
                const toolInputStr = inputMatch[1].trim();

                // Notify UI of "Thought"
                if (onThought) onThought(content.split("Action:")[0].trim());

                // Notify UI of "Action"
                if (onAction) onAction(toolName, toolInputStr);

                const tool = this.toolRegistry.get(toolName);
                if (tool) {
                    try {
                        let args;
                        try {
                            // Extract JSON if wrapped in markdown code blocks
                            const jsonStr = toolInputStr.replace(/```json/g, "").replace(/```/g, "").trim();
                            args = JSON.parse(jsonStr);
                        } catch (e) {
                            args = toolInputStr; // Fallback to raw string
                        }

                        const result = await tool.execute(args);
                        const observation = `Observation: ${result}`;
                        messages.push({ role: "user", content: observation }); // Inject observation as user message? Or system? user is standard ReAct

                    } catch (err) {
                        const errorMsg = `Observation: Error executing tool: ${err.message}`;
                        messages.push({ role: "user", content: errorMsg });
                    }
                } else {
                    messages.push({ role: "user", content: `Observation: Tool '${toolName}' not found.` });
                }
            } else {
                // If no action found but no final answer, just yield the content as is (maybe just chat)
                yield content;
                return;
            }

            loopCount++;
        }

        yield "Agent Loop limit reached.";
    }
}
