/* Area explorer: tap a place name, see everything nearby from the same guide on a map.
   Shared source lives in scripts/area-explorer/. Per-guide places live in places/*.json.
   Re-inject into guides with: node scripts/add-area-explorer.mjs */
(function () {
  "use strict";
  var CFG = window.DG_AREA || {};
  var PLACES = CFG.places || {};
  var RADIUS = CFG.radius || 1250;          // what counts as "nearby" (metres, straight line)
  var WALK_LIMIT = CFG.walkLimit || RADIUS; // beyond this, show drive time instead of walk time
  var TRIP_RADIUS = 3000;
  var LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  var OVERPASS = "https://overpass-api.de/api/interpreter";

  var ICON_PIN = '<svg class="pl-pin" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  var ICON_WALK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6a2 2 0 0 0-1.7-1 2 2 0 0 0-.8.2L6 8.3V13h2V9.6z"/></svg>';
  var ICON_CAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2zm2.1 0h9.8l-1.1-3.4a.9.9 0 0 0-.8-.6H9a.9.9 0 0 0-.8.6zM6.5 15a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm11 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/></svg>';
  var ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';

  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""); }
  function slug(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dist(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearestDist(A, B) { var m = Infinity; A.forEach(function (a) { B.forEach(function (b) { m = Math.min(m, dist(a, b)); }); }); return m; }
  // walking: straight line x1.3 at 80 m/min. driving: x1.4 at ~35 km/h plus a few minutes to park.
  function walkMins(m) { return Math.max(1, Math.round((m * 1.3) / 80)); }
  function driveMins(m) { return Math.max(5, Math.round((m * 1.4) / 580 + 3)); }
  function round5(n) { return n < 10 ? n : Math.round(n / 5) * 5; }
  function travel(m) {
    return m <= WALK_LIMIT
      ? { icon: ICON_WALK, text: "About " + walkMins(m) + " min walk" }
      : { icon: ICON_CAR, text: "About " + round5(driveMins(m)) + " min by car" };
  }
  function reachText(r) {
    return r <= WALK_LIMIT ? "within about a " + walkMins(r) + "-minute walk" : "within about a " + round5(driveMins(r)) + "-minute drive";
  }

  var main = document.querySelector("main.main");
  if (!main) return;

  // ── 1. Index every card that has a location ──────────────
  var byNorm = {};
  Object.keys(PLACES).forEach(function (k) { byNorm[norm(k)] = k; (PLACES[k].aka || []).forEach(function (a) { byNorm[norm(a)] = k; }); });
  var entries = [], byId = {};

  function titleOf(card) {
    var h3 = card.querySelector("h3");
    if (h3) return { el: h3, text: h3.textContent.trim(), whole: true };
    var p = card.querySelector("p");
    if (!p || !p.firstChild || p.firstChild.nodeType !== 3) return null;
    var t = p.firstChild.nodeValue;
    var m = t.match(/^\s*([^(:]+?)\s*(?=\(|:)/);
    return m ? { el: p, text: m[1], whole: false, raw: t } : null;
  }

  main.querySelectorAll("section").forEach(function (sec) {
    var h2 = sec.querySelector(":scope > h2");
    var sectionName = h2 ? h2.textContent.trim() : "";
    sec.querySelectorAll("article.card").forEach(function (card) {
      var t = titleOf(card);
      if (!t) return;
      var key = byNorm[norm(t.text)];
      if (!key) return;
      var data = PLACES[key];
      var id = slug(key);
      var meta = card.querySelector(".meta");
      var isRepeat = !!byId[id] || (meta && /^see above$/i.test(meta.textContent.trim()));
      if (!byId[id]) {
        var e = { id: id, title: t.text, section: sectionName, card: card, data: data };
        entries.push(e); byId[id] = e;
      }
      var btn = '<button type="button" class="place-link" data-place="' + id + '" aria-label="' + esc(t.text) + ': see what else is nearby on a map"><span class="pl-text">' + esc(t.text) + "</span>" + ICON_PIN + "</button>";
      if (t.whole) t.el.innerHTML = btn;
      else {
        var i = t.raw.indexOf(t.text);
        var span = document.createElement("span");
        span.innerHTML = btn;
        t.el.firstChild.nodeValue = t.raw.slice(i + t.text.length);
        t.el.insertBefore(span.firstChild, t.el.firstChild);
        if (i > 0) t.el.insertBefore(document.createTextNode(t.raw.slice(0, i)), t.el.firstChild);
      }
      if (isRepeat) card.setAttribute("data-area-repeat", "");
    });
  });
  if (!entries.length) return;

  var intro = main.querySelector(".intro");
  var hint = document.createElement("p");
  hint.className = "area-hint";
  hint.innerHTML = ICON_PIN.replace('class="pl-pin"', "") + "<span>Tap any place name to see everything else from this guide nearby, on a map.</span>";
  if (intro) intro.insertAdjacentElement("afterend", hint);
  else main.insertBefore(hint, main.firstChild);

  // ── 2. Area view ─────────────────────────────────────────
  var view = document.createElement("section");
  view.id = "area-view";
  view.setAttribute("aria-live", "polite");
  main.insertBefore(view, main.firstChild);

  var map = null, leafletPromise = null, current = null, scrollBack = 0, osmCache = {};
  var secOrder = entries.map(function (x) { return x.section; }).filter(function (v, i, a) { return a.indexOf(v) === i; });

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.css"; document.head.appendChild(css);
      var js = document.createElement("script"); js.src = LEAFLET + "leaflet.js";
      js.onload = function () { resolve(window.L); };
      js.onerror = function () { leafletPromise = null; reject(new Error("leaflet")); };
      document.head.appendChild(js);
    });
    return leafletPromise;
  }

  function addChip(card, icon, label) {
    var tag = document.createElement("div");
    tag.className = "walk";
    tag.innerHTML = icon + esc(label);
    var anchor = card.querySelector("h3") || card.querySelector(".meta");
    if (anchor) anchor.insertAdjacentElement("afterend", tag);
    else card.insertBefore(tag, card.firstChild);
  }

  function open(id, opts) {
    var e = byId[id];
    if (!e) return;
    opts = opts || {};
    if (!main.classList.contains("is-area")) scrollBack = window.scrollY;
    current = e;
    var trip = !!e.data.trip;
    var radius = e.data.r || RADIUS;
    var centre = trip ? e.data.p : [e.data.p[0]];

    var near = [];
    if (!trip) {
      entries.forEach(function (o) {
        if (o === e || o.data.trip) return;
        var d = nearestDist(centre, o.data.p);
        if (d <= radius) near.push({ e: o, d: d });
      });
      near.sort(function (a, b) { return a.d - b.d; });
    }
    var groups = {}, order = [];
    near.forEach(function (n) { if (!groups[n.e.section]) { groups[n.e.section] = []; order.push(n.e.section); } groups[n.e.section].push(n); });
    order.sort(function (a, b) { return secOrder.indexOf(a) - secOrder.indexOf(b); });

    var name = e.title.replace(/\s*\(multiple locations\)$/i, "");
    var at = e.data.at ? " (" + esc(e.data.at) + ")" : "";
    var sub;
    if (trip) sub = "This one's a day trip, so the map shows the area around it. Kasey can arrange transport and a guide.";
    else if (near.length) sub = near.length + " more of Kasey's picks " + (near.length === 1 ? "is " : "are ") + reachText(radius) + at + ". Tap a pin to explore around it.";
    else sub = "Nothing else from this guide is " + reachText(radius) + at + ", but the map shows other sights nearby.";

    var html = '<button type="button" class="area-back" data-area-back>' + ICON_BACK + "Back to the full guide</button>" +
      '<h2 tabindex="-1">Around ' + esc(name) + "</h2>" +
      '<p class="area-sub">' + sub + "</p>" +
      '<div class="area-map-wrap"><div id="area-map" role="region" aria-label="Map of the area around ' + esc(name) + '"></div></div>' +
      '<div class="map-legend"><span><i class="lg-dot lg-you"></i>' + esc(name) + "</span>" +
      (near.length ? '<span><i class="lg-dot lg-guide"></i>Also in this guide</span>' : "") +
      '<span><i class="lg-dot lg-other"></i>Other sights nearby</span></div>' +
      '<p class="osm-status"></p><div class="cards" data-picked></div>';
    order.forEach(function (s, i) {
      html += '<h3 class="area-group">' + esc(s) + '<span class="count">' + groups[s].length + '</span></h3><div class="cards" data-group="' + i + '"></div>';
    });
    view.innerHTML = html;

    var picked = e.card.cloneNode(true);
    picked.classList.add("is-picked");
    addChip(picked, ICON_PIN.replace('class="pl-pin"', ""), "You picked this" + (e.data.at ? " · " + e.data.at : ""));
    view.querySelector("[data-picked]").appendChild(picked);
    order.forEach(function (s, i) {
      var box = view.querySelector('[data-group="' + i + '"]');
      groups[s].forEach(function (n) {
        var c = n.e.card.cloneNode(true);
        var tr = travel(n.d);
        addChip(c, tr.icon, tr.text);
        box.appendChild(c);
      });
    });

    main.classList.add("is-area");
    if (!opts.fromHash) { var h = "#near=" + id; if (location.hash !== h) history.pushState({ near: id }, "", h); }
    window.scrollTo(0, main.getBoundingClientRect().top + window.scrollY - 12);
    view.querySelector("h2").focus({ preventScroll: true });
    drawMap(e, near, radius, trip, centre);
  }

  function close(opts) {
    opts = opts || {};
    if (!main.classList.contains("is-area")) return;
    main.classList.remove("is-area");
    var id = current && current.id;
    current = null;
    if (map) { map.remove(); map = null; }
    view.innerHTML = "";
    if (!opts.fromHash && location.hash.indexOf("#near=") === 0) history.pushState({}, "", location.pathname + location.search);
    var btn = id && main.querySelector('.place-link[data-place="' + id + '"]');
    if (btn) { btn.closest("article").scrollIntoView({ block: "center" }); btn.focus({ preventScroll: true }); }
    else window.scrollTo(0, scrollBack);
  }

  // ── 3. Map ───────────────────────────────────────────────
  function pinIcon(L, cls) { return L.divIcon({ className: "", html: '<div class="dg-pin ' + cls + '"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }); }

  function drawMap(e, near, radius, trip, centre) {
    var status = view.querySelector(".osm-status");
    var holder = view.querySelector("#area-map");
    loadLeaflet().then(function (L) {
      if (current !== e) return;
      if (map) { map.remove(); map = null; }
      map = L.map(holder, { scrollWheelZoom: false });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      var pins = L.layerGroup().addTo(map), others = L.layerGroup().addTo(map), bounds = [];
      centre.forEach(function (pt) {
        L.marker(pt, { icon: pinIcon(L, "you"), zIndexOffset: 1000, title: e.title })
          .bindPopup("<strong>" + esc(e.title) + '</strong><span class="pp-sec">' + esc(e.section) + "</span>").addTo(pins);
        bounds.push(pt);
      });
      near.forEach(function (n) {
        var best = n.e.data.p.reduce(function (acc, pt) { var d = nearestDist(centre, [pt]); return d < acc.d ? { pt: pt, d: d } : acc; }, { pt: n.e.data.p[0], d: Infinity }).pt;
        L.marker(best, { icon: pinIcon(L, "guide"), title: n.e.title })
          .bindPopup("<strong>" + esc(n.e.title) + '</strong><span class="pp-sec">' + esc(n.e.section) + " · " + travel(n.d).text.toLowerCase() + '</span><br><button type="button" data-goto="' + n.e.id + '">Explore around here</button>')
          .addTo(pins);
        bounds.push(best);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      else map.setView(centre[0], trip ? 13 : (RADIUS > WALK_LIMIT ? 14 : 16));
      loadOtherSights(e, trip ? TRIP_RADIUS : Math.min(radius, 3000), others, status, L, centre);
    }).catch(function () {
      holder.outerHTML = '<div class="area-map-fallback">The map couldn\'t load. Everything nearby from this guide is listed below.</div>';
    });
  }

  function loadOtherSights(e, r, layer, status, L, centre) {
    var key = e.id + ":" + r;
    var guidePts = [];
    entries.forEach(function (x) { x.data.p.forEach(function (p) { guidePts.push(p); }); });
    var guideNames = entries.map(function (x) { return norm(x.title.split(",")[0]); });
    function render(items) {
      if (current !== e) return;
      var shown = 0;
      items.forEach(function (it) {
        if (guidePts.some(function (p) { return dist(p, it.pt) < 60; })) return;
        var n = norm(it.name);
        if (guideNames.some(function (g) { return g.length > 4 && (n.indexOf(g) > -1 || g.indexOf(n) > -1); })) return;
        L.circleMarker(it.pt, { radius: 5, color: "#6f8284", weight: 2, fillColor: "#fff", fillOpacity: 1 })
          .bindTooltip(esc(it.name), { className: "other-tip", direction: "top", offset: [0, -4] })
          .bindPopup("<strong>" + esc(it.name) + '</strong><span class="pp-sec">' + esc(it.kind) + " · not in this guide yet. Ask Kasey!</span>")
          .addTo(layer);
        shown++;
      });
      status.textContent = shown ? shown + " other sights nearby, from OpenStreetMap." : "";
    }
    if (osmCache[key]) { render(osmCache[key]); return; }
    status.textContent = "Loading other sights nearby…";
    var q = "[out:json][timeout:20];(";
    centre.forEach(function (p) {
      var a = "(around:" + r + "," + p[0] + "," + p[1] + ")";
      q += 'nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]["name"]' + a + ";";
      q += 'nwr["historic"~"^(castle|palace|monument|ruins|archaeological_site|city_gate)$"]["name"]' + a + ";";
      q += 'nwr["natural"="beach"]["name"]' + a + ";";
    });
    q += ");out center 150;";
    fetch(OVERPASS, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (json) {
        var seen = {}, items = [];
        (json.elements || []).forEach(function (el) {
          var t = el.tags || {};
          var lat = el.lat != null ? el.lat : el.center && el.center.lat;
          var lon = el.lon != null ? el.lon : el.center && el.center.lon;
          if (lat == null || !t.name || seen[t.name]) return;
          seen[t.name] = 1;
          var kind = (t.tourism || t.historic || t.natural || "sight").replace(/_/g, " ");
          items.push({ name: t.name, pt: [lat, lon], kind: kind.charAt(0).toUpperCase() + kind.slice(1) });
        });
        osmCache[key] = items;
        render(items);
      })
      .catch(function () { if (current === e) status.textContent = "Other sights couldn't load right now. Kasey's picks are all shown."; });
  }

  // ── 4. Events ────────────────────────────────────────────
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-place],[data-area-back],[data-goto]");
    if (!t) return;
    if (t.hasAttribute("data-area-back")) { close(); return; }
    open(t.getAttribute("data-place") || t.getAttribute("data-goto"));
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && main.classList.contains("is-area") && !document.querySelector(".leaflet-popup")) close();
  });
  function fromHash() {
    var m = location.hash.match(/^#near=([a-z0-9-]+)/);
    if (m && byId[m[1]]) open(m[1], { fromHash: true }); else close({ fromHash: true });
  }
  window.addEventListener("popstate", fromHash);
  if (location.hash.indexOf("#near=") === 0) fromHash();
})();
