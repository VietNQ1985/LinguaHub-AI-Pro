//! Pure, side-effect-free policies migrated from the LinguaHub V2 TypeScript code.
//! No browser access, network calls, token storage, audio capture or message sending.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use unicode_normalization::UnicodeNormalization;

pub const MAX_CONTEXT_MESSAGES: usize = 20;
pub const MAX_CONTEXT_BYTES: usize = 9_000;
pub const MAX_MESSAGE_CHARS: usize = 2_000;
pub const MAX_TRANSLATION_BATCH_MESSAGES: usize = 4;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Left,
    Right,
    Center,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ChatMessage {
    pub side: Side,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ContextMessage {
    pub side: Side,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ReplyTone {
    Professional,
    Friendly,
    Concise,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ComposerRequest {
    pub messages: Vec<ContextMessage>,
    pub draft: String,
    pub tone: ReplyTone,
}

/// Bound context like AiPanel.recentChatContext, but uses UTF-8 bytes rather than
/// JS UTF-16 code units. This is intentionally stricter for non-ASCII content.
pub fn recent_chat_context(messages: &[ChatMessage]) -> Vec<ContextMessage> {
    let mut selected = Vec::new();
    let mut remaining = MAX_CONTEXT_BYTES;
    for message in messages.iter().rev().take(MAX_CONTEXT_MESSAGES) {
        if remaining <= 32 {
            break;
        }
        let text: String = message
            .text
            .trim()
            .chars()
            .take(MAX_MESSAGE_CHARS.min(remaining - 32))
            .collect();
        if text.is_empty() {
            continue;
        }
        let item = ContextMessage {
            side: message.side.clone(),
            text,
        };
        let encoded_len = match serde_json::to_vec(&item) {
            Ok(encoded) => encoded.len() + 1,
            Err(_) => break,
        };
        if encoded_len > remaining {
            break;
        }
        selected.push(item);
        remaining -= encoded_len;
    }
    selected.reverse();
    selected
}

/// Match runLocalAi(replyTranslationFromChat)'s per-field validation.
pub fn validate_composer(request: &ComposerRequest) -> Result<(), &'static str> {
    let draft = request.draft.trim();
    if draft.is_empty() || draft.chars().count() > MAX_MESSAGE_CHARS {
        return Err("invalid draft");
    }
    if request.messages.is_empty() || request.messages.len() > MAX_CONTEXT_MESSAGES {
        return Err("invalid context count");
    }
    for message in &request.messages {
        let text = message.text.trim();
        if text.is_empty() || text.chars().count() > MAX_MESSAGE_CHARS {
            return Err("invalid context text");
        }
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct IdentityMessage {
    pub text: String,
    #[serde(default)]
    pub id: Option<String>,
}

/// Identity applies only inside a visible snapshot, never across different scroll windows.
pub fn message_identity_keys(messages: &[IdentityMessage]) -> Vec<String> {
    let mut occurrences: HashMap<String, usize> = HashMap::new();
    messages
        .iter()
        .map(|message| {
            let normalized = message
                .text
                .nfkc()
                .collect::<String>()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
                .to_lowercase();
            let count = occurrences.entry(normalized.clone()).or_default();
            *count += 1;
            match message.id.as_deref().map(str::trim).filter(|id| !id.is_empty()) {
                Some(id) => serde_json::json!(["id", id, &normalized]).to_string(),
                None => serde_json::json!(["text", &normalized, *count]).to_string(),
            }
        })
        .collect()
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct QueueItem {
    pub key: String,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BatchLane {
    Priority,
    Backlog,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct TranslationBatch {
    pub lane: BatchLane,
    pub messages: Vec<QueueItem>,
}

/// Corresponds to nextTranslationBatch in V2. Never selects more than 4.
pub fn next_translation_batch(
    items: &[QueueItem],
    priority_key: Option<&str>,
    prioritize_newest: bool,
) -> Option<TranslationBatch> {
    let pending: Vec<QueueItem> = items
        .iter()
        .rev()
        .take(MAX_TRANSLATION_BATCH_MESSAGES)
        .cloned()
        .collect();
    if pending.is_empty() {
        return None;
    }
    let priority = priority_key.and_then(|key| pending.iter().find(|item| item.key == key));
    if let Some(first) = priority.or_else(|| prioritize_newest.then(|| &pending[0])) {
        return Some(TranslationBatch {
            lane: BatchLane::Priority,
            messages: vec![first.clone()],
        });
    }
    Some(TranslationBatch {
        lane: BatchLane::Backlog,
        messages: pending,
    })
}

/// Cloud access must be explicitly permitted for the requested task.
pub fn has_cloud_consent_for_task(
    task: &str,
    manual_consent: bool,
    background_consent: bool,
) -> bool {
    match task {
        "extractTasks" => false,
        "translateLatest" | "translateMessages" | "replyFromChat" | "replyTranslationFromChat" => {
            background_consent
        }
        _ => manual_consent,
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewGuard {
    pub english_preview: String,
    pub preview_source: String,
    pub draft: String,
    pub preview_conversation: Option<String>,
    pub bound_conversation: Option<String>,
    pub preview_settings_key: String,
    pub current_settings_key: String,
    pub busy: bool,
}

/// Mirrors the V2 copy guard; a sender/recipient check remains a separate requirement.
pub fn can_copy_preview(guard: &PreviewGuard) -> bool {
    !guard.english_preview.trim().is_empty()
        && guard.preview_source.trim() == guard.draft.trim()
        && guard.preview_settings_key == guard.current_settings_key
        && !guard.busy
        && (guard.preview_conversation.is_none()
            || (guard.bound_conversation.is_some()
                && guard.preview_conversation == guard.bound_conversation))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(side: Side, text: &str) -> ChatMessage {
        ChatMessage {
            side,
            text: text.into(),
            id: None,
        }
    }

    #[test]
    fn context_keeps_recent_messages_in_chat_order() {
        let messages: Vec<_> = (0..25)
            .map(|n| message(Side::Left, &format!("Message {n}")))
            .collect();
        let selected = recent_chat_context(&messages);
        assert_eq!(selected.len(), 20);
        assert_eq!(selected[0].text, "Message 5");
        assert_eq!(selected[19].text, "Message 24");
    }

    #[test]
    fn context_bounds_unicode_and_does_not_split_utf8_characters() {
        let messages = vec![message(Side::Left, &"á".repeat(20_000))];
        let selected = recent_chat_context(&messages);
        assert_eq!(selected.len(), 1);
        assert!(selected[0].text.chars().count() <= 2_000);
        assert!(serde_json::to_vec(&selected[0]).unwrap().len() <= MAX_CONTEXT_BYTES);
    }

    #[test]
    fn composer_rejects_empty_draft_missing_chat_and_oversized_messages() {
        let good = ComposerRequest {
            messages: vec![ContextMessage {
                side: Side::Left,
                text: "Please verify UOM".into(),
            }],
            draft: "Em sẽ kiểm tra.".into(),
            tone: ReplyTone::Professional,
        };
        assert!(validate_composer(&good).is_ok());
        assert!(validate_composer(&ComposerRequest { draft: " ".into(), ..good.clone() }).is_err());
        assert!(validate_composer(&ComposerRequest { messages: vec![], ..good.clone() }).is_err());
        assert!(validate_composer(&ComposerRequest {
            draft: "x".repeat(MAX_MESSAGE_CHARS + 1),
            ..good
        }).is_err());
    }

    #[test]
    fn message_identity_uses_occurrences_and_stable_ids() {
        let messages = vec![
            IdentityMessage { text: " Thank   you ".into(), id: None },
            IdentityMessage { text: "THANK YOU".into(), id: None },
            IdentityMessage { text: "Hello".into(), id: Some("wa-12".into()) },
        ];
        let keys = message_identity_keys(&messages);
        assert_ne!(keys[0], keys[1]);
        assert_eq!(keys[2], "[\"id\",\"wa-12\",\"hello\"]");
        assert_eq!(
            keys[2],
            message_identity_keys(&[IdentityMessage {
                text: "Hello".into(),
                id: Some("wa-12".into()),
            }])[0]
        );
    }

    #[test]
    fn translation_batch_prefers_newest_or_matching_priority() {
        let items: Vec<_> = (0..10)
            .map(|n| QueueItem { key: format!("m{n}"), text: format!("{n}") })
            .collect();
        let backlog = next_translation_batch(&items, None, false).unwrap();
        assert_eq!(backlog.lane, BatchLane::Backlog);
        assert_eq!(backlog.messages.len(), 4);
        assert_eq!(backlog.messages[0].key, "m9");
        let priority = next_translation_batch(&items, Some("m7"), false).unwrap();
        assert_eq!(priority.lane, BatchLane::Priority);
        assert_eq!(priority.messages[0].key, "m7");
        assert_eq!(next_translation_batch(&items, None, true).unwrap().messages[0].key, "m9");
        assert!(next_translation_batch(&[], None, true).is_none());
    }

    #[test]
    fn background_cloud_consent_and_manual_consent_remain_separate() {
        assert!(!has_cloud_consent_for_task("replyTranslationFromChat", true, false));
        assert!(has_cloud_consent_for_task("replyTranslationFromChat", false, true));
        assert!(has_cloud_consent_for_task("coach", true, false));
        assert!(!has_cloud_consent_for_task("extractTasks", true, true));
    }

    #[test]
    fn preview_invalidates_after_draft_context_or_model_changes() {
        let good = PreviewGuard {
            english_preview: "I will check the UOM.".into(),
            preview_source: "Em sẽ kiểm tra UOM.".into(),
            draft: "Em sẽ kiểm tra UOM.".into(),
            preview_conversation: Some("chat-a".into()),
            bound_conversation: Some("chat-a".into()),
            preview_settings_key: "[\"teams\",\"model\",\"professional\"]".into(),
            current_settings_key: "[\"teams\",\"model\",\"professional\"]".into(),
            busy: false,
        };
        assert!(can_copy_preview(&good));
        assert!(!can_copy_preview(&PreviewGuard { draft: "Đã sửa".into(), ..good.clone() }));
        assert!(!can_copy_preview(&PreviewGuard { bound_conversation: Some("chat-b".into()), ..good.clone() }));
        assert!(!can_copy_preview(&PreviewGuard { current_settings_key: "changed".into(), ..good.clone() }));
        assert!(!can_copy_preview(&PreviewGuard { busy: true, ..good }));
    }
}
