import { VOCABULARY } from "./vocabulary.js";

// Estado da Aplicação
let currentMode = "en-pt";
let currentCategory = "all";
let currentWordObj = null;
let activeDirection = "en-pt";
let score = 0;
let streak = 0;
let answered = false;
let reviewList = [];
let answerHistory = [];

// Controle de palavras restantes sem repetição
let availableWordIndices = [];

// Sintetizador com Tone.js
let synth = null;
function getSynth() {
  if (!synth && window.Tone) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.4 },
    }).toDestination();
    synth.volume.value = -6;
  }
  return synth;
}

function playSound(type) {
  try {
    Tone.start();
    const s = getSynth();
    if (type === "correct") {
      const now = Tone.now();
      s.triggerAttackRelease("C5", "16n", now);
      s.triggerAttackRelease("E5", "16n", now + 0.08);
      s.triggerAttackRelease("G5", "8n", now + 0.16);
    } else if (type === "wrong") {
      const now = Tone.now();
      s.triggerAttackRelease("Eb4", "16n", now);
      s.triggerAttackRelease("C4", "8n", now + 0.1);
    }
  } catch (e) {
    console.warn("Audio playback not supported or blocked", e);
  }
}

function speakEnglish(text) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } else {
    showToast("Síntese de voz não suportada neste navegador.", "info");
  }
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-msg");
  const toastIcon = document.getElementById("toast-icon");

  toastMsg.textContent = message;
  if (type === "success") {
    toastIcon.className = "fa-solid fa-circle-check text-emerald-300";
  } else if (type === "error") {
    toastIcon.className = "fa-solid fa-circle-xmark text-rose-300";
  } else {
    toastIcon.className = "fa-solid fa-info-circle text-teal-300";
  }

  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
    toast.classList.remove("translate-y-0", "opacity-100");
  }, 2400);
}

function getFilteredVocabulary() {
  if (currentCategory === "all") return VOCABULARY;
  return VOCABULARY.filter((item) => item.cat === currentCategory);
}

function resetAvailableWords() {
  const pool = getFilteredVocabulary();
  availableWordIndices = pool.map((_, index) => index);
}

function getRandomItems(array, count, excludeItem) {
  const filtered = array.filter((item) => item !== excludeItem);
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function updateStatsUI() {
  document.getElementById("score-count").textContent = score;
}

function addToReview(wordObj) {
  if (!reviewList.some((item) => item.en === wordObj.en)) {
    reviewList.unshift(wordObj);
    updateReviewBadge();
  }
}

function updateReviewBadge() {
  const badge = document.getElementById("review-badge");
  if (reviewList.length > 0) {
    badge.textContent = reviewList.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function renderReviewModal() {
  const listContainer = document.getElementById("review-list-container");
  const emptyMsg = document.getElementById("review-empty-message");

  if (reviewList.length === 0) {
    emptyMsg.classList.remove("hidden");
    listContainer.innerHTML = "";
    listContainer.appendChild(emptyMsg);
    return;
  }

  emptyMsg.classList.add("hidden");
  listContainer.innerHTML = "";

  reviewList.forEach((item, index) => {
    const card = document.createElement("div");
    card.className =
      "p-3 rounded-2xl glass-card flex items-center justify-between gap-3 hover:bg-[#e0f7f5] transition";
    card.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-[#0b4e48]">${item.en}</span>
                    <span class="text-xs text-teal-700/70 font-mono">${item.phonetic}</span>
                </div>
                <p class="text-xs text-teal-800 font-semibold mt-0.5">${item.pt}</p>
                <p class="text-[11px] text-slate-500 italic mt-1">${item.exEn}</p>
            </div>
            <div class="flex items-center gap-1">
                <button class="speak-review-btn w-8 h-8 rounded-full bg-teal-50 text-[#0b4e48] hover:bg-teal-100 flex items-center justify-center transition" title="Ouvir">
                    <i class="fa-solid fa-volume-high text-xs"></i>
                </button>
                <button class="remove-review-btn w-8 h-8 rounded-full text-slate-400 hover:text-rose-500 flex items-center justify-center transition" title="Remover dos erros">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `;

    card
      .querySelector(".speak-review-btn")
      .addEventListener("click", () => speakEnglish(item.en));
    card.querySelector(".remove-review-btn").addEventListener("click", () => {
      reviewList.splice(index, 1);
      updateReviewBadge();
      renderReviewModal();
    });

    listContainer.appendChild(card);
  });
}

function renderHistoryModal() {
  const listContainer = document.getElementById("history-list-container");
  const emptyMsg = document.getElementById("history-empty-message");
  const correctCount = document.getElementById("history-correct-count");
  const wrongCount = document.getElementById("history-wrong-count");
  const correctAnswers = answerHistory.filter(
    (answer) => answer.correct,
  ).length;

  correctCount.textContent = correctAnswers;
  wrongCount.textContent = answerHistory.length - correctAnswers;

  if (answerHistory.length === 0) {
    emptyMsg.classList.remove("hidden");
    listContainer.innerHTML = "";
    listContainer.appendChild(emptyMsg);
    return;
  }

  emptyMsg.classList.add("hidden");
  listContainer.innerHTML = "";

  answerHistory.forEach((answer) => {
    const card = document.createElement("div");
    const statusClass = answer.correct
      ? "border-emerald-200 bg-emerald-50"
      : "border-rose-200 bg-rose-50";
    const statusIcon = answer.correct
      ? "fa-circle-check text-emerald-600"
      : "fa-circle-xmark text-rose-500";
    const statusText = answer.correct ? "Acerto" : "Erro";

    card.className = `p-3 rounded-2xl border flex items-center justify-between gap-3 ${statusClass}`;
    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <i class="fa-solid ${statusIcon} text-lg"></i>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-slate-800">${answer.word.en}</span>
            <span class="text-xs text-slate-500 font-mono">${answer.word.phonetic}</span>
          </div>
          <p class="text-xs text-slate-600 truncate">${answer.word.pt}</p>
          <p class="text-[11px] text-slate-500">${answer.direction}</p>
        </div>
      </div>
      <span class="text-[11px] font-bold ${answer.correct ? "text-emerald-700" : "text-rose-700"}">${statusText}</span>
    `;
    listContainer.appendChild(card);
  });
}

function handleAnswer(selectedBtn, isCorrect) {
  if (answered) return;
  answered = true;

  answerHistory.unshift({
    word: currentWordObj,
    correct: isCorrect,
    direction:
      activeDirection === "en-pt" ? "Inglês → Português" : "Português → Inglês",
  });

  const allButtons = document.querySelectorAll(".option-btn");
  const feedbackPanel = document.getElementById("feedback-panel");
  const feedbackIconContainer = document.getElementById(
    "feedback-icon-container",
  );
  const feedbackIcon = document.getElementById("feedback-icon");
  const feedbackTitle = document.getElementById("feedback-title");
  const feedbackSubtitle = document.getElementById("feedback-subtitle");
  const contextEn = document.getElementById("context-en");
  const contextPt = document.getElementById("context-pt");
  const quizCard = document.getElementById("quiz-card");

  allButtons.forEach((btn) => {
    btn.classList.add("cursor-default");
    const isBtnCorrect = btn.dataset.correct === "true";
    const icon = btn.querySelector(".option-icon");

    if (isBtnCorrect) {
      btn.classList.remove(
        "border-slate-200",
        "hover:border-teal-400",
        "hover:bg-teal-50/50",
        "bg-white",
      );
      btn.classList.add(
        "border-emerald-600",
        "bg-emerald-50",
        "text-emerald-950",
      );
      icon.className =
        "option-icon fa-solid fa-circle-check text-emerald-600 text-base";
    }
  });

  if (isCorrect) {
    playSound("correct");
    score += 10 + streak * 2;
    streak += 1;
    updateStatsUI();

    selectedBtn.classList.add("border-emerald-600", "bg-emerald-50");

    feedbackIconContainer.className =
      "w-9 h-9 rounded-full flex items-center justify-center text-white bg-emerald-600 shadow-md shadow-emerald-200";
    feedbackIcon.className = "fa-solid fa-check";
    feedbackTitle.textContent = "Excelente! Resposta Correta!";
    feedbackTitle.className = "font-bold text-sm text-emerald-900";
    feedbackSubtitle.textContent =
      streak > 2 ? `Parabéns! ${streak} acertos em sequência!` : "Mandou bem!";
  } else {
    playSound("wrong");
    streak = 0;
    updateStatsUI();

    quizCard.classList.add("shake-animation");
    selectedBtn.classList.remove("border-slate-200", "bg-white");
    selectedBtn.classList.add("border-rose-500", "bg-rose-50", "text-rose-900");
    const icon = selectedBtn.querySelector(".option-icon");
    icon.className =
      "option-icon fa-solid fa-circle-xmark text-rose-500 text-base";

    feedbackIconContainer.className =
      "w-9 h-9 rounded-full flex items-center justify-center text-white bg-rose-500 shadow-md shadow-rose-200";
    feedbackIcon.className = "fa-solid fa-xmark";
    feedbackTitle.textContent = "Ops, não foi dessa vez!";
    feedbackTitle.className = "font-bold text-sm text-rose-800";
    feedbackSubtitle.textContent = `A tradução de "${currentWordObj.en}" é "${currentWordObj.pt}".`;

    addToReview(currentWordObj);
  }

  contextEn.textContent = `"${currentWordObj.exEn}"`;
  contextPt.textContent = `"${currentWordObj.exPt}"`;

  speakEnglish(currentWordObj.en);
  feedbackPanel.classList.remove("hidden");
}

function renderCard(wordObj, options, isEnToPt) {
  const quizCard = document.getElementById("quiz-card");
  const promptWord = document.getElementById("prompt-word");
  const subPrompt = document.getElementById("sub-prompt");
  const phonetic = document.getElementById("phonetic-text");
  const directionText = document.getElementById("direction-text");
  const categoryBadge = document.getElementById("category-badge");
  const optionsContainer = document.getElementById("options-container");
  const feedbackPanel = document.getElementById("feedback-panel");
  const btnSpeak = document.getElementById("btn-speak");

  quizCard.classList.remove("pop-card", "shake-animation");
  void quizCard.offsetWidth;
  quizCard.classList.add("pop-card");

  feedbackPanel.classList.add("hidden");

  if (isEnToPt) {
    directionText.innerHTML = `<span class="text-[#0b4e48] font-bold">Inglês</span> ➔ <span class="text-teal-600 font-bold">Português</span>`;
    subPrompt.textContent = "Selecione o significado correto em Português:";
    promptWord.textContent = wordObj.en;
    phonetic.textContent = wordObj.phonetic;
    phonetic.classList.remove("hidden");
    btnSpeak.classList.remove("hidden");
  } else {
    directionText.innerHTML = `<span class="text-teal-600 font-bold">Português</span> ➔ <span class="text-[#0b4e48] font-bold">Inglês</span>`;
    subPrompt.textContent = "Como se diz isso em Inglês?";
    promptWord.textContent = wordObj.pt;
    phonetic.textContent = "";
    phonetic.classList.add("hidden");
    btnSpeak.classList.add("hidden");
  }

  promptWord.dataset.category = wordObj.cat || "default";

  const categoryMap = {
    all: "Geral",
    daily: "Dia a Dia",
    food: "Gastronomia",
    travel: "Viagem",
    tech: "Trabalho & Tech",
    verbs: "Verbos",
    adjectives: "Adjetivos",
    phrasal: "Phrasal Verbs",
    idioms: "Expressões",
    connectors: "Conectores",
    falsefriends: "Falsos Cognatos",
    animals: "Animais",
    weather: "Clima & Natureza",
    home: "Casa & Móveis",
    health: "Saúde & Bem-estar",
    studies: "Estudos & Escola",
    sports: "Esportes",
    emotions: "Emoções & Sentimentos",
    greetings: "Cumprimentos",
    prepositions: "Preposições",
    pronouns: "Pronomes",
    modals: "Modal Verbs",
    jobs: "Profissões",
    places: "Lugares na Cidade",
  };
  categoryBadge.textContent = categoryMap[wordObj.cat] || "Geral";

  optionsContainer.innerHTML = "";
  const keyLetters = ["1", "2", "3", "4"];

  options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.className =
      "option-btn w-full p-4 rounded-2xl border-2 border-teal-100 bg-white hover:border-[#0b4e48] hover:bg-teal-50/50 text-slate-800 font-medium text-left flex items-center justify-between shadow-xs transition duration-150";
    btn.dataset.correct = opt.correct;
    btn.dataset.index = index;

    btn.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-teal-50 text-[#0b4e48] font-mono font-bold text-xs flex items-center justify-center border border-teal-200">${keyLetters[index]}</span>
                <span class="text-sm sm:text-base font-semibold text-slate-800">${opt.text}</span>
            </div>
            <i class="option-icon fa-regular fa-circle text-teal-300 text-sm"></i>
        `;

    btn.addEventListener("click", () => handleAnswer(btn, opt.correct));
    optionsContainer.appendChild(btn);
  });
}

function generateQuestion() {
  answered = false;
  const pool = getFilteredVocabulary();
  if (pool.length === 0) return;

  // Se todas as palavras da categoria já foram usadas, reinicia a lista
  if (availableWordIndices.length === 0) {
    resetAvailableWords();
    showToast(
      "Todas as palavras desta categoria foram vistas! Reiniciando...",
      "info",
    );
  }

  // Sorteia um índice da lista de palavras ainda não vistas e remove-o
  const randomIndexPointer = Math.floor(
    Math.random() * availableWordIndices.length,
  );
  const chosenIndex = availableWordIndices.splice(randomIndexPointer, 1)[0];
  const wordObj = pool[chosenIndex];

  currentWordObj = wordObj;

  if (currentMode === "mixed") {
    activeDirection = Math.random() > 0.5 ? "en-pt" : "pt-en";
  } else {
    activeDirection = currentMode;
  }

  // Gera os 3 distratores a partir do conjunto total da categoria
  const distractors = getRandomItems(pool, 3, wordObj);
  const isEnToPt = activeDirection === "en-pt";
  const correctAnswer = isEnToPt ? wordObj.pt : wordObj.en;
  const rawOptions = [
    { text: correctAnswer, correct: true },
    ...distractors.map((d) => ({
      text: isEnToPt ? d.pt : d.en,
      correct: false,
    })),
  ];

  const options = rawOptions.sort(() => 0.5 - Math.random());
  renderCard(wordObj, options, isEnToPt);
}

document.addEventListener("DOMContentLoaded", () => {
  const modeBtns = {
    "en-pt": document.getElementById("mode-en-pt"),
    "pt-en": document.getElementById("mode-pt-en"),
    mixed: document.getElementById("mode-mixed"),
  };

  function switchMode(newMode) {
    currentMode = newMode;
    Object.keys(modeBtns).forEach((k) => {
      const btn = modeBtns[k];
      if (k === newMode) {
        btn.className =
          "mode-tab flex-1 sm:flex-none px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center justify-center gap-1.5 bg-white text-[#0b4e48] shadow-xs";
      } else {
        btn.className =
          "mode-tab flex-1 sm:flex-none px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-all duration-150 flex items-center justify-center gap-1.5";
      }
    });
    generateQuestion();
  }

  modeBtns["en-pt"].addEventListener("click", () => switchMode("en-pt"));
  modeBtns["pt-en"].addEventListener("click", () => switchMode("pt-en"));
  modeBtns["mixed"].addEventListener("click", () => switchMode("mixed"));

  const categoryFilter = document.getElementById("category-filter");
  categoryFilter.addEventListener("change", (e) => {
    currentCategory = e.target.value;
    resetAvailableWords(); // Reinicia a fila para a nova categoria
    generateQuestion();
  });

  document.getElementById("btn-speak").addEventListener("click", () => {
    if (currentWordObj) {
      speakEnglish(currentWordObj.en);
    }
  });

  document.getElementById("btn-next-word").addEventListener("click", () => {
    generateQuestion();
  });

  window.addEventListener("keydown", (e) => {
    if (["1", "2", "3", "4"].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      const buttons = document.querySelectorAll(".option-btn");
      if (buttons[idx] && !answered) {
        buttons[idx].click();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      if (answered) {
        e.preventDefault();
        generateQuestion();
      }
    }
  });

  const reviewModal = document.getElementById("review-modal");
  const historyModal = document.getElementById("history-modal");
  const openHistoryModal = () => {
    renderHistoryModal();
    historyModal.classList.remove("hidden");
  };
  const closeHistoryModal = () => {
    historyModal.classList.add("hidden");
  };
  document.getElementById("btn-open-review").addEventListener("click", () => {
    renderReviewModal();
    reviewModal.classList.remove("hidden");
  });
  document.getElementById("btn-close-review").addEventListener("click", () => {
    reviewModal.classList.add("hidden");
  });
  document
    .getElementById("btn-modal-close-footer")
    .addEventListener("click", () => {
      reviewModal.classList.add("hidden");
    });
  document.getElementById("btn-clear-review").addEventListener("click", () => {
    reviewList = [];
    updateReviewBadge();
    renderReviewModal();
    showToast("Caderno de erros limpo!", "info");
  });

  document.getElementById("btn-open-history").addEventListener("click", () => {
    openHistoryModal();
  });
  document.getElementById("btn-close-history").addEventListener("click", () => {
    closeHistoryModal();
  });
  document
    .getElementById("btn-history-close-footer")
    .addEventListener("click", () => {
      closeHistoryModal();
    });
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) closeHistoryModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !historyModal.classList.contains("hidden")) {
      closeHistoryModal();
    }
  });
  document.getElementById("btn-clear-history").addEventListener("click", () => {
    answerHistory = [];
    renderHistoryModal();
    showToast("Histórico limpo!", "info");
  });

  resetAvailableWords();
  generateQuestion();
});
