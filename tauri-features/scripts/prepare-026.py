from pathlib import Path
for name in ['package.json','package-lock.json','src-tauri/Cargo.toml','src-tauri/tauri.conf.json']:
 p=Path(name);p.write_text(p.read_text(encoding='utf-8').replace('"0.2.5"','"0.2.6"'),encoding='utf-8')
p=Path('src-tauri/Cargo.lock');p.write_text(p.read_text(encoding='utf-8').replace('name = "linguahub"\nversion = "0.2.5"','name = "linguahub"\nversion = "0.2.6"'),encoding='utf-8')
p=Path('scripts/build-025.ps1');Path('scripts/build-026.ps1').write_text(p.read_text(encoding='utf-8-sig').replace('0.2.5','0.2.6'),encoding='utf-8-sig')
