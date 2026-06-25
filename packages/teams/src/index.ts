export const name = "teams";

export { isTeamsEnabled } from "./config";
export { processBotRequest } from "./bot";
export type { TeamsConnectInfo, OnConnect } from "./bot";
export { sendProactiveCard } from "./proactive";
export { buildNotificationCard } from "./card";
export type { NotificationCardInput } from "./card";
