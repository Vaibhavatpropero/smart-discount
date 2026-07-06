-- AlterTable
ALTER TABLE `BxgyConfig` ADD COLUMN `customerGetsAmount` DECIMAL(10, 2) NULL,
    MODIFY `customerGetsEffect` ENUM('PERCENTAGE', 'AMOUNT_OFF_EACH', 'FREE') NOT NULL DEFAULT 'FREE';
