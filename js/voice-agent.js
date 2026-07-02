/* ============================================================
   AIGEN SOLUTIONS — Agent vocal (client)
   Le navigateur parle à NOTRE backend (relais WebSocket sur
   Railway), qui tient la session Gemini Live avec la vraie clé
   (endpoint standard, fiable ; clé jamais exposée). Ici : audio
   micro/haut-parleurs (AudioWorklet), sous-titres, formulaire de
   lead inséré dans le chat, raccrochage gracieux. Aucun SDK côté
   navigateur : simple WebSocket + protocole JSON.
   ============================================================ */
const RAILWAY_HOST = "aigen-voice-backend-production.up.railway.app"; // backend relais (Railway)
const BOOKING_URL = "https://outlook.office.com/bookwithme/user/c673cf9ffdbd4c9c88b02c4b14af2704@aigen-solutions.fr/meetingtype/e2ZXfTWpkUSvi4rNgcr63w2?anonymous&ismsaljsauthenabled&ep=mlink";
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const IDLE_MS = 80000;  // garde-fou : coupe après 80s sans parole
const END_GRACE_MS = 4000; // après terminer_conversation : 4s de silence avant de raccrocher

function backendURL() {
  const h = location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "ws://localhost:8787/live";
  return "wss://" + RAILWAY_HOST + "/live";
}

const toB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const fromB64 = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };

/* ---------------- Client (WebSocket backend + audio) ---------------- */
class VoiceClient {
  constructor(handlers = {}) {
    this.h = handlers; // { onStatus, onTranscript, onLevel, onError, onClose, onForm, onEnd }
    this.ws = null;
    this.micStream = null; this.micCtx = null; this.captureNode = null; this.micAnalyser = null;
    this.playCtx = null; this.playNode = null; this.outAnalyser = null; this._pending = [];
    this.muted = false; this.raf = 0; this.speaking = false; this._spkTimer = 0;
    this.lastActivity = 0; this._timer = 0; this._idlePaused = false; this._endRequested = false;
  }

  connect() {
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
          this.lastActivity = Date.now();
          this._timer = setInterval(() => {
            if (this._idlePaused) return;
            const limit = this._endRequested ? END_GRACE_MS : IDLE_MS;
            if (Date.now() - this.lastActivity > limit) { this.h.onEnd && this.h.onEnd(this._endRequested ? "agent" : "idle"); }
          }, 1000);
          this._loopLevel();
          this.h.onStatus && this.h.onStatus("listening");
          clearTimeout(to); settled = true; resolve();
        } else if (m.t === "audio" && m.d) { this._playAudio(m.d); }
        else if (m.t === "in" && m.d) { this.lastActivity = Date.now(); this._endRequested = false; this.h.onTranscript && this.h.onTranscript("user", m.d); }
        else if (m.t === "out" && m.d) { this.lastActivity = Date.now(); this._setSpeaking(true); this.h.onTranscript && this.h.onTranscript("agent", m.d); }
        else if (m.t === "form") { this.pauseIdle(true); this.h.onForm && this.h.onForm(m.besoin || ""); }
        else if (m.t === "interrupt") { this.playNode && this.playNode.port.postMessage("interrupt"); this._setSpeaking(false); }
        else if (m.t === "end_requested") { this._endRequested = true; }
        else if (m.t === "error" || m.t === "closed") { if (settled) { this.h.onError && this.h.onError(m.m || m.t); } }
      };
    });
  }

  async _initPlayback() {
    this.playCtx = new AudioContext({ sampleRate: OUTPUT_RATE });
    if (this.playCtx.state === "suspended") await this.playCtx.resume();
    await this.playCtx.audioWorklet.addModule("/js/audio-processors/playback.worklet.js");
    this.playNode = new AudioWorkletNode(this.playCtx, "pcm-processor");
    this.outAnalyser = this.playCtx.createAnalyser(); this.outAnalyser.fftSize = 256;
    this.playNode.connect(this.outAnalyser);
    this.outAnalyser.connect(this.playCtx.destination);
    if (this._pending.length) { this._pending.forEach((f) => this.playNode.port.postMessage(f)); this._pending = []; }
  }

  _playAudio(b64) {
    const int16 = new Int16Array(fromB64(b64).buffer);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
    this.lastActivity = Date.now();
    this._setSpeaking(true);
    if (this.playNode) this.playNode.port.postMessage(f32); else this._pending.push(f32);
  }

  async startMic() {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    this.micCtx = new AudioContext({ sampleRate: INPUT_RATE });
    if (this.micCtx.state === "suspended") await this.micCtx.resume();
    await this.micCtx.audioWorklet.addModule("/js/audio-processors/capture.worklet.js");
    const src = this.micCtx.createMediaStreamSource(this.micStream);
    this.micAnalyser = this.micCtx.createAnalyser(); this.micAnalyser.fftSize = 256;
    src.connect(this.micAnalyser);
    this.captureNode = new AudioWorkletNode(this.micCtx, "audio-capture-processor");
    this.captureNode.port.onmessage = (ev) => {
      if (this.muted || !this.ws || this.ws.readyState !== 1 || ev.data.type !== "audio") return;
      const f32 = ev.data.data;
      const int16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); int16[i] = s * 0x7fff; }
      try { this.ws.send(JSON.stringify({ t: "audio", d: toB64(new Uint8Array(int16.buffer)) })); } catch (e) {}
    };
    src.connect(this.captureNode);
  }

  _setSpeaking(v) {
    this.speaking = v;
    this.h.onStatus && this.h.onStatus(v ? "speaking" : "listening");
    if (v) { clearTimeout(this._spkTimer); this._spkTimer = setTimeout(() => { this.speaking = false; this.h.onStatus && this.h.onStatus("listening"); }, 700); }
  }

  _level(a) {
    if (!a) return 0;
    const buf = new Uint8Array(a.fftSize); a.getByteTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / buf.length) * 2.6);
  }
  _loopLevel() {
    const tick = () => { this.h.onLevel && this.h.onLevel(Math.max(this.muted ? 0 : this._level(this.micAnalyser), this._level(this.outAnalyser))); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  setMuted(m) { this.muted = m; }
  pauseIdle(b) { this._idlePaused = b; this.lastActivity = Date.now(); }
  sendFormDone(nom, email) { try { this.ws && this.ws.readyState === 1 && this.ws.send(JSON.stringify({ t: "form_done", nom: nom, email: email })); } catch (e) {} }

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

/* ---------------- Widget (UI + machine à états) ---------------- */
const ICON_WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2"/><path d="M6 8v8"/><path d="M10 4v16"/><path d="M14 7v10"/><path d="M18 9v6"/><path d="M22 11v2"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
const ICON_MIC_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';

function mount() {
  const reduce = (function () { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
  let agent = null, state = "closed", lastRole = null, lastBubble = null, pendingBesoin = "";

  const launch = document.createElement("button");
  launch.className = "va-launch va-peek";
  launch.setAttribute("aria-label", "Tester AIGEN Live, l'assistant vocal");
  launch.innerHTML = '<span class="va-core"><i></i><i></i><i></i><i></i><span class="va-live">LIVE</span></span><span class="va-label">AIGEN&nbsp;Live</span>';

  const panel = document.createElement("div");
  panel.className = "va-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Assistant vocal AIGEN Solutions");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML =
    '<div class="va-head">' +
      '<span class="va-ava">' + ICON_WAVE + '</span>' +
      '<div class="va-id"><h4>AIGEN&nbsp;Live</h4><div class="va-sub" data-sub>Conseiller vocal IA</div></div>' +
      '<button class="va-close" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>' +
    '<div class="va-stage">' +
      '<div class="va-orb" data-orb><span></span><span></span><span></span></div>' +
      '<div class="va-status" data-status>Échangez de vive voix avec notre conseiller IA. Il vous présente AIGEN, comprend votre besoin et transmet votre demande.</div>' +
    '</div>' +
    '<div class="va-transcript" data-transcript aria-live="polite"></div>' +
    '<div class="va-controls" data-controls></div>' +
    '<div class="va-foot">Assistant IA, voix de synthèse. Micro requis. <a href="' + BOOKING_URL + '" target="_blank" rel="noopener">Préférer un créneau ?</a></div>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);
  setTimeout(function () { launch.classList.remove("va-peek"); }, 4000);

  const $ = (s) => panel.querySelector(s);
  const orb = $("[data-orb]"), statusEl = $("[data-status]"), subEl = $("[data-sub]"),
        transcript = $("[data-transcript]"), controls = $("[data-controls]");

  function open() { state = "open"; panel.classList.add("va-open"); panel.setAttribute("aria-hidden", "false"); launch.classList.add("va-hidden"); track("voice_open"); }
  function close() {
    panel.classList.remove("va-open", "va-incall"); panel.setAttribute("aria-hidden", "true");
    launch.classList.remove("va-hidden"); launch.focus();
    if (agent) { agent.disconnect(); agent = null; }
    transcript.innerHTML = ""; lastRole = null; state = "closed";
  }
  function track(n) { try { window.AIGENConsent && window.AIGENConsent.track(n); } catch (e) {} }

  function setStatus(s) {
    if (s === "connecting") { statusEl.textContent = "Le live démarre, un instant…"; subEl.textContent = "En direct"; orb.className = "va-orb is-think"; }
    else if (s === "listening") { statusEl.textContent = "Je vous écoute…"; subEl.textContent = "En direct · à l'écoute"; orb.className = "va-orb is-listen"; }
    else if (s === "speaking") { statusEl.textContent = "Le conseiller vous répond…"; subEl.textContent = "En direct · parle"; orb.className = "va-orb is-speak"; }
  }

  function addTranscript(role, text) {
    if (!text) return;
    if (role !== lastRole || (lastBubble && lastBubble.classList.contains("va-form"))) {
      lastBubble = document.createElement("div"); lastBubble.className = "va-line va-" + role;
      transcript.appendChild(lastBubble); lastRole = role;
    }
    lastBubble.textContent += (lastBubble.textContent ? " " : "") + text;
    transcript.scrollTop = transcript.scrollHeight;
  }
  function setLevel(lvl) { if (!reduce) orb.style.setProperty("--lvl", lvl.toFixed(3)); }

  function showError(kind) {
    panel.classList.remove("va-incall");
    statusEl.textContent = kind === "mic"
      ? "Je n'ai pas pu accéder au micro. Autorisez-le dans votre navigateur, ou écrivez-nous."
      : "L'assistant vocal est momentanément indisponible. Vous pouvez réserver un créneau ou nous écrire.";
    orb.className = "va-orb";
    controls.innerHTML = '<a class="va-alt" href="contact.html">Décrire mon besoin</a><a class="va-alt va-alt-primary" href="' + BOOKING_URL + '" target="_blank" rel="noopener">Choisir un créneau</a>';
  }

  function renderCallControls() {
    controls.innerHTML = '<button class="va-mute" data-mute aria-pressed="false">' + ICON_MIC + '<span>Couper le micro</span></button><button class="va-end" data-end>Raccrocher</button>';
    panel.querySelector("[data-mute]").addEventListener("click", toggleMute);
    panel.querySelector("[data-end]").addEventListener("click", close);
  }

  function showLeadForm(besoin) {
    pendingBesoin = besoin || "";
    if (transcript.querySelector(".va-form")) return;
    const form = document.createElement("form");
    form.className = "va-form";
    form.innerHTML =
      '<div class="va-form-t">Vos coordonnées</div>' +
      '<input name="nom" autocomplete="name" placeholder="Nom et prénom" required>' +
      '<input name="email" type="email" autocomplete="email" placeholder="Email" required>' +
      '<input name="entreprise" autocomplete="organization" placeholder="Entreprise">' +
      '<input name="secteur" placeholder="Secteur d\'activité">' +
      '<input name="tel" type="tel" autocomplete="tel" placeholder="Téléphone (recommandé)">' +
      '<button type="submit">Envoyer ma demande</button>' +
      '<div class="va-form-note" data-note></div>';
    transcript.appendChild(form); lastRole = null; lastBubble = form;
    transcript.scrollTop = transcript.scrollHeight;
    const first = form.querySelector("input"); if (first) setTimeout(function () { first.focus(); }, 120);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const nom = form.nom.value.trim(), email = form.email.value.trim(), entreprise = form.entreprise.value.trim(), secteur = form.secteur.value.trim(), tel = form.tel.value.trim();
      const note = form.querySelector("[data-note]");
      if (!nom || !/.+@.+\..+/.test(email)) { if (note) note.textContent = "Indiquez au moins un nom et un email valide."; return; }
      const btn = form.querySelector("button"); btn.disabled = true; btn.textContent = "Envoi…";
      fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nom, email: email, company: entreprise, sector: secteur,
          topic: "Demande via assistant vocal IA",
          message: (pendingBesoin ? ("Besoin : " + pendingBesoin + "\n") : "") + (tel ? ("Téléphone : " + tel) : "")
        })
      }).then(function (r) {
        if (agent) agent.pauseIdle(false);
        if (r.ok) {
          track("generate_lead");
          form.innerHTML = '<div class="va-form-ok">✓ Merci, votre demande est transmise. Vous recevrez un email d\'invitation pour un échange de 30 minutes.</div>';
          if (agent) agent.sendFormDone(nom, email);
        } else { btn.disabled = false; btn.textContent = "Réessayer"; if (note) note.textContent = "Échec de l'envoi. Réessayez ou écrivez-nous."; }
      }).catch(function () {
        if (agent) agent.pauseIdle(false);
        const b = form.querySelector("button"); if (b) { b.disabled = false; b.textContent = "Réessayer"; }
        if (note) note.textContent = "Échec de l'envoi. Réessayez.";
      });
    });
  }

  function makeAgent() {
    return new VoiceClient({
      onStatus: setStatus, onTranscript: addTranscript, onLevel: setLevel,
      onError: () => { if (state === "call") endCall("closed"); },
      onClose: () => { if (state === "call") endCall("closed"); },
      onForm: showLeadForm, onEnd: (reason) => endCall(reason)
    });
  }
  function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }

  async function startCall() {
    if (agent) return;
    if (!navigator.mediaDevices || !window.AudioContext || !window.WebSocket) { showError("net"); return; }
    transcript.innerHTML = ""; lastRole = null; lastBubble = null;
    panel.classList.add("va-incall");
    setStatus("connecting"); renderCallControls();
    let micDenied = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const a = makeAgent();
      try {
        await withTimeout(a.connect(), 9500);
        agent = a; state = "call"; track("voice_start");
        return;
      } catch (e) {
        try { a.disconnect(); } catch (_) {}
        if (e && /Permission|denied|NotAllowed/i.test(String(e.name || e.message))) { micDenied = true; break; }
        if (attempt < 5) { setStatus("connecting"); await new Promise((r) => setTimeout(r, 450)); }
      }
    }
    showError(micDenied ? "mic" : "net"); cleanup();
  }

  function toggleMute() {
    if (!agent) return;
    const btn = panel.querySelector("[data-mute]");
    const muted = btn.getAttribute("aria-pressed") === "true";
    agent.setMuted(!muted);
    btn.setAttribute("aria-pressed", String(!muted));
    btn.innerHTML = (!muted ? ICON_MIC_OFF : ICON_MIC) + "<span>" + (!muted ? "Réactiver le micro" : "Couper le micro") + "</span>";
    btn.classList.toggle("is-muted", !muted);
  }

  function endCall(reason) {
    if (state === "ended") return;
    if (agent) { agent.disconnect(); agent = null; }
    state = "ended";
    orb.className = "va-orb";
    statusEl.textContent = reason === "idle" ? "Conversation terminée (pas d'activité). Merci de votre visite." : "Conversation terminée. Merci de votre visite.";
    subEl.textContent = "Terminé";
    controls.innerHTML = '<button class="va-end" data-close>Fermer</button>';
    const cb = panel.querySelector("[data-close]"); if (cb) cb.addEventListener("click", close);
  }
  function cleanup() { if (agent) { agent.disconnect(); agent = null; } state = "ended"; }

  launch.addEventListener("click", function () { open(); startCall(); });
  $(".va-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("va-open")) close(); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
