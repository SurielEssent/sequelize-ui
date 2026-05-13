import schemaApi from '@src/api/schema'
import { parseSchemaExport } from '@src/api/schema/schemaJson'
import userPreferences from '@src/api/userPreferences'
import { Schema } from '@src/core/schema'
import IconButton from '@src/ui/components/form/IconButton'
import InfoIcon from '@src/ui/components/icons/Info'
import Modal from '@src/ui/components/Modal'
import useAsync from '@src/ui/hooks/useAsync'
import useIsOpen from '@src/ui/hooks/useIsOpen'
import { useAlert } from '@src/ui/lib/alert'
import RouteLink from '@src/ui/routing/RouteLink'
import { goTo } from '@src/ui/routing/navigation'
import { newSchemaRoute, schemaRoute } from '@src/ui/routing/routes'
import {
  backgroundColor,
  classnames,
  display,
  fontSize,
  lineHeight,
  margin,
  minHeight,
  toClassname,
  verticalAlign,
  width,
} from '@src/ui/styles/classnames'
import { flexCenter, flexCenterVertical, fontColor, inlineButton } from '@src/ui/styles/utils'
import { clear } from '@src/utils/localStorage'
import dynamic from 'next/dynamic'
import React from 'react'
import { MY_SCHEMAS_ID } from './constants'
import MySchemaLinks from './MySchemaLinks'
import SchemasError from './SchemasError'

const SchemaStorageInfo = dynamic(() => import('./SchemaStorageInfo'))

const CLEAR_DATA_SUCCESS_COPY = 'All schemas deleted.'
const CLEAR_DATA_ERROR_COPY = `Failed to delete schemas. Try clearing localStorage or site data through your browser's developer console.`
const IMPORT_SCHEMA_ERROR_COPY =
  'Could not import that file. Choose a JSON file exported from Sequelize UI (Code / JSON toolbar or home page export).'

export default function MySchemas(): React.ReactElement {
  const { data: schemas, error, refetch } = useAsync({ getData: schemaApi.listSchemas })

  const { isOpen: isInfoModalOpen, open: openInfoModal, close: closeInfoModal } = useIsOpen()

  const { success, error: logError } = useAlert()

  const importInputRef = React.useRef<HTMLInputElement>(null)

  const openImportPicker = () => importInputRef.current?.click()

  const handleImportFile: React.ChangeEventHandler<HTMLInputElement> = async (evt) => {
    const file = evt.target.files?.[0]
    evt.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const { schema: importedSchema, dbOptions } = parseSchemaExport(parsed)
      if (dbOptions) await userPreferences.updateDefaultDbOptions(dbOptions)
      const created = await schemaApi.createSchema(importedSchema)
      success(`Imported schema "${created.name}".`, { ttl: 6000 })
      await refetch()
      goTo(schemaRoute(created.id))
    } catch (e) {
      console.error(e)
      logError(IMPORT_SCHEMA_ERROR_COPY, { ttl: 10000 })
    }
  }

  const handleClickClearData = async () => {
    await clear()
    refetch()
  }

  const handleConfirmMySchemaInfo = async () => {
    try {
      await Promise.all([schemaApi.deleteAllSchemas(), userPreferences.clearPreferences()])
      await refetch()
      success(CLEAR_DATA_SUCCESS_COPY)
      closeInfoModal()
    } catch (e) {
      console.error(e)
      logError(CLEAR_DATA_ERROR_COPY, { ttl: 10000 })
    }
  }

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className={classnames(display('hidden'))}
        aria-hidden
        onChange={handleImportFile}
      />
      <div
        className={classnames(minHeight('min-h-26', 'xs:min-h-20', 'md:min-h-10'), width('w-full'))}
      >
        {!schemas && error && <SchemasError onClickClearData={handleClickClearData} />}
        {schemas && schemas.length === 0 && (
          <ZeroState onClickOpenInfo={openInfoModal} onClickImport={openImportPicker} />
        )}
        {schemas && schemas.length > 0 && (
          <SchemasState
            schemas={schemas}
            onClickInfo={openInfoModal}
            onClickImport={openImportPicker}
          />
        )}
      </div>
      <Modal
        id="my-schemas-info"
        title="Schema Storage"
        isOpen={isInfoModalOpen}
        onClose={closeInfoModal}
        confirmText="Clear my data"
        confirmDestructive
        onConfirm={handleConfirmMySchemaInfo}
      >
        {isInfoModalOpen && <SchemaStorageInfo />}
      </Modal>
    </>
  )
}

type ZeroStateProps = { onClickOpenInfo: () => void; onClickImport: () => void }

function ZeroState({ onClickOpenInfo, onClickImport }: ZeroStateProps): React.ReactElement {
  return (
    <>
      <div id={MY_SCHEMAS_ID} className={classnames(flexCenter)}>
        <p className={classnames(fontSize('text-base'), lineHeight('leading-loose'))}>
          To get started,{' '}
          <RouteLink
            route={newSchemaRoute()}
            prefetch={false}
            className={classnames(
              inlineButton(),
              margin('mx-1'),
              backgroundColor(
                'bg-indigo-100',
                'hover:bg-indigo-200',
                'dark:bg-indigo-700',
                toClassname('dark:hover:bg-indigo-900'),
              ),
            )}
          >
            create a new schema
          </RouteLink>
          ,{' '}
          <button
            type="button"
            onClick={onClickImport}
            className={classnames(
              inlineButton(),
              margin('mx-1'),
              backgroundColor(
                'bg-indigo-100',
                'hover:bg-indigo-200',
                'dark:bg-indigo-700',
                toClassname('dark:hover:bg-indigo-900'),
              ),
            )}
          >
            import a schema JSON file
          </button>
          , or select one of the example schemas{' '}
          <span className={classnames(display('inline-block'))}>
            below.
            <span className={classnames(verticalAlign('align-middle'))}>
              <IconButton
                className={classnames(margin('ml-1'))}
                icon={InfoIcon}
                iconProps={{ size: 5, strokeWidth: 2 }}
                label="my schemas info"
                onClick={onClickOpenInfo}
              />
            </span>
          </span>
        </p>
      </div>
    </>
  )
}

type SchemasStateProps = { schemas: Schema[]; onClickInfo: () => void; onClickImport: () => void }

function SchemasState({
  schemas,
  onClickInfo,
  onClickImport,
}: SchemasStateProps): React.ReactElement {
  return (
    <>
      <div className={classnames(flexCenterVertical, margin('mb-4'))}>
        <h2 className={classnames(fontColor, fontSize('text-2xl'))}>My Schemas</h2>
        <IconButton
          className={classnames(margin('ml-1'))}
          icon={InfoIcon}
          iconProps={{ size: 5, strokeWidth: 2 }}
          label="my schemas info"
          onClick={onClickInfo}
        />
      </div>
      <div className={classnames(flexCenter)}>
        <MySchemaLinks schemas={schemas} onClickImport={onClickImport} />
      </div>
    </>
  )
}
