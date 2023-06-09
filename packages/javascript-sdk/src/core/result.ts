/* eslint-disable prefer-rest-params */
import type {
  AnyObject,
  AnyRecord,
  AnyResult,
  Label,
  LabelOrModel,
  LabelOrModelOrPayload,
  RecordId,
  RecordPayload,
  SearchParams
} from '../types'

import { isLabelOrModel, isResultWithId } from '../types'
import { api } from './sdk'
import { createBody, extractLabelAndParams, validate } from './utils'

type CreateResult = Omit<Result, 'update'> & {
  update(searchParams: SearchParams, payload: RecordPayload): Promise<Result>
}

export class Result {
  readonly data?: AnyObject

  constructor(data?: AnyObject) {
    this.data = data
  }

  async create(payload: RecordPayload): Promise<CreateResult>
  async create(
    labelOrModel: LabelOrModel,
    payload: RecordPayload
  ): Promise<CreateResult>
  async create(
    labelOrModelOrPayload: LabelOrModelOrPayload,
    payload?: RecordPayload
  ): Promise<CreateResult> {
    await validate(labelOrModelOrPayload, payload)

    const body = createBody(labelOrModelOrPayload, payload)

    const data = await api.createRecord(body)

    // TODO: refactor
    const newResult = new Result(data)
    const proxy = new Proxy(newResult, {
      get(_, prop) {
        if (prop === 'update' && isLabelOrModel(labelOrModelOrPayload)) {
          return (...args: any[]) =>
            // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.
            newResult.update(labelOrModelOrPayload, ...args)
        }
        // @ts-expect-error A spread argument must either have a tuple type or be passed to a rest parameter.
        return Reflect.get(...arguments)
      }
    })

    return proxy
  }

  async update(
    searchParams: SearchParams,
    payload: RecordPayload
  ): Promise<Result>
  async update(
    labelOrModel: LabelOrModel,
    searchParams: SearchParams,
    payload: RecordPayload
  ): Promise<Result>
  async update(
    labelOrModelOrParams: LabelOrModel | SearchParams,
    searchParamsOrPayload: RecordPayload | SearchParams,
    payload?: RecordPayload
  ) {
    let params: AnyObject
    let body: AnyObject

    if (isLabelOrModel(labelOrModelOrParams)) {
      await validate(labelOrModelOrParams, payload)
      body = createBody(labelOrModelOrParams, payload)
      params = searchParamsOrPayload
    } else {
      params = labelOrModelOrParams
      body = searchParamsOrPayload
    }

    const data = await api.updateRecordWithSearchParams(params, body)

    return new Result(data)
  }

  public async find(searchParams: SearchParams): Promise<Result>
  public async find(label: Label, searchParams?: SearchParams): Promise<Result>
  public async find(
    labelOrSearchParams: Label | SearchParams,
    searchParams?: SearchParams
  ): Promise<Result> {
    const { label, params } = extractLabelAndParams(
      labelOrSearchParams,
      searchParams
    )

    const data = await api.findRecords(params, label)

    return new Result(data)
  }

  async delete(searchParams: SearchParams): Promise<Result>
  async delete(label: Label, searchParams?: SearchParams): Promise<Result>
  async delete(
    labelOrSearchParams: Label | SearchParams,
    searchParams?: SearchParams
  ): Promise<Result> {
    const { label, params } = extractLabelAndParams(
      labelOrSearchParams,
      searchParams
    )

    const data = await api.deleteRecords(params, label)

    return new Result(data)
  }

  async link(
    targetOrSearchParams: AnyResult | AnyResult[] | SearchParams,
    metadata?: AnyObject
  ) {
    let originId: RecordId | undefined
    let params: AnyObject & { targetIds?: RecordId[] } = {}

    if (isResultWithId(this)) {
      originId = this.data['id'] as string
    } else {
      throw new Error('cannot be called on an empty object')
    }

    if (Array.isArray(targetOrSearchParams)) {
      params['targetIds'] = []
      for (let target of targetOrSearchParams) {
        if (isResultWithId(target)) {
          params['targetIds'].push(target.data['id'])
        }
      }
    } else if (targetOrSearchParams instanceof Result) {
      if (isResultWithId(targetOrSearchParams)) {
        params.targetIds = []
        params.targetIds.push(targetOrSearchParams.data.id)
      }
    } else {
      params = targetOrSearchParams
    }

    await api.linkRecords(originId, params, metadata)

    return this
  }
}
