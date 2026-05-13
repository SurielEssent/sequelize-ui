import { blank, lines } from '@src/core/codegen'
import { DbCaseStyle, DbNounForm, DbOptions } from '@src/core/database'
import { isAutoManagedTimestampField } from '@src/core/schema/editorFields'
import { Association, AssociationTypeType, Field, Model, integerDataType } from '@src/core/schema'
import { camelCase, pascalCase, plural, singular, snakeCase } from '@src/utils/string'
import { associationName } from '../../utils/associations'
import {
  dataTypeToTypeScript,
  noSupportedDetails,
  notSupportedComment,
} from '../../utils/dataTypes'
import { fieldTemplate, modelFieldsWithTimestamps } from '../../utils/field'
import { ModelAssociation, modelName } from '../../utils/model'

export type ModelClassTempalteArgs = {
  model: Model
  associations: ModelAssociation[]
  dbOptions: DbOptions
}
export function modelClassTemplate({
  model,
  associations,
  dbOptions,
}: ModelClassTempalteArgs): string {
  const name = modelName(model)
  const associationAliases = associations
    .map(({ association, model }) => `'${associationName({ association, targetModel: model })}'`)
    .join(' | ')

  const associationsType = associationAliases
    ? `type ${name}Associations = ${associationAliases}`
    : null

  const omit = associationAliases ? `, {omit: ${name}Associations}` : ''

  const { fields: allFields, timestampExtras } = modelFieldsWithTimestamps(model, dbOptions)
  const creationOptionalFor = (field: Field) =>
    timestampExtras.includes(field) ||
    isAutoManagedTimestampField(field, model, dbOptions) ||
    field.primaryKey

  return lines([
    associationAliases ? associationsType : null,
    associationAliases ? blank() : null,
    `export class ${name} extends Model<`,
    lines([`InferAttributes<${name}${omit}>,`, `InferCreationAttributes<${name}${omit}>`], {
      depth: 2,
    }),
    `> {`,
    lines(
      [...allFields.map((field) => classFieldType(field, dbOptions, creationOptionalFor(field)))],
      {
        depth: 2,
      },
    ),
    associations.length ? blank() : null,
    lines(
      associations.map((a) => associationType({ sourceModel: model, association: a })),
      { depth: 2 },
    ),
    associations.length
      ? lines(
          [
            'declare static associations: {',
            lines(
              associations.map((association) =>
                staticAssociation({ sourceModel: model, association }),
              ),
              { depth: 2, separator: ',' },
            ),
            '}',
          ],
          {
            depth: 2,
          },
        )
      : null,
    associations.length ? blank() : null,
    lines(
      [
        `static initModel(sequelize: Sequelize): typeof ${name} {`,
        lines(
          [
            `${name}.init({`,
            lines(
              allFields.map((field) => fieldTemplate({ field, dbOptions })),
              { depth: 2, separator: ',' },
            ),
            '}, {',
            lines(
              [
                'sequelize',
                tableName({ model, dbOptions }),
                model.softDelete ? 'paranoid: true' : null,
              ],
              {
                depth: 2,
                separator: ',',
              },
            ),
            '})',
            blank(),
            `return ${name}`,
          ],
          { depth: 2 },
        ),
        '}',
      ],
      { depth: 2 },
    ),

    '}',
  ])
}

const classFieldType = (
  { name, type, required }: Field,
  dbOptions: DbOptions,
  creationOptional: boolean,
): Array<string | null> => {
  const comment = notSupportedComment(type, dbOptions.sqlDialect)
  const tsType = dataTypeToTypeScript(type)

  const fieldType = creationOptional
    ? `CreationOptional<${tsType}>`
    : required
      ? tsType
      : `${tsType} | null`

  return [
    noSupportedDetails(type, dbOptions.sqlDialect),
    `${comment}declare ${camelCase(name)}: ${fieldType}`,
  ]
}

type StaticAssociation = {
  sourceModel: Model
  association: ModelAssociation
}
function staticAssociation({
  sourceModel,
  association: { model: targetModel, association },
}: StaticAssociation): string {
  const key = associationName({ association, targetModel })
  const value = `Association<${modelName(sourceModel)}, ${modelName(targetModel)}>`
  return `${key}: ${value}`
}

type AssociationTypeArgs = {
  sourceModel: Model
  association: ModelAssociation
}

// Helper to determine if the foreign key for an association is required
function isForeignKeyRequired(
  sourceModel: Model,
  targetModel: Model,
  association: Association,
): boolean {
  // Determine FK name based on association type
  let fkName: string
  let modelWithFk: Model

  switch (association.type.type) {
    case AssociationTypeType.BelongsTo: {
      // FK is on source model, named after target
      fkName = association.foreignKey || `${singular(camelCase(modelName(targetModel)))}Id`
      modelWithFk = sourceModel
      break
    }
    case AssociationTypeType.HasMany:
    case AssociationTypeType.HasOne: {
      // FK is on target model, named after source
      fkName =
        association.foreignKey ||
        `${singular(camelCase(associationName({ association, targetModel: sourceModel })))}Id`
      modelWithFk = targetModel
      break
    }
    case AssociationTypeType.ManyToMany: {
      // For ManyToMany, the FK is in the junction table
      // By default, junction table FKs are typically nullable
      // We return false since Sequelize allows clearing ManyToMany associations with null
      return false
    }
  }

  // Find the FK field and check if it's required
  const fkField = modelWithFk.fields.find(
    (field) => camelCase(field.name) === fkName || field.name === fkName,
  )

  // If FK field exists, return its required status
  // If FK field doesn't exist (will be auto-created by Sequelize), default to not required (nullable)
  return fkField?.required ?? false
}

function associationType({
  sourceModel,
  association: { model: targetModel, association },
}: AssociationTypeArgs): string {
  const sourceName = modelName(sourceModel)
  const targetName = modelName(targetModel)
  const name = associationName({ association, targetModel })
  const singularMethodPostfix = singular(pascalCase(name))
  const pluralMethodPostfix = plural(pascalCase(name))
  const targetPks = targetModel.fields.filter((f) => f.primaryKey)

  // Check if the foreign key is required (non-nullable)
  const fkRequired = isForeignKeyRequired(sourceModel, targetModel, association)

  // Build the PK type, adding | null if FK is not required (nullable)
  const basePkType =
    targetPks.length > 1
      ? 'never'
      : targetPks.length === 1
        ? dataTypeToTypeScript(targetPks[0].type)
        : dataTypeToTypeScript(integerDataType())

  // Add | null to allow clearing associations when FK is nullable
  const targetPkType = fkRequired ? basePkType : `${basePkType} | null`

  switch (association.type.type) {
    case AssociationTypeType.BelongsTo: {
      return [
        `// ${sourceName} belongsTo ${targetName}${aliasLabel(association)}`,
        `declare ${name}?: NonAttribute<${targetName}>`,
        `declare get${singularMethodPostfix}: BelongsToGetAssociationMixin<${targetName}>`,
        `declare set${singularMethodPostfix}: BelongsToSetAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare create${singularMethodPostfix}: BelongsToCreateAssociationMixin<${targetName}>`,
        blank(),
      ].join('\n')
    }
    case AssociationTypeType.HasMany: {
      const fk =
        association.foreignKey ||
        singular(camelCase(associationName({ association, targetModel: sourceModel }))) + 'Id'

      const createHasManyOmitFk = targetModel.fields.some((field) => camelCase(field.name) === fk)
        ? `, '${fk}'`
        : ''

      return [
        `// ${sourceName} hasMany ${targetName}${aliasLabel(association)}`,
        `declare ${name}?: NonAttribute<${targetName}[]>`,
        `declare get${pluralMethodPostfix}: HasManyGetAssociationsMixin<${targetName}>`,
        `declare set${pluralMethodPostfix}: HasManySetAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare add${singularMethodPostfix}: HasManyAddAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare add${pluralMethodPostfix}: HasManyAddAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare create${singularMethodPostfix}: HasManyCreateAssociationMixin<${targetName}${createHasManyOmitFk}>`,
        `declare remove${singularMethodPostfix}: HasManyRemoveAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare remove${pluralMethodPostfix}: HasManyRemoveAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare has${singularMethodPostfix}: HasManyHasAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare has${pluralMethodPostfix}: HasManyHasAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare count${pluralMethodPostfix}: HasManyCountAssociationsMixin`,
        blank(),
      ].join('\n')
    }
    case AssociationTypeType.HasOne: {
      return [
        `// ${sourceName} hasOne ${targetName}${aliasLabel(association)}`,
        `declare ${name}?: NonAttribute<${targetName}>`,
        `declare get${singularMethodPostfix}: HasOneGetAssociationMixin<${targetName}>`,
        `declare set${singularMethodPostfix}: HasOneSetAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare create${singularMethodPostfix}: HasOneCreateAssociationMixin<${targetName}>`,
        blank(),
      ].join('\n')
    }
    case AssociationTypeType.ManyToMany: {
      return [
        `// ${sourceName} belongsToMany ${targetName}${aliasLabel(association)}`,
        `declare ${name}?: NonAttribute<${targetName}[]>`,
        `declare get${pluralMethodPostfix}: BelongsToManyGetAssociationsMixin<${targetName}>`,
        `declare set${pluralMethodPostfix}: BelongsToManySetAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare add${singularMethodPostfix}: BelongsToManyAddAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare add${pluralMethodPostfix}: BelongsToManyAddAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare create${singularMethodPostfix}: BelongsToManyCreateAssociationMixin<${targetName}>`,
        `declare remove${singularMethodPostfix}: BelongsToManyRemoveAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare remove${pluralMethodPostfix}: BelongsToManyRemoveAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare has${singularMethodPostfix}: BelongsToManyHasAssociationMixin<${targetName}, ${targetPkType}>`,
        `declare has${pluralMethodPostfix}: BelongsToManyHasAssociationsMixin<${targetName}, ${targetPkType}>`,
        `declare count${pluralMethodPostfix}: BelongsToManyCountAssociationsMixin`,
        blank(),
      ].join('\n')
    }
  }
}

function aliasLabel({ alias }: Association): string {
  return alias ? ` (as ${pascalCase(alias)})` : ''
}

type TableNameArgs = {
  model: Model
  dbOptions: DbOptions
}
function tableName({ dbOptions: { caseStyle, nounForm }, model }: TableNameArgs): string | null {
  if (nounForm === DbNounForm.Singular && caseStyle === DbCaseStyle.Snake) {
    return `tableName: '${singular(snakeCase(model.name))}'`
  }
  return null
}
