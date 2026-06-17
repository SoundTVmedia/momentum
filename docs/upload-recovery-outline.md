# Momentum — Upload & Recovery Plan

**Document purpose:** Plain-language outline of how we're making clip uploads reliable at live shows.

**Last updated:** June 17, 2026

---

## The Problem Today

When someone records a clip at a show and taps **Share**:

1. The video has to finish uploading before anything is truly "saved."
2. If they close the app, lose signal, or switch screens, the upload can fail and the clip may be lost.
3. On phones, uploads only work reliably while the app stays open in the foreground.
4. There's no "your clip is live" notification when processing finishes.
5. The server doesn't really know a clip is "on the way" until the entire upload completes.

**In short:** Recording works, but getting the clip safely to the feed in bad venue Wi-Fi is fragile.

---

## The Goal

Make posting feel like Instagram or TikTok at a concert:

- Tap **Share** → leave immediately (back to feed, record another clip).
- See **"Uploading…"** on your clips even if you close and reopen the app.
- **Pick up where you left off** if the connection drops.
- Get a **notification** when the clip is ready.
- Optionally **save a copy to your camera roll**.

---

## The Big Pieces (What We're Adding)

### 1. A Real Phone App Wrapper (Capacitor)

We wrap the existing web app in **Capacitor** so it behaves more like a native phone app.

| Feature | What it means for users |
|---------|-------------------------|
| **Native video recording** | More reliable camera; video saved to the phone's storage right away |
| **Background upload** | Upload keeps going (or resumes) when you switch apps or lock the screen |
| **Save to gallery** | "Also save to Photos" after recording |
| **Push notifications** | "Your clip from [Artist] at [Venue] is live!" |

The website still works in the browser; the app gets the extra reliability.

---

### 2. Split the Video Into Pieces Before Sending

A 60-second clip is still a big file on spotty Wi-Fi. Instead of sending it in one shot:

1. The app cuts it into **small chunks** (a few megabytes each).
2. Each chunk uploads **on its own**.
3. If chunk 3 of 6 fails, we only retry chunk 3 — not the whole video.

**Analogy:** Mailing a thick book by sending a few pages at a time. If one envelope gets lost, you resend only that envelope.

---

### 3. Upload Straight to Cloud Storage (Not Through Our Server)

Chunks go **directly** to Cloudflare R2 (our file storage), using temporary secure links.

**Why it matters:**

- Faster uploads (no middleman).
- Our server doesn't get overloaded holding big video files.
- Easier to resume — we know which chunks already landed.

---

### 4. Save Progress in Two Places

**On the phone (local queue):**

- Which clips are waiting to upload.
- Which chunks finished.
- Caption, artist, venue, etc.

So if the app crashes or you close it, reopening picks up where you left off.

**In the database (server):**

- A clip row is created **as soon as you tap Share** — status: "uploading."
- When all chunks arrive: status → "uploaded."
- When processing finishes: status → "live."

**Analogy:** You get a receipt the moment you order (Share), not only when the food arrives (upload done).

---

### 5. A Simple Background Worker (No Fancy Queue System)

A small scheduled job runs **about every minute** and asks:

> "Are there any clips that finished uploading but aren't processed yet?"

For each one it:

1. Prepares the video for playback (e.g. send to Cloudflare Stream).
2. Makes a thumbnail.
3. Runs any other steps (music ID, content checks, etc.).
4. Marks the clip **published** and sends a push notification.

We're **not** adding Redis or a heavy job system for MVP — a database table plus a cron job is enough to start.

---

## Step-by-Step: What the User Experiences

### Recording

1. User opens the app and records up to **60 seconds**.
2. Video is saved on the device immediately.
3. Optional: copy saved to camera roll.

### Caption Screen

4. User adds caption, artist, venue (often auto-filled from location).
5. Taps **Share**.

### Right After Share (within a second)

6. App creates an **"uploading"** clip on the server.
7. Video is queued locally on the phone.
8. User can go home, record another clip, or close the app.
9. **"Uploading…"** tile shows on My Clips with progress %.

### Upload (in background)

10. App uploads chunks one by one to cloud storage.
11. Progress updates (e.g. 40% → 80%).
12. If Wi-Fi drops: pause, retry when back online from the last good chunk.

### Processing (on the server)

13. When all chunks are in, server assembles the full video.
14. Background worker processes it (playback, thumbnail, etc.).
15. Clip goes **live** in the feed.

### Done

16. User gets a **push notification**.
17. "Uploading…" tile becomes a normal clip in My Clips and the feed.

---

## What Happens When Things Go Wrong

| Situation | What happens |
|-----------|--------------|
| **Bad Wi-Fi mid-upload** | Pause, resume from last successful chunk |
| **App closed** | Local queue + server both remember the clip; resume on reopen |
| **Upload fails completely** | "Failed — tap to retry" on My Clips |
| **User cancels** | Remove from queue; delete unfinished server record |
| **Processing fails on server** | Worker retries; user may see "processing" longer or get a retry |

---

## What We're Changing (Summary)

### For Users

- Share and leave — no waiting on a spinner.
- See uploading clips in **My Clips**.
- Uploads survive bad signal and app restarts (especially in the native app).
- Notifications when clips go live.
- Optional save to Photos.

### Behind the Scenes

| Area | Change |
|------|--------|
| **Phone app** | Capacitor wrapper + native recording + background upload |
| **Upload method** | Chunked, resumable, direct to cloud storage |
| **Local storage** | Persistent queue on device (survives refresh/restart) |
| **Database** | Clip + upload status tracked from Share, not only after upload |
| **Background job** | Minute-by-minute worker processes finished uploads |
| **Notifications** | Push when clip is ready |

### What We're NOT Doing (For Now)

- Redis or a complex job queue.
- Uploading after the browser tab is fully killed on **web only** (native app handles that).
- Showing half-uploaded clips in the **public** feed (only on **My Clips** until live).

---

## Build Order (How We'll Roll It Out)

**Phase 1 — Server foundation**

Database tables, secure upload links, "start upload" / "finish upload" APIs, background processor.

**Phase 2 — Web app queue**

Tap Share → queue locally + create server record; show progress on My Clips; retry on failure.

**Phase 3 — Native app (Capacitor)**

App store build, native camera, background upload, push notifications, save to gallery.

**Phase 4 — Polish**

Better error messages, cleanup of abandoned uploads, analytics, tuning for slow networks.

---

## One-Sentence Summary

**We're turning "wait on a loading screen until the whole video uploads" into "tap Share, leave immediately, and we'll reliably get your clip live in the background — even at a show with bad Wi-Fi."**

---

*Momentum — Upload & Recovery Plan*
