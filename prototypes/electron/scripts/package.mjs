// Assemble official Electron runtimes without running foreign executables.
// Preserve Unix executable bits and symlinks when assembling macOS on Windows.
import { readFile, writeFile, mkdir, readdir, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync, strToU8 } from 'fflate';
const require=createRequire(import.meta.url),{downloadArtifact}=require('@electron/get');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const platform=process.argv[2]||process.platform,arch=process.argv[3]||process.arch;
if(!['win32','darwin'].includes(platform)||!['arm64','x64'].includes(arch))throw Error('Use win32 x64, darwin arm64 or darwin x64');
const out=path.resolve(root,'..');await mkdir(out,{recursive:true});
console.log(`Downloading official Electron ${pkg.devDependencies.electron} ${platform}-${arch}`);
const runtime=await downloadArtifact({version:pkg.devDependencies.electron,artifactName:'electron',platform,arch});
const raw=new Uint8Array(await readFile(runtime));
const attrs=new Map();
// ZIP central directory carries external attributes (Unix mode including symlink).
for(let p=0;p<raw.length-46;p++){
 if(raw[p]!==0x50||raw[p+1]!==0x4b||raw[p+2]!==1||raw[p+3]!==2)continue;
 const v=new DataView(raw.buffer,raw.byteOffset+p),n=v.getUint16(28,true),extra=v.getUint16(30,true),comment=v.getUint16(32,true);
 const name=new TextDecoder().decode(raw.subarray(p+46,p+46+n));attrs.set(name,{attrs:v.getUint32(38,true),os:raw[p+5]});p+=45+n+extra+comment;
}
const sourceFiles={};
async function collect(dir,prefix=''){
 for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){
  const rel=path.posix.join(dir,e.name);if(e.isDirectory())await collect(rel,prefix);else sourceFiles[prefix+rel]=new Uint8Array(await readFile(path.join(root,rel)));
 }
}
await collect('app');
for(const name of ['main.cjs','preload.cjs'])sourceFiles[name]=new Uint8Array(await readFile(path.join(root,name)));
sourceFiles['package.json']=strToU8(JSON.stringify({name:pkg.name,productName:pkg.productName,version:pkg.version,main:'main.cjs',license:'MIT'}));
const files=unzipSync(raw),entries={};
let bundleName;
if(platform==='darwin'){
 bundleName=`TEMPO-macOS-${arch==='arm64'?'AppleSilicon':'Intel'}.zip`;
 for(const [name,data]of Object.entries(files)){
  if(name.startsWith('Electron.app/Contents/_CodeSignature/'))continue;
  let dest=name.replace(/^Electron\.app\//,'TEMPO.app/');
  if(name==='Electron.app/Contents/MacOS/Electron')dest='TEMPO.app/Contents/MacOS/TEMPO';
  const options=attrs.get(name)||{os:3,attrs:0o100644<<16};
  if(name==='Electron.app/Contents/Info.plist'){
   let plist=new TextDecoder().decode(data).replace(/(<key>CFBundleExecutable<\/key>\s*<string>)Electron(<\/string>)/,'$1TEMPO$2')
    .replace(/(<key>CFBundleName<\/key>\s*<string>)[^<]+/,'$1TEMPO')
    .replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+/,'$1TEMPO')
    .replace(/(<key>CFBundleIdentifier<\/key>\s*<string>)[^<]+/,'$1studio.tempo.instrument')
    .replace(/(<key>CFBundleIconFile<\/key>\s*<string>)[^<]+/,'$1tempo.icns');
   entries[dest]=[strToU8(plist),options];
  }else entries[dest]=[data,options];
 }
 for(const [name,data]of Object.entries(sourceFiles))entries['TEMPO.app/Contents/Resources/app/'+name]=[data,{os:3,attrs:0o100644<<16}];
 entries['TEMPO.app/Contents/Resources/tempo.icns']=[new Uint8Array(await readFile(path.join(root,'app','icon.icns'))),{os:3,attrs:0o100644<<16}];
 const launcher='#!/bin/zsh\nset -e\ncd -- "${0:A:h}"\n/usr/bin/codesign --force --deep --sign - --preserve-metadata=entitlements "TEMPO.app"\n/usr/bin/open "TEMPO.app"\n';
 entries['首次运行.command']=[strToU8(launcher),{os:3,attrs:0o100755<<16}];
 entries['请先阅读.txt']=strToU8('TEMPO macOS '+arch+'\n此包在 Windows 上组装，尚未在 Mac 实机验证。\n解压后首次运行.command 会在本机为应用做临时签名，然后打开 TEMPO。\n如 macOS 阻止打开，请在 系统设置 → 隐私与安全性 中允许你信任的本地应用。\n完成签名后可将 TEMPO.app 拖入应用程序。\n未提供 Apple 开发者签名或公证。\n');
}else{
 bundleName='TEMPO-Windows-x64.zip';
 for(const [name,data]of Object.entries(files))entries['TEMPO-Windows/'+(name==='electron.exe'?'TEMPO.exe':name)]=data;
 for(const [name,data]of Object.entries(sourceFiles))entries['TEMPO-Windows/resources/app/'+name]=data;
 entries['TEMPO-Windows/使用说明.txt']=new Uint8Array(await readFile(path.join(root,'使用说明.txt')));
}
entries['TEMPO-LICENSE.txt']=new Uint8Array(await readFile(path.join(root,'LICENSE')));
if(platform==='win32'&&process.platform==='win32'){
 const {rcedit}=await import('rcedit'),tmp=await mkdtemp(path.join(os.tmpdir(),'tempo-build-'));
 const exe=path.join(tmp,'TEMPO.exe');await writeFile(exe,entries['TEMPO-Windows/TEMPO.exe']);
 try{
  await rcedit(exe,{icon:path.join(root,'app','icon.ico'),'file-version':pkg.version,'product-version':pkg.version,'version-string':{ProductName:'TEMPO',FileDescription:'TEMPO — Time, made tangible',CompanyName:'TEMPO Studio',OriginalFilename:'TEMPO.exe'}});
  entries['TEMPO-Windows/TEMPO.exe']=new Uint8Array(await readFile(exe));
 }finally{await unlink(exe);await rmdir(tmp);}
}
console.log('Compressing',Object.keys(entries).length,'entries');
const zip=zipSync(entries,{level:6});const output=path.join(out,bundleName);await writeFile(output,zip);
const sha=createHash('sha256').update(zip).digest('hex');await writeFile(output+'.sha256',sha+'  '+bundleName+'\n');
console.log(output,Math.round(zip.length/1024/1024)+' MB',sha);
if(platform==='win32'){
 const dir=path.join(out,'TEMPO-Windows');await mkdir(dir,{recursive:true});
 for(const [name,data]of Object.entries(entries)){
  if(!name.startsWith('TEMPO-Windows/')||name.endsWith('/'))continue;
  const file=path.join(out,...name.split('/'));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,data);
 }
 console.log('Ready to launch:',path.join(dir,'TEMPO.exe'));
}
