import React, { useEffect, useState } from "react"
import Client from "shopify-buy"

import StoreContext from "../contexts/store-context"

const StoreProvider = ({ children }) => {
  const client = Client.buildClient(
    {
      storefrontAccessToken: process.env.GATSBY_SHOPIFY_ACCESS_TOKEN,
      domain: `${process.env.GATSBY_SHOPIFY_SHOP_NAME}.myshopify.com`,
      language: 'ja-JP',
    }
  )

  const lockCheckout = () => {
    setStore((prevState) => {
      return { ...prevState, checkoutEditable: false }
    })
  }

  const releaseCheckout = () => {
    setStore((prevState) => {
      return { ...prevState, checkoutEditable: true }
    })
  }

  // NOTE: initialValue に key を追加する場合は、 StoreContext の defaultValue にも同様に初期値を追加すること。
  // StoreContextを使うコンポーネントの単体テストで、 defaultValue が使われるため。
  const initialStoreValue = {
    client,
    checkout: {},
    checkoutEditable: true,
  }

  const [store, setStore] = useState(initialStoreValue)

  const addVariantToCart = async (variantId, quantity) => {
    // variantId が null, undefined, 空文字の時はエラー
    if (!variantId) {
      throw new Error("商品を選択してください")
    }
    // quantity が null, undefined, 0 の時はエラー
    quantity = parseInt(quantity, 10)
    if (!quantity) {
      throw new Error("数量は 1 以上で入力してください")
    }

    lockCheckout()

    const lineItemsToUpdate = [
      { variantId, quantity }
    ]

    await store.client.checkout.addLineItems(
      store.checkout.id, lineItemsToUpdate
    ).then((checkout) => {
      setStore((prevState) => {
        return { ...prevState, checkout }
      })
    }).finally(() => {
      releaseCheckout()
    })
  }

  useEffect(() => {
    const initializeCheckout = async () => {
      const localStorageKey = 'shopify_checkout_id'

      const setCheckout = (checkout) => {
        localStorage.setItem(localStorageKey, checkout.id)
        setStore((prevState) => {
          return { ...prevState, checkout }
        })
      }

      const resetCheckout = () => {
        localStorage.removeItem(localStorageKey)
      }

      const localStorageValue = localStorage.getItem(localStorageKey)
      if (localStorageValue != null) {
        // 初期化済みで未決済の場合は、最新の checkout を取得してローカルストレージと state に保存する
        // 初期化済みで決済済みの場合は、新しく checkout を作成してローカルストレージと state に保存する
        try {
          let checkout = await store.client.checkout.fetch(localStorageValue)
          if (checkout.completedAt != null) {
            checkout = await store.client.checkout.create()
          }
          setCheckout(checkout)
        } catch {
          resetCheckout()
        }
      } else {
        // 未初期化の場合は、 checkout を作成してローカルストレージと state に保存する
        await store.client.checkout.create(
        ).then(checkout => {
          setCheckout(checkout)
        }).catch(err => {
          resetCheckout()
        })
      }
    }

    initializeCheckout()
  }, [store.client.checkout])

  return (
    <StoreContext.Provider
      value={{
        store,
        addVariantToCart: addVariantToCart,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export default StoreProvider
