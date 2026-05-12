/**
 * Reads models/*.ts (Sequelize class models) + models/index.ts associations,
 * writes Sequelize UI v1 JSON (importable via app Import schema JSON).
 *
 * Usage: node scripts/sequelize-models-to-ui-schema.mjs [outPath]
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const modelsDir = path.join(root, 'models')
const outPath = path.resolve(
  process.argv[2] || path.join(modelsDir, 'essent-jus.sequelize-ui-schema.json'),
)

function stableId(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12)
}

function extractInitAttributes(content, className) {
  const prefix = `${className}.init({`
  const idx = content.indexOf(prefix)
  if (idx === -1) return null
  let i = idx + prefix.length - 1
  let depth = 0
  let bodyStart = null
  for (; i < content.length; i++) {
    const c = content[i]
    if (c === '{') {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && bodyStart !== null) {
        return content.slice(bodyStart, i)
      }
    }
  }
  return null
}

function parseFieldBlocks(attrBody) {
  const pairs = []
  let i = 0
  while (i < attrBody.length) {
    while (i < attrBody.length && /\s/.test(attrBody[i])) i++
    if (i >= attrBody.length) break
    const m = attrBody.slice(i).match(/^(\w+)\s*:\s*\{/)
    if (!m) break
    const name = m[1]
    i += m[0].length - 1
    let depth = 0
    const start = i
    for (; i < attrBody.length; i++) {
      if (attrBody[i] === '{') depth++
      else if (attrBody[i] === '}') {
        depth--
        if (depth === 0) {
          pairs.push([name, attrBody.slice(start + 1, i)])
          i++
          break
        }
      }
    }
    while (i < attrBody.length && /[\s,]/.test(attrBody[i])) i++
  }
  return pairs
}

function mapDataType(block) {
  const b = block.replace(/\s+/g, ' ')
  if (/DataTypes\.JSONB/.test(b)) return { type: 'JSONB', defaultValue: null }
  if (/DataTypes\.JSON\b/.test(b)) return { type: 'JSON', defaultValue: null }
  if (/DataTypes\.TEXT/.test(b)) return { type: 'TEXT', defaultValue: null }
  if (/DataTypes\.DATEONLY/.test(b)) return { type: 'DATE', defaultNow: false }
  if (/DataTypes\.DATE\b/.test(b)) return { type: 'DATE_TIME', defaultNow: false }
  if (/DataTypes\.BOOLEAN/.test(b)) {
    const dv = /defaultValue:\s*(true|false)/.exec(b)
    return { type: 'BOOLEAN', defaultValue: dv ? dv[1] === 'true' : null }
  }
  if (/DataTypes\.UUID/.test(b)) {
    const v4 = /DataTypes\.UUIDV4/.test(b) || /defaultValue:\s*DataTypes\.UUIDV4/.test(b)
    return { type: 'UUID', defaultVersion: v4 ? 'V4' : null }
  }
  if (/DataTypes\.ENUM\s*\(/.test(b)) {
    const inner = block.match(/DataTypes\.ENUM\s*\(([\s\S]*?)\)\s*,?/m)
    const values = []
    if (inner) {
      const re = /'((?:\\'|[^'])*)'/g
      let mm
      while ((mm = re.exec(inner[1]))) values.push(mm[1].replace(/\\'/g, "'"))
    }
    return { type: 'ENUM', values, defaultValue: null }
  }
  const arr = block.match(/DataTypes\.ARRAY\s*\(\s*DataTypes\.(\w+)/)
  if (arr) {
    const innerType = arr[1]
    const mapped =
      innerType === 'STRING'
        ? { type: 'STRING', length: null, defaultValue: null }
        : { type: 'TEXT', defaultValue: null }
    return { type: 'ARRAY', arrayType: mapped, defaultEmptyArray: false }
  }
  if (/DataTypes\.BIGINT/.test(b)) {
    const unsigned = /\.UNSIGNED/.test(block)
    const auto = /autoIncrement:\s*true/.test(b)
    return { type: 'BIGINT', unsigned, autoincrement: auto, defaultValue: null }
  }
  if (/DataTypes\.INTEGER/.test(b)) {
    const unsigned = /\.UNSIGNED/.test(block) || /INTEGER\.UNSIGNED/.test(block)
    const auto = /autoIncrement:\s*true/.test(b)
    return { type: 'INTEGER', unsigned, autoincrement: auto, defaultValue: null }
  }
  if (/DataTypes\.DECIMAL/.test(b)) {
    const prec = block.match(/precision:\s*(\d+)/)
    const scale = block.match(/scale:\s*(\d+)/)
    return {
      type: 'DECIMAL',
      unsigned: false,
      precision:
        prec && scale
          ? { precision: Number(prec[1]), scale: Number(scale[1]) }
          : prec
            ? { precision: Number(prec[1]), scale: null }
            : null,
      defaultValue: null,
    }
  }
  if (/DataTypes\.FLOAT/.test(b)) return { type: 'FLOAT', unsigned: false, defaultValue: null }
  if (/DataTypes\.DOUBLE/.test(b)) return { type: 'DOUBLE', unsigned: false, defaultValue: null }
  if (/DataTypes\.REAL/.test(b)) return { type: 'REAL', unsigned: false, defaultValue: null }
  if (/DataTypes\.BLOB/.test(b)) return { type: 'BLOB' }
  const strLen = block.match(/DataTypes\.STRING\s*\(\s*(\d+)\s*\)/)
  if (strLen) return { type: 'STRING', length: Number(strLen[1]), defaultValue: null }
  if (/DataTypes\.STRING/.test(b)) return { type: 'STRING', length: null, defaultValue: null }
  return { type: 'STRING', length: null, defaultValue: null }
}

function fieldToV1(name, block, modelId) {
  const primaryKey = /primaryKey:\s*true/.test(block)
  const autoIncrement = /autoIncrement:\s*true/.test(block)
  const allowNullFalse = /allowNull:\s*false/.test(block)
  const unique = /unique:\s*true/.test(block)
  const type = mapDataType(block)
  if (type.type === 'INTEGER' || type.type === 'BIGINT') {
    if (autoIncrement) type.autoincrement = true
  }
  return {
    id: stableId(['f', modelId, name]),
    name,
    type,
    primaryKey,
    required: primaryKey ? false : allowNullFalse,
    unique,
  }
}

function parseAssociations(indexContent, modelByClass) {
  const re = /(\w+)\.(belongsTo|hasOne|hasMany)\s*\(\s*(\w+)\s*,\s*\{([\s\S]*?)\}\s*\)/g
  const out = []
  let m
  while ((m = re.exec(indexContent))) {
    const sourceClass = m[1]
    const kind = m[2]
    const targetClass = m[3]
    const opts = m[4]
    const fk = /foreignKey:\s*'([^']+)'/.exec(opts)
    const asMatch = /as:\s*'([^']+)'/.exec(opts)
    const source = modelByClass.get(sourceClass)
    const target = modelByClass.get(targetClass)
    if (!source || !target) continue
    const typeMap = { belongsTo: 'BELONGS_TO', hasOne: 'HAS_ONE', hasMany: 'HAS_MANY' }
    out.push({
      id: stableId(['a', source.id, target.id, kind, fk?.[1] || '', asMatch?.[1] || String(out.length)]),
      sourceModelId: source.id,
      targetModelId: target.id,
      alias: asMatch ? asMatch[1] : null,
      foreignKey: fk ? fk[1] : null,
      type: { type: typeMap[kind] },
    })
  }
  return out
}

if (!fs.existsSync(modelsDir)) {
  console.error(`Missing models directory: ${modelsDir}`)
  process.exit(1)
}

const files = fs
  .readdirSync(modelsDir)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  .sort()

const now = new Date().toISOString()
const modelByClass = new Map()
const models = []

for (const file of files) {
  const full = path.join(modelsDir, file)
  const content = fs.readFileSync(full, 'utf8')
  const cm = content.match(/export class (\w+) extends Model/)
  if (!cm) continue
  const className = cm[1]
  const attrBody = extractInitAttributes(content, className)
  if (!attrBody) continue
  const tm = content.match(/tableName:\s*'([^']+)'/)
  const tableName = tm ? tm[1] : className.toLowerCase()
  const softDelete = /paranoid:\s*true/.test(content)
  const modelId = stableId(['m', className])
  modelByClass.set(className, { id: modelId, name: tableName })
  const fieldBlocks = parseFieldBlocks(attrBody)
  const fields = fieldBlocks.map(([n, b]) => fieldToV1(n, b, modelId))
  models.push({
    id: modelId,
    name: tableName,
    createdAt: now,
    updatedAt: now,
    softDelete,
    fields,
    associations: [],
  })
}

const indexPath = path.join(modelsDir, 'index.ts')
const indexContent = fs.readFileSync(indexPath, 'utf8')
const assocSlice = indexContent.split('export function initModels')[1] || indexContent
const allAssocs = parseAssociations(assocSlice, modelByClass)

for (const a of allAssocs) {
  const m = models.find((x) => x.id === a.sourceModelId)
  if (m) m.associations.push(a)
}

const schema = {
  id: stableId(['schema', 'essent-jus']),
  name: 'essent-jus-models',
  forkedFrom: null,
  createdAt: now,
  updatedAt: now,
  models,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(schema, null, 2), 'utf8')
console.log(`Wrote ${models.length} models to ${outPath}`)
