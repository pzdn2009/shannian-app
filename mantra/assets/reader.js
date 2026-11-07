/* 閱讀頁：路由、遮罩背誦、進度與鍵盤/手勢操作 */

(function () {
  "use strict";

  const HB = window.HB;
  const main = document.getElementById("main");
  const tabs = document.getElementById("tabs");
  const bar = document.getElementById("progress-bar");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const maskBtn = document.getElementById("mask-btn");
  const revealBtn = document.getElementById("reveal-btn");
  const doneBtn = document.getElementById("done-btn");
  const sizeUp = document.getElementById("size-up");
  const sizeDown = document.getElementById("size-down");

  const ACCENT = {
    amber: "var(--accent)",
    violet: "var(--violet)",
    jade: "var(--jade)",
    blue: "var(--blue)",
  };

  let section = null;
  let page = null;
  let revealed = new Set();
  let masked = HB.store.settings().masked === true;
  let currentSize = 20;

  /* ---------- 工具 ---------- */

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [sid, no] = raw.split("/");
    if (sid === "fulu") return { section: null, page: null };
    const found = HB.pageByRoute(sid, Number(no));
    if (found) return { section: found.section, page: found.page };
    const first = HB.HANDBOOK.sections[0];
    return { section: first, page: first.pages[0] };
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function key(col, i) {
    return `${section.id}-${page.no}-${col}-${i}`;
  }

  function applySize(size) {
    currentSize = size;
    main.style.setProperty("--text-size", `${size}px`);
    sizeUp.disabled = size >= 30;
    sizeDown.disabled = size <= 16;
  }

  /* ---------- 渲染 ---------- */

  function renderTabs() {
    tabs.innerHTML = "";
    HB.HANDBOOK.sections.forEach((sec) => {
      const a = document.createElement("a");
      a.href = HB.route(sec.id, 1);
      a.textContent = sec.code ? `${sec.code} ${sec.title}` : sec.title;
      if (section && sec.id === section.id) a.setAttribute("aria-current", "true");
      tabs.appendChild(a);
    });
  }

  function renderAppendix() {
    document.title = "附錄 · 大佛頂首楞嚴神咒助背";
    section = null;
    page = null;
    prevBtn.disabled = true;
    nextBtn.disabled = false;

    const links = HB.HANDBOOK.appendix.links
      .map(
        (l) => `<a href="${l.href}" target="_blank" rel="noopener noreferrer">
          <span>${l.label}<small>${new URL(l.href).hostname}</small></span>
          <span aria-hidden="true">↗</span>
        </a>`
      )
      .join("");

    main.innerHTML = `
      <header class="page-head" style="--sec: var(--blue)">
        <div>
          <p class="kicker"><b>附錄</b><span>外部參考</span></p>
          <h1>參考與延伸</h1>
          <p class="subtitle">手冊末頁保留的兩條連結，按原樣列出，內容由外部網站提供。</p>
        </div>
      </header>
      <div class="links">${links}</div>
      <div class="pager">
        <a href="index.html#appendix"><span>返回</span><b>首頁目錄</b></a>
      </div>`;

    bar.style.width = "100%";
    renderTabs();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function render() {
    const parsed = location.hash.startsWith("#/fulu")
      ? { section: null, page: null }
      : parseHash();

    if (!parsed.section) {
      renderAppendix();
      return;
    }

    section = parsed.section;
    page = parsed.page;
    revealed = new Set();

    const { index, prev, next } = HB.neighbors(section.id, page.no);
    const total = HB.total();
    const isDone = HB.store.isDone(page.id);

    main.style.setProperty("--sec", ACCENT[section.accent] || "var(--accent)");
    document.title = `${section.title} ${pad(page.no)} · 楞嚴咒助背`;

    const cols = [
      { name: "left", lines: page.left },
      { name: "right", lines: page.right },
    ];

    const longText = [...page.left, ...page.right].some(
      (line) => (line.t || "").length > 34
    );

    const body = cols
      .map(({ name, lines }) => {
        const html = lines.map((line, i) => lineHtml(line, name, i)).join("");
        const plain = lines.every((line) => !line.m);
        return `<div class="text-col" data-col="${name}"${plain ? ' data-plain="true"' : ""}>${html}</div>`;
      })
      .join("");

    const aside = page.aside
      ? `<div class="aside-rule"><span>${escapeHtml(page.aside)}</span></div>`
      : "";

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="kicker">
            <b>${section.code || "序"}</b>
            <span>${section.title}</span>
            <span>${pad(page.no)} / ${pad(section.count)}</span>
          </p>
          <h1>${page.title}</h1>
          ${page.subtitle ? `<p class="subtitle">${page.subtitle}</p>` : ""}
          <p class="done-pill" id="done-pill"${isDone ? "" : " hidden"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>
            已標記為已背
          </p>
        </div>
        <div class="page-tools">
          <button class="btn ghost small" type="button" id="head-done">
            ${isDone ? "取消已背" : "標記已背"}
          </button>
        </div>
      </header>

      <div class="text-article"${longText ? ' data-density="tight"' : ""}>
        ${body}
        ${aside}
      </div>

      <nav class="pager" aria-label="翻頁">
        ${
          prev
            ? `<a href="${HB.route(prev.section.id, prev.page.no)}"><span>上一頁</span><b>${prev.section.title} ${pad(prev.page.no)}</b></a>`
            : `<a href="index.html"><span>返回</span><b>首頁目錄</b></a>`
        }
        <span class="counter">${index + 1} / ${total}</span>
        ${
          next
            ? `<a class="next" href="${HB.route(next.section.id, next.page.no)}"><span>下一頁</span><b>${next.section.title} ${pad(next.page.no)}</b></a>`
            : `<a class="next" href="#/fulu"><span>下一頁</span><b>附錄</b></a>`
        }
      </nav>`;

    bar.style.width = `${((index + 1) / total) * 100}%`;

    prevBtn.disabled = !prev;
    nextBtn.disabled = false;

    bindLines();
    bindHeadDone(isDone);
    updateDock(isDone);
    renderTabs();
    HB.store.remember(section.id, page.no);

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function lineHtml(line, col, i) {
    if (!line || !line.t) {
      return '<p class="line blank" aria-hidden="true"></p>';
    }
    const key = `${col}-${i}`;
    const isMasked = masked && !revealed.has(key);
    const text = (line.r || [])
      .map(([chunk, underlined]) =>
        underlined ? `<span class="rep">${escapeHtml(chunk)}</span>` : escapeHtml(chunk)
      )
      .join("");
    const attrs = isMasked
      ? ' tabindex="0" role="button" aria-label="顯示這一句"'
      : "";
    const mark = line.m ? `<span class="mark">${escapeHtml(line.m)}</span>` : '<span class="mark"></span>';
    return `<p class="line${isMasked ? " masked" : ""}" data-key="${key}" data-lv="${line.lv || 0}"${attrs}>${mark}<span class="txt">${text}</span></p>`;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function bindLines() {
    main.querySelectorAll(".line.masked").forEach((el) => {
      const reveal = () => {
        el.classList.remove("masked");
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
        revealed.add(el.dataset.key);
        updateDock();
      };
      el.addEventListener("click", reveal);
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          reveal();
        }
      });
    });
  }

  function bindHeadDone(isDone) {
    const btn = document.getElementById("head-done");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const state = HB.store.toggleDone(page.id);
      const now = Boolean(state.done[page.id]);
      btn.textContent = now ? "取消已背" : "標記已背";
      document.getElementById("done-pill").hidden = !now;
      updateDock(now);
    });
  }

  function updateDock(isDone) {
    doneBtn.setAttribute("aria-pressed", String(isDone === undefined ? HB.store.isDone(page.id) : isDone));
    const remaining = main.querySelectorAll(".line.masked").length;
    revealBtn.disabled = remaining === 0 && !masked;
    revealBtn.setAttribute("aria-label", remaining === 0 ? "重新遮罩本頁" : "顯示本頁全部");
    revealBtn.title = remaining === 0 ? "重新遮罩本頁" : "顯示本頁全部";
    maskBtn.setAttribute("aria-pressed", String(masked));
  }

  /* ---------- 交互 ---------- */

  function go(offset) {
    if (!section || !page) return;
    const { prev, next } = HB.neighbors(section.id, page.no);
    const target = offset < 0 ? prev : next;
    if (target) location.hash = `${HB.route(target.section.id, target.page.no)}`;
    else if (offset > 0) location.hash = "#/fulu";
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  maskBtn.addEventListener("click", () => {
    masked = !masked;
    HB.store.setSetting("masked", masked);
    if (masked) revealed = new Set();
    render();
  });

  revealBtn.addEventListener("click", () => {
    const lineEls = main.querySelectorAll(".line:not(.blank)");
    if (main.querySelector(".line.masked")) {
      lineEls.forEach((el) => {
        el.classList.remove("masked");
        el.removeAttribute("tabindex");
        el.removeAttribute("role");
        el.removeAttribute("aria-label");
        revealed.add(el.dataset.key);
      });
    } else if (masked) {
      revealed = new Set();
      render();
      return;
    }
    updateDock();
  });

  doneBtn.addEventListener("click", () => {
    if (!page) return;
    const state = HB.store.toggleDone(page.id);
    const now = Boolean(state.done[page.id]);
    doneBtn.setAttribute("aria-pressed", String(now));
    const pill = document.getElementById("done-pill");
    if (pill) pill.hidden = !now;
    const head = document.getElementById("head-done");
    if (head) head.textContent = now ? "取消已背" : "標記已背";
  });

  function changeSize(delta) {
    const size = Math.min(30, Math.max(16, currentSize + delta));
    HB.store.setSetting("size", size);
    applySize(size);
  }

  sizeUp.addEventListener("click", () => changeSize(2));
  sizeDown.addEventListener("click", () => changeSize(-2));

  document.addEventListener("keydown", (event) => {
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "m" || event.key === "M") {
      maskBtn.click();
    } else if (event.key === "s" || event.key === "S") {
      revealBtn.click();
    }
  });

  let touchStart = null;
  document.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 55) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("hashchange", render);

  /* ---------- 启动 ---------- */

  HB.initTheme();
  applySize(HB.store.settings().size || (window.innerWidth < 700 ? 18 : 20));
  render();

  if (!location.hash) history.replaceState(null, "", "#/qijing/1");
})();
