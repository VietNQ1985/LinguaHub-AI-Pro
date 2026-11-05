//! JSON Lines protocol, designed for a future Tauri command/sidecar adapter.
//! Writes only structured results to stdout; message text must not be logged.
use linguahub_core::{
    can_copy_preview, has_cloud_consent_for_task, message_identity_keys, next_translation_batch,
    recent_chat_context, validate_composer, ChatMessage, ComposerRequest, IdentityMessage,
    PreviewGuard, QueueItem,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Command {
    RecentContext {
        messages: Vec<ChatMessage>,
    },
    ValidateComposer {
        request: ComposerRequest,
    },
    MessageIdentity {
        messages: Vec<IdentityMessage>,
    },
    TranslationBatch {
        items: Vec<QueueItem>,
        #[serde(default)]
        priority_key: Option<String>,
        #[serde(default)]
        prioritize_newest: bool,
    },
    CloudConsent {
        task: String,
        manual_consent: bool,
        background_consent: bool,
    },
    CopyGuard {
        guard: PreviewGuard,
    },
}

fn handle(line: &str) -> Result<Value, String> {
    let cmd: Command = serde_json::from_str(line).map_err(|_| "invalid request".to_owned())?;
    let result = match cmd {
        Command::RecentContext { messages } => json!(recent_chat_context(&messages)),
        Command::ValidateComposer { request } => {
            validate_composer(&request).map_err(str::to_owned)?;
            json!({"valid": true})
        }
        Command::MessageIdentity { messages } => json!(message_identity_keys(&messages)),
        Command::TranslationBatch {
            items,
            priority_key,
            prioritize_newest,
        } => json!(next_translation_batch(
            &items,
            priority_key.as_deref(),
            prioritize_newest
        )),
        Command::CloudConsent {
            task,
            manual_consent,
            background_consent,
        } => json!(has_cloud_consent_for_task(
            &task,
            manual_consent,
            background_consent
        )),
        Command::CopyGuard { guard } => json!(can_copy_preview(&guard)),
    };
    Ok(json!({"ok": true, "result": result}))
}

fn main() -> io::Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut output = stdout.lock();
    for line in stdin.lock().lines() {
        let line = line?;
        // Cap input size before parsing; no raw payloads in errors or logs.
        let response = if line.len() > 256 * 1024 {
            json!({"ok": false, "error": "request too large"})
        } else {
            match handle(&line) {
                Ok(value) => value,
                Err(error) => json!({"ok": false, "error": error}),
            }
        };
        writeln!(output, "{response}")?;
        output.flush()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::handle;

    #[test]
    fn json_protocol_hides_bad_payload_details() {
        let error = handle(r#"{"op":"recent_context","messages":"PRIVATE MESSAGE"}"#).unwrap_err();
        assert_eq!(error, "invalid request");
    }

    #[test]
    fn json_protocol_prepares_context() {
        let result =
            handle(r#"{"op":"recent_context","messages":[{"side":"left","text":"Hello"}]}"#)
                .unwrap();
        assert_eq!(result["ok"], true);
        assert_eq!(result["result"][0]["text"], "Hello");
    }
}
