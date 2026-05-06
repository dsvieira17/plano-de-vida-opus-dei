const today = new Date();
const dayKey = today.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const weekDayCode = today.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" });
const weekDayIndexMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const weekDayIndex = weekDayIndexMap[weekDayCode] ?? 0;
const weekStartKey = getWeekStartKey(dayKey, weekDayIndex);
const monthKey = dayKey.slice(0, 7);
const yearKey = dayKey.slice(0, 4);
const legacyStorageKey = `plano-de-vida:${dayKey}`;
const notesKey = `plano-de-vida-notas:${dayKey}`;
const planConfigKey = "plano-de-vida-config";
const oldCustomItemsKey = "plano-de-vida-custom-items";
const oldRemovedItemsKey = "plano-de-vida-removed-items";
const oldDailyOrderKey = "plano-de-vida-daily-order";

const stateKeys = {
  daily: `plano-de-vida:daily:${dayKey}`,
  weekly: `plano-de-vida:weekly:${weekStartKey}`,
  monthly: `plano-de-vida:monthly:${monthKey}`,
  yearly: `plano-de-vida:yearly:${yearKey}`
};

const sectionLabels = {
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente"
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
  monthly: document.querySelector("#monthlyList"),
  yearly: document.querySelector("#yearlyList")
};

const currentDate = document.querySelector("#currentDate");
const tomorrowGospelLink = document.querySelector("#tomorrowGospelLink");
const tomorrowGospelDate = document.querySelector("#tomorrowGospelDate");
const dailyMeditationLink = document.querySelector("#dailyMeditationLink");
const dailyMeditationTitle = document.querySelector("#dailyMeditationTitle");
const rosaryOfDayTitle = document.querySelector("#rosaryOfDayTitle");
const rosaryOfDayMysteries = document.querySelector("#rosaryOfDayMysteries");
const rosaryOfDaySteps = document.querySelector("#rosaryOfDaySteps");
const rosaryClosingPrayer = document.querySelector("#rosaryClosingPrayer");
const markRosaryDone = document.querySelector("#markRosaryDone");
const notes = document.querySelector("#notes");
const doneCount = document.querySelector("#doneCount");
const totalCount = document.querySelector("#totalCount");
const percentCount = document.querySelector("#percentCount");
const dailyCount = document.querySelector("#dailyCount");
const clearDay = document.querySelector("#clearDay");
const editPlan = document.querySelector("#editPlan");
const restoreDefaults = document.querySelector("#restoreDefaults");
const addItemForms = Array.from(document.querySelectorAll("[data-add-section]"));

const defaultItems = Object.entries(planItems).flatMap(([section, items]) =>
  items.map((item) => ({ ...item, defaultSection: section }))
);
const defaultItemIds = defaultItems.map((item) => item.id);
const defaultItemsById = Object.fromEntries(defaultItems.map((item) => [item.id, item]));

let planConfig = loadPlanConfig();
const savedBySection = loadSavedStatesBySection();
let isEditing = false;
let pendingSectionChanges = {};

function getWeekStartKey(dateKey, weekdayIndex) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekStart = new Date(Date.UTC(year, month - 1, day - weekdayIndex));
  const weekYear = weekStart.getUTCFullYear();
  const weekMonth = String(weekStart.getUTCMonth() + 1).padStart(2, "0");
  const weekDay = String(weekStart.getUTCDate()).padStart(2, "0");
  return `${weekYear}-${weekMonth}-${weekDay}`;
}

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

function loadRosaryOfDay() {
  if (!rosaryOfDayTitle || !rosaryOfDayMysteries || !rosaryOfDaySteps || !rosaryClosingPrayer) {
    return;
  }

  const weekdayCode = today.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" });
  const rosaryByWeekday = {
    Mon: {
      title: "Mistérios Gozosos",
      mysteries: [
        "Anunciação do anjo a Maria.",
        "Visitação de Maria a Santa Isabel.",
        "Nascimento de Jesus em Belém.",
        "Apresentação de Jesus no Templo.",
        "Perda e encontro do Menino Jesus no Templo."
      ]
    },
    Tue: {
      title: "Mistérios Dolorosos",
      mysteries: [
        "Agonia de Jesus no Horto.",
        "Flagelação de Jesus.",
        "Coroação de espinhos.",
        "Jesus carrega a cruz para o Calvário.",
        "Crucifixão e morte de Jesus."
      ]
    },
    Wed: {
      title: "Mistérios Gloriosos",
      mysteries: [
        "Ressurreição de Jesus.",
        "Ascensão de Jesus ao Céu.",
        "Vinda do Espírito Santo.",
        "Assunção de Nossa Senhora.",
        "Coroação de Maria como Rainha do Céu e da Terra."
      ]
    },
    Thu: {
      title: "Mistérios Luminosos",
      mysteries: [
        "Batismo de Jesus no Jordão.",
        "Autorrevelação de Jesus nas Bodas de Caná.",
        "Anúncio do Reino e convite à conversão.",
        "Transfiguração de Jesus.",
        "Instituição da Eucaristia."
      ]
    },
    Fri: {
      title: "Mistérios Dolorosos",
      mysteries: [
        "Agonia de Jesus no Horto.",
        "Flagelação de Jesus.",
        "Coroação de espinhos.",
        "Jesus carrega a cruz para o Calvário.",
        "Crucifixão e morte de Jesus."
      ]
    },
    Sat: {
      title: "Mistérios Gozosos",
      mysteries: [
        "Anunciação do anjo a Maria.",
        "Visitação de Maria a Santa Isabel.",
        "Nascimento de Jesus em Belém.",
        "Apresentação de Jesus no Templo.",
        "Perda e encontro do Menino Jesus no Templo."
      ]
    },
    Sun: {
      title: "Mistérios Gloriosos",
      mysteries: [
        "Ressurreição de Jesus.",
        "Ascensão de Jesus ao Céu.",
        "Vinda do Espírito Santo.",
        "Assunção de Nossa Senhora.",
        "Coroação de Maria como Rainha do Céu e da Terra."
      ]
    }
  };

  const rosary = rosaryByWeekday[weekdayCode] || rosaryByWeekday.Mon;
  rosaryOfDayTitle.textContent = rosary.title;
  rosaryOfDayMysteries.textContent = "Oração inicial: Oferecimento, Credo, Pai-Nosso, 3 Ave-Marias e Glória.";
  rosaryOfDaySteps.replaceChildren(
    ...rosary.mysteries.map((mystery, index) => {
      const item = document.createElement("li");
      const mysteryLine = document.createElement("span");
      const prayerLine = document.createElement("span");
      mysteryLine.textContent = `${index + 1}º mistério: ${mystery}`;
      prayerLine.textContent = "Pai-Nosso, 10 Ave-Marias e Glória.";
      prayerLine.className = "rosary-step-prayer";
      item.append(mysteryLine, prayerLine);
      return item;
    })
  );
  rosaryClosingPrayer.textContent = "Oração final: Salve Rainha.";
}

function markRosaryAsDone() {
  const rosaryCheckbox = document.querySelector("input[type='checkbox'][data-id='terco']");
  if (!rosaryCheckbox) {
    return;
  }

  const section = rosaryCheckbox.dataset.section || "daily";
  rosaryCheckbox.checked = true;
  rosaryCheckbox.closest("li")?.classList.add("checked");
  saveSectionState(section);
  updateSummary();
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
    monthly: planItems.monthly.map((item) => item.id),
    yearly: planItems.yearly.map((item) => item.id)
  };
}

function normalizeSection(section) {
  if (section === "periodic") {
    return "monthly";
  }

  return Object.prototype.hasOwnProperty.call(sectionLabels, section) ? section : "daily";
}

function getResolvedSectionById(itemId, config) {
  const customItem = config.custom.find((item) => item.id === itemId);

  if (customItem) {
    return normalizeSection(customItem.section);
  }

  if (config.sections[itemId]) {
    return normalizeSection(config.sections[itemId]);
  }

  return defaultItemsById[itemId]?.defaultSection || "daily";
}

function normalizeOrder(order, config) {
  const normalized = createInitialOrder();

  Object.entries(order || {}).forEach(([rawSection, ids]) => {
    if (!Array.isArray(ids)) {
      return;
    }

    const section = normalizeSection(rawSection);

    ids.forEach((id) => {
      const targetSection = rawSection === "periodic" ? getResolvedSectionById(id, config) : section;

      if (!normalized[targetSection].includes(id)) {
        normalized[targetSection].push(id);
      }
    });
  });

  return normalized;
}

function loadSavedStatesBySection() {
  const loaded = Object.fromEntries(
    Object.entries(stateKeys).map(([section, key]) => [section, JSON.parse(localStorage.getItem(key) || "{}")])
  );

  const hasAnySectionState = Object.values(loaded).some((state) => Object.keys(state).length > 0);
  const legacyState = JSON.parse(localStorage.getItem(legacyStorageKey) || "null");

  if (!hasAnySectionState && legacyState) {
    Object.entries(legacyState).forEach(([itemId, checked]) => {
      if (!checked) {
        return;
      }

      const section = getResolvedSectionById(itemId, planConfig);
      loaded[section][itemId] = true;
    });
    Object.entries(stateKeys).forEach(([section, key]) => {
      localStorage.setItem(key, JSON.stringify(loaded[section]));
    });
  }

  return loaded;
}

function loadPlanConfig() {
  const stored = JSON.parse(localStorage.getItem(planConfigKey) || "null");

  if (stored) {
    const baseConfig = {
      removed: stored.removed || [],
      custom: (stored.custom || []).map((item) => ({ ...item, section: normalizeSection(item.section || "daily") })),
      sections: Object.fromEntries(
        Object.entries(stored.sections || {}).map(([id, section]) => [id, normalizeSection(section)])
      )
    };

    return {
      ...baseConfig,
      order: normalizeOrder(stored.order || {}, baseConfig)
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

  const custom = oldCustom.map((item) => ({ ...item, section: normalizeSection(item.section || "daily") }));

  custom.forEach((item) => {
    const section = item.section;
    if (!order[section].includes(item.id)) {
      order[section].push(item.id);
    }
  });

  const migrated = {
    removed: oldRemoved,
    custom,
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
  checkbox.dataset.section = section;
  checkbox.checked = Boolean(savedBySection[section]?.[item.id]);

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
    saveSectionState(section);
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

function saveSectionState(section) {
  const state = {};
  Array.from(lists[section].querySelectorAll("input[type='checkbox']")).forEach((checkbox) => {
    state[checkbox.dataset.id] = checkbox.checked;
  });
  savedBySection[section] = state;
  localStorage.setItem(stateKeys[section], JSON.stringify(state));
}

function saveAllSectionStates() {
  Object.keys(lists).forEach((section) => saveSectionState(section));
}

function updateSummary() {
  const dailyBoxes = Array.from(lists.daily.querySelectorAll("input[type='checkbox']"));
  const dailyDone = dailyBoxes.filter((checkbox) => checkbox.checked).length;
  const percent = dailyBoxes.length ? Math.round((dailyDone / dailyBoxes.length) * 100) : 0;

  doneCount.textContent = String(dailyDone);
  totalCount.textContent = String(dailyBoxes.length);
  percentCount.textContent = `${percent}%`;
  dailyCount.textContent = `${dailyDone}/${dailyBoxes.length}`;
}

function clearToday() {
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.closest("li").classList.remove("checked");
  });

  notes.value = "";
  Object.entries(stateKeys).forEach(([section, key]) => {
    savedBySection[section] = {};
    localStorage.removeItem(key);
  });
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
  Object.keys(savedBySection).forEach((section) => {
    delete savedBySection[section][item.id];
  });
  renderPlan();
  saveAllSectionStates();
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
  const checked = Boolean(savedBySection[currentSection] && savedBySection[currentSection][item.id]);
  if (savedBySection[currentSection]) {
    delete savedBySection[currentSection][item.id];
  }
  if (checked) {
    savedBySection[targetSection][item.id] = true;
  }
  saveSectionState(currentSection);
  saveSectionState(targetSection);
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
loadRosaryOfDay();
notes.value = localStorage.getItem(notesKey) || "";
notes.addEventListener("input", () => localStorage.setItem(notesKey, notes.value));
clearDay.addEventListener("click", clearToday);
editPlan.addEventListener("click", toggleEditMode);
restoreDefaults.addEventListener("click", restoreDefaultItems);
addItemForms.forEach((form) => form.addEventListener("submit", addCustomItem));
if (markRosaryDone) {
  markRosaryDone.addEventListener("click", markRosaryAsDone);
}

renderPlan();
updateSummary();
