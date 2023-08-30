import {
  createElement,
  createContext as reactCreateContext,
  useContext,
  useMemo,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import type { StoreApi } from 'zustand'
// eslint-disable-next-line import/extensions
import { useStoreWithEqualityFn } from 'zustand/traditional'

type UseContextStore<S extends StoreApi<unknown>> = {
  (): ExtractState<S>
  <U>(
    selector: (state: ExtractState<S>) => U,
    equalityFn?: (a: U, b: U) => boolean
  ): U
}

type ExtractState<S> = S extends { getState: () => infer T } ? T : never

type WithoutCallSignature<T> = { [K in keyof T]: T[K] }

/**
 * @deprecated Use `createStore` and `useStore` for context usage
 */
function createContext<S extends StoreApi<unknown>>() {
  if (import.meta.env?.MODE !== 'production') {
    console.warn(
      "[DEPRECATED] `context` will be removed in a future version. Instead use `import { createStore, useStore } from 'zustand'`. See: https://github.com/pmndrs/zustand/discussions/1180."
    )
  }

  /** 使用React createContext方法创建一个上下文对象  */
  /**
   * @returns { Provider, Consumer }
   *
   */
  const ZustandContext = reactCreateContext<S | undefined>(undefined)

  /**
   * Provider组件
   * @param createStore 数据源
   * @param children  被包裹的组件树
   * @returns 
   * 
   * 用法
   * 
   * <Provider createStore={createMyStore}>
      <MyComponent />
    </Provider>
   */

  const Provider = ({
    createStore,
    children,
  }: {
    createStore: () => S
    children: ReactNode
  }) => {
    const storeRef = useRef<S>()

    if (!storeRef.current) {
      storeRef.current = createStore()
    }

    /***
     * createElement
     * @param1 要创建的组件类型
     * @param2 传递给组件的props
     * @param3 子组件
     */
    return createElement(
      ZustandContext.Provider,
      { value: storeRef.current },
      children
    )
  }

  /**
   * 从zustand上下文这种获取状态
   * @param selector
   * @param equalityFn
   * @returns
   */
  const useContextStore: UseContextStore<S> = <StateSlice = ExtractState<S>>(
    selector?: (state: ExtractState<S>) => StateSlice,
    equalityFn?: (a: StateSlice, b: StateSlice) => boolean
  ) => {
    const store = useContext(ZustandContext)
    if (!store) {
      throw new Error(
        'Seems like you have not used zustand provider as an ancestor.'
      )
    }

    /**
     * @store zustand上下文中的store
     * @selector 选择器，可以从store中选择要的属性
     * @equalityFn 可选的相等性检查函数。用于渲染优化
     */
    return useStoreWithEqualityFn(
      store,
      selector as (state: ExtractState<S>) => StateSlice,
      equalityFn
    )
  }

  const useStoreApi = () => {
    const store = useContext(ZustandContext)
    if (!store) {
      throw new Error(
        'Seems like you have not used zustand provider as an ancestor.'
      )
    }
    return useMemo<WithoutCallSignature<S>>(() => ({ ...store }), [store])
  }

  return {
    Provider,
    useStore: useContextStore,
    useStoreApi,
  }
}

export default createContext
