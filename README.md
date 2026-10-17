# StemDeck — Pinokio launcher (unofficial)

Unofficial Pinokio installer for [StemDeck](https://github.com/stemdeckapp/stemdeck), supporting **Windows x64 / NVIDIA** and **Linux x64 / NVIDIA** (including Ubuntu).

## Install

In Pinokio use **Download from URL** and enter `https://github.com/ChrisTorng/stemdeck.pinokio`. Select **Install**, then **Start**. This launcher retrieves the latest upstream GitHub Release NVIDIA portable archive, verifies its published SHA-256 checksum, and extracts it under `app/`. StemDeck itself downloads FFmpeg, the Demucs model, and necessary runtime files on first launch. You need a writable Pinokio directory.

**Update** pulls the launcher repository and overlays the latest upstream application. **Reset app** removes `app/` so you can install again. Back up any files you placed there first. Neither action deletes user libraries outside `app/`.

On Linux, settings, logs, and models live under `$XDG_DATA_HOME/stemdeck` (or `~/.local/share/stemdeck`); the default stem library is `~/Documents/StemDeck/`. Pinokio sets its own `XDG_DATA_HOME`, so inspect `logs/api/start.js/latest` and the `stemdeck/logs/setup.log` inside that data directory when troubleshooting.

Requires Node.js 20+ in the Pinokio shell and an NVIDIA driver. This launches the native desktop GUI (not an embedded web page). On Linux you also need a running graphical desktop session. No macOS support is claimed; its upstream DMG is available independently.

Linux requires GTK3 and WebKitGTK 4.1 system libraries (on Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0`). The NVIDIA build downloads CUDA PyTorch on first launch; allow time and disk space for this download and the model downloads.

If an older installation reports “Python runtime not found”, Start automatically repairs broken links left by the old installer. New installations preserve the archive's relative links. The launcher also lets StemDeck's bundled Python install its CUDA wheels despite Pinokio's default pip virtual-environment restriction.

Linux defaults to WebKit software compositing so the interface continues repainting on remote X11 desktops. CUDA audio processing is unaffected. Set `WEBKIT_DISABLE_COMPOSITING_MODE=0` explicitly to use accelerated UI compositing instead.

## Local API

After the desktop completes setup, its backend exposes a local HTTP API. Read the actual port from `stemdeck/logs/backend.log`; the desktop can select a free port automatically. Replace the example port below or set `STEMDECK_URL` for JavaScript/Python. These examples check readiness; `/docs` documents the available audio-processing endpoints.

JavaScript (Node.js 20+):

```javascript
const base = process.env.STEMDECK_URL || 'http://127.0.0.1:8000';
const response = await fetch(`${base}/api/health`);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
console.log(await response.json());
```

Python:

```python
import json, os, urllib.request
base = os.environ.get('STEMDECK_URL', 'http://127.0.0.1:8000')
with urllib.request.urlopen(base + '/api/health') as response:
    print(json.load(response))
```

Curl:

```sh
curl --fail http://127.0.0.1:8000/api/health
```

## Source and license

- Upstream project: https://github.com/stemdeckapp/stemdeck
- Upstream releases: https://github.com/stemdeckapp/stemdeck/releases
- Community launcher code: MIT; upstream models/binaries have their own licenses.
- Regression checks: `node tests/smoke.test.cjs` covers launcher parsing, menus, portable runtime links after staging cleanup and reinstall, legacy link repair, and the child process pip environment. Windows execution requires separate validation.
- Verified on 2026-10-17: StemDeck v0.20.0 launched through Pinokio on Ubuntu with an RTX 4090, completed CUDA setup, displayed the main desktop UI after a restart, and returned `status: ok` / `demucs_device: cuda` from `/api/health`.

This project is not affiliated with the upstream developers.
