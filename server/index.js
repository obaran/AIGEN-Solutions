// ============================================================
// AIGEN Solutions — Relais WebSocket pour l'agent vocal Gemini Live
// Déployé sur Railway. Le navigateur parle à CE serveur (WS) ; le
// serveur tient la session Gemini Live avec la vraie clé (endpoint
// standard, fiable). La clé ne quitte jamais le serveur. Prompt de
// découverte commerciale, voix et outils définis ici.
// Variable d'env requise : GEMINI_API_KEY.
// ============================================================
import http from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const KEY = process.env.GEMINI_API_KEY;
const ALLOWED = (process.env.ALLOWED_ORIGINS ||
  'https://aigen-solutions.fr,https://www.aigen-solutions.fr,https://aigen-solutions.com,http://localhost:8000,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

const log = (...a) => console.log(new Date().toISOString(), ...a);

const SYSTEM_PROMPT = [
  "Tu es le conseiller vocal d'AIGEN Solutions, agence française (Grenoble) qui conçoit des outils d'intelligence artificielle sur-mesure. Tu es la vitrine vivante du savoir-faire de l'agence : méthodique, précis, chaleureux, jamais robotique.",
  "",
  "# Ta mission",
  "Mener une vraie DÉCOUVERTE COMMERCIALE par la voix : comprendre en profondeur le besoin du visiteur, et recueillir un maximum d'informations pour préparer le premier entretien de l'équipe. Tu fais, en amont, une partie du travail qu'un commercial ferait en rendez-vous. Tu ne vends rien et tu ne t'engages sur RIEN (ni prix, ni délai, ni faisabilité définitive) : tu explores, tu suggères des pistes, tu recueilles.",
  "",
  "# Ton et posture",
  "Posé, calme, professionnel, bienveillant. Phrases courtes, débit mesuré. Jamais de tiret cadratin. Tu écoutes plus que tu ne parles, une question à la fois. Tu utilises le prénom une fois connu.",
  "",
  "# Langue",
  "Par défaut tu parles français. Le système t'indique la langue du navigateur du visiteur (français, anglais ou arabe) : commence ton accueil DANS CETTE LANGUE et poursuis la conversation dans cette langue. Si le visiteur te parle dans une autre langue, adapte-toi naturellement et continue dans SA langue. La synthèse destinée à l'équipe (outil proposer_contact) reste TOUJOURS en français.",
  "Ne traduis JAMAIS mot à mot : emploie le terme idiomatique de chaque langue. Ta fonction se dit « conseiller vocal » en français, « voice assistant » en anglais (surtout PAS « vocal counselor » ni « vocal adviser », qui désignent un thérapeute ou un juriste), et « المساعد الصوتي » en arabe. Même exigence pour tout le reste de ton vocabulaire.",
  "",
  "# Accueil",
  "Un visiteur qui ouvre l'assistant ne sait pas encore à quoi sert cette conversation ni où elle mène. Ton accueil doit le lui dire, sinon il raccroche au bout de dix secondes. Trois temps, dans cet ordre, et RIEN de plus :",
  "1. Qui tu es : le conseiller vocal d'AIGEN Solutions. (Il doit savoir qu'il parle à un assistant, jamais de flou là-dessus.)",
  "2. Ce que vous allez faire ensemble et où cela mène : il vous raconte son activité et ce qui lui prend du temps, et l'équipe revient ensuite vers lui sur ce qui serait réalisable. Sans engagement.",
  "3. Une invitation brève à prendre la parole.",
  "Exemple du ton, du RYTHME et de la longueur visés : « Bonjour, je suis le conseiller vocal d'AIGEN Solutions. Racontez-moi votre activité et ce qui vous prend le plus de temps : l'équipe pourra ensuite revenir vers vous sur ce qui serait réalisable, sans engagement. Je vous écoute. »",
  "LE RYTHME COMPTE AUTANT QUE LE CONTENU. Alterne les longueurs : une phrase courte pour te présenter, UNE PHRASE PLUS AMPLE qui porte tout le sens d'un seul souffle (liée par « et », « pour que », « afin que », « ensuite »), puis une phrase brève qui rend la parole. Trois ou quatre phrases courtes d'affilée sonnent hachées et récitées à l'oral : c'est le défaut à éviter absolument.",
  "RÈGLES STRICTES sur cet accueil. QUINZE SECONDES MAXIMUM à l'oral : un accueil trop long fait fuir. Tu ne promets PAS de donner toi-même la solution pendant l'appel : tu écoutes et tu recueilles, c'est l'équipe qui revient ensuite vers lui. Ne dis donc jamais « je vous dis ce que l'IA peut faire pour vous » ni « je vais analyser votre besoin ». Tu formules le bénéfice, jamais la méthode : pas de « notre approche est », « nous procédons en plusieurs étapes », « je vais recueillir vos besoins ». Ce n'est pas un argumentaire : tu annonces où va la conversation, tu ne vends pas. S'il faut raccourcir, sacrifie ce qui suit les deux-points, jamais l'invitation finale. Tu ne le dis QU'UNE FOIS : si le visiteur te coupe ou commence à parler, tu abandonnes immédiatement ce qui restait et tu l'écoutes. Ne répète jamais cet accueil plus tard dans l'échange.",
  "(Si le système t'indique que le visiteur revient, vois la section « Visiteur de retour » : il connaît déjà tout cela, ne le lui redis pas.)",
  "",
  "# Découverte (le cœur de ton travail)",
  "Cherche à comprendre : le métier et l'entreprise, le problème ou la tâche chronophage, ce qui est fait aujourd'hui (souvent à la main), l'ampleur et la fréquence, l'échéance. Et surtout la MATURITÉ du visiteur, en t'y adaptant :",
  "- Il ne sait pas encore ce qu'il veut : rassure-le, explique qu'un premier échange (audit) sert justement à identifier où l'IA apporte un gain. Ne le noie pas de questions.",
  "- Il a déjà une idée ou un projet : explore-la. À quoi servirait l'outil ? Quel besoin règle-t-il ? Comment font-ils aujourd'hui ? Quelles contraintes ?",
  "- Il a un cahier des charges ou des documents : propose-lui de les JOINDRE (il y a un bouton « joindre un document » dans le chat), cela aidera l'équipe à préparer.",
  "Reformule ce que tu comprends pour montrer que tu suis (« Si je résume, vous passez beaucoup de temps à... »). Donne des exemples adaptés au secteur : BTP -> extraction de plans (type HPI Extraction) ; formation / e-learning -> traduction de modules (type MediaTrad) ou assistant pédagogique (type Studybot) ; documents longs -> synthèse (type SynthéZ) ; relation client -> agent vocal. Tu peux suggérer des PISTES d'outils sans t'engager (« ce serait typiquement le genre d'outil qu'on pourrait imaginer, à valider ensemble »).",
  "",
  "# RÈGLE D'OR : lis l'engagement du visiteur",
  "S'il joue le jeu et parle volontiers, creuse davantage pour recueillir le maximum (idées, vision, contraintes, outils déjà utilisés). S'il est pressé, évasif ou peu bavard, N'INSISTE PAS et va directement à la proposition de rendez-vous. Ne sois JAMAIS agressif ni insistant : mieux vaut un contact chaleureux qu'un interrogatoire. Tu t'adaptes à la personne, toujours.",
  "",
  "# Proposer le canal (au bon moment)",
  "Quand tu as saisi l'essentiel, propose avec bienveillance de préparer un premier échange et demande ce qui l'arrange : une visioconférence (30 min), un appel téléphonique, ou simplement recevoir des informations par email. Selon sa réponse, appelle l'outil proposer_contact avec le bon mode ('visio', 'appel' ou 'email') ET une synthèse riche (voir plus bas). Un court formulaire s'affichera pour ses coordonnées : invite-le simplement à le remplir (tu ne demandes pas d'épeler nom ou email à voix haute).",
  "",
  "# La synthèse (crucial pour l'équipe)",
  "Dans l'argument 'synthese' de proposer_contact, rédige un brief clair et structuré EN FRANÇAIS pour préparer l'entretien : entreprise / métier, besoin exprimé, ce qui est fait aujourd'hui, maturité (découverte / a une idée / a un cahier des charges), pistes d'outils évoquées, contraintes et échéance, et tout élément utile. Plus c'est précis et complet, mieux c'est.",
  "",
  "# Après le formulaire",
  "Le système te confirmera l'envoi. Alors remercie chaleureusement et explique la suite selon le mode : visio -> « vous allez pouvoir choisir votre créneau, et vous recevrez l'invitation avec le lien » ; appel -> « un conseiller vous rappellera au créneau indiqué » ; email -> « vous allez recevoir un récapitulatif par email ». Conclus par une phrase de politesse naturelle (par exemple « je vous dis à très bientôt »), PUIS appelle terminer_conversation. Ne prononce JAMAIS de formule technique comme « conversation terminée » ni le nom d'un outil : l'outil raccroche pour toi, tu n'as rien à ajouter après ta politesse.",
  "",
  "# Règles strictes",
  "- Tu ne t'engages sur RIEN : prix, délais chiffrés, faisabilité définitive restent « à valider ensemble ». JAMAIS de prix ni de chiffres inventés.",
  "- Jamais d'insistance ni d'agressivité. Tu respectes le rythme du visiteur.",
  "- Reste bref, laisse la parole, sois utile.",
  "",
  "# Visiteur de retour",
  "Si le système te fournit un contexte de discussion précédente, accueille le visiteur chaleureusement comme quelqu'un que tu connais déjà, sans tout redemander. Propose-lui, avec des mots naturels, de reprendre là où vous en étiez ou d'aborder un nouveau sujet."
].join('\n');

const SESSION_CONFIG = {
  responseModalities: ['AUDIO'],
  temperature: 0.75,
  systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  sessionResumption: {},
  contextWindowCompression: { slidingWindow: {} },
  tools: [{
    functionDeclarations: [
      {
        name: 'proposer_contact',
        description: "Ouvre le formulaire de prise de contact adapté au canal choisi par le visiteur, et transmet à l'équipe la synthèse de l'échange. À appeler une fois que le visiteur a exprimé sa préférence de canal.",
        parameters: {
          type: 'OBJECT',
          properties: {
            mode: { type: 'STRING', description: "Canal préféré du visiteur : 'visio' (visioconférence), 'appel' (téléphone) ou 'email' (recevoir des informations)." },
            synthese: { type: 'STRING', description: "Brief structuré en français pour préparer l'entretien : entreprise/métier, besoin, existant, maturité, pistes évoquées, contraintes, échéance." }
          },
          required: ['mode', 'synthese']
        }
      },
      {
        name: 'terminer_conversation',
        description: "Termine et raccroche la conversation, quand l'échange est conclu (demande transmise, ou le visiteur dit au revoir).",
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }]
};

const LANG_NAMES = { fr: 'le français', en: "l'anglais", ar: "l'arabe" };
function langNote(lang) {
  const l = LANG_NAMES[lang] ? lang : 'fr';
  if (l === 'fr') return '';
  return " La langue du navigateur du visiteur est " + LANG_NAMES[l] + " : fais ton accueil et poursuis la conversation dans cette langue (adapte-toi si le visiteur répond dans une autre langue).";
}
function greetingPrompt(resume, lang) {
  if (resume && String(resume).trim()) {
    return "[Le visiteur REVIENT (il a déjà échangé avec toi). Résumé de votre échange précédent : « " + String(resume).slice(0, 1500) +
      " ». Accueille-le chaleureusement comme quelqu'un que tu connais déjà, sans tout redemander, et propose-lui, avec des mots naturels, de reprendre là où vous en étiez ou d'aborder un nouveau sujet." + langNote(lang) + "]";
  }
  return "[Le visiteur vient d'ouvrir l'assistant et ne sait pas encore où mène cette conversation. Applique la section « Accueil » de tes instructions : qui tu es, ce que vous allez faire ensemble et où cela mène (l'équipe revient vers lui sur ce qui serait réalisable, sans engagement), puis une invitation brève à parler. QUINZE SECONDES MAXIMUM. Soigne le RYTHME : une phrase courte, puis une phrase ample d'un seul souffle, puis une phrase brève. Surtout pas une suite de phrases courtes hachées. Tu ne promets pas de donner toi-même la solution." + langNote(lang) + "]";
}

/* ============ Traitement des leads (email client + brief Opus 5 pour l'équipe) ============ */
const PRIMARY_FROM = 'AIGEN Solutions <formulaire@aigen-solutions.fr>';
const PRIMARY_TO = ['contact@aigen-solutions.fr'];
const REPLY_TO_TEAM = 'contact@aigen-solutions.fr';
const FALLBACK_FROM = 'AIGEN Solutions <onboarding@resend.dev>';
const BOOKING_URL = 'https://outlook.office.com/bookwithme/user/c673cf9ffdbd4c9c88b02c4b14af2704@aigen-solutions.fr/meetingtype/e2ZXfTWpkUSvi4rNgcr63w2?anonymous&ismsaljsauthenabled&ep=mlink';
const BRIEF_MODEL = process.env.BRIEF_MODEL || 'claude-opus-5';
const BRIEF_MODEL_LABEL = process.env.BRIEF_MODEL_LABEL || 'Opus 5';
// Langue du visiteur, affichée dans les emails internes (langue de travail = français)
const LANG_LABELS = { fr: 'Français', en: 'Anglais', ar: 'Arabe' };
const SPEAKER_LABELS = { fr: 'francophone', en: 'anglophone', ar: 'arabophone' };
const langLabel = (l) => LANG_LABELS[l] || 'Français';
const speakerLabel = (l) => SPEAKER_LABELS[l] || 'francophone';

const BRIEF_SYSTEM = "Tu es le \"manager technique\" d'AIGEN Solutions, agence d'IA sur-mesure. Le fondateur (Onur) vient de recevoir la demande d'un prospect via le site. Prépare-lui un brief INTERNE (jamais envoyé au client) pour son premier rendez-vous. Tu es un architecte de solutions IA senior ET un coach commercial : tu réfléchis en profondeur, tu es pragmatique (aucun fantasme technique), tu proposes des solutions réalistes alignées sur ce qu'AIGEN sait faire : applications métier sur-mesure, extraction et lecture de documents (plans BTP, PDF, fichiers), agents IA vocal et conversationnel, RAG sur documents, vision par ordinateur, automatisation, synthèse documentaire, intégration CRM/ERP.\n\n" +
  "Format de sortie : HTML simple, uniquement les balises <h3>, <p>, <ul>, <li>, <strong>. Pas de <html> ni <body>, pas d'attribut style, jamais de tiret cadratin. En français. Respecte EXACTEMENT cette structure :\n" +
  "<h3>En bref</h3> : 2 à 4 phrases sur le vrai besoin, la maturité du prospect et l'angle à jouer.\n" +
  "<h3>Pistes d'outils à proposer</h3> : 2 à 4 idées d'outils concrets pour CE prospect ; pour chacun, ce qu'il fait et le gain, en une ligne.\n" +
  "<h3>Comment on le construirait</h3> : pour la ou les 2 pistes les plus pertinentes, les grandes étapes et les briques (LLM, RAG, vision, etc.), concret et pragmatique, avec les points de vigilance (données, sécurité, faisabilité).\n" +
  "<h3>Pour votre rendez-vous</h3> : 5 à 8 questions précises à poser pour qualifier, PUIS 2 ou 3 phrases clés prêtes à dire (accroche, réassurance).\n\n" +
  "Ne t'engage sur aucun prix ni délai. Adapte la profondeur à la maturité : prospect qui ne sait rien -> insiste sur les questions de découverte ; prospect avec une idée -> insiste sur la conception. Sois utile et actionnable.";

function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
function br(s) { return esc(s).replace(/\n/g, '<br>'); }
async function resendSend(payload) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { ok: r.ok, status: r.status };
}

/* ---- Appel Anthropic avec réessais ----
   Un 429 (débit), 529 (surcharge) ou 5xx est TRANSITOIRE. Sans réessai, un
   simple pic de charge chez le fournisseur faisait perdre définitivement le
   brief ou le rapport : aucun email n'arrivait et rien ne le signalait
   (constaté le 30/07/2026, « rapport fable http 529 »). On réessaie avec une
   attente croissante, en respectant l'en-tête retry-after quand il est fourni.
   `fallbacks` : si les garde-fous du modèle refusent la demande, l'API la
   rejoue côté serveur sur le modèle de repli recommandé au lieu de rendre
   une réponse vide. */
const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => Math.round(2000 * Math.pow(2, attempt - 1) * (1 + Math.random()));

async function anthropicText(what, system, userMsg, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) return '';
  const ATTEMPTS = 4;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const last = attempt === ATTEMPTS;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 150000);
      let r;
      try {
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal: ctrl.signal,
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'server-side-fallback-2026-07-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: BRIEF_MODEL, max_tokens: maxTokens, fallbacks: 'default',
            system: system, messages: [{ role: 'user', content: userMsg }]
          })
        });
      } finally { clearTimeout(to); }

      if (r.ok) {
        const j = await r.json();
        if (j.stop_reason === 'refusal') { log(what + ': demande refusée par les garde-fous du modèle'); return ''; }
        const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
        if (!text) log(what + ': réponse vide (' + (j.stop_reason || 'sans motif') + ')');
        return text;
      }

      const body = await r.text().catch(() => '');
      if (!RETRYABLE.has(r.status) || last) { log(what + ' http ' + r.status, body.slice(0, 200)); return ''; }
      const ra = parseInt(r.headers.get('retry-after') || '', 10);
      const wait = Number.isFinite(ra) ? Math.min(ra * 1000, 60000) : backoff(attempt);
      log(what + ' http ' + r.status + ' : réessai ' + attempt + '/' + (ATTEMPTS - 1) + ' dans ' + Math.round(wait / 1000) + 's');
      await sleep(wait);
    } catch (e) {
      if (last) { log(what + ' err', e && e.message); return ''; }
      const wait = backoff(attempt);
      log(what + ' err ' + (e && e.message) + ' : réessai ' + attempt + '/' + (ATTEMPTS - 1) + ' dans ' + Math.round(wait / 1000) + 's');
      await sleep(wait);
    }
  }
  return '';
}

async function managerBrief(l) {
  const userMsg = "Demande reçue via le site AIGEN Solutions.\n"
    + "Contact : " + l.name + (l.company ? " (" + l.company + ")" : "") + "\n"
    + "Secteur : " + (l.sector || 'non précisé') + "\n"
    + "Langue du visiteur : " + langLabel(l.lang) + "\n"
    + (l.mode ? "Canal souhaité : " + l.mode + "\n" : "")
    + (l.synthese ? "\nSynthèse de l'échange vocal :\n" + l.synthese + "\n" : "")
    + (l.message ? "\nMessage du visiteur :\n" + l.message + "\n" : "")
    + "\nPrépare le brief interne pour préparer le rendez-vous."
    + (l.lang && l.lang !== 'fr' ? " Le brief reste EN FRANÇAIS, mais signale que l'échange se fera en " + langLabel(l.lang).toLowerCase() + "." : "");
  // max_tokens plafonne la RÉFLEXION + le texte ENSEMBLE sur claude-opus-5 :
  // large, sinon un brief riche se coupe en pleine phrase (leçon du projet Extralys).
  return anthropicText('brief', BRIEF_SYSTEM, userMsg, Number(process.env.BRIEF_MAX_TOKENS) || 16000);
}

const CONFIRM_I18N = {
  fr: {
    hello: 'Bonjour', received: 'Merci pour votre demande, nous l\'avons bien reçue.',
    visio: 'Dernière étape pour finaliser : <a href="' + BOOKING_URL + '" style="color:#3159C9;font-weight:bold">choisissez votre créneau de 30 minutes</a>. Vous recevrez ensuite l\'invitation avec le lien de la réunion.',
    call: (c) => 'Un conseiller vous rappellera' + (c ? ' (' + c + ')' : ' très prochainement') + '. Vous pouvez aussi <a href="' + BOOKING_URL + '" style="color:#3159C9">réserver un créneau en ligne</a>.',
    email: 'Un conseiller reviendra vers vous avec des informations adaptées. Vous pouvez aussi <a href="' + BOOKING_URL + '" style="color:#3159C9">réserver un échange de 30 minutes</a>.',
    noted: 'Ce que nous avons noté :', bye: 'À très bientôt,', tagline: 'Outils d\'intelligence artificielle sur-mesure · aigen-solutions.fr',
    subject: 'AIGEN Solutions : votre demande est bien reçue', dir: 'ltr'
  },
  en: {
    hello: 'Hello', received: 'Thank you for your request, we have received it.',
    visio: 'One last step: <a href="' + BOOKING_URL + '" style="color:#3159C9;font-weight:bold">pick your 30-minute slot</a>. You will then receive the invitation with the meeting link.',
    call: (c) => 'An advisor will call you back' + (c ? ' (' + c + ')' : ' shortly') + '. You can also <a href="' + BOOKING_URL + '" style="color:#3159C9">book a slot online</a>.',
    email: 'An advisor will get back to you with relevant information. You can also <a href="' + BOOKING_URL + '" style="color:#3159C9">book a 30-minute call</a>.',
    noted: 'What we noted:', bye: 'Talk to you soon,', tagline: 'Custom AI tools · aigen-solutions.fr',
    subject: 'AIGEN Solutions: your request has been received', dir: 'ltr'
  },
  ar: {
    hello: 'مرحباً', received: 'شكراً لطلبكم، لقد استلمناه بنجاح.',
    visio: 'خطوة أخيرة: <a href="' + BOOKING_URL + '" style="color:#3159C9;font-weight:bold">اختاروا موعدكم (30 دقيقة)</a>. ستصلكم بعد ذلك الدعوة مع رابط الاجتماع.',
    call: (c) => 'سيتصل بكم مستشارنا' + (c ? ' (' + c + ')' : ' قريباً') + '. يمكنكم أيضاً <a href="' + BOOKING_URL + '" style="color:#3159C9">حجز موعد عبر الإنترنت</a>.',
    email: 'سيعود إليكم مستشارنا بالمعلومات المناسبة. يمكنكم أيضاً <a href="' + BOOKING_URL + '" style="color:#3159C9">حجز مكالمة لمدة 30 دقيقة</a>.',
    noted: 'ما سجّلناه:', bye: 'إلى اللقاء قريباً،', tagline: 'أدوات ذكاء اصطناعي مصمّمة حسب الطلب · aigen-solutions.fr',
    subject: 'AIGEN Solutions: تم استلام طلبكم', dir: 'rtl'
  }
};
async function sendClientConfirm(name, email, mode, creneau, recap, lang) {
  const L = CONFIRM_I18N[lang] || CONFIRM_I18N.fr;
  const firstName = name.split(' ')[0] || name;
  const next = mode === 'visio' ? L.visio : mode === 'appel' ? L.call(esc(creneau)) : L.email;
  const html = '<div dir="' + L.dir + '" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#232D42;line-height:1.65;max-width:560px">'
    + '<p>' + L.hello + ' ' + esc(firstName) + ',</p>'
    + '<p>' + L.received + ' ' + next + '</p>'
    + (recap ? '<div style="background:#F5F7FA;padding:12px 14px;border-radius:8px;color:#4A5568;font-size:14px;margin:14px 0"><strong>' + L.noted + '</strong><br>' + br(String(recap).slice(0, 900)) + '</div>' : '')
    + '<p>' + L.bye + '<br><strong>AIGEN Solutions</strong><br><span style="color:#6E7789;font-size:13px">' + L.tagline + '</span></p></div>';
  await resendSend({ from: PRIMARY_FROM, to: [email], reply_to: REPLY_TO_TEAM, subject: L.subject, html });
}

async function sendTeamBrief(d) {
  const rows = '<p><strong>Nom :</strong> ' + esc(d.name) + '<br>'
    + '<strong>Email :</strong> ' + esc(d.email) + '<br>'
    + '<strong>Entreprise :</strong> ' + (esc(d.company) || 'non précisé') + '<br>'
    + '<strong>Secteur :</strong> ' + (esc(d.sector) || 'non précisé') + '<br>'
    + '<strong>Langue du visiteur :</strong> ' + esc(langLabel(d.lang)) + '<br>'
    + (d.tel ? '<strong>Téléphone :</strong> ' + esc(d.tel) + '<br>' : '')
    + (d.modeLabel ? '<strong>Canal souhaité :</strong> ' + esc(d.modeLabel) + '<br>' : '')
    + (d.creneau ? '<strong>Créneau souhaité :</strong> ' + esc(d.creneau) + '<br>' : '')
    + (d.topic ? '<strong>Sujet :</strong> ' + esc(d.topic) : '') + '</p>';
  const synthBlock = d.synthese ? '<div style="background:#F5F7FA;border-left:3px solid #3159C9;padding:12px 15px;border-radius:8px;margin:10px 0"><strong style="color:#3159C9">Synthèse de l\'agent vocal</strong><br>' + br(d.synthese) + '</div>' : '';
  const msgBlock = d.message ? '<p><strong>Message :</strong><br>' + br(d.message) + '</p>' : '';
  const briefBlock = d.brief
    ? '<div style="margin-top:22px;padding-top:18px;border-top:2px dashed #D2D9E6"><h2 style="color:#3159C9;margin:0 0 3px">Brief de votre manager technique</h2><p style="color:#6E7789;font-size:13px;margin:0 0 12px">Analyse par ' + esc(BRIEF_MODEL_LABEL) + ' pour préparer votre rendez-vous (interne)</p>' + d.brief + '</div>'
    : '<p style="color:#8A93A6;font-size:13px;margin-top:18px"><em>(Analyse du manager technique indisponible pour cette demande : le service d\'analyse n\'a pas répondu. Les coordonnées ci-dessus restent complètes.)</em></p>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#232D42;line-height:1.6;max-width:640px">'
    + '<h2 style="color:#3159C9;margin:0 0 10px">Nouvelle demande' + (d.modeLabel ? ' (' + esc(d.modeLabel) + ')' : '') + (d.lang && d.lang !== 'fr' ? ' · visiteur ' + esc(speakerLabel(d.lang)) : '') + '</h2>'
    + '<div style="background:#fff;border:1px solid #E4E8F0;border-radius:10px;padding:2px 16px">' + rows + synthBlock + msgBlock
    + (d.attachments ? '<p style="color:#4A5568"><em>Pièce jointe : ' + esc(d.attachments[0].filename) + '</em></p>' : '') + '</div>'
    + briefBlock + '</div>';
  const subject = 'Nouvelle demande' + (d.modeLabel ? ' ' + d.modeLabel : '') + ' de ' + d.name + (d.company ? ' (' + d.company + ')' : '');
  const payload = { from: PRIMARY_FROM, to: PRIMARY_TO, reply_to: d.email, subject: subject, html: html };
  if (d.attachments) payload.attachments = d.attachments;
  let r = await resendSend(payload);
  if (!r.ok && process.env.MAIL_FALLBACK_TO) {
    const fb = { from: FALLBACK_FROM, to: [process.env.MAIL_FALLBACK_TO], reply_to: d.email, subject: '[router vers contact@] ' + subject, html: html };
    if (d.attachments) fb.attachments = d.attachments;
    await resendSend(fb);
  }
}

async function processLead(lead) {
  const s = (v, n) => String(v || '').trim().slice(0, n);
  const name = s(lead.name, 200), email = s(lead.email, 200), company = s(lead.company, 200), sector = s(lead.sector, 200);
  const tel = s(lead.tel, 60), creneau = s(lead.creneau, 200), mode = s(lead.mode, 20), topic = s(lead.topic, 200);
  const message = s(lead.message, 6000), synthese = s(lead.synthese, 8000);
  const lang = ['fr', 'en', 'ar'].indexOf(s(lead.lang, 5)) > -1 ? s(lead.lang, 5) : 'fr';
  const modeLabel = mode === 'visio' ? 'Visioconférence (30 min)' : mode === 'appel' ? 'Appel téléphonique' : mode === 'email' ? 'Échange par email' : '';
  let attachments;
  if (lead.attachment && lead.attachment.content && lead.attachment.filename) {
    const fn = String(lead.attachment.filename).slice(0, 200).replace(/[\r\n"]/g, '');
    const content = String(lead.attachment.content);
    if (content.length < 12 * 1024 * 1024) attachments = [{ filename: fn, content: content }];
  }
  log('lead', name, (mode || '(page)') + ' lang=' + lang);
  // La synthèse de l'agent est en français (brief interne) : pour un visiteur
  // en/ar on ne reprend dans SON email que son propre message.
  const recapForVisitor = lang === 'fr' ? (synthese || message) : message;
  sendClientConfirm(name, email, mode, creneau, recapForVisitor, lang).catch((e) => log('confirm err', e && e.message));
  const brief = await managerBrief({ name, company, sector, mode: modeLabel, synthese, message, lang });
  await sendTeamBrief({ name, email, company, sector, tel, creneau, modeLabel, topic, message, synthese, attachments, brief, lang });
}

/* ============ Rapport de conversation (visiteur parti SANS laisser ses coordonnées) ============ */
// À la fin d'une session vocale substantielle sans formulaire envoyé, le modèle
// rédige un rapport interne orienté « qu'est-ce que ça m'apporte » : résumé,
// intérêt commercial, enseignements, actions suggérées, signalement d'abus.
// Pas de transcript dans l'email (choix d'Onur). Plafond journalier anti-inondation.
// Si l'analyse échoue malgré les réessais, on envoie quand même un avis minimal :
// mieux vaut savoir qu'un visiteur a parlé que de ne rien recevoir du tout.
const REPORT_MIN_CHARS = 250;   // texte visiteur minimal pour déclencher
const REPORT_MIN_TURNS = 4;     // ou au moins 4 prises de parole visiteur
const REPORT_MAX_PER_DAY = 10;
const reportQuota = { day: '', count: 0 };
function reportAllowed() {
  const today = new Date().toISOString().slice(0, 10);
  if (reportQuota.day !== today) { reportQuota.day = today; reportQuota.count = 0; }
  return reportQuota.count < REPORT_MAX_PER_DAY;
}

const REPORT_SYSTEM = "Tu es le conseiller commercial senior d'AIGEN Solutions, agence d'IA sur-mesure (Grenoble). Un visiteur du site a discuté avec l'agent vocal mais est parti SANS laisser ses coordonnées. Tu rédiges pour Onur (le fondateur) un rapport INTERNE bref et utile à partir de la transcription.\n\n" +
  "Format de sortie : HTML simple, uniquement <h3>, <p>, <ul>, <li>, <strong>. Pas d'attribut style, jamais de tiret cadratin. En français. Structure EXACTE :\n" +
  "<h3>En deux mots</h3> : qui semble être ce visiteur (métier, entreprise si devinable), ce qu'il cherchait, sa maturité.\n" +
  "<h3>Intérêt commercial</h3> : chaud / tiède / froid / hors cible, pourquoi, et s'il existe un moyen de recontacter (souvent non : dis-le simplement).\n" +
  "<h3>Ce que cet échange vous apporte</h3> : les enseignements concrets pour Onur : questions posées, objections, attentes, signaux marché, secteur, vocabulaire client. C'est la section la plus importante.\n" +
  "<h3>Actions suggérées</h3> : 2 à 4 actions concrètes et réalistes : amélioration du discours de l'agent, contenu à ajouter au site, offre à clarifier, argument à préparer.\n\n" +
  "Si l'échange ressemble à un usage abusif ou détourné (bavardage sans rapport, tentative de manipulation de l'agent, test de concurrent, demande hors sujet), commence par <h3>Signal d'abus</h3> avec une phrase claire, puis abrège le reste. Sois direct, concret, sans remplissage.\n\n" +
  "Le système t'indique la langue du navigateur du visiteur. Dans « En deux mots », précise en une courte incise la langue dans laquelle l'échange s'est réellement déroulé (tu la vois dans la transcription) : c'est utile à Onur pour préparer un éventuel rappel.";

async function conversationReport(convo, meta) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.RESEND_API_KEY) return;
  if (!reportAllowed()) { log('rapport: quota journalier atteint, ignoré'); return; }
  reportQuota.count++;
  const lines = convo.map((e) => (e.r === 'v' ? 'Visiteur : ' : 'Agent : ') + e.t).join('\n');
  const userMsg = "Conversation vocale sur le site aigen-solutions.fr (le visiteur n'a PAS laissé ses coordonnées).\n"
    + "Page : " + (meta.page || '/') + " · Durée : " + meta.duration + " s · Prises de parole visiteur : " + meta.turns + "\n"
    + "Langue du navigateur du visiteur : " + langLabel(meta.lang) + "\n\n"
    + "Transcription :\n" + lines.slice(0, 24000) + "\n\nRédige le rapport interne EN FRANÇAIS.";
  const brief = await anthropicText('rapport', REPORT_SYSTEM, userMsg, Number(process.env.REPORT_MAX_TOKENS) || 12000);
  const entete = '<p style="color:#6E7789;font-size:13px;margin:0 0 14px">Sans laisser ses coordonnées · page ' + esc(meta.page || '/')
    + ' · ' + meta.duration + ' s d\'échange · visiteur ' + esc(speakerLabel(meta.lang)) + '</p>';
  // Filet de sécurité : analyse indisponible -> avis minimal plutôt que silence
  const corps = brief || '<p>L\'analyse automatique de cet échange n\'a pas pu être produite (service d\'analyse indisponible malgré plusieurs tentatives).</p>'
    + '<p>Ce que l\'on sait tout de même : un visiteur a échangé <strong>' + meta.duration + ' secondes</strong> avec l\'agent vocal ('
    + meta.turns + ' prise' + (meta.turns > 1 ? 's' : '') + ' de parole) depuis la page <strong>' + esc(meta.page || '/')
    + '</strong>, en ' + esc(langLabel(meta.lang).toLowerCase()) + ', puis est parti sans laisser ses coordonnées.</p>';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#232D42;line-height:1.6;max-width:640px">'
    + '<h2 style="color:#3159C9;margin:0 0 4px">Un visiteur a échangé avec l\'agent</h2>'
    + entete + corps + '</div>';
  const subject = 'Conversation agent vocal : rapport visiteur (' + speakerLabel(meta.lang) + ', sans coordonnées)';
  await resendSend({ from: PRIMARY_FROM, to: PRIMARY_TO, subject: subject, html });
  log('rapport de conversation envoyé' + (brief ? '' : ' (sans analyse)'));
}

/* ============ Anti-abus /lead : limiteur de débit en mémoire (instance Railway unique) ============ */
// Protège le coût (appel au modèle + emails) contre le spam. Limites généreuses
// pour ne jamais bloquer un usage légitime, même derrière une IP d'entreprise
// partagée. Le plafond GLOBAL est le vrai garde-fou : il tient même si l'IP est
// falsifiée via x-forwarded-for. Ne compte que les leads VALIDES (prêts à traiter).
const RL = {
  perIp: new Map(),
  global: [],
  WINDOW: 15 * 60 * 1000,   // fenêtre 15 min
  BURST: 60 * 1000,         // fenêtre rafale 60 s
  MAX_PER_IP: 8,            // leads / IP / 15 min
  MAX_BURST_IP: 3,         // leads / IP / 60 s
  MAX_GLOBAL: 80           // leads / 15 min, toutes IP confondues
};
function clientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown';
}
function rateLimited(ip) {
  const now = Date.now();
  RL.global = RL.global.filter((t) => now - t < RL.WINDOW);
  if (RL.global.length >= RL.MAX_GLOBAL) return 'global';
  const arr = (RL.perIp.get(ip) || []).filter((t) => now - t < RL.WINDOW);
  if (arr.length >= RL.MAX_PER_IP) { RL.perIp.set(ip, arr); return 'ip'; }
  if (arr.filter((t) => now - t < RL.BURST).length >= RL.MAX_BURST_IP) { RL.perIp.set(ip, arr); return 'burst'; }
  arr.push(now); RL.perIp.set(ip, arr); RL.global.push(now);
  return null;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of RL.perIp) {
    const keep = arr.filter((t) => now - t < RL.WINDOW);
    if (keep.length) RL.perIp.set(ip, keep); else RL.perIp.delete(ip);
  }
}, RL.WINDOW).unref();

function cors(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED.indexOf(o) > -1) {
    res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
  }
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '', big = false;
    req.on('data', (c) => { data += c; if (data.length > 13 * 1024 * 1024) { big = true; req.destroy(); } });
    req.on('end', () => resolve(big ? null : data));
    req.on('error', () => resolve(null));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS' && req.url === '/lead') { cors(req, res); res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && req.url === '/lead') {
    cors(req, res);
    const raw = await readBody(req);
    let lead; try { lead = JSON.parse(raw || '{}'); } catch (e) { lead = {}; }
    if (lead.botcheck) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"success":true}'); return; }
    const name = String(lead.name || '').trim(), email = String(lead.email || '').trim();
    if (!name || !/.+@.+\..+/.test(email)) { res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":"invalid"}'); return; }
    const limited = rateLimited(clientIp(req));
    if (limited) { log('lead rate-limit', limited, clientIp(req)); res.writeHead(429, { 'content-type': 'application/json' }); res.end('{"error":"rate_limited"}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"success":true}'); // réponse rapide au client
    processLead(lead).catch((e) => log('processLead err', e && e.message)); // async (Railway reste actif)
    return;
  }
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
  let session = null, closed = false, started = false;
  const convo = []; let leadDone = false, pagePath = '', sessionLang = 'fr';
  const addConvo = (r, t) => {
    const last = convo[convo.length - 1];
    if (last && last.r === r) last.t += t; else convo.push({ r, t });
    if (convo.length > 400) convo.splice(0, convo.length - 400);
  };
  log('connexion', origin || '(sans origine)');

  const sendText = (text) => { try { session && session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }); } catch (e) {} };

  const cleanup = () => {
    if (closed) return; closed = true;
    try { session && session.close(); } catch (e) {}
    try { ws.close(); } catch (e) {}
    const duration = Math.round((Date.now() - startedAt) / 1000);
    log('fin session', duration + 's');
    // Rapport interne si conversation substantielle SANS formulaire envoyé
    const vTurns = convo.filter((e) => e.r === 'v').length;
    const vChars = convo.filter((e) => e.r === 'v').reduce((n, e) => n + e.t.length, 0);
    if (!leadDone && (vChars >= REPORT_MIN_CHARS || vTurns >= REPORT_MIN_TURNS)) {
      conversationReport(convo.slice(), { duration, turns: vTurns, page: pagePath, lang: sessionLang }).catch((e) => log('rapport err', e && e.message));
    }
  };

  async function onGemini(m) {
    if (m.toolCall) {
      const responses = [];
      for (const fc of m.toolCall.functionCalls) {
        if (fc.name === 'proposer_contact') {
          const mode = (fc.args && fc.args.mode) || 'visio';
          const synthese = (fc.args && fc.args.synthese) || '';
          send({ t: 'contact', mode: mode, synthese: synthese });
          responses.push({ id: fc.id, name: fc.name, response: { result: "Formulaire de contact (" + mode + ") affiche au visiteur. Invite-le a le completer, puis attends la confirmation du systeme." } });
          log('outil: proposer_contact', mode);
        } else if (fc.name === 'terminer_conversation') {
          // On NE renvoie PAS de réponse d'outil : sinon le modèle reprend la parole
          // et lit le résultat (« conversation terminée ») à voix haute. En laissant
          // l'appel sans réponse, on coupe net sa génération. Le client raccroche
          // gracieusement (fin de la phrase en cours + sécurité 2 s).
          send({ t: 'end_requested' });
          log('outil: terminer_conversation');
        }
      }
      if (responses.length) { try { session.sendToolResponse({ functionResponses: responses }); } catch (e) {} }
    }
    const sc = m.serverContent;
    if (!sc) return;
    if (sc.interrupted) { send({ t: 'interrupt' }); return; }
    if (sc.inputTranscription && sc.inputTranscription.text) { addConvo('v', sc.inputTranscription.text); send({ t: 'in', d: sc.inputTranscription.text }); }
    if (sc.outputTranscription && sc.outputTranscription.text) { addConvo('a', sc.outputTranscription.text); send({ t: 'out', d: sc.outputTranscription.text }); }
    const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
    for (const p of parts) { if (p.inlineData && p.inlineData.data) send({ t: 'audio', d: p.inlineData.data }); }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: KEY });
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

  send({ t: 'ready' });

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.t === 'start') {
      if (started) return; started = true;
      pagePath = String(msg.page || '').slice(0, 120);
      const l = String(msg.lang || 'fr').slice(0, 5);
      sessionLang = LANG_LABELS[l] ? l : 'fr';   // mémorisée pour le rapport interne
      log('langue visiteur', sessionLang);
      sendText(greetingPrompt(msg.resume, sessionLang)); // accueil dans la langue du navigateur
    } else if (msg.t === 'audio' && msg.d) {
      try { session.sendRealtimeInput({ audio: { data: msg.d, mimeType: 'audio/pcm;rate=16000' } }); } catch (e) {}
    } else if (msg.t === 'form_done') {
      leadDone = true; // le brief de lead part déjà : pas de rapport doublon
      sendText("[Le visiteur a envoyé ses coordonnées (nom: " + (msg.nom || '') + ", email: " + (msg.email || '') + ") via le canal " + (msg.mode || '') + ". Sa demande a été transmise à l'équipe. Remercie-le chaleureusement DANS LA LANGUE DE LA CONVERSATION, explique la suite selon le canal, puis conclus par une politesse naturelle et appelle l'outil terminer_conversation. Ne prononce jamais de formule technique comme « conversation terminée ».]");
    }
  });
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

server.listen(PORT, () => log('AIGEN voice relay en écoute sur :' + PORT + ' (modèle ' + MODEL + ')'));
