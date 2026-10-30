// app/components/discount-wizard/freeGiftFormSerializer.js
/**
 * Builds the free-gift configuration object posted from the wizard form.
 *
 * Reads the individual free-gift wizard state fields and assembles them into
 * the canonical config shape consumed by `buildFreeGiftConfigPayload`
 * (NativeDiscountsPayloadHelper.js) and validated by `validateFreeGift`
 * (discount-validation.server.js).
 *
 * Only the trigger-type-relevant branch is populated:
 *   ORDER_THRESHOLD -> threshold (SUBTOTAL or QUANTITY), productTrigger = null
 *   PRODUCT_TRIGGER -> productTrigger, threshold = null
 *
 * @param {object} state - Wizard state carrying the free-gift fields
 * @param {string} state.giftVariantId - Gift variant GID
 * @param {string} state.giftQuantity - Gift quantity (string from input)
 * @param {string} state.triggerType - "ORDER_THRESHOLD" | "PRODUCT_TRIGGER"
 * @param {string} state.thresholdKind - "SUBTOTAL" | "QUANTITY"
 * @param {string} state.thresholdMinSubtotal - Minimum spend (string)
 * @param {string} state.thresholdMinQuantity - Minimum quantity (string)
 * @param {string[]} state.productTriggerProductIds - Trigger variant GIDs
 * @param {string|null} state.productTriggerMinQuantity - Min qty per product
 * @returns {object} Free-gift config object
 */
export function serializeFreeGiftConfigForForm(state) {
    return {
        giftVariantId: state.giftVariantId,
        giftQuantity: state.giftQuantity,
        triggerType: state.triggerType,
        threshold:
            state.triggerType === "ORDER_THRESHOLD"
                ? {
                      kind: state.thresholdKind,
                      minSubtotal: state.thresholdMinSubtotal,
                      minQuantity: state.thresholdMinQuantity,
                  }
                : null,
        productTrigger:
            state.triggerType === "PRODUCT_TRIGGER"
                ? {
                      productIds: state.productTriggerProductIds,
                      minQuantityPerProduct:
                          state.productTriggerMinQuantity === "" ||
                          state.productTriggerMinQuantity == null
                              ? null
                              : Number(state.productTriggerMinQuantity),
                  }
                : null,
    };
}
