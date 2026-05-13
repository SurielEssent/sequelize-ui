import { DbOptions } from '@src/core/database'
import { Schema } from '@src/core/schema'
import { fromV1DbOptions, toV1DbOptions } from '@src/api/userPreferences/implementations/localStorage/v1/translate'
import { Schema as JtdSchema, validate } from 'jtd'
import { SchemaV1 } from './implementations/localStorage/v1'
import v1JtdSchema from './implementations/localStorage/v1/schema.jtd.json'
import { fromV1, toV1 } from './implementations/localStorage/v1/translate'

export const SCHEMA_JSON_INVALID = '[Schema JSON] Invalid Sequelize UI schema file'

export type ParsedSchemaJson = {
  schema: Schema
  dbOptions?: DbOptions
}

export function stringifySchemaExport(schema: Schema, dbOptions?: DbOptions): string {
  const payload = { ...toV1(schema) } as Record<string, unknown>
  if (dbOptions) {
    payload['dbOptions'] = toV1DbOptions(dbOptions)
  }
  return JSON.stringify(payload, null, 2)
}

export function parseSchemaExport(json: unknown): ParsedSchemaJson {
  const errors = validate(v1JtdSchema as JtdSchema, json)
  if (errors.length) {
    throw new Error(SCHEMA_JSON_INVALID)
  }
  const wire = json as SchemaV1
  const schema = fromV1(wire)
  const dbOptions = wire.dbOptions ? fromV1DbOptions(wire.dbOptions) : undefined
  return { schema, dbOptions }
}
