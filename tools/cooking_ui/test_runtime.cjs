// Compatibility entry point: test the shipping native runtime.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
execFileSync(process.execPath,['--test',path.join(__dirname,'../cooking_native/test_runtime.mjs'),path.join(__dirname,'../cooking_native/test_wear_curve.mjs')],{stdio:'inherit'});
