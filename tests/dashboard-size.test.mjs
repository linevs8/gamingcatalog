import test from "node:test";
import assert from "node:assert/strict";
import {dashboardSize,emptyData,validateImport} from "../lib/data.ts";
test("dashboard density supports three sizes and defaults to legacy large",()=>{
  for(const size of ["compact","medium","large"]){
    assert.equal(dashboardSize(size),size);
    assert.equal(validateImport(JSON.parse(JSON.stringify({...emptyData(),dashboardSize:size}))).dashboardSize,size);
  }
  assert.equal(dashboardSize(undefined),"large");
  assert.equal(dashboardSize("invalid"),"large");
  assert.equal(validateImport(emptyData()).dashboardSize,"large");
});
