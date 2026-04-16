// Flashy Feedback — in-app bug report / feature request dialog
// Usage:
//   Flashy.Feedback.configure({ repo: "PrincipalForce/flashy" });
//   Flashy.Feedback.open({ context: {...} });
//
// The submission adapter is swappable. The default adapter opens a
// pre-filled GitHub new-issue URL. Downstream we plan to swap in a
// stirrup-ai workflow trigger that runs behind an admin-approval gate.
(function (global) {
  var Flashy = global.Flashy = global.Flashy || {};
  if (Flashy.Feedback) return;

  var config = {
    repo: "PrincipalForce/flashy",
    adapter: null, // set below after adapters are defined
    product: "Flashy"
  };

  // ---------- adapters ----------
  var adapters = {
    // Opens a pre-filled GitHub "new issue" URL in a new tab.
    githubURL: function (payload) {
      var base = "https://github.com/" + config.repo + "/issues/new";
      var labels = payload.type === "bug" ? "bug,user-report" : "enhancement,user-report";
      var title = payload.title || (payload.type === "bug" ? "Bug report" : "Feature request");
      var body = buildMarkdownBody(payload);
      var q =
        "?title=" + encodeURIComponent(title) +
        "&labels=" + encodeURIComponent(labels) +
        "&body=" + encodeURIComponent(body);
      var url = base + q;
      // Fallback for extremely long bodies (URL length limits):
      if (url.length > 7500) {
        q =
          "?title=" + encodeURIComponent(title) +
          "&labels=" + encodeURIComponent(labels) +
          "&body=" + encodeURIComponent(body.slice(0, 5000) + "\n\n… [truncated, original context preserved in clipboard]");
        url = base + q;
        try { navigator.clipboard && navigator.clipboard.writeText(body); } catch (e) {}
      }
      global.open(url, "_blank", "noopener");
      return { ok: true, transport: "github-url", url: url };
    },

    // Stub for future stirrup-ai workflow trigger. Wire this up when the
    // endpoint and admin-gate handshake are defined.
    stirrupAI: function (payload) {
      if (typeof config.stirrupEndpoint !== "string") {
        throw new Error("Flashy.Feedback: stirrup adapter requires configure({ stirrupEndpoint })");
      }
      return fetch(config.stirrupEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: config.product,
          payload: payload
        })
      }).then(function (r) {
        if (!r.ok) throw new Error("stirrup submit failed: " + r.status);
        return r.json();
      });
    },

    // Console-only, for testing.
    console: function (payload) {
      console.log("[Flashy.Feedback]", payload);
      return { ok: true, transport: "console" };
    }
  };
  config.adapter = adapters.githubURL;

  function buildMarkdownBody(p) {
    var lines = [];
    lines.push("**Type:** " + (p.type === "bug" ? "Bug" : "Feature request"));
    lines.push("");
    lines.push("### Description");
    lines.push(p.description || "_(no description)_");
    if (p.type === "bug" && p.reproSteps) {
      lines.push("");
      lines.push("### Steps to reproduce");
      lines.push(p.reproSteps);
    }
    lines.push("");
    lines.push("### Environment");
    lines.push("- Product: " + config.product);
    lines.push("- Page: " + (p.env && p.env.page));
    lines.push("- User agent: " + (p.env && p.env.userAgent));
    lines.push("- Viewport: " + (p.env && p.env.viewport));
    lines.push("- Submitted: " + (p.env && p.env.submittedAt));
    if (p.context && Object.keys(p.context).length) {
      lines.push("");
      lines.push("### Context");
      lines.push("```json");
      try { lines.push(JSON.stringify(p.context, null, 2)); }
      catch (e) { lines.push("(context not serializable: " + e.message + ")"); }
      lines.push("```");
    }
    lines.push("");
    lines.push("_Submitted via in-app Flashy feedback._");
    return lines.join("\n");
  }

  // ---------- styles ----------
  var STYLE_ID = "flashy-feedback-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      "#flashy-fb-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:-apple-system,\"Segoe UI\",Inter,sans-serif;}" +
      "#flashy-fb-modal{background:#232323;color:#e8e8e8;border:1px solid #1a1a1a;border-radius:8px;width:min(560px,92vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.6);}" +
      "#flashy-fb-modal h3{margin:0;padding:14px 18px;font-size:15px;font-weight:600;border-bottom:1px solid #1a1a1a;background:#2a2a2a;border-radius:8px 8px 0 0;}" +
      "#flashy-fb-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:10px;}" +
      "#flashy-fb-body label{font-size:12px;opacity:0.75;margin-bottom:-4px;}" +
      "#flashy-fb-body input[type=text],#flashy-fb-body textarea,#flashy-fb-body select{background:#1b1b1b;color:#e8e8e8;border:1px solid #111;border-radius:4px;padding:8px 10px;font:inherit;font-size:13px;width:100%;box-sizing:border-box;}" +
      "#flashy-fb-body textarea{resize:vertical;min-height:90px;font-family:inherit;}" +
      "#flashy-fb-body input[type=text]:focus,#flashy-fb-body textarea:focus,#flashy-fb-body select:focus{outline:none;border-color:#4488CC;}" +
      "#flashy-fb-ctx-row{display:flex;align-items:center;gap:6px;font-size:12px;opacity:0.75;}" +
      "#flashy-fb-ctx-row input{margin:0;}" +
      "#flashy-fb-ctx-preview{font-family:Consolas,Menlo,monospace;font-size:11px;background:#161616;border:1px solid #111;border-radius:4px;padding:8px 10px;white-space:pre-wrap;max-height:140px;overflow:auto;opacity:0.75;}" +
      "#flashy-fb-footer{padding:12px 18px;border-top:1px solid #1a1a1a;background:#2a2a2a;display:flex;justify-content:flex-end;gap:8px;border-radius:0 0 8px 8px;}" +
      ".flashy-fb-btn{background:#3a3a3a;color:#e8e8e8;border:1px solid #1a1a1a;border-radius:4px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer;}" +
      ".flashy-fb-btn:hover{background:#4a4a4a;}" +
      ".flashy-fb-btn.primary{background:#4488CC;color:#fff;border-color:#2266AA;}" +
      ".flashy-fb-btn.primary:hover{background:#5599DD;}" +
      ".flashy-fb-btn:disabled{opacity:0.4;cursor:not-allowed;}" +
      "#flashy-fb-status{font-size:12px;margin-right:auto;opacity:0.75;align-self:center;}";
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  // ---------- modal ----------
  function buildEnv() {
    return {
      page: global.location ? global.location.href : "",
      userAgent: global.navigator ? global.navigator.userAgent : "",
      viewport: (global.innerWidth || 0) + "x" + (global.innerHeight || 0),
      submittedAt: new Date().toISOString()
    };
  }

  function open(opts) {
    opts = opts || {};
    injectStyle();
    var prev = document.getElementById("flashy-fb-backdrop");
    if (prev) prev.remove();

    var backdrop = document.createElement("div");
    backdrop.id = "flashy-fb-backdrop";
    var modal = document.createElement("div");
    modal.id = "flashy-fb-modal";
    backdrop.appendChild(modal);

    var h = document.createElement("h3");
    h.textContent = "Report issue / request feature";
    modal.appendChild(h);

    var body = document.createElement("div");
    body.id = "flashy-fb-body";
    modal.appendChild(body);

    function addLabeled(labelText, node) {
      var l = document.createElement("label");
      l.textContent = labelText;
      body.appendChild(l);
      body.appendChild(node);
    }

    var typeSel = document.createElement("select");
    [["bug", "Bug report"], ["feature", "Feature request"]].forEach(function (p) {
      var o = document.createElement("option");
      o.value = p[0]; o.textContent = p[1];
      if (opts.type === p[0]) o.selected = true;
      typeSel.appendChild(o);
    });
    addLabeled("Type", typeSel);

    var titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "One-line summary";
    titleInput.maxLength = 140;
    if (opts.title) titleInput.value = opts.title;
    addLabeled("Title", titleInput);

    var descInput = document.createElement("textarea");
    descInput.placeholder = "What happened? What did you expect?";
    if (opts.description) descInput.value = opts.description;
    addLabeled("Description", descInput);

    var reproInput = document.createElement("textarea");
    reproInput.placeholder = "1. …\n2. …\n3. …";
    reproInput.style.display = typeSel.value === "bug" ? "" : "none";
    var reproLabel = document.createElement("label");
    reproLabel.textContent = "Steps to reproduce (optional)";
    reproLabel.style.display = reproInput.style.display;
    body.appendChild(reproLabel);
    body.appendChild(reproInput);
    typeSel.addEventListener("change", function () {
      var show = typeSel.value === "bug";
      reproInput.style.display = show ? "" : "none";
      reproLabel.style.display = show ? "" : "none";
    });

    var ctxRow = document.createElement("div");
    ctxRow.id = "flashy-fb-ctx-row";
    var ctxChk = document.createElement("input");
    ctxChk.type = "checkbox";
    ctxChk.id = "flashy-fb-ctx-chk";
    ctxChk.checked = !!opts.context;
    var ctxLbl = document.createElement("label");
    ctxLbl.htmlFor = "flashy-fb-ctx-chk";
    ctxLbl.textContent = "Include app context (" +
      (opts.context ? Object.keys(opts.context).length : 0) + " fields)";
    ctxLbl.style.margin = "0";
    ctxLbl.style.opacity = "1";
    ctxRow.appendChild(ctxChk);
    ctxRow.appendChild(ctxLbl);
    body.appendChild(ctxRow);

    var ctxPreview = document.createElement("div");
    ctxPreview.id = "flashy-fb-ctx-preview";
    try {
      ctxPreview.textContent = opts.context ? JSON.stringify(opts.context, null, 2) : "";
    } catch (e) {
      ctxPreview.textContent = "(context not serializable)";
    }
    ctxPreview.style.display = opts.context ? "" : "none";
    body.appendChild(ctxPreview);
    ctxChk.addEventListener("change", function () {
      ctxPreview.style.display = ctxChk.checked && opts.context ? "" : "none";
    });

    var footer = document.createElement("div");
    footer.id = "flashy-fb-footer";
    var status = document.createElement("span");
    status.id = "flashy-fb-status";
    footer.appendChild(status);
    var cancelBtn = document.createElement("button");
    cancelBtn.className = "flashy-fb-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", close);
    footer.appendChild(cancelBtn);
    var submitBtn = document.createElement("button");
    submitBtn.className = "flashy-fb-btn primary";
    submitBtn.textContent = "Submit";
    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    function close() { backdrop.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });

    submitBtn.addEventListener("click", function () {
      if (!titleInput.value.trim()) {
        status.textContent = "Please enter a title.";
        titleInput.focus();
        return;
      }
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      status.textContent = "Submitting…";
      var payload = {
        type: typeSel.value,
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        reproSteps: reproInput.value.trim(),
        context: ctxChk.checked ? (opts.context || null) : null,
        env: buildEnv()
      };
      Promise.resolve()
        .then(function () { return config.adapter(payload); })
        .then(function (res) {
          status.textContent = "Submitted. Thanks!";
          setTimeout(close, 600);
          if (typeof opts.onSubmit === "function") opts.onSubmit(res, payload);
        })
        .catch(function (err) {
          console.error("[Flashy.Feedback] submit failed", err);
          status.textContent = "Submit failed: " + (err && err.message || err);
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });

    document.body.appendChild(backdrop);
    setTimeout(function () { titleInput.focus(); }, 0);
  }

  Flashy.Feedback = {
    open: open,
    configure: function (o) {
      if (!o) return;
      if (o.repo) config.repo = o.repo;
      if (o.product) config.product = o.product;
      if (o.stirrupEndpoint) config.stirrupEndpoint = o.stirrupEndpoint;
      if (typeof o.adapter === "function") config.adapter = o.adapter;
      else if (typeof o.adapter === "string" && adapters[o.adapter]) config.adapter = adapters[o.adapter];
    },
    adapters: adapters,
    _config: config
  };
})(typeof window !== "undefined" ? window : this);
