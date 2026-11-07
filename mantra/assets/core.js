/* 共享状态：进度、设置、主题 */

(function () {
  "use strict";

  const KEY = "shurangama-handbook-v2";
  const DEFAULTS = {
    done: {},
    last: null,
    settings: { theme: "auto", size: null, masked: false },
  };

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        done: raw.done && typeof raw.done === "object" ? raw.done : {},
        last: raw.last || null,
        settings: Object.assign({}, DEFAULTS.settings, raw.settings || {}),
      };
    } catch (err) {
      return { ...DEFAULTS, done: {}, settings: { ...DEFAULTS.settings } };
    }
  }

  function write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* 隐私模式下写入失败时，站点仍然可用，只是不记忆 */
    }
    return state;
  }

  const Store = {
    get state() {
      return read();
    },
    isDone(id) {
      return Boolean(read().done[id]);
    },
    toggleDone(id) {
      const state = read();
      if (state.done[id]) delete state.done[id];
      else state.done[id] = Date.now();
      return write(state);
    },
    doneCount() {
      return Object.keys(read().done).length;
    },
    remember(sectionId, pageNo) {
      const state = read();
      state.last = { section: sectionId, page: pageNo, at: Date.now() };
      write(state);
    },
    last() {
      return read().last;
    },
    settings() {
      return read().settings;
    },
    setSetting(key, value) {
      const state = read();
      state.settings[key] = value;
      return write(state).settings;
    },
  };

  /* ---------- 主题 ---------- */

  const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.dataset.themeSetting = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      const label =
        theme === "auto" ? "跟随系统" : theme === "dark" ? "深色" : "浅色";
      btn.setAttribute("aria-label", `外观：${label}（点击切换）`);
      btn.setAttribute("title", `外观：${label}`);
      btn.dataset.mode = theme;
      const sun = btn.querySelector("[data-icon='sun']");
      const moon = btn.querySelector("[data-icon='moon']");
      const auto = btn.querySelector("[data-icon='auto']");
      if (sun) sun.hidden = theme !== "light";
      if (moon) moon.hidden = theme !== "dark";
      if (auto) auto.hidden = theme !== "auto";
    });
  }

  function initTheme() {
    let theme = Store.settings().theme || "auto";
    applyTheme(theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const order = ["auto", "light", "dark"];
        const next = order[(order.indexOf(theme) + 1) % order.length];
        theme = next;
        Store.setSetting("theme", next);
        applyTheme(next);
      });
    });
    themeQuery.addEventListener("change", () => {
      if (Store.settings().theme === "auto") applyTheme("auto");
    });
  }

  /* ---------- 数据索引 ---------- */

  function pages(sectionId) {
    const section = window.HANDBOOK.sections.find((s) => s.id === sectionId);
    return section ? section.pages : [];
  }

  function flatPages() {
    const out = [];
    window.HANDBOOK.sections.forEach((section) => {
      section.pages.forEach((page) => out.push({ section, page }));
    });
    return out;
  }

  function pageByRoute(sectionId, pageNo) {
    const section = window.HANDBOOK.sections.find((s) => s.id === sectionId);
    if (!section) return null;
    const page = section.pages.find((p) => p.no === Number(pageNo));
    return page ? { section, page } : null;
  }

  function neighbors(sectionId, pageNo) {
    const all = flatPages();
    const index = all.findIndex(
      (item) => item.section.id === sectionId && item.page.no === Number(pageNo)
    );
    return {
      index,
      prev: index > 0 ? all[index - 1] : null,
      next: index >= 0 && index < all.length - 1 ? all[index + 1] : null,
    };
  }

  function route(sectionId, pageNo) {
    return `#/${sectionId}/${pageNo}`;
  }

  window.HB = {
    get HANDBOOK() {
      return window.HANDBOOK;
    },
    store: Store,
    initTheme,
    pages,
    flatPages,
    pageByRoute,
    neighbors,
    route,
    total: () =>
      window.HANDBOOK.sections.reduce((n, s) => n + s.pages.length, 0),
  };
})();
