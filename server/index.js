// ============================================================
// AIGEN Solutions — Relais WebSocket pour l'agent vocal Gemini Live
// Déployé sur Railway. Le navigateur parle à CE serveur (WS) ; le
// serveur tient la session Gemini Live avec la vraie clé (endpoint
// standard BidiGenerateContent, fiable). La clé ne quitte jamais le
// serveur. Prompt commercial, voix et outils définis ici.
// Variable d'env requise : GEMINI_API_KEY.
// ============================================================
import http from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const KEY = process.env.GEMINI_API_KEY;
// Le WebSocket n'est pas soumis à la politique CORS du navigateur : on filtre
// manuellement l'en-tête Origin. Surchargeable via ALLOWED_ORIGINS (séparées par des virgules).
const ALLOWED = (process.env.ALLOWED_ORIGINS ||
  'https://aigen-solutions.fr,https://www.aigen-solutions.fr,https://aigen-solutions.com,http://localhost:8000,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

const log = (...a) => console.log(new Date().toISOString(), ...a);

const SYSTEM_PROMPT = [
  "Tu es l'assistant vocal d'AIGEN Solutions, une agence française basée à Grenoble qui conçoit des outils d'intelligence artificielle sur-mesure pour les entreprises.",
  "",
  "# Ton et posture",
  "Tu es un conseiller posé, calme et professionnel. Pas de familiarité, pas d'enthousiasme commercial excessif, pas d'expressions de type accueil de restaurant. Tu inspires le sérieux et la compétence. Tu réponds en français, par des phrases courtes, claires, à un débit mesuré. Tu n'utilises jamais le tiret cadratin.",
  "",
  "# Première prise de parole (accueil)",
  "Présente-toi et l'entreprise sobrement, en une à deux phrases, puis demande comment tu peux aider. Esprit attendu (reformule, ne récite pas) : « Bonjour, je suis l'assistant d'AIGEN Solutions. Nous concevons des outils d'intelligence artificielle sur-mesure pour les entreprises. En quoi puis-je vous être utile ? »",
  "",
  "# Ce que fait AIGEN Solutions",
  "Conception d'outils d'IA sur-mesure : applications métier, extraction et lecture de documents (plans BTP, PDF, fichiers), agents IA (vocal, conversationnel), automatisation, traitement et synthèse documentaire, intégration aux outils existants (CRM, ERP, Excel). Briques : grands modèles de langage, RAG (recherche augmentée sur les documents de l'entreprise), vision par ordinateur, agents.",
  "",
  "# Pour qui",
  "Toutes les tailles d'entreprise, de l'artisan au grand groupe. Secteurs fréquents : BTP, santé, formation, enseignement supérieur, services publics.",
  "",
  "# Méthode",
  "Audit du besoin, conception avec le client, première version utilisable en quelques semaines, déploiement, prise en main et support. Un seul interlocuteur.",
  "",
  "# Réalisations (si on te le demande)",
  "- HPI Extraction : extraction de surfaces et métrés sur plans de bâtiment, pour répondre à des appels d'offres BTP (du CCTP et du DPGF jusqu'au déboursé sec).",
  "- MediaTrad : traduction de visuels et de modules e-learning (SCORM) en préservant la mise en page.",
  "- Agent vocal IA : répond au téléphone et qualifie les demandes, en continu.",
  "- Studybot pour emlyon business school : assistant pédagogique.",
  "- SynthéZ : synthèse de documents longs, avec page de garde personnalisée et logo du client.",
  "- Recherche augmentée (RAG) sur les documents internes.",
  "Clients accompagnés : emlyon business school, Bioforce, ainsi qu'un grand compte du BTP.",
  "",
  "# Confiance",
  "Données hébergées en Union européenne, conformité RGPD, confidentialité des documents, rien n'est revendu. Société française, à Grenoble.",
  "",
  "# Déroulé d'un échange",
  "1. Comprends le métier et le besoin du visiteur (une question à la fois, courte).",
  "2. Apporte des éléments utiles et rassure (sérieux, sur-mesure, confidentialité).",
  "3. Quand le besoin est clair et la personne intéressée, propose de transmettre sa demande à l'équipe, puis appelle l'outil recueillir_coordonnees. Un court formulaire s'affichera pour qu'elle saisisse ELLE-MEME ses coordonnées. Tu ne demandes donc PAS d'épeler le nom ou l'email à voix haute : invite simplement la personne à remplir le formulaire affiché, et attends.",
  "4. Le système te signalera quand le formulaire est envoyé. Alors remercie, précise que la personne recevra par email une invitation pour un échange de 30 minutes avec l'équipe, puis appelle l'outil terminer_conversation pour conclure.",
  "",
  "# Règles strictes",
  "- JAMAIS de prix ni de tarif, et aucun chiffre, délai chiffré ou référence inventés. Si on insiste sur le prix : chaque outil est sur-mesure, le devis vient après l'étude du besoin (gratuite, sans engagement).",
  "- Ne promets pas qu'on « rappellera » : le suivi se fait par un EMAIL d'invitation à une réunion de 30 minutes.",
  "- Reste bref, laisse parler la personne, et SACHE CONCLURE : dès que l'échange est terminé ou que la personne dit au revoir, appelle terminer_conversation.",
  "- Pour toute question hors sujet, recentre poliment vers ce qu'AIGEN peut faire."
].join('\n');

const SESSION_CONFIG = {
  responseModalities: ['AUDIO'],
  temperature: 0.7,
  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  sessionResumption: {},
  contextWindowCompression: { slidingWindow: {} },
  tools: [{
    functionDeclarations: [
      {
        name: 'recueillir_coordonnees',
        description: "Affiche au visiteur un court formulaire pour qu'il saisisse LUI-MEME ses coordonnees (nom, email, entreprise, secteur, telephone), afin d'eviter toute erreur de transcription vocale. A appeler une fois le besoin compris, pour transmettre la demande a l'equipe.",
        parameters: { type: 'OBJECT', properties: { besoin: { type: 'STRING', description: 'Resume en une phrase du besoin du visiteur' } }, required: ['besoin'] }
      },
      {
        name: 'terminer_conversation',
        description: "Termine et raccroche la conversation, quand l'echange est conclu (demande transmise, ou le visiteur dit au revoir).",
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }]
};

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('AIGEN voice relay OK'); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, path: '/live', maxPayload: 1 << 20 });

wss.on('connection', async (ws, req) => {
  const origin = req.headers.origin || '';
  if (ALLOWED.length && origin && !ALLOWED.includes(origin)) { log('refus origine', origin); ws.close(1008, 'origin'); return; }
  if (!KEY) { try { ws.send(JSON.stringify({ t: 'error', m: 'no_key' })); } catch (e) {} ws.close(); return; }

  const send = (o) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };
  const startedAt = Date.now();
  let session = null, closed = false;
  log('connexion', origin || '(sans origine)');

  const sendText = (text) => { try { session && session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }); } catch (e) {} };

  const cleanup = () => {
    if (closed) return; closed = true;
    try { session && session.close(); } catch (e) {}
    try { ws.close(); } catch (e) {}
    log('fin session', Math.round((Date.now() - startedAt) / 1000) + 's');
  };

  async function onGemini(m) {
    if (m.toolCall) {
      const responses = [];
      for (const fc of m.toolCall.functionCalls) {
        let result = 'ok';
        if (fc.name === 'recueillir_coordonnees') {
          send({ t: 'form', besoin: (fc.args && fc.args.besoin) || '' });
          result = "Formulaire affiche au visiteur. Invite-le a le remplir, puis attends la confirmation du systeme.";
          log('outil: recueillir_coordonnees');
        } else if (fc.name === 'terminer_conversation') {
          send({ t: 'end_requested' });
          result = 'Conversation terminee.';
          log('outil: terminer_conversation');
        }
        responses.push({ id: fc.id, name: fc.name, response: { result } });
      }
      try { session.sendToolResponse({ functionResponses: responses }); } catch (e) {}
    }
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) { send({ t: 'interrupt' }); return; }
    if (sc.inputTranscription && sc.inputTranscription.text) send({ t: 'in', d: sc.inputTranscription.text });
    if (sc.outputTranscription && sc.outputTranscription.text) send({ t: 'out', d: sc.outputTranscription.text });
    const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
    for (const p of parts) { if (p.inlineData && p.inlineData.data) send({ t: 'audio', d: p.inlineData.data }); }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: KEY }); // vraie clé -> endpoint standard, fiable
    session = await ai.live.connect({
      model: MODEL,
      config: SESSION_CONFIG,
      callbacks: {
        onopen: () => {},
        onmessage: (m) => onGemini(m),
        onerror: (e) => { log('erreur gemini', e && e.message); send({ t: 'error', m: 'gemini' }); },
        onclose: () => { send({ t: 'closed' }); cleanup(); }
      }
    });
  } catch (e) {
    log('echec connexion gemini', e && e.message); send({ t: 'error', m: 'connect' }); ws.close(); return;
  }

  // L'agent prend la parole en premier.
  sendText("[Le visiteur vient d'ouvrir l'assistant. Accueille-le de façon sobre et professionnelle : présente-toi et AIGEN Solutions en une à deux phrases, sur un ton posé, puis demande comment tu peux l'aider.]");
  send({ t: 'ready' });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.t === 'audio' && msg.d) {
      try { session.sendRealtimeInput({ audio: { data: msg.d, mimeType: 'audio/pcm;rate=16000' } }); } catch (e) {}
    } else if (msg.t === 'form_done') {
      sendText("[Le visiteur a envoyé ses coordonnées (nom: " + (msg.nom || '') + ", email: " + (msg.email || '') + "). Sa demande a été transmise à l'équipe. Remercie-le brièvement, précise qu'il recevra par email une invitation pour un échange de 30 minutes, puis termine la conversation.]");
    }
  });
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

server.listen(PORT, () => log('AIGEN voice relay en écoute sur :' + PORT + ' (modèle ' + MODEL + ')'));
