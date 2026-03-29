const unskilledToggle = document.querySelector("#unskilled-toggle");
const emphasisToggle = document.querySelector("#emphasis-toggle");
const voiceButton = document.querySelector("#voice-btn");
const voiceStatusEl = document.querySelector("#voice-status");
const tabRollButton = document.querySelector("#tab-roll");
const tabNotesButton = document.querySelector("#tab-notes");
const rollPanel = document.querySelector("#panel-roll");
const notesPanel = document.querySelector("#panel-notes");
const userNameInput = document.querySelector("#user-name");
const notesField = document.querySelector("#notes-field");
const notesStatusEl = document.querySelector("#notes-status");

const notationEl = document.querySelector("#notation");
const totalEl = document.querySelector("#total");
const hintEl = document.querySelector("#hint");
const diceListEl = document.querySelector("#dice-list");

const NOTES_USER_KEY = "l5r.notes.activeUser";
const NOTES_PREFIX = "l5r.notes.user.";

const rollState = {
  rolled: 5,
  kept: 3,
  hasVoiceCommand: false,
};

const notesState = {
  activeUser: "",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function randomDie() {
  if (window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(1);
    window.crypto.getRandomValues(bytes);
    return (bytes[0] % 10) + 1;
  }

  return Math.floor(Math.random() * 10) + 1;
}

function rollOneDie({ explodingEnabled, emphasisEnabled }) {
  const chain = [];
  const explosionChain = [];
  let loops = 0;

  const firstRoll = randomDie();
  let baseValue = firstRoll;

  if (emphasisEnabled && firstRoll === 1) {
    const reroll = randomDie();
    baseValue = reroll;
    chain.push(`${firstRoll} -> ${reroll}`);
  } else {
    chain.push(String(baseValue));
  }

  let subtotal = baseValue;

  while (explodingEnabled && baseValue === 10 && loops <= 100) {
    const extraRoll = randomDie();
    explosionChain.push(extraRoll);
    subtotal += extraRoll;
    baseValue = extraRoll;
    loops += 1;
  }

  if (explosionChain.length > 0) {
    chain.push(...explosionChain.map((value) => String(value)));
  }

  return {
    chain,
    total: subtotal,
    kept: false,
  };
}

function sanitizeInputs() {
  const rolled = clamp(safeInt(rollState.rolled, 5), 1, 20);
  const kept = clamp(safeInt(rollState.kept, 3), 1, rolled);

  rollState.rolled = rolled;
  rollState.kept = kept;

  notationEl.textContent = rollState.hasVoiceCommand ? `Notacion: ${rolled}k${kept}` : "";
  return { rolled, kept };
}

function normalizeUserName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function notesStorageKey(userName) {
  return `${NOTES_PREFIX}${userName.toLowerCase()}`;
}

function setActiveTab(tabName) {
  const showRoll = tabName === "roll";

  tabRollButton.classList.toggle("active", showRoll);
  tabNotesButton.classList.toggle("active", !showRoll);
  rollPanel.classList.toggle("active", showRoll);
  notesPanel.classList.toggle("active", !showRoll);
}

function updateNotesStatus(message) {
  notesStatusEl.textContent = message;
}

function loadNotesForUser(userName) {
  const safeUserName = normalizeUserName(userName);

  if (!safeUserName) {
    notesState.activeUser = "";
    notesField.value = "";
    notesField.disabled = true;
    localStorage.removeItem(NOTES_USER_KEY);
    updateNotesStatus("Escribe un nombre para cargar tus notas.");
    return;
  }

  notesState.activeUser = safeUserName;
  localStorage.setItem(NOTES_USER_KEY, safeUserName);
  notesField.disabled = false;
  notesField.value = localStorage.getItem(notesStorageKey(safeUserName)) || "";
  updateNotesStatus(`Notas cargadas para ${safeUserName}.`);
}

function saveNotesForUser() {
  if (!notesState.activeUser) {
    updateNotesStatus("Escribe un nombre de usuario antes de guardar notas.");
    return;
  }

  localStorage.setItem(notesStorageKey(notesState.activeUser), notesField.value);
  updateNotesStatus(`Notas guardadas para ${notesState.activeUser}.`);
}

function setupNotes() {
  notesField.disabled = true;

  const savedUser = localStorage.getItem(NOTES_USER_KEY) || "";
  if (savedUser) {
    userNameInput.value = savedUser;
    loadNotesForUser(savedUser);
  }

  userNameInput.addEventListener("change", () => {
    loadNotesForUser(userNameInput.value);
  });

  userNameInput.addEventListener("blur", () => {
    loadNotesForUser(userNameInput.value);
  });

  notesField.addEventListener("input", saveNotesForUser);
}

function renderDice(dice) {
  diceListEl.innerHTML = "";

  dice.forEach((die, index) => {
    const row = document.createElement("div");
    row.className = `die${die.kept ? " keep" : ""}`;

    const label = document.createElement("div");
    label.textContent = `Dado ${index + 1}: ${die.chain.join(" + ")}`;

    const right = document.createElement("div");
    right.className = "die-total";
    right.textContent = `= ${die.total}`;

    const chip = document.createElement("span");
    chip.className = `chip ${die.kept ? "keep" : "drop"}`;
    chip.textContent = die.kept ? "guardado" : "descartado";

    row.append(label, right, chip);
    diceListEl.append(row);
  });
}

function speakRollResult(total, rolled, kept) {
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    return;
  }

  const message = `Resultado ${rolled} k ${kept}. Total ${total}.`;
  const utterance = new window.SpeechSynthesisUtterance(message);
  utterance.lang = "es-ES";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function rollPool() {
  const { rolled, kept } = sanitizeInputs();
  const explodingEnabled = !unskilledToggle.checked;
  const emphasisEnabled = emphasisToggle.checked;

  const dice = Array.from({ length: rolled }, () =>
    rollOneDie({ explodingEnabled, emphasisEnabled })
  );

  const sorted = [...dice]
    .map((die, index) => ({ index, total: die.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, kept);

  const keptIndexes = new Set(sorted.map((die) => die.index));
  let keptTotal = 0;

  dice.forEach((die, index) => {
    die.kept = keptIndexes.has(index);
    if (die.kept) {
      keptTotal += die.total;
    }
  });

  totalEl.textContent = `Total guardado: ${keptTotal}`;
  hintEl.textContent = "";

  renderDice(dice);
  speakRollResult(keptTotal, rolled, kept);
}

function parseVoiceCommand(text) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9k\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const numberWords = {
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veinte: 20,
  };

  function parseToken(token) {
    if (!token) {
      return null;
    }

    if (/^\d{1,2}$/.test(token)) {
      return Number.parseInt(token, 10);
    }

    return Object.prototype.hasOwnProperty.call(numberWords, token) ? numberWords[token] : null;
  }

  const tokenPattern =
    "(\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)";

  const kWords = normalized.match(new RegExp(`${tokenPattern}\\s*k\\s*${tokenPattern}`));
  if (kWords) {
    const rolled = parseToken(kWords[1]);
    const kept = parseToken(kWords[2]);

    if (rolled !== null && kept !== null) {
      return { rolled, kept };
    }
  }

  const kNotation = normalized.match(/(\d{1,2})\s*k\s*(\d{1,2})/i);
  if (kNotation) {
    return {
      rolled: Number.parseInt(kNotation[1], 10),
      kept: Number.parseInt(kNotation[2], 10),
    };
  }

  const rollThenKeep = normalized.match(
    new RegExp(
      `(?:lanza|lanzar|tira|tirar)\\s*${tokenPattern}.*?(?:guarda|guardar|quedate|quedate con)\\s*${tokenPattern}`
    )
  );

  if (rollThenKeep) {
    const rolled = parseToken(rollThenKeep[1]);
    const kept = parseToken(rollThenKeep[2]);

    if (rolled !== null && kept !== null) {
      return { rolled, kept };
    }
  }

  const simpleNumbers = normalized.match(
    /(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)/g
  );
  if (simpleNumbers && simpleNumbers.length >= 2) {
    const rolled = parseToken(simpleNumbers[0]);
    const kept = parseToken(simpleNumbers[1]);

    if (rolled !== null && kept !== null) {
      return { rolled, kept };
    }
  }

  return null;
}

function applyVoiceCommand(text) {
  const parsed = parseVoiceCommand(text);
  if (!parsed) {
    voiceStatusEl.textContent = `No entendi: "${text}". Prueba: "lanza 7 dados guarda 4 dados".`;
    return;
  }

  const rolled = clamp(parsed.rolled, 1, 20);
  const kept = clamp(parsed.kept, 1, rolled);
  rollState.rolled = rolled;
  rollState.kept = kept;
  rollState.hasVoiceCommand = true;
  sanitizeInputs();
  voiceStatusEl.textContent = `Comando reconocido: ${rolled}k${kept}.`;
  rollPool();
}

function extractTranscript(event) {
  if (!event.results || !event.results[0] || !event.results[0][0]) {
    return "";
  }

  return event.results[0][0].transcript || "";
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    voiceStatusEl.textContent = "Este navegador no soporta reconocimiento de voz web.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  function updateListening(nextState) {
    listening = nextState;
    voiceButton.classList.toggle("listening", listening);
    voiceButton.textContent = listening ? "Escuchando..." : "Hablar comando";
  }

  voiceButton.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      updateListening(false);
      return;
    }

    try {
      recognition.start();
      updateListening(true);
      voiceStatusEl.textContent = "Habla ahora: lanza X dados guarda Y dados.";
    } catch (error) {
      voiceStatusEl.textContent = "No se pudo iniciar el microfono. Revisa permisos.";
      updateListening(false);
    }
  });

  recognition.addEventListener("result", (event) => {
    const transcript = extractTranscript(event);

    if (!transcript) {
      voiceStatusEl.textContent = "No se recibio texto del reconocimiento de voz.";
      return;
    }

    applyVoiceCommand(transcript);
  });

  recognition.addEventListener("error", (event) => {
    if (event.error === "not-allowed") {
      voiceStatusEl.textContent = "Permiso de microfono denegado. Habilitalo para usar voz.";
    } else if (event.error === "no-speech") {
      voiceStatusEl.textContent = "No se detecto voz. Intentalo de nuevo.";
    } else {
      voiceStatusEl.textContent = `Error de voz: ${event.error}.`;
    }
  });

  recognition.addEventListener("end", () => {
    updateListening(false);
  });
}

function setupTabs() {
  tabRollButton.addEventListener("click", () => {
    setActiveTab("roll");
  });

  tabNotesButton.addEventListener("click", () => {
    setActiveTab("notes");
  });
}

sanitizeInputs();
setupTabs();
setupNotes();
setupVoiceRecognition();
