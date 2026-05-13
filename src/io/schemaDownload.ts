import { stringifySchemaExport } from '@src/api/schema/schemaJson'
import { DbOptions } from '@src/core/database'
import { Schema } from '@src/core/schema'
import { kebabCase } from '@src/utils/string'
import { saveAs } from 'file-saver'

export function downloadSchemaJson(schema: Schema, dbOptions?: DbOptions): void {
  const base = kebabCase(schema.name || 'schema') || 'schema'
  const blob = new Blob([stringifySchemaExport(schema, dbOptions)], {
    type: 'application/json;charset=utf-8',
  })
  saveAs(blob, `${base}-sequelize-ui-schema.json`)
}
