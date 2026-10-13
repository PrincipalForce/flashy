// Loading card for the Flashy editor.
//
// The card itself is static markup in editor.html so it paints on the first
// frame; this file only picks a tip and takes it away again. Identical on the
// web and in the Electron desktop build.
(function () {
  "use strict";

  var TIPS = [
    "Tip: F6 inserts a keyframe, F5 extends the frame, F7 blanks it.",
    "Tip: F8 turns a selection into a reusable library symbol.",
    "Tip: Double-click a symbol on stage to edit it in place.",
    "Tip: Select a span of frames, then Modify ▸ Create Motion Tween.",
    "Tip: Ctrl+Enter tests the movie in a standalone preview window.",
    "Tip: The AI Assistant tab builds whole scenes — drop in a reference image.",
    "Tip: File ▸ Export as HTML gives you one self-contained, portable file.",
    "Tip: Arrow keys nudge the selection; hold Shift to move 10px at a time.",
  ];

  // How long the card stays up, and how long it takes to fade. The fade starts
  // FADE_MS before the end so the element is gone exactly at HOLD_MS.
  var HOLD_MS = 1600;
  var FADE_MS = 350;

  var splash = document.getElementById("splash");
  if (!splash) return;

  var tip = document.getElementById("splash-tip");
  if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

  var done = false;
  function dismiss() {
    if (done) return;
    done = true;
    splash.classList.add("is-fading");
    setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, FADE_MS);
  }

  // Anyone who has read the tip once should not have to wait for it again.
  splash.addEventListener("click", dismiss);
  setTimeout(dismiss, HOLD_MS - FADE_MS);
})();
