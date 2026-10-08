# SoundCraft Pro

Analyseur acoustique local pour techniciens son. La Phase 1 fournit l’acquisition microphone, le spectre RTA, la détection de pitch et les vumètres.

## Prérequis

- Node.js 20.19+ ou 22.12+ (requis par Vite 8)
- Un navigateur moderne avec Web Audio API et AudioWorklet
- Un microphone ou une interface audio USB

## Installation et lancement

```bash
npm install
npm run dev
```

Vite démarre en HTTPS sur `https://localhost:5173`. Le certificat local est auto-signé : acceptez l’avertissement du navigateur pour l’environnement de développement. L’adresse `http://localhost` est aussi considérée comme un contexte sécurisé par les navigateurs modernes. Pour un téléphone sur le réseau local, servez l’application avec un certificat approuvé et une adresse HTTPS accessible depuis l’appareil.

Cliquez sur **Démarrer l’analyse** et autorisez l’accès au microphone. La page ne connecte jamais le micro à la sortie audio. L’option « Annulation de l’écho », la réduction de bruit et le gain automatique sont désactivés pour préserver la mesure.

## Commandes

```bash
npm run dev       # serveur de développement HTTPS
npm run build     # vérification TypeScript et compilation de production
npm run preview   # prévisualisation du build
npm test          # tests unitaires des fonctions audio pures
```

## Déploiement sur Vercel

Le projet est une application Vite statique; aucun backend ni fichier `vercel.json` n’est nécessaire.

1. Poussez le dépôt GitHub, puis connectez-vous à [Vercel](https://vercel.com/).
2. Choisissez **Add New… → Project**, importez `soundcraft-pro` et conservez le framework **Vite**.
3. Vérifiez les paramètres de build : commande `npm run build`, répertoire de sortie `dist`, commande d’installation `npm install`.
4. Cliquez sur **Deploy**. Les prochains pushs sur la branche de production déclencheront automatiquement un nouveau déploiement.

Vous pouvez aussi déployer depuis un terminal avec `npx vercel` (prévisualisation) ou `npx vercel --prod` (production), après authentification Vercel.

Vercel fournit le HTTPS requis par `getUserMedia` et AudioWorklet. Autorisez le microphone sur le domaine de production. Pour tester les changements avant mise en production, ouvrez la preview URL créée pour la branche ou la pull request. Cette première phase n’inclut pas encore le manifeste ni le service worker PWA.

## Périmètre livré

- Entrées audio énumérées, sélection de périphérique, mono/stéréo, gain numérique et erreurs de permissions explicites.
- RTA logarithmique de 20 Hz à 20 kHz, FFT 512–8192, lissage réglable, peak hold et lecture au curseur.
- Détection de fréquence par autocorrélation dans un AudioWorklet, note la plus proche et écart en cents.
- Vu-mètre analogique Canvas, modes VU/PPM/Peak, référence −18/−20 dBFS, voyants Peak/Clip, affichage RMS/crête et estimation SPL avec offset.
- Interface responsive, affichage plein écran et rendu Canvas animé via requestAnimationFrame.

## Vérification matérielle

Utilisez une interface audio USB connue, vérifiez que le périphérique apparaît dans la liste, puis contrôlez le niveau d’un signal stable et la fréquence d’une tonalité de référence. La calibration SPL dépend de l’offset saisi et d’un sonomètre de référence; l’application affiche une estimation, pas une mesure certifiée.

## À venir

Les phases suivantes ajouteront le générateur de signaux et la détection de larsen, les fonctions PWA hors ligne et les guides de branchement, puis les contrôles de polarité/câble et la checklist complète de calibration.