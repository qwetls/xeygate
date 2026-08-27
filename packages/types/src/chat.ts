export type JSONValue =
    string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[];

export type JSONObject = Record<string, JSONValue>;

export type ChatRole = "system" | "user" | "assistant" | "tool" | "function" | "developer";
export type ChatMessageRole = ChatRole;

export type AnthropicRole = Extract<ChatRole, "user" | "assistant">;
export type AssistantOrUserRole = Extract<ChatRole, "user" | "assistant">;
export type CommandCodeRole = Extract<ChatRole, "user" | "assistant" | "tool">;
