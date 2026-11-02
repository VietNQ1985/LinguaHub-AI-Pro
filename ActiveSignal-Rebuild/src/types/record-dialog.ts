export type BotDialogIconKey = "sparkles" | "activity" | "bot";

export interface RecordDialogDraft {
  name: string;
  detail: string;
  extra: string;
  iconKey: BotDialogIconKey;
}
