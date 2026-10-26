# StemDeck — Pinokio launcher (unofficial)

Unofficial Pinokio installer for [StemDeck](https://github.com/stemdeckapp/stemdeck), supporting **Windows x64 / NVIDIA** and **Linux x64 / NVIDIA** (including Ubuntu).

## Install

In Pinokio use **Download from URL** and enter `https://github.com/ChrisTorng/stemdeck.pinokio`. Select **Install**, then **Start**. This launcher retrieves the latest upstream GitHub Release NVIDIA portable archive, verifies its published SHA-256 checksum, and extracts it under `app/`. StemDeck itself downloads FFmpeg, the Demucs model, and necessary runtime files on first launch. You need a writable Pinokio directory.

**Update** pulls the launcher repository and checks the latest upstream application. If that version is already installed, it skips the download and leaves the runtime untouched. For a new version, it preserves the installed Python/CUDA runtime when the upstream `runtimeId` is unchanged; a changed dependency set requires the bundled runtime and may trigger CUDA setup again. **Reset app** removes `app/` so you can install again. Back up any files you placed there first. Neither action deletes user libraries outside `app/`.

On Linux, settings, logs, and models live under `$XDG_DATA_HOME/stemdeck` (or `~/.local/share/stemdeck`); the default stem library is `~/Documents/StemDeck/`. Pinokio sets its own `XDG_DATA_HOME`, so inspect `logs/api/start.js/latest` and the `stemdeck/logs/setup.log` inside that data directory when troubleshooting.

Requires Node.js 20+ in the Pinokio shell and an NVIDIA driver. **Start** launches StemDeck's native setup and backend, waits for a healthy backend, then prints the service URL and displays **Open Web UI** in Pinokio's sidebar. Select it to use StemDeck inside Pinokio, including from a remote Pinokio browser. **Terminal** shows launch output. On Linux you still need a running graphical desktop session for the native setup process. No macOS support is claimed; its upstream DMG is available independently.

The launcher provides a loopback HTTP bridge on a free Pinokio port. It streams the existing backend's web UI, uploads, audio and event streams, removing its iframe prohibition so Pinokio can embed the page. Stop in Pinokio shuts down both the bridge and the native application. First-run CUDA/model setup must finish before Open Web UI appears.

Linux requires GTK3 and WebKitGTK 4.1 system libraries (on Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0`). The NVIDIA build downloads CUDA PyTorch on first launch; allow time and disk space for this download and the model downloads.

If an older installation reports “Python runtime not found”, Start automatically repairs broken links left by the old installer. New installations preserve the archive's relative links. The launcher also lets StemDeck's bundled Python install its CUDA wheels despite Pinokio's default pip virtual-environment restriction.

Older launcher updates overwrote CUDA PyTorch with the archive's CPU PyTorch, even for the same app version. If that happened, Start lets StemDeck restore CUDA once (using its pip cache where available). Subsequent updates with unchanged dependencies keep that runtime. The Linux X11 `libEGL / DRI3` warning concerns desktop rendering; inspect `setup.log` and `/api/health` to establish whether CUDA setup actually failed.

Linux defaults to WebKit software compositing so the interface continues repainting on remote X11 desktops. CUDA audio processing is unaffected. Set `WEBKIT_DISABLE_COMPOSITING_MODE=0` explicitly to use accelerated UI compositing instead.

## Local API

Use the service URL printed in Terminal or linked by **Open Web UI** as the API base URL. Its port is assigned on each launch. Replace the example port below or set `STEMDECK_URL` for JavaScript/Python. These examples check readiness; `/docs` documents the available audio-processing endpoints.

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
- Regression checks: `node tests/smoke.test.cjs` covers launcher parsing, URL capture and menus, embedded web/API/upload/event streaming, runtime preservation during updates, portable runtime links, legacy link repair, and the child process pip environment. Windows execution requires separate validation.
- Verified on 2026-10-26: StemDeck v0.20.0 launched through Pinokio on Ubuntu with an RTX 4090. The embedded web UI and health endpoint returned HTTP 200 with `status: ok` / `demucs_device: cuda`; the installed Python runtime reported CUDA available. All 17 smoke tests passed.

This project is not affiliated with the upstream developers.
