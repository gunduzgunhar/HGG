# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- **OS**: Windows
- **Language**: All UI text, comments, and variable names are in Turkish
- **Primary Project**: Emlak Asistanı Premium (Real Estate Assistant)

## Main Project: Emlak Asistanı Premium

**Location:** `.gemini/antigravity/scratch/real-estate-assistant/`
(Copy also at `OneDrive/Masaüstü/real-estate-assistant/`)

### Running

No build step. Open `index.html` in a browser. The app is a client-side SPA — all logic runs in the browser.

### Tech Stack

- Vanilla JavaScript (no framework)
- LocalStorage for offline data persistence
- Firebase Firestore for cloud sync (project: `gunhar-bfb6f`)
- Leaflet.js for map views
- Tesseract.js for OCR (text extraction from images)
- Phosphor Icons for UI

### File Structure

| File | Lines | Purpose |
|------|-------|---------|
| `app.js` | ~4400 | All application logic in a single `app` object |
| `index.html` | ~1750 | HTML structure + Firebase init + CDN imports |
| `style.css` | ~1470 | All styling |
| `backups/checkpoint_v1/` | Versioned backup of earlier state |

### Architecture

The entire app lives in a single global `app` object in `app.js`.

**Central state:** `app.data` holds all arrays: `listings`, `customers`, `appointments`, `findings`, `fsbo`, `targets`.

**9 views** switched by `setView(targetId)` — shows/hides DOM sections without page reload:
`dashboard`, `listings`, `crm`, `owners`, `calendar`, `fsbo`, `targets`, `map`, `findings`

**Data persistence flow:**
1. User action → update `app.data`
2. `saveData(key)` → write to localStorage immediately
3. `saveToFirestore()` → debounced cloud sync
4. `setupFirestoreListener()` → real-time sync from cloud (cloud wins if newer timestamp)

**Key systems:**

- **Price Estimation** (`evaluateListing`) — Calculates property value using: base m²/TL from sold comparables or `marketData` (Adana districts/neighborhoods), then adjusts for building age, floor, site features, damage, kitchen, interior condition. Has double-counting prevention when using sold data.

- **Smart Matching** (`findMatches`) — Matches customers to listings by: region, room count, kitchen type, budget (15% tolerance), building age. Searches both internal listings and FSBO listings. Tracks match history per customer-listing pair.

- **FSBO System** — For-sale-by-owner tracking with photo paste/upload, OCR text extraction, and smart text parsing (`parseFsboText`) that extracts price, rooms, address, phone via regex.

- **Map Integration** — Leaflet map with pins from `adanaLocations` (Seyhan, Çukurova, Yüreğir, Sarıçam districts with neighborhood coordinates).

- **Import/Export** — JSON backup/restore with merge logic (adds items with new IDs, preserves existing).

### Important Patterns

- Turkish locale: always use `.toLocaleLowerCase('tr-TR')` for string comparisons and `.toLocaleString('tr-TR')` for number formatting
- App works offline (localStorage) — Firebase/Firestore and OCR degrade gracefully when unavailable
- Rendering uses innerHTML replacement — each view has a `render*()` function
- Price formatting uses Turkish locale (e.g., `1.500.000 TL`)
