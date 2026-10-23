import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const FUEL_TYPES = ['gasoline', 'ethanol', 'diesel', 'cng'] as const;

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  plate: text('plate'),
  brand: text('brand'),
  model: text('model'),
  year: integer('year'),
  defaultFuel: text('default_fuel', { enum: FUEL_TYPES }).notNull(),
  archivedAt: integer('archived_at'),
  ...timestamps,
});

// Cada veículo tem ao menos 1 segmento. "Reiniciar odômetro" cria um novo.
export const odometerSegments = sqliteTable(
  'odometer_segments',
  {
    id: text('id').primaryKey(),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    sequence: integer('sequence').notNull(), // 1, 2, 3...
    startedOn: text('started_on').notNull(), // YYYY-MM-DD
    ...timestamps,
  },
  (t) => [index('seg_vehicle_idx').on(t.vehicleId, t.sequence)],
);

export const fuelings = sqliteTable(
  'fuelings',
  {
    id: text('id').primaryKey(),
    vehicleId: text('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    segmentId: text('segment_id')
      .notNull()
      .references(() => odometerSegments.id),
    date: text('date').notNull(), // YYYY-MM-DD
    odometerKm: integer('odometer_km').notNull(),
    pricePerLiterMilli: integer('price_per_liter_milli').notNull(),
    totalCents: integer('total_cents').notNull(),
    litersMl: integer('liters_ml').notNull(),
    fullTank: integer('full_tank', { mode: 'boolean' }).notNull(),
    fuelType: text('fuel_type', { enum: FUEL_TYPES }).notNull(),
    excludeFromAverage: integer('exclude_from_average', { mode: 'boolean' })
      .notNull()
      .default(false),
    station: text('station'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('fuel_seg_odo_idx').on(t.segmentId, t.odometerKm),
    index('fuel_vehicle_date_idx').on(t.vehicleId, t.date),
  ],
);

// Chave/valor: schema_version, last_vehicle_id, preferências de notificação.
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type VehicleRow = typeof vehicles.$inferSelect;
export type SegmentRow = typeof odometerSegments.$inferSelect;
export type FuelingRow = typeof fuelings.$inferSelect;
