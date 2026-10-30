/*
  Warnings:

  - You are about to drop the column `identityVersion` on the `Discount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Discount` DROP COLUMN `identityVersion`,
    ADD COLUMN `freeGiftConfig` JSON NULL,
    MODIFY `discountType` ENUM('ORDER_PERCENTAGE', 'ORDER_FIXED', 'PRODUCT_PERCENTAGE', 'PRODUCT_FIXED', 'BXGY', 'FREE_SHIPPING', 'APP_VOLUME', 'APP_BUNDLE', 'APP_CAPPED', 'APP_FREE_GIFT') NOT NULL;
