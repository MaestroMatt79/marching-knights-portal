# Marching Knights Portal

React + Vite + Tailwind app for marching band directors and students.

**Features**
- Calendar of events (rehearsals, sectionals, parades, competitions, games)
- Rehearsal plans (director editable)
- Roles: Student & Director (PIN)
- Student absence requests + status tracking
- Director approvals/denials with notes
- CSV roster import (Name, Section/Instrument, Email) + section filters
- Weekly print view
- Optional Google Sheets sync + email notifications (Apps Script)

## Local dev
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
```

## Deploy to GitHub Pages
- Non-Vercel builds use `base: '/marching-knights-portal/'` (see `vite.config.js`).
- Push to `main` and the included GitHub Action publishes to Pages automatically.

## Deploy to Vercel
1. Import this GitHub repo in Vercel.
2. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
3. The included `vercel.json` provides SPA rewrites, and `vite.config.js` auto-sets `base` for Vercel.

## Google Sheets setup
Create a Google Sheet with a tab **Absences** and headers:
```
Timestamp | RequestID | Student | StudentEmail | EventID | EventTitle | Reason | Note | Status | DirectorNote
```
Then paste the Apps Script (Code.gs) into **Extensions → Apps Script**, deploy as a Web App (Execute as Me; Anyone with the link), and place the **/exec** URL in the app Settings.
