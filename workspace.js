// Flashy Studio — dockable workspace.
//
// Panels (Properties, Color Mixer, Library, Actions, AI Assistant) are not
// nailed to one side of the window. Any panel can live in any dock, grouped
// into tab strips, reordered by dragging its tab, resized, collapsed, closed
// and reopened — and the arrangement survives a reload.
//
// Why this exists: an animator's panel layout is personal and task-dependent.
// Drawing wants a big stage and the Color Mixer to hand; lip syncing wants a
// tall timeline and nothing else; scripting wants the Actions panel filling
// half the screen. A fixed layout means fighting the tool during whichever of
// those you are not doing. The previous layout also shipped a dead "Properties"
// tab at the bottom that rendered an empty box, because the real Properties
// panel only ever existed in the right column — with docking there is one
// Properties panel and it goes wherever you put it.
//
// HOW IT RELATES TO THE EDITOR
// Panel *content* is declared once in editor.html under #panel-store, keeping
// the ids editor-app.js looks up (propsPanel, colorPanel, libPanel, aiPanel,
// frame-script). This file only ever MOVES those nodes between the store and a
// dock body. It never rebuilds them, so panel state — a half-typed frame
// script, a long AI conversation, scroll position — survives being re-docked.
//
// ROBUSTNESS
// A saved layout is untrusted input: it may come from an older release, a newer
// one, or a corrupted localStorage value. restoreLayout() validates it against
// the panel registry — unknown ids are dropped, registered panels missing from
// it are appended to their home dock, sizes are clamped, empty groups are
// pruned — so a stale layout can never leave the editor unusable. Anything
// unrecoverable falls back to the default arrangement rather than throwing.
(function () {
  "use strict";

  var STORE_KEY = "flashy_workspace_v2";

  /**
   * The panel registry. `home` is the dock a panel returns to when a saved
   * layout doesn't mention it (a new panel added in a later release) or when
   * the workspace is reset.
   */
  var PANELS = [
    { id: "props", title: "Properties", home: "right" },
    { id: "color", title: "Color Mixer", home: "right" },
    { id: "library", title: "Library", home: "right" },
    // Shares Library's tab group: both answer "what is this document made of",
    // and a fourth stacked group would leave every one of them too short.
    { id: "character", title: "Character", home: "right", with: "library" },
    { id: "actions", title: "Actions", home: "bottom" },
    { id: "ai", title: "AI Assistant", home: "bottom" }
  ];

  var ZONES = ["right", "bottom"];

  // Dock sizes are CSS custom properties on #app, so the grid and the splitters
  // stay in agreement without any layout maths here.
  var SIZE_LIMITS = {
    right: { min: 150, max: 640, def: 240 },
    bottom: { min: 0, max: 600, def: 150 },
    timeline: { min: 80, max: 700, def: 200 }
  };

  /** Height of a collapsed dock: just its tab strip. Matches CSS. */
  var TABS_H = 22;

  var panelById = {};
  PANELS.forEach(function (p) { panelById[p.id] = p; });

  /* ------------------------------------------------------------------ *
   * Layout state
   *
   * {
   *   zones: { right: {groups: [{panels:[id], active:id, weight:1}]}, ... },
   *   sizes: { right:240, bottom:150, timeline:200 },
   *   collapsed: { right:false, bottom:false },
   *   closed: [panelId]
   * }
   * ------------------------------------------------------------------ */
  var layout = null;

  function defaultLayout() {
    var zones = {};
    ZONES.forEach(function (z) { zones[z] = { groups: [] }; });
    // One group per right-hand panel (stacked), one shared tab group at the
    // bottom — the arrangement the editor shipped with, now rearrangeable.
    PANELS.forEach(function (p) {
      var zone = zones[p.home];
      if (p.with) {
        // Join the group holding the named panel, wherever that ended up.
        var host = null;
        ZONES.forEach(function (z) {
          zones[z].groups.forEach(function (g) {
            if (g.panels.indexOf(p.with) >= 0) host = g;
          });
        });
        if (host) { host.panels.push(p.id); return; }
      }
      if (p.home === "bottom" && zone.groups.length) {
        zone.groups[0].panels.push(p.id);
      } else {
        zone.groups.push({ panels: [p.id], active: p.id, weight: 1 });
      }
    });
    return {
      zones: zones,
      sizes: { right: SIZE_LIMITS.right.def, bottom: SIZE_LIMITS.bottom.def, timeline: SIZE_LIMITS.timeline.def },
      collapsed: { right: false, bottom: false },
      closed: []
    };
  }

  var PRESETS = {
    animation: defaultLayout,
    // Drawing: maximum stage. Colour and Properties to hand, nothing below.
    drawing: function () {
      var l = defaultLayout();
      l.zones.right.groups = [
        { panels: ["color", "props"], active: "color", weight: 1 },
        { panels: ["library", "character"], active: "library", weight: 1 }
      ];
      l.zones.bottom.groups = [{ panels: ["actions", "ai"], active: "actions", weight: 1 }];
      l.collapsed.bottom = true;
      l.sizes.right = 220;
      l.sizes.timeline = 240;
      return l;
    },
    // Coding: Actions and the assistant get real room, on the right, tall.
    coding: function () {
      var l = defaultLayout();
      l.zones.right.groups = [{ panels: ["actions", "ai"], active: "actions", weight: 1 }];
      l.zones.bottom.groups = [
        { panels: ["props"], active: "props", weight: 1 },
        { panels: ["library", "color", "character"], active: "library", weight: 1 }
      ];
      l.sizes.right = 420;
      l.sizes.bottom = 170;
      return l;
    }
  };

  /* ------------------------------------------------------------------ *
   * Persistence
   * ------------------------------------------------------------------ */

  function clamp(v, lim, dflt) {
    if (typeof v !== "number" || !isFinite(v)) return dflt;
    return Math.max(lim.min, Math.min(lim.max, v));
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(layout));
    } catch (e) {
      /* private mode / quota — the layout just won't persist */
    }
  }

  /**
   * Rebuild a trustworthy layout from whatever was stored.
   *
   * Every panel in the registry ends up exactly once: either where the saved
   * layout put it, or appended to its home dock, or in `closed`. Ids that are
   * no longer registered are discarded.
   */
  function restoreLayout() {
    var saved = null;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      saved = null;
    }
    if (!saved || typeof saved !== "object") return defaultLayout();

    var def = defaultLayout();
    var seen = {};
    var out = { zones: {}, sizes: {}, collapsed: {}, closed: [] };

    ZONES.forEach(function (z) {
      out.zones[z] = { groups: [] };
      var src = (saved.zones && saved.zones[z] && saved.zones[z].groups) || [];
      if (!Array.isArray(src)) src = [];
      src.forEach(function (g) {
        if (!g || !Array.isArray(g.panels)) return;
        var panels = g.panels.filter(function (id) {
          if (!panelById[id] || seen[id]) return false; // unknown, or already placed
          seen[id] = true;
          return true;
        });
        if (!panels.length) return; // prune empty groups
        out.zones[z].groups.push({
          panels: panels,
          active: panels.indexOf(g.active) >= 0 ? g.active : panels[0],
          weight: typeof g.weight === "number" && g.weight > 0 ? g.weight : 1
        });
      });
    });

    // Panels the saved layout never mentioned: honour an explicit close,
    // otherwise send them home. This is what makes a newly added panel show up
    // for someone who already has a saved layout.
    if (Array.isArray(saved.closed)) {
      saved.closed.forEach(function (id) {
        if (panelById[id] && !seen[id]) { seen[id] = true; out.closed.push(id); }
      });
    }
    PANELS.forEach(function (p) {
      if (seen[p.id]) return;
      seen[p.id] = true;
      var zone = out.zones[p.home] || out.zones[ZONES[0]];
      zone.groups.push({ panels: [p.id], active: p.id, weight: 1 });
    });

    ["right", "bottom", "timeline"].forEach(function (k) {
      out.sizes[k] = clamp(saved.sizes && saved.sizes[k], SIZE_LIMITS[k], def.sizes[k]);
    });
    ZONES.forEach(function (z) {
      out.collapsed[z] = !!(saved.collapsed && saved.collapsed[z]);
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Layout queries and mutations
   * ------------------------------------------------------------------ */

  function findPanel(id) {
    for (var zi = 0; zi < ZONES.length; zi++) {
      var groups = layout.zones[ZONES[zi]].groups;
      for (var gi = 0; gi < groups.length; gi++) {
        var pi = groups[gi].panels.indexOf(id);
        if (pi >= 0) return { zone: ZONES[zi], group: gi, index: pi };
      }
    }
    return null;
  }

  function isClosed(id) { return layout.closed.indexOf(id) >= 0; }

  /** Detach a panel from wherever it is, pruning the group if it empties. */
  function detach(id) {
    var at = findPanel(id);
    if (!at) {
      var ci = layout.closed.indexOf(id);
      if (ci >= 0) layout.closed.splice(ci, 1);
      return;
    }
    var group = layout.zones[at.zone].groups[at.group];
    group.panels.splice(at.index, 1);
    if (!group.panels.length) layout.zones[at.zone].groups.splice(at.group, 1);
    else if (group.active === id) group.active = group.panels[Math.min(at.index, group.panels.length - 1)];
  }

  /**
   * Move a panel into a dock.
   *
   * `target.group` is an existing group index to join, or null for a new group.
   * `target.index` is the position within that group's tab strip.
   */
  function movePanel(id, zoneName, target) {
    if (!panelById[id]) return;
    target = target || {};
    var zone = layout.zones[zoneName];
    if (!zone) return;

    // Where is it now? Needed so dropping the last tab of a group onto that
    // same group doesn't delete the group and invalidate the target index.
    var from = findPanel(id);
    detach(id);

    var gi = target.group;
    if (gi == null || !zone.groups[gi]) {
      // A brand-new group. Insert at the requested position, or at the end.
      var g = { panels: [id], active: id, weight: 1 };
      var at = typeof target.newGroupAt === "number" ? target.newGroupAt : zone.groups.length;
      zone.groups.splice(Math.max(0, Math.min(at, zone.groups.length)), 0, g);
    } else {
      var grp = zone.groups[gi];
      var idx = typeof target.index === "number" ? target.index : grp.panels.length;
      grp.panels.splice(Math.max(0, Math.min(idx, grp.panels.length)), 0, id);
      grp.active = id;
    }
    void from;
    // Re-docking into a collapsed dock should show the panel, not hide it.
    if (layout.collapsed[zoneName]) layout.collapsed[zoneName] = false;
    render();
    save();
  }

  function activate(id) {
    var at = findPanel(id);
    if (!at) return;
    layout.zones[at.zone].groups[at.group].active = id;
    if (layout.collapsed[at.zone]) layout.collapsed[at.zone] = false;
    render();
    save();
  }

  function closePanel(id) {
    if (!panelById[id] || isClosed(id)) return;
    detach(id);
    layout.closed.push(id);
    render();
    save();
  }

  function openPanel(id) {
    if (!panelById[id]) return;
    if (findPanel(id)) { activate(id); return; }
    var ci = layout.closed.indexOf(id);
    if (ci >= 0) layout.closed.splice(ci, 1);
    movePanel(id, panelById[id].home, { group: null });
    activate(id);
  }

  function togglePanel(id) {
    if (!panelById[id]) return;
    if (isClosed(id)) { openPanel(id); return; }
    var at = findPanel(id);
    // Visible and already the active tab of an expanded dock → close it.
    // Otherwise bring it forward first; that is what a Window-menu item should
    // do when the panel is open but buried behind another tab.
    var group = at && layout.zones[at.zone].groups[at.group];
    if (at && group.active === id && !layout.collapsed[at.zone]) closePanel(id);
    else if (at) activate(id);
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function store() { return document.getElementById("panel-store"); }

  /** The content node for a panel, wherever it currently lives. */
  function contentOf(id) {
    return document.querySelector('.panel-content[data-panel="' + id + '"]');
  }

  function applySizes() {
    var app = document.getElementById("app");
    if (!app) return;
    ZONES.forEach(function (z) {
      var px = layout.collapsed[z] ? TABS_H : layout.sizes[z];
      if (!layout.zones[z].groups.length) px = layout.collapsed[z] ? 0 : Math.min(px, 28);
      app.style.setProperty("--dock-" + z, px + "px");
    });
    app.style.setProperty("--tl-h", layout.sizes.timeline + "px");
  }

  function makeTab(panel, group, groupIndex, zoneName) {
    var tab = document.createElement("span");
    tab.className = "dock-tab" + (group.active === panel.id ? " active" : "");
    tab.dataset.panel = panel.id;
    tab.draggable = true;
    tab.title = panel.title + " — drag to re-dock";

    var label = document.createElement("span");
    label.className = "dock-tab-label";
    label.textContent = panel.title;
    tab.appendChild(label);

    var close = document.createElement("span");
    close.className = "dock-tab-close";
    close.textContent = "×";
    close.title = "Close " + panel.title;
    close.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      closePanel(panel.id);
    });
    tab.appendChild(close);

    tab.addEventListener("click", function () { activate(panel.id); });
    tab.addEventListener("dragstart", function (e) {
      dragging = panel.id;
      try {
        e.dataTransfer.setData("text/flashy-panel", panel.id);
        e.dataTransfer.setData("text/plain", panel.id);
      } catch (err) { /* older browsers restrict custom types */ }
      e.dataTransfer.effectAllowed = "move";
      document.body.classList.add("dock-dragging");
    });
    tab.addEventListener("dragend", function () {
      dragging = null;
      document.body.classList.remove("dock-dragging");
      clearDropHints();
    });
    void groupIndex; void zoneName;
    return tab;
  }

  function renderZone(zoneName) {
    var el = document.getElementById("dock-" + zoneName);
    if (!el) return;
    el.textContent = "";
    el.classList.toggle("collapsed", !!layout.collapsed[zoneName]);
    var groups = layout.zones[zoneName].groups;
    el.classList.toggle("empty", !groups.length);

    if (!groups.length) {
      var hint = document.createElement("div");
      hint.className = "dock-empty-hint";
      hint.textContent = "Drop a panel here";
      el.appendChild(hint);
      return;
    }

    groups.forEach(function (group, gi) {
      if (gi > 0 && zoneName === "right") {
        // Splitter between stacked groups, so Library can be tall and the
        // Color Mixer short.
        var gs = document.createElement("div");
        gs.className = "dock-gsplit";
        gs.dataset.zone = zoneName;
        gs.dataset.group = String(gi);
        el.appendChild(gs);
      }

      var g = document.createElement("div");
      g.className = "dock-group";
      g.style.flex = group.weight + " 1 0%";
      g.dataset.group = String(gi);

      var tabs = document.createElement("div");
      tabs.className = "dock-tabs";
      tabs.dataset.zone = zoneName;
      tabs.dataset.group = String(gi);
      group.panels.forEach(function (id) {
        if (panelById[id]) tabs.appendChild(makeTab(panelById[id], group, gi, zoneName));
      });

      var spacer = document.createElement("span");
      spacer.className = "dock-tabs-spacer";
      tabs.appendChild(spacer);

      var collapse = document.createElement("span");
      collapse.className = "dock-collapse";
      collapse.textContent = layout.collapsed[zoneName] ? "▴" : "▾";
      collapse.title = "Collapse / expand this dock";
      collapse.addEventListener("click", function (e) {
        e.stopPropagation();
        layout.collapsed[zoneName] = !layout.collapsed[zoneName];
        render();
        save();
      });
      tabs.appendChild(collapse);

      var body = document.createElement("div");
      body.className = "dock-body";
      var content = contentOf(group.active);
      if (content) body.appendChild(content);

      g.appendChild(tabs);
      g.appendChild(body);
      el.appendChild(g);
    });
  }

  function render() {
    var park = store();
    // Park every panel first, so no content node is orphaned by a re-render
    // and inactive panels keep their DOM (and therefore their state).
    if (park) {
      PANELS.forEach(function (p) {
        var c = contentOf(p.id);
        if (c && c.parentNode !== park) park.appendChild(c);
      });
    }
    ZONES.forEach(renderZone);
    applySizes();
    updateSplitterVisibility();
    // Two events on purpose. `dockresize` fires on every pointermove of a
    // splitter drag and must stay cheap — the editor only re-measures its
    // canvas. `layoutchange` fires when the arrangement itself changed, and
    // the editor does a full panel refresh.
    emit("flashy:layoutchange");
  }

  /** Dispatch a workspace event, tolerating environments without CustomEvent. */
  function emit(name) {
    try {
      window.dispatchEvent(new CustomEvent(name));
    } catch (e) {
      /* non-fatal */
    }
  }

  function updateSplitterVisibility() {
    ZONES.forEach(function (z) {
      var sp = document.querySelector('.dock-splitter[data-resize="' + z + '"]');
      if (!sp) return;
      var hidden = layout.collapsed[z] || !layout.zones[z].groups.length;
      sp.classList.toggle("hidden", hidden);
    });
  }

  /* ------------------------------------------------------------------ *
   * Drag and drop
   * ------------------------------------------------------------------ */

  var dragging = null;

  function clearDropHints() {
    var hints = document.querySelectorAll(".drop-into, .drop-before, .drop-after");
    for (var i = 0; i < hints.length; i++) {
      hints[i].classList.remove("drop-into", "drop-before", "drop-after");
    }
  }

  /** Which tab index a drop at clientX/clientY lands on within a tab strip. */
  function tabIndexAt(tabs, clientX) {
    var kids = tabs.querySelectorAll(".dock-tab");
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return kids.length;
  }

  function panelFrom(e) {
    var id = "";
    try {
      id = e.dataTransfer.getData("text/flashy-panel") || e.dataTransfer.getData("text/plain") || "";
    } catch (err) {
      id = "";
    }
    return panelById[id] ? id : (dragging && panelById[dragging] ? dragging : null);
  }

  function installDnD() {
    // Delegated, so it keeps working across re-renders.
    document.addEventListener("dragover", function (e) {
      if (!dragging) return;
      var tabs = e.target.closest && e.target.closest(".dock-tabs");
      var zone = e.target.closest && e.target.closest(".dock-zone");
      if (!tabs && !zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearDropHints();
      (tabs || zone).classList.add("drop-into");
    });

    document.addEventListener("dragleave", function (e) {
      var zone = e.target.closest && e.target.closest(".dock-zone");
      if (zone && !zone.contains(e.relatedTarget)) clearDropHints();
    });

    document.addEventListener("drop", function (e) {
      if (!dragging) return;
      var tabs = e.target.closest && e.target.closest(".dock-tabs");
      var zoneEl = e.target.closest && e.target.closest(".dock-zone");
      if (!tabs && !zoneEl) return;
      e.preventDefault();
      var id = panelFrom(e);
      clearDropHints();
      document.body.classList.remove("dock-dragging");
      dragging = null;
      if (!id) return;

      if (tabs) {
        movePanel(id, tabs.dataset.zone, {
          group: parseInt(tabs.dataset.group, 10),
          index: tabIndexAt(tabs, e.clientX)
        });
      } else {
        // Dropped on the dock's open area: its own group at the end.
        movePanel(id, zoneEl.dataset.zone, { group: null });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Splitters
   *
   * Pointer Events with capture, so a fast drag that outruns the 4px handle
   * keeps resizing instead of stalling.
   * ------------------------------------------------------------------ */

  function installSplitters() {
    document.addEventListener("pointerdown", function (e) {
      var sp = e.target.closest && e.target.closest(".dock-splitter, .dock-gsplit");
      if (!sp || sp.classList.contains("hidden")) return;
      e.preventDefault();
      if (sp.setPointerCapture) {
        try { sp.setPointerCapture(e.pointerId); } catch (err) { /* non-fatal */ }
      }
      document.body.classList.add("dock-resizing");

      var isGroup = sp.classList.contains("dock-gsplit");
      var startX = e.clientX, startY = e.clientY;
      var zoneName = sp.dataset.zone || sp.dataset.resize;
      var startSize = isGroup ? 0 : layout.sizes[sp.dataset.resize];

      // Group splitter: convert the two neighbours' pixel heights into weights.
      var groupIdx = isGroup ? parseInt(sp.dataset.group, 10) : -1;
      var aEl, bEl, aH, bH;
      if (isGroup) {
        var groupEls = sp.parentNode.querySelectorAll(".dock-group");
        aEl = groupEls[groupIdx - 1];
        bEl = groupEls[groupIdx];
        aH = aEl ? aEl.getBoundingClientRect().height : 0;
        bH = bEl ? bEl.getBoundingClientRect().height : 0;
      }

      function onMove(ev) {
        if (isGroup) {
          if (!aEl || !bEl) return;
          var d = ev.clientY - startY;
          var na = Math.max(TABS_H, aH + d);
          var nb = Math.max(TABS_H, bH - d);
          var groups = layout.zones[zoneName].groups;
          var total = (groups[groupIdx - 1].weight + groups[groupIdx].weight) || 2;
          groups[groupIdx - 1].weight = Math.max(0.05, (na / (na + nb)) * total);
          groups[groupIdx].weight = Math.max(0.05, (nb / (na + nb)) * total);
          aEl.style.flex = groups[groupIdx - 1].weight + " 1 0%";
          bEl.style.flex = groups[groupIdx].weight + " 1 0%";
          return;
        }
        var key = sp.dataset.resize;
        var delta = key === "right" ? startX - ev.clientX : ev.clientY - startY;
        // The right dock grows leftwards; the bottom dock and the timeline
        // grow upwards, so both of those invert the pointer delta.
        if (key === "bottom" || key === "timeline") delta = startY - ev.clientY;
        layout.sizes[key] = clamp(startSize + delta, SIZE_LIMITS[key], SIZE_LIMITS[key].def);
        applySizes();
        emit("flashy:dockresize");
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        document.body.classList.remove("dock-resizing");
        save();
        render();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  /* ------------------------------------------------------------------ *
   * Public surface — driven by the editor's Window menu and by tests.
   * ------------------------------------------------------------------ */

  window._flashyWorkspace = {
    panels: function () {
      return PANELS.map(function (p) {
        return { id: p.id, title: p.title, open: !isClosed(p.id) };
      });
    },
    isOpen: function (id) { return !isClosed(id); },
    show: function (id) { openPanel(id); },
    toggle: function (id) { togglePanel(id); },
    close: function (id) { closePanel(id); },
    /** Move a panel programmatically — also the seam the tests drive. */
    dock: function (id, zone, target) { movePanel(id, zone, target || { group: null }); },
    preset: function (name) {
      var make = PRESETS[name];
      if (!make) return false;
      layout = make();
      render();
      save();
      return true;
    },
    presets: function () { return Object.keys(PRESETS); },
    reset: function () {
      layout = defaultLayout();
      render();
      save();
    },
    /** A copy, so callers cannot mutate live state behind our back. */
    layout: function () { return JSON.parse(JSON.stringify(layout)); }
  };

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  function init() {
    if (!document.getElementById("dock-right")) return; // not the editor page
    try {
      layout = restoreLayout();
    } catch (e) {
      // A corrupt layout must never stop the editor from opening.
      if (window.console) console.warn("Flashy: resetting workspace layout —", e);
      layout = defaultLayout();
    }
    render();
    installDnD();
    installSplitters();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
