import {
  createVehicle,
  deleteFueling,
  listFuelings,
  listVehicles,
  setExcludeFromAverage,
  updateVehicle,
} from '@/repositories';
import { createTestContext } from '@/test/db';
import { seedFuelings } from '@/test/seed';

import {
  BackupError,
  exportBackup,
  exportCsv,
  importBackup,
  parseBackup,
  serializeBackup,
  type Backup,
} from '../backup';

function tables(backup: Backup) {
  const { exportedAt: _exportedAt, ...rest } = backup;
  return rest;
}

function populated() {
  const ctx = createTestContext();
  const [first] = seedFuelings(ctx, 4);
  deleteFueling(ctx, first?.id ?? ''); // inclui registro com soft delete
  const moto = createVehicle(ctx, { nickname: 'Moto', plate: 'abc1d23', defaultFuel: 'ethanol' });
  seedFuelings(ctx, 2, moto.id);
  return ctx;
}

describe('JSON backup', () => {
  it('export, wipe and import restores an identical state', () => {
    const source = populated();
    const json = serializeBackup(exportBackup(source));
    const parsed = parseBackup(json);
    expect(parsed).toMatchObject({ schemaVersion: 1 });
    expect(parsed.fuelings.some((f) => f.deletedAt !== null)).toBe(true);

    // "Apagar os dados do app": instalação limpa, com o veículo implícito.
    const target = createTestContext();
    importBackup(target, parsed, 'replace');

    expect(tables(exportBackup(target))).toEqual(tables(exportBackup(source)));
  });

  it('invalid JSON shows an error and changes nothing', () => {
    const ctx = populated();
    const before = exportBackup(ctx);
    expect(() => parseBackup('{ nope')).toThrow(new BackupError('O arquivo não é um JSON válido.'));
    expect(() => parseBackup('{"schemaVersion": 1}')).toThrow(
      'O arquivo não é um backup válido deste app.',
    );
    expect(() => parseBackup(JSON.stringify({ ...before, schemaVersion: 2 }))).toThrow(BackupError);
    expect(exportBackup(ctx)).toEqual(before);
  });

  it('rolls back everything when the import fails midway', () => {
    const ctx = populated();
    const before = exportBackup(ctx);
    const broken = parseBackup(serializeBackup(exportBackup(populated())));
    // Abastecimento apontando para um segmento que não existe → falha de FK no fim.
    broken.fuelings.push({ ...broken.fuelings[0]!, id: 'orphan', segmentId: 'missing' });

    expect(() => importBackup(ctx, broken, 'replace')).toThrow(/Nenhum dado foi alterado/);
    expect(exportBackup(ctx)).toEqual(before);
  });

  it('merge keeps the most recent updatedAt per id', () => {
    const ctx = createTestContext();
    const vehicle = listVehicles(ctx)[0]!;
    const [a, b] = seedFuelings(ctx, 2);
    const backup = exportBackup(ctx);

    // Depois do backup: muda o veículo localmente (mais novo que o backup).
    ctx.tick();
    updateVehicle(ctx, vehicle.id, { nickname: 'Local', defaultFuel: 'gasoline' });
    // No backup: um abastecimento editado com data mais recente e um registro novo.
    const newer: Backup = {
      ...backup,
      vehicles: backup.vehicles.map((v) => ({ ...v, nickname: 'Antigo' })),
      fuelings: [
        ...backup.fuelings.map((f) =>
          f.id === b?.id ? { ...f, notes: 'do backup', updatedAt: f.updatedAt + 10_000 } : f,
        ),
        { ...backup.fuelings[0]!, id: 'new-one', odometerKm: 99999, date: '2026-10-20' },
      ],
    };

    const result = importBackup(ctx, newer, 'merge');
    expect(result).toEqual({ inserted: 1, updated: 1, skipped: 3 });
    expect(listVehicles(ctx)[0]?.nickname).toBe('Local');
    const rows = listFuelings(ctx);
    expect(rows.find((f) => f.id === b?.id)?.notes).toBe('do backup');
    expect(rows.find((f) => f.id === a?.id)?.notes).toBeNull();
    expect(rows.some((f) => f.id === 'new-one')).toBe(true);
  });

  it('keeps one active vehicle after replacing with an empty backup', () => {
    const ctx = populated();
    importBackup(
      ctx,
      { schemaVersion: 1, exportedAt: '', vehicles: [], odometerSegments: [], fuelings: [] },
      'replace',
    );
    expect(listVehicles(ctx).map((v) => v.nickname)).toEqual(['Meu veículo']);
    expect(listFuelings(ctx)).toEqual([]);
  });
});

describe('CSV export', () => {
  it('uses a UTF-8 BOM, ";" separator and pt-BR decimals', () => {
    const ctx = createTestContext();
    const [, , closing] = seedFuelings(ctx, 3);
    setExcludeFromAverage(ctx, closing?.id ?? '', true);
    const moto = createVehicle(ctx, { nickname: 'Moto; "nova"', defaultFuel: 'ethanol' });
    seedFuelings(ctx, 1, moto.id);
    const [first] = listFuelings(ctx, moto.id);
    deleteFueling(ctx, first?.id ?? '');

    const csv = exportCsv(ctx);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Data;Veículo;Odômetro (km);Combustível;Preço por litro (R$);Valor total (R$);Litros;' +
        'Tanque cheio;Ignorado na média;Posto;Observações',
    );
    expect(lines).toHaveLength(4); // cabeçalho + 3 ativos (o excluído fica de fora)
    expect(lines[1]).toBe('01/10/2026;Meu veículo;10000;Gasolina;5,899;200,00;33,904;Sim;Não;;');
    expect(lines[3]).toBe('10/10/2026;Meu veículo;10450;Gasolina;5,899;150,00;25,428;Sim;Sim;;');
  });

  it('quotes fields with separators or quotes', () => {
    const ctx = createTestContext();
    const moto = createVehicle(ctx, { nickname: 'Moto; "nova"', defaultFuel: 'ethanol' });
    seedFuelings(ctx, 1, moto.id);
    expect(exportCsv(ctx)).toContain(';"Moto; ""nova""";');
  });
});
