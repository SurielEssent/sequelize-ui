import { defaultDbOptions } from '@src/core/database'
import { blogTranslatedFromV1 } from '../implementations/localStorage/__fixtures__/blogTranslatedFromV1'
import { blogV1 } from '../implementations/localStorage/__fixtures__/blogV1'
import { parseSchemaExport, stringifySchemaExport } from '../schemaJson'

describe('schemaJson', () => {
  it('round-trips a known schema', () => {
    const json = stringifySchemaExport(blogTranslatedFromV1)
    const parsed = parseSchemaExport(JSON.parse(json))
    expect(parsed).toEqual({ schema: blogTranslatedFromV1 })
  })

  it('does not add dbOptions to JSON when omitted', () => {
    const o = JSON.parse(stringifySchemaExport(blogTranslatedFromV1)) as { dbOptions?: unknown }
    expect(o.dbOptions).toBeUndefined()
  })

  it('accepts raw v1 fixture shape', () => {
    expect(parseSchemaExport(blogV1)).toEqual({ schema: blogTranslatedFromV1 })
  })

  it('round-trips dbOptions when provided', () => {
    const opts = { ...defaultDbOptions, prefixPks: false }
    const json = stringifySchemaExport(blogTranslatedFromV1, opts)
    const parsed = parseSchemaExport(JSON.parse(json))
    expect(parsed.schema).toEqual(blogTranslatedFromV1)
    expect(parsed.dbOptions).toEqual(opts)
  })

  it('rejects invalid payloads', () => {
    expect(() => parseSchemaExport({})).toThrow()
    expect(() => parseSchemaExport(null)).toThrow()
  })
})
