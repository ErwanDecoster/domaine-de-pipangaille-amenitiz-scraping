# 🎯 Guide Quickstart - Addon Home Assistant

## ✅ Qu'est-ce qui a été créé?

Votre projet a été entièrement transformé en **addon Home Assistant** professionnel et prêt à l'emploi.

### 📦 Fichiers clés

```
addon/                                  # ← L'addon complet
├── manifest.json                       # Configuration de l'addon
├── Dockerfile                          # Image Docker
├── run.sh                              # Démarrage
├── config.json                         # Schéma de config
├── README.md                           # Docs utilisateur
├── rootfs/app/                         # Code Node.js
└── translations/                       # Multi-langue

ADDON_COMPLETE.md                       # ← Résumé complet ici
ADDON_MIGRATION.md                      # ← Explication technique
ADDON_DEVELOPMENT.md                    # ← Guide développeur
```

---

## 🚀 Commencer en 5 minutes

### Étape 1: Tester localement (optionnel)

```bash
# Build l'image Docker
docker build -t pipangaille-addon addon/

# Tester
docker run \
  -e AMENITIZ_EMAIL="your-email@example.com" \
  -e AMENITIZ_PASSWORD="your-password" \
  -p 3000:3000 \
  -v /tmp/addon-data:/data \
  pipangaille-addon

# Vérifier (dans un autre terminal)
curl http://localhost:3000/api/health
```

### Étape 2: Mettre en ligne sur GitHub

```bash
git add .
git commit -m "feat: Home Assistant addon ready"
git push origin main
```

### Étape 3: Ajouter à Home Assistant

1. Aller à **Settings > Add-ons > Store**
2. Click le **⋮** en haut à droite → **Repositories**
3. Ajouter: `https://github.com/yourusername/your-repo`
4. Chercher "Domaine de Pipangaille"
5. **Install**
6. **Configure** (email, password)
7. **Start**

### Étape 4: Utiliser les données

Dans `configuration.yaml`:

```yaml
rest:
  - resource: http://localhost:3000/api/guests
    scan_interval: 600
    sensor:
      - name: "Guests"
        value_template: "{{ value_json.count }}"
        json_attributes:
          - guests
```

**C'est tout!** ✅

---

## 📚 Documentation

| Document | Pour qui | Lire si... |
|----------|----------|-----------|
| **addon/README.md** | Utilisateurs | Vous voulez installer & utiliser l'addon |
| **ADDON_MIGRATION.md** | Architectes | Vous voulez comprendre la structure |
| **ADDON_DEVELOPMENT.md** | Développeurs | Vous voulez modifier le code |
| **ADDON_COMPLETE.md** | Tous | Vous voulez le résumé complet |

---

## 🔧 Structure rapide

```
Home Assistant (votre serveur)
    ↓ demande /api/guests toutes les 10 min
Addon Docker (port 3000)
    ↓ lance Node.js server
    ↓ scrape Amenitiz
    ↓ retourne les clients
Home Assistant (affiche les données)
```

---

## ✨ Ce que vous pouvez faire maintenant

✅ **Installer l'addon** sur Home Assistant  
✅ **Afficher les clients** sur un dashboard  
✅ **Automatiser** sur base du nombre de clients  
✅ **Alerter** quand des clients arrivent  
✅ **Synchroniser** avec d'autres systèmes  

---

## 🆘 Besoin d'aide?

### "Comment construire l'addon?"
→ Voir `ADDON_DEVELOPMENT.md` section "Build & Test Local"

### "Comment l'installer?"
→ Voir `addon/README.md` section "Installation"

### "Comment l'utiliser dans Home Assistant?"
→ Voir `addon/README.md` section "Home Assistant Integration"

### "Ça ne fonctionne pas!"
→ Voir `ADDON_DEVELOPMENT.md` section "Troubleshooting"

### "Je veux modifier le code"
→ Voir `ADDON_DEVELOPMENT.md` section "Workflow de développement"

---

## 📞 Points clés à retenir

🔑 **Email/Password** - Stockés de manière sécurisée par Home Assistant  
🔑 **Sessions** - Sauvegardées pour éviter 2FA répété  
🔑 **Données** - Persistantes dans `/data/`, nettoyées automatiquement  
🔑 **API** - Accessible sur `http://localhost:3000`  
🔑 **Logs** - Visibles dans l'UI Home Assistant  

---

## 🎉 Vous êtes prêt!

L'addon est **100% fonctionnel** et prêt à être utilisé.

Procédez comme suit:
1. **Push** vers GitHub
2. **Add** comme repository dans Home Assistant
3. **Install** l'addon
4. **Configure** avec vos credentials
5. **Enjoy!** 🚀

---

**Status:** ✅ Addon structure complete, code adapted, docs ready

**Bonne chance! 🎯**
