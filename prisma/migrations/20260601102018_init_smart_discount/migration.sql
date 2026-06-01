-- AlterTable
ALTER TABLE `Session` MODIFY `accessToken` TEXT NOT NULL,
    MODIFY `refreshToken` TEXT NULL;

-- CreateTable
CREATE TABLE `Shop` (
    `id` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `ownerName` VARCHAR(191) NULL,
    `ownerEmail` VARCHAR(191) NULL,
    `ownerPhone` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'USD',
    `timezone` VARCHAR(191) NULL,
    `countryCode` VARCHAR(191) NULL,
    `planName` ENUM('FREE', 'BASIC', 'ADVANCE') NOT NULL DEFAULT 'FREE',
    `planStatus` ENUM('TRIALING', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED') NOT NULL DEFAULT 'TRIALING',
    `trialEndsAt` DATETIME(3) NULL,
    `billingId` VARCHAR(191) NULL,
    `billingConfirmedAt` DATETIME(3) NULL,
    `uninstalledAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Shop_shopDomain_key`(`shopDomain`),
    INDEX `Shop_planName_planStatus_idx`(`planName`, `planStatus`),
    INDEX `Shop_trialEndsAt_idx`(`trialEndsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `planName` ENUM('FREE', 'BASIC', 'ADVANCE') NOT NULL,
    `planStatus` ENUM('TRIALING', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED') NOT NULL,
    `shopifySubscriptionId` VARCHAR(191) NULL,
    `shopifyConfirmationUrl` TEXT NULL,
    `price` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'USD',
    `billingPeriod` VARCHAR(191) NULL DEFAULT 'EVERY_30_DAYS',
    `trialStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `trialEndsAt` DATETIME(3) NULL,
    `trialExtensions` INTEGER NOT NULL DEFAULT 0,
    `lastExtendedAt` DATETIME(3) NULL,
    `lastExtendedBy` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_shopId_key`(`shopId`),
    INDEX `Subscription_planStatus_idx`(`planStatus`),
    INDEX `Subscription_trialEndsAt_idx`(`trialEndsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('TRIAL_STARTED', 'TRIAL_EXTENDED', 'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_FAILED', 'REFUND_ISSUED') NOT NULL,
    `planName` ENUM('FREE', 'BASIC', 'ADVANCE') NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BillingEvent_shopId_createdAt_idx`(`shopId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Discount` (
    `id` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `discountType` ENUM('ORDER_PERCENTAGE', 'ORDER_FIXED', 'PRODUCT_PERCENTAGE', 'PRODUCT_FIXED', 'BXGY', 'FREE_SHIPPING', 'APP_VOLUME', 'APP_BUNDLE', 'APP_CAPPED') NOT NULL,
    `method` ENUM('CODE', 'AUTOMATIC') NOT NULL,
    `shopifyDiscountId` VARCHAR(191) NULL,
    `shopifyDiscountCode` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `lastSyncedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `discountValue` DECIMAL(10, 2) NULL,
    `isPercentage` BOOLEAN NULL DEFAULT true,
    `appliesToAll` BOOLEAN NOT NULL DEFAULT true,
    `targetProducts` JSON NULL,
    `targetCollections` JSON NULL,
    `minimumType` ENUM('NONE', 'SUBTOTAL', 'QUANTITY') NOT NULL DEFAULT 'NONE',
    `minimumSubtotal` DECIMAL(10, 2) NULL,
    `minimumQuantity` INTEGER NULL,
    `usageLimit` INTEGER NULL,
    `usesPerOrderLimit` INTEGER NULL,
    `appliesOncePerCustomer` BOOLEAN NOT NULL DEFAULT false,
    `combineWithOrderDiscounts` BOOLEAN NOT NULL DEFAULT false,
    `combineWithProductDiscounts` BOOLEAN NOT NULL DEFAULT false,
    `combineWithShippingDiscounts` BOOLEAN NOT NULL DEFAULT false,
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `shippingDestinationCountries` JSON NULL,
    `maximumShippingPrice` DECIMAL(10, 2) NULL,
    `customerSegments` JSON NULL,
    `templateId` VARCHAR(191) NULL,
    `templateSlug` VARCHAR(191) NULL,
    `totalUsageCount` INTEGER NOT NULL DEFAULT 0,
    `totalSavings` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdOnPlan` ENUM('FREE', 'BASIC', 'ADVANCE') NOT NULL DEFAULT 'FREE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Discount_shopifyDiscountId_key`(`shopifyDiscountId`),
    INDEX `Discount_shopId_status_idx`(`shopId`, `status`),
    INDEX `Discount_shopId_discountType_idx`(`shopId`, `discountType`),
    INDEX `Discount_shopifyDiscountId_idx`(`shopifyDiscountId`),
    INDEX `Discount_startsAt_endsAt_idx`(`startsAt`, `endsAt`),
    INDEX `Discount_templateSlug_idx`(`templateSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BxgyConfig` (
    `id` VARCHAR(191) NOT NULL,
    `discountId` VARCHAR(191) NOT NULL,
    `customerBuysType` ENUM('QUANTITY', 'AMOUNT') NOT NULL DEFAULT 'QUANTITY',
    `customerBuysQty` INTEGER NULL,
    `customerBuysAmount` DECIMAL(10, 2) NULL,
    `customerBuysProducts` JSON NULL,
    `customerBuysCollections` JSON NULL,
    `customerGetsQty` INTEGER NOT NULL DEFAULT 1,
    `customerGetsEffect` ENUM('PERCENTAGE', 'FREE') NOT NULL DEFAULT 'FREE',
    `customerGetsPercentage` DECIMAL(5, 2) NULL,
    `customerGetsProducts` JSON NULL,
    `customerGetsCollections` JSON NULL,

    UNIQUE INDEX `BxgyConfig_discountId_key`(`discountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountEvent` (
    `id` VARCHAR(191) NOT NULL,
    `discountId` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'EXPIRED', 'DELETED', 'PUSH_FAILED', 'PLAN_RESTRICTED') NOT NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiscountEvent_discountId_createdAt_idx`(`discountId`, `createdAt`),
    INDEX `DiscountEvent_shopId_eventType_idx`(`shopId`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscountTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `discountType` ENUM('ORDER_PERCENTAGE', 'ORDER_FIXED', 'PRODUCT_PERCENTAGE', 'PRODUCT_FIXED', 'BXGY', 'FREE_SHIPPING', 'APP_VOLUME', 'APP_BUNDLE', 'APP_CAPPED') NOT NULL,
    `method` ENUM('CODE', 'AUTOMATIC') NOT NULL,
    `defaultConfig` JSON NOT NULL,
    `requiredPlan` ENUM('FREE', 'BASIC', 'ADVANCE') NOT NULL DEFAULT 'FREE',
    `category` VARCHAR(191) NULL,
    `iconName` VARCHAR(191) NULL,
    `isPopular` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DiscountTemplate_slug_key`(`slug`),
    INDEX `DiscountTemplate_requiredPlan_isActive_idx`(`requiredPlan`, `isActive`),
    INDEX `DiscountTemplate_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Session_shop_idx` ON `Session`(`shop`);

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingEvent` ADD CONSTRAINT `BillingEvent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Discount` ADD CONSTRAINT `Discount_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BxgyConfig` ADD CONSTRAINT `BxgyConfig_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountEvent` ADD CONSTRAINT `DiscountEvent_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `Discount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscountEvent` ADD CONSTRAINT `DiscountEvent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
