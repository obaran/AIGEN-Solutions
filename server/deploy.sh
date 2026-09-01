#!/usr/bin/env bash
# Déploiement du backend vocal sur Railway, en marquant la version déployée.
#
# Railway ne fournit pas RAILWAY_GIT_COMMIT_SHA quand on déploie par envoi du
# dossier (railway up) plutôt que depuis GitHub. On pose donc nous-mêmes le
# commit courant en variable, pour que /health prouve depuis l'extérieur quelle
# version tourne réellement au lieu qu'on doive le supposer.
#
#   ./deploy.sh
set -euo pipefail

SERVICE="aigen-voice-backend"
cd "$(dirname "$0")"

SHA="$(git rev-parse --short HEAD)"
DIRTY=""
git diff --quiet HEAD -- . || DIRTY="-modifie"
VERSION="${SHA}${DIRTY}"

echo "Version déployée : ${VERSION}"
railway variables --service "$SERVICE" --set "APP_VERSION=${VERSION}" --skip-deploys >/dev/null
railway up --detach --service "$SERVICE"

echo
echo "Vérifier dans une minute :"
echo "  curl -s https://aigen-voice-backend-production.up.railway.app/health"
