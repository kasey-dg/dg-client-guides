/* Ratings & reviews: a "Ratings & reviews" button on each located card opens a drawer with
   Kasey's accolades and client quotes (from places/*.json) plus live Tripadvisor and Google
   ratings and recent reviews (via the Netlify "reviews" function). Sources that aren't set up
   or can't find the place are simply left out. */
(function () {
  "use strict";
  var CFG = window.DG_AREA || {};
  var PLACES = CFG.places || {};
  var API = "https://dg-guides.netlify.app/.netlify/functions/reviews";
  var main = document.querySelector("main.main");
  if (!main) return;

  function slug(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var byId = {};
  Object.keys(PLACES).forEach(function (k) { byId[slug(k)] = { key: k, d: PLACES[k] }; });

  var ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  var SOURCES = {
    tripadvisor: { label: "Tripadvisor", more: "Read on Tripadvisor", all: "See all reviews on Tripadvisor" },
    google: { label: "Google Maps", more: "Read on Google Maps", all: "See all reviews on Google Maps" }
  };

  var live = [];      // sources the site has keys for
  var cache = {};     // id:source -> promise

  function hasStatic(d) { return (d.accolades && d.accolades.length) || (d.quotes && d.quotes.length); }

  function addButtons() {
    main.querySelectorAll("article.card").forEach(function (card) {
      if (card.querySelector("[data-reviews]")) return;
      var link = card.querySelector(".place-link[data-place]");
      if (!link || card.hasAttribute("data-area-repeat")) return;
      var id = link.getAttribute("data-place"), e = byId[id];
      if (!e || e.d.trip) return;
      if (!live.length && !hasStatic(e.d)) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rv-open";
      b.setAttribute("data-reviews", id);
      b.innerHTML = ICON_STAR + "<span>Ratings &amp; reviews</span>";
      card.appendChild(b);
    });
  }

  // ── Drawer ───────────────────────────────────────────────
  var dlg = document.createElement("dialog");
  dlg.className = "rv-drawer";
  dlg.setAttribute("aria-labelledby", "rv-title");
  document.body.appendChild(dlg);
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) dlg.close(); });

  function stars(n) {
    if (n == null) return "";
    var pct = Math.max(0, Math.min(100, (n / 5) * 100));
    return '<span class="rv-stars" role="img" aria-label="' + n + ' out of 5"><span class="rv-stars-fill" style="width:' + pct + '%"></span></span>';
  }
  function fmtCount(n) { return n == null ? "" : Number(n).toLocaleString("en-US"); }
  function fmtDate(s) {
    if (!s) return "";
    var d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  function load(id, src) {
    var k = id + ":" + src;
    if (cache[k]) return cache[k];
    var e = byId[id], pt = e.d.p[0];
    var q = new URLSearchParams({ source: src, name: e.key, lat: pt[0], lng: pt[1] });
    if (CFG.category && src === "tripadvisor") q.set("category", CFG.category);
    var over = src === "tripadvisor" ? e.d.ta : e.d.gid;
    if (over) q.set("id", over);
    cache[k] = fetch(API + "?" + q).then(function (r) { return r.json(); }).catch(function () { return { error: "unavailable" }; });
    cache[k].then(function (d) { if (d.error) delete cache[k]; });
    return cache[k];
  }

  function open(id) {
    var e = byId[id];
    if (!e) return;
    var d = e.d;
    var html = '<div class="rv-head"><div><p class="rv-kicker">Ratings &amp; reviews</p><h2 id="rv-title">' + esc(e.key) + '</h2></div>' +
      '<button type="button" class="rv-close" aria-label="Close reviews">' + ICON_CLOSE + "</button></div>";
    if (d.accolades && d.accolades.length) {
      html += '<section class="rv-block"><h3>Recognized by</h3><ul class="rv-accolades">' + d.accolades.map(function (a) {
        var label = esc(a.label) + (a.year ? " <span>" + esc(a.year) + "</span>" : "");
        return "<li>" + (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + label + "</a>" : label) + (a.source ? '<small>' + esc(a.source) + "</small>" : "") + "</li>";
      }).join("") + "</ul></section>";
    }
    if (d.quotes && d.quotes.length) {
      html += '<section class="rv-block"><h3>From Kasey\'s clients</h3>' + d.quotes.map(function (q) {
        return '<blockquote class="rv-quote"><p>' + esc(q.text) + "</p><footer>" + esc(q.who || "Dazzling Getaways client") + (q.when ? ", " + esc(q.when) : "") + "</footer></blockquote>";
      }).join("") + "</section>";
    }
    if (live.length) {
      html += '<section class="rv-block"><h3>What travelers say</h3><div class="rv-summary">' +
        live.map(function (s) { return '<div class="rv-src is-loading" data-src="' + s + '"><span class="rv-src-name">' + SOURCES[s].label + '</span><span class="rv-src-body">Loading…</span></div>'; }).join("") +
        '</div><div class="rv-tabs" role="tablist" hidden></div><div class="rv-list"></div></section>';
    }
    dlg.innerHTML = html;
    dlg.querySelector(".rv-close").addEventListener("click", function () { dlg.close(); });
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    dlg.scrollTop = 0;

    var results = {};
    live.forEach(function (s) {
      load(id, s).then(function (r) {
        if (!dlg.open || dlg.querySelector("#rv-title").textContent !== e.key) return;
        results[s] = r;
        renderSummary(s, r);
        renderTabs(results);
      });
    });
  }

  function renderSummary(s, r) {
    var box = dlg.querySelector('.rv-src[data-src="' + s + '"]');
    if (!box) return;
    box.classList.remove("is-loading");
    var body = box.querySelector(".rv-src-body");
    if (!r || r.error || r.configured === false || !r.found || r.rating == null) {
      body.textContent = r && r.error ? "Couldn't load right now" : "No listing found";
      box.classList.add("is-empty");
      return;
    }
    var visual = s === "tripadvisor" && r.ratingImage ? '<img src="' + esc(r.ratingImage) + '" alt="' + r.rating + ' of 5 bubbles" height="16">' : stars(r.rating);
    body.innerHTML = '<span class="rv-score">' + Number(r.rating).toFixed(1) + "</span>" + visual +
      '<span class="rv-count">' + fmtCount(r.count) + " reviews</span>" +
      (r.ranking ? '<span class="rv-rank">' + esc(r.ranking) + "</span>" : "") +
      (r.url ? '<a class="rv-src-link" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + SOURCES[s].all + ICON_OUT + "</a>" : "");
  }

  function renderTabs(results) {
    var tabs = dlg.querySelector(".rv-tabs"), list = dlg.querySelector(".rv-list");
    if (!tabs) return;
    var avail = live.filter(function (s) { var r = results[s]; return r && r.found && r.reviews && r.reviews.length; });
    if (!avail.length) return;
    var active = tabs.getAttribute("data-active");
    if (!active || avail.indexOf(active) < 0) active = avail[0];
    tabs.hidden = false;
    tabs.innerHTML = avail.map(function (s) {
      return '<button type="button" role="tab" data-tab="' + s + '" aria-selected="' + (s === active) + '">' + SOURCES[s].label + " <span>" + results[s].reviews.length + "</span></button>";
    }).join("");
    tabs.setAttribute("data-active", active);
    var r = results[active];
    list.innerHTML = r.reviews.map(function (v) {
      var author = v.authorUrl ? '<a href="' + esc(v.authorUrl) + '" target="_blank" rel="noopener">' + esc(v.author) + "</a>" : esc(v.author);
      var when = v.when || fmtDate(v.date);
      var visual = active === "tripadvisor" && v.ratingImage ? '<img src="' + esc(v.ratingImage) + '" alt="' + v.rating + ' of 5 bubbles" height="14">' : stars(v.rating);
      return '<article class="rv-review">' +
        '<div class="rv-review-top">' + visual + (when ? '<span class="rv-date">' + esc(when) + "</span>" : "") + "</div>" +
        (v.title ? "<h4>" + esc(v.title) + "</h4>" : "") +
        '<p class="rv-text">' + esc(v.text) + "</p>" +
        '<button type="button" class="rv-more" hidden>Show more</button>' +
        '<footer><span class="rv-author">' + author + "</span>" +
        (v.url ? '<a href="' + esc(v.url) + '" target="_blank" rel="noopener">' + SOURCES[active].more + ICON_OUT + "</a>" : "") + "</footer></article>";
    }).join("") + '<p class="rv-note">Showing the ' + r.reviews.length + " most relevant reviews from " + SOURCES[active].label + ". Reviews are written by travelers, not Dazzling Getaways.</p>";
    list.querySelectorAll(".rv-review").forEach(function (a) {
      var t = a.querySelector(".rv-text"), m = a.querySelector(".rv-more");
      if (t.scrollHeight > t.clientHeight + 4) m.hidden = false;
    });
    tabs.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tabs.setAttribute("data-active", b.getAttribute("data-tab")); renderTabs(results); });
    });
  }

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-reviews]");
    if (b) { open(b.getAttribute("data-reviews")); return; }
    var m = ev.target.closest(".rv-more");
    if (m) { var t = m.previousElementSibling; t.classList.toggle("is-open"); m.textContent = t.classList.contains("is-open") ? "Show less" : "Show more"; }
  });

  // Find out which live sources are set up, then add the buttons.
  addButtons();
  fetch(API + "?check=1").then(function (r) { return r.json(); }).then(function (j) {
    live = (j.sources || []).filter(function (s) { return SOURCES[s]; });
    if (live.length) addButtons();
  }).catch(function () {});
})();
