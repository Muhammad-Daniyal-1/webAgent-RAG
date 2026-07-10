/*!
 * WebAgent RAG — embeddable chat widget
 * Usage:
 *   <script src="https://your-backend/widget.js"
 *           data-api-url="https://your-backend" async></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if ((scripts[i].src || "").indexOf("widget.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) return;

  var API_URL = (
    script.getAttribute("data-api-url") ||
    script.src.replace(/\/widget\.js.*$/, "")
  ).replace(/\/$/, "");

  if (window.__webagentRagLoaded) return;
  window.__webagentRagLoaded = true;

  var DEFAULTS = {
    bot_name: "Assistant",
    title: "Chat with us",
    welcome_message: "Hi! Ask me anything.",
    placeholder: "Type your message...",
    primary_color: "#2563eb",
    text_color: "#ffffff",
    bubble_icon: "💬",
    position: "bottom-right",
    theme: "dark",
    launcher_label: "",
    show_branding: true,
    language: "auto",
    suggested_questions: [],
  };

  function api(path) {
    return API_URL + path;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Minimal markdown: **bold** and - bullets
  function renderText(text) {
    var lines = String(text).split("\n");
    var html = "";
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      var bullet = /^[-*]\s+/.test(t);
      if (bullet) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += "<li>" + inline(t.replace(/^[-*]\s+/, "")) + "</li>";
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (t) html += "<p>" + inline(t) + "</p>";
      }
    }
    if (inList) html += "</ul>";
    return html;
  }
  function inline(t) {
    return esc(t).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  }

  function start(cfg) {
    var isLight = cfg.theme === "light";
    var panelBg = isLight ? "#ffffff" : "#0b1220";
    var panelText = isLight ? "#111827" : "#e5e7eb";
    var botBubble = isLight ? "#f1f5f9" : "#1f2937";
    var border = isLight ? "#e5e7eb" : "#1f2937";
    var side = cfg.position === "bottom-left" ? "left" : "right";

    var host = document.createElement("div");
    host.id = "webagent-rag-widget";
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var style = document.createElement("style");
    style.textContent =
      ".wa-wrap{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
      ".wa-launch{display:flex;align-items:center;gap:8px;" + side + ":0;position:absolute;bottom:0}" +
      ".wa-bubble{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;" +
      "font-size:26px;display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);transition:transform .15s}" +
      ".wa-bubble:hover{transform:scale(1.06)}" +
      ".wa-label{background:" + panelBg + ";color:" + panelText + ";font-size:13px;" +
      "padding:7px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap}" +
      ".wa-panel{position:absolute;bottom:76px;" + side + ":0;width:370px;max-width:calc(100vw - 40px);" +
      "height:540px;max-height:calc(100vh - 120px);background:" + panelBg + ";color:" + panelText + ";" +
      "border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden}" +
      ".wa-panel.open{display:flex}" +
      ".wa-head{background:" + cfg.primary_color + ";color:" + cfg.text_color + ";padding:14px 16px;" +
      "display:flex;align-items:center;justify-content:space-between}" +
      ".wa-head h3{margin:0;font-size:15px;font-weight:600}" +
      ".wa-close{background:none;border:none;color:" + cfg.text_color + ";cursor:pointer;font-size:20px;opacity:.85}" +
      ".wa-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
      ".wa-msg{max-width:84%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word}" +
      ".wa-msg p{margin:0 0 6px}.wa-msg p:last-child{margin:0}.wa-msg ul{margin:4px 0;padding-left:18px}" +
      ".wa-user{align-self:flex-end;background:" + cfg.primary_color + ";color:" + cfg.text_color + ";border-bottom-right-radius:4px}" +
      ".wa-bot{align-self:flex-start;background:" + botBubble + ";color:" + panelText + ";border-bottom-left-radius:4px}" +
      ".wa-sugg{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}" +
      ".wa-sugg button{background:" + botBubble + ";color:" + panelText + ";border:1px solid " + border + ";" +
      "border-radius:999px;padding:6px 11px;font-size:12px;cursor:pointer}" +
      ".wa-foot{border-top:1px solid " + border + ";padding:10px;display:flex;gap:8px}" +
      ".wa-foot input{flex:1;background:" + (isLight ? "#f8fafc" : "#111827") + ";color:" + panelText + ";" +
      "border:1px solid " + border + ";border-radius:10px;padding:10px 12px;font-size:14px;outline:none}" +
      ".wa-send{background:" + cfg.primary_color + ";color:" + cfg.text_color + ";border:none;border-radius:10px;" +
      "padding:0 16px;cursor:pointer;font-size:14px;font-weight:600}" +
      ".wa-send:disabled{opacity:.5;cursor:default}" +
      ".wa-brand{text-align:center;font-size:10px;opacity:.5;padding:4px 0 8px}" +
      ".wa-dots span{display:inline-block;width:6px;height:6px;margin:0 1px;border-radius:50%;background:" + panelText + ";opacity:.5;animation:wa-b 1s infinite}" +
      ".wa-dots span:nth-child(2){animation-delay:.15s}.wa-dots span:nth-child(3){animation-delay:.3s}" +
      "@keyframes wa-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}";
    root.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "wa-wrap";
    wrap.innerHTML =
      '<div class="wa-panel" part="panel">' +
      '<div class="wa-head"><h3>' + esc(cfg.title) + "</h3>" +
      '<button class="wa-close" aria-label="Close">&times;</button></div>' +
      '<div class="wa-body"></div>' +
      (cfg.show_branding ? '<div class="wa-brand">Powered by WebAgent RAG</div>' : "") +
      '<div class="wa-foot"><input type="text" placeholder="' + esc(cfg.placeholder) + '"/>' +
      '<button class="wa-send">Send</button></div>' +
      "</div>" +
      '<div class="wa-launch">' +
      (cfg.launcher_label ? '<span class="wa-label">' + esc(cfg.launcher_label) + "</span>" : "") +
      '<button class="wa-bubble" style="background:' + cfg.primary_color + ";color:" + cfg.text_color +
      '" aria-label="Open chat">' + esc(cfg.bubble_icon) + "</button></div>";
    root.appendChild(wrap);

    var panel = wrap.querySelector(".wa-panel");
    var body = wrap.querySelector(".wa-body");
    var input = wrap.querySelector(".wa-foot input");
    var sendBtn = wrap.querySelector(".wa-send");
    var bubble = wrap.querySelector(".wa-bubble");
    var closeBtn = wrap.querySelector(".wa-close");

    var sessionId = null;
    var loading = false;
    var greeted = false;

    function addMsg(role, text) {
      var el = document.createElement("div");
      el.className = "wa-msg " + (role === "user" ? "wa-user" : "wa-bot");
      el.innerHTML = role === "user" ? esc(text) : renderText(text);
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
      return el;
    }

    function addSuggestions() {
      var qs = cfg.suggested_questions || [];
      if (!qs.length) return;
      var box = document.createElement("div");
      box.className = "wa-sugg";
      qs.forEach(function (q) {
        var b = document.createElement("button");
        b.textContent = q;
        b.onclick = function () {
          box.remove();
          send(q);
        };
        box.appendChild(b);
      });
      body.appendChild(box);
    }

    function toggle(open) {
      panel.classList.toggle("open", open);
      if (open && !greeted) {
        greeted = true;
        if (cfg.welcome_message) addMsg("bot", cfg.welcome_message);
        addSuggestions();
        setTimeout(function () { input.focus(); }, 50);
      }
    }

    function send(text) {
      text = (text || input.value).trim();
      if (!text || loading) return;
      input.value = "";
      addMsg("user", text);
      loading = true;
      sendBtn.disabled = true;
      var typing = addMsg("bot", "");
      typing.innerHTML = '<span class="wa-dots"><span></span><span></span><span></span></span>';

      fetch(api("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, session_id: sessionId }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          sessionId = data.session_id || sessionId;
          typing.innerHTML = renderText(data.answer || "");
          body.scrollTop = body.scrollHeight;
        })
        .catch(function () {
          typing.innerHTML = renderText("Sorry, I couldn't reach the server.");
        })
        .finally(function () {
          loading = false;
          sendBtn.disabled = false;
          input.focus();
        });
    }

    bubble.onclick = function () { toggle(!panel.classList.contains("open")); };
    closeBtn.onclick = function () { toggle(false); };
    sendBtn.onclick = function () { send(); };
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
  }

  fetch(api("/widget/config"))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var cfg = Object.assign({}, DEFAULTS, (data && data.config) || {});
      start(cfg);
    })
    .catch(function () {
      start(DEFAULTS);
    });
})();
