//! Service tabs (WhatsApp, Teams, Zalo Web, Zoom, Meet) as child webviews of the main window, laid
//! out left of the LinguaHub panel. Also: unread badges, chat-change signals and generic notifications.

use crate::dialog::{self, Ask};
use crate::state::{view_label, AppState};
use crate::urls;
use crate::wv;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tauri::webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, Webview, WebviewUrl};

pub const HEADER: f64 = 64.0;
/// Shared by every webview (they must match to share one WebView2 environment). Fewer renderer
/// processes: one per site instead of one per tab/frame where possible. The first three are wry's defaults.
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --renderer-process-limit=4 --process-per-site";
const AGENT: &str = include_str!("../page-scripts/agent.js");

pub fn read_script(service: &str) -> &'static str {
    match service {
        "outlook" => include_str!("../page-scripts/read-outlook.js"),
        "whatsapp" => include_str!("../page-scripts/read-whatsapp.js"),
        "teams" => include_str!("../page-scripts/read-teams.js"),
        "zoom" => include_str!("../page-scripts/read-zoom.js"),
        "meet" => include_str!("../page-scripts/read-meet.js"),
        "telegram" => include_str!("../page-scripts/read-telegram.js"),
        _ => include_str!("../page-scripts/read-zalo.js"),
    }
}

pub fn composer_script(service: &str, focus: bool) -> &'static str {
    match (service, focus) {
        ("whatsapp", false) => include_str!("../page-scripts/composer-whatsapp.js"),
        ("whatsapp", true) => include_str!("../page-scripts/composer-whatsapp-focus.js"),
        ("teams", false) => include_str!("../page-scripts/composer-teams.js"),
        ("teams", true) => include_str!("../page-scripts/composer-teams-focus.js"),
        ("zoom", false) => include_str!("../page-scripts/composer-zoom.js"),
        ("zoom", true) => include_str!("../page-scripts/composer-zoom-focus.js"),
        ("meet", false) => include_str!("../page-scripts/composer-meet.js"),
        ("meet", true) => include_str!("../page-scripts/composer-meet-focus.js"),
        ("telegram", false) => include_str!("../page-scripts/composer-telegram.js"),
        ("telegram", true) => include_str!("../page-scripts/composer-telegram-focus.js"),
        (_, false) => include_str!("../page-scripts/composer-zalo.js"),
        (_, true) => include_str!("../page-scripts/composer-zalo-focus.js"),
    }
}

pub fn captions_script(service: &str) -> &'static str {
    match service {
        "zoom" => include_str!("../page-scripts/captions-zoom.js"),
        "meet" => include_str!("../page-scripts/captions-meet.js"),
        _ => include_str!("../page-scripts/captions-teams.js"),
    }
}

pub const ZALO_WEB_TITLE: &str = include_str!("../page-scripts/zalo-web-title.js");

pub fn view<R: Runtime>(app: &AppHandle<R>, service: &str) -> Option<Webview<R>> {
    app.get_webview(&view_label(service))
}

/// The visible service webview, if a service tab (not the dashboard or Zalo PC) is active.
pub fn current_view<R: Runtime>(app: &AppHandle<R>) -> Option<(String, Webview<R>)> {
    let current = app.state::<AppState>().lock().current.clone();
    view(app, &current).map(|webview| (current, webview))
}

pub fn window_visible<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_window("main").map(|window| window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(true)).unwrap_or(false)
}

/// Positions every service webview; only the active one is shown (and none while a dialog is open).
pub fn layout<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_window("main") else { return };
    let scale = window.scale_factor().unwrap_or(1.0);
    let Ok(size) = window.inner_size() else { return };
    let (width, height) = (size.width as f64 / scale, size.height as f64 / scale);
    let state = app.state::<AppState>();
    let (current, panel, divider, dialog_open, labels) = {
        let inner = state.lock();
        let panel = if inner.panel_collapsed { 56.0 } else { inner.panel_width };
        let divider = if inner.panel_collapsed { 0.0 } else { 6.0 };
        (inner.current.clone(), panel, divider, inner.dialog_open > 0, inner.views.clone())
    };
    for label in labels {
        let Some(webview) = app.get_webview(&label) else { continue };
        let _ = webview.set_position(LogicalPosition::new(0.0, HEADER));
        let _ = webview.set_size(LogicalSize::new((width - panel - divider).max(300.0), (height - HEADER).max(100.0)));
        let visible = label == view_label(&current) && !state.lock().tasks_open;
        if visible && !dialog_open {
            let _ = webview.show();
        } else {
            let _ = webview.hide();
        }
        // Only flip the memory level when the tab changes (not while a dialog briefly hides the page).
        let changed = {
            let mut inner = state.lock();
            if visible { inner.low_memory.remove(&label) } else { inner.low_memory.insert(label.clone()) }
        };
        if changed {
            wv::set_memory_low(&webview, !visible);
        }
    }
}

fn conversation_hash(service: &str, url: &str, hint: &str) -> String {
    let hint: String = hint.chars().take(200).collect();
    hex::encode(Sha256::digest(format!("{service}:{url}:{hint}").as_bytes()))[..16].to_owned()
}

/// Cleans a reader snapshot: last 60 messages with text, sides limited to left/right/center.
pub fn clean_snapshot(snapshot: &Value) -> Vec<Value> {
    let items = snapshot["messages"].as_array().cloned().unwrap_or_default();
    let filtered: Vec<Value> = items
        .into_iter()
        .filter(|item| item["text"].as_str().map(|text| text.trim().chars().count() >= 2).unwrap_or(false))
        .collect();
    let start = filtered.len().saturating_sub(60);
    filtered[start..]
        .iter()
        .map(|item| {
            let text: String = item["text"].as_str().unwrap_or_default().trim().chars().take(12000).collect();
            let side = match item["side"].as_str() {
                Some("left") => "left",
                Some("right") => "right",
                _ => "center",
            };
            let mut out = json!({ "text": text, "side": side });
            if let Some(id) = item["id"].as_str().filter(|id| (1..=200).contains(&id.chars().count())) {
                out["id"] = json!(id);
            }
            out
        })
        .collect()
}

pub fn conversation_id(service: &str, url: &str, snapshot: &Value) -> String {
    conversation_hash(service, url, snapshot["conversationHint"].as_str().unwrap_or_default())
}

/// Reads the visible chat of the active service tab.
pub async fn read_visible<R: Runtime>(app: &AppHandle<R>) -> anyhow::Result<Value> {
    let Some((service, webview)) = current_view(app) else { return Ok(Value::Null) };
    // Read only the visible, authorized workspace.
    if !window_visible(app) || app.state::<AppState>().lock().tasks_open {
        return Ok(Value::Null);
    }
    let url = webview.url()?.to_string();
    if !urls::is_workspace_url(&service, &url) {
        return Ok(Value::Null);
    }
    let snapshot = wv::eval_json(&webview, read_script(&service)).await?;
    let messages = clean_snapshot(&snapshot);
    let text = messages.iter().filter_map(|item| item["text"].as_str()).collect::<Vec<_>>().join("\n");
    Ok(json!({ "conversationId": conversation_id(&service, &url, &snapshot), "messages": messages, "text": text }))
}

fn emit_unread<R: Runtime>(app: &AppHandle<R>) {
    let counts = app.state::<AppState>().lock().unread.clone();
    crate::tray_badge::update(app, &counts);
    let _ = app.emit_to("ui", "workspace-unread", counts);
}

fn has_unread(value: &Value) -> bool {
    value == "dot" || value.as_i64().unwrap_or(0) > 0
}

/// Generic "new message" notification: never sender names or message text.
fn update_unread<R: Runtime>(app: &AppHandle<R>, service: &str, next: Value) {
    let state = app.state::<AppState>();
    let (previous, armed) = {
        let mut inner = state.lock();
        let previous = inner.unread.get(service).cloned().unwrap_or(json!(0));
        if previous == next {
            return;
        }
        inner.unread.insert(service.to_owned(), next.clone());
        (previous, inner.notification_armed.contains(service))
    };
    emit_unread(app);
    if !armed {
        return;
    }
    let increased = !has_unread(&previous) || matches!((previous.as_i64(), next.as_i64()), (Some(before), Some(after)) if after > before);
    if has_unread(&next) && increased && state.store.notification_enabled(service) {
        let _ = crate::notify::show(app, service);
    }
}

fn reset_unread<R: Runtime>(app: &AppHandle<R>, service: &str) {
    let state = app.state::<AppState>();
    {
        let mut inner = state.lock();
        inner.notification_armed.remove(service);
        inner.dom_unread.remove(service);
        inner.unread.insert(service.to_owned(), json!(0));
    }
    emit_unread(app);
    // Treat the first counts after a page load as the baseline, not as new messages.
    let app = app.clone();
    let service = service.to_owned();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(2)).await;
        app.state::<AppState>().lock().notification_armed.insert(service);
    });
}

fn is_unread_service(service: &str) -> bool {
    matches!(service, "whatsapp" | "teams" | "zalo")
}

/// Decides device permissions for a service page: meetings and Zalo may use mic/camera after the
/// user agreed (remembered per app); notifications are never granted (LinguaHub shows its own).
fn service_permissions<R: Runtime>(app: &AppHandle<R>, service: String) -> wv::PermissionDecider {
    let app = app.clone();
    std::sync::Arc::new(move |permission, url| {
        let app = app.clone();
        let service = service.clone();
        Box::pin(async move {
            let kind = match permission {
                wv::Permission::Microphone => "audio",
                wv::Permission::Camera => "video",
                _ => return false,
            };
            let trusted = if service == "zalo" { urls::is_workspace_url("zalo", &url) } else { urls::trusted_meeting_origin(&service, &url) };
            if !trusted || !(urls::is_meeting_service(&service) || service == "zalo") {
                return false;
            }
            let state = app.state::<AppState>();
            {
                let inner = state.lock();
                if inner.meeting_grants.get(&service).map(|kinds| kinds.contains(kind)).unwrap_or(false) || (service == "zalo" && inner.zalo_media_granted) {
                    return true;
                }
            }
            let remembered = state.store.remember(&service);
            let label = if service == "zalo" { "Zalo" } else { urls::app_name(&service) };
            let allowed = if remembered {
                true
            } else {
                let device = if kind == "audio" { "microphone" } else { "camera" };
                let (response, checked) = dialog::ask(
                    &app,
                    Ask::question(format!("Quyền thiết bị {label}"), format!("Cho phép {label} dùng {device}?"), format!("Chỉ dành cho trang {label} đã xác minh. Windows vẫn có thể chặn thiết bị trong Cài đặt quyền riêng tư."), ["Hủy", "Cho phép"])
                        .checkbox("Ghi nhớ cho ứng dụng này (không hỏi lại)", service == "zalo"),
                )
                .await;
                if response == 1 && checked {
                    let _ = state.store.set_remember(&service, true);
                }
                response == 1
            };
            if allowed {
                let mut inner = state.lock();
                inner.meeting_grants.entry(service.clone()).or_default().insert(kind);
                if service == "zalo" {
                    inner.zalo_media_granted = true;
                }
            }
            allowed
        })
    })
}

/// Opens (or shows) a service tab and returns its page title.
pub async fn open<R: Runtime>(app: &AppHandle<R>, service: &str) -> anyhow::Result<Value> {
    if !urls::SERVICES.contains(&service) {
        anyhow::bail!("Invalid service");
    }
    let state = app.state::<AppState>();
    state.stop_meeting();
    let label = view_label(service);
    {
        let mut inner = state.lock();
        inner.workspace_request += 1;
        inner.current = service.to_owned();
        inner.tasks_open = false;
    }
    if let Some(existing) = view(app, service) {
        layout(app);
        let _ = existing.set_focus();
        return Ok(json!({ "title": "" }));
    }
    let window = app.get_window("main").ok_or_else(|| anyhow::anyhow!("Chưa có cửa sổ chính."))?;
    let service_owned = service.to_owned();
    let navigation_service = service_owned.clone();
    let popup_service = service_owned.clone();
    let title_service = service_owned.clone();
    let load_service = service_owned.clone();
    let popup_app = app.clone();
    let title_app = app.clone();
    let load_app = app.clone();
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(urls::start_url(service).parse()?))
        .additional_browser_args(BROWSER_ARGS)
        .initialization_script(AGENT)
        .on_navigation(move |url| {
            let allowed = url.as_str() == "about:blank" || urls::is_workspace_url(&navigation_service, url.as_str());
            if !allowed {
                // Host only: never log paths or query strings (they can carry tokens).
                log::warn!("[{navigation_service}] navigation blocked: {}", url.host_str().unwrap_or("?"));
                eprintln!("[{navigation_service}] navigation blocked: {}", url.host_str().unwrap_or("?"));
            }
            allowed
        })
        .on_new_window(move |url, _features| {
            let target = url.to_string();
            // Sign-in popups stay in the app: Zalo, and Zoom/Meet hosts plus Google sign-in for them.
            let popup = if popup_service == "zalo" { urls::is_workspace_url("zalo", &target) } else { (popup_service == "zoom" || popup_service == "meet") && (urls::is_workspace_url(&popup_service, &target) || urls::is_workspace_url("meet", &target)) };
            if popup {
                return NewWindowResponse::Allow;
            }
            if urls::is_safe_external_web_url(&target) {
                let app = popup_app.clone();
                tauri::async_runtime::spawn(async move {
                    let host = url::Url::parse(&target).ok().and_then(|parsed| parsed.host_str().map(str::to_owned)).unwrap_or_default();
                    let (response, _) = dialog::ask(&app, Ask::question("Mở liên kết ngoài LinguaHub?", format!("Mở {host} trong trình duyệt mặc định?"), "Kiểm tra tên miền trước khi mở liên kết từ cuộc trò chuyện.", ["Hủy", "Mở liên kết"])).await;
                    if response == 1 {
                        let _ = tauri_plugin_opener::open_url(&target, None::<&str>);
                    }
                });
            }
            NewWindowResponse::Deny
        })
        .on_document_title_changed(move |webview, title| {
            if !is_unread_service(&title_service) {
                return;
            }
            let url = webview.url().map(|url| url.to_string()).unwrap_or_default();
            if !urls::is_workspace_url(&title_service, &url) {
                return;
            }
            let dom = title_app.state::<AppState>().lock().dom_unread.get(&title_service).cloned();
            update_unread(&title_app, &title_service, dom.unwrap_or_else(|| json!(urls::unread_from_title(&title))));
        })
        .on_page_load(move |_webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                let state = load_app.state::<AppState>();
                let stop = state.lock().meeting.as_ref().map(|meeting| meeting.service == load_service).unwrap_or(false);
                if stop {
                    state.stop_meeting();
                }
                if is_unread_service(&load_service) {
                    reset_unread(&load_app, &load_service);
                }
            }
        });
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = window.inner_size()?;
    let webview = window.add_child(builder, LogicalPosition::new(0.0, HEADER), LogicalSize::new((size.width as f64 / scale - 400.0).max(300.0), (size.height as f64 / scale - HEADER).max(100.0)))?;
    let _ = wv::install_permissions(&webview, service_permissions(app, service_owned.clone()));
    state.lock().views.insert(label);
    layout(app);
    Ok(json!({ "title": "" }))
}

pub fn dashboard<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    state.stop_meeting();
    {
        let mut inner = state.lock();
        inner.workspace_request += 1;
        inner.current = "dashboard".into();
        inner.chat_read_authorized = false;
        inner.background_cloud_consent = false;
    }
    layout(app);
}

/// Brings a service tab to the front (tray menu, shortcuts).
pub fn activate<R: Runtime>(app: &AppHandle<R>, service: &str) {
    if let Some(window) = app.get_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit_to("ui", "app-shortcut", service);
}

const POLL: &str = "(()=>{const a=window.__lhAgent;if(!a)return null;a.observe(__OBSERVE__);return a.poll()})()";

/// Polls the page agents: the active tab often (chat changes, shortcuts), the others for unread badges.
pub fn start_polling<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut tick: u64 = 0;
        loop {
            tokio::time::sleep(Duration::from_millis(400)).await;
            tick += 1;
            let state = app.state::<AppState>();
            let (current, labels, observe) = {
                let inner = state.lock();
                (inner.current.clone(), inner.views.clone(), inner.chat_read_authorized && !inner.chat_read_paused)
            };
            for label in labels {
                let service = label.trim_start_matches("svc-").to_owned();
                let active = service == current;
                if !active && tick % 5 != 0 {
                    continue;
                }
                let Some(webview) = app.get_webview(&label) else { continue };
                let script = POLL.replace("__OBSERVE__", if active && observe && window_visible(&app) { "true" } else { "false" });
                let Ok(result) = wv::eval_json(&webview, &script).await else { continue };
                if result.is_null() {
                    continue;
                }
                if let Some(shortcut) = result["shortcut"].as_str() {
                    let _ = app.emit_to("ui", "app-shortcut", shortcut);
                }
                if is_unread_service(&service) {
                    let url = webview.url().map(|url| url.to_string()).unwrap_or_default();
                    if urls::is_workspace_url(&service, &url) {
                        match &result["unread"] {
                            Value::String(value) if value == "none" => {}
                            Value::Null => {
                                state.lock().dom_unread.remove(&service);
                            }
                            value @ (Value::Number(_) | Value::String(_)) => {
                                let valid = value == "dot" || value.as_i64().map(|count| (0..=999_999).contains(&count)).unwrap_or(false);
                                if valid {
                                    state.lock().dom_unread.insert(service.clone(), value.clone());
                                    update_unread(&app, &service, value.clone());
                                }
                            }
                            _ => {}
                        }
                    }
                }
                if active && observe {
                    let changed_at = result["changedAt"].as_f64().unwrap_or(0.0);
                    let previous = state.lock().last_change.insert(service.clone(), changed_at).unwrap_or(0.0);
                    if changed_at > previous && previous > 0.0 || (previous == 0.0 && changed_at > 0.0) {
                        let _ = app.emit_to("ui", "chat-visible-changed", json!({ "service": service, "observedAt": crate::db::now_ms() }));
                    }
                }
            }
        }
    });
}
