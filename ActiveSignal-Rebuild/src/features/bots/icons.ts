import { Activity, Bot, Sparkles, type LucideIcon } from "lucide-react";
import type { BotIconKey } from "../../types/models";

export const botIconRegistry: Record<BotIconKey, LucideIcon> = {
  sparkles: Sparkles,
  activity: Activity,
  bot: Bot,
};
