# Local-First Image & Text Randomizer Web UI

A lightweight web-based application that operates entirely locally. The app should pull data from a local folder containing images and a structured JSON file to randomly select and display elements.

## Functional Requirements

### Data Source

- Input: A JSON file defining the entries (e.g., Name, Image Path, Category).
- Assets: A local folder containing the associated image files.
- Fallback: If no image is specified or found for an entry, the UI must display a default placeholder icon.

### Randomization Logic (Two Modes)

- Mode A (Filtered Selection): The user selects a specific subset of entries from the total list. The app shows a random order of the selection, when pressing "Play".
- Mode B (Global Selection): The app selects one or more (depending on setting) random entry from the entire dataset.

### User Interface (UI)

- A "Play" button to trigger the randomization.
- A display area capable of showing one or multiple elements (Image + Text).

Use Case Examples:

Scenario 1: A list of 8 people (name + image). The user selects 4 people via the UI and clicks "Play". The app shows the selection in random order.
Scenario 2: A list of statements with images. The app shuffles the entire list and one random statement is displayed.

## Proposed data loading

- An **Open data folder** button lets the user explicitly select a local folder containing `entries.json` and an optional `images/` subfolder. Store the selected folder in local storage, so when the app is opened again the last selection will be shown.
- Each entry has a unique ID, required text (a person's name or statement), an optional image path, and an optional category.
- Image paths are relative to the selected folder, for example `images/alex.jpg`. Do not support absolute paths or references outside the dataset folder.
- Missing, unreadable, or unsupported images display a bundled placeholder while preserving the entry's text.
- Validate JSON structure, required fields, and unique IDs. Show clear, actionable errors for invalid data.
- Duplicate names or statements are allowed with different IDs; each entry receives its own chance of selection.
- Show the dataset name and entry count. Loading another folder resets the selection and results.

## Selection interface

Use a simple two-panel layout on desktop that stacks vertically on mobile.

- Show an entry list with checkboxes, small image previews, text, search, and optional category filtering.
- Provide **Select all visible** and **Clear selection** controls. Selecting visible entries preserves hidden selections; clearing selection unchecks all entries, including hidden ones.
- Search and category filters only change which entries are visible. Checkboxes determine eligibility in Mode A, labeled **Selected entries**.
- Mode B, labeled **All entries**, uses the entire dataset regardless of checkboxes or visible filters.
- Keep the total selected count visible even when filters hide checked entries.
- Provide a result-count setting and a prominent **Play** button.
- Show the effective pool clearly, for example **Picking 2 from 4 selected entries**.
- Display results as one or more cards with an image or placeholder and full entry text.
- Support keyboard operation, accessible labels, long statements, and announcements of final results.

## Randomization rules

- Default to one result, with an adjustable result count in both modes.
- Every eligible entry has an equal chance of selection.
- Final results contain no duplicate entry IDs within a single play.
- Entries may appear again on subsequent plays; previous results do not affect the next draw.
- Disable Play when the eligible pool is empty or the requested count exceeds its size, and explain why.
- Use a Fisher–Yates shuffle of eligible entries and take the requested number of results.

## Shuffle animation

- Clicking Play cycles through eligible entries, showing their images and text before revealing the final results.
- Start quickly, gradually slow down, and stop after approximately 2–3 seconds.
- For multiple results, animate separate card slots that settle one after another within approximately the same overall duration.
- Choose all final results before the animation begins. The animation is purely visual and must not affect selection probabilities.
- Preview entries may repeat during the animation, but final results remain unique within the play.
- Disable Play, dataset loading, and controls that change eligibility or result count while the animation runs.
- Preload images needed for animation previews and final results to avoid flickering. Use placeholders for unavailable images and bound preloading to avoid loading the entire dataset into memory.
- Respect reduced-motion preferences by skipping the animation and immediately displaying results.
- Announce final results to assistive technology rather than every transient preview.

## Proposed technical implementation

- Use plain HTML, CSS, and JavaScript without a framework.
- Separate folder loading and validation, application state, random selection, and UI rendering/animation into small modules.
- Read user-selected files in the browser and display images using temporary object URLs. Release URLs when no longer needed.
- Bundle all application assets locally, including the placeholder, with no CDN or remote services.
- Keep dataset processing in the browser; no database or application backend is needed.
- Proposed launch approach: a small localhost static server serving the application.

## Constraints and considerations

- Folder access requires an explicit user action; a webpage cannot silently read an arbitrary local folder.
- Check folder-loading support in the intended browsers. Refreshing or reopening the app may require selecting the folder again.
- Keep image paths portable and handle filename capitalization differences gracefully through the image fallback.
- Render dataset content as plain text, never executable HTML, and restrict image references to files inside the selected folder.
- Lazy-load list images and avoid eagerly decoding every full-resolution photo. Encourage appropriately sized images for large datasets.
- Explain that repeated winners across plays are valid random outcomes. Ensuring everyone gets a turn requires a separate mode.
