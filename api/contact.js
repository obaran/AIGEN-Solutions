// api/contact.js — Fonction serverless Vercel : reçoit le formulaire de contact et
// envoie l'email via Resend. La clé Resend vit dans les variables d'environnement
// Vercel (RESEND_API_KEY) — jamais dans le code/GitHub.

var PRIMARY_FROM = 'AIGEN Solutions <formulaire@aigen-solutions.fr>';
var PRIMARY_TO = ['contact@aigen-solutions.fr'];
var FALLBACK_FROM = 'AIGEN Solutions <onboarding@resend.dev>';

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
  });
}

async function resendSend(payload) {
  var r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return { ok: r.ok, status: r.status };
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  var b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (!b || typeof b !== 'object') b = {};
  if (b.botcheck) { res.status(200).json({ success: true }); return; } // honeypot anti-bot

  var name = String(b.name || '').trim().slice(0, 200);
  var email = String(b.email || '').trim().slice(0, 200);
  var company = String(b.company || '').trim().slice(0, 200);
  var sector = String(b.sector || '').trim().slice(0, 200);
  var topic = String(b.topic || '').trim().slice(0, 200);
  var message = String(b.message || '').trim().slice(0, 5000);

  if (!name || !/.+@.+\..+/.test(email) || !message) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#232D42;line-height:1.6">'
    + '<h2 style="color:#3159C9;margin:0 0 12px">Nouvelle demande — site AIGEN Solutions</h2>'
    + '<p><strong>Nom :</strong> ' + esc(name) + '<br>'
    + '<strong>Email :</strong> ' + esc(email) + '<br>'
    + '<strong>Entreprise :</strong> ' + (esc(company) || 'non précisé') + '<br>'
    + '<strong>Secteur :</strong> ' + (esc(sector) || 'non précisé') + '<br>'
    + '<strong>Besoin :</strong> ' + (esc(topic) || 'non précisé') + '</p>'
    + '<p><strong>Message :</strong><br>' + esc(message).replace(/\n/g, '<br>') + '</p>'
    + '</div>';
  var subject = 'Nouvelle demande de ' + name + (company ? ' (' + company + ')' : '');

  // 1) Envoi brandé depuis le domaine (actif une fois le domaine vérifié dans Resend).
  var r = await resendSend({ from: PRIMARY_FROM, to: PRIMARY_TO, reply_to: email, subject: subject, html: html });

  // 2) Repli tant que le domaine n'est pas vérifié : on route vers l'adresse du compte Resend.
  if (!r.ok && process.env.MAIL_FALLBACK_TO) {
    r = await resendSend({ from: FALLBACK_FROM, to: [process.env.MAIL_FALLBACK_TO], reply_to: email, subject: '[à router vers contact@] ' + subject, html: html });
  }

  if (r.ok) { res.status(200).json({ success: true }); return; }
  res.status(502).json({ error: 'send_failed' });
};
