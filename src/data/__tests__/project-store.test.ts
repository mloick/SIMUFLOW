import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Le fichier des process du téléphone est remplacé par une variable.
let mockSaved: string | null = null;
jest.mock('../saved-file', () => ({
  readSaved: () => mockSaved,
  writeSaved: (text: string) => {
    mockSaved = text;
  },
}));

type Stores = { projects: typeof import('../project-store'); processes: typeof import('../process-store') };
const loadStores = (): Stores => {
  let stores!: Stores;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports -- relire les modules comme au démarrage */
    stores = { projects: require('../project-store'), processes: require('../process-store') };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return stores;
};

const process = (id: string) => ({ id, name: id, steps: [], links: [] });

describe('projets', () => {
  beforeEach(() => {
    mockSaved = null;
    globalThis.localStorage?.clear();
  });

  it('crée un projet avec un identifiant UUID et le garde sur le téléphone', () => {
    const { projects } = loadStores();
    const project = projects.createProject('  Migration du support ', ' Pour le service client ');
    expect(project.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(project.name).toBe('Migration du support');
    expect(project.description).toBe('Pour le service client');
    expect(projects.hasPendingProjects()).toBe(true);

    const reloaded = loadStores().projects;
    expect(reloaded.getProject(project.id)?.name).toBe('Migration du support');
  });

  it('renomme un projet et retire la description vide', () => {
    const { projects } = loadStores();
    const project = projects.createProject('Avant', 'Texte');
    projects.updateProject(project.id, 'Après', '  ');
    expect(projects.getProject(project.id)).toEqual({ id: project.id, name: 'Après', createdAt: project.createdAt });
  });

  it('range un process dans un projet, puis l’en sort', () => {
    const { projects, processes } = loadStores();
    processes.addImportedProcess(process('a'));
    const project = projects.createProject('Projet');
    processes.setProcessProject('a', project.id);
    expect(processes.getProcess('a')?.projectId).toBe(project.id);
    processes.setProcessProject('a', null);
    // Jamais envoyé au serveur : il perd simplement son projet.
    expect(processes.getProcess('a')).not.toHaveProperty('projectId');
  });

  it('supprimer un projet laisse ses process, hors projet', () => {
    const { projects, processes } = loadStores();
    processes.addImportedProcess(process('a'));
    processes.setImportEntries([{ ...processes.getImportEntries()[0], cloudId: 's1' }]);
    const project = projects.createProject('Projet');
    processes.setProcessProject('a', project.id);
    projects.removeProject(project.id);
    expect(projects.getProject(project.id)).toBeUndefined();
    // Déjà sur le serveur : « null » part à la prochaine synchronisation.
    expect(processes.getImportEntries()[0]).toMatchObject({ process: { id: 'a', projectId: null }, modified: true });
  });

  it('sans compte, oublie les projets déjà envoyés et garde les autres', () => {
    const { projects } = loadStores();
    const local = projects.createProject('Sur le téléphone');
    globalThis.localStorage?.setItem(
      'simuflow.projets',
      JSON.stringify([
        { project: local },
        { project: { id: 'p-serveur', name: 'Envoyé', createdAt: local.createdAt }, synced: true },
      ]),
    );
    const reloaded = loadStores().projects;
    reloaded.forgetCloudProjects();
    expect(reloaded.getProject('p-serveur')).toBeUndefined();
    expect(reloaded.getProject(local.id)?.name).toBe('Sur le téléphone');
  });
});
