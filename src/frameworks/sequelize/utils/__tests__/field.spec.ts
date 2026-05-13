import { defaultDbOptions } from '@src/core/database'
import { dateTimeDataType, field, integerDataType, model } from '@src/core/schema'
import { fromParts } from '@src/utils/dateTime'
import { fieldTemplate, modelFieldsWithTimestamps } from '../field'

const t = fromParts(2020, 1, 1)

describe('modelFieldsWithTimestamps', () => {
  it('does not duplicate timestamp columns when the model already defines them', () => {
    const m = model({
      id: 'm1',
      name: 'post',
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

    const { fields, timestampExtras } = modelFieldsWithTimestamps(m, defaultDbOptions)
    expect(fields.map((f) => f.name)).toEqual(['id', 'createdAt', 'updatedAt'])
    expect(timestampExtras).toEqual([])
  })

  it('appends synthetic timestamps when missing', () => {
    const m = model({
      id: 'm2',
      name: 'tag',
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

    const { fields, timestampExtras } = modelFieldsWithTimestamps(m, defaultDbOptions)
    expect(timestampExtras.length).toBe(2)
    expect(fields.length).toBe(3)
  })
})

describe('fieldTemplate', () => {
  it('includes allowNull: false for primary keys when required is false', () => {
    const f = field({
      name: 'id',
      type: integerDataType({ unsigned: true, autoincrement: true }),
      primaryKey: true,
      required: false,
    })
    const out = fieldTemplate({ field: f, dbOptions: defaultDbOptions })
    expect(out).toMatch(/allowNull:\s*false/)
  })
})
