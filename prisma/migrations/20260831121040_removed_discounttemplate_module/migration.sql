/*
  Warnings:

  - You are about to drop the column `templateId` on the `Discount` table. All the data in the column will be lost.
  - You are about to drop the `DiscountTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `Discount` DROP COLUMN `templateId`;

-- DropTable
DROP TABLE `DiscountTemplate`;
