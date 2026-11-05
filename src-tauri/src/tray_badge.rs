//! Update the Tauri tray icon with an unread badge. Only counts/dots, never message content.
use crate::state::AppState;
use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

fn count(value: &Value) -> u32 {
    if value == "dot" { return 1; }
    value.as_u64().unwrap_or(0).min(999_999) as u32
}

fn total_unread(values: &std::collections::HashMap<String, Value>) -> u32 {
    values.values().fold(0u32, |total, value| total.saturating_add(count(value)))
}

/// 3x5 pixel digits: no font file or platform graphics library needed.
const NUMBERS: [[u8; 5]; 10] = [
    [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7],
    [7, 1, 7, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7],
    [7, 4, 7, 5, 7], [7, 1, 1, 1, 1], [7, 5, 7, 5, 7],
    [7, 5, 7, 1, 7],
];

fn render(base: &tauri::image::Image<'_>, total: u32) -> tauri::image::Image<'static> {
    let w = base.width() as usize;
    let h = base.height() as usize;
    let mut pixels = base.rgba().to_vec();
    if total == 0 || w < 20 || h < 20 { return tauri::image::Image::new_owned(pixels, w as u32, h as u32); }
    let radius = ((w.min(h) as f32) * 0.30).round() as i32;
    let cx = w as i32 - radius - 1;
    let cy = radius + 1;
    let scale = if w.min(h) >= 48 { 2 } else { 1 };
    let set = |bytes: &mut Vec<u8>, x: i32, y: i32, color: [u8; 4]| {
        if x >= 0 && y >= 0 && x < w as i32 && y < h as i32 {
            let p = (y as usize * w + x as usize) * 4;
            bytes[p..p + 4].copy_from_slice(&color);
        }
    };
    for y in -radius..=radius {
        for x in -radius..=radius {
            if x*x + y*y <= radius*radius {
                set(&mut pixels, cx+x, cy+y, [224, 46, 56, 255]);
            }
        }
    }
    let label = if total > 9 { "9+".to_owned() } else { total.to_string() };
    let digit_width = 3 * scale;
    let width = label.chars().count() as i32 * (digit_width + scale) - scale;
    let start_x = cx - width / 2;
    let start_y = cy - (5 * scale) / 2;
    for (index, character) in label.chars().enumerate() {
        let glyph: [u8; 5] = if character == '+' { [0, 2, 7, 2, 0] } else {
            NUMBERS[character.to_digit(10).unwrap_or(0) as usize]
        };
        for (row, bits) in glyph.iter().enumerate() {
            for col in 0..3 {
                if (*bits & (1u8 << (2 - col))) != 0 {
                    for dy in 0..scale {
                        for dx in 0..scale {
                            set(&mut pixels, start_x + index as i32 * (digit_width + scale) + col * scale + dx, start_y + row as i32 * scale + dy, [255, 255, 255, 255]);
                        }
                    }
                }
            }
        }
    }
    tauri::image::Image::new_owned(pixels, w as u32, h as u32)
}

pub fn refresh<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id("main") else { return };
    let counts = app.state::<AppState>().lock().unread.clone();
    let total = total_unread(&counts);
    if let Some(icon) = app.default_window_icon() {
        let updated = render(icon, total);
        if let Err(error) = tray.set_icon(Some(updated)) { log::warn!("tray badge: {error}"); }
    }
    let tooltip = if total == 0 {
        "LinguaHub AI Pro · Không có tin chưa đọc".to_owned()
    } else {
        format!("LinguaHub AI Pro · {total} thông báo chưa đọc")
    };
    let _ = tray.set_tooltip(Some(tooltip));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unread_counts_are_bounded() {
        let mut values = std::collections::HashMap::new();
        values.insert("whatsapp".to_owned(), serde_json::json!(2));
        values.insert("teams".to_owned(), serde_json::json!("dot"));
        values.insert("zalo".to_owned(), serde_json::json!(0));
        assert_eq!(total_unread(&values), 3);
    }
}
