/*
 * character.js — the Character panel.
 *
 * Designing a character, rigging it, and animating its movement are three
 * different jobs that all need the same thing in front of you: the part
 * hierarchy, the pivots, and the poses. This panel is that one place.
 *
 * It owns no state. The rig lives on the keyframe objects and the pose library
 * lives in `doc.characters`, both reached through `window._flashyRig`, so the
 * panel can be rebuilt from scratch at any moment and cannot drift out of step
 * with the document — the same reason the timeline is redrawn rather than
 * incrementally patched.
 *
 * Loaded after workspace.js, which has already registered the "character"
 * panel and parked its body (#charPanel) in #panel-store.
 */
(function () {
  "use strict";

  /** Remembered across rebuilds: which character the panel is looking at. */
  var current = null;

  function rig() { return window._flashyRig; }
  function ai() { return window._flashyAI; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(label, title, onClick, cls) {
    var b = el("button", cls || "ch-btn", label);
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  }

  /** The characters in the document, by name. */
  function names() {
    var cs = rig() ? rig().characters() : {};
    return Object.keys(cs).sort();
  }

  /**
   * Which character the panel should show.
   *
   * Prefers an explicit choice, then one that is actually in this keyframe —
   * showing an empty tree for a character that is not on screen while another
   * one is would be the wrong default.
   */
  function resolveCurrent() {
    var all = names();
    if (!all.length) return (current = null);
    if (current && all.indexOf(current) >= 0) {
      if (rig().partsOnStage(current).length) return current;
    }
    for (var i = 0; i < all.length; i++) {
      if (rig().partsOnStage(all[i]).length) return (current = all[i]);
    }
    if (current && all.indexOf(current) >= 0) return current;
    return (current = all[0]);
  }

  /* ---- Part tree ---------------------------------------------------- */

  /**
   * Parts arranged as a tree for display, each with its depth.
   *
   * Reads the hierarchy from the objects rather than a stored structure, so
   * what you see is what will be drawn. Orphans (a parent that is not in this
   * keyframe) are shown at the root rather than hidden, because a part you
   * cannot see is a part you cannot fix.
   */
  function partTree(name) {
    var parts = rig().partsOnStage(name);
    var byId = {};
    parts.forEach(function (o) { byId[o.rigPart] = o; });
    var kids = {};
    parts.forEach(function (o) {
      var key = (o.rigParent && byId[o.rigParent]) ? o.rigParent : "";
      (kids[key] = kids[key] || []).push(o);
    });
    Object.keys(kids).forEach(function (k) {
      kids[k].sort(function (a, b) {
        return (a.rigZ != null ? a.rigZ : 0) - (b.rigZ != null ? b.rigZ : 0);
      });
    });
    var out = [], seen = {};
    (function walk(parent, depth) {
      (kids[parent] || []).forEach(function (o) {
        if (seen[o.rigPart] || depth > 24) return;   // cycle guard
        seen[o.rigPart] = 1;
        out.push({ obj: o, depth: depth });
        walk(o.rigPart, depth + 1);
      });
    })("", 0);
    // Anything a cycle hid still deserves a row.
    parts.forEach(function (o) {
      if (!seen[o.rigPart]) out.push({ obj: o, depth: 0 });
    });
    return out;
  }

  function selectedPart() {
    var sel = ai().selection();
    return (sel.length === 1 && rig().isPart(sel[0])) ? sel[0] : null;
  }

  function selectPart(o) {
    ai().setSelection([o]);
    rig().setTool("pose");
    ai().render();
    ai().updateProps();
    render();
  }

  /* ---- Rendering ---------------------------------------------------- */

  function render() {
    var host = document.getElementById("charPanel");
    if (!host || !rig()) return;
    host.textContent = "";

    var all = names();
    if (!all.length) {
      host.appendChild(emptyState());
      return;
    }

    var name = resolveCurrent();
    host.appendChild(headerRow(all, name));

    if (!rig().partsOnStage(name).length) {
      host.appendChild(notHereState(name));
      return;
    }

    host.appendChild(dragSection());
    host.appendChild(partsSection(name));
    host.appendChild(posesSection(name));
  }

  function emptyState() {
    var wrap = el("div", "ch-empty");
    wrap.appendChild(el("p", null,
      "A character is a set of symbols joined into a hierarchy: rotate the " +
      "shoulder and the whole arm swings."));
    wrap.appendChild(el("p", "ch-dim",
      "Draw the body parts first and convert each to a symbol (F8). Then build " +
      "the character from them."));
    var b = button("New character…", "Create a character rig", function () {
      window._flashyEditor.doAction("newCharacter");
    }, "ch-btn ch-primary");
    wrap.appendChild(b);
    return wrap;
  }

  function notHereState(name) {
    var wrap = el("div", "ch-empty");
    wrap.appendChild(el("p", null, "“" + name + "” is not in this frame."));
    var row = el("div", "ch-row");
    row.appendChild(button("Place in this frame", "Add the character's parts to the current keyframe", function () {
      ai().pushUndo();
      var made = rig().instance(name, {});
      if (!made || !made.length) {
        window._flashyEditor.doAction("__noop");
      }
      rig().refresh();
    }, "ch-btn ch-primary"));
    wrap.appendChild(row);
    wrap.appendChild(el("p", "ch-dim",
      "Or pick a frame where it already is. A character's pose lives on the " +
      "keyframe, which is what lets you tween between poses."));
    return wrap;
  }

  function headerRow(all, name) {
    var row = el("div", "ch-head");
    var sel = el("select", "ch-select");
    all.forEach(function (n) {
      var op = el("option", null, n);
      op.value = n;
      if (n === name) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener("change", function () { current = sel.value; render(); });
    row.appendChild(sel);

    row.appendChild(button("+", "New character", function () {
      window._flashyEditor.doAction("newCharacter");
    }));
    row.appendChild(button("✕", "Delete this character", function () {
      window._flashyEditor.doAction("deleteCharacter");
    }));
    return row;
  }

  /**
   * How a drag on the stage behaves.
   *
   * Chain (IK) is the default: putting a hand where you want it and letting
   * the elbow work itself out is the common case, and it is the thing that
   * makes a rig faster than drawing the pose. Single part is a plain one-joint
   * swing for when you want exactly that.
   */
  function dragSection() {
    var sec = el("div", "ch-sec");
    var head = el("div", "ch-sec-head");
    head.appendChild(el("span", null, "Pose tool"));
    sec.appendChild(head);

    var row = el("div", "ch-row");
    var mode = el("select", "ch-select");
    [["ik", "Drag the chain (IK)"], ["single", "Swing one part"]].forEach(function (o) {
      var op = el("option", null, o[1]);
      op.value = o[0];
      if (rig().poseMode() === o[0]) op.selected = true;
      mode.appendChild(op);
    });
    mode.addEventListener("change", function () { rig().setPoseMode(mode.value); });
    row.appendChild(mode);

    if (rig().poseMode() === "ik") {
      var bones = el("input", "ch-num");
      bones.type = "number";
      bones.min = "1";
      bones.max = "8";
      bones.value = String(rig().bones());
      bones.title = "How many joints up the chain a drag reaches. 2 for an arm from the hand, 3 to include the shoulder.";
      bones.addEventListener("change", function () { rig().setBones(bones.value); });
      row.appendChild(bones);
    }
    sec.appendChild(row);

    sec.appendChild(el("p", "ch-dim",
      rig().poseMode() === "ik"
        ? "Drag a limb and the joints above it follow. Ctrl+drag moves a joint, " +
          "Alt+drag moves the part, Shift snaps."
        : "Drag a limb to swing just that joint. Ctrl+drag moves the joint, " +
          "Alt+drag moves the part, Shift snaps."));
    return sec;
  }

  function partsSection(name) {
    var sec = el("div", "ch-sec");
    var head = el("div", "ch-sec-head");
    head.appendChild(el("span", null, "Parts"));
    head.appendChild(button("Add part…", "Add a library symbol as a body part", function () {
      window._flashyEditor.doAction("addCharacterPart");
    }));
    sec.appendChild(head);

    var tree = partTree(name);
    var selected = selectedPart();
    var list = el("div", "ch-tree");

    tree.forEach(function (row) {
      var o = row.obj;
      var r = el("div", "ch-part" + (o === selected ? " sel" : ""));
      r.style.paddingLeft = (4 + row.depth * 14) + "px";

      var label = el("span", "ch-part-name", o.name || o.rigPart);
      label.title = "Click to select on stage. Drag a limb with the Pose tool to swing it.";
      label.addEventListener("click", function () { selectPart(o); });
      r.appendChild(label);

      var tools = el("span", "ch-part-tools");
      tools.appendChild(button(o.rigLocked ? "🔒" : "🔓",
        o.rigLocked ? "Planted — IK will not move this part" : "Let IK move this part",
        function (e) {
          e.stopPropagation();
          ai().pushUndo();
          o.rigLocked = !o.rigLocked;
          rig().sync(name);
          rig().refresh();
        }, "ch-mini" + (o.rigLocked ? " ch-locked" : "")));
      tools.appendChild(button("▲", "Bring forward", function (e) {
        e.stopPropagation();
        ai().pushUndo();
        rig().nudgeZ(name, o.rigPart, 1);
        rig().refresh();
      }, "ch-mini"));
      tools.appendChild(button("▼", "Send backward", function (e) {
        e.stopPropagation();
        ai().pushUndo();
        rig().nudgeZ(name, o.rigPart, -1);
        rig().refresh();
      }, "ch-mini"));
      tools.appendChild(button("⋯", "Rename, re-parent or remove", function (e) {
        e.stopPropagation();
        window._flashyEditor.doAction("editCharacterPart");
      }, "ch-mini"));
      r.appendChild(tools);
      list.appendChild(r);
    });
    sec.appendChild(list);

    if (selected) sec.appendChild(selectedPartDetail(name, selected));
    else sec.appendChild(el("p", "ch-dim",
      "Select a part to see its joint. With the Pose tool: drag to swing, " +
      "Ctrl+drag to move the joint, Alt+drag to shift the part, Shift to snap."));
    return sec;
  }

  function selectedPartDetail(name, o) {
    var box = el("div", "ch-detail");
    var pv = rig().pivotWorld(o);
    box.appendChild(el("div", "ch-detail-title", o.name || o.rigPart));

    var grid = el("div", "ch-grid");
    function stat(k, v) {
      grid.appendChild(el("span", "ch-k", k));
      grid.appendChild(el("span", "ch-v", v));
    }
    stat("Symbol", o.symbolName || "—");
    stat("Parent", o.rigParent || "(root)");
    stat("Rotation", (Math.round((o.rotation || 0) * 10) / 10) + "°");
    stat("Joint", Math.round(pv.x) + ", " + Math.round(pv.y));
    if (o.rigMin != null || o.rigMax != null) {
      stat("Limits", (o.rigMin != null ? o.rigMin : "—") + "° … " +
                     (o.rigMax != null ? o.rigMax : "—") + "°");
    }
    if (o.rigLocked) stat("Planted", "yes");
    box.appendChild(grid);

    var row = el("div", "ch-row");
    row.appendChild(button("Reset rotation", "Set this part back to 0°", function () {
      ai().pushUndo();
      o.rotation = 0;
      rig().refresh();
    }));
    row.appendChild(button("Limits…", "Set how far this joint may turn", function () {
      window._flashyEditor.doAction("editCharacterPart");
    }));
    row.appendChild(button("Centre joint", "Put the joint back in the middle of the part", function () {
      ai().pushUndo();
      o.pivotX = (o.width || 0) / 2;
      o.pivotY = (o.height || 0) / 2;
      rig().sync(name);
      rig().refresh();
    }));
    box.appendChild(row);
    return box;
  }

  function posesSection(name) {
    var sec = el("div", "ch-sec");
    var head = el("div", "ch-sec-head");
    head.appendChild(el("span", null, "Poses"));
    head.appendChild(button("Save pose…", "Store the current pose under a name", function () {
      window._flashyEditor.doAction("saveCharacterPose");
    }));
    sec.appendChild(head);

    var c = rig().characters()[name] || {};
    var poses = Object.keys(c.poses || {}).sort();

    if (!poses.length) {
      sec.appendChild(el("p", "ch-dim",
        "Pose the character, then save it. Two saved poses are all you need to " +
        "animate movement — Animate poses tweens between them."));
      return sec;
    }

    var list = el("div", "ch-poses");
    poses.forEach(function (pn) {
      var r = el("div", "ch-pose");
      var label = el("span", "ch-pose-name", pn);
      label.title = "Apply this pose";
      label.addEventListener("click", function () {
        ai().pushUndo();
        rig().applyPose(name, pn);
        rig().refresh();
      });
      r.appendChild(label);

      var tools = el("span", "ch-part-tools");
      tools.appendChild(button("⇄", "Save a left-right mirrored copy", function () {
        ai().pushUndo();
        rig().mirrorPose(name, pn);
        rig().refresh();
      }, "ch-mini"));
      tools.appendChild(button("✕", "Delete this pose", function () {
        ai().pushUndo();
        rig().deletePose(name, pn);
        rig().refresh();
      }, "ch-mini"));
      r.appendChild(tools);
      list.appendChild(r);
    });
    sec.appendChild(list);

    var row = el("div", "ch-row");
    row.appendChild(button("Animate poses…", "Write a sequence of poses onto the timeline", function () {
      window._flashyEditor.doAction("animateCharacter");
    }, "ch-btn ch-primary"));
    sec.appendChild(row);
    return sec;
  }

  /* ---- Wiring ------------------------------------------------------- */

  function schedule() {
    // Coalesced: a drag fires a rig change per pointer move, and rebuilding the
    // tree on each one would fight the drag for the main thread.
    if (schedule._q) return;
    schedule._q = true;
    requestAnimationFrame(function () { schedule._q = false; render(); });
  }

  function init() {
    if (!window._flashyRig) return;
    render();
    // fullRefresh() emits rigchange, and it runs after every document
    // mutation and selection change — so one listener covers the lot.
    window.addEventListener("flashy:rigchange", schedule);
    window.addEventListener("flashy:layoutchange", schedule);
  }

  window._flashyCharacterPanel = { render: render, select: function (n) { current = n; render(); } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
