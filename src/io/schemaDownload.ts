import { stringifySchemaExport } from '@src/api/schema/schemaJson'
import { Schema } from '@src/core/schema'
import { kebabCase } from '@src/utils/string'
import { saveAs } from 'file-saver'

export function downloadSchemaJson(schema: Schema): void {
  const base = kebabCase(schema.name || 'schema') || 'schema'
  const blob = new Blob([stringifySchemaExport(schema)], { type: 'application/json;charset=utf-8' })
  saveAs(blob, `${base}-sequelize-ui-schema.json`)
}
