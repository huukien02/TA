// ===== TIỆN ÍCH =====
const $ = (id) => document.getElementById(id);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr, n) => shuffle(arr).slice(0, n);
const toTen = (score, total) => Math.round((score / total) * 100) / 10;

// localStorage có thể bị chặn (chế độ ẩn danh...) nên luôn bọc try/catch
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(" – ", ", "));
  u.lang = "en-US";
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// Lời bạn Cú nói sau mỗi câu
const CHEERS = ["🎉 Giỏi quá!", "🌟 Tuyệt vời!", "👏 Đúng rồi, hay lắm!", "🚀 Xuất sắc!", "💯 Chính xác!"];
const ENCOURAGE = ["🤗 Không sao, lần sau sẽ đúng!", "💪 Cố lên nào!", "🧐 Gần đúng rồi đó!", "📖 Cùng xem lại nhé!"];

// Pháo giấy rơi khi được điểm cao
function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const pieces = ["🎉", "⭐", "🎈", "✨", "🌟", "🍬"];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    el.textContent = pieces[i % pieces.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDuration = 2 + Math.random() * 2 + "s";
    el.style.animationDelay = Math.random() * 0.8 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

// ===== NGÂN HÀNG CÂU HỎI =====
// Mọi câu hỏi có dạng { type: "mcq" | "order", key, topic, q, ... }; key dùng để lưu câu sai
function vocabQuestions(topic) {
  return topic.words.map((w) => {
    const others = pick(topic.words.filter((x) => x !== w), 3).map((x) => x[0]);
    const options = shuffle([w[0], ...others]);
    return {
      type: "mcq", key: "vocab:" + w[0], topic: topic.name,
      q: `"${w[1]}" trong tiếng Anh là gì?`,
      options, answer: options.indexOf(w[0]),
      explain: `${w[0]} = ${w[1]}. Ví dụ: ${w[3]}`,
    };
  });
}

function grammarQuestions(topic) {
  return topic.questions.map(([q, options, answer, explain]) => ({
    type: "mcq", key: "grammar:" + q, topic: topic.name, q, options, answer, explain,
  }));
}

function orderQuestions(topic) {
  return topic.sentences.map(([sentence, vi]) => ({
    type: "order", key: "order:" + sentence, topic: topic.name,
    q: "Sắp xếp các từ thành câu đúng:",
    words: sentence.split(" "), answer: sentence, explain: `Nghĩa: ${vi}`,
  }));
}

function oddQuestions() {
  // Trộn vị trí đáp án vì trong dữ liệu từ khác loại hay nằm ở cuối
  return ODD_ONE_OUT.map(([words, answer, explain]) => {
    const options = shuffle(words);
    return {
      type: "mcq", key: "odd:" + [...words].sort().join(","), topic: "Từ khác loại",
      q: "Chọn từ khác loại với các từ còn lại:", options, answer: options.indexOf(words[answer]), explain,
    };
  });
}

function readingQuestions(reading) {
  return reading.questions.map(([statement, isTrue, explain]) => ({
    type: "mcq", key: "read:" + statement, topic: "Đọc hiểu",
    passageTitle: reading.title, passage: reading.text,
    q: `${statement} <span class="text-body-secondary fw-normal">(Đúng hay Sai?)</span>`,
    options: ["True – Đúng", "False – Sai"], answer: isTrue ? 0 : 1, explain,
  }));
}

const allGrammar = () => TOPICS.flatMap(grammarQuestions);
const allVocab = () => TOPICS.flatMap(vocabQuestions);
const allOrder = () => TOPICS.flatMap(orderQuestions);

// ===== CHUYỂN TAB =====
const tabButtons = document.querySelectorAll("#tabs .nav-link");
tabButtons.forEach((btn) => {
  btn.onclick = () => {
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("d-none", s.id !== "tab-" + btn.dataset.tab));
    window.speechSynthesis?.cancel();
    ({ quiz: showQuizPick, types: showTypesPick, test: showTestStart, mistakes: renderMistakes })[btn.dataset.tab]?.();
  };
});

// ===== FLASHCARD =====
let flashCards = [], flashIdx = 0;
TOPICS.forEach((t, i) => $("flash-topic").add(new Option(`${t.icon} ${t.name}`, i)));

function loadFlash() {
  flashCards = [...TOPICS[$("flash-topic").value].words];
  flashIdx = 0;
  showFlash();
}
function showFlash() {
  const [en, vi, emoji, ex] = flashCards[flashIdx];
  $("flash").classList.remove("flipped");
  $("f-emoji").textContent = emoji;
  $("f-word").textContent = en;
  $("f-vi").textContent = vi;
  $("f-ex").textContent = ex;
  $("flash-count").textContent = `${flashIdx + 1} / ${flashCards.length}`;
}
$("flash-topic").onchange = loadFlash;
$("flash").onclick = () => $("flash").classList.toggle("flipped");
$("f-next").onclick = () => { flashIdx = (flashIdx + 1) % flashCards.length; showFlash(); };
$("f-prev").onclick = () => { flashIdx = (flashIdx - 1 + flashCards.length) % flashCards.length; showFlash(); };
$("f-shuffle").onclick = () => { flashCards = shuffle(flashCards); flashIdx = 0; showFlash(); };
$("f-speak").onclick = () => speak(flashCards[flashIdx][0]);
loadFlash();

// ===== BỘ CHẠY BÀI LÀM DÙNG CHUNG =====
// instant = true: chấm và giải thích ngay sau mỗi câu (luyện tập)
// instant = false: làm hết rồi mới xem kết quả (kiểm tra)
// onComplete(điểm) gọi khi làm xong; onBack gọi khi bấm nút quay lại
function runQuiz(container, questions, { instant, onComplete, onBack }) {
  let idx = 0, score = 0;
  const wrong = [];

  function render() {
    const item = questions[idx];
    container.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between small text-body-secondary">
            <span>Câu ${idx + 1} / ${questions.length}</span><span>${item.topic}</span>
          </div>
          <div class="progress my-2" style="height: 8px">
            <div class="progress-bar" style="width: ${(idx / questions.length) * 100}%"></div>
          </div>
          ${item.passage ? `
            <div class="passage bg-body-tertiary border rounded p-3 my-3">
              <div class="fw-bold mb-1">📖 ${item.passageTitle}</div>${item.passage}
            </div>` : ""}
          <div class="q-text my-3">${item.q}</div>
          <div id="q-body"></div>
          <div id="q-feedback"></div>
        </div>
      </div>`;
    item.type === "order" ? renderOrder(item) : renderMcq(item);
  }

  function renderMcq(item) {
    $("q-body").innerHTML = `<div class="d-grid gap-2">${item.options
      .map((o, i) => `<button class="btn btn-outline-secondary text-start opt" data-i="${i}">${"ABCD"[i]}. ${o}</button>`)
      .join("")}</div>`;
    const buttons = $("q-body").querySelectorAll(".opt");
    buttons.forEach((b) => {
      b.onclick = () => {
        const chosen = +b.dataset.i;
        buttons.forEach((x) => {
          x.disabled = true;
          if (!instant) return;
          if (+x.dataset.i === item.answer) x.classList.replace("btn-outline-secondary", "btn-success");
          else if (x === b) x.classList.replace("btn-outline-secondary", "btn-danger");
        });
        answered(chosen === item.answer);
      };
    });
  }

  // Bấm từ ở dưới để đưa lên khung trả lời, bấm từ ở khung trả lời để trả lại
  function renderOrder(item) {
    const pool = shuffle(item.words);
    const picked = [];
    $("q-body").innerHTML = `
      <div class="order-answer border border-2 border-primary-subtle rounded p-2 mb-3" id="o-answer"></div>
      <div class="d-flex flex-wrap gap-2 mb-3" id="o-pool"></div>
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-outline-secondary" id="o-reset">↩️ Xếp lại</button>
        <button class="btn btn-primary" id="o-check">${instant ? "Kiểm tra" : "Trả lời"}</button>
      </div>`;

    function draw() {
      $("o-answer").innerHTML = picked.length
        ? picked.map((w, k) => `<button class="btn btn-primary chip" data-k="${k}">${w}</button>`).join("")
        : `<span class="text-body-secondary">Bấm vào các từ bên dưới theo đúng thứ tự</span>`;
      $("o-pool").innerHTML = pool.map((w, k) => `<button class="btn btn-outline-primary chip" data-k="${k}">${w}</button>`).join("");
      $("o-answer").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { pool.push(...picked.splice(+b.dataset.k, 1)); draw(); }));
      $("o-pool").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { picked.push(...pool.splice(+b.dataset.k, 1)); draw(); }));
      $("o-check").disabled = pool.length > 0;
    }

    $("o-reset").onclick = () => { pool.push(...picked.splice(0)); draw(); };
    $("o-check").onclick = () => {
      const correct = picked.join(" ") === item.answer;
      $("q-body").querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (instant) $("o-answer").classList.replace("border-primary-subtle", correct ? "border-success" : "border-danger");
      answered(correct);
    };
    draw();
  }

  function answered(correct) {
    const item = questions[idx];
    if (correct) score++; else wrong.push(item);
    const next = () => { idx++; idx < questions.length ? render() : finish(); };
    if (!instant) return next();

    const fix = item.type === "order" && !correct ? `Câu đúng: <b>${item.answer}</b><br>` : "";
    const say = correct ? pick(CHEERS, 1)[0] : pick(ENCOURAGE, 1)[0];
    $("q-feedback").innerHTML = `
      <div class="feedback ${correct ? "ok" : "no"}">
        <div class="mascot-sm">🦉</div>
        <div class="alert bubble ${correct ? "alert-success" : "alert-danger"}">
          <div class="fw-bold fs-5">${say}</div>${fix}${item.explain}
        </div>
      </div>
      <div class="text-end mt-3">
        <button class="btn btn-primary" id="q-next">${idx + 1 < questions.length ? "Câu tiếp ➡️" : "Xem kết quả"}</button>
      </div>`;
    $("q-next").onclick = next;
    $("q-next").focus();
  }

  function finish() {
    updateMistakes(questions, wrong);
    const ten = toTen(score, questions.length);
    onComplete?.(ten);
    const msg = ten >= 9 ? "Xuất sắc! 🌟" : ten >= 7 ? "Tốt lắm! 👍" : ten >= 5 ? "Cố gắng thêm nhé! 💪" : "Ôn lại rồi làm lại nhé! 📖";
    const correctText = (w) => (w.type === "order" ? w.answer : w.options[w.answer]);
    const stars = ten >= 9 ? 3 : ten >= 7 ? 2 : ten >= 5 ? 1 : 0;
    container.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="stars text-center">${"<span>⭐</span>".repeat(stars)}${"<span>☆</span>".repeat(3 - stars)}</div>
          <div class="score-big text-center">${ten} điểm</div>
          <p class="text-center fs-5">Đúng ${score} / ${questions.length} câu — ${msg}</p>
          ${wrong.length ? `
            <h3 class="h6 mt-4">Các câu làm sai:</h3>
            <div class="list-group mb-3">${wrong.map((w) => `
              <div class="list-group-item">
                <div class="fw-semibold">${w.type === "order" ? w.words.join(" / ") : w.q}</div>
                <div>Đáp án: <b class="text-success">${correctText(w)}</b></div>
                <div class="small text-body-secondary">${w.explain}</div>
              </div>`).join("")}
            </div>` : ""}
          <div class="text-center"><button class="btn btn-primary" id="q-back">Làm bài khác</button></div>
        </div>
      </div>`;
    $("q-back").onclick = onBack;
    if (ten >= 7) celebrate();
  }

  render();
}

// ===== CÂU SAI =====
// Câu làm sai được lưu lại; câu nào làm lại đúng thì xóa khỏi danh sách
function updateMistakes(asked, wrong) {
  const askedKeys = new Set(asked.map((a) => a.key));
  const wrongKeys = new Set(wrong.map((w) => w.key));
  const kept = store.get("mistakes", []).filter((m) => !askedKeys.has(m.key) || wrongKeys.has(m.key));
  wrong.forEach((w) => { if (!kept.some((m) => m.key === w.key)) kept.push(w); });
  store.set("mistakes", kept);
}

function renderMistakes() {
  // Bỏ qua dữ liệu từ bản trang cũ (chưa có key/type)
  const list = store.get("mistakes", []).filter((m) => m.key && m.type);
  $("mistakes-area").innerHTML = "";
  if (!list.length) {
    $("mistakes-info").innerHTML = `
      <div class="card shadow-sm"><div class="card-body text-center">
        <div class="display-6">🎉</div>
        <h2 class="h5">Không có câu sai nào!</h2>
        <p class="text-body-secondary mb-0">Các câu làm sai ở phần Luyện tập, Dạng bài và Kiểm tra sẽ được lưu ở đây để ôn lại.</p>
      </div></div>`;
    return;
  }
  $("mistakes-info").innerHTML = `
    <div class="card shadow-sm"><div class="card-body">
      <h2 class="h5">Có ${list.length} câu cần ôn lại</h2>
      <p class="text-body-secondary">Làm đúng câu nào thì câu đó sẽ được xóa khỏi danh sách.</p>
      <button class="btn btn-primary" id="m-go">Làm lại các câu sai</button>
    </div></div>`;
  $("m-go").onclick = () => {
    $("mistakes-info").innerHTML = "";
    runQuiz($("mistakes-area"), shuffle(list), { instant: true, onBack: renderMistakes });
  };
}

// ===== ĐIỂM CAO NHẤT =====
function saveBest(name, ten) {
  const best = store.get("best", {});
  best[name] = Math.max(best[name] ?? 0, ten);
  store.set("best", best);
}
const bestText = (name) => {
  const b = store.get("best", {})[name];
  return b != null ? `Cao nhất: ${b} điểm` : "Chưa làm";
};

function pickCard(icon, title, sub) {
  return `
    <div class="col">
      <div class="card pick-card h-100 shadow-sm">
        <div class="card-body d-flex align-items-center gap-3">
          <span class="icon">${icon}</span>
          <div><div class="fw-semibold">${title}</div><div class="small text-body-secondary">${sub}</div></div>
        </div>
      </div>
    </div>`;
}

// ===== LUYỆN TẬP THEO CHỦ ĐỀ =====
function showQuizPick() {
  $("quiz-area").innerHTML = "";
  $("quiz-pick").classList.remove("d-none");
  $("quiz-topics").innerHTML = TOPICS.map((t) => pickCard(t.icon, t.name, bestText(t.name))).join("");
  $("quiz-topics").querySelectorAll(".pick-card").forEach((c, i) => (c.onclick = () => startTopicQuiz(TOPICS[i])));
}

function startTopicQuiz(topic) {
  $("quiz-pick").classList.add("d-none");
  const questions = shuffle([...pick(grammarQuestions(topic), 4), ...pick(vocabQuestions(topic), 4), ...pick(orderQuestions(topic), 2)]);
  runQuiz($("quiz-area"), questions, {
    instant: true,
    onComplete: (ten) => saveBest(topic.name, ten),
    onBack: showQuizPick,
  });
}

// ===== DẠNG BÀI =====
const EXERCISE_TYPES = [
  { icon: "🔀", name: "Sắp xếp câu", desc: "Xếp các từ thành câu đúng", build: () => pick(allOrder(), 10) },
  { icon: "🧺", name: "Từ khác loại", desc: "Chọn từ không cùng nhóm", build: () => pick(oddQuestions(), 10) },
  { icon: "📖", name: "Đọc hiểu", desc: "Đọc đoạn văn, chọn Đúng/Sai", build: () => readingQuestions(pick(READINGS, 1)[0]) },
];

function showTypesPick() {
  $("types-area").innerHTML = "";
  $("types-pick").classList.remove("d-none");
  $("types-list").innerHTML = EXERCISE_TYPES.map((t) => pickCard(t.icon, t.name, `${t.desc} · ${bestText(t.name)}`)).join("");
  $("types-list").querySelectorAll(".pick-card").forEach((c, i) => {
    const type = EXERCISE_TYPES[i];
    c.onclick = () => {
      $("types-pick").classList.add("d-none");
      runQuiz($("types-area"), type.build(), {
        instant: true,
        onComplete: (ten) => saveBest(type.name, ten),
        onBack: showTypesPick,
      });
    };
  });
}

// ===== KIỂM TRA TỔNG HỢP =====
// 20 câu: 7 ngữ pháp, 4 từ vựng, 3 sắp xếp câu, 2 từ khác loại (trộn lẫn) + 4 câu đọc hiểu ở cuối
function showTestStart() {
  $("test-area").innerHTML = "";
  $("test-start").classList.remove("d-none");
  const best = store.get("best", {})["Kiểm tra"];
  $("test-best").textContent = best != null ? `🏆 Điểm cao nhất: ${best}` : "";
}

$("test-go").onclick = () => {
  $("test-start").classList.add("d-none");
  const questions = [
    ...shuffle([...pick(allGrammar(), 7), ...pick(allVocab(), 4), ...pick(allOrder(), 3), ...pick(oddQuestions(), 2)]),
    ...readingQuestions(pick(READINGS, 1)[0]),
  ];
  runQuiz($("test-area"), questions, {
    instant: false,
    onComplete: (ten) => saveBest("Kiểm tra", ten),
    onBack: showTestStart,
  });
};
