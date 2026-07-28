/* ============================================================
   AIGEN SOLUTIONS — Agent vocal (client)
   Le navigateur parle au backend Railway (relais WebSocket) qui
   tient la session Gemini Live. Ici : audio (AudioWorklet),
   sous-titres, DÉCOUVERTE commerciale, formulaire adaptatif au
   canal (visio/appel/email) + upload de document, carte de
   réservation Bookings, reprise de session (localStorage).
   ============================================================ */
const RAILWAY_HOST = "aigen-voice-backend-production.up.railway.app"; // backend relais (Railway)
const BOOKING_URL = "https://outlook.office.com/bookwithme/user/c673cf9ffdbd4c9c88b02c4b14af2704@aigen-solutions.fr/meetingtype/e2ZXfTWpkUSvi4rNgcr63w2?anonymous&ismsaljsauthenabled&ep=mlink";
const INPUT_RATE = 16000, OUTPUT_RATE = 24000;
const IDLE_MS = 90000, END_GRACE_MS = 4000;
const SESSION_KEY = "aigen_va_session";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 jours
const MAX_FILE = 8 * 1024 * 1024; // 8 Mo

function backendURL() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "ws://localhost:8787/live";
  return "wss://" + RAILWAY_HOST + "/live";
}
function leadURL() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8787/lead";
  return "https://" + RAILWAY_HOST + "/lead";
}
// Traduction (js/i18n.js) : T('clé', 'texte français source')
const T = (k, fr) => (window.AIGENI18N ? window.AIGENI18N.t(k, fr) : fr);
const LANG = () => (window.AIGENI18N && window.AIGENI18N.lang) || "fr";
const toB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const fromB64 = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };

/* ---------- Mémoire de session (localStorage) ---------- */
function loadSession() { try { const r = JSON.parse(localStorage.getItem(SESSION_KEY)); if (r && r.ts && (Date.now() - r.ts) < SESSION_MAX_AGE && (r.lines || []).length) return r; } catch (e) {} return null; }
function saveSession(s) { try { s.ts = Date.now(); localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
function resumeSummary(s) {
  if (!s) return "";
  const parts = [];
  if (s.synthese) parts.push("Ce qu'on avait compris : " + s.synthese);
  if (s.contact && (s.contact.entreprise || s.contact.secteur)) parts.push("(" + [s.contact.entreprise, s.contact.secteur].filter(Boolean).join(", ") + ")");
  if (s.lines && s.lines.length) parts.push("Derniers échanges : " + s.lines.slice(-8).join(" | "));
  return parts.join(" ").slice(0, 1500);
}

/* ---------------- Client (WebSocket backend + audio) ---------------- */
class VoiceClient {
  constructor(handlers = {}) {
    this.h = handlers;
    this.ws = null;
    this.micStream = null; this.micCtx = null; this.captureNode = null; this.micAnalyser = null;
    this.playCtx = null; this.playNode = null; this.outAnalyser = null; this._pending = [];
    this.muted = false; this.raf = 0; this.speaking = false; this._spkTimer = 0;
    this.lastActivity = 0; this._timer = 0; this._idlePaused = false; this._endRequested = false; this._drainedAt = 0; this._endAt = 0;
  }

  connect(resume) {
    return new Promise((resolve, reject) => {
      this.h.onStatus && this.h.onStatus("connecting");
      let settled = false, ws;
      try { ws = new WebSocket(backendURL()); } catch (e) { reject(e); return; }
      this.ws = ws;
      const to = setTimeout(() => { if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error("timeout")); } }, 9000);
      ws.onerror = () => { if (!settled) { settled = true; clearTimeout(to); reject(new Error("ws_error")); } };
      ws.onclose = () => { if (!settled) { settled = true; clearTimeout(to); reject(new Error("ws_closed")); } else { this.h.onClose && this.h.onClose(); } };
      ws.onmessage = async (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === "ready") {
          try { await this._initPlayback(); await this.startMic(); }
          catch (e) { clearTimeout(to); if (!settled) { settled = true; reject(e); } return; }
          try { ws.send(JSON.stringify({ t: "start", resume: resume || "", page: location.pathname, lang: LANG() })); } catch (e) {}
          this.lastActivity = Date.now();
          this._timer = setInterval(() => {
            if (this._idlePaused) return;
            if (this._endRequested) {
              // attendre que la VOIX soit finie (file de lecture vidée) + 2s de sécurité, jamais couper une phrase
              const voiceDone = this._drainedAt > 0 && (Date.now() - this._drainedAt) >= 2000;
              const capped = (Date.now() - this._endAt) > 25000; // anti-blocage
              if (voiceDone || capped) { this.h.onEnd && this.h.onEnd("agent"); }
            } else if (Date.now() - this.lastActivity > IDLE_MS) {
              this.h.onEnd && this.h.onEnd("idle");
            }
          }, 400);
          this._loopLevel();
          this.h.onStatus && this.h.onStatus("listening");
          clearTimeout(to); settled = true; resolve();
        } else if (m.t === "audio" && m.d) { this._playAudio(m.d); }
        else if (m.t === "in" && m.d) { this.lastActivity = Date.now(); this._endRequested = false; this.h.onTranscript && this.h.onTranscript("user", m.d); }
        else if (m.t === "out" && m.d) { this.lastActivity = Date.now(); this._setSpeaking(true); this.h.onTranscript && this.h.onTranscript("agent", m.d); }
        else if (m.t === "contact") { this.pauseIdle(true); this.h.onContact && this.h.onContact(m.mode || "visio", m.synthese || ""); }
        else if (m.t === "interrupt") { this.playNode && this.playNode.port.postMessage("interrupt"); this._drainedAt = 0; this._setSpeaking(false); }
        else if (m.t === "end_requested") { this._endRequested = true; this._endAt = Date.now(); }
        else if (m.t === "error" || m.t === "closed") { if (settled) { this.h.onError && this.h.onError(m.m || m.t); } }
      };
    });
  }

  async _initPlayback() {
    this.playCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
    if (this.playCtx.state === "suspended") await this.playCtx.resume();
    await this.playCtx.audioWorklet.addModule("/js/audio-processors/playback.worklet.js");
    this.playNode = new AudioWorkletNode(this.playCtx, "pcm-processor");
    this.playNode.port.onmessage = (e) => { if (e.data === "drained") this._drainedAt = Date.now(); }; // voix finie de jouer
    this.outAnalyser = this.playCtx.createAnalyser(); this.outAnalyser.fftSize = 256;
    this.playNode.connect(this.outAnalyser); this.outAnalyser.connect(this.playCtx.destination);
    if (this._pending.length) { this._pending.forEach((f) => this.playNode.port.postMessage(f)); this._pending = []; }
  }
  _playAudio(b64) {
    const int16 = new Int16Array(fromB64(b64).buffer);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    this.lastActivity = Date.now(); this._drainedAt = 0; this._setSpeaking(true);
    if (this.playNode) this.playNode.port.postMessage(f32); else this._pending.push(f32);
  }
  async startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.micCtx = new AudioContext({ sampleRate: INPUT_RATE });
    if (this.micCtx.state === "suspended") await this.micCtx.resume();
    await this.micCtx.audioWorklet.addModule("/js/audio-processors/capture.worklet.js");
    const src = this.micCtx.createMediaStreamSource(this.micStream);
    this.micAnalyser = this.micCtx.createAnalyser(); this.micAnalyser.fftSize = 256; src.connect(this.micAnalyser);
    this.captureNode = new AudioWorkletNode(this.micCtx, "audio-capture-processor");
    this.captureNode.port.onmessage = (ev) => {
      if (this.muted || !this.ws || this.ws.readyState !== 1 || ev.data.type !== "audio") return;
      const f32 = ev.data.data, int16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); int16[i] = s * 0x7fff; }
      try { this.ws.send(JSON.stringify({ t: "audio", d: toB64(new Uint8Array(int16.buffer)) })); } catch (e) {}
    };
    src.connect(this.captureNode);
  }
  _setSpeaking(v) {
    this.speaking = v; this.h.onStatus && this.h.onStatus(v ? "speaking" : "listening");
    if (v) { clearTimeout(this._spkTimer); this._spkTimer = setTimeout(() => { this.speaking = false; this.h.onStatus && this.h.onStatus("listening"); }, 700); }
  }
  _level(a) { if (!a) return 0; const b = new Uint8Array(a.fftSize); a.getByteTimeDomainData(b); let s = 0; for (let i = 0; i < b.length; i++) { const v = (b[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / b.length) * 2.6); }
  _loopLevel() { const tick = () => { this.h.onLevel && this.h.onLevel(Math.max(this.muted ? 0 : this._level(this.micAnalyser), this._level(this.outAnalyser))); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }
  setMuted(m) { this.muted = m; }
  pauseIdle(b) { this._idlePaused = b; this.lastActivity = Date.now(); }
  sendFormDone(nom, email, mode) { try { this.ws && this.ws.readyState === 1 && this.ws.send(JSON.stringify({ t: "form_done", nom, email, mode })); } catch (e) {} }
  disconnect() {
    cancelAnimationFrame(this.raf); clearInterval(this._timer);
    try { this.micStream && this.micStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { this.captureNode && this.captureNode.disconnect(); } catch (e) {}
    try { this.micCtx && this.micCtx.close(); } catch (e) {}
    try { this.playNode && this.playNode.disconnect(); } catch (e) {}
    try { this.playCtx && this.playCtx.close(); } catch (e) {}
    try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch (e) {}
    this.ws = this.micCtx = this.playCtx = null;
  }
}

/* ---------------- Widget ---------------- */
const ICON_WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2"/><path d="M6 8v8"/><path d="M10 4v16"/><path d="M14 7v10"/><path d="M18 9v6"/><path d="M22 11v2"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
const ICON_MIC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

function mount() {
  const reduce = (function () { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
  let agent = null, state = "closed", lastRole = null, lastBubble = null, curMode = "visio", curSynthese = "";
  let sess = { ts: 0, lines: [], synthese: "", contact: null }, saveT = 0;

  // Découvrabilité : tant que le visiteur n'a JAMAIS essayé l'agent, l'étiquette
  // reste visible et un halo discret pulse. Après un premier essai : orbe sobre.
  const KNOWN_KEY = "aigen_va_used", TEASE_KEY = "aigen_va_teased";
  const isKnown = () => { try { return !!localStorage.getItem(KNOWN_KEY); } catch (e) { return false; } };
  const markKnown = () => { try { localStorage.setItem(KNOWN_KEY, String(Date.now())); } catch (e) {} };

  const launch = document.createElement("button");
  launch.className = "va-launch va-peek";
  launch.setAttribute("aria-label", T("va.launch.aria", "Tester AIGEN Live, l'assistant vocal"));
  launch.innerHTML = '<span class="va-core"><i></i><i></i><i></i><i></i><span class="va-live">LIVE</span></span><span class="va-label">' + (isKnown() ? "AIGEN&nbsp;Live" : T("va.launch.try", "Essayer l'agent vocal")) + '</span>';

  const panel = document.createElement("div");
  panel.className = "va-panel"; panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", T("va.panel.aria", "Assistant vocal AIGEN Solutions")); panel.setAttribute("aria-hidden", "true");
  panel.innerHTML =
    '<div class="va-head"><span class="va-ava">' + ICON_WAVE + '</span>' +
      '<div class="va-id"><h4>AIGEN&nbsp;Live</h4><div class="va-sub" data-sub>' + T("va.sub.idle", "Conseiller vocal IA") + '</div></div>' +
      '<button class="va-close" aria-label="' + T("va.close", "Fermer") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' +
    '<div class="va-stage"><div class="va-orb" data-orb><span></span><span></span><span></span></div>' +
      '<div class="va-status" data-status>' + T("va.intro", "Échangez de vive voix avec notre conseiller IA. Il comprend votre besoin et prépare votre premier échange.") + '</div></div>' +
    '<div class="va-transcript" data-transcript aria-live="polite"></div>' +
    '<div class="va-controls" data-controls></div>' +
    '<div class="va-foot">' + T("va.foot", "Assistant IA, voix de synthèse. Micro requis.") + ' <a href="' + BOOKING_URL + '" target="_blank" rel="noopener">' + T("va.foot.slot", "Préférer un créneau ?") + '</a></div>';

  document.body.appendChild(launch); document.body.appendChild(panel);
  if (isKnown()) setTimeout(function () { launch.classList.remove("va-peek"); }, 4000);
  else if (!reduce) launch.classList.add("va-pulse");

  const $ = (s) => panel.querySelector(s);
  const orb = $("[data-orb]"), statusEl = $("[data-status]"), subEl = $("[data-sub]"), transcript = $("[data-transcript]"), controls = $("[data-controls]");

  function track(n) { try { window.AIGENConsent && window.AIGENConsent.track(n); } catch (e) {} }
  function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(() => { if (sess.lines.length) saveSession(sess); }, 900); }

  function open() { state = "open"; markKnown(); hideTeaser(); launch.classList.remove("va-pulse", "va-peek"); panel.classList.add("va-open"); panel.setAttribute("aria-hidden", "false"); launch.classList.add("va-hidden"); track("voice_open"); }
  function close() {
    panel.classList.remove("va-open", "va-incall"); panel.setAttribute("aria-hidden", "true");
    launch.classList.remove("va-hidden"); launch.focus();
    if (agent) { agent.disconnect(); agent = null; }
    transcript.innerHTML = ""; lastRole = null; state = "closed";
  }

  function setStatus(s) {
    if (s === "connecting") { statusEl.textContent = T("va.st.connect", "Le live démarre, un instant…"); subEl.textContent = T("va.sub.live", "En direct"); orb.className = "va-orb is-think"; }
    else if (s === "listening") { statusEl.textContent = T("va.st.listen", "Je vous écoute…"); subEl.textContent = T("va.sub.listen", "En direct · à l'écoute"); orb.className = "va-orb is-listen"; }
    else if (s === "speaking") { statusEl.textContent = T("va.st.speak", "Le conseiller vous répond…"); subEl.textContent = T("va.sub.speak", "En direct · parle"); orb.className = "va-orb is-speak"; }
  }
  function setLevel(lvl) { if (!reduce) orb.style.setProperty("--lvl", lvl.toFixed(3)); }

  function addTranscript(role, text) {
    if (!text) return;
    const speaker = role === "user" ? "Visiteur" : "Conseiller";
    if (role !== lastRole || (lastBubble && lastBubble.classList.contains("va-form"))) {
      lastBubble = document.createElement("div"); lastBubble.className = "va-line va-" + role;
      lastBubble.textContent = text; transcript.appendChild(lastBubble); lastRole = role;
      sess.lines.push(speaker + ": " + text);
    } else {
      lastBubble.textContent += " " + text;
      sess.lines[sess.lines.length - 1] += " " + text;
    }
    if (sess.lines.length > 40) sess.lines = sess.lines.slice(-40);
    transcript.scrollTop = transcript.scrollHeight; scheduleSave();
  }

  /* ----- Formulaire adaptatif au canal ----- */
  function showContactForm(mode, synthese) {
    curMode = mode; curSynthese = synthese || "";
    if (transcript.querySelector(".va-form")) return;
    const isCall = mode === "appel";
    const title = mode === "appel" ? T("va.f.t.call", "Vos coordonnées (pour l'appel)") : (mode === "email" ? T("va.f.t.email", "Vos coordonnées") : T("va.f.t.visio", "Vos coordonnées (pour la visio)"));
    const form = document.createElement("form"); form.className = "va-form";
    form.innerHTML =
      '<div class="va-form-t">' + title + '</div>' +
      '<input name="nom" autocomplete="name" placeholder="' + T("va.f.name", "Nom et prénom") + '" required>' +
      '<input name="email" type="email" autocomplete="email" placeholder="' + T("va.f.email", "Email") + '" required>' +
      '<input name="entreprise" autocomplete="organization" placeholder="' + T("va.f.company", "Entreprise") + '">' +
      '<input name="secteur" placeholder="' + T("va.f.sector", "Secteur d\'activité") + '">' +
      '<input name="tel" type="tel" autocomplete="tel" placeholder="' + (isCall ? T("va.f.tel", "Téléphone") : T("va.f.tel.rec", "Téléphone (recommandé)")) + '"' + (isCall ? " required" : "") + '>' +
      (isCall ? '<input name="creneau" placeholder="' + T("va.f.slot", "Créneau qui vous arrange (ex : demain après-midi)") + '">' : '') +
      '<label class="va-file"><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx,.csv,.txt" hidden><span class="va-file-lab">' + T("va.f.file", "📎 Joindre un document (optionnel)") + '</span></label>' +
      '<button type="submit">' + T("va.f.send", "Transmettre ma demande") + '</button>' +
      '<div class="va-form-note" data-note></div>';
    transcript.appendChild(form); lastRole = null; lastBubble = form;
    transcript.scrollTop = transcript.scrollHeight;
    const first = form.querySelector("input"); if (first) setTimeout(() => first.focus(), 120);

    const fileInput = form.querySelector('input[type="file"]'), fileLab = form.querySelector(".va-file-lab");
    let file = null;
    fileInput.addEventListener("change", () => {
      file = fileInput.files[0] || null;
      if (file && file.size > MAX_FILE) { fileLab.textContent = T("va.f.file.big", "Fichier trop lourd (max 8 Mo)"); file = null; fileInput.value = ""; return; }
      fileLab.textContent = file ? ("📎 " + file.name) : T("va.f.file", "📎 Joindre un document (optionnel)");
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const g = (n) => (form[n] ? form[n].value.trim() : "");
      const nom = g("nom"), email = g("email"), entreprise = g("entreprise"), secteur = g("secteur"), tel = g("tel"), creneau = g("creneau");
      const note = form.querySelector("[data-note]");
      if (!nom || !/.+@.+\..+/.test(email)) { note.textContent = T("va.f.err.id", "Indiquez au moins un nom et un email valide."); return; }
      if (isCall && !tel) { note.textContent = T("va.f.err.tel", "Indiquez un numéro pour être rappelé."); return; }
      const btn = form.querySelector("button"); btn.disabled = true; btn.textContent = T("va.f.sending", "Envoi…");
      let attachment = null;
      if (file) { try { attachment = { filename: file.name, content: await fileToB64(file) }; } catch (err) {} }
      const payload = { name: nom, email, company: entreprise, sector: secteur, tel, creneau, mode, synthese: curSynthese, topic: "Demande via assistant vocal IA (" + mode + ")", attachment, lang: LANG() };
      sess.contact = { nom, email, entreprise, secteur, mode }; if (curSynthese) sess.synthese = curSynthese; scheduleSave();
      fetch(leadURL(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then((r) => {
          if (agent) agent.pauseIdle(false);
          if (r.ok) {
            track("generate_lead");
            if (agent) agent.sendFormDone(nom, email, mode);
            form.replaceWith(successBlock(mode));
            transcript.scrollTop = transcript.scrollHeight;
          } else if (r.status === 429) { btn.disabled = false; btn.textContent = "Réessayer"; note.textContent = "Trop de demandes en peu de temps. Patientez quelques minutes."; }
          else { btn.disabled = false; btn.textContent = "Réessayer"; note.textContent = "Échec de l'envoi. Réessayez ou écrivez-nous."; }
        })
        .catch(() => { if (agent) agent.pauseIdle(false); btn.disabled = false; btn.textContent = "Réessayer"; note.textContent = "Échec de l'envoi. Réessayez."; });
    });
  }

  function successBlock(mode) {
    const wrap = document.createElement("div"); wrap.className = "va-form";
    if (mode === "visio") {
      wrap.innerHTML =
        '<div class="va-form-ok">' + T("va.ok.visio", "✓ Demande transmise. Dernière étape : choisissez votre créneau.") + '</div>' +
        '<div class="va-booking"><div class="va-booking-h">' + ICON_CAL + ' ' + T("va.book.h", "Réservez votre créneau de 30 min") + '</div>' +
        '<p>' + T("va.book.p", "Vous recevrez l\'invitation avec le lien de la réunion.") + '</p>' +
        '<a class="va-booking-btn" href="' + BOOKING_URL + '" target="_blank" rel="noopener" data-booking>' + T("va.book.btn", "Choisir un créneau") + '</a></div>';
      const b = wrap.querySelector("[data-booking]"); if (b) b.addEventListener("click", () => track("book_appointment"));
    } else if (mode === "appel") {
      wrap.innerHTML = '<div class="va-form-ok">' + T("va.ok.call", "✓ Demande transmise. Un conseiller vous rappellera au créneau indiqué, et vous recevrez un email de confirmation.") + '</div>';
    } else {
      wrap.innerHTML = '<div class="va-form-ok">' + T("va.ok.email", "✓ Demande transmise. Vous allez recevoir un récapitulatif et des informations par email.") + '</div>';
    }
    return wrap;
  }
  function fileToB64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const s = String(r.result); res(s.slice(s.indexOf(",") + 1)); }; r.onerror = rej; r.readAsDataURL(file); });
  }

  function showError(kind) {
    panel.classList.remove("va-incall");
    statusEl.textContent = kind === "mic" ? T("va.err.mic", "Je n'ai pas pu accéder au micro. Autorisez-le dans votre navigateur, ou écrivez-nous.") : T("va.err.net", "L'assistant vocal est momentanément indisponible. Vous pouvez réserver un créneau ou nous écrire.");
    orb.className = "va-orb";
    controls.innerHTML = '<a class="va-alt" href="contact.html">' + T("va.alt.write", "Décrire mon besoin") + '</a><a class="va-alt va-alt-primary" href="' + BOOKING_URL + '" target="_blank" rel="noopener">' + T("va.book.btn", "Choisir un créneau") + '</a>';
  }
  function renderCallControls() {
    controls.innerHTML = '<button class="va-mute" data-mute aria-pressed="false">' + ICON_MIC + '<span>' + T("va.mute", "Couper le micro") + '</span></button><button class="va-end" data-end>' + T("va.hangup", "Raccrocher") + '</button>';
    panel.querySelector("[data-mute]").addEventListener("click", toggleMute);
    panel.querySelector("[data-end]").addEventListener("click", close);
  }
  function toggleMute() {
    if (!agent) return;
    const btn = panel.querySelector("[data-mute]"); const muted = btn.getAttribute("aria-pressed") === "true";
    agent.setMuted(!muted); btn.setAttribute("aria-pressed", String(!muted));
    btn.innerHTML = (!muted ? ICON_MIC_OFF : ICON_MIC) + "<span>" + (!muted ? T("va.unmute", "Réactiver le micro") : T("va.mute", "Couper le micro")) + "</span>";
    btn.classList.toggle("is-muted", !muted);
  }

  function makeAgent() {
    return new VoiceClient({
      onStatus: setStatus, onTranscript: addTranscript, onLevel: setLevel,
      onError: () => { if (state === "call") endCall("closed"); },
      onClose: () => { if (state === "call") endCall("closed"); },
      onContact: showContactForm, onEnd: (reason) => endCall(reason)
    });
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }

  async function startCall(resume) {
    if (agent) return;
    if (!navigator.mediaDevices || !window.AudioContext || !window.WebSocket) { showError("net"); return; }
    transcript.innerHTML = ""; lastRole = null; lastBubble = null;
    if (!resume) sess = { ts: 0, lines: [], synthese: "", contact: null };
    panel.classList.add("va-incall"); setStatus("connecting"); renderCallControls();
    let micDenied = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const a = makeAgent();
      try { await withTimeout(a.connect(resume || ""), 9500); agent = a; state = "call"; track("voice_start"); return; }
      catch (e) {
        try { a.disconnect(); } catch (_) {}
        if (e && /Permission|denied|NotAllowed/i.test(String(e.name || e.message))) { micDenied = true; break; }
        if (attempt < 5) { setStatus("connecting"); await new Promise((r) => setTimeout(r, 450)); }
      }
    }
    showError(micDenied ? "mic" : "net"); if (agent) { agent.disconnect(); agent = null; } state = "ended";
  }

  function endCall(reason) {
    if (state === "ended") return;
    if (agent) { agent.disconnect(); agent = null; }
    state = "ended"; orb.className = "va-orb";
    statusEl.textContent = reason === "idle" ? T("va.end.idle", "Conversation terminée (pas d'activité). Merci de votre visite.") : T("va.end", "Conversation terminée. Merci de votre visite.");
    subEl.textContent = T("va.sub.end", "Terminé");
    controls.innerHTML = '<button class="va-end" data-close>' + T("va.close", "Fermer") + '</button>';
    const cb = panel.querySelector("[data-close]"); if (cb) cb.addEventListener("click", close);
    if (sess.lines.length) saveSession(sess);
  }

  /* ----- Reprise de session (visiteur de retour) ----- */
  function showResumeChoice() {
    open();
    panel.classList.add("va-incall");
    orb.className = "va-orb is-listen";
    statusEl.textContent = T("va.back.hi", "Content de vous revoir 👋");
    subEl.textContent = T("va.back.sub", "On continue ?");
    transcript.innerHTML = "";
    const box = document.createElement("div"); box.className = "va-resume";
    box.innerHTML = '<p>' + T("va.back.q", "On reprend là où on s\'était arrêtés, ou on repart sur une nouvelle idée ?") + '</p>' +
      '<div class="va-resume-btns"><button data-resume>' + T("va.back.resume", "Reprendre le fil") + '</button><button data-fresh class="ghost">' + T("va.back.fresh", "Nouveau sujet") + '</button></div>';
    transcript.appendChild(box);
    controls.innerHTML = "";
    box.querySelector("[data-resume]").addEventListener("click", () => { const sum = resumeSummary(loadSession()); transcript.innerHTML = ""; startCall(sum); });
    box.querySelector("[data-fresh]").addEventListener("click", () => { clearSession(); sess = { ts: 0, lines: [], synthese: "", contact: null }; transcript.innerHTML = ""; startCall(""); });
  }

  function openAgent() {
    if (panel.classList.contains("va-open")) return;
    if (loadSession()) showResumeChoice(); else { open(); startCall(""); }
  }
  launch.addEventListener("click", openAgent);
  $(".va-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("va-open")) close(); });

  /* ----- Ouverture depuis n'importe quel bouton [data-va-open] (hero, contact, réalisations) ----- */
  document.addEventListener("click", function (e) {
    const t = e.target.closest && e.target.closest("[data-va-open]");
    if (!t) return;
    e.preventDefault(); openAgent();
  });

  /* ----- Invitation unique (jamais répétée avant 30 jours, jamais après un essai) ----- */
  let teaser = null;
  function hideTeaser() { if (teaser) { teaser.remove(); teaser = null; } }
  (function armTeaser() {
    if (isKnown()) return;
    let last = 0; try { last = parseInt(localStorage.getItem(TEASE_KEY) || "0", 10) || 0; } catch (e) {}
    if (Date.now() - last < 1000 * 60 * 60 * 24 * 30) return;
    function tryShow() {
      if (isKnown() || panel.classList.contains("va-open") || document.querySelector(".va-rdv")) return;
      if (document.querySelector(".cookie-bar")) { setTimeout(tryShow, 3000); return; } // le choix cookies d'abord
      try { localStorage.setItem(TEASE_KEY, String(Date.now())); } catch (e) {}
      teaser = document.createElement("div"); teaser.className = "va-teaser";
      teaser.setAttribute("role", "note");
      teaser.innerHTML = '<button class="va-teaser-x" aria-label="' + T("va.tease.no", "Non merci") + '">&times;</button>' +
        '<p>' + T("va.tease.p", "Une question ? Notre <strong>agent vocal</strong> vous répond de vive voix.") + '</p>' +
        '<button class="va-teaser-go">' + T("va.tease.go", "Essayer") + '</button>';
      document.body.appendChild(teaser);
      requestAnimationFrame(function () { teaser.classList.add("in"); });
      teaser.querySelector(".va-teaser-x").addEventListener("click", hideTeaser);
      teaser.querySelector(".va-teaser-go").addEventListener("click", function () { hideTeaser(); openAgent(); });
    }
    setTimeout(tryShow, 12000);
  })();

  /* ----- RDV : proposer de préparer avec l'agent avant Bookings (jamais un cul-de-sac) ----- */
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("a[data-booking]");
    if (!a || a.closest(".va-panel")) return;               // depuis le chat : réservation directe
    let seen = false; try { seen = !!sessionStorage.getItem("aigen_rdv_seen"); } catch (er) {}
    if (seen || isKnown()) return;                          // connaît déjà l'agent (ou déjà proposé) : direct
    e.preventDefault(); e.stopPropagation();
    try { sessionStorage.setItem("aigen_rdv_seen", "1"); } catch (er) {}
    hideTeaser();
    const href = a.getAttribute("href");
    const ov = document.createElement("div"); ov.className = "va-rdv";
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", T("va.rdv.aria", "Préparer votre rendez-vous"));
    ov.innerHTML = '<div class="va-rdv-card"><button class="va-rdv-x" aria-label="' + T("va.close", "Fermer") + '">&times;</button>' +
      '<h4>' + T("va.rdv.h", "Votre rendez-vous, mieux préparé") + '</h4>' +
      '<p>' + T("va.rdv.p", "En deux minutes, décrivez votre besoin à notre agent vocal : votre premier échange sera préparé sur-mesure.") + '</p>' +
      '<div class="va-rdv-btns"><button class="va-rdv-agent">' + ICON_MIC + '<span>' + T("va.rdv.agent", "Décrire mon besoin à l\'agent") + '</span></button>' +
      '<button class="va-rdv-direct">' + T("va.rdv.direct", "Réserver directement") + '</button></div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("in"); });
    const kill = function () { ov.remove(); };
    ov.addEventListener("click", function (ev) { if (ev.target === ov) kill(); });
    ov.querySelector(".va-rdv-x").addEventListener("click", kill);
    ov.querySelector(".va-rdv-agent").addEventListener("click", function () { kill(); openAgent(); });
    ov.querySelector(".va-rdv-direct").addEventListener("click", function () { track("book_appointment"); kill(); window.open(href, "_blank", "noopener"); });
  }, true);
}

// Attendre le dictionnaire de langue (immédiat en français) avant de monter le widget
function bootVA() {
  if (window.AIGENI18N) window.AIGENI18N.ready(mount);
  else mount();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootVA);
else bootVA();
