export class Tool {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }

    /**
     * @returns {object} JSON Schema for tool parameters
     */
    getParameters() {
        return {};
    }

    /**
     * @param {object} args 
     * @returns {Promise<string>} Tool output
     */
    async execute(args) {
        throw new Error("Tool.execute() must be implemented");
    }
}
