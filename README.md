# AI Quota Monitor

A lightweight Electron tray dashboard that monitors AI service quotas, balances, and daily usage in real time. Floats as a transparent glass-morphism panel in the top-right corner of your screen.

## Features

- **Codex Quota Monitoring** — remaining percentage, 5-hour/7-day quota cards, subscription plan type, with animated liquid meter and cylinder gauges
- **DeepSeek Balance** — real-time balance display with daily spend tracking
- **Region Toggle** — show or hide individual service regions; panel automatically resizes to fit only visible content
- **Custom HTML Tray Menu** — right-click the tray icon for quick actions (refresh, toggle regions, pin, settings)
- **Smart Traffic Light** — green/yellow/red LED indicator reflecting quota health across all visible services
- **Always-on-Top** — pin/unpin the floating panel
- **Settings Panel** — configure DeepSeek API key
- **i18n** — Chinese / English language toggle
- **Zero Chrome** — frameless, transparent, skip-taskbar window

## Architecture

```
src/
├── main/
│   ├── main.js              # Electron main process (BrowserWindow, Tray, IPC)
│   ├── preload.js           # Context bridge (IPC surface)
│   ├── quota-service.js     # Codex CLI quota parser
│   └── deepseek-service.js  # DeepSeek API balance fetcher
└── renderer/
    ├── index.html           # Main panel UI
    ├── renderer.js          # Panel logic (visibility, height, i18n)
    ├── styles.css           # Glass-morphism styles
    ├── settings.html        # Settings window
    ├── settings.js          # Settings logic
    ├── traymenu.html        # Custom tray menu UI
    └── traymenu.js          # Tray menu logic (dynamic region checkboxes)
```

## Extending with New Providers

Service regions use a generic container pattern:

```html
<div class="region" data-region="servicename" data-visible="true">
  <hr class="divider" />
  <!-- service content here -->
</div>
```

Visibility is toggled via inline `style.display` and the panel height auto-adjusts. To add a third provider:

1. **`main.js`** — add `"newservice": true` to `DEFAULT_REGIONS`
2. **`index.html`** — add a `<div class="region" data-region="newservice">` block
3. **`traymenu.js`** — add label to `REGION_LABELS`
4. **`renderer.js`** — add fetch logic

No CSS changes needed.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build portable Windows executable
npm run build
```

## Build Output

Portable `.exe` in `dist/`: `AIQuotaMonitor-V3.1.exe` — no installation required.

## Tech Stack

- **Electron 31** — desktop shell
- **Vanilla JS / CSS** — no framework overhead
- **Glass-morphism UI** — `backdrop-filter: blur()` with translucent backgrounds

## Version History

| Version | Changes |
|---------|---------|
| V3.1 | Generic region visibility system, dynamic tray menu, panel auto-resize fix (`resizable: true` + atomic `setBounds`) |
| V3.0 | Region visibility toggle, custom HTML tray menu, smart traffic light |
| V2.2 | Settings panel for DeepSeek API key |
| V2.1 | Parallel independent refresh for Codex & DeepSeek |
| V2.0 | Initial release with color thresholds |

## License

MIT
