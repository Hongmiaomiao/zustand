import { useDebugValue } from 'react'
// import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'
// This doesn't work in ESM, because use-sync-external-store only exposes CJS.
// See: https://github.com/pmndrs/valtio/issues/452
// The following is a workaround until ESM is supported.
// eslint-disable-next-line import/extensions
import useSyncExternalStoreExports from 'use-sync-external-store/shim/with-selector' // React官方hook，用于同步外部存储
import { createStore } from './vanilla.ts'
import type {
  Mutate,
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from './vanilla.ts'

const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports

type ExtractState<S> = S extends { getState: () => infer T } ? T : never

type ReadonlyStoreApi<T> = Pick<StoreApi<T>, 'getState' | 'subscribe'>

type WithReact<S extends ReadonlyStoreApi<unknown>> = S & {
  getServerState?: () => ExtractState<S>
}

let didWarnAboutEqualityFn = false

export function useStore<S extends WithReact<StoreApi<unknown>>>(
  api: S
): ExtractState<S>

export function useStore<S extends WithReact<StoreApi<unknown>>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U
): U

/**
 * @deprecated Use `useStoreWithEqualityFn` from 'zustand/traditional'
 * https://github.com/pmndrs/zustand/discussions/1937
 */
export function useStore<S extends WithReact<StoreApi<unknown>>, U>(
  api: S,
  selector: (state: ExtractState<S>) => U,
  equalityFn: ((a: U, b: U) => boolean) | undefined
): U

/**
 * @param api
 * @param selector
 * @param equalityFn
 * @returns
 * 主要是通过`useSyncExternalStoreWithSelector`钩子来实现store更新后局部的组件重新渲染
 */
export function useStore<TState, StateSlice>(
  api: WithReact<StoreApi<TState>>,
  selector: (state: TState) => StateSlice = api.getState as any,
  equalityFn?: (a: StateSlice, b: StateSlice) => boolean
) {
  if (
    import.meta.env?.MODE !== 'production' &&
    equalityFn &&
    !didWarnAboutEqualityFn
  ) {
    console.warn(
      "[DEPRECATED] Use `createWithEqualityFn` instead of `create` or use `useStoreWithEqualityFn` instead of `useStore`. They can be imported from 'zustand/traditional'. https://github.com/pmndrs/zustand/discussions/1937"
    )
    didWarnAboutEqualityFn = true
  }

  /**
   * 这个方法整体做的是监听Zustand Store的变化，来判断是否触发重新渲染等逻辑。
   * useSyncExternalStoreWithSelector - 用于同步外部存储状态的 React Hook。
   * => 1. 传入了subscribe, useSyncExternalStoreWithSelector内部通过调用subscribe添加对zustand状态的订阅
   * => 2. 当zustand的set方法被调用，会通知lisnters,这里就包括了useSyncExternalStoreWithSelector内部。
   * => 3. 这时这里就包括了useSyncExternalStoreWithSelector内部 会根据selector、equalityFn来决定是否要重新传染。其触发的重新渲染的部分是订阅了
   * useSyncExternalStoreWithSelector钩子的部分，即订阅了useStore的部分。
   *
   * @param {Function} subscribe - 用于订阅外部存储更改的函数。当状态发生变化时，应触发其内部侦听器。
   * @param {Function} getState - 用于获取外部存储的当前状态的函数。
   * @param {Function} [getServerState] - 用于获取服务器端渲染的初始状态的可选函数。默认为 `getState`。
   * @param {Function} [selector] - 用于选择状态片段的可选函数。
   * @param {Function} [equalityFn] - 用于比较新状态和旧状态片段是否相等的可选函数。
   *
   * @returns {any} - 外部存储状态的选定片段。
   */
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getServerState || api.getState,
    selector,
    equalityFn
  )
  useDebugValue(slice)

  return slice
}

export type UseBoundStore<S extends WithReact<ReadonlyStoreApi<unknown>>> = {
  (): ExtractState<S>
  <U>(selector: (state: ExtractState<S>) => U): U
  /**
   * @deprecated Use `createWithEqualityFn` from 'zustand/traditional'
   */
  <U>(
    selector: (state: ExtractState<S>) => U,
    equalityFn: (a: U, b: U) => boolean
  ): U
} & S

type Create = {
  <T, Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>
  ): UseBoundStore<Mutate<StoreApi<T>, Mos>>
  <T>(): <Mos extends [StoreMutatorIdentifier, unknown][] = []>(
    initializer: StateCreator<T, [], Mos>
  ) => UseBoundStore<Mutate<StoreApi<T>, Mos>>
  /**
   * @deprecated Use `useStore` hook to bind store
   */
  <S extends StoreApi<unknown>>(store: S): UseBoundStore<S>
}

/**
 * @param createState 用于获取初始化的state
 * @returns
 * 1. 判断createState 是否函数
 * 2. 是 => 返回值作为初始state
 * 3. 不是 => createState直接作为初始State
 * 4. 调用CreateStore，传入State做为参数创建store
 * 5. 调用UseStore,核心就是通过useSyncExternalStoreWithSelector这个React的hook，来实现的对zustand状态变更后的局部刷新渲染
 *
 */

const createImpl = <T>(createState: StateCreator<T, [], []>) => {
  if (
    import.meta.env?.MODE !== 'production' &&
    typeof createState !== 'function'
  ) {
    console.warn(
      "[DEPRECATED] Passing a vanilla store will be unsupported in a future version. Instead use `import { useStore } from 'zustand'`."
    )
  }
  const api =
    typeof createState === 'function' ? createStore(createState) : createState

  const useBoundStore: any = (selector?: any, equalityFn?: any) =>
    useStore(api, selector, equalityFn)

  Object.assign(useBoundStore, api)

  return useBoundStore
}

export const create = (<T>(createState: StateCreator<T, [], []> | undefined) =>
  createState ? createImpl(createState) : createImpl) as Create

/**
 * @deprecated Use `import { create } from 'zustand'`
 */
export default ((createState: any) => {
  if (import.meta.env?.MODE !== 'production') {
    console.warn(
      "[DEPRECATED] Default export is deprecated. Instead use `import { create } from 'zustand'`."
    )
  }
  return create(createState)
}) as Create
