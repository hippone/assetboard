# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Assetboard is a local-first "digital asset board" prototype (domains, servers, subscriptions, repos…). One plain HTML/CSS/JS front end runs both in a browser and inside a native macOS Swift app (WKWebView). There is no package.json, bundler, or third-party dependency. UI copy and all design/research docs are Simplified Chinese.

Note: `/Users/hans/ownProject/CLAUDE.md` (parent directory) describes an unrelated MBTI project. Ignore it when working here.

## Commands

```sh
# Browser version (the Playwright scripts hard-code this port)
python3 -m http.server 4317 --bind 127.0.0.1        # → http://127.0.0.1:4317

# JS unit tests (asset-data.js). Use no args or a file path; `node --test tests/` fails.
node --test
node --test --test-name-pattern='repositor' tests/asset-data.test.js

# Python unit tests (desktop/gmail_local.py)
python3 -m unittest tests.test_gmail_local
python3 -m unittest tests.test_gmail_local.GmailImportTests.test_extracts_plain_text_and_headers

# macOS app → dist/Assetboard.app (ad-hoc signed). Also runs every Swift self-test.
./desktop/build.sh
dist/Assetboard.app/Contents/MacOS/Assetboard --demo   # fictional demo board, temp store, no Keychain, never saves (add --dark/--light to pin appearance; browser: ?demo)
dist/Assetboard.app/Contents/MacOS/Assetboard --test-github   # one self-test: --test-store | --test-cloudflare | --test-cloudflare-inventory | --test-github | --test-ocr | --test-webview | --test-ai

# Developer ID build + ZIP (notarization is manual and not scripted)
SIGNING_IDENTITY='Developer ID Application: Name (TEAMID)' ./desktop/package.sh
```

- `tests/*.playwright.js` are **not** run by a test runner. Each is an `async (page) => {…}` body meant for the Playwright MCP browser run-code tool (using its filename option). The local server must be running on 4317. The layout and reminders tests stub `save()`, so they never write data. Without the MCP tool, `eval` the file and call it with a page from Playwright's `chromium.launch({channel:'chrome'})`.
- `--test-webview` loads the bundled board in a real WKWebView (JavaScriptCore). It is the only automated check of the Swift → JS evidence bridge and of behaviour that differs from Chrome (e.g. `window.confirm()` returns false without a `WKUIDelegate`, so never use native `confirm`/`alert`).
- The Swift self-tests live in the `@main` struct at the bottom of `desktop/Assetboard.swift`. They use `MockCloudflareProtocol` to stub HTTP.
- Version `0.1.0` is hard-coded in both `desktop/Info.plist` and the ZIP name in `desktop/package.sh`. Release notes go in `docs/releases/`.

## Architecture

### One web UI, two hosts
- `index.html` loads classic scripts in this order: `theme.js` → `asset-data.js` → `demo-data.js` → `app.js`. They share top-level globals (`state`, `save`, `render`, `checkpoint`, `modal`, `themePalette`, `themeDialog`, `cloudflareDialog`, …). The Playwright tests and the Swift host call these globals by name, so keep them global.
- `asset-data.js` holds pure functions. It works as a browser global and also exports via `module.exports` so Node tests can `require` it. Put new unit-testable logic there. Its top-level `const`s share the global scope with `app.js`, so redeclaring one of its names in `app.js` is a SyntaxError that stops the whole app. Avoid regex lookbehind there; macOS 12's WebKit may not support it.
- `desktop/build.sh` has an **explicit copy list** of web files into `Contents/Resources/Board/`. A new front-end file must be added to that list as well as `index.html`. The same applies to the `swiftc` source list for new Swift files.
- Native detection: Swift injects `window.__ASSETBOARD_NATIVE__ = {data, cloudflareConnected, …}` at document start, and `app.js` reads it as `nativeStore`. In native mode the app adds `.native-app` to `<html>`, and `.native-only` elements (platform imports) exist only in the Mac app.

### JS ⇄ Swift bridge (cross-language contract)
- JS → Swift: `window.webkit.messageHandlers.assetboard.postMessage({action, …})`. The actions are `save`, `toolbarState` (also carries the `pending` inbox count), `themeColor`, `openExternal`, `cloudflareSync/Disconnect`, `githubSync/SyncLocal/Disconnect`, `gmailSync`, `ocrImport`, `evidenceList`, `aiSave`, `aiDisconnect`, `aiRecognize` (`{requestId, evidenceId}` or `{requestId, text}`), and `iconFetch` (`{requestId, host}`). They are handled in `AppDelegate.userContentController`.
- Swift → JS works through `evaluateJavaScript`:
  - Swift calls callbacks such as `window.assetboardSaved(seq, ok)`, `assetboardCloudflareResult`, `assetboardGitHubResult`, `assetboardGmailResult`, `assetboardOCRResult` (`{ok,id}`; JS then re-requests the list), `assetboardEvidenceList(rows, error)`, `assetboardAIResult({kind:'settings'|'recognize', …})`, `assetboardIconResult({requestId, ok, host, dataUrl|error})`, and `assetboardConnectionState` (includes `aiKeySaved`).
  - The native NSToolbar/menu drives the web UI: it clicks `#add-block`, writes `#search` and dispatches `input`, and calls `themeDialog()`, `cloudflareDialog()`, `githubDialog()`, `gmailDialog()`, `inboxDialog()`, and `aiDialog()`.
  - Renaming any of these ids or functions breaks the Mac app.
- Security boundary: the handler accepts messages only from main-frame `file://` URLs under the bundle's `Board/` directory, and all other navigation is cancelled. External links must go through `openExternal`, which allows only http(s), rejects credentials in the URL, and blocks `example.com`. The only other page-triggered network request is `iconFetch`: `IconFetcher.swift` fetches a public https host's own icon, without cookies, only on a click, and returns a 128px PNG data URL that the page stores as `asset.siteIcon` after the person confirms. No logos are bundled.

### State and persistence
- `state = {blocks, assets, theme, cardOrder, featuredRepositoryIds, deletedExternalIds, evidenceDecisions}`. A block's `id` **is** a category key (one block per category), with `width` in %, `height` (null = auto), `density` (`full`|`compact`) and `folded`. Read the style with `blockDensity(b)` (old saves used `collapsed:true` for compact) and write it with `setBlockDensity`. Folding keeps `density` and `height` so unfolding restores them.
- Asset dates: `date` (YYYY-MM-DD), `dateKind` (`expire|renew|trial|cancel`), `cycle` (`''|monthly|yearly`). Status labels, the agenda and block summaries are computed from these by `assetDateStatus`/`upcomingEvents` on every render; the legacy `warn` flag and stored `event` text are not used for dated assets. `reason` is the user's keep reason.
- Direct manipulation (no layout mode): the pointer-drag and edge-resize code at the end of `app.js` (`beginDrag`/`placeSlot`/`dropDrag`, `startResize`). While dragging, the element is `position:fixed` in place with a `.drop-slot` placeholder, and `render()` runs only after the drop. Clicks after a drag are swallowed; ⌥ + arrows is the keyboard path. `render()` animates position changes with translate only.
- Mutation pattern: `checkpoint()` (25-step undo snapshot) → mutate `state` → `save()` → `render()` → `toast(message, true)` to offer undo. Confirmations use `confirmDialog()` (Promise, in-page `#modal`). `save()` always sends the **whole** state. `render()` rebuilds `#board` innerHTML and FLIP-animates blocks with transform only (skipped under reduced motion). `foldRender()` instead animates the changed blocks' height in layout and suppresses that FLIP for one render. Window resize only calls `updateOverflow()` so DOM nodes are preserved; a test checks this.
- The category list is duplicated: `cats`/`icons` in `app.js`, the `categories` set in `BoardStore.validate` (Swift), and the type list in the `AIRecognizer.prompt` text. Swift rejects saves that contain unknown categories, so update them together.
- Priority types (`bankcard`, `phone`, `appleid`, `google`, `ai`) have an entry in `assetProfiles` (`app.js`), which sets their form labels, extra fields (`region`, `last4`, `network`, `phone`) and date defaults. `asset.links` holds symmetric links to other asset ids (helpers in `asset-data.js`). Never store full card numbers: the form refuses Luhn-valid numbers. Phone numbers and emails are masked on the board and revealed only in details.
- Browser storage is localStorage key `assetboard-prototype-v1`.
- On the Mac, storage lives under `~/Library/Application Support/Assetboard/`:
  - `assetboard.sqlite` is the source of truth (`LocalDatabase.swift`). It has three tables:
    - `board_state` holds a single-row JSON payload.
    - `assets` is a copy that gets fully rewritten on every save.
    - `evidence` holds imported OCR/Gmail text.
  - `board.json` and `board.previous.json` are readable mirrors. If a mirror write fails, the app only logs it and still reports the save as successful.
  - A legacy `board.json` is migrated into SQLite on first load. If an existing file can't be read, the app stops instead of overwriting it.
  - Tokens are stored in the Keychain. Gmail's OAuth client and refresh token are stored as 0600 JSON files in the same directory.
- Display order (2026-10-09): `arrangeAssets(assets, state.cardOrder[category])` in `asset-data.js` puts manually ordered ids first, then the rest by `recencyTime` (`updatedAt`, else `createdAt`, else stored order). Urgency never chooses what shows; it only colours dates and feeds the agenda and block summaries. Manual order is saved as the touched prefix only (`touchedPrefix`), so untouched cards keep following recency. New manual assets get `createdAt` and are put first if the block already has a manual order; local edits of non-synced assets set `updatedAt`; Cloudflare/GitHub imports set `createdAt` on first import. Repositories also use `featuredRepositoryIds`. The detail panel's 放到前面 (`pinFront`) / 恢复自动排序 (`autoOrder`) and drag swaps (`swapZones`/`finishSwap`: repository list tile ⇄ featured card on the board, or across the full view's `.limit-divider`, which sits where the board's display area ended per `boardShown`) all go through `checkpoint()` so ⌘Z undoes them. Across the divider only swaps are possible; within one side dragging reorders.
- Display limits live in `DISPLAY_LIMITS` (`asset-data.js`) and are applied after layout by `limitRows()` (called from `updateOverflow`) to `.block.limited` (auto-height, not folded, no search/full view). Hidden items use `display:none` + `inert`; the header `查看全部` button opens the rest. Never truncate data for display.
- Demo mode: `demo-data.js` defines `window.assetboardDemoBoard()`; `app.js` uses it when `nativeStore.demo` or `?demo`, and `save()` becomes a no-op. The Swift side (`demoMode`) uses a throwaway temp `BoardStore`, skips Keychain reads and refuses network/Keychain/OCR/export bridge actions (CSV/JSON demo samples still run in JS). Allowed bridges: `toolbarState`, `openExternal`, `copyText`, `focusSearch`, `save` (acked without writing), `evidenceList` (empty).
- `removeUntouchedDemo` (in `asset-data.js`) strips v0.1.0 demo records by exact content fingerprint on load, so user-edited records survive.

### Unified import (2026-10-09; phase 2 same day)
- Entry: toolbar「导入」, welcome card, File menu「导入…」, keyboard `I`, plus board-wide drag/drop and ⌘V (ignored while typing in a field).
- Routing (`classifyImportPayload` in `asset-data.js`): CSV/TSV/table paste → `parseDelimitedText`/`rowsToImportItems`/`planImport`/`applyImport`; JSON board backup → `parseBoardBackup`/`planBoardBackup`/`applyBoardBackup`; `.eml` / `message/rfc822` → `parseEml` then paste/review candidate; image/PDF → native `ocrImport` / `ocrImportData` (multi-select ≤10; ⌘V file items too); plain text → existing paste candidate.
- Preview (`importPreview` groups): 新增 / 更新 / 同名待定 / 已删除跳过（可恢复） / 已隐藏 / 没读懂. Shown only on conflict, truncation (> `IMPORT_ROW_LIMIT` 100), or replace mode; otherwise write under one `checkpoint()` so ⌘Z undoes the batch. Same-name CSV rows default to skip. Secret-looking columns are dropped.
- Local CLI strip (native only, not demo): `localCliDetect` → `LocalCLI.detect()` for `gh` multi-account + `~/.ssh/config` presence; hub buttons call `githubSyncLocal` / `sshConfigImport`. Commands only (`gh auth status`, `gh auth token --user`); SSH reads Host/HostName/User/Port via `parseSshConfig`/`mergeSshConfig`. Failure UI offers next steps including `cloudflareTokenTemplateUrl` / `githubTokenTemplateUrl`.
- Demo: `import-demo-sample` loads `demoImportSampleCsv()` into memory; `save()` stays a no-op; CLI/OCR bridges refused.
- Tests: `tests/asset-data.test.js` (parse/plan/apply + eml/ssh/CF URL/registrar merge) , `tests/import.playwright.js`, `tests/import-phase2.playwright.js`.

### Copy trim (2026-10-10)
- Rule (DESIGN-PRINCIPLES §四.9, §七乙): one text focus per area; hints go to `title`/`<details>`; icon-only buttons need `title` + `aria-label`; delete/permission/privacy/network warnings keep one clear sentence.
- `ui(name)` in `app.js` returns small stroke glyphs from `uiGlyphs` (download, file, plus, mail, image, terminal, refresh, cloud, github, back, info, lock, warn, check, gear, spark) for buttons and chips; styles in the "v11" block at the end of `material.css` (`.ui-icon`, `.fmt`, `.chip.warn/.ok/.bad`, `.count`, `.platform-bar/.platform-note`, `.import-group.add|update|hold|quiet|bad`).
- Hub, preview, inbox/review, detail, form, icon batch, platform dialogs, keys overlay and toasts were shortened. Hidden facts: empty values are not rendered. Review shows 名称/类别/金额/日期 and folds 来源/依据 in `.review-basis` (`.basis-list`, not `.facts`).
- Tests: `tests/copy-trim.playwright.js` (no prose in welcome/hub/detail, named icon buttons, warnings kept, 390px light/dark). Other Playwright tests assert behaviour via selectors, not copy; where they read text (e.g. `icon-batch` skipped counts, `ai` host, `reminders` amounts) the phrases are unchanged.

### Depth and de-duplication (v12, 2026-10-10)
- Rules: DESIGN-PRINCIPLES §九 items 6, 13, 15 (rewritten) and 17–23. Containers sit lower than content: canvas gradient → recessed translucent tray (block) → raised card (two-layer shadow + 1px inner highlight) → overlay. Tokens live in the last layers of `material.css` (`--canvas-*`, `--surface-tray`, `--tray-inset`, `--card-top/bottom`, `--shadow-card/hover/pop/pin`, `--faint`, `--dot-red/amber`).
- Blur only on `#topbar` (class `appbar`; not `.topbar`, `styles.css` still has a legacy rule) and the dialog backdrop. In the native app the system toolbar holds search/inbox/theme/add as SF Symbol icon buttons (`iconButton()` in `Assetboard.swift`), the page keeps the agenda strip and the demo badge. Never use `color-mix()` in a `background-color` of an element that holds text: `tests/contrast.playwright.js` cannot read it.
- Cards: tile only for real icons (`cardTile`), private repo = `lockMark`, repository foot = `ageText`. `blockCommon(type)` hoists a provider/account shared by every visible asset into the block header (`originChip`); `hoisted` is a module variable set while a block renders, search and hidden view never hoist. Big card = `state.cardOrder[type][0]` (`pinnedId`), never chosen by urgency.
- Block summary is `.sum-dot` pairs inside `.block-summary[aria-label]`; `全部 ›` keeps the full sentence in `aria-label`; the repository list title is `.sr-only` with `aria-label`.
- Tests: `tests/v12.playwright.js` (demo plain, hoisting, lock, depth tokens, contrast of `--faint`, one blur layer, icon buttons named, dots, big card, empty slot, equal row heights, focus reveal, reduced motion, 390px). `limits`, `reminders`, `tiles`, `icon-batch`, `copy-trim` were updated for the new wording and the missing card tile. `desktop/Assetboard.swift` self-test now looks for `3 天` in the agenda text and compares `backgroundColor+backgroundImage` for light/dark.

### Platform imports (Mac only, read-only)
- **Cloudflare / GitHub:** Swift fetches every page of the list endpoints, and JS merges the results into `state`:
  - Identity comes from `syncKey(source, externalId, kind)`, and asset ids look like `cloudflare-<kind>-<id>`, `github-repo-<id>`, and `ssh-host-<host>`.
  - Synced fields overwrite existing ones, but local notes, icon, and URL are kept. Multi-account resources share a block and show `.account-tag`.
  - Records a sync doesn't return are marked `syncMissing` and never auto-deleted. For Cloudflare this only happens for kinds that were fully queried.
  - Synced assets the user deletes are added to `deletedExternalIds` so a later sync won't re-add them.
  - Cloudflare kinds map to categories: `zone`→domain, `r2`→storage, pages/workers→deployment. Registrar expiry from `GET /accounts/{id}/registrar/registrations` (legacy `/registrar/domains` retired); optional if token lacks Registrar read. Prefill URL: `cloudflareTokenTemplateUrl` (`permissionGroupKeys` for zone, account_settings, page, workers_scripts, workers_r2, optional registrar).
  - GitHub can use PAT **or** LocalCLI `gh` per account (`syncGitHubWithLocalCLI`).
- **Mail:** Drag `.eml` from the Mail app into the unified hub (no IMAP / app passwords). Legacy **Gmail** bridge still exists: Swift runs bundled `gmail_local.py` (stdlib only) with `/usr/bin/python3 … --credentials --database --token-file`. The script upserts into the `evidence` table (last 14 months only) and prints one JSON result to stdout. **OCR** uses Vision/PDFKit (`OCRImporter.swift`, multi-file) and also writes to `evidence`. Evidence is never automatically turned into assets.
- **Inbox (待确认):** `evidenceList` returns up to 500 rows with bodies clipped to 6000 chars. `buildCandidates` in `asset-data.js` groups rows by sender domain (payment processors by merchant name), extracts amount/cycle/dates/domains by regex, and infers the next charge from receipt spacing. A person confirms each group; the outcome is stored per evidence id in `state.evidenceDecisions` (not in SQLite) so undo keeps assets and decisions consistent. Pasted text builds a one-off candidate and is not persisted.
- **Own-key AI** (`AIRecognizer.swift`, see `docs/ai-recognition.md`): Swift builds Anthropic Messages or OpenAI-compatible chat requests, keeps the key in the Keychain (`studio.assetboard.local.ai`) and settings in `ai-settings.json`, and stores the reply text in the evidence row's `payload.ai`. The page never receives the key or sends content itself; it sends an evidence id or pasted text. `parseAiItems` treats replies as untrusted and keeps only validated fields; `applyAiItem` overlays one item on the rule candidate (`candidate.base` keeps the rule reading). With several items, per-item recording is stored as `evidenceDecisions[rowId].recorded`. Evidence payload writes (Swift and `gmail_local.py`) merge rather than replace, so re-imports keep `ai` and OCR's `file` path.
- Sync merge (`mergeCloudflare`/`mergeGitHub`) is pure and lives in `asset-data.js`. Same-name local records are returned as `collisions` and only overwritten after the person ticks them in `syncFollowUp`.

### Styling and theme
- `styles.css` is the base stylesheet and still contains selectors for removed layouts. `material.css` loads at the end of `<body>` and overrides it. It is built from appended revision layers, so later rules win, and many selectors are prefixed with `:root` for specificity. Check `material.css` before assuming a rule in `styles.css` is live.
- `theme.js` turns a seed color into an OKLCH-based palette for the current system scheme (`prefers-color-scheme`, live) and writes it to `--tone-*` custom properties as bare `r,g,b` triplets, used as `rgba(var(--tone-card),.5)`. It also sets `<html data-scheme=light|dark>`. Surfaces are near-neutral and opaque; the hue only drives `--tone-primary`.
- Colours are decided by the **"Colour system" layer at the end of `material.css`**: semantic variables (`--surface-*`, `--border`, `--hover`, `--on-primary`, `--danger`, `--warning`, shadows) with dark values under `:root[data-scheme=dark]`. Style new components with these variables rather than hex values, or dark mode breaks. The Mac window no longer forces `.aqua`.
- `tests/theme.playwright.js` checks palette contrast for both schemes; `tests/contrast.playwright.js` measures every visible text node on the main screens and dialogs in light and dark against its composited background.

## Conventions

- Match the existing dense style: `app.js`, `theme.js`, and the CSS use compact one-line functions and rules. Swift and Python use normal formatting.
- Docs record what was actually verified, with dates, and state their limits explicitly (e.g. notarization applies only to the v0.1.0 package, and Gmail has not been verified end-to-end). Keep new claims in README/PROTOTYPE scoped the same way.
- Design authority: `DESIGN-PRINCIPLES.md` (2026-10-09, user-confirmed) sets the goals, hard rules (one accent colour, display limits, motion ≤ 0.2s via `MOTION_MS`, screenshots only in demo mode) and trade-off order; check every visual change against it. `ASSETBOARD-BOARD-DESIGN.md` is the current board direction, and the other `ASSETBOARD-*.md` files are earlier research. `UI-COLOR-RESEARCH.md` supersedes `THEME-DESIGN.md`. `PROTOTYPE.md` and `LAYOUT-VALIDATION.md` log verification results.
- Keyboard map and category quick actions (2026-10-09): one `keydown` handler in `app.js` (after `undo`/`redo`) — letter keys never fire while typing (`typing(e)`) or with `#modal` open; `?` overlay is `#keys-help` (`toggleKeysHelp`); `X` swaps via `applySwap` (shared with drag swaps). Quick actions come from `quickActions()` in `asset-data.js`; native bridges `copyText`, `focusSearch` (allowed in demo) and `openLocalDirectory` (validated by `LocalDirectory`, `--test-local`). Covered by `tests/keyboard.playwright.js`.
- Visual scale (2026-10-09): `material.css` ends with a "Scale" layer holding `--radius-sm/md/lg`, `--elevation-1/2`, `--motion-fast/base/slow` and `--ease`/`--ease-exit` (DESIGN-PRINCIPLES §9); new rules reference these instead of literal values.
- Icons and card text (2026-10-09): `tile(asset,size)` in `app.js` is the only way an asset is drawn (custom `iconData` > fetched `siteIcon` > the category line icon from `icons`); there is no illustration art any more. Cards are `card-head` (tile + name + `cardSub`) plus a fixed 36px `card-foot` with one status; purpose lives in the hover title and detail. The "Tile & type" layer at the end of `material.css` sizes tiles (32 / 20 sm / 44 lg) and the type scale; `tests/tiles.playwright.js` guards it (DESIGN-PRINCIPLES §9 rules 13–15).
- Site icons (2026-10-09): `iconVendors` in `asset-data.js` maps provider/account text, Cloudflare/GitHub sync sources and vendor management links to public vendor homepages (`iconVendor`, `vendorForHost`); own-named types (domain, server, database, repository, deployment, storage) never use their name or own link. `iconPlan` groups assets per vendor host for the batch run (`iconBatchDialog` → `iconBatchStart` in `app.js`, 3 in flight via the existing `iconFetch` bridge and `assetboardIconResult`, results applied under one `checkpoint()`). `markTone` measures each icon once and adds `mark-dark`/`mark-light` for a contrasting tile backing. Swift `IconFetcher` is unchanged apart from the File-menu entry; demo mode blocks both the menu and the bridge. Tests: `tests/asset-data.test.js` (mapping, own-name rule, plan) and `tests/icon-batch.playwright.js` (fake bridge, no network). The proxy on the dev Mac (fake-IP 198.18.x) breaks TLS to a few hosts (alibabacloud.com, tencentcloud.com, akamai.com); check from another network before calling a vendor unreachable.
