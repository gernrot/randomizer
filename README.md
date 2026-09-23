# Randomizer

A local image and text randomizer built with HTML, CSS, and JavaScript. No dependencies, remote fonts, uploads, or accounts.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open **http://localhost:5173**. Keep the command running while using the app; stop it with Ctrl+C. Use the same URL and port each time so the browser can restore your saved collections. Set `PORT` to use another port. The server only listens on this computer and only serves app assets.

Click **New**, then **Select folder** and choose your data folder. The included `example-data` folder is a valid dataset. Select entries, choose a mode, and **Save**. Then press **Run**.

## Dataset format

Place a `.csv` file with any filename (for example `participants.csv`) directly in the selected folder, with just two columns:

```csv
text,image
Alex Morgan,images/alex.jpg
What would you try if you could not fail?,
```

Text is required; leave the image field empty for a text-only entry with no image or placeholder. No ID or category column is needed. IDs are generated automatically, and duplicate rows represent separate entries. Save as **CSV UTF-8** in Excel. Comma and semicolon separators, quoted fields, escaped quotes, and line breaks inside quoted fields are supported. Blank rows are ignored. Quote fields containing the separator or line breaks, and double quotes inside quoted fields (for example `"Say ""hello"", Alex"`).

Put images in the selected folder or a subfolder:

```text
my-collection/
  participants.csv
  images/
    alex.jpg
```

JSON files with any filename are also supported. Keep exactly one `.csv` or `.json` file directly in the selected folder; files in subfolders are not used as the dataset. Extensions are case-insensitive, so `.CSV` and `.JSON` also work. The JSON format is:

```json
[
  { "id": "alex", "text": "Alex Morgan", "category": "Design", "image": "images/alex.jpg" },
  { "id": "prompt-1", "text": "What would you try if you could not fail?", "category": "Prompts" }
]
```

For JSON, an object with an `entries` array is also accepted. IDs must be unique non-empty strings. Text is required; category and image are optional. Duplicate text with distinct IDs represents distinct entries. In either format, paths are case-sensitive, relative to the selected folder, and cannot contain traversal, absolute paths, URL schemes, query strings, or encoded segments. An empty image path displays no image; a non-empty path pointing to a missing or unreadable image shows a placeholder. Content is rendered as plain text.

## Collections and drawing

- The start page contains **New**, a saved-folder dropdown, **Run**, and **Reset**. Selecting a saved collection opens its settings; **Edit** reopens the active collection.
- The modal edits a draft. **Save** stores the folder snapshot, selected entries, mode, and result count, closes the modal, and activates the collection. **Cancel**, the close button, or **Escape** discards edits. Changing a folder clears the draft selection; it does not change the saved collection until Save.
- **Shuffle** displays every remaining selected entry in random order. **Pick** draws the specified number from the remaining selected entries. Results count is available only in Pick. Both modes require at least one selected entry.
- Search filters visible entries without changing the selection. **Select all** clears search and selects every entry. **Clear selection** unchecks every entry, including hidden search results.
- Each entry can appear only once per round within its saved collection. Switching collections, changing modes, or saving edits does not clear history. A complete Shuffle exhausts the selected pool. Run is disabled when the pool is exhausted or fewer entries remain than the requested count.
- **Reset** clears displayed results and all session draw history while keeping the active folder, selected entries, mode, and result count. Run again immediately to start a new round. Reloading the page also clears session draw history.
- Run shows results below the persistent toolbar with a warm neutral palette and muted teal accents. All toolbar controls remain visible, and the run button updates from **Shuffling…** to **Run again** when the draw completes. Controls are locked during a draw.
- A Fisher–Yates shuffle with rejection-sampled Web Crypto random integers selects results before a roughly 2–3 second animation. Only eligible entries appear in previews. Images and text are blurred until each slot settles. Reduced-motion preferences skip the animation and blur.

## Local persistence and browsers

Folder loading uses the browser's directory file input, with no permission to silently reread the original folder. IndexedDB stores multiple snapshots of parsed entries and referenced image files, together with each collection's selection and draw settings. Reloading restores the dropdown options with no collection selected. Reopen a folder using **Change** to load edits made on disk. The original folder is never modified.

Collections have independent IDs; folders with the same name appear with numbered labels. New creates a separate collection, while Edit updates an existing one. The previous app's single saved dataset is migrated into the dropdown with all entries selected and Shuffle mode. Draw history is never persisted.

Storage limits, private browsing, or clearing site data can prevent persistence. The app reports storage failures and remains usable for the session. Large photos can consume substantial storage and memory: use appropriately sized images. List images are loaded as they approach the viewport, and animation preloading is bounded.

Use a current desktop browser with directory file input, IndexedDB, and Web Crypto support. Mobile folder selection depends on the browser and operating system. The page is responsive, but directory import should be verified on the actual target device. The app is served locally; opening `index.html` directly is not the supported launch method.

## Verification

```sh
npm test
```

Tests cover dataset validation, folder boundaries, missing images, eligible pools, result-count validation, permutations, random integer bounds, saved settings restoration, and legacy dataset conversion.

For a manual check, create two collections, save different selections and modes, and reload to verify both remain in the dropdown. Edit and cancel to verify saved settings remain intact. Search for an entry and use Select all to verify the search clears and every entry is checked. Run a Pick repeatedly and verify no repeats, then run Shuffle to exhaust the remaining selection. Reset should clear results and draw history while retaining the active folder and settings, allowing another run immediately. Also check reduced motion, an invalid JSON file, missing images, keyboard modal navigation, and a narrow viewport.
