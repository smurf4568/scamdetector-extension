# Chrome Extension Release Notes

## v0.1.0

- defaults the API base URL to `https://scanner.seanforeman.org`
- allows the API base URL to be changed from the popup
- supports public HTTPS API endpoints for full-machine testing

## Packaging

For manual test distribution, package the unpacked extension directory so the zip root contains:

- `manifest.json`
- `background.js`
- `popup.html`
- `popup.js`
- `popup.css`

Recommended archive name:

- `scamdetector-chrome-extension-v0.1.0.zip`

Recommended install flow on a test machine:

1. Unzip the archive.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the unzipped folder.
