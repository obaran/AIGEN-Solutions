#!/usr/bin/env python3
"""
Pose chez OVH les enregistrements d'authentification Brevo pour aigen-solutions.fr.

    python3 tools/ovh-dns-brevo.py            # dry-run : montre ce qui serait fait
    python3 tools/ovh-dns-brevo.py --apply    # écrit, puis rafraîchit la zone

Ce script n'AJOUTE que les sept enregistrements listés ci-dessous. Il ne modifie
et ne supprime jamais rien d'autre : la messagerie Microsoft 365 (MX, SPF,
autodiscover), le site sur Vercel (A, www) et Resend (send, resend._domainkey)
sont protégés par une liste de refus vérifiée avant chaque écriture.

⚠️ Le TXT « brevo-code » s'ajoute à la racine À CÔTÉ du SPF existant : plusieurs
TXT à la racine sont parfaitement valides. Ce qui casserait la messagerie serait
un SECOND enregistrement commençant par « v=spf1 ». Le script refuse d'en écrire.

Identifiants : ~/.ovh.conf (jamais en argument, jamais affichés).
"""
import sys
import ovh

ZONE = "aigen-solutions.fr"

# (sous-domaine, type, valeur)
RECORDS = [
    ("",                  "TXT",   "brevo-code:733dc3f7b063f9037885a01102e01c40"),
    ("brevo1._domainkey", "CNAME", "b1.aigen-solutions-fr.dkim.brevo.com."),
    ("brevo2._domainkey", "CNAME", "b2.aigen-solutions-fr.dkim.brevo.com."),
    ("_dmarc",            "TXT",   "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"),
    ("em",                "CNAME", "em-aigen-solutions-fr.brand.brevosend.com."),
    ("r.em",              "CNAME", "em-aigen-solutions-fr.r.brand.brevosend.com."),
    ("img.em",            "CNAME", "em-aigen-solutions-fr.img.brand.brevosend.com."),
]

# Rien de ce qui suit ne doit être touché, sous aucun prétexte.
PROTECTED_TYPES = {"MX", "NS", "A", "AAAA"}
PROTECTED_SUBS = {"", "www", "autodiscover", "send", "resend._domainkey", "ftp"}


def guard(sub, ftype, value):
    """Refuse tout ce qui sortirait du périmètre Brevo."""
    if (sub, ftype, value) not in [(s, t, v) for s, t, v in RECORDS]:
        raise SystemExit("REFUS : enregistrement hors périmètre (%s %s)" % (ftype, sub))
    if ftype in PROTECTED_TYPES:
        raise SystemExit("REFUS : type protégé (%s)" % ftype)
    if value.lower().startswith("v=spf1"):
        raise SystemExit("REFUS : un second SPF casserait la messagerie M365")


def main():
    apply_ = "--apply" in sys.argv
    client = ovh.Client()

    existing = []
    for rid in client.get("/domain/zone/%s/record" % ZONE):
        r = client.get("/domain/zone/%s/record/%s" % (ZONE, rid))
        existing.append((r["subDomain"], r["fieldType"], r["target"].strip('"'), rid))

    print("Zone %s : %d enregistrements en place\n" % (ZONE, len(existing)))
    changed = 0

    for sub, ftype, value in RECORDS:
        guard(sub, ftype, value)
        label = sub or "(racine)"
        match = [e for e in existing
                 if e[0] == sub and e[1] == ftype and e[2].rstrip(".") == value.rstrip(".")]
        if match:
            print("=  %-5s %-20s déjà en place" % (ftype, label))
            continue
        # un CNAME est unique : s'il existe avec une autre valeur, on ne l'écrase pas en aveugle
        clash = [e for e in existing if e[0] == sub and e[1] == "CNAME" and ftype == "CNAME"]
        if clash:
            print("!  %-5s %-20s CONFLIT : pointe déjà vers %s (rien fait)" % (ftype, label, clash[0][2]))
            continue
        print("+  %-5s %-20s %s%s" % (ftype, label, value, "" if apply_ else "   [dry-run]"))
        changed += 1
        if apply_:
            client.post("/domain/zone/%s/record" % ZONE,
                        fieldType=ftype, subDomain=sub, target=value, ttl=3600)

    if apply_ and changed:
        client.post("/domain/zone/%s/refresh" % ZONE)
        print("\nZone rafraîchie. %d enregistrement(s) ajouté(s)." % changed)
    elif not changed:
        print("\nRien à faire : tout est déjà en place.")
    else:
        print("\n%d enregistrement(s) à ajouter. Relancer avec --apply." % changed)


if __name__ == "__main__":
    main()
