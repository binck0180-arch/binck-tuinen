/* Binck Tuinen – scripts (geen externe afhankelijkheden) */
(function () {
  "use strict";

  /* Mobiel menu */
  var knop = document.querySelector(".menu-knop");
  var nav = document.getElementById("hoofdmenu");
  if (knop && nav) {
    knop.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      knop.setAttribute("aria-expanded", open ? "true" : "false");
      knop.setAttribute("aria-label", open ? "Sluit menu" : "Open menu");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { nav.classList.remove("open"); knop.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); knop.setAttribute("aria-expanded", "false"); knop.focus(); }
    });
  }

  /* Subtiele fade-in bij scrollen */
  var fades = document.querySelectorAll(".fade");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (items) {
      items.forEach(function (it) { if (it.isIntersecting) { it.target.classList.add("zichtbaar"); io.unobserve(it.target); } });
    }, { threshold: 0.12 });
    fades.forEach(function (el) { io.observe(el); });
  } else { fades.forEach(function (el) { el.classList.add("zichtbaar"); }); }

  /* Lightbox voor de galerij */
  var links = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  if (links.length) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Grote weergave van foto");
    lb.innerHTML = '<button class="lb-sluit" aria-label="Sluiten">×</button><button class="lb-vorige" aria-label="Vorige foto">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-volgende" aria-label="Volgende foto">›</button>';
    document.body.appendChild(lb);
    var img = lb.querySelector("img"), cap = lb.querySelector("figcaption"), huidig = 0, terug = null;
    function toon(i) {
      huidig = (i + links.length) % links.length;
      var a = links[huidig], k = a.querySelector("img");
      img.src = a.getAttribute("href");
      img.alt = k ? k.alt : "";
      cap.textContent = a.getAttribute("data-titel") || "";
    }
    function open(i, bron) { terug = bron; toon(i); lb.classList.add("open"); document.body.style.overflow = "hidden"; lb.querySelector(".lb-sluit").focus(); }
    function sluit() { lb.classList.remove("open"); document.body.style.overflow = ""; if (terug) terug.focus(); }
    links.forEach(function (a, i) { a.addEventListener("click", function (e) { e.preventDefault(); open(i, a); }); });
    lb.querySelector(".lb-sluit").addEventListener("click", sluit);
    lb.querySelector(".lb-vorige").addEventListener("click", function () { toon(huidig - 1); });
    lb.querySelector(".lb-volgende").addEventListener("click", function () { toon(huidig + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) sluit(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") sluit();
      if (e.key === "ArrowLeft") toon(huidig - 1);
      if (e.key === "ArrowRight") toon(huidig + 1);
    });
  }

  /* Voor-en-na schuif */
  document.querySelectorAll(".voornaa").forEach(function (box) {
    var range = box.querySelector("input[type=range]");
    var voor = box.querySelector(".voornaa__voor");
    var lijn = box.querySelector(".voornaa__lijn");
    function zet() { var v = range.value; voor.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)"; lijn.style.left = v + "%"; }
    range.addEventListener("input", zet); zet();
  });

  /* Contactformulier */
  var form = document.getElementById("contactformulier");
  if (form) {
    var t0 = Date.now();
    var tijdVeld = form.querySelector("[name=tijd]");
    if (tijdVeld) tijdVeld.value = String(t0);

    // Dienst voorselecteren via ?dienst=...
    var q = new URLSearchParams(location.search).get("dienst");
    var sel = form.querySelector("[name=dienst]");
    if (q && sel) { Array.prototype.forEach.call(sel.options, function (o) { if (o.value === q) sel.value = q; }); }

    var ok = document.getElementById("melding-ok");
    var fout = document.getElementById("melding-fout");
    var MAX = 15 * 1024 * 1024, MAXAANTAL = 3;

    function veldFout(el, bad) { el.setAttribute("aria-invalid", bad ? "true" : "false"); return !bad; }
    function valideer() {
      var goed = true, eerste = null;
      var naam = form.naam, mail = form.email, bericht = form.bericht;
      [[naam, naam.value.trim().length < 2],
       [mail, !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())],
       [bericht, bericht.value.trim().length < 10]].forEach(function (p) {
        if (!veldFout(p[0], p[1])) {} else { /* geldig */ }
        if (p[1]) { goed = false; if (!eerste) eerste = p[0]; }
      });
      var fotos = form.querySelector("[name='fotos[]']");
      var fotoFout = document.getElementById("foto-fout");
      var msg = "";
      if (fotos && fotos.files.length) {
        if (fotos.files.length > MAXAANTAL) msg = "Voeg maximaal " + MAXAANTAL + " foto's toe.";
        Array.prototype.forEach.call(fotos.files, function (f) {
          if (!/^image\/(jpeg|png|webp)$/.test(f.type)) msg = "Alleen JPG-, PNG- of WebP-foto's zijn toegestaan.";
          else if (f.size > MAX) msg = "Een foto mag maximaal 15 MB groot zijn.";
        });
      }
      if (fotoFout) { fotoFout.textContent = msg; fotoFout.style.display = msg ? "block" : "none"; }
      if (msg) { goed = false; if (!eerste) eerste = fotos; }
      if (!form.privacy.checked) { goed = false; if (!eerste) eerste = form.privacy; }
      if (eerste) eerste.focus();
      return goed;
    }

    // Foto verkleinen in de browser (max. 1400 px, JPEG) zodat het versturen snel is en binnen de limiet blijft
    function verkleinFoto(file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          var s = Math.min(1, 1400 / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          resolve({ data: c.toDataURL("image/jpeg", 0.8) });
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("foto")); };
        img.src = url;
      });
    }

    form.addEventListener("submit", function (e) {
      ok.classList.remove("toon"); fout.classList.remove("toon");
      if (!valideer()) { e.preventDefault(); fout.textContent = "Controleer de gemarkeerde velden en probeer het opnieuw."; fout.classList.add("toon"); return; }
      if (!window.fetch || !window.Promise || !window.URL) return; // normale POST als terugval
      e.preventDefault();
      form.classList.add("bezig");
      var fotoInput = form.querySelector("[name='fotos[]']");
      var bestanden = fotoInput ? Array.prototype.slice.call(fotoInput.files) : [];
      Promise.all(bestanden.map(verkleinFoto))
        .then(function (fotos) {
          var body = {
            naam: form.naam.value, email: form.email.value, telefoon: form.telefoon.value,
            dienst: form.dienst.value, bericht: form.bericht.value,
            privacy: form.privacy.checked ? "ja" : "", website: form.website.value,
            tijd: form.tijd.value, fotos: fotos
          };
          var ts = form.querySelector("[name='cf-turnstile-response']");
          if (ts) body["cf-turnstile-response"] = ts.value;
          return fetch(form.getAttribute("action"), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(body)
          });
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }, function () { return { ok: false, j: null }; }); })
        .then(function (res) {
          form.classList.remove("bezig");
          if (res.ok && res.j && res.j.ok) {
            form.reset(); if (tijdVeld) tijdVeld.value = String(Date.now());
            ok.classList.add("toon"); ok.focus(); ok.scrollIntoView({ behavior: "smooth", block: "center" });
          } else {
            fout.textContent = (res.j && res.j.fout) || "Het versturen is niet gelukt. Probeer het later opnieuw of bel ons op 06 47 30 10 48.";
            fout.classList.add("toon"); fout.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        })
        .catch(function () {
          form.classList.remove("bezig");
          fout.textContent = "Er ging iets mis met de verbinding of met een foto. Probeer het opnieuw of neem telefonisch contact op: 06 47 30 10 48.";
          fout.classList.add("toon");
        });
    });
  }
})();
