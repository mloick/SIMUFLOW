/** Screen texts in English: same keys as fr-ecrans.ts (TypeScript checks it). */

import type { ScreenMessages } from './fr-ecrans';

/** Number written the English way: “0.5”. */
const num = (value: number) => String(Math.round(value * 100) / 100);

/** “1 step”, “3 steps”, “0 steps”: plural unless exactly one. */
const count = (n: number, [one, many]: readonly [string, string]) => `${num(n)} ${n === 1 ? one : many}`;

/** Un mot qui se compte : singulier et pluriel. */
const w = (one: string, many: string): readonly [string, string] => [one, many];

export const enScreens: ScreenMessages = {
  format: { num, count },

  words: {
    step: w('step', 'steps'),
    decision: w('decision', 'decisions'),
    actor: w('actor', 'actors'),
    error: w('error', 'errors'),
    warning: w('warning', 'warnings'),
    day: w('day', 'days'),
    workingDay: w('working day', 'working days'),
    case: w('case', 'cases'),
    path: w('path', 'paths'),
    question: w('question', 'questions'),
    member: w('member', 'members'),
    situation: w('situation', 'situations'),
    link: w('link', 'links'),
    sheet: w('sheet', 'sheets'),
    row: w('row', 'rows'),
    change: w('change', 'changes'),
  },

  sources: {
    drawio: 'draw.io',
    scan: 'Scan',
    json: 'JSON',
    tableau: 'Spreadsheet',
    bpmn: 'BPMN',
    visio: 'Visio',
    texte: 'Text',
  },

  list: {
    search: 'Search processes',
    newAlerts: (n: number) => (n > 1 ? `${n} new sharing alerts` : 'One new sharing alert'),
    offline: 'Offline. You are seeing the last saved version.',
    errorTitle: 'Could not load your processes',
    errorText: 'The server did not answer. Your data is not lost.',
    emptyTitle: 'No processes yet',
    emptyText: 'Import a draw.io file or scan a table to get started.',
    add: 'Add a process',
    noMatch: (query: string) => `No process matches “${query}”.`,
    hint: 'Your processes will show up here. Tap + to import one or scan a table, or try the examples below first.',
    shared: (n: number) => `Shared with me · ${n}`,
    sharedHint: 'To review and validate: only their owner can change them.',
    examples: (n: number) => `Examples · ${n}`,
    examplesLabel: (n: number) => `Examples, ${n} processes`,
    examplesHint: 'Included with the app, to try things out. Hide them in Profile.',
    collapse: 'Collapses the examples',
    expand: 'Shows the examples',
    loading: 'Loading processes',
  },

  card: {
    noIssue: 'No issues',
    sharedBy: (name: string) => `Shared by ${name}`,
    source: (source: string) => `Source: ${source}`,
    openHint: 'Opens the process details',
  },


  dates: {
    moment: (date: Date) =>
      `${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
    full: (date: Date) =>
      `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
    short: (date: Date) =>
      `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
    time: (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  },

  untitled: 'Untitled',
  kinds: { start: 'Start', task: 'Task', decision: 'Decision', end: 'End' },

  detail: {
    notFound: 'Process not found',
    notFoundText: 'This process no longer exists or has not been synced yet.',
    backToList: 'Back to the list',
    sourceText: {
      drawio: 'Imported from draw.io',
      scan: 'Created from a scanned table',
      json: 'Imported from a JSON file',
      tableau: 'Imported from an Excel or CSV table',
      bpmn: 'Imported from a BPMN diagram',
      visio: 'Imported from a Visio diagram',
      texte: 'Read from a text',
    },
    shareMessage: (name: string, steps: string, toFix: number) =>
      `${name}: ${steps}, ${toFix} issue${toFix === 1 ? '' : 's'} to fix (SimuFlow).`,
    deleteTitle: 'Delete this process?',
    deleteCloud: (name: string) => `“${name}” will be removed from this device and from your account.`,
    deleteLocal: (name: string) => `“${name}” will be removed from this device.`,
    delete: 'Delete',
    back: 'Processes',
    share: 'Share',
    sharedBy: (owner: string, actor: string | null) => `Shared by ${owner}${actor ? ` · your part: ${actor}` : ''}`,
    editedOn: (date: string) => `Fixed in the app on ${date}`,
    editHint: 'Edit the steps, actors, durations and branches',
    edit: 'Edit the process',
    stats: {
      steps: (n: number) => (n === 1 ? 'step' : 'steps'),
      decisions: (n: number) => (n === 1 ? 'decision' : 'decisions'),
      paths: (n: number) => (n === 1 ? 'possible path' : 'possible paths'),
      toFix: (n: number) => (n === 1 ? 'issue to fix' : 'issues to fix'),
    },
    sharing: 'Sharing',
    shareWithActors: 'Share with the actors',
    shareWithActorsHint: 'Invite them by username or email: they see the process on their account.',
    myPart: 'My part',
    reviewMyPart: 'Review and validate my part',
    reviewMyPartHint: (owner: string) =>
      `For each step: validated, or to fix with a comment. ${owner} will see your feedback.`,
    tracking: 'Real-life tracking',
    actors: 'Actors',
    diagnostic: 'Diagnostic',
    steps: 'Steps',
    deleteHint: 'Asks for confirmation',
    deleteProcess: 'Delete this process',
    simulate: '▶  Start the simulation',
    simulateLabel: 'Start the simulation',
    trackingIntro:
      'A real request is starting? Track it step by step: SimuFlow works out the deadline of each step in working days.',
    newTrackingLabel: (when: string) => `Request of ${when}`,
    currentDue: (title: string, due: string | null) => (due ? `${title} · due ${due}` : title),
    finishedOn: (date: string) => `Finished on ${date}`,
    startTracking: 'Track a request',
    noIssue: 'No issues',
    seeStep: (title: string) => `See the step: ${title}`,
    see: 'See',
    foldInfo: 'Hide the notes',
    foldedInfo: (n: number) => (n === 1 ? `${n} hidden note` : `${n} hidden notes`),
  },

  issues: {
    titles: {
      'no-start': 'No start',
      'multiple-starts': 'Several starts',
      'no-end': 'No end',
      'empty-title': 'Untitled step',
      'isolated-step': 'Isolated step',
      unreachable: 'Unreachable step',
      'dead-end': 'Dead end',
      'cannot-finish': 'Loop with no way out',
      'decision-single-exit': 'Decision with one exit',
      'unlabeled-branch': 'Unlabelled branch',
      'duplicate-label': 'Duplicate labels',
      'ambiguous-exits': 'Exits to clarify',
      'dangling-link': 'Broken link',
    },
    messages: {
      'no-start': () => 'No starting point: add a start step.',
      'multiple-starts': (count?: number) => `${count} starting points: the simulation will ask which one to use.`,
      'no-end': () => 'No end step: the process never finishes.',
      'empty-title': () => 'Untitled step.',
      'isolated-step': () => 'Step linked to no other step.',
      unreachable: () => 'Step that can never be reached from the start.',
      'dead-end': () => 'Dead end: the step has nothing after it but is not an end.',
      'cannot-finish': () => 'No end can be reached from this step (loop with no way out).',
      'decision-single-exit': () => 'Decision with only one exit.',
      'unlabeled-branch': () => 'Branch without a label after a decision (yes, no…).',
      'duplicate-label': (_count?: number, label?: string) => `Two branches have the same label “${label}”.`,
      'ambiguous-exits': () => 'Several unlabelled exits: a choice or parallel steps? To clarify.',
      'dangling-link': () => 'Link to a step that does not exist.',
    },
    details: {
      name: (title: string) => `“${title}”`,
      'dead-end': (name: string) => `${name} has no exit.`,
      'cannot-finish': (name: string) => `From ${name}, no end can be reached.`,
      unreachable: (name: string) => `${name} can never be reached from the start.`,
      'isolated-step': (name: string) => `${name} is not linked to any other step.`,
      'decision-single-exit': (name: string) => `Decision ${name}: only one exit, it needs at least two.`,
      'unlabeled-branch': (name: string) => `Decision ${name}: one exit has no label.`,
      'duplicate-label': (name: string, label?: string) => `Decision ${name}: two exits are called “${label}”.`,
      'ambiguous-exits': (name: string) => `Several exits of ${name} have no label: a choice or parallel steps?`,
      'multiple-starts': (name: string, count?: number) => `${count} starting points, including ${name}.`,
    },
  },

  tracking: {
    notFound: 'Tracking not found',
    notFoundText: 'This request or its process no longer exists on this phone.',
    back: 'Back',
    stopTitle: 'Stop this tracking?',
    stopText: (label: string) => `“${label}” will be removed from this device.`,
    stopConfirm: 'Stop',
    startedOn: (name: string, date: string) => `${name} · started on ${date}`,
    current: 'Current step',
    due: (date: string) => `Due: ${date}`,
    noDue: 'No deadline for this step',
    whichNext: 'Step done: what comes next?',
    next: 'Next',
    stepDone: 'Step done',
    finish: 'Finish the request',
    stepDoneGoTo: (title: string) => `Step done, go to “${title}”`,
    finished: 'Request finished',
    finishedIn: (date: string, days: string) => `On ${date}, in ${days}.`,
    answers: 'Form answers',
    pastSteps: 'Past steps',
    doneOn: (date: string) => `Finished on ${date}`,
    stop: 'Stop this tracking',
    badge: {
      done: 'Finished',
      noDelay: 'No deadline',
      doneLate: (days: string) => `Finished ${days} late`,
      late: (days: string) => `${days} late`,
      doneOnTime: 'Finished on time',
      soon: 'Due soon',
      onTime: 'On time',
    },
    reminders: {
      untitled: 'Untitled step',
      todayTitle: (title: string) => `Today: ${title}`,
      todayBody: (label: string, time: string) => `${label} · due at ${time}.`,
      lateTitle: (title: string) => `Late: ${title}`,
      lateBody: (label: string, time: string) => `${label} · the step was due at ${time}.`,
    },
  },

  notifications: {
    deadlineChannel: 'Process deadlines',
    deadlineChannelText: 'Reminders before and after the deadline of each step of a tracked process.',
    shareChannel: 'Process sharing',
    shareChannelText: 'A process shared with you, a step to fix, a fully validated process.',
    testBody: 'Notifications work: you will be told about the deadlines of your tracked processes.',
  },

  validationCard: {
    allValidated: (n: number) => (n > 1 ? `Process fully validated by all ${n} members.` : 'Process fully validated.'),
    noneDone: (members: string) => `No member has finished yet (${members})`,
    done: (done: number, total: number) => `${done} of ${total} member${total === 1 ? '' : 's'} finished`,
    toRevise: (steps: string) => `${steps} to fix`,
    validated: 'Validated',
    revise: 'To fix',
    inProgress: 'In progress',
    hint: 'Opens the validation follow-up, step by step',
    title: 'Validation follow-up',
  },
};
