/* 首页：结构总览与进度 */

(function () {
  "use strict";

  const HB = window.HB;
  const grid = document.getElementById("structure-grid");
  const progressLine = document.getElementById("progress-line");
  const startBtn = document.getElementById("start-btn");
  const continueBtn = document.getElementById("continue-btn");
  const resetBtn = document.getElementById("reset-progress");

  const ACCENT = {
    amber: "var(--accent)",
    violet: "var(--violet)",
    jade: "var(--jade)",
    blue: "var(--blue)",
  };

  function excerpt(section) {
    const page = section.pages[0];
    if (!page) return "";
    const lines = [...page.left, ...page.right].filter((line) => line.trim());
    return lines.slice(0, 2).join(" ").replace(/\s+/g, " ").slice(0, 40);
  }

  function render() {
    HB.initTheme();
    const total = HB.total();
    const done = HB.store.doneCount();

    grid.innerHTML = "";
    HB.HANDBOOK.sections.forEach((section) => {
      const finished = section.pages.filter((p) => HB.store.isDone(p.id)).length;
      const card = document.createElement("a");
      card.className = "sec-card";
      card.href = `read.html${HB.route(section.id, 1)}`;
      card.style.setProperty("--sec", ACCENT[section.accent] || "var(--accent)");

      const dots = section.pages
        .map((p) => `<i class="dot${HB.store.isDone(p.id) ? " on" : ""}"></i>`)
        .join("");

      card.innerHTML = `
        <div class="row">
          <span class="sec-code">${section.code || "·"}</span>
          <span class="sec-title">${section.title}</span>
          <span class="sec-count">${section.count} 頁</span>
        </div>
        <p class="sec-excerpt">${excerpt(section)}</p>
        <div class="sec-foot">
          ${dots}
          <span class="hint">${finished ? `已背 ${finished}/${section.count}` : "未開始"}</span>
        </div>`;
      grid.appendChild(card);
    });

    const appendix = document.createElement("a");
    appendix.className = "sec-card";
    appendix.href = "#appendix";
    appendix.style.setProperty("--sec", ACCENT.blue);
    appendix.innerHTML = `
      <div class="row">
        <span class="sec-code">·</span>
        <span class="sec-title">附錄</span>
        <span class="sec-count">2 條</span>
      </div>
      <p class="sec-excerpt">手冊末頁保留的外部參考與延伸閱讀。</p>
      <div class="sec-foot"><span class="hint">查看連結</span></div>`;
    grid.appendChild(appendix);

    progressLine.textContent = done
      ? `共 ${total} 頁，已背 ${done} 頁 · ${Math.round((done / total) * 100)}%`
      : `共 ${total} 頁 · 尚未標記任何一頁`;

    const last = HB.store.last();
    if (last) {
      const found = HB.pageByRoute(last.section, last.page);
      if (found) {
        continueBtn.hidden = false;
        continueBtn.href = `read.html${HB.route(found.section.id, found.page.no)}`;
        continueBtn.textContent = `繼續：${found.section.title} ${String(found.page.no).padStart(2, "0")}`;
        continueBtn.className = "btn";
        startBtn.textContent = "從頭開始";
        startBtn.className = "btn ghost";
      }
    }

    resetBtn.disabled = done === 0 && !last;
  }

  resetBtn.addEventListener("click", () => {
    if (!window.confirm("清除本機的背誦進度？此操作無法復原。")) return;
    localStorage.removeItem("shurangama-handbook-v2");
    render();
  });

  render();
})();
