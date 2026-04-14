# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-04-14

### ✨ Ajouté
- **Scraping "sur-place"** : récupération des clients en cours de séjour (`/stay-overs`) en plus des arrivées (`/arrivals`)
- **Champ `status`** par client : `"arriving"` ou `"in-house"`
- **Déduplication** des clients présents dans les deux pages
- **Persistence sur disque** : le dernier état connu est sauvegardé dans `last_known_state.json` et rechargé au démarrage pour éviter les données vides après un redémarrage
- **Durée de validité configurable** des données persistées (`cache_max_age_hours`, défaut : 12h)
- **Refresh dynamique par plage horaire** : l'intervalle de rafraîchissement s'adapte automatiquement selon l'heure
  - Matin (08h-14h) : 30 min
  - Après-midi/soirée (14h-22h) : 10 min
  - Nuit (22h-08h) : 3h
- **Toutes les plages horaires et intervalles sont configurables** depuis les options de l'addon HA
- **Sensors HA par chambre** : `client`, `montant_dû`, `personnes` pour chaque chambre (Toscane, Africaine, Marocaine, Créole)
- **Binary sensors HA** par chambre avec `unique_id`
- **`build.yaml`** : mapping des images de base par architecture (corrige le build sur aarch64)
- **`host_network: true`** dans `config.yaml` pour accessibilité depuis HA core

### 🔧 Corrigé
- **`BUILD_FROM` vide** : ajout de `build.yaml` avec les images officielles HA par architecture
- **`isMandatory` non défini** : suppression du paramètre obsolète dans `refreshData()`
- **Accent "Chambre Créole"** : harmonisation avec le nom renvoyé par Amenitiz (`Chambre Creole`)
- **Cache sans TTL fixe** : le cache ne s'expire plus automatiquement, les données restent disponibles entre les refreshs
- **Payload `rest_command` 2FA** : correction de la syntaxe YAML (`content_type` + payload sur une ligne)
- **Variables inutilisées** nettoyées : `autoRefreshDisabled`, `now`, `isMandatory`, `path`

### 🔄 Modifié
- **`refreshData()`** : n'accepte plus de paramètre, `scheduleRetry()` appelé sur tous les échecs
- **`setInterval` → `scheduleNextAutoRefresh()`** : scheduler dynamique basé sur `setTimeout` récursif
- **`configuration.yaml`** : suppression des `input_boolean`, `input_number`, `input_text` par chambre (remplacés par les template sensors automatiques)

## [1.0.1] - 2026-01-13

### 🔧 Corrigé
- **Erreur critique s6-overlay** : Correction de l'erreur "S6-overlay-suexec: fatal: can only run as pid 1"
- Restructuration complète pour compatibilité Home Assistant

### ✨ Ajouté
- Structure s6-overlay conforme (`/etc/services.d/` et `/etc/cont-init.d/`)
- Script d'initialisation `/etc/cont-init.d/01-init.sh`
- Service s6 `/etc/services.d/guest-manager/run`
- Script de fin de service `/etc/services.d/guest-manager/finish`
- Utilisation de `bashio` pour la configuration Home Assistant
- Script de build `build.sh` pour tests locaux
- Script de validation `validate.sh`
- Documentation détaillée dans `FIXING_S6_ERROR.md`
- Guide de migration dans `MIGRATION.md`
- Fichier `.dockerignore` pour optimisation du build

### 🗑️ Supprimé
- `run.sh` à la racine (remplacé par service s6)
- `CMD ["/run.sh"]` dans le Dockerfile
- Installation de `jq` (remplacé par bashio)
- HEALTHCHECK manuel (géré par Home Assistant)

### 🔄 Modifié
- **Dockerfile** : Copie de `rootfs/`, suppression de CMD, permissions s6
- **config.yaml** : Ajout de `init: false`, version bumped à 1.0.1
- **manifest.json** : Version bumped à 1.0.1

### 📋 Détails techniques
- s6-overlay est maintenant correctement PID 1
- Configuration chargée via bashio depuis Home Assistant
- Supervision automatique du service Node.js
- Logs structurés avec bashio::log

## [1.0.0] - 2026-01-12

### ✨ Première version
- API REST pour scraping Amenitiz
- Support Puppeteer avec Chromium
- Gestion des sessions persistantes
- Support 2FA
- Auto-refresh toutes les 10 minutes
- Nettoyage automatique des anciennes données
- Support multi-architecture
- Intégration Home Assistant

---

Pour plus de détails sur la correction v1.0.1, consultez [FIXING_S6_ERROR.md](FIXING_S6_ERROR.md)
