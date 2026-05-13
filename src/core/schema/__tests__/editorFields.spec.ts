import { defaultDbOptions } from '@src/core/database'
import { dateTimeDataType, field, integerDataType, model } from '@src/core/schema'
import { editorVisibleModelFields, isAutoManagedTimestampField } from '../editorFields'
import { fromParts } from '@src/utils/dateTime'

const t = fromParts(2020, 1, 1)

describe('editorFields', () => {
  it('hides created/updated when timestamps are on', () => {
    const m = model({
      id: 'm',
      name: 'x',
      createdAt: t,
      updatedAt: t,
      fields: [
        field({
          name: 'id',
          type: integerDataType({ unsigned: true, autoincrement: true }),
          primaryKey: true,
          required: true,
        }),
        field({ name: 'createdAt', type: dateTimeDataType(), required: false }),
        field({ name: 'updatedAt', type: dateTimeDataType(), required: false }),
      ],
      associations: [],
    })
    const vis = editorVisibleModelFields(m, defaultDbOptions)
    expect(vis.map((f) => f.name)).toEqual([])
  })

  it('hides deletedAt when soft delete is on', () => {
    const m = model({
      id: 'm',
      name: 'x',
      createdAt: t,
      updatedAt: t,
      softDelete: true,
      fields: [
        field({
          name: 'id',
          type: integerDataType({ unsigned: true, autoincrement: true }),
          primaryKey: true,
          required: true,
        }),
        field({ name: 'deletedAt', type: dateTimeDataType(), required: false }),
      ],
      associations: [],
    })
    const opts = { ...defaultDbOptions, timestamps: false }
    expect(isAutoManagedTimestampField(m.fields[1], m, opts)).toBe(true)
    expect(editorVisibleModelFields(m, opts).map((f) => f.name)).toEqual([])
  })

  it('shows timestamp-like names when timestamps are off', () => {
    const m = model({
      id: 'm',
      name: 'x',
      createdAt: t,
      updatedAt: t,
      fields: [
        field({
          name: 'id',
          type: integerDataType({ unsigned: true, autoincrement: true }),
          primaryKey: true,
          required: true,
        }),
        field({ name: 'createdAt', type: dateTimeDataType(), required: false }),
      ],
      associations: [],
    })
    const opts = { ...defaultDbOptions, timestamps: false }
    expect(editorVisibleModelFields(m, opts).map((f) => f.name)).toEqual(['createdAt'])
  })

  it('shows id when primary key format uses table-prefixed keys', () => {
    const m = model({
      id: 'm',
      name: 'x',
      createdAt: t,
      updatedAt: t,
      fields: [
        field({
          name: 'id',
          type: integerDataType({ unsigned: true, autoincrement: true }),
          primaryKey: true,
          required: true,
        }),
      ],
      associations: [],
    })
    const opts = { ...defaultDbOptions, prefixPks: true }
    expect(editorVisibleModelFields(m, opts).map((f) => f.name)).toEqual(['id'])
  })
})
