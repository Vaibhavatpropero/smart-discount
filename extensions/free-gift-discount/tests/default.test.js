import path from "path";
import fs from "fs";
import { describe, it, beforeAll, test, expect } from "vitest";
import { buildFunction, getFunctionInfo, loadSchema, loadInputQuery, loadFixture, validateTestAssets, runFunction } from "@shopify/shopify-function-test-helpers";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run.js";
import freeGiftBasic from "./fixtures/free-gift-basic.json";


// describe("Default Integration Test", () => {
//   let schema;
//   let functionDir;
//   let functionInfo;
//   let schemaPath;
//   let targeting;
//   let functionRunnerPath;
//   let wasmPath;

//   beforeAll(async () => {
//     functionDir = path.dirname(__dirname);
//     await buildFunction(functionDir);
//     functionInfo = await getFunctionInfo(functionDir);
//     ({ schemaPath, functionRunnerPath, wasmPath, targeting } = functionInfo);
//     schema = await loadSchema(schemaPath);
//   }, 45000);

//   const fixturesDir = path.join(__dirname, "fixtures");
//   const fixtureFiles = fs
//     .readdirSync(fixturesDir)
//     .filter((file) => file.endsWith(".json"))
//     .map((file) => path.join(fixturesDir, file));

//   fixtureFiles.forEach((fixtureFile) => {
//     test(`runs ${path.relative(fixturesDir, fixtureFile)}`, async () => {
//       const fixture = await loadFixture(fixtureFile);
//       const targetInputQueryPath = targeting[ fixture.target ].inputQueryPath;
//       const inputQueryAST = await loadInputQuery(targetInputQueryPath);

//       const validationResult = await validateTestAssets({ schema, fixture, inputQueryAST });
//       expect(validationResult.inputQuery.errors).toEqual([]);
//       expect(validationResult.inputFixture.errors).toEqual([]);
//       expect(validationResult.outputFixture.errors).toEqual([]);

//       const runResult = await runFunction(fixture, functionRunnerPath, wasmPath, targetInputQueryPath, schemaPath);
//       expect(runResult.error).toBeNull();
//       expect(runResult.result.output).toEqual(fixture.expectedOutput);
//     }, 10000);
//   });
// });

describe("free gift discount", () => {
  it("applies 100% discount to gift line when threshold met", () => {
    const result = cartLinesDiscountsGenerateRun(freeGiftBasic);

    expect(result.operations).toHaveLength(1);
    const op = result.operations[ 0 ];
    expect(op.productDiscountsAdd).toBeDefined();
    const candidates = op.productDiscountsAdd.candidates;
    expect(candidates).toHaveLength(1);
    const target = candidates[ 0 ].targets[ 0 ];
    expect(target.cartLine.id).toBe("gid://shopify/CartLine/2");
  });
});
