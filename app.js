const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const titleElement = document.querySelector("#paperTitle");
const yearElement = document.querySelector("#paperYear");
const subtitleElement = document.querySelector("#paperSubtitle");
const paperSizeElement = document.querySelector("#paperSize");
const weekStartElement = document.querySelector("#weekStart");
const printButton = document.querySelector("#printButton");
const addEventButton = document.querySelector("#addEventButton");
const clearEventsButton = document.querySelector("#clearEventsButton");
const selectionStatus = document.querySelector("#selectionStatus");
const calendarLayout = document.querySelector("#calendarLayout");
const eventLegend = document.querySelector("#eventLegend");
const events = [];
const storageKey = "event-calendar-maker-state";
const paperSizes = {
  a4: { width: "210mm", height: "297mm", print: "A4" },
  letter: { width: "215.9mm", height: "279.4mm", print: "Letter" }
};
const selectedDates = new Set();
let editingEvent = null;
let selectionAnchor = null;
let selectionBase = new Set();
let isSelecting = false;
let didDrag = false;

function saveState() {
  const state = {
    title: titleElement.textContent,
    year: yearElement.textContent,
    subtitle: subtitleElement.textContent,
    paperSize: paperSizeElement.value,
    weekStart: weekStartElement.value,
    events
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Persistence is optional when storage is blocked or unavailable.
  }
}

function isValidIsoDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === date;
}

function isHexColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color);
}

function loadState() {
  try {
    const state = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!state || typeof state !== "object") return;
    if (typeof state.title === "string") titleElement.textContent = state.title;
    if (/^\d{4}$/.test(state.year || "")) yearElement.textContent = state.year;
    if (typeof state.subtitle === "string") subtitleElement.textContent = state.subtitle;
    if (paperSizes[state.paperSize]) paperSizeElement.value = state.paperSize;
    if (["0", "1"].includes(String(state.weekStart))) weekStartElement.value = state.weekStart;
    if (!Array.isArray(state.events)) return;
    state.events.forEach((event) => {
      if (!event || typeof event.name !== "string" || !Array.isArray(event.dates) || typeof event.color !== "string") return;
      const dates = sortedDates(event.dates.filter(isValidIsoDate));
      if (dates.length === 0) return;
      events.push({ name: event.name, dates, color: isHexColor(event.color) ? event.color : "#cfd8d4" });
    });
  } catch {
    // Ignore malformed or unavailable persisted state.
  }
}

function applyPaperSize() {
  const size = paperSizes[paperSizeElement.value];
  document.documentElement.style.setProperty("--paper-width", size.width);
  document.documentElement.style.setProperty("--paper-height", size.height);
  document.querySelector("#printPageStyle")?.remove();
  const printPageStyle = document.createElement("style");
  printPageStyle.id = "printPageStyle";
  printPageStyle.textContent = `@media print { @page { size: ${size.print} portrait; margin: 0; } }`;
  document.head.append(printPageStyle);
}

// Requires a four-digit Gregorian year; invalid input disables printing and preserves the last valid grid.
function validYear() {
  const year = Number.parseInt(yearElement.textContent.trim(), 10);
  return /^\d{4}$/.test(yearElement.textContent.trim()) && year >= 1900 && year <= 2200 ? year : null;
}

// Builds one month from a valid year and appends it to the selected column.
function createMonth(year, monthIndex) {
  const month = document.createElement("section");
  month.className = "month";
  month.innerHTML = `<h2 class="month-name">${monthNames[monthIndex]}</h2><div class="weekdays"></div><div class="days"></div>`;
  const weekdays = month.querySelector(".weekdays");
  const days = month.querySelector(".days");
  const weekStart = Number(weekStartElement.value);
  const orderedDayNames = [...dayNames.slice(weekStart), ...dayNames.slice(0, weekStart)];
  orderedDayNames.forEach((dayName) => {
    const cell = document.createElement("span");
    cell.className = "weekday";
    cell.textContent = dayName;
    weekdays.append(cell);
  });
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (firstDay - weekStart + 7) % 7;
  for (let i = 0; i < offset; i += 1) {
    const empty = document.createElement("span");
    empty.className = "day empty";
    days.append(empty);
  }
  for (let date = 1; date <= daysInMonth; date += 1) {
    const cell = document.createElement("span");
    const actualDay = new Date(year, monthIndex, date).getDay();
    cell.className = "day";
    cell.dataset.date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    if (actualDay === 0 || actualDay === 6) cell.classList.add("weekend");
    cell.textContent = date;
    days.append(cell);
  }
  return month;
}

function datesBetween(first, last) {
  if (!first || !last) return [];
  const start = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  const direction = start <= end ? 1 : -1;
  const dates = [];
  for (let date = start; direction === 1 ? date <= end : date >= end; date.setUTCDate(date.getUTCDate() + direction)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function areConsecutiveDates(first, second) {
  return Boolean(first && second && datesBetween(first, second).length === 2);
}

function sortedDates(dates) {
  return [...new Set(dates)].sort();
}

function toggledDates(baseDates, datesToToggle) {
  const result = new Set(baseDates);
  datesToToggle.forEach((date) => {
    if (result.has(date)) result.delete(date);
    else result.add(date);
  });
  return result;
}

function eventIsVisible(event) {
  return event.dates.some((date) => date.slice(0, 4) === String(validYear()));
}

function eventsForDate(date) {
  return events.filter((event) => event.dates.includes(date) && eventIsVisible(event));
}

function formatDate(date) {
  const options = { month: "short", day: "numeric" };
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", options);
}

function formatDateSummary(dates) {
  const orderedDates = sortedDates(dates);
  const runs = [];
  orderedDates.forEach((date) => {
    const previous = runs.at(-1);
    if (!previous || datesBetween(previous[1], date).length !== 2) {
      runs.push([date, date]);
    } else {
      previous[1] = date;
    }
  });
  return runs.map(([start, end]) => start === end ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`).join(", ");
}

function hslToHex(hue, saturation, lightness) {
  const saturationAmount = saturation / 100;
  const lightnessAmount = lightness / 100;
  const amplitude = saturationAmount * Math.min(lightnessAmount, 1 - lightnessAmount);
  const channel = (offset) => {
    const k = (offset + hue / 30) % 12;
    const value = lightnessAmount - amplitude * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * value).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function renderLegend() {
  eventLegend.replaceChildren();
  const visibleEvents = events.filter(eventIsVisible);
  if (visibleEvents.length === 0) {
    const note = document.createElement("p");
    note.className = "legend-note";
    note.textContent = "Events appear here";
    eventLegend.append(note);
    return;
  }
  visibleEvents.forEach((event) => {
    const entry = document.createElement("div");
    entry.className = "legend-entry";
    entry.event = event;
    entry.classList.toggle("editing", event === editingEvent);
    entry.addEventListener("click", () => beginDateEdit(event));
    const colorWrap = document.createElement("span");
    colorWrap.className = "legend-color-wrap";
    const colorInput = document.createElement("input");
    colorInput.className = "legend-color";
    colorInput.type = "color";
    colorInput.value = event.color;
    colorInput.setAttribute("aria-label", `Color for ${event.name}`);
    colorInput.addEventListener("click", (inputEvent) => {
      inputEvent.stopPropagation();
      beginDateEdit(event);
    });
    colorInput.addEventListener("input", () => {
      event.color = colorInput.value;
      saveState();
      applyDateStates();
    });
    colorWrap.append(colorInput);
    const details = document.createElement("span");
    const name = document.createElement("span");
    name.className = "legend-name";
    name.contentEditable = "true";
    name.role = "textbox";
    name.ariaLabel = "Event name";
    name.textContent = event.name;
    name.addEventListener("click", (inputEvent) => {
      inputEvent.stopPropagation();
      beginDateEdit(event);
    });
    name.addEventListener("input", () => {
      event.name = name.textContent.trim() || "Unnamed event";
      saveState();
      if (editingEvent === event) applyDateStates();
    });
    name.addEventListener("blur", () => {
      if (!name.textContent.trim()) name.textContent = event.name;
    });
    name.addEventListener("keydown", (inputEvent) => {
      if (inputEvent.key === "Enter") {
        inputEvent.preventDefault();
        name.blur();
      }
    });
    const range = document.createElement("span");
    range.className = "legend-range";
    range.textContent = formatDateSummary(event.dates);
    details.append(name, range);
    entry.append(colorWrap, details);
    eventLegend.append(entry);
  });
}

function applyDateStates() {
  document.querySelectorAll(".day[data-date]").forEach((cell) => {
    const dateEvents = eventsForDate(cell.dataset.date);
    cell.classList.toggle("selected", selectedDates.has(cell.dataset.date));
    cell.classList.toggle("event", dateEvents.length > 0);
    if (dateEvents.length === 0) {
      cell.style.background = "";
    } else if (dateEvents.length === 1) {
      cell.style.background = dateEvents[0].color;
    } else {
      const stripeCount = dateEvents.length * 3;
      const stripeWidth = 100 / stripeCount;
      const stripes = Array.from({ length: stripeCount }, (_, index) => {
        const color = dateEvents[index % dateEvents.length].color;
        return `${color} ${index * stripeWidth}% ${(index + 1) * stripeWidth}%`;
      });
      cell.style.background = `repeating-linear-gradient(135deg, ${stripes.join(", ")})`;
    }
  });
  document.querySelectorAll(".days").forEach((days) => {
    const cells = [...days.querySelectorAll(".day")];
    cells.forEach((cell, index) => {
      const previous = cells[index - 1];
      const next = cells[index + 1];
      const selected = cell.classList.contains("selected");
      const continuesFromPrevious = selected && previous?.classList.contains("selected") && areConsecutiveDates(previous.dataset.date, cell.dataset.date);
      const continuesToNext = selected && next?.classList.contains("selected") && areConsecutiveDates(cell.dataset.date, next.dataset.date);
      const beginsRun = selected && !continuesFromPrevious;
      const endsRun = selected && !continuesToNext;
      const startsWrappedLine = selected && index % 7 === 0 && continuesFromPrevious;
      const endsWrappedLine = selected && (index + 1) % 7 === 0 && continuesToNext;
      cell.classList.toggle("selected-start", beginsRun);
      cell.classList.toggle("selected-end", endsRun);
      cell.classList.toggle("selected-line-start", startsWrappedLine);
      cell.classList.toggle("selected-line-end", endsWrappedLine);
    });
  });
  const selectedCount = selectedDates.size;
  addEventButton.disabled = editingEvent || selectedCount === 0;
  clearEventsButton.disabled = events.length === 0;
  const mode = editingEvent ? `Editing ${editingEvent.name}` : "";
  const count = selectedCount > 0 ? `${selectedCount} day${selectedCount === 1 ? "" : "s"} selected` : "";
  selectionStatus.textContent = [mode, count].filter(Boolean).join(" / ");
}

function renderEventState() {
  renderLegend();
  applyDateStates();
}

function renderCalendar() {
  const year = validYear();
  const hasTitle = titleElement.textContent.trim().length > 0;
  printButton.disabled = !year || !hasTitle;
  yearElement.classList.toggle("invalid", !year);
  renderLegend();
  if (!year) {
    document.querySelector("#monthColumnOne").replaceChildren();
    document.querySelector("#monthColumnTwo").replaceChildren();
    applyDateStates();
    return;
  }
  document.querySelector("#monthColumnOne").replaceChildren(...monthNames.slice(0, 6).map((_, index) => createMonth(year, index)));
  document.querySelector("#monthColumnTwo").replaceChildren(...monthNames.slice(6).map((_, index) => createMonth(year, index + 6)));
  applyDateStates();
}

function finishSelection() {
  if (!isSelecting) return;
  isSelecting = false;
  if (!didDrag && selectionAnchor) {
    selectedDates.clear();
    selectionBase.forEach((date) => selectedDates.add(date));
    if (selectionBase.has(selectionAnchor)) selectedDates.delete(selectionAnchor);
    else selectedDates.add(selectionAnchor);
  }
  selectionAnchor = null;
  selectionBase = new Set();
  didDrag = false;
  applyDateStates();
}

calendarLayout.addEventListener("pointerdown", (event) => {
  const day = event.target.closest(".day[data-date]");
  if (!day) return;
  event.preventDefault();
  selectionAnchor = day.dataset.date;
  selectionBase = editingEvent || event.shiftKey ? new Set(selectedDates) : new Set();
  isSelecting = true;
  didDrag = false;
});
calendarLayout.addEventListener("pointermove", (event) => {
  if (!isSelecting) return;
  const day = document.elementFromPoint(event.clientX, event.clientY)?.closest(".day[data-date]");
  if (!day) return;
  if (day.dataset.date !== selectionAnchor) didDrag = true;
  if (didDrag) {
    selectedDates.clear();
    const range = datesBetween(selectionAnchor, day.dataset.date);
    const nextDates = editingEvent
      ? toggledDates(selectionBase, range)
      : new Set([...selectionBase, ...range]);
    nextDates.forEach((date) => selectedDates.add(date));
  }
  applyDateStates();
});
window.addEventListener("pointerup", finishSelection);
window.addEventListener("pointercancel", finishSelection);
window.addEventListener("blur", finishSelection);

addEventButton.addEventListener("click", () => {
  if (editingEvent) commitEditingEvent();
  if (selectedDates.size === 0) return;
  const name = window.prompt("Name this event", "");
  if (!name || !name.trim()) return;
  const hue = (events.length * 137.508) % 360;
  events.push({
    name: name.trim(),
    dates: sortedDates(selectedDates),
    color: hslToHex(hue, 45, 78)
  });
  saveState();
  selectedDates.clear();
  renderEventState();
});

function beginDateEdit(event) {
  if (editingEvent === event) return;
  if (editingEvent && editingEvent !== event) commitEditingEvent();
  editingEvent = event;
  selectedDates.clear();
  event.dates.forEach((date) => selectedDates.add(date));
  eventLegend.querySelectorAll(".legend-entry").forEach((entry) => {
    entry.classList.toggle("editing", entry.event === event);
  });
  applyDateStates();
}

function commitEditingEvent() {
  if (!editingEvent) return;
  const eventIndex = events.indexOf(editingEvent);
  if (selectedDates.size > 0) editingEvent.dates = sortedDates(selectedDates);
  else if (eventIndex >= 0) events.splice(eventIndex, 1);
  saveState();
  editingEvent = null;
  selectedDates.clear();
  renderEventState();
}

document.addEventListener("pointerdown", (event) => {
  if (!editingEvent || event.target.closest(".legend-entry, .day[data-date]")) return;
  commitEditingEvent();
});

clearEventsButton.addEventListener("click", () => {
  if (!events.length || !window.confirm("Remove all events?")) return;
  events.length = 0;
  saveState();
  editingEvent = null;
  selectedDates.clear();
  renderEventState();
});

titleElement.addEventListener("input", () => {
  saveState();
  renderCalendar();
});
yearElement.addEventListener("input", () => {
  selectedDates.clear();
  editingEvent = null;
  saveState();
  isSelecting = false;
  renderCalendar();
});
subtitleElement.addEventListener("input", saveState);
[titleElement, yearElement, subtitleElement].forEach((element) => element.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    element.blur();
  }
}));
printButton.addEventListener("click", () => window.print());
paperSizeElement.addEventListener("change", () => {
  saveState();
  applyPaperSize();
});
weekStartElement.addEventListener("change", () => {
  saveState();
  renderCalendar();
});
document.querySelector("#creationDate").textContent = `Created ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
loadState();
applyPaperSize();
renderCalendar();
