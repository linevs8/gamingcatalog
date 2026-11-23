import test from "node:test";
import assert from "node:assert/strict";
import { catalogBucket } from "../lib/catalog-bucket.ts";

test("GameDB indexing preserves a space as the second character", () => {
  assert.equal(catalogBucket("9 kings"), "9");
  assert.equal(catalogBucket("A Plague Tale"), "a");
  assert.equal(catalogBucket("9kings"), "9k");
  assert.equal(catalogBucket("Halo"), "ha");
  assert.equal(catalogBucket(""), "");
});
