import { describe, expect, it } from '@jest/globals';

import { importProcessFile } from '@/import';

import accueil from '../../../docs/exemples/accueil-arrivant.json';
import { addImportedProcess, getProcess } from '../process-store';

describe('process importés', () => {
  it('retrouve un process importé par son identifiant', () => {
    const { processes } = importProcessFile('accueil-arrivant.json', JSON.stringify(accueil), 'import-1');
    addImportedProcess(processes[0]);
    expect(getProcess('import-1-1')?.name).toBe('Accueil d’un nouvel arrivant');
    expect(getProcess('demande-acces')).toBeDefined();
  });
});
