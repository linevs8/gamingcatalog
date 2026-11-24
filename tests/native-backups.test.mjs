import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import backups from "../electron/backups.cjs";
const raw = title => JSON.stringify({version:1,games:[{title}],categories:[],shelves:[],memberships:[],links:[],notes:{}});
test("daily backups preserve the first good copy, reject invalid data, retain fourteen snapshots", () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"playquill-backup-test-"));
  try {
    assert.equal(backups.snapshotLibrary(dir,"bad json"),false);
    assert.equal(backups.snapshotLibrary(dir,raw("first"),new Date("2026-01-01T12:00:00Z")),true);
    backups.snapshotLibrary(dir,raw("second"),new Date("2026-01-01T13:00:00Z"));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,"backups","2026-01-01.json"),"utf8")).games[0].title,"first");
    for(let i=2;i<=16;i++) backups.snapshotLibrary(dir,raw("day "+i),new Date(Date.UTC(2026,0,i)));
    const names=fs.readdirSync(path.join(dir,"backups")).sort();
    assert.equal(names.length,14);
    assert.equal(names[0],"2026-01-03.json");
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
