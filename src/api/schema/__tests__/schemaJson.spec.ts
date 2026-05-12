import { blogTranslatedFromV1 } from '../implementations/localStorage/__fixtures__/blogTranslatedFromV1'
import { blogV1 } from '../implementations/localStorage/__fixtures__/blogV1'
import { parseSchemaExport, stringifySchemaExport } from '../schemaJson'

describe('schemaJson', () => {
  it('round-trips a known schema', () => {
    const json = stringifySchemaExport(blogTranslatedFromV1)
    const parsed = parseSchemaExport(JSON.parse(json))
    expect(parsed).toEqual(blogTranslatedFromV1)
  })

  it('accepts raw v1 fixture shape', () => {
    expect(parseSchemaExport(blogV1)).toEqual(blogTranslatedFromV1)
  })

  it('rejects invalid payloads', () => {
    expect(() => parseSchemaExport({})).toThrow()
    expect(() => parseSchemaExport(null)).toThrow()
  })
})
