import { Schema } from '@src/core/schema'
import { Schema as JtdSchema, validate } from 'jtd'
import { SchemaV1 } from './implementations/localStorage/v1'
import v1JtdSchema from './implementations/localStorage/v1/schema.jtd.json'
import { fromV1, toV1 } from './implementations/localStorage/v1/translate'

export const SCHEMA_JSON_INVALID = '[Schema JSON] Invalid Sequelize UI schema file'

export function stringifySchemaExport(schema: Schema): string {
  return JSON.stringify(toV1(schema), null, 2)
}

export function parseSchemaExport(json: unknown): Schema {
  const errors = validate(v1JtdSchema as JtdSchema, json)
  if (errors.length) {
    throw new Error(SCHEMA_JSON_INVALID)
  }
  return fromV1(json as SchemaV1)
}
