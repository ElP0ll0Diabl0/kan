export const name = "teams";

export { isTeamsEnabled, getBotConfig } from "./config";
export type { BotConfig } from "./config";
export { processBotRequest } from "./bot";
export type { TeamsConnectInfo, OnConnect } from "./bot";
export { sendProactiveCard } from "./proactive";
export { buildNotificationCard } from "./card";
export type { NotificationCardInput } from "./card";
