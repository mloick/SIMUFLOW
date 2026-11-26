/**
 * Textes de l'app en français : la référence. messages/en.ts a les mêmes clés.
 * Une valeur est un texte, ou une fonction quand le texte contient une valeur
 * (un nombre, un nom).
 */

import { frScreens } from './fr-ecrans';

const PASSWORD_MIN = 8;

export const fr = {
  ...frScreens,

  common: {
    /** Pour les dates et les heures. */
    locale: 'fr-FR',
    cancel: 'Annuler',
    retry: 'Réessayer',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    remove: 'Retirer',
    signIn: 'Se connecter',
    sending: 'Envoi en cours',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'prenom.nom@exemple.fr',
    offline: 'Serveur injoignable : vérifiez la connexion Internet.',
  },

  tabs: { process: 'Process', scanner: 'Scanner', projects: 'Projets', settings: 'Réglages' },

  /** Titres des écrans, dans la barre du haut. */
  titles: {
    signIn: 'Connexion',
    myProfile: 'Mon profil',
    profile: 'Profil',
    newPassword: 'Nouveau mot de passe',
    process: 'Process',
    edit: 'Modifier',
    simulation: 'Simulation',
    tracking: 'Suivi',
    import: 'Importer un process',
    form: 'Formulaire',
    editForm: 'Modifier le formulaire',
    export: 'Exporter le schéma',
    share: 'Partager',
    myPart: 'Ma partie',
    validation: 'Suivi de la validation',
    alerts: 'Alertes',
    link: 'Relire ma partie',
    view: 'Consultation',
    shareLink: 'Partager par lien',
    project: 'Projet',
    dashboard: 'Tableau de bord',
    newProject: 'Nouveau projet',
    editProject: 'Renommer le projet',
    addToProject: 'Ajouter des process',
    pickProject: 'Ranger dans un projet',
  },

  language: {
    heading: 'Langue',
    options: { auto: 'Automatique', fr: 'Français', en: 'English' },
    autoHint: (current: string): string => `Suit la langue du téléphone (actuellement : ${current}).`,
    fixedHint: 'Garde cette langue, quelle que soit celle du téléphone.',
    names: { fr: 'français', en: 'anglais' },
  },

  help: {
    explain: (title: string): string => `Expliquer : ${title}`,
    ok: 'Compris',
    close: 'Fermer l’explication',
  },

  theme: {
    heading: 'Apparence',
    options: { auto: 'Automatique', light: 'Clair', dark: 'Sombre' },
    autoHint: 'Suit le réglage du téléphone.',
    fixedHint: 'Garde ce mode, quel que soit le réglage du téléphone.',
    colors: 'Couleurs',
    palettes: { ocean: 'Océan', aurore: 'Aurore', menthe: 'Menthe', corail: 'Corail' },
    paletteLabel: (name: string): string => `Palette ${name}`,
    helpText:
      'Quatre palettes, chacune en clair et en sombre : Océan (le bleu SimuFlow), Aurore (violet et rose), Menthe (vert et ambre) et Corail (terre cuite et bleu marine). Toute l’app change tout de suite. Automatique suit le réglage clair ou sombre du téléphone. Les deux choix restent gardés sur ce téléphone.',
  },

  settings: {
    title: 'Réglages',
    profileSubtitle: 'Mon profil, mon compte, mes données',
    signInTitle: 'Se connecter',
    signInSubtitle: 'Pour retrouver vos process sur tous vos appareils',
    openProfile: 'Ouvrir mon profil',
    mode: 'Mode',
    languageHelp:
      'Automatique suit la langue du téléphone. Français ou English garde cette langue, quelle que soit celle du téléphone. Ce que vous importez reste écrit tel quel.',
    seeAlerts: 'Voir les alertes',
    newAlerts: (count: number): string => `${count} nouvelle${count > 1 ? 's' : ''}`,
    testNotification: 'Notification d’essai',
    send: 'Envoyer',
    replayWelcome: 'Revoir la présentation',
    privacy: 'Politique de confidentialité',
    version: 'Version',
    versionHelp:
      'La version installée, et la date de la dernière mise à jour reçue sans passer par le store. Les corrections arrivent toutes seules, au lancement suivant.',
    server: 'Serveur SimuFlow',
    serverHelp:
      'Le serveur garde votre compte, vos process synchronisés et les partages. Sans lui, l’app marche quand même : tout reste sur ce téléphone.',
    serverStatus: { checking: 'Vérification…', ok: 'Joignable', unreachable: 'Injoignable', error: 'Erreur' },
  },

  roles: { chef_de_projet: 'Chef de projet', collaborateur: 'Collaborateur' },

  profil: {
    title: 'Profil',
    intro: 'Votre compte, vos formulaires gardés et ce que l’app a appris de vos corrections.',
    account: 'Compte',
    signInInvite: 'Connectez-vous pour retrouver vos process sur tous vos appareils.',
    signInLink: 'Se connecter ou créer un compte →',
    connectedAs: (email: string): string => `Connecté : ${email}`,
    connected: 'Connecté',
    signOut: 'Se déconnecter',
    profileLoading: 'Lecture du profil…',
    profileMissing: 'Ajoutez votre nom et un identifiant pour être invité sur un process.',
    completeProfile: 'Compléter mon profil',
    editProfile: 'Modifier →',
    syncing: 'Synchronisation…',
    syncedAt: (time: string): string => `Process synchronisés à ${time}`,
    conflictCopies: (names: string[]): string =>
      names.length === 1
        ? `Modifié à deux endroits : votre version est gardée à part, « ${names[0]} ».`
        : `${names.length} process modifiés à deux endroits : vos versions sont gardées à part (${names.map((name) => `« ${name} »`).join(', ')}).`,
    copyName: (name: string): string => `${name} (version de cet appareil)`,
    syncIdle: 'Vos process importés sont gardés sur votre compte.',
    syncNow: 'Synchroniser',
    deleteAccount: 'Supprimer mon compte',
    deleteAccountHint:
      'La suppression efface votre compte et vos process, sur le serveur et sur ce téléphone. Elle vous sera demandée une seconde fois pour confirmer.',
    deleteConfirmTitle: 'Supprimer définitivement votre compte ?',
    deleteConfirmText:
      'Votre compte et tous vos process seront effacés, sur le serveur et sur ce téléphone. Impossible de revenir en arrière.',
    deleteConfirmLabel: 'Supprimer définitivement mon compte',
    deleteConfirm: 'Supprimer',
    deleteFailed: 'La suppression a échoué. Réessayez plus tard.',
    savedForms: 'Mes formulaires',
    savedFormsEmpty:
      'Aucun pour l’instant. Importez un template de formulaire (Excel), puis touchez « Garder ce formulaire » : vous pourrez le remplir à nouveau et lui lier un workflow plus tard.',
    unnamedForm: 'Formulaire sans nom',
    linkedTo: (name: string): string => `lié à ${name}`,
    aWorkflow: 'un workflow',
    noWorkflow: 'sans workflow',
    openForm: (name: string, link: string): string => `Ouvrir le formulaire ${name}, ${link}`,
    formQuestions: (count: number, link: string): string => `${count} questions · ${link}`,
    removeForm: (name: string): string => `Retirer le formulaire ${name}`,
    formsKeptAccount: 'Gardés avec leur workflow, sur ce téléphone et sur votre compte.',
    formsKeptLocal:
      'Gardés avec leur workflow sur ce téléphone. Connectez-vous pour les retrouver sur tous vos appareils.',
    rules: 'Règles de lecture apprises',
    rulesEmpty:
      'Aucune pour l’instant. Quand vous corrigez un process importé (un acteur renommé partout, une forme qui veut dire « décision »), SimuFlow le retient et le refait aux imports suivants.',
    forgetRule: (text: string): string => `Oublier la règle : ${text}`,
    forget: 'Oublier',
    rulesKeptAccount: 'Gardées sur ce téléphone et sur votre compte.',
    rulesKeptLocal: 'Gardées sur ce téléphone. Connectez-vous pour les retrouver sur tous vos appareils.',
    processList: 'Liste des process',
    showExamples: 'Afficher les exemples',
    showExamplesHint: 'Quatre process fictifs fournis avec l’app, en bas de la liste.',
    notifications: 'Notifications',
    reminders: 'Rappels d’échéance',
    remindersHint: 'Le matin de l’échéance de chaque étape d’une demande suivie, puis en cas de retard.',
    shareAlerts: 'Alertes du partage',
    shareAlertsHint: 'Un process partagé avec vous, une étape à revoir, un process entièrement validé.',
    seeAlerts: (unread: number): string =>
      unread > 0 ? `Voir les alertes · ${unread} nouvelle${unread > 1 ? 's' : ''}` : 'Voir les alertes',
    testNotification: 'Envoyer une notification d’essai',
    openSettings: 'Ouvrir les réglages',
    notifUnavailable:
      'Les notifications ne sont pas disponibles dans le navigateur : les alertes du partage restent dans « Voir les alertes ».',
    notifOff: 'Rappels coupés : aucune notification ne sera envoyée.',
    notifDenied: 'Les notifications sont refusées pour SimuFlow dans les réglages du téléphone.',
    notifUndetermined: 'Le téléphone vous demandera l’autorisation au premier rappel.',
    notifSent: (seconds: number): string =>
      `Notification envoyée : elle arrive dans ${seconds} secondes, même téléphone verrouillé.`,
    notifReady: 'Les notifications sont programmées sur ce téléphone, sans serveur.',
    about: 'À propos',
    serverChecking: 'Vérification du serveur…',
    serverOk: 'Serveur SimuFlow joignable',
    serverUnreachable: 'Serveur injoignable : vérifiez la connexion Internet',
    serverError: 'Le serveur répond avec une erreur',
    replayWelcome: 'Revoir la présentation →',
    privacy: 'Politique de confidentialité ↗',
    opensInBrowser: 'Ouvre la page dans le navigateur.',
    updateOf: (date: string, time: string): string => `mise à jour du ${date} à ${time}`,
    installedVersion: 'version installée',
    demo: 'Démo · état de la liste des process',
    back: 'Revenir',
    edit: 'Modifier',
    editLabel: 'Modifier mon profil',
    noAccount: 'Sans compte',
    noAccountDetail: 'Vos process restent sur ce téléphone.',
    stats: { processes: 'process', shared: 'partagés', forms: 'formulaires' },
    statsLabel: (processes: number, shared: number, forms: number): string =>
      `${processes} process à vous, ${shared} partagés avec vous, ${forms} formulaires gardés`,
    syncWhat: 'Process, formulaires et règles',
    syncLabel: 'Synchroniser maintenant',
    formsHelp:
      'Les templates de formulaire que vous avez gardés, avec leur workflow. Touchez-en un pour le remplir ou le relier à un workflow ; « Retirer » le supprime de la liste.',
    rulesHelp:
      'Quand vous corrigez un process importé (un acteur renommé partout, une forme qui veut dire « décision »), SimuFlow retient la correction et l’applique aux fichiers suivants. « Oublier » efface une règle.',
    noForms: 'Aucun formulaire gardé pour l’instant.',
    noRules: 'Aucune règle pour l’instant.',
    deleteForever: 'Supprimer définitivement',
  },

  welcome: {
    skip: 'Passer',
    next: 'Suivant',
    start: 'Commencer',
    previous: 'Précédent',
    pageOf: (page: number, total: number): string => `Page ${page} sur ${total}`,
    pages: [
      {
        title: 'Bienvenue dans SimuFlow',
        text: 'Validez vos process avant de les mettre en place : rejouez-les étape par étape et repérez ce qui coince.',
      },
      {
        title: 'Ajoutez vos process',
        text: 'Importez un schéma draw.io ou un fichier JSON, ou photographiez un tableau avec le Scanner. Quatre exemples sont là pour essayer tout de suite.',
      },
      {
        title: 'Rejouez et corrigez',
        text: 'Simulez pas à pas, voyez tous les cas d’un coup et le chemin le plus long, corrigez le process dans l’app, puis exportez le schéma.',
      },
      {
        title: 'Suivez une vraie demande',
        text: 'Suivez une demande en jours ouvrés : SimuFlow vous rappelle ses échéances. Créez un compte dans le Profil pour retrouver vos process sur tous vos appareils.',
      },
    ],
    installTitle: 'Installez SimuFlow',
    installText: {
      ios: 'En trois gestes, sur l’écran d’accueil :',
      android: 'En trois gestes, sur l’écran d’accueil :',
      desktop: 'SimuFlow s’utilise aussi comme une app sur votre téléphone :',
    },
    installSteps: {
      ios: [
        'Dans Safari, touchez les trois points (•••), puis « Partager » (ou directement le bouton Partager, en bas).',
        'Touchez « Sur l’écran d’accueil » (faites défiler si besoin).',
        'Touchez « Ajouter », puis ouvrez SimuFlow depuis son icône : il s’ouvre comme une app, en plein écran.',
      ],
      android: [
        'Dans Chrome, touchez les trois points (⋮) en haut à droite.',
        'Touchez « Ajouter à l’écran d’accueil » ou « Installer l’application ».',
        'Confirmez avec « Installer », puis ouvrez SimuFlow depuis son icône : il s’ouvre comme une app, en plein écran.',
      ],
      desktop: [
        'Sur un téléphone, ouvrez ce même lien, puis suivez les étapes qui s’affichent.',
        'Sur ordinateur, Chrome et Edge proposent aussi « Installer SimuFlow », avec l’icône à droite de la barre d’adresse.',
      ],
    },
  },

  signIn: {
    checkMail: 'Vérifiez vos e-mails',
    confirmSent: (email: string): string =>
      `Un lien de confirmation a été envoyé à ${email}. Ouvrez-le, puis revenez vous connecter.`,
    taglineCreate: 'Créez un compte pour retrouver vos process sur tous vos appareils.',
    tagline: 'Validez vos workflows en les rejouant pas à pas.',
    password: 'Mot de passe',
    forgot: 'Mot de passe oublié ?',
    createAccount: 'Créer mon compte',
    privacyNote: 'Votre adresse et vos process sont gardés sur un serveur en Union européenne, visibles par vous seul.',
    privacy: 'Politique de confidentialité',
    haveAccount: 'Déjà un compte ?',
    noAccount: 'Pas encore de compte ?',
    switchCreate: 'Créer un compte',
    title: 'Connectez-vous',
    subtitle: 'Retrouvez vos process sur tous vos appareils.',
    titleCreate: 'Créez votre compte',
    subtitleCreate: 'Gratuit, en trente secondes.',
    passwordPlaceholder: '8 caractères au moins',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    or: 'ou',
    continueWithout: 'Continuer sans compte',
    why: 'Pourquoi un compte ?',
    whyText:
      'Avec un compte, vos process vous suivent sur tous vos appareils et vous pouvez les partager avec les acteurs. Sans compte, tout reste sur ce téléphone.',
    close: 'Fermer',
    illustration: { start: 'Départ', step: 'Qualifier', wait: 'Valider · 2 JO' },
  },

  reset: {
    title: 'Mot de passe oublié',
    intro: 'Saisissez votre adresse : vous recevrez un lien par e-mail pour choisir un nouveau mot de passe.',
    sent: (email: string): string =>
      `Si un compte existe pour ${email}, un e-mail vient de lui être envoyé. Ouvrez le lien qu'il contient sur ce téléphone : SimuFlow s'ouvrira pour choisir un nouveau mot de passe. Le lien est valable une heure.`,
    resend: 'Renvoyer un e-mail',
    send: 'Recevoir un lien',
    back: 'Retour à la connexion',
  },

  newPassword: {
    invalidLink:
      "Ce lien n'est pas valide. Ouvrez le dernier e-mail « Mot de passe oublié » reçu, ou demandez-en un nouveau.",
    done: 'Mot de passe changé',
    doneText: 'Vous êtes connecté avec votre nouveau mot de passe.',
    continue: 'Continuer',
    unusable: 'Lien inutilisable',
    askNew: 'Demander un nouveau lien',
    opening: 'Ouverture du lien',
    title: 'Nouveau mot de passe',
    intro: 'Choisissez le mot de passe que vous utiliserez désormais.',
    save: 'Enregistrer le mot de passe',
  },

  myProfile: {
    signInRequired: 'Connexion requise',
    signInRequiredText: 'Le profil est gardé sur votre compte : connectez-vous d’abord.',
    unavailable: 'Profil indisponible',
  },

  /** Vérification des champs et erreurs de Supabase Auth. */
  auth: {
    passwordRule: `Au moins ${PASSWORD_MIN} caractères, avec une minuscule, une majuscule, un chiffre et un symbole.`,
    passwordTooShort: `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`,
    missing: {
      lower: 'une minuscule',
      upper: 'une majuscule',
      digit: 'un chiffre',
      symbol: 'un symbole (par exemple ! ? # -)',
    },
    and: 'et',
    passwordMissing: (list: string): string => `Il manque au mot de passe ${list}.`,
    emailEmpty: 'Saisissez votre adresse e-mail.',
    emailInvalid: "Cette adresse e-mail n'est pas valide.",
    passwordEmpty: 'Saisissez votre mot de passe.',
    errors: {
      invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
      email_not_confirmed: "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail.",
      user_already_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
      email_exists: 'Un compte existe déjà avec cette adresse. Connectez-vous.',
      weak_password: 'Mot de passe trop faible.',
      email_address_invalid: "Cette adresse e-mail n'est pas acceptée.",
      over_email_send_rate_limit: "Trop d'e-mails envoyés. Réessayez dans une heure.",
      over_request_rate_limit: 'Trop de tentatives. Patientez quelques minutes.',
      signup_disabled: 'La création de compte est fermée pour le moment.',
      otp_expired: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
      access_denied: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
      same_password: "Choisissez un mot de passe différent de l'ancien.",
    } as Record<string, string>,
    failed: 'La connexion a échoué. Réessayez.',
  },

  profileForm: {
    intro: 'Votre nom et votre identifiant permettront de vous inviter sur un process partagé.',
    firstName: 'Prénom',
    lastName: 'Nom',
    username: 'Identifiant',
    usernameHint: 'Unique, il sert à vous inviter sur un process.',
    usernameHelp: 'Proposé d’après votre nom, modifiable. Unique : il sert à vous inviter.',
    role: 'Fonction habituelle',
    noRole: 'Ne pas préciser',
    roleHelp:
      'Une simple mention, pour vous reconnaître. Elle ne donne aucun droit : le rôle de chef de projet se décide dans chaque projet.',
    taken: (taken: string, other: string): string =>
      `« ${taken} » est déjà pris : « ${other} » est proposé à la place.`,
    failed: 'Le profil n’a pas pu être enregistré.',
    usernameMin: (min: number): string => `Au moins ${min} caractères.`,
    usernameMax: (max: number): string => `Au plus ${max} caractères.`,
    usernameChars:
      'Minuscules sans accent, chiffres, point, tiret ou tiret bas ; commence par une lettre ou un chiffre.',
    firstNameRequired: 'Le prénom est obligatoire.',
    lastNameRequired: 'Le nom est obligatoire.',
    namesTooLong: 'Le prénom et le nom font au plus 60 caractères.',
  },
};

export type Messages = typeof fr;
