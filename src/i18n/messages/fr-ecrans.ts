/**
 * Textes des écrans du process, de l'import, de l'export, des formulaires et
 * du partage, en français (la référence). en-ecrans.ts a les mêmes clés.
 */

/** Nombre écrit à la française : « 0,5 ». */
const num = (value: number) => String(Math.round(value * 100) / 100).replace('.', ',');

/** « 1 étape », « 3 étapes », « 0,5 jour » : le pluriel à partir de 2. */
const count = (n: number, [one, many]: readonly [string, string]) => `${num(n)} ${n > 1 ? many : one}`;

/** Un mot qui se compte : singulier et pluriel. */
const w = (one: string, many: string): readonly [string, string] => [one, many];

export const frScreens = {
  format: { num, count },

  /** Mots qui se comptent : [singulier, pluriel]. */
  words: {
    step: w('étape', 'étapes'),
    decision: w('décision', 'décisions'),
    actor: w('acteur', 'acteurs'),
    error: w('erreur', 'erreurs'),
    warning: w('avertissement', 'avertissements'),
    day: w('jour', 'jours'),
    workingDay: w('jour ouvré', 'jours ouvrés'),
    case: w('cas', 'cas'),
    path: w('chemin', 'chemins'),
    question: w('question', 'questions'),
    member: w('membre', 'membres'),
    situation: w('situation', 'situations'),
    link: w('lien', 'liens'),
    sheet: w('onglet', 'onglets'),
    row: w('ligne', 'lignes'),
    change: w('modification', 'modifications'),
  },

  sources: {
    drawio: 'draw.io',
    scan: 'Scan',
    json: 'JSON',
    tableau: 'Tableau',
    bpmn: 'BPMN',
    visio: 'Visio',
    texte: 'Texte',
  },

  list: {
    search: 'Rechercher un process',
    newAlerts: (n: number): string => (n > 1 ? `${n} nouvelles alertes du partage` : 'Une nouvelle alerte du partage'),
    offline: 'Hors connexion. Vous voyez la dernière version enregistrée.',
    errorTitle: 'Impossible de charger vos process',
    errorText: 'Le serveur n’a pas répondu. Vos données ne sont pas perdues.',
    emptyTitle: 'Aucun process pour l’instant',
    emptyText: 'Importez un fichier draw.io ou scannez un tableau pour commencer.',
    add: 'Ajouter un process',
    noMatch: (query: string): string => `Aucun process ne correspond à « ${query} ».`,
    hint: 'Vos process apparaîtront ici. Touchez + pour en importer un ou scanner un tableau, ou essayez d’abord les exemples ci-dessous.',
    shared: (n: number): string => `Partagés avec moi · ${n}`,
    sharedHint: 'À relire et valider : seul leur propriétaire peut les modifier.',
    examples: (n: number): string => `Exemples · ${n}`,
    examplesLabel: (n: number): string => `Exemples, ${n} process`,
    examplesHint: 'Fournis avec l’app, pour essayer. Masquez-les dans le Profil.',
    collapse: 'Replie les exemples',
    expand: 'Affiche les exemples',
    loading: 'Chargement des process',
  },

  card: {
    noIssue: 'Aucune anomalie',
    sharedBy: (name: string): string => `Partagé par ${name}`,
    source: (source: string): string => `Source : ${source}`,
    openHint: 'Ouvre le détail du process',
  },

  /** Dates et heures : « lundi 2 novembre à 13:00 », « 30 octobre 2026 à 22:15 », « 14 nov. à 09:30 ». */
  dates: {
    moment: (date: Date): string =>
      `${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    full: (date: Date): string =>
      `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    short: (date: Date): string =>
      `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    time: (date: Date): string => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  },

  untitled: 'Sans titre',
  kinds: { start: 'Départ', task: 'Tâche', decision: 'Décision', end: 'Fin' },

  detail: {
    notFound: 'Process introuvable',
    notFoundText: 'Ce process n’existe plus ou n’a pas encore été synchronisé.',
    backToList: 'Revenir à la liste',
    sourceText: {
      drawio: 'Importé depuis draw.io',
      scan: 'Créé à partir d’un tableau scanné',
      json: 'Importé depuis un fichier JSON',
      tableau: 'Importé depuis un tableau Excel ou CSV',
      bpmn: 'Importé depuis un schéma BPMN',
      visio: 'Importé depuis un schéma Visio',
      texte: 'Lu dans un texte',
    },
    shareMessage: (name: string, steps: string, toFix: number): string =>
      `${name} : ${steps}, ${toFix} point${toFix > 1 ? 's' : ''} à corriger (SimuFlow).`,
    deleteTitle: 'Supprimer ce process ?',
    deleteCloud: (name: string): string => `« ${name} » sera retiré de cet appareil et de votre compte.`,
    deleteLocal: (name: string): string => `« ${name} » sera retiré de cet appareil.`,
    delete: 'Supprimer',
    back: 'Process',
    share: 'Partager',
    sharedBy: (owner: string, actor: string | null): string => `Partagé par ${owner}${actor ? ` · votre partie : ${actor}` : ''}`,
    editedOn: (date: string): string => `Corrigé dans l’app le ${date}`,
    editHint: 'Modifier les étapes, les acteurs, les délais et les branches',
    edit: 'Modifier le process',
    stats: {
      steps: (n: number): string => (n > 1 ? 'étapes' : 'étape'),
      decisions: (n: number): string => (n > 1 ? 'décisions' : 'décision'),
      paths: (n: number): string => (n > 1 ? 'chemins possibles' : 'chemin possible'),
      toFix: (n: number): string => (n > 1 ? 'points à corriger' : 'point à corriger'),
    },
    sharing: 'Partage',
    shareWithActors: 'Partager avec les acteurs',
    shareWithActorsHint: 'Invitez-les par leur identifiant ou leur e-mail : ils voient le process sur leur compte.',
    myPart: 'Ma partie',
    reviewMyPart: 'Relire et valider ma partie',
    reviewMyPartHint: (owner: string): string =>
      `Pour chaque étape : validée, ou à revoir avec un commentaire. ${owner} verra vos avis.`,
    tracking: 'Suivi en vrai',
    actors: 'Acteurs',
    diagnostic: 'Diagnostic',
    steps: 'Étapes',
    deleteHint: 'Demande une confirmation',
    deleteProcess: 'Supprimer ce process',
    simulate: '▶  Lancer la simulation',
    simulateLabel: 'Lancer la simulation',
    trackingIntro:
      'Une vraie demande commence ? Suivez-la étape par étape : SimuFlow calcule l’échéance de chaque étape en jours ouvrés.',
    newTrackingLabel: (when: string): string => `Demande du ${when}`,
    currentDue: (title: string, due: string | null): string => (due ? `${title} · échéance ${due}` : title),
    finishedOn: (date: string): string => `Terminée le ${date}`,
    startTracking: 'Suivre une demande',
    noIssue: 'Aucune anomalie',
    seeStep: (title: string): string => `Voir l’étape : ${title}`,
    see: 'Voir',
    foldInfo: 'Replier les informations',
    foldedInfo: (n: number): string => (n > 1 ? `${n} informations repliées` : `${n} information repliée`),
  },

  /** Anomalies du diagnostic. */
  issues: {
    titles: {
      'no-start': 'Pas de départ',
      'multiple-starts': 'Plusieurs départs',
      'no-end': 'Pas de fin',
      'empty-title': 'Étape sans titre',
      'isolated-step': 'Étape isolée',
      unreachable: 'Étape inatteignable',
      'dead-end': 'Impasse',
      'cannot-finish': 'Boucle sans sortie',
      'decision-single-exit': 'Décision à une seule sortie',
      'unlabeled-branch': 'Branche sans étiquette',
      'duplicate-label': 'Libellés en double',
      'ambiguous-exits': 'Sorties à préciser',
      'dangling-link': 'Lien cassé',
    },
    messages: {
      'no-start': (): string => 'Aucun point de départ : ajoutez une étape de début.',
      'multiple-starts': (count?: number): string => `${count} points de départ : la simulation demandera lequel utiliser.`,
      'no-end': (): string => 'Aucune étape de fin : le process ne se termine nulle part.',
      'empty-title': (): string => 'Étape sans titre.',
      'isolated-step': (): string => 'Étape reliée à aucune autre.',
      unreachable: (): string => 'Étape que l’on ne peut jamais atteindre depuis le début.',
      'dead-end': (): string => 'Impasse : l’étape n’a pas de suite alors qu’elle n’est pas une fin.',
      'cannot-finish': (): string => 'Aucune fin atteignable depuis cette étape (boucle sans sortie).',
      'decision-single-exit': (): string => 'Décision avec une seule sortie.',
      'unlabeled-branch': (): string => 'Branche sans libellé après une décision (oui, non…).',
      'duplicate-label': (_count?: number, label?: string): string => `Deux branches portent le même libellé « ${label} ».`,
      'ambiguous-exits': (): string => 'Plusieurs sorties sans libellé : choix ou étapes en parallèle ? À préciser.',
      'dangling-link': (): string => 'Lien relié à une étape qui n’existe pas.',
    },
    /** Phrases qui nomment l'étape (`name` : « « Titre » »). */
    details: {
      name: (title: string): string => `« ${title} »`,
      'dead-end': (name: string): string => `${name} n’a aucune sortie.`,
      'cannot-finish': (name: string): string => `Depuis ${name}, aucune fin n’est atteignable.`,
      unreachable: (name: string): string => `On ne peut jamais arriver à ${name} depuis le départ.`,
      'isolated-step': (name: string): string => `${name} n’est reliée à aucune autre étape.`,
      'decision-single-exit': (name: string): string => `Décision ${name} : une seule sortie, il en faut au moins deux.`,
      'unlabeled-branch': (name: string): string => `Décision ${name} : une sortie n’a pas de libellé.`,
      'duplicate-label': (name: string, label?: string): string => `Décision ${name} : deux sorties s’appellent « ${label} ».`,
      'ambiguous-exits': (name: string): string => `Plusieurs sorties de ${name} sans libellé : choix ou étapes en parallèle ?`,
      'multiple-starts': (name: string, count?: number): string => `${count} points de départ, dont ${name}.`,
    },
  },

  tracking: {
    notFound: 'Suivi introuvable',
    notFoundText: 'Cette demande ou son process n’existe plus sur ce téléphone.',
    back: 'Revenir',
    stopTitle: 'Arrêter ce suivi ?',
    stopText: (label: string): string => `« ${label} » sera retiré de cet appareil.`,
    stopConfirm: 'Arrêter',
    startedOn: (name: string, date: string): string => `${name} · commencée le ${date}`,
    current: 'Étape en cours',
    due: (date: string): string => `Échéance : ${date}`,
    noDue: 'Pas de délai pour cette étape',
    whichNext: 'Étape terminée : quelle suite ?',
    next: 'Suite',
    stepDone: 'Étape terminée',
    finish: 'Terminer la demande',
    stepDoneGoTo: (title: string): string => `Étape terminée, passer à « ${title} »`,
    finished: 'Demande terminée',
    finishedIn: (date: string, days: string): string => `Le ${date}, en ${days}.`,
    answers: 'Réponses du formulaire',
    pastSteps: 'Étapes passées',
    doneOn: (date: string): string => `Terminée le ${date}`,
    stop: 'Arrêter ce suivi',
    badge: {
      done: 'Terminée',
      noDelay: 'Sans délai',
      doneLate: (days: string): string => `Terminée avec ${days} de retard`,
      late: (days: string): string => `En retard de ${days}`,
      doneOnTime: 'Terminée à temps',
      soon: 'Échéance proche',
      onTime: 'À l’heure',
    },
    reminders: {
      untitled: 'Étape sans titre',
      todayTitle: (title: string): string => `Aujourd’hui : ${title}`,
      todayBody: (label: string, time: string): string => `${label} · échéance à ${time}.`,
      lateTitle: (title: string): string => `En retard : ${title}`,
      lateBody: (label: string, time: string): string => `${label} · l’étape devait être terminée à ${time}.`,
    },
  },

  notifications: {
    deadlineChannel: 'Échéances des process',
    deadlineChannelText: 'Rappels avant et après l’échéance de chaque étape d’un process suivi.',
    shareChannel: 'Partage des process',
    shareChannelText: 'Un process partagé avec vous, une étape à revoir, un process entièrement validé.',
    testBody: 'Les notifications marchent : vous serez prévenu des échéances de vos process suivis.',
  },

  validationCard: {
    allValidated: (n: number): string =>
      n > 1 ? `Process entièrement validé par les ${n} membres.` : 'Process entièrement validé.',
    noneDone: (members: string): string => `Aucun membre n’a encore fini (${members})`,
    done: (done: number, total: number): string =>
      `${done} membre${done > 1 ? 's' : ''} sur ${total} ${done > 1 ? 'ont' : 'a'} fini`,
    toRevise: (steps: string): string => `${steps} à revoir`,
    validated: 'Validé',
    revise: 'À revoir',
    inProgress: 'En cours',
    hint: 'Ouvre le suivi de la validation, étape par étape',
    title: 'Suivi de la validation',
  },
};

export type ScreenMessages = typeof frScreens;
