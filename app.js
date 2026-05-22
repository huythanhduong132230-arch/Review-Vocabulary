// Dùng cho GitHub + Supabase + Vercel.
// Dán Project URL và Publishable key của Supabase vào 2 dòng dưới.
const SUPABASE_URL = "https://jkjoaejxixghbeaqnqyp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WqGMTw31uZfAfDnHLaMTrQ_9eklpNKg";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

const state = { user:null, folders:[], words:[], currentFolder:null };
function msg(t){ $("authMsg").textContent=t||""; }
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
function shuffle(a){return [...a].sort(()=>Math.random()-0.5)}
function okConfig(){return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length>20}

async function signIn(){
  if(!okConfig()) return msg("Bạn cần dán SUPABASE_URL và SUPABASE_ANON_KEY đúng trước.");
  const email=$("emailInput").value.trim(), password=$("passwordInput").value;
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error) msg("Lỗi đăng nhập: "+error.message);
}
async function signUp(){
  if(!okConfig()) return msg("Bạn cần dán SUPABASE_URL và SUPABASE_ANON_KEY đúng trước.");
  const email=$("emailInput").value.trim(), password=$("passwordInput").value;
  const {error}=await supabase.auth.signUp({email,password});
  if(error) msg("Lỗi tạo tài khoản: "+error.message); else msg("Đã tạo tài khoản. Nếu Supabase tắt Confirm email thì bấm Đăng nhập luôn.");
}
async function signOut(){ await supabase.auth.signOut(); }

supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null));
async function init(){ const {data}=await supabase.auth.getSession(); setUser(data.session?.user||null); bind(); }
function setUser(user){
  state.user=user;
  $("authView").classList.toggle("hidden",!!user); $("mainView").classList.toggle("hidden",!user); $("logoutBtn").classList.toggle("hidden",!user);
  $("userLine").textContent=user?"👤 "+user.email:"👤 Chưa đăng nhập";
  if(user) loadData();
}
function bind(){
  $("loginBtn").onclick=signIn; $("registerBtn").onclick=signUp; $("logoutBtn").onclick=signOut;
  $("createFolderBtn").onclick=createFolder; $("newFolderInput").onkeydown=e=>{if(e.key==="Enter")createFolder();};
  $("backToFoldersBtn").onclick=showFolderHome; $("deleteFolderBtn").onclick=deleteCurrentFolder;
  $("saveWordBtn").onclick=saveWord; $("clearFormBtn").onclick=clearForm;
  $("startQuizBtn").onclick=startQuiz; $("startBlankBtn").onclick=startBlank; $("newSentenceBtn").onclick=newSentence; $("newFlashcardBtn").onclick=newFlashcard;
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
}
function showTab(name){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  ["vocab","flashcard","quiz","sentence","blank"].forEach(t=>$(t+"Tab").classList.toggle("hidden",t!==name));
}

async function loadData(){
  const {data:folders,error:fErr}=await supabase.from("folders").select("*").eq("user_id",state.user.id).order("created_at",{ascending:false});
  if(fErr){ alert("Lỗi tải folder: "+fErr.message); return; }
  const {data:words,error:wErr}=await supabase.from("words").select("*").eq("user_id",state.user.id).order("created_at",{ascending:false});
  if(wErr){ alert("Lỗi tải dữ liệu: "+wErr.message); return; }
  state.folders=folders||[]; state.words=words||[];
  if(state.currentFolder && !state.folders.find(f=>f.id===state.currentFolder.id)) state.currentFolder=null;
  renderHomeFolders();
  if(state.currentFolder) renderCurrentFolder(); else showFolderHome();
}
function folderWordCount(folderId){ return state.words.filter(w=>w.folder_id===folderId).length; }
function renderHomeFolders(){
  $("totalFolderCount").textContent=state.folders.length+" folder";
  if(!state.folders.length){$("homeFolderList").innerHTML=`<div class="example">Chưa có folder. Nhập tên folder rồi bấm “Thêm folder”.</div>`;return;}
  $("homeFolderList").innerHTML=state.folders.map(f=>`<button class="home-folder-card" data-folder-id="${f.id}"><h3>📁 ${esc(f.name)}</h3><p>${folderWordCount(f.id)} từ vựng</p></button>`).join("");
  document.querySelectorAll("[data-folder-id]").forEach(b=>b.onclick=()=>openFolder(b.dataset.folderId));
}
function showFolderHome(){
  state.currentFolder=null;
  $("folderHomeView").classList.remove("hidden");
  $("folderDetailView").classList.add("hidden");
}
function openFolder(folderId){
  const folder=state.folders.find(f=>f.id===folderId); if(!folder) return;
  state.currentFolder=folder;
  $("folderHomeView").classList.add("hidden");
  $("folderDetailView").classList.remove("hidden");
  showTab("vocab"); renderCurrentFolder();
}
function currentWords(){ return state.currentFolder?state.words.filter(w=>w.folder_id===state.currentFolder.id):[]; }
function renderCurrentFolder(){
  const words=currentWords();
  $("currentFolderTitle").textContent="📁 "+state.currentFolder.name;
  $("currentFolderMeta").textContent=words.length+" từ vựng";
  $("wordCount").textContent=words.length+" từ";
  renderWords();
}
async function createFolder(){
  const name=$("newFolderInput").value.trim(); if(!name) return alert("Bạn nhập tên folder trước.");
  const {data,error}=await supabase.from("folders").insert({user_id:state.user.id,name}).select().single();
  if(error) return alert("Lỗi tạo folder: "+error.message);
  $("newFolderInput").value=""; await loadData(); openFolder(data.id);
}
async function deleteCurrentFolder(){
  if(!state.currentFolder) return;
  if(!confirm("Xoá folder này và toàn bộ từ trong folder?")) return;
  await supabase.from("words").delete().eq("folder_id",state.currentFolder.id).eq("user_id",state.user.id);
  const {error}=await supabase.from("folders").delete().eq("id",state.currentFolder.id).eq("user_id",state.user.id);
  if(error) return alert("Lỗi xoá folder: "+error.message);
  state.currentFolder=null; loadData();
}

function renderWords(){
  const words=currentWords();
  if(!words.length){$("wordList").innerHTML=`<div class="example">Chưa có từ trong folder này.</div>`;return;}
  $("wordList").innerHTML=words.map(w=>`<article class="word-card">
    <div class="word-head"><div><span class="emoji">${esc(w.emoji||"🌸")}</span> <span class="word-en">${esc(w.word)}</span></div><button class="delete-word" data-del="${w.id}">Xoá</button></div>
    <div class="phonetic">${esc(w.phonetic||"")}</div>
    <div class="meaning">${esc(w.meaning)}</div>
    ${w.example?`<div class="example">${esc(w.example)}</div>`:""}
    ${w.example_vi?`<div class="example-vi">${esc(w.example_vi)}</div>`:""}
    <div class="mini-actions"><button data-say="${esc(w.word)}">🔊 Nghe phát âm</button></div>
  </article>`).join("");
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("Xoá từ này?")){await supabase.from("words").delete().eq("id",b.dataset.del);loadData();}});
  document.querySelectorAll("[data-say]").forEach(b=>b.onclick=()=>speak(b.dataset.say));
}
async function fetchPhonetic(word){
  try{const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`); if(!r.ok)return""; const d=await r.json(); return d?.[0]?.phonetic||d?.[0]?.phonetics?.find(p=>p.text)?.text||"";}catch{return"";}
}
async function saveWord(){
  if(!state.currentFolder) return alert("Bạn cần mở folder trước.");
  const word=$("wordInput").value.trim(); const meaning=$("meaningInput").value.trim();
  if(!word||!meaning) return alert("Bạn cần nhập từ tiếng Anh và nghĩa tiếng Việt.");
  let phonetic=$("phoneticInput").value.trim(); if(!phonetic) phonetic=await fetchPhonetic(word);
  const payload={user_id:state.user.id, folder_id:state.currentFolder.id, word, meaning, emoji:$("emojiInput").value.trim()||"🌸", example:$("exampleInput").value.trim(), example_vi:$("exampleViInput").value.trim(), phonetic};
  const {error}=await supabase.from("words").insert(payload);
  if(error) return alert("Lỗi lưu từ: "+error.message+"\nNếu báo thiếu column emoji/example_vi/phonetic, hãy chạy file supabase-update.sql.");
  clearForm(); loadData();
}
function clearForm(){["wordInput","meaningInput","emojiInput","phoneticInput","exampleInput","exampleViInput"].forEach(id=>$(id).value="");}
function speak(text){const u=new SpeechSynthesisUtterance(text);u.lang="en-US";speechSynthesis.speak(u)}
function wordsReady(min=1){ const w=currentWords(); if(w.length<min){alert(`Folder này cần ít nhất ${min} từ.`); return false;} return true; }
function pick(){return shuffle(currentWords())[0]}
function newFlashcard(){ if(!wordsReady())return; const w=pick(); $("flashcardBox").innerHTML=`<div class="emoji">${esc(w.emoji||"🌸")}</div><div class="big-word">${esc(w.word)}</div><div class="phonetic">${esc(w.phonetic||"")}</div><button onclick="document.getElementById('flashAns').classList.toggle('hidden')">Xem nghĩa</button><button onclick="speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance('${esc(w.word)}'),{lang:'en-US'}))">🔊 Nghe</button><div id="flashAns" class="meaning hidden">${esc(w.meaning)}</div>`; }
function startQuiz(){ if(!wordsReady(2))return; const words=currentWords(); const w=pick(); const wrong=shuffle(words.filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.meaning); const choices=shuffle([w.meaning,...wrong]); $("quizBox").innerHTML=`<div class="big-word">${esc(w.word)}</div><div class="choices">${choices.map(c=>`<button data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div><div id="quizResult" class="result"></div>`; document.querySelectorAll("[data-choice]").forEach(b=>b.onclick=()=>{$("quizResult").textContent=b.dataset.choice===w.meaning?"✅ Đúng rồi!":"❌ Chưa đúng. Đáp án: "+w.meaning});}
function startBlank(){ const list=currentWords().filter(w=>w.example); if(!list.length)return alert("Folder này cần có câu ví dụ trước."); const w=shuffle(list)[0]; const re=new RegExp(w.word,"ig"); const blank=w.example.replace(re,"________"); $("blankBox").innerHTML=`<div class="example">${esc(blank)}</div><input id="blankAnswer" class="blank-input" placeholder="Điền từ còn thiếu"/><button id="checkBlankBtn">Kiểm tra</button><div id="blankResult" class="result"></div>`; $("checkBlankBtn").onclick=()=>{$("blankResult").textContent=$("blankAnswer").value.trim().toLowerCase()===w.word.toLowerCase()?"✅ Đúng rồi!":"❌ Đáp án: "+w.word};}
function newSentence(){ const list=currentWords().filter(w=>w.example && w.example.split(/\s+/).length>3); if(!list.length)return alert("Folder này cần câu ví dụ dài hơn để ghép câu."); const w=shuffle(list)[0]; const tokens=shuffle(w.example.replace(/[.!?]/g,"").split(/\s+/)); $("sentenceBox").innerHTML=`<div class="meaning">Nghĩa: ${esc(w.example_vi||w.meaning)}</div><div class="token-wrap">${tokens.map(t=>`<span class="token">${esc(t)}</span>`).join("")}</div><p style="margin-top:16px">Bé đọc các từ rồi tự sắp xếp lại thành câu đúng.</p><div class="example">Đáp án: ${esc(w.example)}</div>`;}

init();
