const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const titleElement = document.querySelector("#paperTitle");
const yearElement = document.querySelector("#paperYear");
const subtitleElement = document.querySelector("#paperSubtitle");
const printButton = document.querySelector("#printButton");
const addEventButton = document.querySelector("#addEventButton");
const selectionStatus = document.querySelector("#selectionStatus");
const calendarLayout = document.querySelector("#calendarLayout");
const eventLegend = document.querySelector("#eventLegend");
const events = [];
let selectionStart = null;
let selectionEnd = null;
let isSelecting = false;

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
  dayNames.forEach((dayName) => {
    const cell = document.createElement("span");
    cell.className = "weekday";
    cell.textContent = dayName;
    weekdays.append(cell);
  });
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) {
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

function eventsForDate(date) {
  return events.filter((event) => event.dates.includes(date) && event.start.slice(0, 4) === String(validYear()));
}

function formatRange(start, end) {
  const options = { month: "short", day: "numeric" };
  return `${new Date(`${start}T00:00:00Z`).toLocaleDateString("en-US", options)} - ${new Date(`${end}T00:00:00Z`).toLocaleDateString("en-US", options)}`;
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
  const visibleEvents = events.filter((event) => event.start.slice(0, 4) === String(validYear()));
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
    const colorInput = document.createElement("input");
    colorInput.className = "legend-color";
    colorInput.type = "color";
    colorInput.value = event.color;
    colorInput.style.backgroundColor = event.color;
    colorInput.setAttribute("aria-label", `Color for ${event.name}`);
    colorInput.addEventListener("input", () => {
      event.color = colorInput.value;
      colorInput.style.backgroundColor = event.color;
      applyDateStates();
    });
    const details = document.createElement("span");
    const name = document.createElement("span");
    name.className = "legend-name";
    name.contentEditable = "true";
    name.role = "textbox";
    name.ariaLabel = "Event name";
    name.textContent = event.name;
    name.addEventListener("input", () => {
      event.name = name.textContent.trim() || "Unnamed event";
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
    range.textContent = formatRange(event.start, event.end);
    details.append(name, range);
    entry.append(colorInput, details);
    eventLegend.append(entry);
  });
}

function applyDateStates() {
  const selectedDates = new Set(datesBetween(selectionStart, selectionEnd));
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
      const beginsRun = cell.classList.contains("selected") && (!previous || index % 7 === 0 || !previous.classList.contains("selected"));
      const endsRun = cell.classList.contains("selected") && (!next || (index + 1) % 7 === 0 || !next.classList.contains("selected"));
      cell.classList.toggle("selected-start", beginsRun);
      cell.classList.toggle("selected-end", endsRun);
    });
  });
  const selectedCount = selectedDates.size;
  addEventButton.disabled = selectedCount === 0;
  selectionStatus.textContent = selectedCount > 0 ? `${selectedCount} day${selectedCount === 1 ? "" : "s"} selected` : "";
}

function renderCalendar() {
  const year = validYear();
  const hasTitle = titleElement.textContent.trim().length > 0;
  printButton.disabled = !year || !hasTitle;
  yearElement.classList.toggle("invalid", !year);
  renderLegend();
  if (!year) return;
  document.querySelector("#monthColumnOne").replaceChildren(...monthNames.slice(0, 6).map((_, index) => createMonth(year, index)));
  document.querySelector("#monthColumnTwo").replaceChildren(...monthNames.slice(6).map((_, index) => createMonth(year, index + 6)));
  applyDateStates();
}

function finishSelection() {
  if (!isSelecting) return;
  isSelecting = false;
  applyDateStates();
}

calendarLayout.addEventListener("pointerdown", (event) => {
  const day = event.target.closest(".day[data-date]");
  if (!day) return;
  event.preventDefault();
  selectionStart = day.dataset.date;
  selectionEnd = day.dataset.date;
  isSelecting = true;
  applyDateStates();
});
calendarLayout.addEventListener("pointermove", (event) => {
  if (!isSelecting) return;
  const day = document.elementFromPoint(event.clientX, event.clientY)?.closest(".day[data-date]");
  if (!day) return;
  selectionEnd = day.dataset.date;
  applyDateStates();
});
window.addEventListener("pointerup", finishSelection);
window.addEventListener("pointercancel", finishSelection);
window.addEventListener("blur", finishSelection);

addEventButton.addEventListener("click", () => {
  const name = window.prompt("Name this event", "");
  if (!name || !name.trim()) return;
  const dates = datesBetween(selectionStart, selectionEnd);
  const [start, end] = [selectionStart, selectionEnd].sort();
  const hue = (events.length * 137.508) % 360;
  events.push({
    name: name.trim(),
    start,
    end,
    dates,
    color: hslToHex(hue, 45, 78)
  });
  selectionStart = null;
  selectionEnd = null;
  renderLegend();
  applyDateStates();
});

titleElement.addEventListener("input", renderCalendar);
yearElement.addEventListener("input", () => {
  selectionStart = null;
  selectionEnd = null;
  isSelecting = false;
  renderCalendar();
});
[titleElement, yearElement, subtitleElement].forEach((element) => element.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    element.blur();
  }
}));
printButton.addEventListener("click", () => window.print());
renderCalendar();
