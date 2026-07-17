-- AlterTable
ALTER TABLE `Discount` ADD COLUMN `identityVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `isMatchable` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `matchKey` VARCHAR(191) NULL,
    ADD COLUMN `matchType` ENUM('CODE', 'AUTOMATIC') NULL,
    ADD COLUMN `shopifyDeletedAt` DATETIME(3) NULL,
    ADD COLUMN `supersededById` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `DiscountUsage` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `discountId` VARCHAR(191) NOT NULL,
    `shopifyOrderId` VARCHAR(191) NOT NULL,
    `orderName` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `isFirstOrder` BOOLEAN NOT NULL DEFAULT false,
    `discountAmount` DECIMAL(10, 2) NOT NULL,
    `orderSubtotal` DECIMAL(10, 2) NOT NULL,
    `orderTotal` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `refunded` BOOLEAN NOT NULL DEFAULT false,
    `refundedAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `cancelled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiscountUsage_discountId_createdAt_idx`(`discountId`, `createdAt`),
    INDEX `DiscountUsage_shopId_createdAt_idx`(`shopId`, `createdAt`),
    INDEX `DiscountUsage_customerId_idx`(`customerId`),
    UNIQUE INDEX `DiscountUsage_shopId_shopifyOrderId_discountId_key`(`shopId`, `shopifyOrderId`, `discountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountDailyStat` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `discountId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `totalDiscount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalRevenue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `uniqueCustomers` INTEGER NOT NULL DEFAULT 0,

    INDEX `DiscountDailyStat_shopId_date_idx`(`shopId`, `date`),
    UNIQUE INDEX `DiscountDailyStat_discountId_date_key`(`discountId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Discount_shopId_matchType_matchKey_idx` ON `Discount`(`shopId`, `matchType`, `matchKey`);

-- CreateIndex
CREATE INDEX `Discount_shopId_isMatchable_idx` ON `Discount`(`shopId`, `isMatchable`);

-- CreateIndex
CREATE INDEX `Discount_shopId_shopifyDiscountCode_idx` ON `Discount`(`shopId`, `shopifyDiscountCode`);

-- AddForeignKey
ALTER TABLE `Discount` ADD CONSTRAINT `Discount_supersededById_fkey` FOREIGN KEY (`supersededById`) REFERENCES `Discount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountUsage` ADD CONSTRAINT `DiscountUsage_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountDailyStat` ADD CONSTRAINT `DiscountDailyStat_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
