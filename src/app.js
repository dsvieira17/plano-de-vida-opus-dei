const today = new Date();
const dayKey = today.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const storageKey = `plano-de-vida:${dayKey}`;
const notesKey = `plano-de-vida-notas:${dayKey}`;
const planConfigKey = "plano-de-vida-config";
const oldCustomItemsKey = "plano-de-vida-custom-items";
const oldRemovedItemsKey = "plano-de-vida-removed-items";
const oldDailyOrderKey = "plano-de-vida-daily-order";

const sectionLabels = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  periodic: "Mensal e anual"
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo"
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo"
});

const lists = {
  daily: document.querySelector("#dailyList"),
  weekly: document.querySelector("#weeklyList"),
  periodic: document.querySelector("#periodicList")
};

const currentDate = document.querySelector("#currentDate");
const tomorrowGospelLink = document.querySelector("#tomorrowGospelLink");
const tomorrowGospelDate = document.querySelector("#tomorrowGospelDate");
const dailyMeditationLink = document.querySelector("#dailyMeditationLink");
const dailyMeditationTitle = document.querySelector("#dailyMeditationTitle");
const notes = document.querySelector("#notes");
const doneCount = document.querySelector("#doneCount");
const totalCount = document.querySelector("#totalCount");
const percentCount = document.querySelector("#percentCount");
const dailyCount = document.querySelector("#dailyCount");
const clearDay = document.querySelector("#clearDay");
const editPlan = document.querySelector("#editPlan");
const restoreDefaults = document.querySelector("#restoreDefaults");
const addItemForms = Array.from(document.querySelectorAll("[data-add-section]"));

const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
const defaultItems = Object.entries(planItems).flatMap(([section, items]) =>
  items.map((item) => ({ ...item, defaultSection: section }))
);
const defaultItemIds = defaultItems.map((item) => item.id);

let planConfig = loadPlanConfig();
let isEditing = false;
let pendingSectionChanges = {};

function getTomorrowKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = tomorrow.getUTCFullYear();
  const nextMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(tomorrow.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function stripQuotes(text) {
  return text.replace(/^["']+|["']+$/g, "").trim();
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function parseMeditationFromHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const titleNode = doc.querySelector("h1");
  const title = stripQuotes(normalizeWhitespace(titleNode?.textContent || ""));

  if (!title) {
    return null;
  }

  return {
    title: `"${title}"`
  };
}

function parseMeditationFromPlainText(text) {
  const titleMatch = text.match(/#\s+["']?(.+?)["']?\s*(?:\r?\n|$)/);

  if (!titleMatch) {
    return null;
  }

  return {
    title: `"${stripQuotes(normalizeWhitespace(titleMatch[1]))}"`
  };
}

async function fetchTextWithFallback(url) {
  const directResponse = await fetch(url);

  if (!directResponse.ok) {
    throw new Error(`Failed direct fetch: ${directResponse.status}`);
  }

  return directResponse.text();
}

async function loadDailyMeditation() {
  if (!dailyMeditationLink || !dailyMeditationTitle) {
    return;
  }

  const url = "https://opusdei.org/pt-br/dailytext/";
  dailyMeditationLink.href = url;

  try {
    const htmlText = await fetchTextWithFallback(url);
    const parsed = parseMeditationFromHtml(htmlText);

    if (parsed) {
      dailyMeditationTitle.textContent = parsed.title;
      return;
    }
  } catch (error) {
  }

  try {
    const mirrorUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
    const mirrorResponse = await fetch(mirrorUrl);

    if (!mirrorResponse.ok) {
      throw new Error(`Failed mirror fetch: ${mirrorResponse.status}`);
    }

    const mirrorText = await mirrorResponse.text();
    const parsed = parseMeditationFromPlainText(mirrorText);

    if (parsed) {
      dailyMeditationTitle.textContent = parsed.title;
    }
  } catch (error) {
  }
}

function createInitialOrder() {
  return {
    daily: planItems.daily.map((item) => item.id),
    weekly: planItems.weekly.map((item) => item.id),
    periodic: planItems.periodic.map((item) => item.id)
  };
}

function loadPlanConfig() {
  const stored = JSON.parse(localStorage.getItem(planConfigKey) || "null");

  if (stored) {
    return {
      removed: stored.removed || [],
      custom: stored.custom || [],
      sections: stored.sections || {},
      order: { ...createInitialOrder(), ...(stored.order || {}) }
    };
  }

  return migrateOldConfig();
}

function migrateOldConfig() {
  const oldCustom = JSON.parse(localStorage.getItem(oldCustomItemsKey) || "[]");
  const oldRemoved = JSON.parse(localStorage.getItem(oldRemovedItemsKey) || "[]");
  const oldDailyOrder = JSON.parse(localStorage.getItem(oldDailyOrderKey) || "[]");
  const order = createInitialOrder();

  if (oldDailyOrder.length) {
    order.daily = [
      ...oldDailyOrder.filter((id) => defaultItemIds.includes(id) || oldCustom.some((item) => item.id === id)),
      ...order.daily.filter((id) => !oldDailyOrder.includes(id))
    ];
  }

  oldCustom.forEach((item) => {
    const section = item.section || "daily";
    if (!order[section].includes(item.id)) {
      order[section].push(item.id);
    }
  });

  const migrated = {
    removed: oldRemoved,
    custom: oldCustom,
    sections: {},
    order
  };

  localStorage.setItem(planConfigKey, JSON.stringify(migrated));
  return migrated;
}

function savePlanConfig() {
  localStorage.setItem(planConfigKey, JSON.stringify(planConfig));
}

function getItemSection(item) {
  return item.custom ? item.section : planConfig.sections[item.id] || item.defaultSection;
}

function getAllItems() {
  return [
    ...defaultItems.filter((item) => !planConfig.removed.includes(item.id)),
    ...planConfig.custom
  ];
}

function getVisibleItems(section) {
  const items = getAllItems().filter((item) => getItemSection(item) === section);
  const knownIds = items.map((item) => item.id);
  const order = planConfig.order[section] || [];
  const orderedIds = [
    ...order.filter((id) => knownIds.includes(id)),
    ...knownIds.filter((id) => !order.includes(id))
  ];

  planConfig.order[section] = orderedIds;
  return orderedIds.map((id) => items.find((item) => item.id === id));
}

function createChecklistItem(item, section, index, total) {
  const row = document.createElement("li");
  const itemShell = document.createElement("div");
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const content = document.createElement("span");
  const title = document.createElement("span");
  const note = document.createElement("span");
  const editControls = document.createElement("div");
  const moveUpButton = document.createElement("button");
  const moveDownButton = document.createElement("button");
  const sectionSelect = document.createElement("select");
  const removeButton = document.createElement("button");

  checkbox.type = "checkbox";
  checkbox.dataset.id = item.id;
  checkbox.checked = Boolean(saved[item.id]);

  itemShell.className = "checklist-item";

  title.className = "item-title";
  title.textContent = item.title;

  note.className = "item-note";
  note.textContent = item.note || "";

  editControls.className = section === "daily"
    ? "item-edit-controls has-order-controls edit-only"
    : "item-edit-controls edit-only";

  moveUpButton.type = "button";
  moveUpButton.className = "move-item";
  moveUpButton.textContent = "Subir";
  moveUpButton.disabled = index === 0;
  moveUpButton.addEventListener("click", () => moveItemWithinSection(section, item.id, -1));

  moveDownButton.type = "button";
  moveDownButton.className = "move-item";
  moveDownButton.textContent = "Descer";
  moveDownButton.disabled = index === total - 1;
  moveDownButton.addEventListener("click", () => moveItemWithinSection(section, item.id, 1));

  Object.entries(sectionLabels).forEach(([value, labelText]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelText;
    option.selected = value === section;
    sectionSelect.append(option);
  });

  sectionSelect.className = "section-select";
  sectionSelect.setAttribute("aria-label", `Categoria de ${item.title}`);
  sectionSelect.addEventListener("change", () => {
    pendingSectionChanges[item.id] = sectionSelect.value;
  });

  removeButton.type = "button";
  removeButton.className = "remove-item";
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", () => removeItem(item));

  content.append(title);
  if (item.note) {
    content.append(note);
  }
  label.append(checkbox, content);

  if (section === "daily") {
    editControls.append(moveUpButton, moveDownButton);
  }

  editControls.append(sectionSelect, removeButton);
  itemShell.append(label, editControls);
  row.append(itemShell);
  row.classList.toggle("checked", checkbox.checked);

  checkbox.addEventListener("change", () => {
    row.classList.toggle("checked", checkbox.checked);
    saveState();
    updateSummary();
  });

  return row;
}

function renderPlan() {
  Object.keys(lists).forEach((section) => {
    const items = getVisibleItems(section);
    lists[section].replaceChildren(...items.map((item, index) => createChecklistItem(item, section, index, items.length)));
  });
  savePlanConfig();
}

function getCheckboxes() {
  return Array.from(document.querySelectorAll("input[type='checkbox']"));
}

function saveState() {
  const state = {};
  getCheckboxes().forEach((checkbox) => {
    state[checkbox.dataset.id] = checkbox.checked;
  });
  Object.keys(saved).forEach((id) => delete saved[id]);
  Object.assign(saved, state);
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function updateSummary() {
  const checkboxes = getCheckboxes();
  const checked = checkboxes.filter((checkbox) => checkbox.checked).length;
  const dailyBoxes = Array.from(lists.daily.querySelectorAll("input[type='checkbox']"));
  const dailyDone = dailyBoxes.filter((checkbox) => checkbox.checked).length;
  const percent = checkboxes.length ? Math.round((checked / checkboxes.length) * 100) : 0;

  doneCount.textContent = String(checked);
  totalCount.textContent = String(checkboxes.length);
  percentCount.textContent = `${percent}%`;
  dailyCount.textContent = `${dailyDone}/${dailyBoxes.length}`;
}

function clearToday() {
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.closest("li").classList.remove("checked");
  });

  notes.value = "";
  localStorage.removeItem(storageKey);
  localStorage.removeItem(notesKey);
  updateSummary();
}

function removeFromOrders(itemId) {
  Object.keys(planConfig.order).forEach((section) => {
    planConfig.order[section] = planConfig.order[section].filter((id) => id !== itemId);
  });
}

function removeItem(item) {
  if (item.custom) {
    planConfig.custom = planConfig.custom.filter((customItem) => customItem.id !== item.id);
  } else if (!planConfig.removed.includes(item.id)) {
    planConfig.removed = [...planConfig.removed, item.id];
    delete planConfig.sections[item.id];
  }

  removeFromOrders(item.id);
  delete saved[item.id];
  renderPlan();
  saveState();
  updateSummary();
}

function moveItemWithinSection(section, itemId, direction) {
  const currentOrder = getVisibleItems(section).map((item) => item.id);
  const fromIndex = currentOrder.indexOf(itemId);
  const toIndex = fromIndex + direction;

  if (fromIndex < 0 || toIndex < 0 || toIndex >= currentOrder.length) {
    return;
  }

  const nextOrder = [...currentOrder];
  const [movedItem] = nextOrder.splice(fromIndex, 1);
  nextOrder.splice(toIndex, 0, movedItem);
  planConfig.order[section] = nextOrder;
  renderPlan();
  updateSummary();
}

function moveItemToSection(item, targetSection) {
  const currentSection = getItemSection(item);

  if (currentSection === targetSection) {
    return;
  }

  if (item.custom) {
    planConfig.custom = planConfig.custom.map((customItem) =>
      customItem.id === item.id ? { ...customItem, section: targetSection } : customItem
    );
  } else {
    planConfig.sections[item.id] = targetSection;
  }

  removeFromOrders(item.id);
  planConfig.order[targetSection] = [...(planConfig.order[targetSection] || []), item.id];
  renderPlan();
  updateSummary();
}

function applyPendingSectionChanges() {
  Object.entries(pendingSectionChanges).forEach(([itemId, targetSection]) => {
    const item = getAllItems().find((candidate) => candidate.id === itemId);

    if (!item || getItemSection(item) === targetSection) {
      return;
    }

    moveItemToSection(item, targetSection);
  });

  pendingSectionChanges = {};
}

function addCustomItem(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const section = form.dataset.addSection;
  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!title) {
    return;
  }

  const id = `custom-${Date.now()}`;

  planConfig.custom = [
    ...planConfig.custom,
    {
      id,
      section,
      title,
      note,
      custom: true
    }
  ];
  planConfig.order[section] = [...(planConfig.order[section] || []), id];

  form.reset();
  renderPlan();
  updateSummary();
}

function restoreDefaultItems() {
  planConfig.removed = [];
  planConfig.sections = {};
  planConfig.order = createInitialOrder();

  planConfig.custom.forEach((item) => {
    if (!planConfig.order[item.section].includes(item.id)) {
      planConfig.order[item.section].push(item.id);
    }
  });

  renderPlan();
  updateSummary();
}

function toggleEditMode() {
  if (isEditing) {
    applyPendingSectionChanges();
  } else {
    pendingSectionChanges = {};
  }

  isEditing = !isEditing;
  document.body.classList.toggle("is-editing", isEditing);
  editPlan.textContent = isEditing ? "Concluir edicao" : "Editar";
  editPlan.setAttribute("aria-pressed", String(isEditing));
}

currentDate.textContent = dateFormatter.format(today);

if (tomorrowGospelLink && tomorrowGospelDate) {
  const tomorrowKey = getTomorrowKey(dayKey);
  const tomorrowDate = new Date(`${tomorrowKey}T12:00:00`);
  tomorrowGospelLink.href = `https://evangelhoquotidiano.org/PT/gospel/${tomorrowKey}`;
  tomorrowGospelDate.textContent = `Leitura de ${shortDateFormatter.format(tomorrowDate)}.`;
}

loadDailyMeditation();
notes.value = localStorage.getItem(notesKey) || "";
notes.addEventListener("input", () => localStorage.setItem(notesKey, notes.value));
clearDay.addEventListener("click", clearToday);
editPlan.addEventListener("click", toggleEditMode);
restoreDefaults.addEventListener("click", restoreDefaultItems);
addItemForms.forEach((form) => form.addEventListener("submit", addCustomItem));

renderPlan();
updateSummary();
