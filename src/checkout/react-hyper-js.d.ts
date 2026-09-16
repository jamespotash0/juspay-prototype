// @juspay-tech/react-hyper-js ships no types. Only the surface we use, checked against the 2.9.0 bundle.
declare module '@juspay-tech/react-hyper-js' {
  import type { ComponentType, ReactNode } from 'react'
  import type { HyperInstance, confirmPaymentInputPayload } from '@juspay-tech/hyper-js'

  export const HyperElements: ComponentType<{
    hyper: Promise<HyperInstance>
    options: {
      clientSecret: string
      appearance?: object
      loader?: 'auto' | 'always' | 'never'
    }
    children?: ReactNode
  }>

  export const UnifiedCheckout: ComponentType<{ id?: string; options?: object }>

  export function useHyper(): {
    confirmPayment(
      params: confirmPaymentInputPayload,
    ): Promise<{ status?: string; error?: { type?: string; message?: string } }>
  }
}
