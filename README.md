# Event Calendar Maker

> [!WARNING] 
> This project is LLM written.

Calendar maker with range and multi-selection to mark events (A4 and Letter), with print and PDF exports.

## Technical Details

Dependency-free HTML+CSS+JS. Document state is persisted locally in the browser with `localStorage`.

## Interactions

- Click a day to start a new selection; hold Shift to add or toggle dates.
- Drag across days to select a contiguous range. While editing an event, dragging toggles that range.
- Click an event row in the legend to edit its dates. Click outside the calendar or legend to commit the edit.
- Click `Add event` below the legend to name the current selection.

## Persistence

Calendar text, events, colors, dates, paper size, and week-start preference are stored only in this browser. Clearing site data or using another browser/device removes or does not include the saved document.

## TODOs

- [x] Multiselect non-sequential days for the same event.
- [ ] Auto import from excel or spreadsheets.
- [ ] Auto import from .ics files.
- [x] Edit event dates.
- [ ] LLM written warning, link to homepage, link to about page.
