# Chrome Extension

This extension adds a popup button that sends the current tab URL to the API. It can also optionally auto-scan newly loaded pages in the background.

## Load it in Chrome

1. Start the API:

```bash
python -m uvicorn app.main:app --reload
```

2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the `chrome_extension/` folder in this repo

The extension now defaults to `https://scanner.seanforeman.org`. If you want to use a different API URL, open the popup, set `API Base URL`, and click `Save`.

## Use it

1. Open any page in Chrome
2. Click the extension icon
3. Leave `Auto-scan new pages in the background` off to keep the current on-demand behavior, or turn it on to scan pages automatically
4. In on-demand mode, click `Scan This Page`
5. Optionally enable `Force rescan` before scanning

In auto-scan mode, the extension scans newly loaded pages in the background, switches the toolbar icon and badge to green, yellow, or red based on the result, and automatically opens the popup when the verdict is `Suspicious` or `Likely Scam`. In on-demand mode, it only scans when you click `Scan This Page`.

## Public Access

To expose the API externally from a Mac Mini, use the Cloudflare Tunnel helper in this repo:

```bash
cd /path/to/scam_detector
bash scripts/setup-cloudflare-tunnel.sh scam-detector scanner.example.com http://127.0.0.1:8000
```

After your public hostname is live, paste that URL into the extension popup as the `API Base URL`, for example:

```text
https://scanner.seanforeman.org
```

You can validate both the public hostname and the local origin with:

```bash
bash scripts/check-public-api.sh scanner.example.com http://127.0.0.1:8000
```
