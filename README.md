# WaveKey

> A fast, cross-platform desktop soundboard built with Tauri 2, Rust, and React.

![WaveKey Screenshot](https://via.placeholder.com/900x500.png?text=WaveKey+Screenshot)

---

## Features

- **Global Hotkeys** — Bind any sound to a keyboard shortcut. Play it instantly from any app, even while minimized.
- **Dual-Output Routing** — Simultaneously routes audio to your headphones *and* a virtual audio device, so Discord/game chat friends hear the sound too.
- **Allow/Prevent Overlapping Sounds** — Choose polyphonic (sounds stack) or monophonic (each new sound stops the previous) mode from Settings.
- **Stop All Hotkey** — Assign a global panic key that silences every playing sound immediately.
- **YouTube Import** — Paste a YouTube URL; WaveKey downloads and extracts the audio into a local file automatically.
- **Local File Import** — Drag-and-drop or browse for `.mp3`, `.wav`, `.ogg`, and `.flac` files.
- **Per-Sound Volume** — Individual volume control on each sound card.
- **System Tray Integration** — Minimizes to tray on close, out of your way when you don't need it.
- **Launch on Login** — Optional autostart so the soundboard is always ready.
- **Virtual Audio Device** — Automatically creates a virtual sink (`wavekey_mic`) on Linux via PulseAudio; on Windows, prompts to install VB-CABLE if not already present.

---

## Download

Get the latest pre-built installer from the [**Releases**](https://github.com/odqin/WaveKey/releases) page.

| Platform | Installer |
|----------|-----------|
| Windows  | `.msi`    |
| Linux    | `.deb` or `.AppImage` |

### Windows — Virtual Audio Device (VB-CABLE)

WaveKey routes audio through a virtual cable so other applications (Discord, OBS, etc.) can pick up your soundboard. On Windows this requires **VB-CABLE**. If it isn't installed, WaveKey will prompt you to install it automatically. This step needs **Administrator privileges** and a **system reboot** to take effect.

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Shell    | [Tauri 2](https://tauri.app) (Rust backend + WebView frontend) |
| Backend  | Rust — `rodio` (audio), `cpal` (device enumeration), `global-hotkey`, `reqwest` |
| Frontend | React 18 + TypeScript, Vite |
| Packaging | MSI (Windows), `.deb` + AppImage (Linux) via Tauri bundler |

---

<details>
<summary><strong>Building from source</strong></summary>

### Prerequisites

**All platforms:**
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

**Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
                 librsvg2-dev libasound2-dev
```

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/odqin/WaveKey.git
cd WaveKey

# 2. Install frontend dependencies
npm install

# 3. Run in development mode (hot-reload)
npm run tauri dev

# 4. Build a production installer
npm run tauri build
```

Built installers are placed in `src-tauri/target/release/bundle/`.

</details>

---

## License

[MIT](LICENSE)
