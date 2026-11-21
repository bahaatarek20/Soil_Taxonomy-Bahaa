/* =========================================================
   طبقات — منطق الأبلكيشن
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- التخزين ---------- */
  const KEY = "tabaqat:";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  const state = {
    plan: new Set(store.get("plan", [])),
    known: new Set(store.get("known", [])),
    wrong: new Set(store.get("wrong", [])),
    best: store.get("best", {}),
    lecture: store.get("lecture", 2)
  };
  const save = {
    plan: () => store.set("plan", [...state.plan]),
    known: () => store.set("known", [...state.known]),
    wrong: () => store.set("wrong", [...state.wrong]),
    best: () => store.set("best", state.best)
  };

  const LEC_NAME = { 1: "م١", 2: "م٢", 3: "م٣" };
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- Toast + Confetti ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = ["🌱", "🍂", "🪨", "✨", "🌿", "🟫"];
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    for (let i = 0; i < 36; i++) {
      const s = document.createElement("span");
      s.textContent = items[i % items.length];
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDelay = Math.random() * 0.6 + "s";
      s.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      s.style.fontSize = 16 + Math.random() * 18 + "px";
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3600);
  }

  /* ---------- الثيم ---------- */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
    $('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#17110c" : "#2a1c13");
  }
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(store.get("theme", prefersDark ? "dark" : "light"));
  $("#themeBtn").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(t); store.set("theme", t);
  });

  /* =========================================================
     الراوتر
     ========================================================= */
  const VIEWS = ["plan", "summary", "cards", "quiz", "numbers"];
  function route() {
    const [view, arg] = (location.hash.replace("#", "") || "plan").split("/");
    const v = VIEWS.includes(view) ? view : "plan";
    $$(".view").forEach((el) => el.classList.toggle("active", el.id === "view-" + v));
    $$("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === v));
    if (v === "plan") renderPlan();
    if (v === "summary") { if (arg && LECTURES.some((l) => l.id == arg)) state.lecture = +arg; renderSummary(); }
    if (v === "cards") renderCards();
    if (v === "quiz") { if (arg) presetQuiz(arg); else if (!$("#quizSetup").hidden) renderSetup(); }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  window.addEventListener("hashchange", route);

  /* =========================================================
     الخطة
     ========================================================= */
  function renderStats() {
    const pct = Math.round((state.plan.size / PLAN.length) * 100);
    const best = state.best.all != null ? state.best.all + "%" : "—";
    $("#stats").innerHTML = `
      <div class="stat main">
        <div class="donut" style="--p:${pct}"><span>${pct}%</span></div>
        <div><b>تقدمك في الخطة</b><small>${state.plan.size} من ${PLAN.length} طبقات</small></div>
      </div>
      <div class="stat"><span class="sv">${state.known.size}<small>/${CARDS.length}</small></span><span class="sl">كارت حافظه</span></div>
      <div class="stat"><span class="sv">${best}</span><span class="sl">أحسن نتيجة شامل</span></div>
      <div class="stat"><span class="sv">${state.wrong.size}</span><span class="sl">سؤال محتاج مراجعة</span></div>`;
  }

  function renderPlan() {
    renderStats();
    const total = PLAN.reduce((s, p) => s + p.time, 0);
    const left = PLAN.filter((p) => !state.plan.has(p.id)).reduce((s, p) => s + p.time, 0);
    $("#planTime").textContent = left
      ? `⏱ فاضلك حوالي ${fmtTime(left)} من ${fmtTime(total)}`
      : "🎉 خلصت الخطة كلها!";
    const firstTodo = PLAN.find((p) => !state.plan.has(p.id));
    $("#plan").innerHTML = PLAN.map((p, i) => {
      const done = state.plan.has(p.id);
      const current = firstTodo && firstTodo.id === p.id;
      return `
      <li class="layer hz-${p.hz} ${done ? "done" : ""} ${current ? "current" : ""}">
        <div class="hz-code">${p.hz}</div>
        <div class="layer-body">
          <div class="layer-top"><span class="step">الخطوة ${i + 1}</span><span class="time">⏱ ${p.time} د</span>${current ? '<span class="now">انت هنا 👈</span>' : ""}</div>
          <h3>${p.title}</h3>
          <p>${p.desc}</p>
          <div class="layer-actions">
            <a class="btn sm primary" href="${p.go}">ابدأ ←</a>
            <button class="btn sm ${done ? "ok" : "ghost"}" data-done="${p.id}">${done ? "✓ خلصتها" : "علّم إنها خلصت"}</button>
          </div>
        </div>
      </li>`;
    }).join("") + `
      <li class="layer bedrock ${state.plan.size === PLAN.length ? "reached" : ""}">
        <div class="hz-code">🪨</div>
        <div class="layer-body"><h3>${state.plan.size === PLAN.length ? "وصلت للصخر الأصلي! أنت جاهز للامتحان 💪" : "الصخر الأصلي: هنا هتبقى جاهز للامتحان"}</h3></div>
      </li>`;
  }
  function fmtTime(m) {
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return `${r} دقيقة`;
    return `${h} س${r ? " و " + r + " د" : ""}`;
  }
  $("#plan").addEventListener("click", (e) => {
    const b = e.target.closest("[data-done]");
    if (!b) return;
    const id = b.dataset.done;
    if (state.plan.has(id)) state.plan.delete(id);
    else {
      state.plan.add(id);
      if (state.plan.size === PLAN.length) { confetti(); toast("🎉 وصلت للصخر الأصلي! بالتوفيق بكرة"); }
      else toast("👏 عاش! انزل للطبقة اللي بعدها");
    }
    save.plan(); renderPlan();
  });
  $("#resetPlan").addEventListener("click", () => {
    if (!confirm("متأكد إنك عايز تبدأ الخطة من الأول؟")) return;
    state.plan.clear(); save.plan(); renderPlan();
  });

  /* =========================================================
     الملخص
     ========================================================= */
  function renderSummary() {
    store.set("lecture", state.lecture);
    $("#lecTabs").innerHTML = LECTURES.map((l) => `
      <button role="tab" class="${l.id === state.lecture ? "active" : ""}" data-lec="${l.id}" aria-selected="${l.id === state.lecture}">
        <b>${l.title}</b><small class="${l.badgeType}">${l.badge}</small>
      </button>`).join("");
    const L = LECTURES.find((l) => l.id === state.lecture);
    $("#lecture").innerHTML = `
      <div class="lec-head ${L.badgeType}">
        <div><span class="chip ${L.badgeType}">${L.badgeType === "read" ? "📗" : "🎯"} ${L.badge}</span>
        <h2>${L.topic}</h2>
        <p>${L.note}</p></div>
        <div class="lec-actions">
          <button class="btn sm ghost" id="expandAll">⇕ افتح الكل</button>
          <a class="btn sm primary" href="#quiz/${L.id}">✍️ اختبر نفسك في ${LEC_NAME[L.id]}</a>
        </div>
      </div>
      <div class="sections">
        ${L.sections.map((s, i) => `
          <details class="sec" ${i === 0 ? "open" : ""}>
            <summary><span class="sec-n">${i + 1}</span><span class="sec-t">${s.title}</span><span class="chev">⌄</span></summary>
            <div class="sec-body">${s.html}</div>
          </details>`).join("")}
      </div>
      <div class="lec-nav">
        ${L.id > 1 ? `<a class="btn ghost" href="#summary/${L.id - 1}">→ ${LECTURES[L.id - 2].title}</a>` : "<span></span>"}
        ${L.id < LECTURES.length ? `<a class="btn ghost" href="#summary/${L.id + 1}">${LECTURES[L.id].title} ←</a>` : `<a class="btn primary" href="#cards">🃏 روح للكروت ←</a>`}
      </div>`;
    $("#expandAll").addEventListener("click", (e) => {
      const all = $$("#lecture details");
      const open = all.some((d) => !d.open);
      all.forEach((d) => (d.open = open));
      e.target.textContent = open ? "⇕ اقفل الكل" : "⇕ افتح الكل";
    });
  }
  $("#lecTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lec]");
    if (!b) return;
    location.hash = "#summary/" + b.dataset.lec;
  });

  /* =========================================================
     الكروت
     ========================================================= */
  const cards = { filter: "all", deck: [], i: 0, flipped: false };
  const FILTERS = [
    { id: "all", label: "الكل" },
    { id: "2", label: "م٢" },
    { id: "3", label: "م٣" },
    { id: "1", label: "م١ (قراءة)" },
    { id: "todo", label: "📌 اللي لسه مش حافظها" }
  ];
  function buildDeck(doShuffle = false) {
    let d = CARDS.map((c, idx) => ({ ...c, idx }));
    if (cards.filter === "todo") d = d.filter((c) => !state.known.has(c.idx));
    else if (cards.filter !== "all") d = d.filter((c) => String(c.l) === cards.filter);
    cards.deck = doShuffle ? shuffle(d) : d;
    cards.i = 0;
  }
  function renderCardFilters() {
    $("#cardFilters").innerHTML = FILTERS.map((f) => {
      let n;
      if (f.id === "all") n = CARDS.length;
      else if (f.id === "todo") n = CARDS.length - state.known.size;
      else n = CARDS.filter((c) => String(c.l) === f.id).length;
      return `<button class="fchip ${cards.filter === f.id ? "active" : ""}" data-f="${f.id}">${f.label} <small>${n}</small></button>`;
    }).join("");
  }
  function renderCards(rebuild = true) {
    renderCardFilters();
    if (rebuild) buildDeck();
    showCard();
  }
  function showCard() {
    const flash = $("#flash"), empty = $("#deckEmpty");
    const scope = cards.filter === "all" || cards.filter === "todo" ? CARDS.map((_, i) => i) : CARDS.map((c, i) => (String(c.l) === cards.filter ? i : -1)).filter((i) => i >= 0);
    const knownInScope = scope.filter((i) => state.known.has(i)).length;
    $("#deckKnown").textContent = `✓ ${knownInScope} / ${scope.length} حافظهم`;
    $("#deckBar").style.width = (scope.length ? (knownInScope / scope.length) * 100 : 0) + "%";

    if (!cards.deck.length) {
      flash.hidden = true; empty.hidden = false;
      $("#deckCount").textContent = "0 / 0";
      $$(".card-actions .btn").forEach((b) => (b.disabled = true));
      return;
    }
    $$(".card-actions .btn").forEach((b) => (b.disabled = false));
    flash.hidden = false; empty.hidden = true;
    if (cards.i >= cards.deck.length) cards.i = 0;
    const c = cards.deck[cards.i];
    cards.flipped = false;
    flash.classList.remove("flipped");
    flash.classList.toggle("is-known", state.known.has(c.idx));
    const tag = `${LEC_NAME[c.l]}${state.known.has(c.idx) ? " • ✓ حافظها" : ""}`;
    $("#cardTag").textContent = tag;
    $("#cardTag2").textContent = tag;
    $("#cardFront").textContent = c.f;
    $("#cardBack").textContent = c.b;
    $("#deckCount").textContent = `${cards.i + 1} / ${cards.deck.length}`;
  }
  function flip() { cards.flipped = !cards.flipped; $("#flash").classList.toggle("flipped", cards.flipped); }
  function nextCard(step = 1) {
    if (!cards.deck.length) return;
    cards.i = (cards.i + step + cards.deck.length) % cards.deck.length;
    animateCard(step > 0 ? "out-next" : "out-prev");
  }
  function animateCard(cls) {
    const f = $("#flash");
    f.classList.add(cls);
    setTimeout(() => { f.classList.remove(cls); showCard(); }, 160);
  }
  function markCard(known) {
    const c = cards.deck[cards.i];
    if (!c) return;
    if (known) state.known.add(c.idx); else state.known.delete(c.idx);
    save.known();
    if (cards.filter === "todo" && known) {
      cards.deck.splice(cards.i, 1);
      if (cards.i >= cards.deck.length) cards.i = 0;
      renderCardFilters();
      animateCard("out-next");
      if (!cards.deck.length) { confetti(); toast("🎉 حفظت كل الكروت!"); }
      return;
    }
    if (known && state.known.size === CARDS.length) { confetti(); toast("🎉 حفظت كل الكروت!"); }
    else toast(known ? "✓ تمام، اتسجلت إنك حافظها" : "↻ ماشي، هترجعلك تاني");
    renderCardFilters();
    if (!known) {
      // نرجّع الكارت بعد 3 كروت عشان يتكرر
      const [card] = cards.deck.splice(cards.i, 1);
      cards.deck.splice(Math.min(cards.i + 3, cards.deck.length), 0, card);
      animateCard("out-next");
    } else nextCard(1);
  }
  $("#cardFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    cards.filter = b.dataset.f; renderCards();
  });
  let touchX = null;
  $("#flash").addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  $("#flash").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 55) { e.preventDefault(); nextCard(dx < 0 ? 1 : -1); }
  });
  $("#flash").addEventListener("click", flip);
  $("#nextCard").addEventListener("click", () => nextCard(1));
  $("#prevCard").addEventListener("click", () => nextCard(-1));
  $("#knowCard").addEventListener("click", () => markCard(true));
  $("#againCard").addEventListener("click", () => markCard(false));
  $("#shuffleCards").addEventListener("click", () => { buildDeck(true); showCard(); toast("🔀 اتلخبطوا"); });
  $("#resetCards").addEventListener("click", () => {
    if (!confirm("هتصفّر كل الكروت اللي علّمت إنك حافظها. متأكد؟")) return;
    state.known.clear(); save.known(); renderCards();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#view-cards").classList.contains("active")) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); flip(); }
    else if (e.key === "ArrowLeft") nextCard(1);
    else if (e.key === "ArrowRight") nextCard(-1);
  });

  /* =========================================================
     الاختبار
     ========================================================= */
  const quiz = { scope: "all", count: 15, list: [], i: 0, score: 0, wrongNow: [], answered: false };
  const SCOPES = [
    { id: "all", label: "🎯 شامل (م٢ + م٣)", sub: "اللي عليه الامتحان" },
    { id: "2", label: "المحاضرة ٢", sub: "الآفاق والنطاقات" },
    { id: "3", label: "المحاضرة ٣", sub: "المستويات والرتب" },
    { id: "1", label: "المحاضرة ١", sub: "قراءة" },
    { id: "wrong", label: "📌 أخطائي", sub: "الأسئلة اللي غلطت فيها" }
  ];
  const COUNTS = [10, 15, 25, 0];

  function scopePool(scope) {
    const all = QUESTIONS.map((q, idx) => ({ ...q, idx }));
    if (scope === "all") return all.filter((q) => q.l !== 1);
    if (scope === "wrong") return all.filter((q) => state.wrong.has(q.idx));
    return all.filter((q) => String(q.l) === scope);
  }
  function renderSetup() {
    $("#scopeChoice").innerHTML = SCOPES.map((s) => {
      const n = scopePool(s.id).length;
      const best = state.best[s.id] != null && s.id !== "wrong" ? `<em>🏆 ${state.best[s.id]}%</em>` : "";
      return `<button class="opt-card ${quiz.scope === s.id ? "active" : ""}" data-scope="${s.id}" ${n ? "" : "disabled"}>
        <b>${s.label}</b><small>${s.sub} • ${n} سؤال</small>${best}</button>`;
    }).join("");
    $("#countChoice").innerHTML = COUNTS.map((c) =>
      `<button class="fchip ${quiz.count === c ? "active" : ""}" data-count="${c}">${c || "الكل"}</button>`).join("");
  }
  function presetQuiz(arg) {
    showQuizPane("setup");
    if (SCOPES.some((s) => s.id === arg)) quiz.scope = arg;
    renderSetup();
  }
  function showQuizPane(p) {
    $("#quizSetup").hidden = p !== "setup";
    $("#quizRun").hidden = p !== "run";
    $("#quizResult").hidden = p !== "result";
  }
  $("#scopeChoice").addEventListener("click", (e) => {
    const b = e.target.closest("[data-scope]"); if (!b) return;
    quiz.scope = b.dataset.scope; renderSetup();
  });
  $("#countChoice").addEventListener("click", (e) => {
    const b = e.target.closest("[data-count]"); if (!b) return;
    quiz.count = +b.dataset.count; renderSetup();
  });

  function startQuiz() {
    let pool = shuffle(scopePool(quiz.scope));
    if (!pool.length) { toast("مفيش أسئلة هنا 👌"); return; }
    if (quiz.count) pool = pool.slice(0, quiz.count);
    quiz.list = pool.map((q) => {
      const isTF = q.o === TF;
      const order = isTF ? [0, 1] : shuffle(q.o.map((_, i) => i));
      return { ...q, order };
    });
    quiz.i = 0; quiz.score = 0; quiz.wrongNow = [];
    showQuizPane("run");
    showQuestion();
  }
  function showQuestion() {
    const q = quiz.list[quiz.i];
    quiz.answered = false;
    $("#qCounter").textContent = `سؤال ${quiz.i + 1} من ${quiz.list.length}`;
    $("#qScore").textContent = `✓ ${quiz.score}`;
    $("#qBar").style.width = (quiz.i / quiz.list.length) * 100 + "%";
    $("#qTag").textContent = `${LEC_NAME[q.l]}${q.o === TF ? " • صح ولا غلط" : ""}`;
    $("#qText").textContent = q.q;
    const letters = ["أ", "ب", "ج", "د"];
    $("#qOptions").className = "options" + (q.o === TF ? " tf" : "");
    $("#qOptions").innerHTML = q.order.map((oi, k) =>
      `<button class="opt" data-oi="${oi}"><span class="ol">${q.o === TF ? "" : letters[k]}</span><span>${q.o[oi]}</span></button>`).join("");
    $("#qExplain").hidden = true;
    $("#nextQ").hidden = true;
  }
  function answer(oi) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.list[quiz.i];
    const ok = oi === q.a;
    $$("#qOptions .opt").forEach((b) => {
      const v = +b.dataset.oi;
      b.disabled = true;
      if (v === q.a) b.classList.add("correct");
      else if (v === oi) b.classList.add("wrong");
    });
    if (ok) {
      quiz.score++;
      if (quiz.scope === "wrong") state.wrong.delete(q.idx);
    } else {
      quiz.wrongNow.push({ q, chosen: oi });
      state.wrong.add(q.idx);
      $(".q-card").classList.add("shake");
      setTimeout(() => $(".q-card").classList.remove("shake"), 400);
    }
    save.wrong();
    $("#qScore").textContent = `✓ ${quiz.score}`;
    const ex = $("#qExplain");
    ex.hidden = false;
    ex.className = "explain " + (ok ? "good" : "bad");
    ex.innerHTML = `<b>${ok ? "✓ إجابة صح! " : "✗ مش دي. "}</b>${q.e}`;
    const nb = $("#nextQ");
    nb.hidden = false;
    nb.textContent = quiz.i + 1 < quiz.list.length ? "السؤال اللي بعده ←" : "شوف النتيجة 🏁";
    nb.focus({ preventScroll: true });
  }
  $("#qOptions").addEventListener("click", (e) => {
    const b = e.target.closest(".opt"); if (!b) return;
    answer(+b.dataset.oi);
  });
  $("#nextQ").addEventListener("click", () => {
    if (quiz.i + 1 < quiz.list.length) { quiz.i++; showQuestion(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else finishQuiz();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#view-quiz").classList.contains("active") || $("#quizRun").hidden) return;
    const n = parseInt(e.key, 10);
    if (!quiz.answered && n >= 1 && n <= 4) {
      const btn = $$("#qOptions .opt")[n - 1];
      if (btn) answer(+btn.dataset.oi);
    } else if (quiz.answered && e.key === "Enter" && document.activeElement !== $("#nextQ")) {
      $("#nextQ").click();
    }
  });
  function finishQuiz() {
    const total = quiz.list.length;
    const pct = Math.round((quiz.score / total) * 100);
    if (quiz.scope !== "wrong") {
      const prev = state.best[quiz.scope];
      if (prev == null || pct > prev) { state.best[quiz.scope] = pct; save.best(); }
    }
    showQuizPane("result");
    const ring = $("#ring");
    ring.style.setProperty("--p", 0);
    ring.className = "ring " + (pct >= 85 ? "great" : pct >= 60 ? "good" : "low");
    requestAnimationFrame(() => setTimeout(() => ring.style.setProperty("--p", pct), 50));
    $("#ringVal").textContent = `${quiz.score}/${total}`;
    let title, msg;
    if (pct === 100) { title = "🔥 العلامة الكاملة!"; msg = "إنت وصلت للصخر الأصلي فعلاً. الدكتورة هتنبهر."; }
    else if (pct >= 85) { title = "🌟 ممتاز يا هندسة!"; msg = "مستواك عالي، راجع الغلطات القليلة دي وخلاص."; }
    else if (pct >= 60) { title = "👍 كويس، بس لسه شوية"; msg = "راجع الأسئلة اللي غلطت فيها وارجع للملخص في الأجزاء دي."; }
    else { title = "💪 ولا يهمك، لسه فيه وقت"; msg = "ارجع للملخص وبعدين الكروت، وجرّب تاني. هتفرق جداً."; }
    $("#resultTitle").textContent = `${title} (${pct}%)`;
    $("#resultMsg").textContent = msg;
    if (pct >= 85) confetti();
    $("#reviewWrong").hidden = state.wrong.size === 0;
    $("#wrongList").innerHTML = quiz.wrongNow.length ? `
      <h3 class="wl-title">📌 الأسئلة اللي غلطت فيها (${quiz.wrongNow.length})</h3>
      ${quiz.wrongNow.map(({ q, chosen }) => `
        <div class="wl">
          <span class="tag">${LEC_NAME[q.l]}</span>
          <p class="wl-q">${escapeHTML(q.q)}</p>
          <p class="wl-a bad">✗ إجابتك: ${escapeHTML(q.o[chosen])}</p>
          <p class="wl-a good">✓ الصح: ${escapeHTML(q.o[q.a])}</p>
          <p class="wl-e">💡 ${escapeHTML(q.e)}</p>
        </div>`).join("")}` : "";
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  $("#startQuiz").addEventListener("click", startQuiz);
  $("#quitQuiz").addEventListener("click", () => {
    if (quiz.i > 0 && !confirm("هتخرج من الاختبار؟")) return;
    showQuizPane("setup"); renderSetup();
  });
  $("#retryQuiz").addEventListener("click", () => { showQuizPane("setup"); renderSetup(); });
  $("#reviewWrong").addEventListener("click", () => { quiz.scope = "wrong"; quiz.count = 0; startQuiz(); });

  /* =========================================================
     الأرقام الذهبية + الأدوات
     ========================================================= */
  function renderGolden() {
    $("#golden").innerHTML = GOLDEN.map((g) => `
      <div class="gcard">
        <h3>${g.title}</h3>
        <div class="grows">
          ${g.rows.map(([n, t]) => `<div class="grow"><span class="gnum">${n}</span><span class="gtxt">${t}</span></div>`).join("")}
        </div>
      </div>`).join("");
  }

  function argillicCheck() {
    const a = parseFloat($("#clayA").value), b = parseFloat($("#clayB").value);
    const out = $("#argOut");
    if (isNaN(a) || isNaN(b)) { out.className = "tool-out"; out.textContent = "دخّل الأرقام وهقولك ✨"; return; }
    let ok, rule;
    if (a < 15) { ok = b - a >= 3; rule = `A أقل من 15%، يبقى لازم B يزيد +3%. الفرق = ${(b - a).toFixed(1)}%`; }
    else if (a <= 40) { const r = b / a; ok = r >= 1.2; rule = `A بين 15 و 40%، يبقى لازم B/A ≥ 1.2. النسبة = ${r.toFixed(2)}`; }
    else { ok = b - a >= 8; rule = `A أكبر من 40%، يبقى لازم B يزيد +8%. الفرق = ${(b - a).toFixed(1)}%`; }
    out.className = "tool-out " + (ok ? "good" : "bad");
    out.innerHTML = `<b>${ok ? "✓ يحقق شرط الطين للأرجيليك" : "✗ مش محقق شرط الأرجيليك"}</b><br>${rule}`;
  }
  ["#clayA", "#clayB"].forEach((s) => $(s).addEventListener("input", argillicCheck));

  function tempCheck() {
    const m = parseFloat($("#tMean").value), s = parseFloat($("#tSummer").value), w = parseFloat($("#tWinter").value);
    const out = $("#tempOut");
    if (isNaN(m)) { out.className = "tool-out"; out.textContent = "دخّل الأرقام وهقولك ✨"; return; }
    let name, note = "";
    if (m < 0) name = "Pergelic";
    else if (m < 8) {
      if (isNaN(s)) { name = "Cryic أو Frigid"; note = "دخّل متوسط الصيف عشان أفرق: لو أقل من 15°م يبقى Cryic."; }
      else name = s < 15 ? "Cryic" : "Frigid";
    }
    else if (m < 15) name = "Mesic";
    else if (m < 22) name = "Thermic";
    else name = "Hyperthermic";
    let iso = false;
    if (!isNaN(s) && !isNaN(w) && !["Pergelic", "Cryic", "Cryic أو Frigid"].includes(name)) {
      const d = Math.abs(s - w);
      iso = d < 5;
      note = `الفرق بين الصيف والشتاء = ${d.toFixed(1)}°م، ${iso ? "يعني أقل من 5، فبنضيف Iso 🌴" : "يعني مش أقل من 5، فمفيش Iso"}`;
    }
    const final = iso ? "Iso" + name.toLowerCase() : name;
    out.className = "tool-out good";
    out.innerHTML = `<b>🌡️ النطاق: ${final}</b>${note ? "<br>" + note : ""}`;
  }
  ["#tMean", "#tSummer", "#tWinter"].forEach((s) => $(s).addEventListener("input", tempCheck));

  /* ---------- تشغيل ---------- */
  renderGolden();
  renderSetup();
  route();
})();
