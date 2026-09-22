# Randomizer

A local image and text randomizer built with HTML, CSS, and JavaScript. No dependencies, remote fonts, uploads, or accounts.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open **http://localhost:5173**. Keep the command running while using the app; stop it with Ctrl+C. Use the same URL and port each time so the browser can restore your saved collection. Set `PORT` to use another port. The server only listens on this computer and only serves app assets.

Click **Try an example** to explore immediately, or **Open folder** and select your data folder. The included `example-data` folder is also a valid dataset.

## Dataset format

Place `entries.json` directly in the selected folder. Put images in that folder or a subfolder:

```text
my-collection/
  entries.json
  images/
    alex.jpg
```

```json
[
  { "id": "alex", "text": "Alex Morgan", "category": "Design", "image": "images/alex.jpg" },
  { "id": "prompt-1", "text": "What would you try if you could not fail?", "category": "Prompts" }
]
```

An object with an `entries` array is also accepted. IDs must be unique non-empty strings. Text is required; category and image are optional. Duplicate text with distinct IDs represents distinct entries. Paths are case-sensitive, relative to the selected folder, and cannot contain traversal, absolute paths, URL schemes, query strings, or encoded segments. Missing or unreadable images show a placeholder. Content is rendered as plain text.

## Drawing

- **All entries:** Pick a specified number from the whole collection; defaults to one.
- **Selected entries:** Shuffle every checked entry into a random order by default, following the functional requirement in `idea.md`. Enable **Limit results** to draw a smaller number. This reconciles the full-selection requirement with the optional result-count setting.
- Search and category filters affect visibility only. **Select all visible** adds visible entries to the selection; **Clear selection** removes all checked entries, including hidden ones.
- Each entry ID can be drawn only once per round, including across mode and selection changes. Both results and subsequent animation previews exclude previously drawn entries. **Reset**, available beside Play in both views, clears the draw history without changing the selection, settings, or displayed results. History lasts for this page session; reloading the page or loading a dataset starts a new round.
- Play is disabled when the eligible pool is exhausted or fewer entries remain than the requested result count. Reset the round, reduce the count, or expand the pool to continue.
- The Play button stays visible in the full-page view so you can draw again with the same selection and settings. It is disabled while shuffling to prevent overlapping draws.
- Pressing Play immediately switches to a full-page view with larger cards for the shuffle animation and final results. **Back to controls** or **Escape** restores the interface, preserving the selection, settings, and results. Returning during a shuffle lets it finish without reopening the full-page view; draw controls remain locked until it finishes. Reduced motion skips directly to the results.
- A Fisher–Yates shuffle with rejection-sampled Web Crypto random integers selects results before a roughly 2–3 second animation. Preview images are preloaded with a bounded wait. Images and text are blurred during the shuffle, then revealed sharply as each slot settles in sequence. Reduced-motion preferences skip the animation and blur.

## Local persistence and browsers

Folder loading uses the browser's directory file input, with no permission to silently reread the original folder. Local storage remembers the folder label, while IndexedDB stores a snapshot of the parsed entries and referenced image files. The snapshot reopens automatically on the same browser and origin; reopen the folder to load edits made on disk. **Forget dataset** removes the saved snapshot. The original folder is never modified.

Storage limits, private browsing, or clearing site data can prevent persistence. The app reports storage failures and remains usable for the session. Large photos can consume substantial storage and memory: use appropriately sized images. List images are loaded as they approach the viewport, and animation preloading is bounded.

Use a current desktop browser with directory file input, IndexedDB, and Web Crypto support. Mobile folder selection depends on the browser and operating system. The page is responsive, but directory import should be verified on the actual target device. The app is served locally; opening `index.html` directly is not the supported launch method.

## Verification

```sh
npm test
```

Tests cover dataset validation, folder boundaries, missing images, eligible pools, result-count validation, permutations, and random integer bounds. For a manual check, load the example, select four entries, switch to Selected entries, and verify that four distinct cards settle. Try filters, a limited draw, reduced motion, an invalid JSON file, missing images, and reopening the page to restore the dataset.
