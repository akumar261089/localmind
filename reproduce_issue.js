const content = `Thought: I need to check the time.
Action: Time
`;

const actionMatch = content.match(/Action:\s*([^\n]+)/i);
const inputMatch = content.match(/Action Input:\s*(\{[\s\S]*\}|"[^"]*"|[\s\S]+)/i);

console.log("Action Match:", actionMatch ? actionMatch[1] : "null");
console.log("Input Match:", inputMatch ? inputMatch[1] : "null");

if (actionMatch && inputMatch) {
    console.log("Tool execution triggered.");
} else {
    console.log("Tool execution SKIPPED (reproducing the bug).");
}

const contentWithInput = `Thought: I need to check the time.
Action: Time
Action Input: {}
`;
const am2 = contentWithInput.match(/Action:\s*([^\n]+)/i);
const im2 = contentWithInput.match(/Action Input:\s*(\{[\s\S]*\}|"[^"]*"|[\s\S]+)/i);

if (am2 && im2) {
    console.log("Tool execution triggered with input.");
} else {
    console.log("Tool execution SKIPPED with input (unexpected).");
}
