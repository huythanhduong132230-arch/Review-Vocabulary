// Dùng cho GitHub + Supabase + Vercel.
// Vào Supabase > Project Settings > API, copy Project URL và anon public key dán vào đây.
const SUPABASE_URL = "https://jkjoaejxixghbeaqnqyp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WqGMTw31uZfAfDnHLaMTrQ_9eklpNKg";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  folders: [],
  wordsByFolder: {},
  currentFolderId: null,
  allWords: [],
  quiz: null,
  blank: null,
  channel: null
};

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function showMsg(text) { $("authMsg").textContent = text || ""; }

function checkConfig() {
  const ok = SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
  if (!ok) showMsg("Bạn cần dán SUPABASE_URL và SUPABASE_ANON_KEY trong app.js trước khi dùng.");
  return ok;
}

async function fetchPhonetic(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`);
    if (!res.ok) return "";
    const data = await res.json();
    return data?.[0]?.phonetic || data?.[0]?.phonetics?.find(x => x.text)?.text || "";
  } catch { return ""; }
}

function speak(word) {
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
window.speakWord = speak;

$("loginBtn").onclick = async () => {
  if (!checkConfig()) return;
  showMsg("");
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) showMsg("Không đăng nhập được: " + error.message);
};

$("registerBtn").onclick = async () => {
  if (!checkConfig()) return;
  showMsg("");
  const email = $("emailInput").value.trim();
  const password = $("passwordInput").value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) showMsg("Không tạo được tài khoản: " + error.message);
  else showMsg("Đã tạo tài khoản. Nếu Supabase yêu cầu xác nhận email, hãy vào email bấm xác nhận rồi đăng nhập.");
};

$("logoutBtn").onclick = async () => {
  await supabase.auth.signOut();
};

supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user || null);
});

async function init() {
  checkConfig();
  const { data } = await supabase.auth.getSession();
  setUser(data?.session?.user || null);
}
init();

async function setUser(user) {
  state.user = user;
  $("authView").classList.toggle("hidden", !!user);
  $("mainView").classList.toggle("hidden", !user);
  $("logoutBtn").classList.toggle("hidden", !user);
  $("userLine").textContent = user ? `👤 ${user.email}` : "👤 Chưa đăng nhập";

  if (state.channel) {
    await supabase.removeChannel(state.channel);
    state.channel = null;
  }
  state.folders = [];
  state.wordsByFolder = {};
  state.allWords = [];
  state.currentFolderId = null;
  renderFolders();
  renderWords();

  if (user) {
    await loadAllData();
    subscribeRealtime();
  }
}

async function loadAllData() {
  const { data: folders, error: fError } = await supabase
    .from("folders")
    .select("*")
    .order("created_at", { ascending: false });
  if (fError) return alert("Lỗi tải folder: " + fError.message);

  const { data: words, error: wError } = await supabase
    .from("words")
    .select("*")
    .order("created_at", { ascending: false });
  if (wError) return alert("Lỗi tải từ vựng: " + wError.message);

  state.folders = folders || [];
  state.wordsByFolder = {};
  (words || []).forEach(w => {
    if (!state.wordsByFolder[w.folder_id]) state.wordsByFolder[w.folder_id] = [];
    state.wordsByFolder[w.folder_id].push(w);
  });
  refreshAllWords();
  renderFolders();
  renderWords();
}

function subscribeRealtime() {
  state.channel = supabase
    .channel("butbi-vocab-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, loadAllData)
    .on("postgres_changes", { event: "*", schema: "public", table: "words" }, loadAllData)
    .subscribe();
}

function refreshAllWords() {
  state.allWords = Object.values(state.wordsByFolder).flat();
}

$("addFolderBtn").onclick = async () => {
  const name = $("folderName").value.trim();
  if (!name) return;
  const { error } = await supabase.from("folders").insert({ name, user_id: state.user.id });
  if (error) return alert("Không tạo được folder: " + error.message);
  $("folderName").value = "";
  await loadAllData();
};

$("deleteFolderBtn").onclick = async () => {
  if (!state.currentFolderId || !confirm("Xoá folder này và toàn bộ từ bên trong?")) return;
  const { error } = await supabase.from("folders").delete().eq("id", state.currentFolderId);
  if (error) return alert("Không xoá được folder: " + error.message);
  state.currentFolderId = null;
  $("wordsCard").classList.add("hidden");
  await loadAllData();
};

$("addWordBtn").onclick = async () => {
  const word = $("wordInput").value.trim();
  const meaning = $("meaningInput").value.trim();
  const example = $("exampleInput").value.trim();
  if (!state.currentFolderId || !word || !meaning) return alert("Cần chọn folder, nhập từ vựng và nghĩa.");
  const phonetic = await fetchPhonetic(word);
  const { error } = await supabase.from("words").insert({
    user_id: state.user.id,
    folder_id: state.currentFolderId,
    word,
    meaning,
    example,
    phonetic
  });
  if (error) return alert("Không thêm được từ: " + error.message);
  $("wordInput").value = "";
  $("meaningInput").value = "";
  $("exampleInput").value = "";
  await loadAllData();
};

function renderFolders() {
  const box = $("folderList");
  if (!box) return;
  box.innerHTML = state.folders.map(f => `
    <div class="folder-item ${f.id === state.currentFolderId ? "active" : ""}" data-id="${f.id}">
      📁 ${escapeHtml(f.name)}
      <span class="folder-count">${(state.wordsByFolder[f.id] || []).length} từ</span>
    </div>
  `).join("") || '<p class="muted">Chưa có folder.</p>';

  document.querySelectorAll(".folder-item").forEach(el => {
    el.onclick = () => {
      state.currentFolderId = el.dataset.id;
      $("wordsCard").classList.remove("hidden");
      renderFolders();
      renderWords();
    };
  });
}

function renderWords() {
  if (!state.currentFolderId) return;
  const folder = state.folders.find(f => f.id === state.currentFolderId);
  $("currentFolderTitle").textContent = `📘 ${folder?.name || "Từ vựng"}`;
  const words = state.wordsByFolder[state.currentFolderId] || [];
  $("wordList").innerHTML = words.map(w => `
    <div class="word-card">
      <div class="word-head">
        <div>
          <div class="word-title">${escapeHtml(w.word)} <span class="phonetic">${escapeHtml(w.phonetic || "")}</span></div>
          <div class="meaning">${escapeHtml(w.meaning)}</div>
        </div>
        <div class="mini-actions">
          <button data-say="${escapeHtml(w.word)}">🔊 Nghe</button>
          <button class="danger" data-del="${w.id}">Xoá</button>
        </div>
      </div>
      ${w.example ? `<div class="example">${escapeHtml(w.example)}</div>` : ""}
    </div>
  `).join("") || '<p class="muted">Chưa có từ vựng trong folder này.</p>';

  document.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    const { error } = await supabase.from("words").delete().eq("id", b.dataset.del);
    if (error) return alert("Không xoá được từ: " + error.message);
    await loadAllData();
  });
}

document.querySelectorAll(".tab").forEach(btn => btn.onclick = () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
  $(`${btn.dataset.tab}Tab`).classList.remove("hidden");
});

$("startQuizBtn").onclick = () => {
  const words = shuffle(state.allWords).filter(w => w.word && w.meaning);
  if (words.length < 2) return $("quizBox").innerHTML = '<p class="muted">Cần ít nhất 2 từ để tạo quiz.</p>';
  state.quiz = { words, index: 0, score: 0 };
  renderQuiz();
};

function renderQuiz() {
  const q = state.quiz;
  const w = q.words[q.index];
  const options = shuffle([w.meaning, ...shuffle(q.words.filter(x => x.id !== w.id)).slice(0, 3).map(x => x.meaning)]);
  $("quizBox").innerHTML = `
    <div class="question">${escapeHtml(w.word)} <button onclick="speakWord('${escapeHtml(w.word)}')">🔊</button></div>
    <div class="options">${options.map(o => `<button class="option" data-answer="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join("")}</div>
    <div class="score">Câu ${q.index + 1}/${q.words.length} • Đúng ${q.score}</div>
  `;
  document.querySelectorAll("[data-answer]").forEach(b => b.onclick = () => {
    const ok = b.dataset.answer === w.meaning;
    b.classList.add(ok ? "ok" : "bad");
    if (ok) q.score++;
    setTimeout(() => {
      q.index++;
      if (q.index >= q.words.length) {
        $("quizBox").innerHTML = `<div class="question">Hoàn thành 🎉</div><div class="score">Bé đúng ${q.score}/${q.words.length} câu.</div>`;
      } else renderQuiz();
    }, 650);
  });
}

$("startBlankBtn").onclick = () => {
  const words = shuffle(state.allWords).filter(w => w.word && w.example);
  if (!words.length) return $("blankBox").innerHTML = '<p class="muted">Cần có từ vựng kèm câu ví dụ.</p>';
  const w = words[0];
  const re = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig");
  const blank = w.example.replace(re, "______");
  state.blank = w;
  $("blankBox").innerHTML = `
    <div class="blank-sentence">${escapeHtml(blank)}</div>
    <div class="answer-line"><input id="blankAnswer" placeholder="Bé điền từ vào đây"/><button id="checkBlankBtn">Kiểm tra</button></div>
    <div id="blankResult" class="score"></div>
  `;
  $("checkBlankBtn").onclick = () => {
    const ans = $("blankAnswer").value.trim().toLowerCase();
    $("blankResult").textContent = ans === w.word.toLowerCase()
      ? `Đúng rồi 🎉 ${w.word} ${w.phonetic || ""} = ${w.meaning}`
      : `Chưa đúng. Đáp án: ${w.word} = ${w.meaning}`;
  };
};
