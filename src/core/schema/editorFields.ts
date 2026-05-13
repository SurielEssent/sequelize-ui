import { caseByDbCaseStyle, DbOptions } from '@src/core/database'
import { namesEq } from '@src/utils/string'
import { Field, Model } from './schema'

/** Fields that Sequelize generates from options (timestamps / paranoid), not user-defined columns. */
export function isAutoManagedTimestampField(
  field: Field,
  model: Model,
  dbOptions: DbOptions,
): boolean {
  if (dbOptions.timestamps) {
    const created = caseByDbCaseStyle('created at', dbOptions.caseStyle)
    const updated = caseByDbCaseStyle('updated at', dbOptions.caseStyle)
    if (namesEq(field.name, created) || namesEq(field.name, updated)) return true
  }
  if (model.softDelete) {
    const deleted = caseByDbCaseStyle('deleted at', dbOptions.caseStyle)
    if (namesEq(field.name, deleted)) return true
  }
  return false
}

export function editorVisibleModelFields(model: Model, dbOptions: DbOptions): Field[] {
  return model.fields.filter((f) => !isAutoManagedTimestampField(f, model, dbOptions))
}
