// Flashy Studio Editor - generated
(function(){
"use strict";
var N=1;function uid(){return N++;}
function EditorObject(t){this.id=uid();this.type=t;this.x=0;this.y=0;this.width=0;this.height=0;this.rotation=0;this.scaleX=1;this.scaleY=1;this.skewX=0;this.skewY=0;this.alpha=1;this.name="";this.fillColor="#000000";this.fillAlpha=1;this.fillType="solid";this.strokeColor="#000000";this.strokeAlpha=1;this.strokeWidth=1;this.strokeStyle="solid";this.strokeCap="round";this.strokeJoin="round";this.points=null;this.text="";this.font="Arial";this.fontSize=24;this.fontBold=false;this.fontItalic=false;this.fontUnderline=false;this.textAlign="left";this.lineHeight=1.2;this.symbolName="";this.instanceName="";this.symbolBehavior="movieclip";this.firstFrame=1;this.loopMode="loop";this.blendMode="source-over";}
EditorObject.prototype.clone=function(){var c=new EditorObject(this.type);var s=this;Object.keys(s).forEach(function(k){var v=s[k];c[k]=Array.isArray(v)?v.slice():v;});c.id=uid();return c;};
// `sound` is Flash's model: a sound is attached to a keyframe, not to a layer.
// {asset, sync:"stream"|"event", volume, loop, offset} or null.
function KeyFrame(i){this.index=i;this.duration=1;this.tweenType="none";this.easing="linear";this.objects=[];this.script="";this.sound=null;}
KeyFrame.prototype.clone=function(){var c=new KeyFrame(this.index);c.duration=this.duration;c.tweenType=this.tweenType;c.easing=this.easing;c.objects=this.objects.map(function(o){return o.clone();});c.script=this.script;c.sound=this.sound?cloneSound(this.sound):null;return c;};
function cloneSound(s){return {asset:s.asset,sync:s.sync||"stream",volume:s.volume!=null?s.volume:1,loop:!!s.loop,offset:s.offset||0};}
function Layer(n){this.name=n;this.visible=true;this.locked=false;this.keyframes=[new KeyFrame(1)];}
Layer.prototype.getKeyframeAt=function(f){for(var i=this.keyframes.length-1;i>=0;i--){var k=this.keyframes[i];if(f>=k.index&&f<k.index+k.duration)return k;}return null;};
Layer.prototype.getFrameEnd=function(){var l=this.keyframes[this.keyframes.length-1];return l?l.index+l.duration-1:1;};
Layer.prototype.insertKeyframe=function(f){var e=this.getKeyframeAt(f);if(e&&e.index===f)return e;if(e){var nk=e.clone();nk.index=f;nk.duration=(e.index+e.duration)-f;e.duration=f-e.index;var i=this.keyframes.indexOf(e);this.keyframes.splice(i+1,0,nk);return nk;}var kf=new KeyFrame(f);this.keyframes.push(kf);this.keyframes.sort(function(a,b){return a.index-b.index;});return kf;};
Layer.prototype.insertBlankKeyframe=function(f){var k=this.insertKeyframe(f);k.objects=[];return k;};
Layer.prototype.extendToFrame=function(f){var l=this.keyframes[this.keyframes.length-1];if(l&&f>l.index+l.duration-1)l.duration=f-l.index+1;};
Layer.prototype.removeKeyframe=function(f){var i=-1;for(var j=0;j<this.keyframes.length;j++){if(this.keyframes[j].index===f){i=j;break;}}if(i<=0)return;this.keyframes[i-1].duration+=this.keyframes[i].duration;this.keyframes.splice(i,1);};
// `sounds` is the audio asset library: name -> {name, mediaType, data (base64),
// duration}. Keyframes reference assets by name, the same way symbol instances
// reference `library`. Audio travels inside the .flashy document so a project
// is still one self-contained file.
var doc={width:550,height:400,fps:24,backgroundColor:"#FFFFFF",layers:[new Layer("Layer 1")],library:{},sounds:{},totalFrames:60};
Object.defineProperty(doc,"maxFrame",{get:function(){var m=1;this.layers.forEach(function(l){var e=l.getFrameEnd();if(e>m)m=e;});return Math.max(m,this.totalFrames);}});
var curLayer=0,curFrame=1,selection=[],clipboard=[],playing=false,playTimer=null;
var selectedKF=null; // {layerIdx, frameIdx} — which keyframe cell is selected in the timeline
var editStack=[]; // [{name:"Scene 1", layers: ..., frame: curFrame, layer: curLayer}]
function currentLayers(){
  if(editStack.length>0)return editStack[editStack.length-1].layers;
  return doc.layers;
}
function currentTotalFrames(){
  if(editStack.length>0){
    var ctx=editStack[editStack.length-1];
    return ctx.totalFrames||60;
  }
  return doc.totalFrames;
}
function currentMaxFrame(){
  var layers=currentLayers();
  var m=1;
  layers.forEach(function(l){var e=l.getFrameEnd();if(e>m)m=e;});
  return m;
}
var lastClickTime=0,lastClickTarget=null;
var fillColor="#000000",fillAlpha=1,strokeColor="#000000",strokeAlpha=1,strokeWidth=1;
var undoStack=[],redoStack=[];

/* ------------------------------------------------------------------ *
 * Dirty tracking
 *
 * `docRev` advances on every document mutation (every pushUndo, and every
 * undo/redo); `savedRev` records the revision that was last written to disk.
 * Comparing the two is O(1), where comparing documents would not be.
 *
 * Undoing back to the exact state that was saved still reports dirty, because
 * the revision moved. That is deliberate: for a save guard, a spurious "you
 * have unsaved work" prompt is harmless and a missed one costs the user their
 * document.
 * ------------------------------------------------------------------ */
var docRev=0,savedRev=0,dirty=false;
function syncDirty(){
  var next=docRev!==savedRev;
  if(next===dirty)return;
  dirty=next;
  // desktop.js listens for this to put a • in the window title and to tell the
  // Electron shell whether closing the window needs a confirmation prompt.
  try{window.dispatchEvent(new CustomEvent("flashy:dirtychange",{detail:{dirty:dirty}}));}catch(e){}
}
function touchDoc(){docRev++;syncDirty();}
/** Called after a successful write to disk, and when a fresh document loads. */
function markSaved(){savedRev=docRev;syncDirty();}
function isDirty(){return dirty;}

// Snapshots carry the edit stack (which symbol you are inside), so undo does
// not silently strand you editing a library symbol that deserializeDoc has
// since replaced with a different object.
function snap(){
  return JSON.stringify({
    d:serializeDoc(),f:curFrame,l:curLayer,
    path:editStack.map(function(c){
      return {name:c.name,savedFrame:c.savedFrame,savedLayer:c.savedLayer};
    })
  });
}
function pushUndo(){pushUndoSnap(snap());}
function pushUndoSnap(s){undoStack.push(s);if(undoStack.length>50)undoStack.shift();redoStack.length=0;touchDoc();}
/**
 * Restore a snapshot, including which symbol was being edited.
 *
 * deserializeDoc() rebuilds doc.library from scratch, so every editStack entry
 * is holding a reference to a layer array that is no longer part of the
 * document. The stack has to be rebuilt by name against the new library.
 */
function restoreSnap(s){
  var st=JSON.parse(s);
  deserializeDoc(st.d);
  editStack=[];
  (st.path||[]).forEach(function(entry){
    var sym=doc.library[entry.name];
    if(!sym)return; // symbol no longer exists in this revision
    ensureSymbolLayers(sym);
    editStack.push({
      name:entry.name,layers:sym.layers,totalFrames:sym.totalFrames||60,
      savedFrame:entry.savedFrame||1,savedLayer:entry.savedLayer||0
    });
  });
  curFrame=Math.max(1,st.f||1);
  var layers=currentLayers();
  curLayer=Math.min(Math.max(0,st.l||0),Math.max(0,layers.length-1));
  selection=[];
  updateBreadcrumb();
  fullRefresh();
}
function doUndo(){if(!undoStack.length)return;redoStack.push(snap());restoreSnap(undoStack.pop());touchDoc();}
function doRedo(){if(!redoStack.length)return;undoStack.push(snap());restoreSnap(redoStack.pop());touchDoc();}
function CL(){return currentLayers()[curLayer];}
function CKF(){var l=CL();return l?l.getKeyframeAt(curFrame):null;}

/* ------------------------------------------------------------------ *
 * Dialogs
 *
 * `window.prompt()` is **not supported in Electron** — it throws
 * "prompt() is not supported." So every feature that asked for a value with
 * prompt() was silently dead in the desktop build: the API key, Document
 * Settings, naming a symbol, Import from URL. They worked in a browser and
 * threw in the app, which is the worst possible split.
 *
 * showDialog() replaces all of them with one styled modal. It is also simply
 * better: several fields at once, a password field that does not shoulder-surf
 * an API key, Escape/Enter, and validation before it closes.
 * ------------------------------------------------------------------ */
function showDialog(opts){
  opts=opts||{};
  var fields=opts.fields||[];
  var prev=document.getElementById("fy-dialog");
  if(prev)prev.parentNode.removeChild(prev);

  var back=document.createElement("div");
  back.id="fy-dialog";
  back.className="fy-dialog-backdrop";
  var box=document.createElement("div");
  box.className="fy-dialog";
  back.appendChild(box);

  var h=document.createElement("div");
  h.className="fy-dialog-title";
  h.textContent=opts.title||"Flashy";
  box.appendChild(h);

  var body=document.createElement("div");
  body.className="fy-dialog-body";
  box.appendChild(body);

  if(opts.message){
    var msg=document.createElement("div");
    msg.className="fy-dialog-msg";
    msg.textContent=opts.message;
    body.appendChild(msg);
  }

  var inputs={};
  fields.forEach(function(f){
    var row=document.createElement("label");
    row.className="fy-dialog-row";
    var lab=document.createElement("span");
    lab.className="fy-dialog-label";
    lab.textContent=f.label;
    row.appendChild(lab);
    var inp;
    if(f.type==="select"){
      inp=document.createElement("select");
      (f.options||[]).forEach(function(op){
        var o=document.createElement("option");
        o.value=String(op[0]);o.textContent=op[1];
        if(String(f.value)===String(op[0]))o.selected=true;
        inp.appendChild(o);
      });
      if(f.onChange)inp.addEventListener("change",function(){f.onChange(inp.value);});
    }else{
      inp=document.createElement("input");
      inp.type=f.type||"text";
      inp.value=f.value!=null?String(f.value):"";
      if(f.placeholder)inp.placeholder=f.placeholder;
      if(f.type==="number"){
        if(f.min!=null)inp.min=f.min;
        if(f.max!=null)inp.max=f.max;
      }
      inp.spellcheck=false;
    }
    inp.className="fy-dialog-input";
    row.appendChild(inp);
    body.appendChild(row);
    if(f.hint){
      var hint=document.createElement("div");
      hint.className="fy-dialog-hint";
      hint.textContent=f.hint;
      body.appendChild(hint);
    }
    inputs[f.name]=inp;
  });

  if(opts.footnote){
    var fn=document.createElement("div");
    fn.className="fy-dialog-hint";
    fn.textContent=opts.footnote;
    body.appendChild(fn);
  }

  var err=document.createElement("div");
  err.className="fy-dialog-error";
  err.style.display="none";
  body.appendChild(err);

  var foot=document.createElement("div");
  foot.className="fy-dialog-foot";
  box.appendChild(foot);

  function close(){
    document.removeEventListener("keydown",onKey,true);
    if(back.parentNode)back.parentNode.removeChild(back);
  }
  function values(){
    var v={};
    Object.keys(inputs).forEach(function(k){v[k]=inputs[k].value;});
    return v;
  }
  function submit(){
    var v=values();
    if(opts.validate){
      var problem=opts.validate(v);
      if(problem){err.textContent=problem;err.style.display="";return;}
    }
    close();
    if(opts.onOk)opts.onOk(v);
  }

  (opts.extraButtons||[]).forEach(function(b){
    var el=document.createElement("button");
    el.className="fy-dialog-btn";
    el.textContent=b.label;
    el.addEventListener("click",function(){
      if(b.onClick)b.onClick(values(),close);
    });
    foot.appendChild(el);
  });
  var spacer=document.createElement("span");
  spacer.style.flex="1";
  foot.appendChild(spacer);

  if(!opts.noCancel){
    var cancel=document.createElement("button");
    cancel.className="fy-dialog-btn";
    cancel.textContent=opts.cancelLabel||"Cancel";
    cancel.addEventListener("click",function(){close();if(opts.onCancel)opts.onCancel();});
    foot.appendChild(cancel);
  }

  var ok=document.createElement("button");
  ok.className="fy-dialog-btn primary";
  ok.textContent=opts.okLabel||"OK";
  ok.addEventListener("click",submit);
  foot.appendChild(ok);

  function onKey(e){
    if(e.key==="Escape"){e.stopPropagation();e.preventDefault();close();if(opts.onCancel)opts.onCancel();}
    else if(e.key==="Enter"&&e.target.tagName!=="TEXTAREA"){e.stopPropagation();e.preventDefault();submit();}
  }
  // Capture, so the editor's own global shortcut handler never sees these.
  document.addEventListener("keydown",onKey,true);
  back.addEventListener("mousedown",function(e){
    if(e.target===back){close();if(opts.onCancel)opts.onCancel();}
  });

  document.body.appendChild(back);
  var first=fields.length?inputs[fields[0].name]:ok;
  setTimeout(function(){first.focus();if(first.select)first.select();},0);
  return {close:close};
}

/** One-field convenience, the shape most old prompt() calls needed. */
/**
 * Report something to the user in the editor's own dialog.
 *
 * Deliberately not alert(): in the desktop build that is an OS-modal window
 * which blocks the main process until it is dismissed, so it cannot be driven
 * by a test and does not match anything else in the app.
 */
function showMessage(title,text,opts){
  opts=opts||{};
  showDialog({
    title:title,
    message:text,
    fields:[],
    okLabel:opts.okLabel||"OK",
    noCancel:true,
    onOk:opts.onOk||null
  });
}

function askFor(title,label,value,onOk,opts){
  opts=opts||{};
  showDialog({
    title:title,
    message:opts.message,
    fields:[{name:"v",label:label,value:value,placeholder:opts.placeholder,hint:opts.hint}],
    okLabel:opts.okLabel,
    validate:opts.validate?function(v){return opts.validate(v.v);}:null,
    onOk:function(v){onOk(v.v);}
  });
}

// === SVG Icon Helper ===
function svgIcon(content){
  var d=new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">'+content+'</svg>',
    'image/svg+xml');
  var el=d.documentElement;
  el.setAttribute('width','14');
  el.setAttribute('height','14');
  return document.importNode(el,true);
}

// === Menu definitions ===
var menus=[
  {label:"File",items:[
    {label:"New",action:"new",shortcut:"Ctrl+N"},
    {label:"Open...",action:"open",shortcut:"Ctrl+O"},
    {label:"Save",action:"save",shortcut:"Ctrl+S"},
    {type:"sep"},
    {label:"Export as HTML...",action:"export",shortcut:"Ctrl+Shift+S"},
    {label:"Export as Sprite Sheet...",action:"exportGIF"},
    {label:"Export as Video (WebM/MP4)...",action:"exportMP4"},
    {label:"Export as SVG...",action:"exportSVG"},
    {label:"Export Embed Snippet...",action:"exportEmbed"},
    {label:"Export as JS Module...",action:"exportModule"},
    {type:"sep"},
    {label:"Document Settings...",action:"docSettings"},
    {type:"sep"},
    {label:"Import Sound...",action:"importSound",shortcut:"Ctrl+R"},
    {label:"Import from URL...",action:"importURL"}
  ]},
  {label:"Edit",items:[
    {label:"Undo",action:"undo",shortcut:"Ctrl+Z"},
    {label:"Redo",action:"redo",shortcut:"Ctrl+Y"},
    {type:"sep"},
    {label:"Cut",action:"cut",shortcut:"Ctrl+X"},
    {label:"Copy",action:"copy",shortcut:"Ctrl+C"},
    {label:"Paste",action:"paste",shortcut:"Ctrl+V"},
    {label:"Delete",action:"delete",shortcut:"Delete"},
    {type:"sep"},
    {label:"Select All",action:"selectAll",shortcut:"Ctrl+A"},
    {type:"sep"},
    {label:"Preferences...",action:"prefs"}
  ]},
  {label:"View",items:[
    {label:"Zoom In",action:"zoomIn",shortcut:"Ctrl+="},
    {label:"Zoom Out",action:"zoomOut",shortcut:"Ctrl+-"},
    {label:"100%",action:"zoom100",shortcut:"Ctrl+1"},
    {label:"Fit in Window",action:"zoomFit",shortcut:"Ctrl+2"},
    {type:"sep"},
    {label:"Show Grid",action:"grid",shortcut:"Ctrl+''''"},
    {label:"Snap to Grid",action:"snap"}
  ]},
  {label:"Insert",items:[
    {label:"New Symbol...",action:"newSymbol",shortcut:"Ctrl+F8"},
    {label:"Keyframe",action:"insKF",shortcut:"F6"},
    {label:"Blank Keyframe",action:"insBlankKF",shortcut:"F7"},
    {label:"Frame",action:"insFrame",shortcut:"F5"},
    {type:"sep"},
    {label:"Layer",action:"addLayer"},
    {label:"Delete Layer",action:"delLayer"}
  ]},
  {label:"Modify",items:[
    {label:"Convert to Symbol...",action:"convertSym",shortcut:"F8"},
    {type:"sep"},
    {label:"Create Motion Tween",action:"motionTween"},
    {label:"Create Shape Tween",action:"shapeTween"},
    {label:"Remove Tween",action:"removeTween"},
    {type:"sep"},
    {label:"Set Up Mouth Shapes...",action:"mouthSetup"},
    {label:"Auto Lip Sync...",action:"lipSync"},
    {type:"sep"},
    {label:"Remove Keyframe",action:"removeKF",shortcut:"Shift+F6"},
    {label:"Remove Frames",action:"removeFrames",shortcut:"Shift+F5"}
  ]},
  {label:"Control",items:[
    {label:"Play",action:"play",shortcut:"Enter"},
    {label:"Stop",action:"stop"},
    {type:"sep"},
    {label:"Test Movie",action:"test",shortcut:"Ctrl+Enter"},
    {type:"sep"},
    {label:"Go to First Frame",action:"gotoFirst",shortcut:"Home"},
    {label:"Go to Last Frame",action:"gotoLast",shortcut:"End"}
  ]},
  // Window — panel visibility and workspace arrangement. The shortcuts are
  // Flash's own (F9 Actions, Shift+F9 Color Mixer, Ctrl+L Library,
  // Ctrl+F3 Properties) because muscle memory is a migration feature.
  {label:"Window",items:[
    {label:"Properties",action:"winProps",shortcut:"Ctrl+F3"},
    {label:"Color Mixer",action:"winColor",shortcut:"Shift+F9"},
    {label:"Library",action:"winLibrary",shortcut:"Ctrl+L"},
    {label:"Actions",action:"winActions",shortcut:"F9"},
    {label:"AI Assistant",action:"winAI"},
    {type:"sep"},
    {label:"Workspace: Animation",action:"wsAnimation"},
    {label:"Workspace: Drawing",action:"wsDrawing"},
    {label:"Workspace: Coding",action:"wsCoding"},
    {type:"sep"},
    {label:"Reset Panels",action:"wsReset"}
  ]},
  {label:"Help",items:[
    {label:"Report a Bug...",action:"reportBug"},
    {label:"Request a Feature...",action:"reportFeature"}
  ]}
];

// === Desktop shell seam ===
// Everything in this file lives inside an IIFE, so desktop.js cannot reach in
// and swap functions out. Instead it installs itself through the small surface
// below, and the handful of file-system-shaped paths in here (dlFile, and the
// File menu's Open/Save) check `desktopHost` first.
//
// In a browser desktopHost stays null and every path is browser-native — the
// web build behaves exactly as it did before the desktop shell existed.
var desktopHost=null;
window._flashyEditor={
  // The live menu array. desktop.js appends Save As / New Window before
  // buildMenuBar() runs on DOMContentLoaded, so no rebuild is needed.
  menus:menus,
  installDesktop:function(host){desktopHost=host;},
  serializeDoc:function(){return serializeDoc();},
  loadDoc:function(d){return loadDocFromObject(d);},
  doAction:function(a){return doAction(a);},
  // Unsaved-work state. The desktop shell needs both: `isDirty` to decide
  // whether closing a window has to ask first, and `markSaved` to clear the
  // flag once it has actually written bytes to disk.
  isDirty:function(){return isDirty();},
  markSaved:function(){markSaved();}
};

function buildMenuBar(){
  var bar=document.getElementById("menubar");
  if(!bar)return;
  bar.textContent="";
  menus.forEach(function(m){
    var mi=document.createElement("div");
    mi.className="menu-item";
    var lbl=document.createElement("span");
    lbl.textContent=m.label;
    mi.appendChild(lbl);
    var dd=document.createElement("div");
    dd.className="menu-dropdown";
    m.items.forEach(function(it){
      if(it.type==="sep"){
        var sep=document.createElement("div");
        sep.className="menu-sep";
        dd.appendChild(sep);
      }else{
        var e=document.createElement("div");
        e.className="menu-entry";
        var t=document.createElement("span");
        t.textContent=it.label;
        e.appendChild(t);
        if(it.shortcut){
          var sc=document.createElement("span");
          sc.className="menu-shortcut";
          sc.textContent=it.shortcut;
          e.appendChild(sc);
        }
        e.addEventListener("click",function(ev){
          ev.stopPropagation();closeMenus();doAction(it.action);
        });
        dd.appendChild(e);
      }
    });
    mi.appendChild(dd);
    mi.addEventListener("click",function(ev){
      ev.stopPropagation();
      var open=dd.style.display==="block";
      closeMenus();
      if(!open)dd.style.display="block";
    });
    bar.appendChild(mi);
  });
  var spacer=document.createElement("div");
  spacer.style.flex="1";
  bar.appendChild(spacer);
  var report=document.createElement("div");
  report.className="menu-item menu-report";
  report.title="Report a bug or request a feature";
  report.textContent="💬 Report";
  report.addEventListener("click",function(ev){
    ev.stopPropagation();closeMenus();doAction("reportBug");
  });
  bar.appendChild(report);
  document.addEventListener("click",closeMenus);
}
function closeMenus(){
  var dds=document.querySelectorAll(".menu-dropdown");
  for(var i=0;i<dds.length;i++)dds[i].style.display="";
}

// === Toolbar ===
var zoom=1,panX=0,panY=0,showGrid=false,snapGrid=false,gridSize=10;
function buildToolbar(){
  var tb=document.getElementById("toolbar");
  if(!tb)return;
  tb.textContent="";
  var bc=document.createElement("span");
  bc.id="breadcrumb";bc.className="toolbar-breadcrumb";
  bc.textContent="Scene 1";tb.appendChild(bc);
  var sep1=document.createElement("span");sep1.className="toolbar-sep";tb.appendChild(sep1);
  var playBtn=document.createElement("button");playBtn.className="toolbar-btn";playBtn.title="Play";
  playBtn.appendChild(svgIcon('<polygon points="4,2 12,7 4,12" fill="currentColor"/>'));
  playBtn.addEventListener("click",function(){doAction("play");});
  tb.appendChild(playBtn);
  var stopBtn=document.createElement("button");stopBtn.className="toolbar-btn";stopBtn.title="Stop";
  stopBtn.appendChild(svgIcon('<rect x="3" y="3" width="8" height="8" fill="currentColor"/>'));
  stopBtn.addEventListener("click",function(){doAction("stop");});
  tb.appendChild(stopBtn);
  var sep2=document.createElement("span");sep2.className="toolbar-sep";tb.appendChild(sep2);
  var fl=document.createElement("label");fl.className="toolbar-label";fl.textContent="Frame:";tb.appendChild(fl);
  var fi=document.createElement("input");fi.type="number";fi.id="frameInput";fi.className="toolbar-input";
  fi.min=1;fi.value=curFrame;fi.style.width="50px";
  fi.addEventListener("change",function(){var v=parseInt(fi.value)||1;if(v<1)v=1;curFrame=v;fullRefresh();});
  tb.appendChild(fi);
  var sep3=document.createElement("span");sep3.className="toolbar-sep";tb.appendChild(sep3);
  var fpl=document.createElement("label");fpl.className="toolbar-label";fpl.textContent="FPS:";tb.appendChild(fpl);
  var fpi=document.createElement("input");fpi.type="number";fpi.id="fpsInput";fpi.className="toolbar-input";
  fpi.min=1;fpi.max=120;fpi.value=doc.fps;fpi.style.width="40px";
  fpi.addEventListener("change",function(){doc.fps=parseInt(fpi.value)||24;});
  tb.appendChild(fpi);
  var sep4=document.createElement("span");sep4.className="toolbar-sep";tb.appendChild(sep4);
  var zl=document.createElement("label");zl.className="toolbar-label";zl.textContent="Zoom:";tb.appendChild(zl);
  var zs=document.createElement("select");zs.id="zoomSelect";zs.className="toolbar-input";
  [25,50,75,100,150,200,400].forEach(function(v){
    var o=document.createElement("option");o.value=v/100;o.textContent=v+"%";
    if(v===100)o.selected=true;zs.appendChild(o);
  });
  zs.addEventListener("change",function(){zoom=parseFloat(zs.value);render();});
  tb.appendChild(zs);
}

// === Tools ===
var curTool="select";
var TOOLS=[
  {id:"select",label:"Selection Tool (V)",key:"v",svg:'<path d="M3,1 L3,12 L6,9 L9,13 L11,12 L8,8 L12,7 Z" fill="currentColor"/>'},
  {id:"transform",label:"Free Transform (Q)",key:"q",svg:'<rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="12" cy="2" r="1.5" fill="currentColor"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'},
  {id:"text",label:"Text Tool (T)",key:"t",svg:'<text x="3" y="12" font-size="12" font-weight="bold" fill="currentColor">T</text>'},
  {id:"line",label:"Line Tool (N)",key:"n",svg:'<line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"rect",label:"Rectangle Tool (R)",key:"r",svg:'<rect x="2" y="3" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"oval",label:"Oval Tool (O)",key:"o",svg:'<ellipse cx="7" cy="7" rx="5" ry="4" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"pencil",label:"Pencil Tool (Y)",key:"y",svg:'<path d="M2,12 L4,10 L10,4 L12,2 L11,3 L5,9 L3,11 Z" fill="none" stroke="currentColor" stroke-width="1"/>'},
  {id:"brush",label:"Brush Tool (B)",key:"b",svg:'<path d="M9,1 Q12,4 8,8 Q6,10 3,13 Q2,12 4,9 Q5,7 6,6 L9,1 Z" fill="currentColor"/>'},
  {id:"bucket",label:"Paint Bucket (K)",key:"k",svg:'<path d="M3,5 L7,1 L11,5 L7,9 Z" fill="currentColor" opacity="0.4"/><path d="M2,9 L2,13 L12,13 L12,9 L10,7 L7,10 L4,7 Z" fill="currentColor"/>'},
  {id:"eyedrop",label:"Eyedropper (I)",key:"i",svg:'<path d="M10,1 L12,3 L11,4 L5,10 L3,11 L2,9 L8,3 L9,2 Z" fill="none" stroke="currentColor" stroke-width="1"/>'},
  {id:"hand",label:"Hand Tool (H)",key:"h",svg:'<path d="M7,13 Q3,13 3,9 L3,6 Q3,5 4,5 Q5,5 5,6 L5,7 L5,4 Q5,3 6,3 Q7,3 7,4 L7,7 L7,3 Q7,2 8,2 Q9,2 9,3 L9,7 L9,5 Q9,4 10,4 Q11,4 11,5 L11,10 Q11,13 7,13 Z" fill="none" stroke="currentColor" stroke-width="0.8"/>'},
  {id:"zoom",label:"Zoom Tool (Z)",key:"z",svg:'<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" stroke-width="1.5"/>'}
];

function buildToolbox(){
  var tb=document.getElementById("toolbox");
  if(!tb)return;
  tb.textContent="";
  TOOLS.forEach(function(t){
    var btn=document.createElement("button");
    btn.className="tool-btn"+(curTool===t.id?" active":"");
    btn.title=t.label;
    btn.dataset.tool=t.id;
    btn.appendChild(svgIcon(t.svg));
    btn.addEventListener("click",function(){setTool(t.id);});
    tb.appendChild(btn);
  });
}
// Custom SVG cursors for each tool
var toolCursors={};
function buildCursor(svg,hotX,hotY){
  var full='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'+svg+'</svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(full)+'") '+hotX+' '+hotY+', auto';
}
function initCursors(){
  // Selection arrow — black arrow with white outline
  toolCursors.select=buildCursor('<path d="M4,1 L4,17 L8,13 L12,19 L15,17 L11,11 L17,11 Z" fill="#000" stroke="#fff" stroke-width="1.2"/>',4,1);
  // Transform — arrow with corner squares
  toolCursors.transform=buildCursor('<path d="M4,1 L4,17 L8,13 L12,19 L15,17 L11,11 L17,11 Z" fill="#000" stroke="#fff" stroke-width="1"/>',4,1);
  // Text — I-beam
  toolCursors.text=buildCursor('<line x1="12" y1="3" x2="12" y2="21" stroke="#000" stroke-width="1.5"/><line x1="8" y1="3" x2="16" y2="3" stroke="#000" stroke-width="1.5"/><line x1="8" y1="21" x2="16" y2="21" stroke="#000" stroke-width="1.5"/><line x1="12" y1="3" x2="12" y2="21" stroke="#fff" stroke-width="0.5"/>',12,12);
  // Line — crosshair
  toolCursors.line=buildCursor('<line x1="12" y1="2" x2="12" y2="22" stroke="#000" stroke-width="1"/><line x1="2" y1="12" x2="22" y2="12" stroke="#000" stroke-width="1"/><line x1="12" y1="2" x2="12" y2="22" stroke="#fff" stroke-width="0.3"/><line x1="2" y1="12" x2="22" y2="12" stroke="#fff" stroke-width="0.3"/>',12,12);
  // Rect — crosshair with tiny rect
  toolCursors.rect=buildCursor('<line x1="12" y1="2" x2="12" y2="22" stroke="#000" stroke-width="1"/><line x1="2" y1="12" x2="22" y2="12" stroke="#000" stroke-width="1"/><rect x="14" y="14" width="6" height="5" fill="none" stroke="#000" stroke-width="0.8"/>',12,12);
  // Oval — crosshair with tiny oval
  toolCursors.oval=buildCursor('<line x1="12" y1="2" x2="12" y2="22" stroke="#000" stroke-width="1"/><line x1="2" y1="12" x2="22" y2="12" stroke="#000" stroke-width="1"/><ellipse cx="17" cy="17" rx="4" ry="3" fill="none" stroke="#000" stroke-width="0.8"/>',12,12);
  // Pencil — pencil tip
  toolCursors.pencil=buildCursor('<path d="M5,19 L7,13 L17,3 L21,7 L11,17 Z" fill="#FFC" stroke="#000" stroke-width="0.8"/><path d="M5,19 L7,13 L9,15 Z" fill="#F90" stroke="#000" stroke-width="0.5"/><path d="M4,20 L5,19 L6,20 Z" fill="#333"/>',4,20);
  // Brush — brush tip angled
  toolCursors.brush=buildCursor('<path d="M14,2 Q20,6 16,12 Q13,16 6,20 Q5,18 8,14 Q10,11 12,9 L14,2 Z" fill="#666" stroke="#000" stroke-width="0.6"/><circle cx="6" cy="20" r="1.5" fill="#000"/>',6,20);
  // Bucket — paint bucket
  toolCursors.bucket=buildCursor('<path d="M8,4 L13,1 L18,6 L13,11 Z" fill="#FF0" stroke="#000" stroke-width="0.8"/><path d="M5,11 L5,19 L19,19 L19,11 L16,8 L13,11 L10,8 Z" fill="#FF0" stroke="#000" stroke-width="0.8"/><path d="M20,13 Q23,16 20,19" fill="none" stroke="#39F" stroke-width="1.5"/>',12,18);
  // Eyedropper
  toolCursors.eyedrop=buildCursor('<path d="M17,1 L21,5 L19,7 L11,15 L8,16 L7,13 L15,5 L17,3 Z" fill="#DDD" stroke="#000" stroke-width="0.8"/><path d="M8,16 L7,13 L5,19 Z" fill="#000"/>',5,19);
  // Hand — open hand
  toolCursors.hand='grab';
  // Zoom — magnifying glass
  toolCursors.zoom='zoom-in';
}
initCursors();
function setTool(id){
  curTool=id;
  var btns=document.querySelectorAll(".tool-btn");
  for(var i=0;i<btns.length;i++){
    btns[i].className="tool-btn"+(btns[i].dataset.tool===id?" active":"");
  }
  var cv=document.getElementById("stageCanvas");
  if(cv){
    cv.style.cursor=toolCursors[id]||"default";
  }
}

// === Canvas / Stage ===
var canvas,ctx;
var canvasW=0,canvasH=0; // logical (CSS) size of canvas
function resizeCanvas(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  var wrap=canvas.parentElement;
  canvasW=wrap.clientWidth;
  canvasH=wrap.clientHeight;
  var dpr=window.devicePixelRatio||1;
  canvas.width=canvasW*dpr;
  canvas.height=canvasH*dpr;
  canvas.style.width=canvasW+"px";
  canvas.style.height=canvasH+"px";
  ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  render();
}
function centerStage(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  panX=(canvasW-doc.width*zoom)/2;
  panY=(canvasH-doc.height*zoom)/2;
}
function s2s(x,y){return{x:(x-panX)/zoom,y:(y-panY)/zoom};}
function s2c(x,y){return{x:x*zoom+panX,y:y*zoom+panY};}

function render(){
  if(!ctx)return;
  var dpr=window.devicePixelRatio||1;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var w=canvasW,h=canvasH;
  ctx.clearRect(0,0,w,h);
  // pasteboard
  ctx.fillStyle="#C0C0C0";
  ctx.fillRect(0,0,w,h);
  // stage shadow
  var sx=panX+3,sy=panY+3,sw=doc.width*zoom,sh=doc.height*zoom;
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.fillRect(sx,sy,sw,sh);
  // stage bg
  ctx.fillStyle=doc.backgroundColor;
  ctx.fillRect(panX,panY,sw,sh);
  // clip to stage
  ctx.save();
  ctx.beginPath();
  ctx.rect(panX,panY,sw,sh);
  ctx.clip();
  ctx.save();
  ctx.translate(panX,panY);
  ctx.scale(zoom,zoom);
  // visual indicator when editing a symbol
  if(editStack.length>0){
    ctx.strokeStyle="rgba(100,150,255,0.5)";
    ctx.lineWidth=3/zoom;
    ctx.setLineDash([8/zoom,4/zoom]);
    ctx.strokeRect(0,0,doc.width,doc.height);
    ctx.setLineDash([]);
  }
  // render layers bottom to top
  frameObjects(currentLayers(),curFrame).forEach(renderObj);
  ctx.restore();
  // grid
  if(showGrid){
    ctx.strokeStyle="rgba(0,0,0,0.12)";
    ctx.lineWidth=0.5;
    for(var gx=0;gx<=doc.width;gx+=gridSize){
      var px=gx*zoom+panX;
      ctx.beginPath();ctx.moveTo(px,panY);ctx.lineTo(px,panY+sh);ctx.stroke();
    }
    for(var gy=0;gy<=doc.height;gy+=gridSize){
      var py=gy*zoom+panY;
      ctx.beginPath();ctx.moveTo(panX,py);ctx.lineTo(panX+sw,py);ctx.stroke();
    }
  }
  ctx.restore();
  // selection handles
  selection.forEach(function(o){drawSel(o);});
  // tool preview
  if(dragging&&dragPreview)drawPrev();
}

/* ------------------------------------------------------------------ *
 * paintObj — the one canvas painter
 *
 * Draws an EditorObject onto ANY 2D context: the stage, and the offscreen
 * canvases the sprite-sheet / video exporters record from. Those used to have
 * their own copy (`_renderObjExport`) which had drifted badly — it knew nothing
 * about symbols (so they silently vanished from every raster export) and it
 * transformed around the object's TOP-LEFT while the stage transformed around
 * its CENTRE, so any rotated or scaled object landed somewhere else in an
 * export than where the user had placed it.
 *
 * Origin convention, now used by all four output paths (stage, raster, SVG,
 * HTML/JS export): translate to the object's centre, then rotate and scale.
 *
 * opts.chrome  draw authoring-only affordances — symbol name labels, empty and
 *              missing-symbol markers. True for the stage, false for exports:
 *              an export must contain the artwork and nothing else.
 * opts.depth   symbol recursion depth, so a symbol that (directly or through
 *              another symbol) contains itself cannot recurse forever.
 * ------------------------------------------------------------------ */
var SYMBOL_MAX_DEPTH=8;

/* ------------------------------------------------------------------ *
 * Puppet mechanics
 *
 * The three symbol behaviours differ in *which frame of the symbol an
 * instance shows*, and that difference is the mechanical basis of all puppet
 * animation — a mouth with ten phoneme frames, eyes with open/half/closed, a
 * hand with six poses. You animate by picking frames, not by redrawing.
 *
 *   Graphic    — shows a frame chosen relative to the PARENT timeline, so it
 *                previews while you scrub. This is what lip sync is built on.
 *   MovieClip  — runs its own independent timeline, and therefore shows only
 *                its first frame on the authoring stage (same as Flash: you
 *                Test Movie to see it move).
 *   Button     — Up / Over / Down / Hit on frames 1–4; shows Up while editing.
 * ------------------------------------------------------------------ */
var BUTTON_STATES=["up","over","down","hit"];

/** How many frames a symbol's own timeline runs for. */
function symbolTotalFrames(sym){
  if(!sym)return 1;
  // Older/alternate symbols carry `objects` + `totalFrames` and no `layers`
  // at all. Returning 1 for those made every mouth shape clamp onto frame 1.
  if(!sym.layers||!sym.layers.length)return Math.max(1,parseInt(sym.totalFrames,10)||1);
  var m=1;
  sym.layers.forEach(function(l){
    // Computed from the keyframes rather than Layer.getFrameEnd(), so a
    // symbol still reports its real length when its layers have not been
    // through reviveLayers() — a document mid-import, or one assembled by
    // the assistant.
    (l.keyframes||[]).forEach(function(k){
      var e=(k.index||1)+(k.duration||1)-1;
      if(e>m)m=e;
    });
  });
  return Math.max(1,m);
}

/** An instance's behaviour: its own override, else the symbol's default. */
function symbolBehaviorOf(o,sym){
  return o.symbolBehavior||(sym&&sym.behavior)||"movieclip";
}

/**
 * Point an instance at a different library symbol, keeping its position,
 * transform, behaviour and frame settings.
 *
 * This is how a puppet gets re-posed — swap the hand symbol, keep everything
 * else — and doing it by hand means deleting and replacing the instance, then
 * reapplying every property.
 */
function swapSymbolOn(o,ev){
  var names=Object.keys(doc.library);
  if(!names.length){alert("The library has no symbols to swap to.");return;}
  var items=names.map(function(n){
    return {
      label:(n===o.symbolName?"● ":"   ")+n,
      action:function(){
        if(n===o.symbolName)return;
        pushUndo();
        o.symbolName=n;
        // Clamp the chosen frame to the new symbol's length.
        var total=symbolTotalFrames(doc.library[n]);
        if((o.firstFrame||1)>total)o.firstFrame=1;
        fullRefresh();
      }
    };
  });
  var x=16,y=120;
  if(ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect){
    var r=ev.currentTarget.getBoundingClientRect();
    x=r.left;y=r.bottom+2;
  }
  showTLContextMenu(x,y,items);
}

/**
 * Which frame of `sym` an instance displays.
 *
 * `parentFrame` is the playhead of the timeline the instance lives on, and
 * `startFrame` the frame its keyframe begins — a Graphic advances in step
 * with its parent from the moment it appears, which is why both are needed.
 */
function symbolDisplayFrame(o,sym,parentFrame,startFrame){
  var total=symbolTotalFrames(sym);
  var first=Math.max(1,Math.min(o.firstFrame||1,total));
  var behavior=symbolBehaviorOf(o,sym);
  if(behavior!=="graphic")return behavior==="button"?1:1;
  var mode=o.loopMode||"loop";
  if(mode==="single")return first;
  var elapsed=Math.max(0,(parentFrame||1)-(startFrame||1));
  var f=first+elapsed;
  if(mode==="once")return Math.min(f,total);
  return ((f-1)%total+total)%total+1;
}

/** The objects a symbol shows at `frame`, bottom layer first. */
function symbolFrameObjects(sym,frame){
  if(!sym)return [];
  if(!sym.layers)return sym.objects||[];
  var out=[];
  for(var i=sym.layers.length-1;i>=0;i--){
    var sl=sym.layers[i];
    if(!sl||sl.visible===false)continue;
    // Library layers are revived through reviveLayers(), so getKeyframeAt is
    // always present; guard anyway for documents hand-edited outside the app.
    var skf=typeof sl.getKeyframeAt==="function"?sl.getKeyframeAt(frame):null;
    if(skf)out=out.concat(skf.objects);
  }
  return out;
}

function paintObj(cx,o,opts){
  opts=opts||{};
  var chrome=!!opts.chrome;
  var depth=opts.depth||0;
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  var alpha=o.alpha!=null?o.alpha:1;
  var fillOn=(o.fillType||"solid")!=="none";
  var strokeOn=(o.strokeWidth||0)>0&&(o.strokeStyle||"solid")!=="none";
  var fillA=alpha*(o.fillAlpha!=null?o.fillAlpha:1);
  var strokeA=alpha*(o.strokeAlpha!=null?o.strokeAlpha:1);

  cx.save();
  cx.translate((o.x||0)+hw,(o.y||0)+hh);
  if(o.rotation)cx.rotate(o.rotation*Math.PI/180);
  cx.scale(o.scaleX||1,o.scaleY||1);
  if(o.blendMode&&o.blendMode!=="source-over")cx.globalCompositeOperation=o.blendMode;
  cx.globalAlpha=alpha;

  var applyStroke=function(){
    cx.lineCap=o.strokeCap||"round";
    cx.lineJoin=o.strokeJoin||"round";
    if(o.strokeStyle==="dashed")cx.setLineDash([6,4]);
    else if(o.strokeStyle==="dotted")cx.setLineDash([2,3]);
    else cx.setLineDash([]);
  };

  if(o.type==="rect"){
    if(fillOn){cx.fillStyle=o.fillColor;cx.globalAlpha=fillA;cx.fillRect(-hw,-hh,o.width,o.height);}
    if(strokeOn){
      cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth;
      cx.globalAlpha=strokeA;applyStroke();cx.strokeRect(-hw,-hh,o.width,o.height);
    }
  }else if(o.type==="oval"){
    cx.beginPath();cx.ellipse(0,0,Math.abs(hw),Math.abs(hh),0,0,Math.PI*2);
    if(fillOn){cx.fillStyle=o.fillColor;cx.globalAlpha=fillA;cx.fill();}
    if(strokeOn){
      cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth;
      cx.globalAlpha=strokeA;applyStroke();cx.stroke();
    }
  }else if(o.type==="line"){
    cx.beginPath();cx.moveTo(-hw,-hh);cx.lineTo(hw,hh);
    cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth||1;
    cx.globalAlpha=strokeA;applyStroke();cx.stroke();
  }else if(o.type==="pencil"||o.type==="brush"){
    if(o.points&&o.points.length>1){
      // points are object-local (relative to top-left); cx sits at the centre
      cx.beginPath();cx.moveTo(o.points[0]-hw,o.points[1]-hh);
      for(var pi=2;pi<o.points.length;pi+=2){
        cx.lineTo(o.points[pi]-hw,o.points[pi+1]-hh);
      }
      if(o.type==="brush"){
        cx.strokeStyle=o.fillColor;cx.lineWidth=(o.strokeWidth||1)*3;
        cx.lineCap="round";cx.lineJoin="round";cx.setLineDash([]);
      }else{
        cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth||1;applyStroke();
      }
      cx.globalAlpha=strokeA;cx.stroke();
    }
  }else if(o.type==="text"){
    cx.font=(o.fontItalic?"italic ":"")+(o.fontBold?"bold ":"")+(o.fontSize||24)+"px "+(o.font||"Arial");
    cx.fillStyle=o.fillColor;
    cx.globalAlpha=fillA;cx.textBaseline="top";
    cx.textAlign=o.textAlign||"left";
    var tx=-hw;if(o.textAlign==="center")tx=0;else if(o.textAlign==="right")tx=hw;
    var lines=String(o.text==null||o.text===""?"Text":o.text).split("\n");
    var lh=(o.lineHeight||1.2)*(o.fontSize||24);
    for(var li=0;li<lines.length;li++){
      cx.fillText(lines[li],tx,-hh+li*lh);
      if(o.fontUnderline){
        var m=cx.measureText(lines[li]);
        cx.save();cx.strokeStyle=o.fillColor;cx.lineWidth=1;
        cx.beginPath();
        var ux=tx;if(o.textAlign==="center")ux=tx-m.width/2;else if(o.textAlign==="right")ux=tx-m.width;
        cx.moveTo(ux,-hh+li*lh+(o.fontSize||24)+1);cx.lineTo(ux+m.width,-hh+li*lh+(o.fontSize||24)+1);
        cx.stroke();cx.restore();
      }
    }
    cx.textAlign="start";
  }else if(o.type==="symbol"){
    var sym=doc.library[o.symbolName];
    if(sym&&depth<SYMBOL_MAX_DEPTH){
      // A Graphic instance tracks the parent playhead; frameObjects() stamps
      // the timing context onto the view object it hands us.
      var symObjs=symbolFrameObjects(sym,symbolDisplayFrame(o,sym,o._parentFrame||1,o._startFrame||1));
      if(symObjs.length){
        // Children are positioned in symbol space, whose origin is the
        // instance's top-left — shift there from the centre.
        cx.save();
        cx.translate(-hw,-hh);
        for(var si=0;si<symObjs.length;si++){
          paintObj(cx,symObjs[si],{chrome:chrome,depth:depth+1});
        }
        cx.restore();
      }else if(chrome){
        cx.fillStyle="#CCCCFF";cx.globalAlpha=alpha*0.3;
        cx.fillRect(-hw,-hh,o.width,o.height);
        cx.strokeStyle="#6666CC";cx.lineWidth=1;cx.globalAlpha=alpha;
        cx.strokeRect(-hw,-hh,o.width,o.height);
      }
      if(chrome){
        cx.globalAlpha=alpha*0.4;
        cx.fillStyle="#88f";cx.font="9px Arial";cx.textBaseline="top";cx.textAlign="center";
        cx.fillText(o.symbolName||"Symbol",0,hh+2);
        cx.textAlign="start";
      }
    }else if(chrome){
      // Missing (or impossibly nested) symbol reference
      cx.fillStyle="#FF6666";cx.globalAlpha=alpha*0.5;
      cx.fillRect(-hw,-hh,o.width,o.height);
      cx.strokeStyle="#CC3333";cx.lineWidth=1;cx.globalAlpha=alpha;
      cx.strokeRect(-hw,-hh,o.width,o.height);
      cx.fillStyle="#fff";cx.font="9px Arial";cx.textBaseline="middle";cx.textAlign="center";
      cx.fillText("Missing: "+(o.symbolName||"?"),0,0);
      cx.textAlign="start";
    }
  }
  cx.restore();
}

// The stage draws with authoring chrome; everything else goes through paintObj
// directly with chrome off.
function renderObj(o){paintObj(ctx,o,{chrome:true});}

/* ------------------------------------------------------------------ *
 * Tween interpolation
 *
 * `t` is always (frame - keyframe.index) / keyframe.duration, so the frame
 * holding the NEXT keyframe is the one that shows the destination exactly —
 * the same rule Flash used. The exporters used to divide by duration-1, which
 * made every tween arrive one frame early and then sit on the destination for
 * two frames; with one interpolator there is one answer.
 * ------------------------------------------------------------------ */
function easeAmount(t,easing){
  t=Math.max(0,Math.min(1,t));
  if(typeof Flashy!=="undefined"&&Flashy.Easing&&Flashy.Easing[easing])return Flashy.Easing[easing](t);
  if(easing==="easeIn"||easing==="quadIn")return t*t;
  if(easing==="easeOut"||easing==="quadOut")return 1-(1-t)*(1-t);
  if(easing==="easeInOut"||easing==="quadInOut")return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  return t;
}
function interpObj(a,b,t,easing){
  var e=easeAmount(t,easing);
  var tmp=a.clone();
  var lerp=function(k,dflt){
    var av=a[k]!=null?a[k]:dflt,bv=b[k]!=null?b[k]:dflt;
    return av+(bv-av)*e;
  };
  tmp.x=lerp("x",0);tmp.y=lerp("y",0);
  tmp.width=lerp("width",0);tmp.height=lerp("height",0);
  tmp.rotation=lerp("rotation",0);
  tmp.scaleX=lerp("scaleX",1);tmp.scaleY=lerp("scaleY",1);
  tmp.alpha=lerp("alpha",1);
  return tmp;
}

/**
 * Every object visible at `frame`, bottom layer first, with tweens already
 * resolved. The stage, the raster exporter and the SVG exporter all read the
 * document through this one function, so they cannot disagree about what a
 * frame contains.
 */
function frameObjects(layers,frame){
  var out=[];
  for(var i=(layers||[]).length-1;i>=0;i--){
    var l=layers[i];
    if(!l||l.visible===false)continue;
    var kf=typeof l.getKeyframeAt==="function"?l.getKeyframeAt(frame):null;
    if(!kf)continue;
    if(kf.tweenType&&kf.tweenType!=="none"&&kf.duration>1){
      var nk=l.keyframes[l.keyframes.indexOf(kf)+1];
      if(nk){
        var t=(frame-kf.index)/kf.duration;
        for(var oi=0;oi<kf.objects.length;oi++){
          var b=nk.objects[oi];
          out.push(withTiming(b?interpObj(kf.objects[oi],b,t,kf.easing):kf.objects[oi],kf,frame));
        }
        continue;
      }
    }
    for(var oj=0;oj<kf.objects.length;oj++)out.push(withTiming(kf.objects[oj],kf,frame));
  }
  return out;
}

/**
 * Tag a symbol instance with the timing a Graphic needs — which frame of the
 * parent we are on, and the frame its keyframe started.
 *
 * `Object.create` rather than a clone: the view inherits every property and
 * adds two of its own, so this costs nothing per frame and leaves the real
 * document object untouched. Only symbols need it; everything else is passed
 * through as-is.
 */
function withTiming(o,kf,frame){
  if(!o||o.type!=="symbol")return o;
  var view=Object.create(o);
  view._startFrame=kf.index;
  view._parentFrame=frame;
  return view;
}

// === drawSel / drawPrev ===
function drawSel(o){
  var p1=s2c(o.x,o.y),p2=s2c(o.x+o.width,o.y+o.height);
  ctx.save();
  ctx.strokeStyle="#0066FF";ctx.lineWidth=1;
  ctx.setLineDash([4,3]);
  ctx.strokeRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);
  ctx.setLineDash([]);
  // handles
  var hs=5;
  ctx.fillStyle="#FFFFFF";ctx.strokeStyle="#0066FF";ctx.lineWidth=1;
  var pts=[[p1.x,p1.y],[p2.x,p1.y],[p1.x,p2.y],[p2.x,p2.y],
           [(p1.x+p2.x)/2,p1.y],[(p1.x+p2.x)/2,p2.y],
           [p1.x,(p1.y+p2.y)/2],[p2.x,(p1.y+p2.y)/2]];
  pts.forEach(function(pt){
    ctx.fillRect(pt[0]-hs/2,pt[1]-hs/2,hs,hs);
    ctx.strokeRect(pt[0]-hs/2,pt[1]-hs/2,hs,hs);
  });
  ctx.restore();
}

var dragging=false,dragPreview=null,dragStart=null,dragCur=null;

function drawPrev(){
  if(!dragPreview)return;
  ctx.save();
  var p=dragPreview;
  if(p.type==="rect"||p.type==="oval"||p.type==="line"||p.type==="text"){
    var p1=s2c(Math.min(p.x1,p.x2),Math.min(p.y1,p.y2));
    var p2=s2c(Math.max(p.x1,p.x2),Math.max(p.y1,p.y2));
    ctx.strokeStyle="#0066FF";ctx.lineWidth=1;ctx.setLineDash([3,3]);
    if(p.type==="oval"){
      ctx.beginPath();
      ctx.ellipse((p1.x+p2.x)/2,(p1.y+p2.y)/2,Math.abs(p2.x-p1.x)/2,Math.abs(p2.y-p1.y)/2,0,0,Math.PI*2);
      ctx.stroke();
    }else if(p.type==="line"){
      var lp1=s2c(p.x1,p.y1),lp2=s2c(p.x2,p.y2);
      ctx.beginPath();ctx.moveTo(lp1.x,lp1.y);ctx.lineTo(lp2.x,lp2.y);ctx.stroke();
    }else{
      ctx.strokeRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);
    }
    ctx.setLineDash([]);
  }else if(p.type==="pencil"||p.type==="brush"){
    if(p.points&&p.points.length>1){
      ctx.beginPath();
      var fp=s2c(p.points[0],p.points[1]);
      ctx.moveTo(fp.x,fp.y);
      for(var i=2;i<p.points.length;i+=2){
        var cp=s2c(p.points[i],p.points[i+1]);
        ctx.lineTo(cp.x,cp.y);
      }
      ctx.strokeStyle=p.type==="brush"?fillColor:strokeColor;
      ctx.lineWidth=(p.type==="brush"?strokeWidth*3:strokeWidth)*zoom;
      ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
    }
  }else if(p.type==="select"){
    var sp1=s2c(Math.min(p.x1,p.x2),Math.min(p.y1,p.y2));
    var sp2=s2c(Math.max(p.x1,p.x2),Math.max(p.y1,p.y2));
    ctx.strokeStyle="#0066FF";ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.strokeRect(sp1.x,sp1.y,sp2.x-sp1.x,sp2.y-sp1.y);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// === Mouse handlers ===
/**
 * Stage input.
 *
 * Pointer Events, not mouse events: these cover mouse, pen and touch with one
 * code path, so the editor is actually usable on a tablet. With mouse events
 * only, you could not draw a single line on an iPad.
 *
 * setPointerCapture means a drag that leaves the canvas still delivers its
 * move and up events here, so strokes no longer get stranded mid-drag when the
 * pointer crosses into a panel.
 */
function initMouse(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  // Stops the browser scrolling/zooming the page out from under a stroke.
  canvas.style.touchAction="none";
  canvas.addEventListener("pointerdown",function(e){
    // Secondary buttons are the context menu's business, not the tools'.
    if(e.button&&e.button!==0)return;
    if(canvas.setPointerCapture){
      try{canvas.setPointerCapture(e.pointerId);}catch(err){/* non-fatal */}
    }
    onMouseDown(e);
  });
  canvas.addEventListener("pointermove",onMouseMove);
  canvas.addEventListener("pointerup",onMouseUp);
  // A cancelled pointer (OS gesture, palm rejection) must not leave `dragging`
  // stuck true — that would make the next click continue the abandoned drag.
  canvas.addEventListener("pointercancel",function(e){
    dragging=false;dragPreview=null;moveObjStarts=[];movePreSnap=null;
    render();
  });
  canvas.addEventListener("dblclick",onDblClick);
  canvas.addEventListener("wheel",onWheel,{passive:false});
  canvas.addEventListener("contextmenu",function(e){e.preventDefault();showCtx(e);});
}
function getStagePos(e){
  var r=canvas.getBoundingClientRect();
  return s2s(e.clientX-r.left,e.clientY-r.top);
}
function hitTest(x,y){
  var kf=CKF();if(!kf)return null;
  for(var i=kf.objects.length-1;i>=0;i--){
    var o=kf.objects[i];
    // width/height can be negative (e.g. a line dragged up/left)
    var x0=Math.min(o.x,o.x+o.width),x1=Math.max(o.x,o.x+o.width);
    var y0=Math.min(o.y,o.y+o.height),y1=Math.max(o.y,o.y+o.height);
    if(x>=x0&&x<=x1&&y>=y0&&y<=y1)return o;
  }
  return null;
}
var moveStartX=0,moveStartY=0,moveObjStarts=[],movePreSnap=null;
function onDblClick(e){
  if(curTool!=="select")return;
  var p=getStagePos(e);
  var hit=hitTest(p.x,p.y);
  if(hit&&hit.type==="symbol"&&hit.symbolName&&doc.library[hit.symbolName]){
    enterSymbol(hit.symbolName);
  }
}
function onMouseDown(e){
  if(e.button===2)return;
  var p=getStagePos(e);
  dragging=true;dragStart={x:p.x,y:p.y};dragCur={x:p.x,y:p.y};
  if(curTool==="select"){
    var hit=hitTest(p.x,p.y);
    if(hit){
      if(e.shiftKey){
        var idx=selection.indexOf(hit);
        if(idx>=0)selection.splice(idx,1);else selection.push(hit);
      }else if(selection.indexOf(hit)<0){
        selection=[hit];
      }
      moveStartX=p.x;moveStartY=p.y;
      moveObjStarts=selection.map(function(o){return{x:o.x,y:o.y};});
      movePreSnap=snap(); // capture BEFORE the drag so undo restores the pre-move state
      dragPreview=null;
    }else{
      selection=[];
      dragPreview={type:"select",x1:p.x,y1:p.y,x2:p.x,y2:p.y};
    }
    updateProps();render();
  }else if(curTool==="rect"||curTool==="oval"||curTool==="line"){
    dragPreview={type:curTool,x1:p.x,y1:p.y,x2:p.x,y2:p.y};
  }else if(curTool==="pencil"||curTool==="brush"){
    dragPreview={type:curTool,points:[p.x,p.y]};
  }else if(curTool==="text"){
    dragPreview={type:"text",x1:p.x,y1:p.y,x2:p.x,y2:p.y};
  }else if(curTool==="hand"){
    dragPreview=null;moveStartX=e.clientX;moveStartY=e.clientY;
  }else if(curTool==="zoom"){
    if(e.shiftKey||e.altKey){zoom=Math.max(0.1,zoom/1.5);}
    else{zoom=Math.min(10,zoom*1.5);}
    updateZoomUI();render();dragging=false;
  }else if(curTool==="bucket"){
    var hit4=hitTest(p.x,p.y);
    if(hit4){
      pushUndo();
      hit4.fillColor=fillColor;
      hit4.fillAlpha=fillAlpha;
      hit4.fillType="solid";
      selection=[hit4];
      render();updateProps();
    }
    dragging=false;
  }else if(curTool==="eyedrop"){
    var hit2=hitTest(p.x,p.y);
    if(hit2){fillColor=hit2.fillColor;strokeColor=hit2.strokeColor;strokeWidth=hit2.strokeWidth;updateColorUI();}
    dragging=false;
  }else if(curTool==="transform"){
    var hit3=hitTest(p.x,p.y);
    if(hit3){selection=[hit3];updateProps();render();}
    dragPreview=null;
  }
}
function onMouseMove(e){
  if(!dragging)return;
  var p=getStagePos(e);
  dragCur={x:p.x,y:p.y};
  if(curTool==="select"){
    if(dragPreview&&dragPreview.type==="select"){
      dragPreview.x2=p.x;dragPreview.y2=p.y;
    }else if(selection.length>0&&moveObjStarts.length>0){
      var dx=p.x-moveStartX,dy=p.y-moveStartY;
      for(var i=0;i<selection.length;i++){
        selection[i].x=moveObjStarts[i].x+dx;
        selection[i].y=moveObjStarts[i].y+dy;
        if(snapGrid){
          selection[i].x=Math.round(selection[i].x/gridSize)*gridSize;
          selection[i].y=Math.round(selection[i].y/gridSize)*gridSize;
        }
      }
    }
  }else if(curTool==="rect"||curTool==="oval"||curTool==="line"||curTool==="text"){
    if(dragPreview){dragPreview.x2=p.x;dragPreview.y2=p.y;}
  }else if(curTool==="pencil"||curTool==="brush"){
    if(dragPreview&&dragPreview.points){dragPreview.points.push(p.x,p.y);}
  }else if(curTool==="hand"){
    panX+=e.clientX-moveStartX;panY+=e.clientY-moveStartY;
    moveStartX=e.clientX;moveStartY=e.clientY;
  }
  render();
}
function onMouseUp(e){
  if(!dragging)return;
  dragging=false;
  var p=getStagePos(e);
  if(curTool==="select"){
    if(dragPreview&&dragPreview.type==="select"){
      // marquee select
      var kf=CKF();
      if(kf){
        var x1=Math.min(dragPreview.x1,dragPreview.x2),y1=Math.min(dragPreview.y1,dragPreview.y2);
        var x2=Math.max(dragPreview.x1,dragPreview.x2),y2=Math.max(dragPreview.y1,dragPreview.y2);
        selection=kf.objects.filter(function(o){
          var ox0=Math.min(o.x,o.x+o.width),ox1=Math.max(o.x,o.x+o.width);
          var oy0=Math.min(o.y,o.y+o.height),oy1=Math.max(o.y,o.y+o.height);
          return ox1>x1&&ox0<x2&&oy1>y1&&oy0<y2;
        });
      }
      dragPreview=null;
    }else if(selection.length>0&&moveObjStarts.length>0){
      var movedAny=selection.some(function(o,i){
        return moveObjStarts[i]&&(o.x!==moveObjStarts[i].x||o.y!==moveObjStarts[i].y);
      });
      if(movedAny&&movePreSnap)pushUndoSnap(movePreSnap);
      moveObjStarts=[];movePreSnap=null;
    }
    updateProps();
  }else if(curTool==="rect"||curTool==="oval"||curTool==="line"){
    if(dragPreview){
      pushUndo();
      var kf2=CKF();if(!kf2){var l=CL();if(l){kf2=l.insertKeyframe(curFrame);}}
      if(kf2){
        var obj=new EditorObject(curTool);
        if(curTool==="line"){
          obj.x=dragPreview.x1;obj.y=dragPreview.y1;
          obj.width=dragPreview.x2-dragPreview.x1;obj.height=dragPreview.y2-dragPreview.y1;
        }else{
          obj.x=Math.min(dragPreview.x1,dragPreview.x2);
          obj.y=Math.min(dragPreview.y1,dragPreview.y2);
          obj.width=Math.abs(dragPreview.x2-dragPreview.x1);
          obj.height=Math.abs(dragPreview.y2-dragPreview.y1);
        }
        obj.fillColor=fillColor;obj.fillAlpha=fillAlpha;
        obj.strokeColor=strokeColor;obj.strokeAlpha=strokeAlpha;
        obj.strokeWidth=strokeWidth;
        kf2.objects.push(obj);
        selection=[obj];
      }
      dragPreview=null;
    }
  }else if(curTool==="pencil"||curTool==="brush"){
    if(dragPreview&&dragPreview.points&&dragPreview.points.length>2){
      pushUndo();
      var kf3=CKF();if(!kf3){var l2=CL();if(l2){kf3=l2.insertKeyframe(curFrame);}}
      if(kf3){
        var pts=dragPreview.points;
        var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(var pi=0;pi<pts.length;pi+=2){
          if(pts[pi]<minX)minX=pts[pi];if(pts[pi]>maxX)maxX=pts[pi];
          if(pts[pi+1]<minY)minY=pts[pi+1];if(pts[pi+1]>maxY)maxY=pts[pi+1];
        }
        var obj2=new EditorObject(curTool);
        obj2.x=minX;obj2.y=minY;obj2.width=maxX-minX||1;obj2.height=maxY-minY||1;
        // store points relative to top-left so the object can be moved/exported
        obj2.points=pts.map(function(v,i){return i%2===0?v-minX:v-minY;});
        obj2.fillColor=fillColor;obj2.strokeColor=strokeColor;obj2.strokeWidth=strokeWidth;
        kf3.objects.push(obj2);selection=[obj2];
      }
    }
    dragPreview=null;
  }else if(curTool==="text"){
    if(dragPreview){
      // Captured before the dialog, because dragPreview is cleared below and
      // the dialog answers asynchronously.
      var box={x1:dragPreview.x1,y1:dragPreview.y1,x2:dragPreview.x2,y2:dragPreview.y2};
      askFor("Text","Text","Text",function(txt){
        if(!txt)return;
        pushUndo();
        var kf4=CKF();if(!kf4){var l3=CL();if(l3){kf4=l3.insertKeyframe(curFrame);}}
        if(kf4){
          var obj3=new EditorObject("text");
          obj3.x=Math.min(box.x1,box.x2);
          obj3.y=Math.min(box.y1,box.y2);
          obj3.width=Math.max(80,Math.abs(box.x2-box.x1));
          obj3.height=Math.max(30,Math.abs(box.y2-box.y1));
          obj3.text=txt;obj3.fillColor=fillColor;obj3.fontSize=24;
          kf4.objects.push(obj3);selection=[obj3];
        }
        // The dialog answers after onMouseUp has returned, so redraw here.
        fullRefresh();
      });
      dragPreview=null;
    }
  }
  render();fullRefresh();
}
function onWheel(e){
  e.preventDefault();
  if(e.ctrlKey){
    var d=e.deltaY<0?1.1:0.9;
    zoom=Math.max(0.1,Math.min(10,zoom*d));
    updateZoomUI();
  }else{
    panX-=e.deltaX;panY-=e.deltaY;
  }
  render();
}
function updateZoomUI(){
  var sel=document.getElementById("zoomSelect");
  if(sel)sel.value=zoom;
}

// === Timeline ===
var tlCanvas,tlCtx;
function updateTL(){
  updateLayers();
  renderTLFrames();
  updatePH();
  var fi=document.getElementById("frameInput");
  if(fi)fi.value=curFrame;
}
function updateLayers(){
  var lp=document.getElementById("layerList");
  if(!lp)return;
  lp.textContent="";
  var layers=currentLayers();
  var dragLayerIdx=-1;
  layers.forEach(function(l,i){
    var row=document.createElement("div");
    row.className="layer-row"+(i===curLayer?" active":"");
    row.style.height=TL_FH+"px";
    row.draggable=true;
    row.dataset.layerIdx=i;
    // Drag to reorder
    row.addEventListener("dragstart",function(ev){
      dragLayerIdx=i;
      ev.dataTransfer.effectAllowed="move";
      row.style.opacity="0.5";
    });
    row.addEventListener("dragend",function(){row.style.opacity="1";});
    row.addEventListener("dragover",function(ev){
      ev.preventDefault();ev.dataTransfer.dropEffect="move";
      row.style.borderTop=parseInt(row.dataset.layerIdx)<dragLayerIdx?"2px solid #4488CC":"";
      row.style.borderBottom=parseInt(row.dataset.layerIdx)>dragLayerIdx?"2px solid #4488CC":"";
    });
    row.addEventListener("dragleave",function(){row.style.borderTop="";row.style.borderBottom="";});
    row.addEventListener("drop",function(ev){
      ev.preventDefault();
      row.style.borderTop="";row.style.borderBottom="";
      var targetIdx=parseInt(row.dataset.layerIdx);
      if(dragLayerIdx>=0&&dragLayerIdx!==targetIdx){
        pushUndo();
        var moved=layers.splice(dragLayerIdx,1)[0];
        layers.splice(targetIdx,0,moved);
        curLayer=targetIdx;
        fullRefresh();
      }
      dragLayerIdx=-1;
    });
    var nameSpan=document.createElement("span");
    nameSpan.className="layer-name";
    nameSpan.textContent=l.name;
    nameSpan.addEventListener("dblclick",function(ev){
      ev.stopPropagation();
      askFor("Rename Layer","Name",l.name,function(nn){
        if(!nn)return;
        pushUndo();l.name=nn;updateTL();
      });
    });
    row.appendChild(nameSpan);
    var visBtn=document.createElement("button");
    visBtn.className="layer-btn";
    visBtn.textContent=l.visible?"\u25C9":"\u25CE";
    visBtn.title="Toggle visibility";
    visBtn.addEventListener("click",function(e){e.stopPropagation();l.visible=!l.visible;fullRefresh();});
    row.appendChild(visBtn);
    var lockBtn=document.createElement("button");
    lockBtn.className="layer-btn";
    lockBtn.textContent=l.locked?"\u25A0":"\u25A1";
    lockBtn.title="Toggle lock";
    lockBtn.addEventListener("click",function(e){e.stopPropagation();l.locked=!l.locked;fullRefresh();});
    row.appendChild(lockBtn);
    row.addEventListener("click",function(){
      curLayer=i;
      var layer=currentLayers()[i];
      var kf=layer?layer.getKeyframeAt(curFrame):null;
      selectedKF=kf?{layerIdx:i,frameIdx:kf.index,kf:kf}:null;
      selection=[];fullRefresh();
    });
    lp.appendChild(row);
  });
  // Layer management buttons bar
  var btnBar=document.createElement("div");
  btnBar.style.cssText="display:flex;gap:2px;padding:3px 4px;background:#333;border-top:1px solid #444;";
  var addBtn=document.createElement("button");
  addBtn.style.cssText="flex:1;height:18px;background:linear-gradient(to bottom,#555,#444);border:1px solid #666;border-bottom-color:#333;color:#DDD;cursor:pointer;font-size:10px;border-radius:2px;display:flex;align-items:center;justify-content:center;gap:2px;";
  addBtn.title="Add Layer";
  var plusSpan=document.createElement("span");plusSpan.textContent="+";plusSpan.style.cssText="font-size:14px;font-weight:bold;line-height:1;";
  addBtn.appendChild(plusSpan);
  var addTxt=document.createElement("span");addTxt.textContent="Layer";addBtn.appendChild(addTxt);
  addBtn.addEventListener("click",function(){doAction("addLayer");});
  btnBar.appendChild(addBtn);
  var delBtn=document.createElement("button");
  delBtn.style.cssText="width:22px;height:18px;background:linear-gradient(to bottom,#555,#444);border:1px solid #666;border-bottom-color:#333;color:#DDD;cursor:pointer;font-size:12px;border-radius:2px;display:flex;align-items:center;justify-content:center;";
  delBtn.title="Delete Layer";delBtn.textContent="\u2212";
  delBtn.addEventListener("click",function(){doAction("delLayer");});
  btnBar.appendChild(delBtn);
  var dupBtn=document.createElement("button");
  dupBtn.style.cssText="width:22px;height:18px;background:linear-gradient(to bottom,#555,#444);border:1px solid #666;border-bottom-color:#333;color:#DDD;cursor:pointer;font-size:10px;border-radius:2px;display:flex;align-items:center;justify-content:center;";
  dupBtn.title="Duplicate Layer";dupBtn.textContent="\u29C9";
  dupBtn.addEventListener("click",function(){
    pushUndo();var layers=currentLayers();var src=layers[curLayer];if(!src)return;
    var dup=new Layer(src.name+" copy");dup.visible=src.visible;dup.locked=false;
    dup.keyframes=src.keyframes.map(function(k){return k.clone();});
    layers.splice(curLayer,0,dup);fullRefresh();
  });
  btnBar.appendChild(dupBtn);
  lp.appendChild(btnBar);
}
/* ------------------------------------------------------------------ *
 * Timeline geometry and virtual scrolling
 *
 * The timeline used to size one canvas to the WHOLE movie: 12px per frame,
 * so a five-minute soundtrack (7,200 frames) asked for an 86,000px canvas.
 * That is past Chromium's 65,535px limit, so the canvas silently stopped
 * painting and the timeline became a blank area you could still click and
 * hear audio through. Even well under the limit it meant tens of thousands
 * of pixels of scrolling and a full repaint of every frame on every change.
 *
 * Now the canvas is only ever the size of the visible area and draws just
 * the columns in view, offset by the scroll position. A spacer element
 * carries the real width so native scrollbars still work. As a consequence
 * the timeline is also zoomable — which is what actually makes a long
 * soundtrack workable, because you can see the whole thing at once.
 * ------------------------------------------------------------------ */
var TL_FH=20,TL_HDR=16;
// Sub-pixel steps matter: a five-minute soundtrack is 7,200 frames, and at a
// 1px floor "Fit" could not actually fit it. Below 1px/frame the individual
// frame cells stop being meaningful, but the waveform band still shows its
// shape — which is the whole point of zooming out on a dialogue track.
var TL_ZOOMS=[0.25,0.5,1,2,3,4,6,8,12,16,24,32];
var tlZoomIdx=TL_ZOOMS.indexOf(12);
/** Pixels per frame at the current timeline zoom. */
function TL_FW_(){return TL_ZOOMS[tlZoomIdx];}
function tlSetZoom(idx,keepFrame){
  idx=Math.max(0,Math.min(TL_ZOOMS.length-1,idx));
  if(idx===tlZoomIdx)return;
  tlZoomIdx=idx;
  renderTLFrames();
  if(keepFrame!==false)tlScrollToFrame(curFrame);
  var lbl=document.getElementById("tlZoomLabel");
  if(lbl)lbl.textContent=tlZoomText();
}
/** Zoom level as shown in the header: px/frame, or frames/px below 1. */
function tlZoomText(){
  var fw=TL_FW_();
  return fw>=1?fw+"px":"1/"+Math.round(1/fw);
}
/** Zoom so the whole movie fits the visible width. */
function tlZoomFit(){
  var wrap=document.getElementById("tl-frames");
  if(!wrap)return;
  var need=Math.max(1,currentMaxFrame()+5);
  var want=wrap.clientWidth/need;
  var idx=0;
  for(var i=0;i<TL_ZOOMS.length;i++)if(TL_ZOOMS[i]<=want)idx=i;
  tlSetZoom(idx,false);
  wrap.scrollLeft=0;
}
/** Keep a frame in view — used after zooming and while playing. */
function tlScrollToFrame(f){
  var wrap=document.getElementById("tl-frames");
  if(!wrap)return;
  var fw=TL_FW_();
  var x=(f-1)*fw;
  var pad=fw*4;
  if(x<wrap.scrollLeft+pad)wrap.scrollLeft=Math.max(0,x-pad);
  else if(x>wrap.scrollLeft+wrap.clientWidth-pad)wrap.scrollLeft=x-wrap.clientWidth+pad;
}
function renderTLFrames(){
  tlCanvas=document.getElementById("tlCanvas");
  if(!tlCanvas)return;
  var wrap=document.getElementById("tl-frames");
  var spacer=document.getElementById("tl-spacer");
  if(!wrap||!spacer)return;
  var layers=currentLayers();
  var fw=TL_FW_(),fh=TL_FH;
  var maxF=currentMaxFrame()+10;
  var totalW=maxF*fw;
  var totalH=TL_HDR+layers.length*fh;

  // The spacer carries the real extent so native scrollbars behave; the
  // canvas is only ever viewport-sized, which is what keeps a long movie
  // from blowing past the browser's maximum canvas dimension.
  spacer.style.width=totalW+"px";
  spacer.style.height=Math.max(totalH,wrap.clientHeight)+"px";

  var vw=Math.max(1,wrap.clientWidth),vh=Math.max(1,wrap.clientHeight);
  var dpr=window.devicePixelRatio||1;
  if(tlCanvas.width!==Math.round(vw*dpr)||tlCanvas.height!==Math.round(vh*dpr)){
    tlCanvas.width=Math.round(vw*dpr);
    tlCanvas.height=Math.round(vh*dpr);
  }
  tlCanvas.style.width=vw+"px";
  tlCanvas.style.height=vh+"px";
  tlCtx=tlCanvas.getContext("2d");

  var sx=wrap.scrollLeft,sy=wrap.scrollTop;
  tlCtx.setTransform(dpr,0,0,dpr,0,0);
  tlCtx.clearRect(0,0,vw,vh);
  // Everything below draws in content coordinates.
  tlCtx.translate(-sx,-sy);
  // Visible column range, with one column of slack either side.
  var firstF=Math.max(1,Math.floor(sx/fw));
  var lastF=Math.min(maxF,Math.ceil((sx+vw)/fw)+1);
  var right=sx+vw,bottom=sy+vh;

  // header bar — sticky to the top of the viewport
  tlCtx.fillStyle="#3A3A3A";
  tlCtx.fillRect(sx,sy,vw,TL_HDR);
  tlCtx.fillStyle="#888";
  tlCtx.font="9px Tahoma,Arial,sans-serif";
  // Label every 5 frames while there is room, thinning out as you zoom out.
  var every=fw>=12?5:(fw>=6?10:(fw>=3?25:(fw>=1?50:(fw>=0.5?250:500))));
  for(var f=firstF;f<=lastF;f++){
    var fx=(f-1)*fw;
    if(f%every===0||f===1)tlCtx.fillText(f,fx+2,sy+11);
    if(f%every===0){
      tlCtx.strokeStyle="#555";tlCtx.lineWidth=0.5;
      tlCtx.beginPath();tlCtx.moveTo(fx+fw,sy+TL_HDR);tlCtx.lineTo(fx+fw,bottom);tlCtx.stroke();
    }
  }
  tlCtx.strokeStyle="#444";tlCtx.lineWidth=1;
  tlCtx.beginPath();tlCtx.moveTo(sx,sy+TL_HDR);tlCtx.lineTo(right,sy+TL_HDR);tlCtx.stroke();
  // frames per layer
  layers.forEach(function(l,li){
    var y=TL_HDR+li*fh;
    // Rows scrolled out of view cost nothing.
    if(y+fh<sy||y>bottom)return;
    // background for entire layer row
    tlCtx.fillStyle=li===curLayer?"#333":"#2C2C2C";
    tlCtx.fillRect(sx,y,vw,fh);
    l.keyframes.forEach(function(kf){
      // Clip the span to what is on screen: a keyframe can be thousands of
      // frames long once it carries a soundtrack.
      var from=Math.max(0,firstF-kf.index);
      var to=Math.min(kf.duration,lastF-kf.index+1);
      if(to<=from)return;
      for(var d=from;d<to;d++){
        var x=(kf.index-1+d)*fw;
        var frameNum=kf.index+d;
        var isSelected=selectedKF&&selectedKF.layerIdx===li&&frameNum>=kf.index&&frameNum<kf.index+kf.duration&&d===0;
        if(d===0){
          // keyframe cell — bright colors for tween types like real Flash
          if(kf.tweenType==="motion"){
            tlCtx.fillStyle="#3D3D6B"; // purple-blue for motion tween
          }else if(kf.tweenType==="shape"){
            tlCtx.fillStyle="#3D5B3D"; // green for shape tween
          }else if(kf.objects.length>0){
            tlCtx.fillStyle="#555555"; // gray for static keyframe with content
          }else{
            tlCtx.fillStyle="#484848"; // lighter gray for empty keyframe (visible against bg)
          }
          tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
          // keyframe dot — filled for content, hollow for empty
          if(kf.objects.length>0){
            tlCtx.fillStyle="#EEE";
            tlCtx.beginPath();tlCtx.arc(x+fw/2,y+fh/2,2.5,0,Math.PI*2);tlCtx.fill();
          }else{
            tlCtx.strokeStyle="#888";tlCtx.lineWidth=1;
            tlCtx.beginPath();tlCtx.arc(x+fw/2,y+fh/2,2,0,Math.PI*2);tlCtx.stroke();
          }
          // selected keyframe highlight
          if(isSelected){
            tlCtx.strokeStyle="#66AAFF";tlCtx.lineWidth=2;
            tlCtx.strokeRect(x+1,y+1,fw-2,fh-2);
          }
        }else{
          // continuation frames — very distinct tween colors
          if(kf.tweenType==="motion"){
            tlCtx.fillStyle="#4444AA"; // bright purple-blue span
            tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
            // tween arrow
            tlCtx.strokeStyle="#8888DD";tlCtx.lineWidth=1;
            tlCtx.beginPath();tlCtx.moveTo(x,y+fh/2);tlCtx.lineTo(x+fw-1,y+fh/2);tlCtx.stroke();
            // small arrow head every 5 frames
            if(d%5===4){
              tlCtx.fillStyle="#8888DD";
              tlCtx.beginPath();tlCtx.moveTo(x+fw-1,y+fh/2-3);tlCtx.lineTo(x+fw+2,y+fh/2);tlCtx.lineTo(x+fw-1,y+fh/2+3);tlCtx.fill();
            }
          }else if(kf.tweenType==="shape"){
            tlCtx.fillStyle="#44AA44"; // bright green span
            tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
            tlCtx.strokeStyle="#88DD88";tlCtx.lineWidth=1;
            tlCtx.beginPath();tlCtx.moveTo(x,y+fh/2);tlCtx.lineTo(x+fw-1,y+fh/2);tlCtx.stroke();
          }else{
            tlCtx.fillStyle="#424242"; // no tween — visible gray
            tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
          }
        }
        // cell border
        tlCtx.strokeStyle="#222";tlCtx.lineWidth=0.3;
        tlCtx.strokeRect(x+0.5,y+0.5,fw-1,fh-1);
      }
      // end-of-span marker — vertical bar at the end of the keyframe span
      if(kf.duration>0){
        var ex=(kf.index-1+kf.duration-1)*fw+fw-2;
        tlCtx.fillStyle=kf.duration>1?"#AAA":"#666";
        tlCtx.fillRect(ex,y+2,2,fh-4);
      }
      if(kf.sound&&kf.sound.asset)drawWaveform(kf,y,fw,fh);
    });
    // layer separator line
    tlCtx.strokeStyle="#222";tlCtx.lineWidth=0.5;
    tlCtx.beginPath();tlCtx.moveTo(sx,y+fh);tlCtx.lineTo(right,y+fh);tlCtx.stroke();
  });
  // Frame range selection highlight
  if(tlSelRange&&tlSelRange.layerIdx>=0&&tlSelRange.layerIdx<layers.length){
    var rs=Math.min(tlSelRange.startFrame,tlSelRange.endFrame);
    var re=Math.max(tlSelRange.startFrame,tlSelRange.endFrame);
    var ry=TL_HDR+tlSelRange.layerIdx*fh;
    var rx=(rs-1)*fw;
    var rw=(re-rs+1)*fw;
    tlCtx.fillStyle="rgba(68,136,204,0.2)";
    tlCtx.fillRect(rx,ry,rw,fh);
    tlCtx.strokeStyle="rgba(68,136,204,0.6)";tlCtx.lineWidth=1;
    tlCtx.strokeRect(rx+0.5,ry+0.5,rw-1,fh-1);
  }
  // playhead
  var phx=(curFrame-1)*fw+fw/2;
  tlCtx.fillStyle="rgba(255,50,50,0.06)";
  tlCtx.fillRect((curFrame-1)*fw,sy+TL_HDR,fw,vh-TL_HDR);
  tlCtx.strokeStyle="rgba(255,50,50,0.7)";tlCtx.lineWidth=1.5;
  tlCtx.beginPath();tlCtx.moveTo(phx,sy);tlCtx.lineTo(phx,bottom);tlCtx.stroke();
  tlCtx.fillStyle="#FF3333";
  tlCtx.beginPath();tlCtx.moveTo(phx-5,sy);tlCtx.lineTo(phx+5,sy);tlCtx.lineTo(phx,sy+7);tlCtx.fill();
  tlCtx.setTransform(1,0,0,1,0,0);
}
/**
 * Draw a keyframe's sound as a waveform across the frames it occupies.
 *
 * This is the feature the whole audio layer exists for: you time a cut to a
 * drum hit or a mouth shape to a syllable by *looking* at the wave, not by
 * counting. One amplitude bucket per frame column, mirrored about the centre
 * line, clipped to the keyframe span.
 *
 * Until the asset has decoded there are no peaks, so a flat bar is drawn
 * instead — the sound's extent is still visible, and decodeAsset() triggers a
 * redraw when the real shape arrives.
 */
function drawWaveform(kf,y,fw,fh){
  var frames=Math.min(kf.duration,soundFrameLength(kf));
  if(frames<1)return;
  var x0=(kf.index-1)*fw;
  var w=frames*fw;
  var mid=y+fh/2;
  var maxA=(fh-5)/2;

  tlCtx.save();
  tlCtx.beginPath();
  tlCtx.rect(x0,y+1,w,fh-2);
  tlCtx.clip();

  // A filled band so a sound reads as a sound at any zoom, not as a row of
  // ordinary frames with some ticks in it.
  var grad=tlCtx.createLinearGradient(0,y,0,y+fh);
  grad.addColorStop(0,"rgba(58,104,78,0.95)");
  grad.addColorStop(1,"rgba(40,78,58,0.95)");
  tlCtx.fillStyle=grad;
  tlCtx.fillRect(x0,y+1,w,fh-2);

  var peaks=(typeof Flashy!=="undefined"&&Flashy.Sound)?Flashy.Sound.peaks(kf.sound.asset,Math.max(1,Math.round(w))):null;
  if(peaks){
    // One sample per PIXEL, not per frame: zoomed out, a frame is 1–2px and
    // a per-frame line loses the shape entirely.
    tlCtx.fillStyle="#9FE8B4";
    tlCtx.beginPath();
    for(var i=0;i<peaks.length;i++){
      var a=Math.max(0.5,peaks[i]*maxA);
      tlCtx.rect(x0+i,mid-a,1,a*2);
    }
    tlCtx.fill();
  }else{
    // Not decoded yet — show the extent, and say so.
    tlCtx.strokeStyle="rgba(159,232,180,0.5)";
    tlCtx.lineWidth=1;
    tlCtx.beginPath();tlCtx.moveTo(x0,mid);tlCtx.lineTo(x0+w,mid);tlCtx.stroke();
  }

  // Centre line and name, when the band is wide enough to read.
  tlCtx.strokeStyle="rgba(255,255,255,0.18)";
  tlCtx.lineWidth=1;
  tlCtx.beginPath();tlCtx.moveTo(x0,mid+0.5);tlCtx.lineTo(x0+w,mid+0.5);tlCtx.stroke();
  if(w>70){
    var label=kf.sound.asset+(kf.sound.sync==="event"?"  (event)":"");
    tlCtx.font="9px Tahoma,Arial,sans-serif";
    tlCtx.textBaseline="top";
    tlCtx.fillStyle="rgba(0,0,0,0.45)";
    var tw=tlCtx.measureText(label).width;
    tlCtx.fillRect(x0+3,y+2,tw+4,10);
    tlCtx.fillStyle="#DFF5E6";
    tlCtx.fillText(label,x0+5,y+2.5);
  }

  // Event sounds are not tied to the playhead, so they get a dashed edge.
  if(kf.sound.sync==="event"){
    tlCtx.strokeStyle="rgba(255,220,120,0.85)";
    tlCtx.setLineDash([3,2]);
    tlCtx.strokeRect(x0+0.5,y+1.5,w-1,fh-3);
    tlCtx.setLineDash([]);
  }else{
    tlCtx.strokeStyle="rgba(140,220,170,0.55)";
    tlCtx.strokeRect(x0+0.5,y+1.5,w-1,fh-3);
  }
  tlCtx.restore();
}

function updatePH(){
  var ph=document.getElementById("playhead");
  if(ph)ph.style.left=((curFrame-1)*TL_FW_())+'px';
}
var tlSelRange=null; // {layerIdx, startFrame, endFrame} for frame range selection
function initTLClicks(){
  var tc=document.getElementById("tlCanvas");
  if(!tc)return;
  var framesDiv=document.getElementById("tl-frames");
  var layersDiv=document.getElementById("tl-layers");
  if(framesDiv){
    var pending=false;
    framesDiv.addEventListener("scroll",function(){
      if(layersDiv)layersDiv.scrollTop=framesDiv.scrollTop;
      // The canvas only draws the visible columns, so scrolling must repaint
      // — coalesced to one redraw per frame.
      if(pending)return;
      pending=true;
      requestAnimationFrame(function(){pending=false;renderTLFrames();});
    },{passive:true});
    // Ctrl/Cmd + wheel zooms the timeline about the pointer, the way every
    // other timeline does. A five-minute soundtrack is unreadable otherwise.
    framesDiv.addEventListener("wheel",function(e){
      if(!(e.ctrlKey||e.metaKey))return;
      e.preventDefault();
      var r=framesDiv.getBoundingClientRect();
      var atFrame=(framesDiv.scrollLeft+(e.clientX-r.left))/TL_FW_();
      tlSetZoom(tlZoomIdx+(e.deltaY<0?1:-1),false);
      framesDiv.scrollLeft=Math.max(0,atFrame*TL_FW_()-(e.clientX-r.left));
      renderTLFrames();
    },{passive:false});
  }

  var zin=document.getElementById("tlZoomIn");
  var zout=document.getElementById("tlZoomOut");
  var zfit=document.getElementById("tlZoomFit");
  if(zin)zin.addEventListener("click",function(){tlSetZoom(tlZoomIdx+1);});
  if(zout)zout.addEventListener("click",function(){tlSetZoom(tlZoomIdx-1);});
  if(zfit)zfit.addEventListener("click",tlZoomFit);
  var zlbl=document.getElementById("tlZoomLabel");
  if(zlbl)zlbl.textContent=tlZoomText();

  /** Pointer position in timeline content coordinates. */
  function tlPos(e){
    var r=tc.getBoundingClientRect();
    return {
      x:e.clientX-r.left+(framesDiv?framesDiv.scrollLeft:0),
      y:e.clientY-r.top+(framesDiv?framesDiv.scrollTop:0)
    };
  }
  tc.addEventListener("mousedown",function(e){
    if(e.button===2)return; // right-click handled by contextmenu
    var pos=tlPos(e);
    var mx=pos.x,my=pos.y;
    var f=Math.max(1,Math.floor(mx/TL_FW_())+1);
    var li=Math.floor((my-TL_HDR)/TL_FH);
    var layers=currentLayers();
    if(li>=0&&li<layers.length)curLayer=li;
    curFrame=f;
    // Shift-click for range selection
    if(e.shiftKey&&tlSelRange&&tlSelRange.layerIdx===li){
      tlSelRange.endFrame=f;
    }else{
      tlSelRange={layerIdx:li,startFrame:f,endFrame:f};
    }
    // select keyframe
    if(li>=0&&li<layers.length){
      var layer=layers[li];
      var kf=layer.getKeyframeAt(f);
      if(kf)selectedKF={layerIdx:li,frameIdx:kf.index,kf:kf};
      else selectedKF=null;
    }else{
      selectedKF=null;
    }
    selection=[];
    fullRefresh();
    // Clicking the timeline is a user gesture, which is what the browser
    // wants before it will let any audio play.
    if(typeof Flashy!=="undefined"&&Flashy.Sound&&hasAudio())Flashy.Sound.unlock();
    audioScrub(curFrame);
    // scrub/range-drag
    function scrub(ev){
      var sf=Math.max(1,Math.floor(tlPos(ev).x/TL_FW_())+1);
      if(sf!==curFrame){
        curFrame=sf;
        if(tlSelRange)tlSelRange.endFrame=sf;
        var layer2=layers[curLayer];
        if(layer2){
          var kf2=layer2.getKeyframeAt(sf);
          if(kf2)selectedKF={layerIdx:curLayer,frameIdx:kf2.index,kf:kf2};
          else selectedKF=null;
        }
        audioScrub(sf);
        fullRefresh();
      }
    }
    function stopScrub(){
      document.removeEventListener("mousemove",scrub);
      document.removeEventListener("mouseup",stopScrub);
      endScrub();
    }
    document.addEventListener("mousemove",scrub);
    document.addEventListener("mouseup",stopScrub);
  });

  /* Drop an audio file anywhere on the timeline to import it onto the
     current keyframe — the gesture people try first. */
  tc.addEventListener("dragover",function(e){
    if(!e.dataTransfer)return;
    e.preventDefault();
    e.dataTransfer.dropEffect="copy";
    tc.classList.add("drop-audio");
  });
  tc.addEventListener("dragleave",function(){tc.classList.remove("drop-audio");});
  tc.addEventListener("drop",function(e){
    tc.classList.remove("drop-audio");
    var files=e.dataTransfer&&e.dataTransfer.files;
    if(!files||!files.length)return;
    e.preventDefault();
    // Drop position chooses the frame and layer the sound lands on.
    var pos=tlPos(e);
    var f=Math.max(1,Math.floor(pos.x/TL_FW_())+1);
    var li=Math.floor((pos.y-TL_HDR)/TL_FH);
    var layers=currentLayers();
    if(li>=0&&li<layers.length)curLayer=li;
    curFrame=f;
    importSoundFile(files[0]);
  });
  // Right-click context menu on timeline
  tc.addEventListener("contextmenu",function(e){
    e.preventDefault();
    var pos=tlPos(e);
    var f=Math.max(1,Math.floor(pos.x/TL_FW_())+1);
    var li=Math.floor((pos.y-TL_HDR)/TL_FH);
    var layers=currentLayers();
    if(li>=0&&li<layers.length)curLayer=li;
    curFrame=f;
    var rangeInfo="";
    if(tlSelRange){
      var s=Math.min(tlSelRange.startFrame,tlSelRange.endFrame);
      var en=Math.max(tlSelRange.startFrame,tlSelRange.endFrame);
      if(en>s)rangeInfo=" ("+s+"-"+en+")";
    }
    showTLContextMenu(e.clientX,e.clientY,[
      {label:"Insert Keyframe (F6)",action:function(){doAction("insKF");}},
      {label:"Insert Blank Keyframe (F7)",action:function(){doAction("insBlankKF");}},
      {label:"Insert Frame (F5)",action:function(){doAction("insFrame");}},
      {sep:true},
      {label:"Insert Frames"+rangeInfo,action:function(){
        pushUndo();var layer=layers[curLayer];if(!layer)return;
        var count=1;
        if(tlSelRange){
          var s2=Math.min(tlSelRange.startFrame,tlSelRange.endFrame);
          var e2=Math.max(tlSelRange.startFrame,tlSelRange.endFrame);
          count=e2-s2+1;
        }
        // Insert N frames at curFrame by extending the keyframe there
        var kfIns=layer.getKeyframeAt(curFrame);
        if(kfIns){
          kfIns.duration+=count;
          var idxIns=layer.keyframes.indexOf(kfIns);
          for(var ki=idxIns+1;ki<layer.keyframes.length;ki++){
            layer.keyframes[ki].index+=count;
          }
        }else{
          layer.extendToFrame(curFrame+count-1);
        }
        fullRefresh();
      }},
      {label:"Remove Frames"+rangeInfo,action:function(){
        pushUndo();var layer=layers[curLayer];if(!layer)return;
        if(tlSelRange){
          var s2=Math.min(tlSelRange.startFrame,tlSelRange.endFrame);
          var e2=Math.max(tlSelRange.startFrame,tlSelRange.endFrame);
          var count=e2-s2+1;
          for(var ff=0;ff<count;ff++){
            var kfr=layer.getKeyframeAt(s2);
            if(kfr&&kfr.duration>1)kfr.duration--;
          }
        }else{
          var kfr2=layer.getKeyframeAt(f);
          if(kfr2&&kfr2.duration>1)kfr2.duration--;
        }
        fullRefresh();
      }},
      {sep:true},
      {label:"Clear Keyframe",action:function(){doAction("removeKF");}},
      {sep:true},
      {label:"Create Motion Tween",action:function(){doAction("motionTween");}},
      {label:"Create Shape Tween",action:function(){
        pushUndo();var kft=selectedKF?selectedKF.kf:null;
        if(!kft){var l=layers[curLayer];if(l)kft=l.getKeyframeAt(f);}
        if(kft)kft.tweenType="shape";fullRefresh();
      }},
      {label:"Remove Tween",action:function(){doAction("removeTween");}},
      {sep:true},
      {label:"Select All Frames",action:function(){
        var layer=layers[curLayer];if(!layer)return;
        tlSelRange={layerIdx:curLayer,startFrame:1,endFrame:layer.getFrameEnd()};
        fullRefresh();
      }},
      {label:"Copy Frames",action:function(){
        // TODO: implement frame clipboard
        alert("Copy Frames: coming soon");
      }},
      {label:"Paste Frames",action:function(){
        alert("Paste Frames: coming soon");
      }}
    ]);
  });
}
function showTLContextMenu(x,y,items){
  var old=document.querySelector(".tl-ctx-menu");
  if(old)old.parentNode.removeChild(old);
  var menu=document.createElement("div");
  menu.className="ctx-menu tl-ctx-menu";
  menu.style.left=x+"px";menu.style.top=y+"px";
  items.forEach(function(it){
    if(it.sep){var s=document.createElement("div");s.className="ctx-sep";menu.appendChild(s);return;}
    var el=document.createElement("div");el.className="ctx-entry";el.textContent=it.label;
    el.addEventListener("click",function(){it.action();menu.parentNode.removeChild(menu);});
    menu.appendChild(el);
  });
  document.body.appendChild(menu);
  setTimeout(function(){
    document.addEventListener("click",function closeTLCtx(ev){
      if(!menu.contains(ev.target)){
        if(menu.parentNode)menu.parentNode.removeChild(menu);
        document.removeEventListener("click",closeTLCtx);
      }
    });
  },0);
}

// === Properties Panel ===
function updateProps(){
  var pp=document.getElementById("propsPanel");
  if(!pp)return;
  pp.textContent="";

  // ── Helper: create section header ──
  function sect(text){
    var d=document.createElement("div");d.className="props-section";d.textContent=text;pp.appendChild(d);return d;
  }
  // ── Helper: create a labeled row with input ──
  function row(label,val,onChange,opts){
    opts=opts||{};
    var r=document.createElement("div");r.className="props-row";
    var lbl=document.createElement("label");lbl.className="props-label";lbl.textContent=label+":";r.appendChild(lbl);
    if(opts.type==="select"){
      var sel=document.createElement("select");sel.className="props-select";sel.style.width=opts.width||"90px";
      (opts.options||[]).forEach(function(op){var o=document.createElement("option");o.value=op[0];o.textContent=op[1];if(val===op[0])o.selected=true;sel.appendChild(o);});
      sel.addEventListener("change",function(){onChange(sel.value);});
      r.appendChild(sel);
    }else if(opts.type==="readonly"){
      var sp=document.createElement("span");sp.className="props-readonly";sp.textContent=val;r.appendChild(sp);
    }else if(opts.type==="checkbox"){
      var cb=document.createElement("input");cb.type="checkbox";cb.checked=!!val;cb.style.cssText="accent-color:#4488CC";
      cb.addEventListener("change",function(){onChange(cb.checked);});r.appendChild(cb);
    }else{
      var inp=document.createElement("input");inp.className="props-input";inp.type="text";
      inp.value=val;if(opts.width)inp.style.width=opts.width;
      if(opts.readonly)inp.readOnly=true;
      inp.addEventListener("change",function(){onChange(inp.value);});
      r.appendChild(inp);
      if(opts.unit){var u=document.createElement("span");u.className="props-unit";u.textContent=opts.unit;r.appendChild(u);}
    }
    pp.appendChild(r);return r;
  }
  // ── Helper: paired inputs (X/Y, W/H) ──
  function rowPair(lbl1,val1,onChange1,lbl2,val2,onChange2,lockObj){
    var r=document.createElement("div");r.className="props-row-pair";
    var la=document.createElement("span");la.className="props-label";la.textContent=lbl1;r.appendChild(la);
    var ia=document.createElement("input");ia.className="props-input";ia.type="text";ia.value=Math.round(val1*100)/100;
    r.appendChild(ia);
    if(lockObj){
      var lk=document.createElement("span");lk.className="props-lock-btn"+(lockObj.locked?" locked":"");
      lk.textContent=lockObj.locked?"\uD83D\uDD12":"\uD83D\uDD13";
      lk.title="Lock aspect ratio";
      lk.addEventListener("click",function(){lockObj.locked=!lockObj.locked;updateProps();});
      r.appendChild(lk);
    }
    var lb=document.createElement("span");lb.className="props-label";lb.textContent=lbl2;r.appendChild(lb);
    var ib=document.createElement("input");ib.className="props-input";ib.type="text";ib.value=Math.round(val2*100)/100;
    r.appendChild(ib);
    ia.addEventListener("change",function(){
      var nv=parseFloat(ia.value)||0;
      if(lockObj&&lockObj.locked&&val1!==0){var ratio=val2/val1;ib.value=Math.round(nv*ratio*100)/100;onChange2(parseFloat(ib.value));}
      onChange1(nv);
    });
    ib.addEventListener("change",function(){
      var nv=parseFloat(ib.value)||0;
      if(lockObj&&lockObj.locked&&val2!==0){var ratio=val1/val2;ia.value=Math.round(nv*ratio*100)/100;onChange1(parseFloat(ia.value));}
      onChange2(nv);
    });
    pp.appendChild(r);return r;
  }
  // ── Helper: slider with numeric input ──
  function sliderRow(label,val,min,max,step,onChange,opts){
    opts=opts||{};
    var r=document.createElement("div");r.className="props-slider-row";
    var lbl=document.createElement("label");lbl.className="props-label";lbl.textContent=label+":";r.appendChild(lbl);
    var sl=document.createElement("input");sl.type="range";sl.className="props-slider";
    sl.min=min;sl.max=max;sl.step=step;sl.value=val;
    r.appendChild(sl);
    var ni=document.createElement("input");ni.className="props-input";ni.type="text";
    ni.value=opts.percent?Math.round(val*(100/(max-min+0.001)))+"":Math.round(val*1000)/1000+"";
    r.appendChild(ni);
    if(opts.unit){var u=document.createElement("span");u.className="props-unit";u.textContent=opts.unit;r.appendChild(u);}
    sl.addEventListener("input",function(){
      var v=parseFloat(sl.value);
      ni.value=opts.percent?Math.round(v*100)+"":Math.round(v*1000)/1000+"";
      onChange(v);
    });
    ni.addEventListener("change",function(){
      var v=opts.percent?parseFloat(ni.value)/100:parseFloat(ni.value);
      if(isNaN(v))v=min;v=Math.max(min,Math.min(max,v));
      sl.value=v;onChange(v);
    });
    pp.appendChild(r);return r;
  }
  // ── Helper: color swatch row ──
  function colorRow(label,currentColor,onChange){
    var r=document.createElement("div");r.className="props-color-row";
    var lbl=document.createElement("span");lbl.className="props-label";lbl.textContent=label+":";r.appendChild(lbl);
    var sw=document.createElement("span");sw.className="props-swatch";
    sw.style.backgroundColor=currentColor||"#000000";
    sw.addEventListener("click",function(e){
      e.stopPropagation();
      showCP(currentColor,function(nc){onChange(nc);updateProps();});
    });
    r.appendChild(sw);
    var hex=document.createElement("span");hex.style.cssText="color:#AAA;font-size:10px;margin-left:4px";hex.textContent=currentColor||"";
    r.appendChild(hex);
    pp.appendChild(r);return r;
  }
  // ── Helper: button group ──
  function btnGroup(items){
    var r=document.createElement("div");r.className="props-row";r.style.flexWrap="wrap";
    var g=document.createElement("div");g.className="props-btn-group";
    items.forEach(function(it){
      var b=document.createElement("button");b.className="props-btn-toggle"+(it.active?" active":"");
      b.textContent=it.label;b.title=it.title||it.label;
      b.addEventListener("click",function(){it.onClick();updateProps();});
      g.appendChild(b);
    });
    r.appendChild(g);pp.appendChild(r);return r;
  }
  // ── Helper: action buttons row ──
  function actionRow(buttons){
    var r=document.createElement("div");r.className="props-row";r.style.cssText="flex-wrap:wrap;gap:2px";
    buttons.forEach(function(bt){
      var b=document.createElement("button");b.className="props-btn-action";
      b.textContent=bt.label;if(bt.disabled)b.disabled=true;
      // Handlers get the event, so one can open a menu at the button.
      if(bt.onClick)b.addEventListener("click",bt.onClick);
      r.appendChild(b);
    });
    pp.appendChild(r);return r;
  }

  /** A short explanatory line under a control. */
  function note(text){
    var d=document.createElement("div");
    d.className="props-note";
    d.textContent=text;
    pp.appendChild(d);
    return d;
  }

  // Aspect ratio lock state (persists during session via closure)
  if(!updateProps._arLock)updateProps._arLock={locked:false};
  var arLock=updateProps._arLock;

  // ═══════════════════════════════════════════
  //  SINGLE OBJECT SELECTED
  // ═══════════════════════════════════════════
  if(selection.length===1){
    var o=selection[0];
    var typeName=o.type.charAt(0).toUpperCase()+o.type.slice(1);
    sect(typeName+" Properties");

    // ── Symbol Properties (additional for symbol instances) ──
    if(o.type==="symbol"){
      var sym=doc.library[o.symbolName];
      var symFrames=symbolTotalFrames(sym);
      var behavior=symbolBehaviorOf(o,sym);

      sect("Symbol Instance");
      row("Symbol",(o.symbolName||"")+(symFrames>1?"  ("+symFrames+" frames)":""),function(){},{type:"readonly"});
      row("Instance",o.instanceName||"",function(v){pushUndo();o.instanceName=v;},{width:"90px"});
      row("Behavior",behavior,function(v){
        pushUndo();o.symbolBehavior=v;render();updateProps();
      },{type:"select",width:"90px",options:[["movieclip","Movie Clip"],["graphic","Graphic"],["button","Button"]]});

      if(behavior==="graphic"){
        /* A Graphic is driven by the parent timeline, which is exactly why
           it is the behaviour you build a mouth or a hand out of: pick the
           frame here and it previews as you scrub. */
        row("Loop",o.loopMode||"loop",function(v){
          pushUndo();o.loopMode=v;render();updateProps();
        },{type:"select",width:"100px",options:[["loop","Loop"],["once","Play Once"],["single","Single Frame"]]});
        row("First",Math.max(1,Math.min(o.firstFrame||1,symFrames)),function(v){
          pushUndo();
          o.firstFrame=Math.max(1,Math.min(parseInt(v,10)||1,symFrames));
          render();updateProps();
        },{type:"number",width:"50px",unit:"of "+symFrames});
        if(symFrames>1){
          // Stepping frames is the inner loop of lip sync, so it gets
          // buttons rather than only a number field.
          actionRow([
            {label:"◀ Prev",onClick:function(){
              pushUndo();
              var f=(o.firstFrame||1)-1;
              o.firstFrame=f<1?symFrames:f;
              render();updateProps();
            }},
            {label:"Next ▶",onClick:function(){
              pushUndo();
              var f=(o.firstFrame||1)+1;
              o.firstFrame=f>symFrames?1:f;
              render();updateProps();
            }}
          ]);
        }
      }else if(behavior==="button"){
        var named=["Up","Over","Down","Hit"].slice(0,Math.min(4,symFrames)).join(" · ");
        row("States",named||"Up",function(){},{type:"readonly"});
        if(symFrames<4){
          note("Frames 1–4 of the symbol are Up, Over, Down and Hit. "+
               "This one has "+symFrames+", so the missing states fall back to Up.");
        }
      }else{
        note("A Movie Clip runs its own timeline and shows frame 1 while you edit — press Test Movie to see it play.");
      }

      actionRow([
        {label:"Edit Symbol",onClick:function(){if(o.symbolName)enterSymbol(o.symbolName);}},
        {label:"Swap Symbol",onClick:function(ev){swapSymbolOn(o,ev);}}
      ]);
    }

    // ── Position & Size ──
    sect("Position & Size");
    rowPair("X",o.x,function(v){pushUndo();o.x=v;render();},"Y",o.y,function(v){pushUndo();o.y=v;render();});
    rowPair("W",o.width,function(v){pushUndo();o.width=v;render();},"H",o.height,function(v){pushUndo();o.height=v;render();},arLock);

    // ── Transform ──
    sect("Transform");
    row("Rotation",Math.round(o.rotation*100)/100,function(v){pushUndo();o.rotation=parseFloat(v)||0;render();},{unit:"\u00B0",width:"50px"});
    rowPair("SX",o.scaleX,function(v){pushUndo();o.scaleX=v;render();},"SY",o.scaleY,function(v){pushUndo();o.scaleY=v;render();});
    rowPair("SkX",o.skewX||0,function(v){pushUndo();o.skewX=v;render();},"SkY",o.skewY||0,function(v){pushUndo();o.skewY=v;render();});
    sliderRow("Alpha",o.alpha,0,1,0.01,function(v){pushUndo();o.alpha=v;render();},{percent:true,unit:"%"});

    // ── Blend Mode ──
    row("Blend",o.blendMode||"source-over",function(v){pushUndo();o.blendMode=v;render();},{type:"select",width:"110px",options:[
      ["source-over","Normal"],["multiply","Multiply"],["screen","Screen"],["overlay","Overlay"],
      ["darken","Darken"],["lighten","Lighten"],["color-dodge","Color Dodge"],["color-burn","Color Burn"],
      ["hard-light","Hard Light"],["soft-light","Soft Light"],["difference","Difference"],["exclusion","Exclusion"],
      ["hue","Hue"],["saturation","Saturation"],["color","Color"],["luminosity","Luminosity"]
    ]});

    /* Fill and stroke belong to the artwork, not to a symbol instance —
       the shapes inside the symbol carry their own. Showing dead controls
       above the frame picker is noise in exactly the workflow (lip sync,
       posing) where the frame picker gets used most. */
    if(o.type!=="symbol"){
    // ── Fill ──
    sect("Fill");
    row("Type",o.fillType||"solid",function(v){pushUndo();o.fillType=v;render();updateProps();},{type:"select",width:"80px",options:[["solid","Solid"],["none","None"]]});
    if((o.fillType||"solid")!=="none"){
      colorRow("Color",o.fillColor,function(nc){pushUndo();o.fillColor=nc;render();});
      sliderRow("Alpha",o.fillAlpha!=null?o.fillAlpha:1,0,1,0.01,function(v){pushUndo();o.fillAlpha=v;render();},{percent:true,unit:"%"});
    }

    // ── Stroke ──
    sect("Stroke");
    row("Style",o.strokeStyle||"solid",function(v){pushUndo();o.strokeStyle=v;render();updateProps();},{type:"select",width:"80px",options:[["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"],["none","None"]]});
    if((o.strokeStyle||"solid")!=="none"){
      colorRow("Color",o.strokeColor,function(nc){pushUndo();o.strokeColor=nc;render();});
      row("Width",o.strokeWidth,function(v){pushUndo();o.strokeWidth=Math.max(0,parseFloat(v)||0);render();},{width:"45px",unit:"px"});
      sliderRow("Alpha",o.strokeAlpha!=null?o.strokeAlpha:1,0,1,0.01,function(v){pushUndo();o.strokeAlpha=v;render();},{percent:true,unit:"%"});
      row("Cap",o.strokeCap||"round",function(v){pushUndo();o.strokeCap=v;render();},{type:"select",width:"70px",options:[["round","Round"],["square","Square"],["butt","Butt"]]});
      row("Join",o.strokeJoin||"round",function(v){pushUndo();o.strokeJoin=v;render();},{type:"select",width:"70px",options:[["round","Round"],["bevel","Bevel"],["miter","Miter"]]});
    }
    } // end non-symbol fill/stroke

    // ── Text Properties (additional for text objects) ──
    if(o.type==="text"){
      sect("Text");
      row("Font",o.font||"Arial",function(v){pushUndo();o.font=v;render();},{width:"90px"});
      row("Size",o.fontSize||24,function(v){pushUndo();o.fontSize=parseFloat(v)||12;render();},{width:"45px",unit:"px"});
      colorRow("Color",o.fillColor,function(nc){pushUndo();o.fillColor=nc;render();});
      btnGroup([
        {label:"B",title:"Bold",active:!!o.fontBold,onClick:function(){pushUndo();o.fontBold=!o.fontBold;render();}},
        {label:"I",title:"Italic",active:!!o.fontItalic,onClick:function(){pushUndo();o.fontItalic=!o.fontItalic;render();}},
        {label:"U",title:"Underline",active:!!o.fontUnderline,onClick:function(){pushUndo();o.fontUnderline=!o.fontUnderline;render();}}
      ]);
      btnGroup([
        {label:"\u2190",title:"Left",active:o.textAlign==="left",onClick:function(){pushUndo();o.textAlign="left";render();}},
        {label:"\u2194",title:"Center",active:o.textAlign==="center",onClick:function(){pushUndo();o.textAlign="center";render();}},
        {label:"\u2192",title:"Right",active:o.textAlign==="right",onClick:function(){pushUndo();o.textAlign="right";render();}}
      ]);
      row("Line H",o.lineHeight||1.2,function(v){pushUndo();o.lineHeight=parseFloat(v)||1.2;render();},{width:"45px"});
      // Text content textarea
      var tr=document.createElement("div");tr.className="props-row";tr.style.cssText="flex-direction:column;align-items:stretch";
      var tl=document.createElement("label");tl.className="props-label";tl.style.cssText="width:auto;text-align:left;margin-bottom:2px";tl.textContent="Content:";tr.appendChild(tl);
      var ta=document.createElement("textarea");ta.className="props-textarea";ta.value=o.text||"";
      ta.addEventListener("change",function(){pushUndo();o.text=ta.value;render();});
      tr.appendChild(ta);pp.appendChild(tr);
    }


  // ═══════════════════════════════════════════
  //  NOTHING SELECTED — show KF, Layer, Doc
  // ═══════════════════════════════════════════
  }else if(selection.length===0){

    // ── Keyframe Properties ──
    if(selectedKF&&selectedKF.kf){
      var skf=selectedKF.kf;
      var layerName=currentLayers()[selectedKF.layerIdx]?currentLayers()[selectedKF.layerIdx].name:"";
      sect("Keyframe \u2014 "+layerName+" @ "+skf.index);

      row("Frame",skf.index,function(){},{type:"readonly"});
      row("Duration",skf.duration,function(v){pushUndo();skf.duration=Math.max(1,parseInt(v)||1);fullRefresh();},{width:"50px",unit:"frames"});
      row("Objects",skf.objects.length,function(){},{type:"readonly"});
      row("Tween",skf.tweenType||"none",function(v){pushUndo();skf.tweenType=v;fullRefresh();},{type:"select",width:"90px",options:[["none","None"],["motion","Motion"],["shape","Shape"]]});

      if(skf.tweenType&&skf.tweenType!=="none"){
        row("Easing",skf.easing||"linear",function(v){pushUndo();skf.easing=v;fullRefresh();},{type:"select",width:"100px",options:[
          ["linear","linear"],["quadIn","quadIn"],["quadOut","quadOut"],["quadInOut","quadInOut"],
          ["cubicIn","cubicIn"],["cubicOut","cubicOut"],["cubicInOut","cubicInOut"],
          ["sineIn","sineIn"],["sineOut","sineOut"],["sineInOut","sineInOut"],
          ["expoOut","expoOut"],["backOut","backOut"],["elasticOut","elasticOut"],["bounceOut","bounceOut"]
        ]});
      }

      // Keyframe action buttons
      actionRow([
        {label:"Insert Keyframe",onClick:function(){
          var l=currentLayers()[selectedKF.layerIdx];
          if(l){pushUndo();l.insertKeyframe(curFrame);fullRefresh();}
        }},
        {label:"Clear Keyframe",onClick:function(){
          var l=currentLayers()[selectedKF.layerIdx];
          if(l&&skf){pushUndo();skf.objects=[];fullRefresh();}
        }},
        {label:"Blank Keyframe",onClick:function(){
          var l=currentLayers()[selectedKF.layerIdx];
          if(l){pushUndo();var nk=l.insertKeyframe(curFrame);if(nk)nk.objects=[];fullRefresh();}
        }}
      ]);

      // Frame script editor
      var fsr=document.createElement("div");fsr.className="props-row";fsr.style.cssText="flex-direction:column;align-items:stretch;margin-top:4px";
      var fsl=document.createElement("label");fsl.className="props-label";fsl.style.cssText="width:auto;text-align:left;margin-bottom:2px";fsl.textContent="Frame Script:";fsr.appendChild(fsl);
      var fsta=document.createElement("textarea");fsta.className="props-textarea code";fsta.value=skf.script||"";
      fsta.placeholder="// ActionScript here...";
      fsta.addEventListener("change",function(){pushUndo();skf.script=fsta.value;fullRefresh();});
      fsr.appendChild(fsta);pp.appendChild(fsr);

      /* ── Sound on this keyframe ──
         Flash attaches sound to a keyframe, and so does this. Sync is the
         consequential setting: Stream locks the audio to the playhead (what
         every voiced cartoon uses), Event fires once and runs free (what
         you want for a one-shot effect). */
      sect("Sound");
      var soundOpts=[["","None"]];
      Object.keys(doc.sounds).forEach(function(n){
        var secs=doc.sounds[n].duration;
        soundOpts.push([n,n+(secs?" ("+secs.toFixed(1)+"s)":"")]);
      });
      var curSound=skf.sound&&skf.sound.asset?skf.sound.asset:"";
      row("Sound",curSound,function(v){
        pushUndo();
        if(!v){skf.sound=null;}
        else{
          skf.sound=skf.sound?cloneSound(skf.sound):{asset:v,sync:"stream",volume:1,loop:false,offset:0};
          skf.sound.asset=v;
          var a=doc.sounds[v];
          if(a&&a.duration)attachSoundToCurrentKeyframe(v,a.duration);
        }
        fullRefresh();
      },{type:"select",width:"130px",options:soundOpts});

      if(skf.sound&&skf.sound.asset){
        row("Sync",skf.sound.sync||"stream",function(v){
          pushUndo();skf.sound.sync=v;fullRefresh();
        },{type:"select",width:"90px",options:[["stream","Stream"],["event","Event"]]});
        row("Volume",Math.round((skf.sound.volume!=null?skf.sound.volume:1)*100),function(v){
          pushUndo();skf.sound.volume=Math.max(0,Math.min(100,parseFloat(v)||0))/100;
        },{type:"number",width:"60px"});
        row("Loop",!!skf.sound.loop,function(v){
          pushUndo();skf.sound.loop=!!v;fullRefresh();
        },{type:"checkbox"});
        actionRow([
          {label:"Auto Lip Sync...",onClick:function(){showLipSyncDialog();}}
        ]);
        actionRow([
          {label:"▶ Preview",onClick:function(){
            if(typeof Flashy==="undefined"||!Flashy.Sound)return;
            Flashy.Sound.unlock().then(function(){
              Flashy.Sound.play(skf.sound.asset,{
                volume:skf.sound.volume,offset:skf.sound.offset||0
              });
            });
          }},
          {label:"Remove",onClick:function(){pushUndo();skf.sound=null;fullRefresh();}}
        ]);
      }
      actionRow([
        {label:"Import Sound...",onClick:function(){doAction("importSound");}}
      ]);

      // Separator
      var sep=document.createElement("div");sep.style.cssText="border-top:1px solid #444;margin:8px 0";pp.appendChild(sep);
    }

    // ── Layer Properties ──
    var curLayerObj=currentLayers()[curLayer];
    if(curLayerObj){
      sect("Layer: "+curLayerObj.name);

      row("Name",curLayerObj.name,function(v){pushUndo();curLayerObj.name=v;fullRefresh();},{width:"90px"});
      row("Visible",curLayerObj.visible,function(v){pushUndo();curLayerObj.visible=v;fullRefresh();},{type:"checkbox"});
      row("Locked",curLayerObj.locked,function(v){pushUndo();curLayerObj.locked=v;fullRefresh();},{type:"checkbox"});
      row("Type",curLayerObj.layerType||"normal",function(v){pushUndo();curLayerObj.layerType=v;},{type:"select",width:"80px",options:[["normal","Normal"],["guide","Guide"],["mask","Mask"]]});

      // Outline color
      colorRow("Outline",curLayerObj.outlineColor||"#4488CC",function(nc){pushUndo();curLayerObj.outlineColor=nc;});

      // Layer height
      row("Height",curLayerObj.layerHeight||"normal",function(v){pushUndo();curLayerObj.layerHeight=v;},{type:"select",width:"80px",options:[["short","Short"],["normal","Normal"],["tall","Tall"]]});

      // Layer order buttons
      actionRow([
        {label:"\u25B2 Up",onClick:function(){
          if(curLayer<=0)return;pushUndo();
          var layers=currentLayers();var tmp=layers[curLayer];layers[curLayer]=layers[curLayer-1];layers[curLayer-1]=tmp;
          curLayer--;fullRefresh();
        }},
        {label:"\u25BC Down",onClick:function(){
          var layers=currentLayers();
          if(curLayer>=layers.length-1)return;pushUndo();
          var tmp=layers[curLayer];layers[curLayer]=layers[curLayer+1];layers[curLayer+1]=tmp;
          curLayer++;fullRefresh();
        }}
      ]);

      // Separator
      var lsep=document.createElement("div");lsep.style.cssText="border-top:1px solid #444;margin:8px 0";pp.appendChild(lsep);
    }

    // ── Document Properties ──
    sect("Document");
    var docFields=[
      {label:"Width",key:"width",type:"number"},
      {label:"Height",key:"height",type:"number"},
      {label:"FPS",key:"fps",type:"number"}
    ];
    docFields.forEach(function(fd){
      row(fd.label,doc[fd.key],function(v){pushUndo();doc[fd.key]=parseInt(v)||0;render();},{width:"55px"});
    });
    colorRow("BG Color",doc.backgroundColor,function(nc){pushUndo();doc.backgroundColor=nc;render();});

  // ═══════════════════════════════════════════
  //  MULTIPLE OBJECTS SELECTED
  // ═══════════════════════════════════════════
  }else{
    sect(selection.length+" Objects Selected");
    // Shared X/Y position edit (moves all)
    row("Move X","0",function(v){var d=parseFloat(v)||0;if(d===0)return;pushUndo();selection.forEach(function(o){o.x+=d;});render();updateProps();},{width:"50px",unit:"\u0394"});
    row("Move Y","0",function(v){var d=parseFloat(v)||0;if(d===0)return;pushUndo();selection.forEach(function(o){o.y+=d;});render();updateProps();},{width:"50px",unit:"\u0394"});
    sliderRow("Alpha",selection[0].alpha,0,1,0.01,function(v){pushUndo();selection.forEach(function(o){o.alpha=v;});render();},{percent:true,unit:"%"});
    colorRow("Fill",selection[0].fillColor,function(nc){pushUndo();selection.forEach(function(o){o.fillColor=nc;});render();});
    colorRow("Stroke",selection[0].strokeColor,function(nc){pushUndo();selection.forEach(function(o){o.strokeColor=nc;});render();});
  }
}

// === Color System ===
function updateColorUI(){
  var fc=document.getElementById("fillColorSwatch");
  var sc=document.getElementById("strokeColorSwatch");
  if(fc)fc.style.backgroundColor=fillColor;
  if(sc)sc.style.backgroundColor=strokeColor;
}
function buildColorUI(){
  var cp=document.getElementById("colorPanel");
  if(!cp)return;
  cp.textContent="";
  var fRow=document.createElement("div");fRow.className="color-row";
  var fLbl=document.createElement("span");fLbl.className="color-label";fLbl.textContent="Fill:";
  fRow.appendChild(fLbl);
  var fSwatch=document.createElement("span");fSwatch.className="color-swatch";fSwatch.id="fillColorSwatch";
  fSwatch.style.backgroundColor=fillColor;
  fSwatch.addEventListener("click",function(){showCP("fill");});
  fRow.appendChild(fSwatch);
  cp.appendChild(fRow);
  var sRow=document.createElement("div");sRow.className="color-row";
  var sLbl=document.createElement("span");sLbl.className="color-label";sLbl.textContent="Stroke:";
  sRow.appendChild(sLbl);
  var sSwatch=document.createElement("span");sSwatch.className="color-swatch";sSwatch.id="strokeColorSwatch";
  sSwatch.style.backgroundColor=strokeColor;
  sSwatch.addEventListener("click",function(){showCP("stroke");});
  sRow.appendChild(sSwatch);
  cp.appendChild(sRow);
  var swRow=document.createElement("div");swRow.className="color-row";
  var swLbl=document.createElement("span");swLbl.className="color-label";swLbl.textContent="Width:";
  swRow.appendChild(swLbl);
  var swInp=document.createElement("input");swInp.type="number";swInp.className="props-input";
  swInp.min=0;swInp.max=50;swInp.value=strokeWidth;swInp.style.width="50px";
  swInp.addEventListener("change",function(){strokeWidth=parseFloat(swInp.value)||1;});
  swRow.appendChild(swInp);
  cp.appendChild(swRow);
}
var cpPopup=null;
// showCP(currentColor, callback) — opens color picker popup; callback receives chosen color string
// Legacy: showCP("fill") / showCP("stroke") still works for the color panel swatches
function showCP(targetOrColor, callback){
  if(cpPopup){cpPopup.parentNode.removeChild(cpPopup);cpPopup=null;document.removeEventListener("click",closeCPOnClick);return;}
  var legacyMode=(targetOrColor==="fill"||targetOrColor==="stroke");
  var initColor=legacyMode?(targetOrColor==="fill"?fillColor:strokeColor):(targetOrColor||"#000000");
  var legacyTarget=legacyMode?targetOrColor:null;
  cpPopup=document.createElement("div");
  cpPopup.className="color-popup";
  var colors=["#000000","#333333","#666666","#999999","#CCCCCC","#FFFFFF",
    "#FF0000","#FF6600","#FFCC00","#FFFF00","#99FF00","#00FF00",
    "#00FF99","#00FFFF","#0099FF","#0000FF","#6600FF","#FF00FF",
    "#CC0000","#CC6600","#CC9900","#CCCC00","#66CC00","#00CC00",
    "#00CC99","#00CCCC","#0066CC","#0000CC","#6600CC","#CC00CC",
    "#990000","#993300","#996600","#999900","#339900","#009900",
    "#009966","#009999","#003399","#000099","#330099","#990099"];
  var noneBtn=document.createElement("div");
  noneBtn.style.cssText="padding:3px 6px;cursor:pointer;color:#AAA;font-size:10px;margin-bottom:4px;border:1px solid #555;text-align:center;background:#2A2A2A";
  noneBtn.textContent="No Color";
  noneBtn.addEventListener("click",function(){
    if(legacyTarget){if(legacyTarget==="fill")fillColor="transparent";else strokeColor="transparent";updateColorUI();}
    if(callback)callback("transparent");
    if(cpPopup){cpPopup.parentNode.removeChild(cpPopup);cpPopup=null;document.removeEventListener("click",closeCPOnClick);}
  });
  cpPopup.appendChild(noneBtn);
  var grid=document.createElement("div");grid.className="color-grid";
  colors.forEach(function(c){
    var cell=document.createElement("span");
    cell.className="color-cell";
    cell.style.backgroundColor=c;
    cell.addEventListener("click",function(){
      if(legacyTarget){if(legacyTarget==="fill")fillColor=c;else strokeColor=c;updateColorUI();}
      if(callback)callback(c);
      if(cpPopup){cpPopup.parentNode.removeChild(cpPopup);cpPopup=null;document.removeEventListener("click",closeCPOnClick);}
    });
    grid.appendChild(cell);
  });
  cpPopup.appendChild(grid);
  var ci=document.createElement("input");ci.type="color";ci.className="color-custom";
  ci.value=initColor&&initColor.charAt(0)==="#"?initColor:"#000000";
  ci.addEventListener("change",function(){
    if(legacyTarget){if(legacyTarget==="fill")fillColor=ci.value;else strokeColor=ci.value;updateColorUI();}
    if(callback)callback(ci.value);
  });
  cpPopup.appendChild(ci);
  document.body.appendChild(cpPopup);
  // Position near mouse if possible
  var rect=cpPopup.getBoundingClientRect();
  if(rect.right>window.innerWidth)cpPopup.style.left=(window.innerWidth-rect.width-8)+"px";
  if(rect.bottom>window.innerHeight)cpPopup.style.top=(window.innerHeight-rect.height-8)+"px";
  setTimeout(function(){
    document.addEventListener("click",closeCPOnClick);
  },0);
}
function closeCPOnClick(e){
  if(cpPopup&&!cpPopup.contains(e.target)){
    cpPopup.parentNode.removeChild(cpPopup);cpPopup=null;
    document.removeEventListener("click",closeCPOnClick);
  }
}

// === Library Panel ===
function updateLib(){
  var lp=document.getElementById("libPanel");
  if(!lp)return;
  lp.textContent="";
  var title=document.createElement("div");
  title.className="lib-title";
  title.textContent="Library";
  lp.appendChild(title);
  var keys=Object.keys(doc.library);
  if(keys.length===0){
    var empty=document.createElement("div");empty.className="lib-empty";
    empty.textContent="No symbols";lp.appendChild(empty);
    return;
  }
  keys.forEach(function(k){
    var row=document.createElement("div");row.className="lib-item";
    var icon=document.createElement("span");icon.className="lib-icon";icon.textContent="▣";
    row.appendChild(icon);
    var name=document.createElement("span");name.textContent=k;
    row.appendChild(name);
    row.addEventListener("click",function(){
      pushUndo();
      var kf=CKF();if(!kf){var l=CL();if(l){kf=l.insertKeyframe(curFrame);}}
      if(kf){
        var obj=new EditorObject("symbol");
        obj.symbolName=k;obj.x=doc.width/2-25;obj.y=doc.height/2-25;
        obj.width=50;obj.height=50;
        kf.objects.push(obj);selection=[obj];fullRefresh();
      }
    });
    row.addEventListener("dblclick",function(e){
      e.stopPropagation();
      enterSymbol(k);
    });
    lp.appendChild(row);
  });
}

// === Symbol Editing ===
function ensureSymbolLayers(sym){
  if(!sym.layers||!sym.layers.length){
    sym.layers=[new Layer("Layer 1")];
    // reviveObject, not slice(): raw object literals have no EditorObject
    // prototype, so clone() and everything built on it would throw.
    sym.layers[0].keyframes[0].objects=(sym.objects||[]).map(function(o){
      return (o&&typeof o.clone==="function")?o:reviveObject(o);
    });
    if(!sym.totalFrames)sym.totalFrames=60;
    return sym;
  }
  // Layers that came from somewhere other than deserializeDoc — hand-edited
  // JSON, a document mid-import, something the assistant wrote — are plain
  // objects with no Layer/KeyFrame prototype, so getKeyframeAt() and clone()
  // are missing and anything that edits them throws. Revive them in place.
  if(typeof sym.layers[0].getKeyframeAt!=="function"){
    sym.layers=reviveLayers(sym.layers);
  }
  return sym;
}
function enterSymbol(symbolName){
  var sym=doc.library[symbolName];
  if(!sym)return;
  ensureSymbolLayers(sym);
  editStack.push({
    name:symbolName,
    layers:sym.layers,
    totalFrames:sym.totalFrames||60,
    savedFrame:curFrame,
    savedLayer:curLayer
  });
  curFrame=1;
  curLayer=0;
  selection=[];
  updateBreadcrumb();
  fullRefresh();
}
function exitSymbol(){
  if(editStack.length===0)return;
  var ctx=editStack.pop();
  var sym=doc.library[ctx.name];
  if(sym&&sym.layers){
    var allObjs=[];
    sym.layers.forEach(function(l){
      var kf=l.getKeyframeAt(1);
      if(kf)allObjs=allObjs.concat(kf.objects);
    });
    sym.objects=allObjs;
  }
  curFrame=ctx.savedFrame;
  curLayer=ctx.savedLayer;
  selection=[];
  updateBreadcrumb();
  fullRefresh();
}
function exitAllSymbols(){
  while(editStack.length>0)exitSymbol();
}
function updateBreadcrumb(){
  var bc=document.getElementById("breadcrumb");
  if(!bc)return;
  bc.textContent="";
  var sceneLink=document.createElement("span");
  sceneLink.textContent="Scene 1";
  sceneLink.style.cursor="pointer";
  sceneLink.addEventListener("click",function(){exitAllSymbols();});
  bc.appendChild(sceneLink);
  editStack.forEach(function(ctx,i){
    var sep=document.createElement("span");
    sep.textContent=" \u203A ";
    sep.style.color="#666";
    bc.appendChild(sep);
    var link=document.createElement("span");
    link.textContent=ctx.name;
    link.style.cursor="pointer";
    link.addEventListener("click",function(){
      while(editStack.length>i+1)exitSymbol();
    });
    bc.appendChild(link);
  });
}

// === Context Menu ===
function showCtx(e){
  var old=document.getElementById("ctxMenu");
  if(old)old.parentNode.removeChild(old);
  var menu=document.createElement("div");
  menu.id="ctxMenu";menu.className="ctx-menu";
  menu.style.left=e.clientX+"px";menu.style.top=e.clientY+"px";
  var items=[];
  if(selection.length>0){
    items=[
      {label:"Cut",action:"cut"},{label:"Copy",action:"copy"},
      {label:"Paste",action:"paste"},{label:"Delete",action:"delete"},
      {type:"sep"},
      {label:"Convert to Symbol...",action:"convertSym"},
      {type:"sep"},
      {label:"Bring to Front",action:"bringFront"},
      {label:"Send to Back",action:"sendBack"}
    ];
  }else{
    items=[
      {label:"Paste",action:"paste"},
      {type:"sep"},
      {label:"Insert Keyframe",action:"insKF"},
      {label:"Insert Blank Keyframe",action:"insBlankKF"},
      {type:"sep"},
      {label:"Document Settings...",action:"docSettings"}
    ];
  }
  items.forEach(function(it){
    if(it.type==="sep"){
      var sep=document.createElement("div");sep.className="ctx-sep";
      menu.appendChild(sep);
    }else{
      var entry=document.createElement("div");entry.className="ctx-entry";
      entry.textContent=it.label;
      entry.addEventListener("click",function(){
        menu.parentNode.removeChild(menu);
        doAction(it.action);
      });
      menu.appendChild(entry);
    }
  });
  document.body.appendChild(menu);
  setTimeout(function(){
    document.addEventListener("click",function closeCtx(){
      var m=document.getElementById("ctxMenu");
      if(m)m.parentNode.removeChild(m);
      document.removeEventListener("click",closeCtx);
    });
  },0);
}

// === doAction ===
function doAction(a){
  switch(a){
  case "new":
    // Only interrupt when there is actually something to lose.
    if(!isDirty()||confirm("Create new document? Unsaved changes will be lost.")){
      doc.width=550;doc.height=400;doc.fps=24;doc.backgroundColor="#FFFFFF";
      doc.layers=[new Layer("Layer 1")];doc.library={};doc.sounds={};doc.totalFrames=60;
      curLayer=0;curFrame=1;selection=[];undoStack=[];redoStack=[];editStack=[];
      markSaved();
      updateBreadcrumb();fullRefresh();
    }
    break;
  case "open":
    // On the desktop the shell opens each chosen document in its own window
    // (one document per window), so it never discards unsaved work in this one.
    if(desktopHost){desktopHost.openDialog();break;}
    if(isDirty()&&!confirm("Open another document? Unsaved changes will be lost."))break;
    var inp=document.createElement("input");inp.type="file";inp.accept=".flashy,.json";
    inp.addEventListener("change",function(){
      if(!inp.files[0])return;
      var r=new FileReader();
      r.onload=function(){
        try{
          loadDocFromObject(JSON.parse(r.result));
        }catch(e){alert("Failed to open file: "+e.message);}
      };
      r.readAsText(inp.files[0]);
    });
    inp.click();
    break;
  case "save":
    // Desktop Save writes back to the file the document came from, with no
    // dialog; the browser has no such notion, so it downloads a fresh copy.
    // (The desktop host clears the dirty flag itself, once the bytes land.)
    if(desktopHost){desktopHost.saveDoc();break;}
    dlFile(JSON.stringify(serializeDoc(),null,2),"animation.flashy","application/json");
    markSaved();
    break;
  case "saveAs":
    if(desktopHost){desktopHost.saveDocAs();break;}
    dlFile(JSON.stringify(serializeDoc(),null,2),"animation.flashy","application/json");
    markSaved();
    break;
  case "newWindow":
    if(desktopHost)desktopHost.newWindow();
    break;
  case "export":
    genHTML(function(html){dlFile(html,"animation.html","text/html");});
    break;
  case "exportGIF":
    exportAsGIF();
    break;
  case "exportMP4":
    exportAsMP4();
    break;
  case "exportSVG":
    exportAsSVG();
    break;
  case "exportEmbed":
    exportEmbedSnippet();
    break;
  case "exportModule":
    exportAsModule();
    break;
  case "docSettings":
    showDialog({
      title:"Document Settings",
      fields:[
        {name:"w",label:"Width",type:"number",value:doc.width,min:1},
        {name:"h",label:"Height",type:"number",value:doc.height,min:1},
        {name:"fps",label:"Frame rate",type:"number",value:doc.fps,min:1,max:120,hint:"Frames per second."},
        {name:"bg",label:"Background",value:doc.backgroundColor,placeholder:"#FFFFFF"}
      ],
      validate:function(v){
        if(!(parseInt(v.w,10)>0)||!(parseInt(v.h,10)>0))return "Width and height must be positive numbers.";
        if(!(parseInt(v.fps,10)>0))return "Frame rate must be a positive number.";
        if(!/^#?[0-9a-fA-F]{6}$/.test(String(v.bg).trim()))return "Background must be a hex colour like #FFFFFF.";
        return null;
      },
      onOk:function(v){
        pushUndo();
        doc.width=parseInt(v.w,10);
        doc.height=parseInt(v.h,10);
        doc.fps=Math.max(1,Math.min(120,parseInt(v.fps,10)));
        var bg=String(v.bg).trim();
        doc.backgroundColor=bg[0]==="#"?bg:"#"+bg;
        var fi=document.getElementById("fpsInput");
        if(fi)fi.value=doc.fps;
        centerStage();fullRefresh();
      }
    });
    break;
  case "undo":doUndo();break;
  case "redo":doRedo();break;
  case "cut":
    if(selection.length>0){
      pushUndo();
      clipboard=selection.map(function(o){return o.clone();});
      var kf=CKF();
      if(kf){selection.forEach(function(o){
        var idx=kf.objects.indexOf(o);if(idx>=0)kf.objects.splice(idx,1);
      });}
      selection=[];fullRefresh();
    }
    break;
  case "copy":
    clipboard=selection.map(function(o){return o.clone();});
    break;
  case "paste":
    if(clipboard.length>0){
      pushUndo();
      var kf2=CKF();if(!kf2){var l=CL();if(l){kf2=l.insertKeyframe(curFrame);}}
      if(kf2){
        var pasted=[];
        clipboard.forEach(function(o){
          var c=o.clone();c.x+=10;c.y+=10;kf2.objects.push(c);pasted.push(c);
        });
        selection=pasted;fullRefresh();
      }
    }
    break;
  case "delete":
    if(selection.length>0){
      pushUndo();
      var kf3=CKF();
      if(kf3){selection.forEach(function(o){
        var idx=kf3.objects.indexOf(o);if(idx>=0)kf3.objects.splice(idx,1);
      });}
      selection=[];fullRefresh();
    }
    break;
  case "selectAll":
    var kf4=CKF();
    if(kf4)selection=kf4.objects.slice();
    fullRefresh();
    break;
  case "zoomIn":zoom=Math.min(10,zoom*1.5);updateZoomUI();render();break;
  case "zoomOut":zoom=Math.max(0.1,zoom/1.5);updateZoomUI();render();break;
  case "zoom100":zoom=1;updateZoomUI();centerStage();render();break;
  case "zoomFit":
    var cw=canvasW||800,ch=canvasH||600;
    zoom=Math.min((cw-40)/doc.width,(ch-40)/doc.height);
    updateZoomUI();centerStage();render();
    break;
  case "grid":showGrid=!showGrid;render();break;
  case "snap":snapGrid=!snapGrid;break;
  case "insKF":
    pushUndo();
    var l2=CL();if(l2){l2.insertKeyframe(curFrame);fullRefresh();}
    break;
  case "insBlankKF":
    pushUndo();
    var l3=CL();if(l3){l3.insertBlankKeyframe(curFrame);fullRefresh();}
    break;
  case "insFrame":
    pushUndo();
    var l4=CL();
    if(l4){
      // F5 behavior: extend the keyframe at curFrame by 1 frame
      // and push all subsequent keyframes forward
      var kfAt=l4.getKeyframeAt(curFrame);
      if(kfAt){
        kfAt.duration+=1;
        // Push all keyframes after this one forward by 1
        var idx4=l4.keyframes.indexOf(kfAt);
        for(var ki4=idx4+1;ki4<l4.keyframes.length;ki4++){
          l4.keyframes[ki4].index+=1;
        }
      }else{
        // No keyframe at curFrame — extend the last one to reach it
        l4.extendToFrame(curFrame);
      }
      fullRefresh();
    }
    break;
  case "removeKF":
    pushUndo();
    var l5=CL();if(l5){l5.removeKeyframe(curFrame);fullRefresh();}
    break;
  case "removeFrames":
    pushUndo();
    var l6=CL();
    if(l6){
      var kfr=l6.getKeyframeAt(curFrame);
      if(kfr&&kfr.duration>1){
        kfr.duration--;
        // Pull back subsequent keyframes
        var idx6=l6.keyframes.indexOf(kfr);
        for(var ki6=idx6+1;ki6<l6.keyframes.length;ki6++){
          l6.keyframes[ki6].index-=1;
        }
      }
      fullRefresh();
    }
    break;
  case "addLayer":
    pushUndo();
    var _cl=currentLayers();
    _cl.splice(curLayer,0,new Layer("Layer "+(_cl.length+1)));
    fullRefresh();
    break;
  case "delLayer":
    var _dl=currentLayers();
    if(_dl.length>1){
      pushUndo();
      _dl.splice(curLayer,1);
      if(curLayer>=_dl.length)curLayer=_dl.length-1;
      selection=[];fullRefresh();
    }
    break;
  case "motionTween":
  case "shapeTween":
    pushUndo();
    var kft=(selectedKF&&selectedKF.kf)?selectedKF.kf:CKF();
    if(kft){kft.tweenType=a==="motionTween"?"motion":"shape";fullRefresh();}
    break;
  case "removeTween":
    pushUndo();
    var kft2=(selectedKF&&selectedKF.kf)?selectedKF.kf:CKF();
    if(kft2){kft2.tweenType="none";fullRefresh();}
    break;
  case "convertSym":
    if(selection.length>0){
      askFor("Convert to Symbol","Name","Symbol "+(Object.keys(doc.library).length+1),function(sn){
        if(!sn)return;
        pushUndo();
        doc.library[sn]={objects:selection.map(function(o){return o.clone();}),layers:null,totalFrames:60,behavior:"movieclip"};
        var kfc=CKF();
        if(kfc){
          selection.forEach(function(o){
            var idx=kfc.objects.indexOf(o);if(idx>=0)kfc.objects.splice(idx,1);
          });
          var sym=new EditorObject("symbol");
          sym.symbolName=sn;
          var bb=getBounds(selection);
          sym.x=bb.x;sym.y=bb.y;sym.width=bb.w;sym.height=bb.h;
          kfc.objects.push(sym);selection=[sym];
        }
        fullRefresh();
      },{validate:function(v){
        if(!String(v).trim())return "Give the symbol a name.";
        if(doc.library[v])return "A symbol called “"+v+"” already exists.";
        return null;
      }});
    }
    break;
  case "newSymbol":
    askFor("New Symbol","Name","Symbol "+(Object.keys(doc.library).length+1),function(nsn){
      if(!nsn)return;
      pushUndo();
      doc.library[nsn]={objects:[],layers:null,totalFrames:60,behavior:"movieclip"};
      fullRefresh();
    },{validate:function(v){
      if(!String(v).trim())return "Give the symbol a name.";
      if(doc.library[v])return "A symbol called “"+v+"” already exists.";
      return null;
    }});
    break;
  case "bringFront":
    if(selection.length>0){
      pushUndo();var kfb=CKF();
      if(kfb){selection.forEach(function(o){
        var idx=kfb.objects.indexOf(o);
        if(idx>=0){kfb.objects.splice(idx,1);kfb.objects.push(o);}
      });render();}
    }
    break;
  case "sendBack":
    if(selection.length>0){
      pushUndo();var kfs=CKF();
      if(kfs){selection.forEach(function(o){
        var idx=kfs.objects.indexOf(o);
        if(idx>=0){kfs.objects.splice(idx,1);kfs.objects.unshift(o);}
      });render();}
    }
    break;
  case "play":startPlay();break;
  case "stop":stopPlay();break;
  case "test":testMovie();break;
  case "gotoFirst":curFrame=1;fullRefresh();break;
  case "gotoLast":curFrame=currentMaxFrame();fullRefresh();break;
  case "prefs":
    showApiKeyDialog();
    break;
  // ── Window / workspace ──
  case "winProps":   if(workspace())workspace().toggle("props");break;
  case "winColor":   if(workspace())workspace().toggle("color");break;
  case "winLibrary": if(workspace())workspace().toggle("library");break;
  case "winActions": if(workspace())workspace().toggle("actions");break;
  case "winAI":      if(workspace())workspace().toggle("ai");break;
  case "wsAnimation":if(workspace())workspace().preset("animation");break;
  case "wsDrawing":  if(workspace())workspace().preset("drawing");break;
  case "wsCoding":   if(workspace())workspace().preset("coding");break;
  case "wsReset":    if(workspace())workspace().reset();break;
  case "reportBug":
  case "reportFeature":
    if(!window.Flashy||!Flashy.Feedback){alert("Feedback module not loaded.");break;}
    Flashy.Feedback.open({
      type:a==="reportBug"?"bug":"feature",
      context:buildFeedbackContext()
    });
    break;
  case "mouthSetup":
    showMouthSetupDialog();
    break;
  case "lipSync":
    showLipSyncDialog();
    break;
  case "importSound":
    var sinp=document.createElement("input");
    sinp.type="file";
    sinp.accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac";
    sinp.addEventListener("change",function(){
      if(sinp.files&&sinp.files[0])importSoundFile(sinp.files[0]);
    });
    sinp.click();
    break;
  case "importURL":
    askFor("Import from URL","URL","http://localhost:8000/examples/solar-system.html",function(importUrl){
      if(!importUrl)return;
      {
      var iframe=document.createElement("iframe");
      iframe.style.cssText="position:absolute;left:-9999px;top:-9999px;width:960px;height:540px;border:none;";
      document.body.appendChild(iframe);
      iframe.onload=function(){
        try{
          var iWin=iframe.contentWindow;
          // Wait a short moment for scripts to execute
          setTimeout(function(){
            var fStage=iWin.__stage||iWin.stage;
            if(!fStage){
              // Try to find stage by looking at Flashy on the iframe
              if(iWin.Flashy){
                alert("Could not find __stage on the loaded page.\nMake sure the animation sets: window.__stage = stage;");
              }else{
                alert("The loaded page does not appear to use Flashy.\nNo Flashy library detected.");
              }
              document.body.removeChild(iframe);
              return;
            }
            // Stop the running animation
            fStage.stop();
            importFromStage(fStage);
            document.body.removeChild(iframe);
          },1500);
        }catch(err){
          alert("Failed to access iframe (cross-origin?):\n"+err.message);
          document.body.removeChild(iframe);
        }
      };
      iframe.onerror=function(){
        alert("Failed to load URL: "+importUrl);
        document.body.removeChild(iframe);
      };
      iframe.src=importUrl;
      }
    });
    break;
  }
}
function getBounds(objs){
  var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  objs.forEach(function(o){
    if(o.x<x1)x1=o.x;if(o.y<y1)y1=o.y;
    if(o.x+o.width>x2)x2=o.x+o.width;if(o.y+o.height>y2)y2=o.y+o.height;
  });
  return{x:x1,y:y1,w:x2-x1,h:y2-y1};
}

// === Playback ===
/* ------------------------------------------------------------------ *
 * Audio
 *
 * Sounds attach to keyframes (Flash's model, not a special layer type), so
 * any layer can carry audio and the waveform draws on that layer's frames.
 *
 * The decoded buffers live in Flashy.Sound, keyed by asset name; the document
 * only carries the encoded bytes. Decoding happens on import and again on
 * load, asynchronously — the timeline draws a flat bar until the peaks exist
 * and redraws itself when they do.
 * ------------------------------------------------------------------ */

/** Timeline sounds in the current edit context, as SoundTrack items. */
function soundItems(){
  var items=[];
  currentLayers().forEach(function(l,li){
    if(l.visible===false)return;
    l.keyframes.forEach(function(kf){
      if(!kf.sound||!kf.sound.asset)return;
      var asset=doc.sounds[kf.sound.asset];
      if(!asset)return;
      items.push({
        id:li+":"+kf.index,
        asset:kf.sound.asset,
        startFrame:kf.index,
        endFrame:soundEndFrame(kf),
        sync:kf.sound.sync||"stream",
        volume:kf.sound.volume!=null?kf.sound.volume:1,
        loop:!!kf.sound.loop,
        offset:kf.sound.offset||0
      });
    });
  });
  return items;
}

/** How many frames a keyframe's sound covers: its own length, capped by the span. */
function soundFrameLength(kf){
  if(!kf.sound||!kf.sound.asset)return 0;
  var asset=doc.sounds[kf.sound.asset];
  if(!asset||!asset.duration)return kf.duration;
  return Math.max(1,Math.ceil((asset.duration-(kf.sound.offset||0))*doc.fps));
}
function soundEndFrame(kf){
  // A looping sound runs for the whole keyframe span; otherwise it stops when
  // the audio does, even if the span is longer.
  if(kf.sound&&kf.sound.loop)return kf.index+kf.duration-1;
  return kf.index+Math.min(kf.duration,soundFrameLength(kf))-1;
}

var audioTrack=null;
function ensureTrack(){
  if(typeof Flashy==="undefined"||!Flashy.SoundTrack)return null;
  if(!audioTrack)audioTrack=new Flashy.SoundTrack({fps:doc.fps});
  audioTrack.fps=doc.fps;
  return audioTrack;
}
/** True if any sound is attached anywhere in the current context. */
function hasAudio(){
  return soundItems().length>0;
}

/**
 * Decode an asset so its duration and waveform become available, then redraw.
 * Safe to call repeatedly — Flashy.Sound caches by name.
 */
function decodeAsset(name){
  var asset=doc.sounds[name];
  if(!asset||typeof Flashy==="undefined"||!Flashy.Sound)return Promise.resolve();
  if(Flashy.Sound.has(name))return Promise.resolve();
  return Flashy.Sound.load(name,"data:"+asset.mediaType+";base64,"+asset.data)
    .then(function(buf){
      // The document stores the duration so the timeline can lay sounds out
      // before (or without) a successful decode.
      asset.duration=buf.duration;
      renderTLFrames();
    })
    .catch(function(err){
      if(window.console)console.warn("Flashy: could not decode "+name,err);
    });
}
function decodeAllAssets(){
  Object.keys(doc.sounds||{}).forEach(decodeAsset);
}

/** Import an audio File and attach it to the current keyframe. */
function importSoundFile(file){
  var OK=["audio/mpeg","audio/mp3","audio/wav","audio/wave","audio/x-wav","audio/ogg","audio/webm","audio/mp4","audio/aac","audio/flac"];
  var looksAudio=file&&(file.type.indexOf("audio/")===0||OK.indexOf(file.type)>=0);
  if(!looksAudio){alert("Not an audio file: "+(file?file.name:"(none)"));return Promise.resolve(null);}

  return new Promise(function(resolve){
    var reader=new FileReader();
    reader.onerror=function(){alert("Could not read "+file.name);resolve(null);};
    reader.onload=function(){
      var dataURL=String(reader.result);
      var comma=dataURL.indexOf(",");
      var base64=dataURL.slice(comma+1);
      var name=uniqueSoundName(file.name.replace(/\.[^.]+$/,""));
      var mediaType=file.type||"audio/mpeg";

      // Decode before committing, so a file the browser cannot play is
      // rejected up front instead of becoming a silent asset in the document.
      var load=(typeof Flashy!=="undefined"&&Flashy.Sound)
        ? Flashy.Sound.load(name,dataURL)
        : Promise.reject(new Error("no audio support"));

      load.then(function(buf){
        pushUndo();
        doc.sounds[name]={name:name,mediaType:mediaType,data:base64,duration:buf.duration};
        attachSoundToCurrentKeyframe(name,buf.duration);
        fullRefresh();
        resolve(name);
      }).catch(function(err){
        alert("Could not decode "+file.name+":\n"+((err&&err.message)||err)+
              "\n\nTry MP3, WAV or OGG.");
        resolve(null);
      });
    };
    reader.readAsDataURL(file);
  });
}

function uniqueSoundName(base){
  base=(base||"Sound").trim()||"Sound";
  if(!doc.sounds[base])return base;
  var n=2;
  while(doc.sounds[base+" "+n])n++;
  return base+" "+n;
}

/**
 * Put a sound on the current keyframe, extending the layer so the whole clip
 * has frames to sit on — dropping a 12-second track onto a 1-frame layer and
 * hearing nothing is the obvious trap.
 */
function attachSoundToCurrentKeyframe(assetName,duration){
  var layer=CL();
  if(!layer)return;
  var kf=layer.getKeyframeAt(curFrame)||layer.insertKeyframe(curFrame);
  kf.sound={asset:assetName,sync:"stream",volume:1,loop:false,offset:0};
  var needed=Math.ceil(duration*doc.fps);
  if(kf.duration<needed){
    var grow=needed-kf.duration;
    kf.duration=needed;
    var idx=layer.keyframes.indexOf(kf);
    for(var i=idx+1;i<layer.keyframes.length;i++)layer.keyframes[i].index+=grow;
  }
  if(doc.totalFrames<kf.index+kf.duration-1)doc.totalFrames=kf.index+kf.duration-1;
  selectedKF={layerIdx:currentLayers().indexOf(layer),frameIdx:kf.index,kf:kf};
}

/** Remove an asset from the library and detach every reference to it. */
function deleteSoundAsset(name){
  pushUndo();
  delete doc.sounds[name];
  var scrub=function(layers){
    (layers||[]).forEach(function(l){
      l.keyframes.forEach(function(kf){
        if(kf.sound&&kf.sound.asset===name)kf.sound=null;
      });
    });
  };
  scrub(doc.layers);
  Object.keys(doc.library).forEach(function(k){
    if(doc.library[k]&&doc.library[k].layers)scrub(doc.library[k].layers);
  });
  fullRefresh();
}

/* ------------------------------------------------------------------ *
 * Auto lip sync
 *
 * Scrubbing a frame, listening, picking a mouth, repeating — four to six
 * hours per minute of dialogue, and you redo it every time a line is
 * re-recorded. People bought a separate application (Magpie Pro) purely for
 * this. It is the single biggest time sink in 2D animation.
 *
 * This produces a first pass you then hand-fix, which is the honest promise:
 * speech-shape detection from a waveform is a heuristic, not a transcription.
 * It runs entirely locally — no API key, no upload — because the people who
 * need it most are the least likely to have either.
 *
 * The output is ordinary keyframes holding an ordinary Graphic instance with
 * its frame picked. Nothing about it is special or locked: fix a mouth by
 * selecting the keyframe and changing First, exactly as if you had done the
 * whole pass by hand.
 * ------------------------------------------------------------------ */

/**
 * The shapes this can actually distinguish from a waveform, in the order a
 * mouth sheet usually draws them. Deliberately six rather than the ten of a
 * Preston Blair chart: the extra four are not separable from the signal, and
 * inventing them would just move the hand-fixing somewhere less obvious.
 */
var LIPSYNC_VISEMES=[
  {id:"rest",label:"Rest / closed",hint:"silence"},
  {id:"MBP", label:"M B P",        hint:"lips together"},
  {id:"FV",  label:"F V / S",      hint:"teeth on lip, hiss"},
  {id:"A",   label:"A (ah)",       hint:"open"},
  {id:"E",   label:"E (ee)",       hint:"wide"},
  {id:"O",   label:"O U (oh/oo)",  hint:"round"}
];

/** The mouth chart for a symbol: viseme id → frame of that symbol. */
/**
 * The frames a mouth symbol actually has a distinct drawing on — the start of
 * each keyframe, deduplicated and in order.
 *
 * Not the same as 1..n. If the shapes were drawn on keyframes longer than one
 * frame (8 frames each is what you get by pressing F6 at the default span),
 * frames 1..6 all land inside the *first* keyframe, so every mouth resolves to
 * the same drawing and the mouth never moves.
 */
function mouthFrameCandidates(sym){
  var out=[];
  if(!sym||!sym.layers||!sym.layers.length)return out;
  sym.layers.forEach(function(l){
    (l.keyframes||[]).forEach(function(k){
      var i=Math.max(1,k.index||1);
      if(out.indexOf(i)<0)out.push(i);
    });
  });
  out.sort(function(a,b){return a-b;});
  return out;
}

/**
 * Map each detectable shape to a frame of the mouth symbol.
 *
 * The default walks the symbol's real keyframe starts, so a symbol drawn with
 * multi-frame keyframes works without the user having to know why it wouldn't.
 * A saved chart always wins.
 */
function mouthChartFor(sym){
  var total=symbolTotalFrames(sym);
  var cand=mouthFrameCandidates(sym);
  var chart={};
  LIPSYNC_VISEMES.forEach(function(v,i){
    chart[v.id]=cand.length
      ? cand[Math.min(i,cand.length-1)]
      : Math.min(total,i+1);
  });
  if(sym&&sym.mouthChart){
    LIPSYNC_VISEMES.forEach(function(v){
      var f=parseInt(sym.mouthChart[v.id],10);
      if(f>=1&&f<=total)chart[v.id]=f;
    });
  }
  return chart;
}

/**
 * How many genuinely different drawings a chart resolves to.
 *
 * Two shapes pointing at different frames of the same keyframe are the same
 * picture. Without this the feature can report "18 mouth keyframes written"
 * over a mouth that never opens, which is the worst way for it to fail.
 */
function mouthChartDistinct(sym,chart,ids){
  if(!ids||!ids.length)ids=LIPSYNC_VISEMES.map(function(v){return v.id;});
  var cand=mouthFrameCandidates(sym);
  var seen={},n=0;
  ids.forEach(function(id){
    var f=chart[id]||1,slot=f;
    // Resolve the frame to the keyframe that actually covers it.
    for(var i=cand.length-1;i>=0;i--){if(cand[i]<=f){slot=cand[i];break;}}
    if(!seen[slot]){seen[slot]=1;n++;}
  });
  return n;
}

/**
 * Turn per-frame audio features into viseme ids.
 *
 * Thresholds are relative to the clip's own peak, so a quietly recorded take
 * behaves like a loud one. The vowel split is the textbook formant argument:
 * "ee" puts energy high (F2 ~2300Hz), "oo" keeps it low, "ah" sits in the
 * middle with a strong first formant.
 */
function classifyVisemes(feat,opts){
  opts=opts||{};
  var n=feat.frames;
  var out=new Array(n);
  var peak=feat.peak||1;
  var silence=(opts.silence!=null?opts.silence:0.06)*peak;
  for(var i=0;i<n;i++){
    var rms=feat.rms[i];
    if(rms<silence){out[i]="rest";continue;}
    var lo=feat.low[i],md=feat.mid[i],hi=feat.high[i];
    var tot=lo+md+hi||1;
    var mdR=md/tot;
    // Second formant relative to the first. This is the measurement that
    // separates "ee" from "oo" — both put most of their energy low, so a
    // plain low-band test cannot tell them apart (and originally didn't).
    var f2f1=hi/(lo+1e-6);

    // Fricatives first: zero-crossing rate is the feature that detects them,
    // and a loud "ee" would otherwise look like one on spectrum alone.
    if(feat.zcr[i]>0.10&&f2f1>1.2){out[i]="FV";continue;}
    // Open vowels push the first formant up into the mid band.
    if(mdR>0.55){out[i]="A";continue;}
    // Front vowels carry a strong second formant.
    out[i]=f2f1>0.30?"E":"O";
  }
  return out;
}

/**
 * Clean up the raw per-frame guesses.
 *
 * Two jobs. A median pass removes single-frame flicker, which reads as a
 * twitch rather than speech. Then runs shorter than `minHold` are absorbed
 * into their neighbour — a mouth shape that lasts one frame at 24fps is not
 * animation, it is noise, and this is the setting animators reach for first.
 *
 * Short silences *between* speech become MBP rather than rest: a gap that
 * brief is a lip closure, not a pause, and getting that wrong is the most
 * visible lip-sync error there is.
 */
function smoothVisemes(seq,opts){
  opts=opts||{};
  var minHold=Math.max(1,opts.minHold||2);
  var n=seq.length;
  if(!n)return seq;
  var v=seq.slice();

  // Median-of-3.
  for(var i=1;i<n-1;i++){
    if(v[i]!==v[i-1]&&v[i-1]===v[i+1])v[i]=v[i-1];
  }

  // Short internal silences are closures.
  var runs=visemeRuns(v);
  for(var r=1;r<runs.length-1;r++){
    if(runs[r].id==="rest"&&runs[r].length<=Math.max(2,minHold)&&
       runs[r-1].id!=="rest"&&runs[r+1].id!=="rest"){
      runs[r].id="MBP";
    }
  }

  // Absorb runs that are too short to read, preferring to extend whichever
  // neighbour is longer so the result holds rather than stutters.
  var changed=true,guard=0;
  while(changed&&guard++<12){
    changed=false;
    for(var k=0;k<runs.length;k++){
      if(runs[k].length>=minHold||runs.length<2)continue;
      var prev=runs[k-1],next=runs[k+1];
      var into=(!prev)?next:(!next?prev:(prev.length>=next.length?prev:next));
      into.length+=runs[k].length;
      runs.splice(k,1);
      changed=true;
      break;
    }
  }
  // Merge neighbours that ended up the same shape.
  for(var m=runs.length-1;m>0;m--){
    if(runs[m].id===runs[m-1].id){runs[m-1].length+=runs[m].length;runs.splice(m,1);}
  }
  return runs;
}

/** Collapse a per-frame array into [{id,length}] runs. */
function visemeRuns(v){
  var runs=[];
  for(var i=0;i<v.length;i++){
    if(runs.length&&runs[runs.length-1].id===v[i])runs[runs.length-1].length++;
    else runs.push({id:v[i],length:1});
  }
  return runs;
}

/**
 * Analyse a sound and write mouth keyframes onto a layer.
 *
 * `opts`: {assetName, startFrame, symbolName, layerIndex, minHold, silence,
 *          template} — `template` is an existing instance whose position and
 * size the generated mouths inherit, so the mouth stays on the face.
 *
 * Returns a summary, or null if it could not run.
 */
function generateLipSync(opts){
  opts=opts||{};
  var asset=doc.sounds[opts.assetName];
  var sym=doc.library[opts.symbolName];
  if(!asset||!sym)return null;
  if(typeof Flashy==="undefined"||!Flashy.Sound||!Flashy.Sound.has(opts.assetName))return null;

  var startFrame=Math.max(1,opts.startFrame||1);
  var feat=Flashy.Sound.analyze(opts.assetName,{fps:doc.fps,offset:opts.offset||0});
  if(!feat||!feat.frames)return null;

  var runs=smoothVisemes(classifyVisemes(feat,opts),opts);
  var chart=mouthChartFor(sym);

  var layers=currentLayers();
  var li=opts.layerIndex;
  var layer;
  if(li==null||li<0||li>=layers.length){
    layer=new Layer(opts.layerName||("Mouth — "+opts.symbolName));
    layers.splice(0,0,layer);
    li=0;
  }else{
    layer=layers[li];
  }

  // Position: reuse an existing instance if there is one, so the mouth lands
  // on the face rather than in the corner.
  var tpl=opts.template;
  if(!tpl){
    // Search the target layer first, then every other layer. "New layer" —
    // the default — means the target is empty, so a layer-only search always
    // missed and the mouth was placed at an arbitrary spot rather than on the
    // face the user already positioned it on.
    var search=[layer].concat(layers.filter(function(l){return l!==layer;}));
    for(var si=0;si<search.length&&!tpl;si++){
      var kfl=search[si].keyframes||[];
      for(var ki=0;ki<kfl.length&&!tpl;ki++){
        var objs=kfl[ki].objects||[];
        for(var oi=0;oi<objs.length;oi++){
          if(objs[oi].type==="symbol"&&objs[oi].symbolName===opts.symbolName){tpl=objs[oi];break;}
        }
      }
    }
  }

  // Replace any frames this pass covers; leave the rest of the layer alone.
  var endFrame=startFrame+runs.reduce(function(a,r){return a+r.length;},0)-1;
  // Any sound on a keyframe we are about to drop has to survive. Importing a
  // sound attaches it to the current layer, so the layer holding the voice
  // track is a very normal thing to target — and losing it would silently
  // remove the audio this pass was syncing to.
  var rescued=[];
  layer.keyframes.forEach(function(kf){
    var covered=!(kf.index+kf.duration-1<startFrame||kf.index>endFrame);
    if(covered&&kf.sound)rescued.push({index:kf.index,sound:kf.sound});
  });
  layer.keyframes=layer.keyframes.filter(function(kf){
    return kf.index+kf.duration-1<startFrame||kf.index>endFrame;
  });

  var frame=startFrame;
  runs.forEach(function(run){
    var kf=new KeyFrame(frame);
    kf.duration=run.length;
    var o=tpl?tpl.clone():new EditorObject("symbol");
    o.type="symbol";
    o.symbolName=opts.symbolName;
    if(!tpl){
      o.width=o.width||120;o.height=o.height||80;
      o.x=Math.round((doc.width-o.width)/2);
      o.y=Math.round(doc.height*0.62);
    }
    // Single-frame Graphic: the pose is chosen per keyframe, which is exactly
    // what a hand-made lip-sync track looks like.
    o.symbolBehavior="graphic";
    o.loopMode="single";
    o.firstFrame=chart[run.id]||1;
    o.instanceName=o.instanceName||"mouth";
    kf.objects=[o];
    layer.keyframes.push(kf);
    frame+=run.length;
  });
  layer.keyframes.sort(function(a,b){return a.index-b.index;});

  // Put each rescued sound back on whichever new keyframe covers where it was.
  rescued.forEach(function(r){
    var host=null;
    layer.keyframes.forEach(function(kf){
      if(r.index>=kf.index&&r.index<kf.index+kf.duration)host=kf;
    });
    if(!host)host=layer.keyframes[0];
    if(host&&!host.sound)host.sound=r.sound;
  });

  if(doc.totalFrames<endFrame)doc.totalFrames=endFrame;

  // How many different mouths this pass can actually show, and how many it
  // wanted to. If these disagree the track is written but the mouth barely
  // moves, so the caller has to be able to say so.
  var wanted={};
  runs.forEach(function(r){wanted[r.id]=1;});
  var usedIds=Object.keys(wanted);
  return {
    layerIndex:layers.indexOf(layer),
    keyframes:runs.length,
    startFrame:startFrame,
    endFrame:endFrame,
    runs:runs,
    chart:chart,
    shapesUsed:usedIds.length,
    shapesVisible:mouthChartDistinct(sym,chart,usedIds)
  };
}

/** Every sound placed on the current timeline, for the lip-sync picker. */
function placedSounds(){
  var out=[];
  currentLayers().forEach(function(l,li){
    l.keyframes.forEach(function(kf){
      if(kf.sound&&kf.sound.asset&&doc.sounds[kf.sound.asset]){
        out.push({asset:kf.sound.asset,startFrame:kf.index,layerIndex:li,offset:kf.sound.offset||0});
      }
    });
  });
  return out;
}

/**
 * The Auto Lip Sync dialog.
 *
 * Deliberately short: the two choices that matter are which voice track and
 * which mouth symbol. Everything else has a working default, and the mouth
 * chart is behind its own button because you set it once per character and
 * never again.
 */
function showLipSyncDialog(){
  var sounds=placedSounds();
  if(!sounds.length){
    showMessage("Auto Lip Sync",
      "Put a sound on the timeline first — File ▸ Import Sound, or drop an audio file onto the timeline.");
    return;
  }
  var symbols=Object.keys(doc.library);
  if(!symbols.length){
    showMessage("Auto Lip Sync",
      "Auto lip sync needs a mouth symbol. Draw the mouth, convert it to a symbol, "+
      "then use Modify ▸ Set Up Mouth Shapes to give it a frame per shape.");
    return;
  }

  var layers=currentLayers();
  var layerOpts=[["-1","New layer"]].concat(layers.map(function(l,i){return [String(i),l.name];}));
  var soundOpts=sounds.map(function(s,i){
    return [String(i),s.asset+"  (frame "+s.startFrame+")"];
  });
  var symOpts=symbols.map(function(n){
    return [n,n+"  ("+symbolTotalFrames(doc.library[n])+" frames)"];
  });

  showDialog({
    title:"Auto Lip Sync",
    message:"Reads the voice track and writes mouth keyframes. It is a first pass — "+
            "expect to fix a few by hand, which you do by selecting a keyframe and changing First.",
    fields:[
      {name:"sound",label:"Voice",type:"select",value:"0",options:soundOpts},
      {name:"symbol",label:"Mouth",type:"select",value:symbols[0],options:symOpts},
      {name:"layer",label:"Onto",type:"select",value:"-1",options:layerOpts,
       hint:"Existing frames in the range are replaced."},
      {name:"hold",label:"Min hold",type:"number",value:2,min:1,max:12,
       hint:"Shortest a mouth shape may last, in frames. Raise it if the result chatters."},
      {name:"sens",label:"Silence",type:"number",value:6,min:1,max:40,
       hint:"Percent of the loudest moment counted as silence. Raise it for a noisy recording."}
    ],
    extraButtons:[
      {label:"Mouth chart…",
       onClick:function(v){showMouthChartDialog(v.symbol,function(){showLipSyncDialog();});}},
      {label:"Set up shapes…",
       onClick:function(){showMouthSetupDialog(function(){showLipSyncDialog();});}}
    ],
    okLabel:"Generate",
    onOk:function(v){
      var pick=sounds[parseInt(v.sound,10)]||sounds[0];
      pushUndo();
      var res=generateLipSync({
        assetName:pick.asset,
        startFrame:pick.startFrame,
        offset:pick.offset,
        symbolName:v.symbol,
        layerIndex:parseInt(v.layer,10),
        minHold:Math.max(1,parseInt(v.hold,10)||2),
        silence:Math.max(0.01,(parseFloat(v.sens)||6)/100)
      });
      if(!res){
        showMessage("Auto Lip Sync",
          "Could not analyse that sound. It may still be decoding — try again in a moment.");
        return;
      }
      curLayer=res.layerIndex;
      fullRefresh();
      var note=res.keyframes+" mouth keyframes written across frames "+
               res.startFrame+"–"+res.endFrame+". Scrub the timeline to check it — "+
               "to fix any mouth, select its keyframe and change First in Properties.";
      if(res.shapesVisible<res.shapesUsed){
        // The chart points several shapes at the same drawing, so the track is
        // there but the mouth will hardly move. Worth interrupting for: it
        // otherwise looks like the detection failed.
        note="Heads up: this pass used "+res.shapesUsed+" mouth shapes but “"+
             v.symbol+"” only shows "+res.shapesVisible+
             " different drawing(s) for them, so the mouth will barely move.\n\n"+
             "Open Mouth chart… and point each shape at a frame where that mouth "+
             "is actually drawn. "+note;
      }
      showMessage("Auto Lip Sync",note,{okLabel:"Done"});
    }
  });
}

/**
 * Prepare an existing symbol to be used as a mouth.
 *
 * Auto lip sync needs one distinct drawing per mouth shape, on frames it can
 * name. Nothing in the editor set that up, so the only way to get there was to
 * know the convention and build it by hand — and getting it subtly wrong (one
 * drawing spread over an 8-frame keyframe, say) produced a track that looked
 * written but never moved the mouth.
 *
 * Existing artwork is never discarded: missing shapes are seeded with a copy of
 * a drawing already in the symbol, so the animator edits rather than starts
 * over.
 *
 * opts: {symbolName, create (bool), tighten (bool)}
 */
function setupMouthShapes(opts){
  opts=opts||{};
  var sym=doc.library[opts.symbolName];
  if(!sym)return null;
  ensureSymbolLayers(sym);
  var layer=sym.layers[0];
  if(!layer)return null;

  var need=LIPSYNC_VISEMES.length;
  var created=0,tightened=0;

  if(opts.tighten){
    // One drawing per frame, so "frame N is the A mouth" is literally true.
    // Done before creating, so the new frames land in a tidy sequence.
    var next=1;
    layer.keyframes.sort(function(a,b){return a.index-b.index;});
    layer.keyframes.forEach(function(kf){
      if(kf.index!==next||kf.duration!==1)tightened++;
      kf.index=next;
      kf.duration=1;
      next++;
    });
  }

  if(opts.create){
    var have=mouthFrameCandidates(sym).length;
    while(have<need){
      // Seed from the last drawing so there is something to modify. A blank
      // frame would render as nothing, which reads as a broken mouth.
      var last=layer.keyframes[layer.keyframes.length-1];
      var kf=last?last.clone():new KeyFrame(1);
      kf.index=layer.getFrameEnd()+1;
      kf.duration=1;
      kf.sound=null;
      kf.script="";
      layer.keyframes.push(kf);
      created++;
      have++;
    }
    layer.keyframes.sort(function(a,b){return a.index-b.index;});
  }

  var cand=mouthFrameCandidates(sym);
  // Chart the first six distinct drawings; a symbol with more keeps the extras
  // for the animator to point shapes at by hand.
  sym.mouthChart={};
  LIPSYNC_VISEMES.forEach(function(v,i){
    sym.mouthChart[v.id]=cand.length?cand[Math.min(i,cand.length-1)]:1;
  });

  var end=layer.getFrameEnd();
  if(!sym.totalFrames||sym.totalFrames<end)sym.totalFrames=end;

  return {
    symbolName:opts.symbolName,
    created:created,
    tightened:tightened,
    frames:cand.slice(0,need),
    chart:sym.mouthChart,
    distinct:mouthChartDistinct(sym,sym.mouthChart)
  };
}

/**
 * The Set Up Mouth Shapes dialog — turn a symbol you already have into one
 * auto lip sync can drive.
 */
function showMouthSetupDialog(onDone){
  var symbols=Object.keys(doc.library);
  if(!symbols.length){
    showMessage("Set Up Mouth Shapes",
      "There are no symbols yet. Draw the mouth, select it, then Modify ▸ "+
      "Convert to Symbol — and run this again to add a frame per mouth shape.");
    return;
  }

  var symOpts=symbols.map(function(n){
    var sym=doc.library[n];
    var have=mouthFrameCandidates(sym).length;
    return [n,n+"  ("+have+" drawing"+(have===1?"":"s")+")"];
  });

  showDialog({
    title:"Set Up Mouth Shapes",
    message:"Gives a symbol one frame per mouth shape and points the mouth chart "+
            "at them, so Auto Lip Sync has something to drive. Your existing "+
            "artwork is kept — new frames start as a copy of it for you to edit.",
    fields:[
      {name:"symbol",label:"Symbol",type:"select",value:symbols[0],options:symOpts},
      {name:"create",label:"Missing shapes",type:"select",value:"1",options:[
        ["1","Add a frame for each one"],
        ["0","Leave the frames as they are"]
      ],hint:"There are "+LIPSYNC_VISEMES.length+" shapes: "+
            LIPSYNC_VISEMES.map(function(v){return v.label;}).join(", ")+"."},
      {name:"tighten",label:"Frame lengths",type:"select",value:"0",options:[
        ["0","Leave them alone"],
        ["1","Make each drawing one frame long"]
      ],hint:"Shapes drawn on long keyframes are the usual reason a synced mouth "+
            "does not move. Tightening renumbers this symbol's frames."},
      {name:"open",label:"Afterwards",type:"select",value:"1",options:[
        ["1","Open the symbol so I can draw the shapes"],
        ["0","Stay on the main timeline"]
      ]}
    ],
    okLabel:"Set up",
    onOk:function(v){
      pushUndo();
      var res=setupMouthShapes({
        symbolName:v.symbol,
        create:v.create==="1",
        tighten:v.tighten==="1"
      });
      if(!res){
        showMessage("Set Up Mouth Shapes","Could not read that symbol.");
        return;
      }
      fullRefresh();

      var lines=[];
      if(res.created)lines.push("Added "+res.created+" frame(s), copied from the drawing already there.");
      if(res.tightened)lines.push("Renumbered the symbol so each drawing is one frame.");
      lines.push("Mouth chart: "+LIPSYNC_VISEMES.map(function(vi){
        return vi.label+"→"+res.chart[vi.id];
      }).join(", ")+".");
      if(res.distinct<LIPSYNC_VISEMES.length){
        lines.push("");
        lines.push("Note: only "+res.distinct+" of the "+LIPSYNC_VISEMES.length+
                   " shapes resolve to a different drawing, so the mouth will not "+
                   "move much yet. Draw the remaining frames, or re-run with "+
                   "“Add a frame for each one”.");
      }
      if(v.open==="1"){
        lines.push("");
        lines.push("Opening “"+v.symbol+"” — each frame is one mouth shape, in the "+
                   "order above. Use the Scene 1 breadcrumb to come back.");
      }

      showMessage("Set Up Mouth Shapes",lines.join("\n"),{okLabel:"Got it",onOk:function(){
        if(v.open==="1")enterSymbol(v.symbol);
        if(onDone)onDone();
      }});
    },
    extraButtons:[{
      label:"Mouth chart…",
      onClick:function(v){showMouthChartDialog(v.symbol,function(){showMouthSetupDialog(onDone);});}
    }],
    onCancel:onDone
  });
}

/** Map each detectable shape to a frame of the mouth symbol. */
function showMouthChartDialog(symbolName,onDone){
  var sym=doc.library[symbolName];
  if(!sym){if(onDone)onDone();return;}
  var total=symbolTotalFrames(sym);
  var chart=mouthChartFor(sym);
  showDialog({
    title:"Mouth chart — "+symbolName,
    message:"Which frame of this symbol draws each shape. Set once per character; "+
            "it is saved with the symbol.",
    fields:LIPSYNC_VISEMES.map(function(v){
      return {name:v.id,label:v.label,type:"number",value:chart[v.id],min:1,max:total,
              hint:v.hint};
    }),
    validate:function(v){
      for(var i=0;i<LIPSYNC_VISEMES.length;i++){
        var f=parseInt(v[LIPSYNC_VISEMES[i].id],10);
        if(!(f>=1&&f<=total))return "Frames must be between 1 and "+total+".";
      }
      return null;
    },
    onOk:function(v){
      pushUndo();
      sym.mouthChart={};
      LIPSYNC_VISEMES.forEach(function(vi){
        sym.mouthChart[vi.id]=parseInt(v[vi.id],10);
      });
      if(onDone)onDone();
    },
    onCancel:onDone
  });
}

/* ---- Scrubbing ----------------------------------------------------- *
 * Dragging the playhead plays a slice of the sound under it. This is how
 * you find the frame where "b" becomes "p"; without it, lip syncing is
 * guesswork. Slices are throttled to one per frame step so a fast drag does
 * not spawn hundreds of overlapping sources.
 * -------------------------------------------------------------------- */
var _scrubLast=-1,_scrubHandle=null,_scrubTimer=null;
function audioScrub(frame){
  if(typeof Flashy==="undefined"||!Flashy.Sound||!Flashy.Sound.ready())return;
  if(frame===_scrubLast)return;
  _scrubLast=frame;
  var items=soundItems();
  for(var i=0;i<items.length;i++){
    var it=items[i];
    if(frame<it.startFrame||frame>it.endFrame)continue;
    if(_scrubHandle){Flashy.Sound.stop(_scrubHandle);_scrubHandle=null;}
    if(_scrubTimer){clearTimeout(_scrubTimer);_scrubTimer=null;}
    var SLICE=Math.max(0.06,1/doc.fps);
    _scrubHandle=Flashy.Sound.play(it.asset,{
      offset:(frame-it.startFrame)/doc.fps+(it.offset||0),
      volume:it.volume,
      duration:SLICE
    });
    var h=_scrubHandle;
    _scrubTimer=setTimeout(function(){
      if(_scrubHandle===h){Flashy.Sound.stop(h);_scrubHandle=null;}
    },SLICE*1000+40);
    return;
  }
}
function endScrub(){
  _scrubLast=-1;
  if(_scrubHandle){Flashy.Sound.stop(_scrubHandle);_scrubHandle=null;}
  if(_scrubTimer){clearTimeout(_scrubTimer);_scrubTimer=null;}
}

/* ------------------------------------------------------------------ *
 * Playback
 *
 * When a stream sound is playing, the playhead is derived from the AUDIO
 * clock, not a timer. That is what Stream sync means: the animation follows
 * the sound and drops frames if it has to, rather than drifting away from it.
 * With no audio, the same loop runs off performance.now(), which is still an
 * improvement on the old setInterval — that drifted and ignored an FPS change
 * made mid-play.
 * ------------------------------------------------------------------ */
var _playRAF=null;
function startPlay(){
  if(playing)return;
  playing=true;
  endScrub();

  var track=ensureTrack();
  if(track)track.setItems(soundItems());

  var startFrame=curFrame;
  var maxF=currentMaxFrame();
  if(startFrame>=maxF)startFrame=curFrame=1;
  var t0=(typeof performance!=="undefined"?performance.now():Date.now());
  var seeked=true;

  function step(){
    if(!playing)return;
    var now=(typeof performance!=="undefined"?performance.now():Date.now());
    var frame;
    var audioFrame=track?track.frameFromAudio(curFrame):null;
    if(audioFrame!=null&&isFinite(audioFrame)){
      frame=Math.floor(audioFrame);
    }else{
      frame=startFrame+Math.floor((now-t0)/1000*doc.fps);
    }
    if(frame>maxF){
      // Loop: restart the clock and re-seek the audio.
      startFrame=1;t0=now;frame=1;seeked=true;
      if(track)track.stopAll();
    }
    if(frame<1)frame=1;
    if(frame!==curFrame||seeked){
      curFrame=frame;
      if(track)track.update(curFrame,seeked);
      seeked=false;
      render();updateTL();
      tlScrollToFrame(curFrame);
    }
    _playRAF=requestAnimationFrame(step);
  }
  // Audio needs a user gesture; Play is one.
  if(typeof Flashy!=="undefined"&&Flashy.Sound&&hasAudio()){
    Flashy.Sound.unlock().then(function(){
      if(track)track.update(curFrame,true);
    });
  }
  _playRAF=requestAnimationFrame(step);
}
function stopPlay(){
  if(!playing)return;
  playing=false;
  if(_playRAF){cancelAnimationFrame(_playRAF);_playRAF=null;}
  if(playTimer){clearInterval(playTimer);playTimer=null;}
  if(audioTrack)audioTrack.stopAll();
  fullRefresh();
}

// === Keyboard Shortcuts ===
function initKeys(){
  // Use capture phase to intercept F5/F6/F7 before browser handles them
  window.addEventListener("keydown",function(e){
    // Intercept F-keys early to prevent browser refresh (F5) etc.
    if(e.key==="F5"||e.key==="F6"||e.key==="F7"||e.key==="F8"){
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;
      e.preventDefault();
      e.stopPropagation();
    }
  },true); // capture = true
  document.addEventListener("keydown",function(e){
    // Don't handle if typing in input
    if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")return;
    var ctrl=e.ctrlKey||e.metaKey;
    if(ctrl&&e.key==="z"){e.preventDefault();doAction("undo");return;}
    if(ctrl&&e.key==="y"){e.preventDefault();doAction("redo");return;}
    if(ctrl&&e.key==="s"){e.preventDefault();doAction("save");return;}
    if(ctrl&&e.key==="a"){e.preventDefault();doAction("selectAll");return;}
    if(ctrl&&e.key==="x"){e.preventDefault();doAction("cut");return;}
    if(ctrl&&e.key==="c"){e.preventDefault();doAction("copy");return;}
    if(ctrl&&e.key==="v"){e.preventDefault();doAction("paste");return;}
    if(ctrl&&e.key==="Enter"){e.preventDefault();doAction("test");return;}
    if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();doAction("delete");return;}
    if(e.key==="Enter"){e.preventDefault();if(playing)doAction("stop");else doAction("play");return;}
    if(e.key==="Escape"){if(editStack.length>0){exitSymbol();}else{selection=[];stopPlay();}fullRefresh();return;}
    if(e.key==="F5"){e.preventDefault();doAction("insFrame");return;}
    if(e.key==="F6"){e.preventDefault();if(e.shiftKey)doAction("removeKF");else doAction("insKF");return;}
    if(e.key==="F7"){e.preventDefault();doAction("insBlankKF");return;}
    // Flash's panel shortcuts. Ctrl+L is a browser shortcut in some browsers
    // and may not reach us there; it works in the desktop build.
    if(e.key==="F9"){e.preventDefault();doAction(e.shiftKey?"winColor":"winActions");return;}
    if(ctrl&&e.key==="F3"){e.preventDefault();doAction("winProps");return;}
    if(ctrl&&(e.key==="l"||e.key==="L")){e.preventDefault();doAction("winLibrary");return;}
    if(e.key==="F8"){e.preventDefault();if(ctrl)doAction("newSymbol");else doAction("convertSym");return;}
    if(e.key==="Home"){e.preventDefault();doAction("gotoFirst");return;}
    if(e.key==="End"){e.preventDefault();doAction("gotoLast");return;}
    // Arrow keys move selection or scrub timeline
    if(e.key==="ArrowRight"){
      if(selection.length>0){pushUndo();selection.forEach(function(o){o.x+=(e.shiftKey?10:1);});render();}
      else{curFrame=Math.min(curFrame+1,currentMaxFrame());fullRefresh();}
      return;
    }
    if(e.key==="ArrowLeft"){
      if(selection.length>0){pushUndo();selection.forEach(function(o){o.x-=(e.shiftKey?10:1);});render();}
      else{curFrame=Math.max(curFrame-1,1);fullRefresh();}
      return;
    }
    if(e.key==="ArrowUp"){
      if(selection.length>0){pushUndo();selection.forEach(function(o){o.y-=(e.shiftKey?10:1);});render();}
      return;
    }
    if(e.key==="ArrowDown"){
      if(selection.length>0){pushUndo();selection.forEach(function(o){o.y+=(e.shiftKey?10:1);});render();}
      return;
    }
    // Tool shortcuts
    var toolKey=e.key.toLowerCase();
    TOOLS.forEach(function(t){
      if(t.key===toolKey)setTool(t.id);
    });
  });
}

// === Serialization ===
//
// Scene layers and library-symbol layers are the SAME shape and go through the
// same pair of functions in both directions. They used not to: the scene was
// revived through the Layer/KeyFrame/EditorObject constructors while
// doc.library was assigned straight off the parsed JSON, which left symbol
// layers as plain objects with no prototype. Entering such a symbol then threw
// on `l.getKeyframeAt(...)`, so saving a document, reopening it and
// double-clicking a symbol you had edited crashed the editor.
function plainObj(o){
  var r={};
  Object.keys(o).forEach(function(k){
    var v=o[k];r[k]=Array.isArray(v)?v.slice():v;
  });
  return r;
}
function serializeLayers(layers){
  return (layers||[]).map(function(l){
    return{
      name:l.name,visible:l.visible,locked:l.locked,
      layerType:l.layerType,outlineColor:l.outlineColor,layerHeight:l.layerHeight,
      keyframes:l.keyframes.map(function(kf){
        return{
          index:kf.index,duration:kf.duration,
          tweenType:kf.tweenType,easing:kf.easing,
          script:kf.script,
          sound:kf.sound?cloneSound(kf.sound):null,
          objects:kf.objects.map(plainObj)
        };
      })
    };
  });
}
function serializeLibrary(lib){
  var out={};
  Object.keys(lib||{}).forEach(function(name){
    var sym=lib[name];
    if(!sym)return;
    out[name]={
      // `objects` is the flattened frame-1 view kept for the exporters and for
      // documents written before symbols had their own timelines; `layers` is
      // the real content once the symbol has been opened for editing.
      objects:(sym.objects||[]).map(plainObj),
      layers:sym.layers?serializeLayers(sym.layers):null,
      totalFrames:sym.totalFrames||60,
      behavior:sym.behavior||"movieclip",
      // Set once per character and reused for every line they speak.
      mouthChart:sym.mouthChart||null
    };
  });
  return out;
}
/**
 * Audio assets. Only the encoded bytes and the duration are stored — peaks are
 * recomputed from the decoded buffer on load, which keeps documents far
 * smaller than caching a waveform would.
 */
function serializeSounds(sounds){
  var out={};
  Object.keys(sounds||{}).forEach(function(name){
    var a=sounds[name];
    if(!a||!a.data)return;
    out[name]={name:name,mediaType:a.mediaType||"audio/mpeg",data:a.data,duration:a.duration||0};
  });
  return out;
}
function reviveSounds(sounds){
  var out={};
  Object.keys(sounds||{}).forEach(function(name){
    var a=sounds[name];
    if(!a||!a.data)return;
    out[name]={name:name,mediaType:a.mediaType||"audio/mpeg",data:a.data,duration:a.duration||0};
  });
  return out;
}
function serializeDoc(){
  return{
    width:doc.width,height:doc.height,fps:doc.fps,
    backgroundColor:doc.backgroundColor,
    totalFrames:doc.totalFrames,
    layers:serializeLayers(doc.layers),
    library:serializeLibrary(doc.library),
    // Audio travels inside the document, so a .flashy stays one file.
    sounds:serializeSounds(doc.sounds)
  };
}
function reviveObject(od){
  var o=new EditorObject(od.type);
  Object.keys(od).forEach(function(k){
    var v=od[k];o[k]=Array.isArray(v)?v.slice():v;
  });
  normalizeObjPoints(o);
  return o;
}
function reviveKeyframe(kd){
  var kf=new KeyFrame(kd.index||1);
  kf.duration=kd.duration||1;
  kf.tweenType=kd.tweenType||"none";
  kf.easing=kd.easing||"linear";
  kf.script=kd.script||"";
  kf.sound=(kd.sound&&kd.sound.asset)?cloneSound(kd.sound):null;
  kf.objects=(kd.objects||[]).map(reviveObject);
  return kf;
}
function reviveLayers(arr){
  return (arr||[]).map(function(ld){
    var l=new Layer(ld.name||"Layer 1");
    l.visible=ld.visible!==false;
    l.locked=!!ld.locked;
    if(ld.layerType)l.layerType=ld.layerType;
    if(ld.outlineColor)l.outlineColor=ld.outlineColor;
    if(ld.layerHeight)l.layerHeight=ld.layerHeight;
    var kfs=(ld.keyframes||[]).map(reviveKeyframe);
    // A layer with no keyframes at all would make getKeyframeAt() return null
    // forever, so the layer would be permanently unusable.
    l.keyframes=kfs.length?kfs:[new KeyFrame(1)];
    return l;
  });
}
function reviveLibrary(lib){
  var out={};
  Object.keys(lib||{}).forEach(function(name){
    var sd=lib[name];
    if(!sd)return;
    out[name]={
      objects:(sd.objects||[]).map(reviveObject),
      layers:sd.layers?reviveLayers(sd.layers):null,
      totalFrames:sd.totalFrames||60,
      behavior:sd.behavior||"movieclip",
      mouthChart:sd.mouthChart||null
    };
  });
  return out;
}
// Legacy docs stored pencil/brush points as absolute stage coords; the
// current format is relative to the object's top-left (min point = 0,0).
// Shifting by the min is a no-op on current-format data, so this is
// safe to run on every deserialize (including undo/redo).
function normalizeObjPoints(o){
  if((o.type!=="pencil"&&o.type!=="brush")||!o.points||o.points.length<2)return;
  var mx=Infinity,my=Infinity;
  for(var i=0;i<o.points.length;i+=2){
    if(o.points[i]<mx)mx=o.points[i];
    if(o.points[i+1]<my)my=o.points[i+1];
  }
  if(mx===0&&my===0)return;
  for(var j=0;j<o.points.length;j+=2){o.points[j]-=mx;o.points[j+1]-=my;}
}
function deserializeDoc(d){
  doc.width=d.width||550;doc.height=d.height||400;
  doc.fps=d.fps||24;doc.backgroundColor=d.backgroundColor||"#FFFFFF";
  doc.totalFrames=d.totalFrames||60;
  doc.library=reviveLibrary(d.library);
  doc.sounds=reviveSounds(d.sounds);
  doc.layers=reviveLayers(d.layers);
  // Decoding is async; the timeline draws flat bars until the peaks land and
  // redraws itself when they do.
  decodeAllAssets();
  if(!doc.layers.length)doc.layers=[new Layer("Layer 1")];
}
// Replace the open document with one parsed from a .flashy payload. Shared by
// File ▸ Open and, on the desktop, by files handed to us by the shell.
function loadDocFromObject(d){
  if(audioTrack)audioTrack.stopAll();
  deserializeDoc(d);
  curFrame=1;curLayer=0;selection=[];
  undoStack=[];redoStack=[];editStack=[];
  // The incoming document can have a different stage size, and the pan is
  // still set for the old one — opening a 1920×1080 file while a 550×400 one
  // was loaded would leave the stage hanging off the side of the view.
  centerStage();
  // A freshly loaded document is, by definition, identical to what is on disk.
  markSaved();
  updateBreadcrumb();fullRefresh();
}
// Save `content` — a string, or a Blob for binary output like the MP4/WebM
// recording — as a download named `name`.
//
// Every export path funnels through here rather than building its own
// <a download>, which is what lets the desktop build route the whole File ▸
// Export menu through native Save dialogs in one place.
function dlFile(content,name,mime){
  if(desktopHost){desktopHost.saveFile(content,name,mime);return;}
  var blob=new Blob([content],{type:mime});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download=name;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function buildFeedbackContext(){
  try{
    var layers=currentLayers();
    return {
      source:"editor",
      doc:{width:doc.width,height:doc.height,fps:doc.fps,totalFrames:doc.totalFrames,
           backgroundColor:doc.backgroundColor,
           layerCount:doc.layers.length,librarySymbols:Object.keys(doc.library||{}).length},
      edit:{nestingDepth:editStack.length,
            activeLayerCount:layers?layers.length:0,
            currentLayer:curLayer,currentFrame:curFrame,
            selectionCount:selection?selection.length:0},
      tool:typeof curTool!=="undefined"?curTool:null
    };
  }catch(e){return {source:"editor",error:e.message};}
}
var _cachedEngineSource=null;
function getEngineSource(callback){
  if(_cachedEngineSource){callback(_cachedEngineSource);return;}
  fetch("flashy.js").then(function(r){return r.text();}).then(function(src){
    _cachedEngineSource=src;callback(src);
  }).catch(function(){
    callback("/* flashy.js could not be loaded — export may not work standalone */");
  });
}
/* ------------------------------------------------------------------ *
 * exportRuntime — the player that every code export ships
 *
 * This is ordinary, readable, breakpoint-able code that gets serialised into
 * the output with Function.prototype.toString(). It replaces ~130 lines of
 * string concatenation that had quietly drifted away from the editor's own
 * renderer in three ways:
 *
 *   * symbol instances ignored x/y/rotation/scale/alpha entirely, so every
 *     symbol in an exported file stacked up at the stage origin;
 *   * transforms were applied about each object's top-left while the stage
 *     applies them about its centre, so rotated art moved on export;
 *   * frame scripts were never emitted at all, so a `stop()` on the last
 *     frame did nothing and the animation just looped.
 *
 * There is no bundler or minifier in this project — the source files *are* the
 * build output — so serialising a live function is safe here.
 * ------------------------------------------------------------------ */
function exportRuntime(data, canvas, options) {
  options = options || {};
  var SYM_MAX_DEPTH = 8;
  var stage = new Flashy.Stage(canvas, {
    width: data.width,
    height: data.height,
    fps: options.fps || data.fps,
    backgroundColor: parseInt(String(data.backgroundColor || "#ffffff").replace("#", ""), 16)
  });
  var root = stage.root;
  var easing = Flashy.Easing;

  function hex(c, dflt) { return parseInt(String(c || dflt).replace("#", ""), 16); }

  /** What a library symbol shows on its own `frame`, bottom layer first. */
  function symbolObjects(sym, frame) {
    if (!sym) return [];
    if (!sym.layers) return sym.objects || [];
    frame = frame || 1;
    var out = [];
    for (var i = sym.layers.length - 1; i >= 0; i--) {
      var l = sym.layers[i];
      if (!l || l.visible === false) continue;
      for (var k = l.keyframes.length - 1; k >= 0; k--) {
        var kf = l.keyframes[k];
        if (frame >= kf.index && frame < kf.index + kf.duration) { out = out.concat(kf.objects); break; }
      }
    }
    return out;
  }

  function symFrames(sym) {
    if (!sym || !sym.layers || !sym.layers.length) return 1;
    var m = 1;
    sym.layers.forEach(function (l) {
      (l.keyframes || []).forEach(function (k) {
        var e = k.index + k.duration - 1;
        if (e > m) m = e;
      });
    });
    return Math.max(1, m);
  }

  function behaviorOf(o, sym) { return o.symbolBehavior || (sym && sym.behavior) || "movieclip"; }

  /** Which frame a Graphic instance shows, given the parent playhead. */
  function graphicFrame(o, sym, parentFrame, startFrame) {
    var total = symFrames(sym);
    var first = Math.max(1, Math.min(o.firstFrame || 1, total));
    var mode = o.loopMode || "loop";
    if (mode === "single") return first;
    var f = first + Math.max(0, (parentFrame || 1) - (startFrame || 1));
    if (mode === "once") return Math.min(f, total);
    return ((f - 1) % total + total) % total + 1;
  }

  /* ---- persistent symbol instances ----------------------------------- *
   * The root rebuilds its display list every frame, which is fine for
   * shapes but fatal for anything with state: a MovieClip rebuilt each
   * frame would reset to frame 1 forever, and a Button would lose its
   * hover the moment you moved the mouse. Those two are therefore built
   * once, cached by position in the document, and re-used.
   * -------------------------------------------------------------------- */
  var instanceCache = Object.create(null);
  function cachedInstance(key, symbolName, behavior, make) {
    var hit = instanceCache[key];
    if (hit && hit.symbolName === symbolName && hit.behavior === behavior) return hit.node;
    var node = make();
    instanceCache[key] = { node: node, symbolName: symbolName, behavior: behavior };
    return node;
  }

  /** A MovieClip with the symbol's own timeline, running independently. */
  function buildMovieClip(sym, o, depth) {
    var mc = new Flashy.MovieClip();
    var total = symFrames(sym);
    mc.timeline.setTotalFrames(total);
    mc.loop = (o.loopMode || "loop") !== "once";
    for (var f = 1; f <= total; f++) {
      (function (fr) {
        mc.timeline.addFrameScript(fr, function () {
          this.removeAllChildren();
          var kids = symbolObjects(sym, fr);
          for (var i = 0; i < kids.length; i++) this.addChild(buildObj(kids[i], depth + 1, fr, 1));
        });
      })(f);
    }
    if ((o.loopMode || "loop") === "single") mc.gotoAndStop(Math.max(1, o.firstFrame || 1));
    else if (o.firstFrame > 1) mc.gotoAndPlay(o.firstFrame);
    return mc;
  }

  // Button state frames, in symbol-frame order.
  var BTN_ORDER = ["up", "over", "down", "hit"];
  // Every button instance, so the stage can clear hover/press on each event.
  var buttons = [];

  /**
   * A Button: frames 1–4 of the symbol are Up / Over / Down / Hit.
   *
   * Hover and press state has to survive the root's per-frame rebuild, which
   * is why buttons come from the instance cache. The stage dispatches to the
   * hit node first-to-last and to the stage itself before that, so clearing
   * on the stage and setting on the node leaves the right state behind.
   */
  function buildButton(sym, o, depth) {
    var btn = new Flashy.MovieClip();
    var total = symFrames(sym);
    var states = {};
    BTN_ORDER.forEach(function (name, i) {
      var fr = Math.min(i + 1, total);
      var holder = new Flashy.MovieClip();
      var kids = symbolObjects(sym, fr);
      for (var k = 0; k < kids.length; k++) holder.addChild(buildObj(kids[k], depth + 1, fr, 1));
      // The hit frame defines the clickable area but is never drawn.
      holder.visible = (name === "up");
      if (name === "hit") holder.alpha = 0;
      states[name] = holder;
      btn.addChild(holder);
    });
    btn._states = states;
    btn._hover = false;
    btn._down = false;
    btn.addEventListener("mouseMove", function () { this._hover = true; });
    btn.addEventListener("mouseDown", function () { this._down = true; });
    buttons.push(btn);
    return btn;
  }

  function refreshButtons() {
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i], s = b._states;
      var showing = b._down ? "down" : (b._hover ? "over" : "up");
      // Fall back to Up when the symbol has no frame for that state.
      if (!s[showing] || !s[showing].children.length) showing = "up";
      BTN_ORDER.forEach(function (n) { if (s[n]) s[n].visible = (n === showing); });
      if (s.hit) s.hit.visible = true; // invisible (alpha 0) but hit-testable
    }
  }

  // Geometry is drawn around (0,0) and the node is placed at the object's
  // centre, so rotation and scale pivot where the editor shows them pivoting.
  function buildObj(o, depth, parentFrame, startFrame, key) {
    depth = depth || 0;
    var hw = (o.width || 0) / 2, hh = (o.height || 0) / 2;
    var node;

    if (o.type === "symbol") {
      node = new Flashy.MovieClip();
      var sym = data.library && data.library[o.symbolName];
      if (sym && depth < SYM_MAX_DEPTH) {
        // Symbol space has its origin at the instance's top-left corner.
        var inner;
        var behavior = behaviorOf(o, sym);
        if (behavior === "movieclip" || behavior === "button") {
          // Stateful: built once and reused, or its timeline/hover resets
          // every frame. Without a key (nested inside another symbol) it is
          // rebuilt, which is correct — the parent owns its lifetime.
          var make = behavior === "button"
            ? function () { return buildButton(sym, o, depth); }
            : function () { return buildMovieClip(sym, o, depth); };
          inner = key ? cachedInstance(key, o.symbolName, behavior, make) : make();
        } else {
          // Graphic: parent-driven, so rebuilding each frame is the point.
          inner = new Flashy.MovieClip();
          var gf = graphicFrame(o, sym, parentFrame, startFrame);
          var kids = symbolObjects(sym, gf);
          for (var i = 0; i < kids.length; i++) inner.addChild(buildObj(kids[i], depth + 1, gf, 1));
        }
        inner.x = -hw; inner.y = -hh;
        node.addChild(inner);
      }
    } else if (o.type === "text") {
      var size = o.fontSize || 24;
      var tf = new Flashy.TextField(o.text || "", {
        font: (o.fontItalic ? "italic " : "") + (o.fontBold ? "bold " : "") + size + "px " + (o.font || "Arial"),
        color: hex(o.fillColor, "#000"),
        align: o.textAlign || "left",
        lineHeight: (o.lineHeight || 1.2) * size
      });
      tf.x = o.textAlign === "center" ? 0 : (o.textAlign === "right" ? hw : -hw);
      tf.y = -hh;
      node = new Flashy.MovieClip();
      node.addChild(tf);
    } else {
      node = new Flashy.Shape();
      var g = node.graphics;
      var filled = (o.fillType || "solid") !== "none";
      var stroked = (o.strokeStyle || "solid") !== "none" && (o.strokeWidth || 0) > 0;
      var sa = o.strokeAlpha != null ? o.strokeAlpha : 1;

      if (o.type === "pencil" || o.type === "brush") {
        var pts = o.points;
        if (pts && pts.length >= 4) {
          var wide = o.type === "brush";
          g.lineStyle(wide ? (o.strokeWidth || 1) * 3 : (o.strokeWidth || 1),
                      hex(wide ? o.fillColor : o.strokeColor, "#000"), sa);
          g.moveTo(pts[0] - hw, pts[1] - hh);
          for (var p = 2; p < pts.length; p += 2) g.lineTo(pts[p] - hw, pts[p + 1] - hh);
        }
      } else if (o.type === "line") {
        // The line tool stores only its bounding box; width/height may be
        // negative, which is how direction is encoded.
        g.lineStyle(o.strokeWidth || 1, hex(o.strokeColor, "#000"), sa);
        g.moveTo(-hw, -hh); g.lineTo(hw, hh);
      } else {
        if (filled) g.beginFill(hex(o.fillColor, "#000"), o.fillAlpha != null ? o.fillAlpha : 1);
        if (stroked) g.lineStyle(o.strokeWidth, hex(o.strokeColor, "#000"), sa);
        if (o.type === "rect") g.drawRect(-hw, -hh, o.width, o.height);
        else if (o.type === "oval") g.drawEllipse(-hw, -hh, o.width, o.height);
        if (filled) g.endFill();
      }
    }

    node.x = (o.x || 0) + hw;
    node.y = (o.y || 0) + hh;
    node.rotation = (o.rotation || 0) * Math.PI / 180;
    node.scaleX = o.scaleX || 1;
    node.scaleY = o.scaleY || 1;
    node.alpha = o.alpha != null ? o.alpha : 1;
    if (o.blendMode && o.blendMode !== "source-over") node.blendMode = o.blendMode;
    if (o.instanceName) node.name = o.instanceName;
    return node;
  }

  var maxF = 1;
  data.layers.forEach(function (l) {
    l.keyframes.forEach(function (k) { var e = k.index + k.duration - 1; if (e > maxF) maxF = e; });
  });
  if (data.totalFrames > maxF) maxF = data.totalFrames;
  root.timeline.setTotalFrames(maxF);
  root.loop = options.loop !== false;

  /* ---- soundtrack --------------------------------------------------- *
   * Sounds are attached to keyframes, exactly as in the editor, and a
   * SoundTrack keeps them in agreement with the playhead. Decoding is async,
   * so playback starts without audio and the track joins as assets land —
   * better than holding the whole cartoon hostage to a 4MB music file.
   * ------------------------------------------------------------------- */
  var track = null;
  var soundItems = [];
  data.layers.forEach(function (la, li) {
    (la.keyframes || []).forEach(function (k) {
      if (!k.sound || !k.sound.asset) return;
      var asset = data.sounds && data.sounds[k.sound.asset];
      if (!asset) return;
      var frames = asset.duration
        ? Math.max(1, Math.ceil((asset.duration - (k.sound.offset || 0)) * data.fps))
        : k.duration;
      soundItems.push({
        id: li + ":" + k.index,
        asset: k.sound.asset,
        startFrame: k.index,
        endFrame: k.index + (k.sound.loop ? k.duration : Math.min(k.duration, frames)) - 1,
        sync: k.sound.sync || "stream",
        volume: k.sound.volume != null ? k.sound.volume : 1,
        loop: !!k.sound.loop,
        offset: k.sound.offset || 0
      });
    });
  });
  if (soundItems.length && Flashy.SoundTrack) {
    track = new Flashy.SoundTrack({ fps: data.fps });
    track.setItems(soundItems);
    var names = {};
    soundItems.forEach(function (it) { names[it.asset] = true; });
    Object.keys(names).forEach(function (n) {
      var a = data.sounds[n];
      Flashy.Sound.load(n, "data:" + (a.mediaType || "audio/mpeg") + ";base64," + a.data)
        ["catch"](function () { /* one bad asset must not stop the movie */ });
    });
    // Browsers block audio until a gesture; take the first one that arrives.
    var unlock = function () { Flashy.Sound.unlock(); };
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true });
    });
  }

  /* ---- frame scripts ----------------------------------------------- *
   * Scripts authored in the editor's Actions panel run here, once on entry
   * to their keyframe, with the timeline verbs in scope. `this` is the root
   * MovieClip.
   * ------------------------------------------------------------------ */
  var frameScripts = {};
  data.layers.forEach(function (la) {
    (la.keyframes || []).forEach(function (k) {
      if (k.script && k.script.trim()) (frameScripts[k.index] = frameScripts[k.index] || []).push(k.script);
    });
  });
  var compiled = {}, lastScriptFrame = 0;
  function runFrameScripts(fr) {
    // Flash runs a frame script when the playhead ENTERS the frame, not on
    // every tick it spends sitting there (which is what a stop() causes).
    if (fr === lastScriptFrame) return;
    lastScriptFrame = fr;
    var list = frameScripts[fr];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var key = fr + ":" + i;
      try {
        if (!compiled[key]) {
          compiled[key] = new Function("stop", "play", "gotoAndPlay", "gotoAndStop", "stage", "root", "Flashy", list[i]);
        }
        compiled[key].call(root,
          function () { root.stop(); },
          function () { root.play(); },
          function (f) { root.gotoAndPlay(f); },
          function (f) { root.gotoAndStop(f); },
          stage, root, Flashy);
      } catch (e) {
        if (typeof console !== "undefined") console.error("Flashy: frame " + fr + " script failed", e);
      }
    }
  }

  function easeAt(t, name) {
    var ef = easing[name || "linear"] || easing.linear;
    return ef(Math.min(1, Math.max(0, t)));
  }

  for (var f = 1; f <= maxF; f++) {
    (function (fr) {
      root.timeline.addFrameScript(fr, function () {
        this.removeAllChildren();
        for (var li = data.layers.length - 1; li >= 0; li--) {
          var la = data.layers[li];
          if (la.visible === false) continue;
          var kf = null;
          for (var ki = la.keyframes.length - 1; ki >= 0; ki--) {
            var k = la.keyframes[ki];
            if (fr >= k.index && fr < k.index + k.duration) { kf = k; break; }
          }
          if (!kf) continue;

          var nk = kf.tweenType && kf.tweenType !== "none" && kf.duration > 1
            ? la.keyframes[la.keyframes.indexOf(kf) + 1] : null;
          // Divide by duration (not duration-1) so the frame holding the next
          // keyframe is the one that shows the destination — same as the stage.
          var t = nk ? easeAt((fr - kf.index) / kf.duration, kf.easing) : 0;

          for (var oi = 0; oi < kf.objects.length; oi++) {
            var a = kf.objects[oi];
            var o = a;
            var b = nk ? nk.objects[oi] : null;
            if (b) {
              o = {};
              for (var prop in a) o[prop] = a[prop];
              o.x = a.x + (b.x - a.x) * t;
              o.y = a.y + (b.y - a.y) * t;
              o.width = a.width + (b.width - a.width) * t;
              o.height = a.height + (b.height - a.height) * t;
              o.rotation = (a.rotation || 0) + ((b.rotation || 0) - (a.rotation || 0)) * t;
              o.scaleX = (a.scaleX || 1) + ((b.scaleX || 1) - (a.scaleX || 1)) * t;
              o.scaleY = (a.scaleY || 1) + ((b.scaleY || 1) - (a.scaleY || 1)) * t;
              var aa = a.alpha != null ? a.alpha : 1, ba = b.alpha != null ? b.alpha : 1;
              o.alpha = aa + (ba - aa) * t;
            }
            // Stable identity for stateful symbol instances, so a MovieClip
            // keeps its own playhead and a Button keeps its hover across the
            // root's per-frame rebuild.
            this.addChild(buildObj(o, 0, fr, kf.index, li + ":" + kf.index + ":" + oi));
          }
        }
        runFrameScripts(fr);
        refreshButtons();
        if (track) track.update(fr, false);
      });
    })(f);
  }

  // Buttons clear their state on the stage (which is dispatched to first) and
  // set it on the node, so by the time refreshButtons() runs in the next
  // frame script the surviving flags are the true ones.
  stage.addEventListener("mouseMove", function () {
    for (var i = 0; i < buttons.length; i++) buttons[i]._hover = false;
  });
  stage.addEventListener("mouseDown", function () {
    for (var i = 0; i < buttons.length; i++) buttons[i]._down = false;
  });
  stage.addEventListener("mouseUp", function () {
    for (var i = 0; i < buttons.length; i++) buttons[i]._down = false;
  });

  if (options.autoplay !== false) stage.start();
  stage.soundtrack = track;
  return stage;
}

function genHTML(callback){
  getEngineSource(function(engineSrc){
    var d=serializeDoc();
    var sc="<"+"script>",sce="</"+"script>";
    var s="<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n";
    s+="<title>Flashy Animation</title>\n";
    s+="<style>\n";
    s+="*{margin:0;padding:0;box-sizing:border-box;}\n";
    s+="body{background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}\n";
    s+="canvas{display:block;}\n";
    s+="#flashy-start{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);cursor:pointer;}\n";
    s+="#flashy-start button{width:88px;height:88px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,0.35);color:#fff;font-size:34px;line-height:1;cursor:pointer;padding-left:6px;}\n";
    s+="#flashy-start button:hover{background:rgba(255,255,255,0.18);}\n";
    s+="</style>\n</head>\n<body>\n";
    s+="<canvas id=\"stage\"></canvas>\n";
    // A cartoon with a soundtrack needs a user gesture before the browser
    // will let it make noise, so the export opens behind a play button
    // rather than starting silently and confusing the viewer. Silent
    // exports keep starting immediately.
    var hasSound=Object.keys(d.sounds||{}).length>0;
    if(hasSound){
      s+="<div id=\"flashy-start\"><button type=\"button\" aria-label=\"Play\">&#9658;</button></div>\n";
    }
    // Embed the full Flashy engine inline
    s+=sc+"\n"+engineSrc+"\n"+sce+"\n";
    // …then the shared player, serialised straight out of exportRuntime().
    //
    // The stage is published as window.__stage, which is the handle File ▸
    // Import from URL looks for — so an exported animation can be loaded back
    // into the editor. Until now our own exports were the one kind of Flashy
    // page our own importer could not read.
    s+=sc+"\n";
    s+="var __data = "+JSON.stringify(d)+";\n";
    s+="var __run = "+exportRuntime.toString()+";\n";
    s+="var __canvas = document.getElementById('stage');\n";
    if(hasSound){
      // Hold the first frame until the viewer presses play, then unlock audio
      // and start — so the soundtrack is actually audible from frame one.
      s+="var __gate = document.getElementById('flashy-start');\n";
      s+="window.__stage = __run(__data, __canvas, {autoplay:false});\n";
      s+="__gate.addEventListener('click', function(){\n";
      s+="  __gate.remove();\n";
      s+="  Promise.resolve(Flashy.Sound.unlock()).then(function(){ window.__stage.start(); });\n";
      s+="});\n";
    }else{
      s+="window.__stage = __run(__data, __canvas);\n";
    }
    s+=sce+"\n</body>\n</html>";
    callback(s);
  });
}

// === Additional Export Formats ===

// Exports always render the SCENE (doc.layers), never `currentLayers()` —
// otherwise "Export as GIF" quietly exported whichever symbol you happened to
// have open, and the HTML export (which has always used the scene) and the
// raster exports disagreed about what the document was.
function renderFrameToCanvas(frameNum, w, h) {
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  var cx = c.getContext("2d");
  cx.fillStyle = doc.backgroundColor || "#FFFFFF";
  cx.fillRect(0, 0, w, h);
  frameObjects(doc.layers, frameNum).forEach(function (o) {
    paintObj(cx, o, { chrome: false });
  });
  return c;
}
/** Longest frame in the scene — what the raster/video exporters cover. */
function sceneMaxFrame() {
  var m = 1;
  doc.layers.forEach(function (l) { var e = l.getFrameEnd(); if (e > m) m = e; });
  return Math.max(m, doc.totalFrames || 1);
}

function exportAsGIF() {
  var maxF = sceneMaxFrame(), w = doc.width, h = doc.height;
  var st = document.createElement("div");
  st.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#333;color:#fff;padding:20px 40px;border-radius:8px;z-index:9999;font:14px sans-serif;";
  st.textContent = "Rendering " + maxF + " frames...";
  document.body.appendChild(st);
  setTimeout(function() {
    var frames = [];
    for (var f = 1; f <= maxF; f++) frames.push(renderFrameToCanvas(f, w, h));
    var cols = Math.ceil(Math.sqrt(maxF)), rows = Math.ceil(maxF / cols);
    var sheet = document.createElement("canvas");
    sheet.width = w * cols; sheet.height = h * rows;
    var sx = sheet.getContext("2d");
    for (var i = 0; i < frames.length; i++) sx.drawImage(frames[i], (i%cols)*w, Math.floor(i/cols)*h);
    var dataURL = sheet.toDataURL("image/png");
    var html = "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>Flashy Animation</title>\n";
    html += "<style>*{margin:0}body{background:#111;display:flex;align-items:center;justify-content:center;height:100vh}</style>\n";
    html += "</head><body><canvas id=\"c\"></canvas>\n<scr"+"ipt>\nvar img=new Image();img.onload=function(){\n";
    html += "var c=document.getElementById('c');c.width="+w+";c.height="+h+";\n";
    html += "var ctx=c.getContext('2d'),f=0,cols="+cols+",total="+maxF+";\n";
    html += "setInterval(function(){var col=f%cols,row=Math.floor(f/cols);\n";
    html += "ctx.clearRect(0,0,"+w+","+h+");\n";
    html += "ctx.drawImage(img,col*"+w+",row*"+h+","+w+","+h+",0,0,"+w+","+h+");\n";
    html += "f=(f+1)%total;},1000/"+doc.fps+");};\n";
    html += "img.src='"+dataURL+"';\n</scr"+"ipt></body></html>";
    document.body.removeChild(st);
    dlFile(html, "animation-sprite.html", "text/html");
  }, 50);
}

function exportAsMP4() {
  var maxF = sceneMaxFrame(), w = doc.width, h = doc.height;
  var test = document.createElement("canvas"); test.width = 2; test.height = 2;
  if (!test.captureStream || typeof MediaRecorder === "undefined") {
    alert("MP4/WebM export requires Chrome, Edge, or Firefox with MediaRecorder support.");
    return;
  }
  var st = document.createElement("div");
  st.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#333;color:#fff;padding:20px 40px;border-radius:8px;z-index:9999;font:14px sans-serif;";
  st.textContent = "Recording...";
  document.body.appendChild(st);
  var rc = document.createElement("canvas"); rc.width = w; rc.height = h;
  var rCtx = rc.getContext("2d");
  var stream = rc.captureStream(doc.fps);
  var chunks = [];
  var mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" :
             MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";

  /* ---- soundtrack ---------------------------------------------------- *
   * The recording runs in wall-clock time, so the audio can be captured
   * live: every sound is scheduled against the AudioContext clock at the
   * moment its start frame will be recorded, routed to a MediaStream
   * destination, and that audio track is added to the recorded stream.
   *
   * (Real time is the trade here. Frame-stepping would make the export as
   * fast as it can render, but there is then no clock for live audio
   * capture — that route needs WebCodecs plus a muxer. See ROADMAP.)
   * ------------------------------------------------------------------- */
  var items = soundItems();
  var scheduled = [];
  function attachAudio() {
    if (!items.length || typeof Flashy === "undefined" || !Flashy.Sound) return Promise.resolve();
    return Flashy.Sound.unlock().then(function () {
      var actx = Flashy.Sound.context();
      if (!actx || actx.state !== "running" || !actx.createMediaStreamDestination) return;
      var dest = actx.createMediaStreamDestination();
      var t0 = actx.currentTime + 0.12; // a beat of headroom before recording starts
      items.forEach(function (it) {
        var buf = Flashy.Sound.buffer(it.asset);
        if (!buf) return;
        var src = actx.createBufferSource();
        src.buffer = buf;
        src.loop = !!it.loop;
        var gain = actx.createGain();
        gain.gain.value = it.volume != null ? it.volume : 1;
        src.connect(gain); gain.connect(dest);
        var at = t0 + (it.startFrame - 1) / doc.fps;
        var span = (it.endFrame - it.startFrame + 1) / doc.fps;
        src.start(at, it.offset || 0, span);
        scheduled.push(src);
      });
      dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
      return new Promise(function (r) { setTimeout(r, 120); });
    })["catch"](function () { /* record silent rather than not at all */ });
  }

  function cleanupAudio() {
    scheduled.forEach(function (s) { try { s.stop(); } catch (e) { /* ended */ } });
    scheduled = [];
  }

  attachAudio().then(function () {
    var rec = new MediaRecorder(stream, {mimeType: mime});
    rec.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = function() {
      cleanupAudio();
      var blob = new Blob(chunks, {type: mime});
      dlFile(blob, "animation." + (mime.indexOf("webm") >= 0 ? "webm" : "mp4"), mime);
      document.body.removeChild(st);
    };
    rec.start();
    var curF = 1;
    var iv = setInterval(function() {
      var fc = renderFrameToCanvas(curF, w, h);
      rCtx.clearRect(0, 0, w, h); rCtx.drawImage(fc, 0, 0);
      st.textContent = "Recording frame " + curF + " / " + maxF +
        (items.length ? " (with audio)" : "");
      curF++;
      if (curF > maxF) { clearInterval(iv); rec.stop(); }
    }, 1000 / doc.fps);
  });
}

// A still of the current frame of the SCENE. SVG has no timeline here, so this
// is deliberately one frame — it used to always export frame 1 regardless of
// where the playhead was, which made it look broken rather than deliberate.
function exportAsSVG() {
  var w = doc.width, h = doc.height;
  var frame = Math.min(curFrame, sceneMaxFrame());
  var s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">\n';
  s += '<rect width="'+w+'" height="'+h+'" fill="'+xmlAttr(doc.backgroundColor||"#fff")+'"/>\n';
  frameObjects(doc.layers, frame).forEach(function (o) { s += _objToSVG(o, 0); });
  s += '</svg>';
  dlFile(s, "animation.svg", "image/svg+xml");
}

function xmlText(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function xmlAttr(v) {
  return xmlText(v).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function _objToSVG(o, depth) {
  depth = depth || 0;
  var hw = (o.width||0)/2, hh = (o.height||0)/2;
  // Same centre-origin convention as the stage and the canvas painter: move to
  // the object's centre, rotate/scale there, then draw around (0,0).
  var tf = 'translate('+((o.x||0)+hw)+','+((o.y||0)+hh)+')';
  if (o.rotation) tf += ' rotate('+o.rotation+')';
  if ((o.scaleX!=null&&o.scaleX!==1)||(o.scaleY!=null&&o.scaleY!==1)) {
    tf += ' scale('+(o.scaleX||1)+','+(o.scaleY||1)+')';
  }
  var a = ' transform="'+xmlAttr(tf)+'"';
  if (o.alpha!=null&&o.alpha<1) a += ' opacity="'+o.alpha+'"';
  var fl = (o.fillType||"solid")==="none" ? "none" : xmlAttr(o.fillColor||"#000");
  var st = (!o.strokeWidth||(o.strokeStyle||"solid")==="none") ? "none" : xmlAttr(o.strokeColor||"#000");
  var sw = o.strokeWidth||0;
  switch (o.type) {
    case "rect":
      return '<rect'+a+' x="'+(-hw)+'" y="'+(-hh)+'" width="'+Math.abs(o.width)+'" height="'+Math.abs(o.height)+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "oval":
      return '<ellipse'+a+' cx="0" cy="0" rx="'+Math.abs(hw)+'" ry="'+Math.abs(hh)+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "line":
      return '<path'+a+' d="M'+(-hw)+','+(-hh)+' L'+hw+','+hh+'" fill="none" stroke="'+st+'" stroke-width="'+(sw||1)+'" stroke-linecap="round"/>\n';
    case "pencil": case "brush":
      var pp = o.points;
      if (!pp||pp.length<4) return '';
      var d = 'M'+(pp[0]-hw)+','+(pp[1]-hh);
      for (var i=2;i<pp.length;i+=2) d+=' L'+(pp[i]-hw)+','+(pp[i+1]-hh);
      return '<path'+a+' d="'+d+'" fill="none" stroke="'+(o.type==="brush"?fl:st)+'" stroke-width="'+(o.type==="brush"?(sw||1)*3:sw)+'" stroke-linecap="round" stroke-linejoin="round"/>\n';
    case "text":
      var size = o.fontSize||24;
      var anchor = o.textAlign==="center" ? "middle" : (o.textAlign==="right" ? "end" : "start");
      var tx = o.textAlign==="center" ? 0 : (o.textAlign==="right" ? hw : -hw);
      var lines = String(o.text==null||o.text===""?"Text":o.text).split("\n");
      var lh = (o.lineHeight||1.2)*size;
      var out = '<text'+a+' font-size="'+size+'" font-family="'+xmlAttr(o.font||"Arial")+'"'+
        (o.fontBold?' font-weight="bold"':'')+(o.fontItalic?' font-style="italic"':'')+
        (o.fontUnderline?' text-decoration="underline"':'')+
        ' fill="'+fl+'" text-anchor="'+anchor+'" dominant-baseline="hanging">\n';
      for (var li=0;li<lines.length;li++) {
        out += '  <tspan x="'+tx+'" y="'+(-hh+li*lh)+'">'+xmlText(lines[li])+'</tspan>\n';
      }
      return out+'</text>\n';
    case "symbol":
      // Symbols used to fall through to `default` and vanish from the SVG
      // without a word.
      var sym = doc.library[o.symbolName];
      if (!sym || depth >= SYMBOL_MAX_DEPTH) return '';
      var kids = symbolFrameObjects(sym, symbolDisplayFrame(o, sym, o._parentFrame || 1, o._startFrame || 1));
      if (!kids.length) return '';
      var g = '<g'+a+'><g transform="translate('+(-hw)+','+(-hh)+')">\n';
      for (var k=0;k<kids.length;k++) g += _objToSVG(kids[k], depth+1);
      return g+'</g></g>\n';
    default: return '';
  }
}

function exportEmbedSnippet() {
  genHTML(function(html) {
    var snippet = '<!-- Flashy Animation Embed -->\n';
    snippet += '<!-- Host animation.html on your server, then use: -->\n';
    snippet += '<iframe src="animation.html" width="'+doc.width+'" height="'+doc.height+'" frameborder="0" style="border:none;"></iframe>';
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;";
    var dlg = document.createElement("div");
    dlg.style.cssText = "background:#3C3C3C;border:1px solid #555;border-radius:6px;padding:16px;max-width:600px;width:90%;color:#DDD;font:12px Tahoma,sans-serif;";
    var t = document.createElement("div"); t.style.cssText = "font-weight:bold;font-size:14px;margin-bottom:10px;"; t.textContent = "Embed Snippet"; dlg.appendChild(t);
    var d = document.createElement("div"); d.style.cssText = "color:#999;margin-bottom:10px;font-size:11px;"; d.textContent = "Copy this code to embed your animation in any webpage:"; dlg.appendChild(d);
    var ta = document.createElement("textarea"); ta.style.cssText = "width:100%;height:100px;background:#1E1E1E;color:#88CC88;border:1px solid #333;font:11px Consolas,monospace;padding:8px;resize:vertical;"; ta.value = snippet; ta.readOnly = true; dlg.appendChild(ta);
    var br = document.createElement("div"); br.style.cssText = "display:flex;gap:8px;margin-top:12px;justify-content:flex-end;";
    var cb = document.createElement("button"); cb.style.cssText = "background:#4477aa;color:#fff;border:none;padding:6px 16px;border-radius:3px;cursor:pointer;font:11px sans-serif;"; cb.textContent = "Copy"; cb.addEventListener("click",function(){ta.select();navigator.clipboard.writeText(ta.value);cb.textContent="Copied!";}); br.appendChild(cb);
    var db = document.createElement("button"); db.style.cssText = "background:#555;color:#fff;border:none;padding:6px 16px;border-radius:3px;cursor:pointer;font:11px sans-serif;"; db.textContent = "Download HTML"; db.addEventListener("click",function(){dlFile(html,"animation.html","text/html");}); br.appendChild(db);
    var xb = document.createElement("button"); xb.style.cssText = "background:#444;color:#ccc;border:none;padding:6px 16px;border-radius:3px;cursor:pointer;font:11px sans-serif;"; xb.textContent = "Close"; xb.addEventListener("click",function(){document.body.removeChild(overlay);}); br.appendChild(xb);
    dlg.appendChild(br); overlay.appendChild(dlg);
    overlay.addEventListener("click",function(e){if(e.target===overlay)document.body.removeChild(overlay);});
    document.body.appendChild(overlay); ta.select();
  });
}

function exportAsModule() {
  // Same player as the HTML export — the module form just hands the caller the
  // stage instead of starting it on a canvas we picked.
  var s = "// Flashy Animation Module\n";
  s += "// Usage: import { createAnimation } from './animation.js';\n";
  s += "//        createAnimation(document.getElementById('canvas'), { loop: true });\n";
  s += "//\n";
  s += "// Requires flashy.js to be loaded first (it provides the global `Flashy`).\n\n";
  s += "export const sceneData = " + JSON.stringify(serializeDoc(), null, 2) + ";\n\n";
  s += "const createStage = " + exportRuntime.toString() + ";\n\n";
  s += "export function createAnimation(canvas, options) {\n";
  s += "  if (typeof Flashy === 'undefined') throw new Error('flashy.js must be loaded first');\n";
  s += "  return createStage(sceneData, canvas, options);\n";
  s += "}\n";
  dlFile(s, "animation.js", "application/javascript");
}

// === Scene Inspector: Import from running Flashy stage ===
function intToHex(n){
  if(typeof n==="string")return n;
  n=n|0;
  var r=(n>>16)&0xff,g=(n>>8)&0xff,b=n&0xff;
  return"#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function classifyGraphicsCmds(cmds){
  // Analyze Graphics._cmds to determine shape type and extract properties
  var result={type:"rect",fillColor:"#000000",fillAlpha:1,strokeColor:"#000000",strokeAlpha:1,strokeWidth:0,
    x:0,y:0,width:50,height:50,points:null};
  var hasFill=false,hasStroke=false;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  var pathPoints=[];
  var hasRect=false,hasCircle=false,hasEllipse=false,hasRoundRect=false,hasStar=false,hasPolygon=false;
  var hasMoveTo=false,hasLineTo=false,hasCurve=false;

  for(var i=0;i<cmds.length;i++){
    var c=cmds[i];
    switch(c[0]){
    case 0: // moveTo
      hasMoveTo=true;
      pathPoints.push(c[1],c[2]);
      if(c[1]<minX)minX=c[1];if(c[1]>maxX)maxX=c[1];
      if(c[2]<minY)minY=c[2];if(c[2]>maxY)maxY=c[2];
      break;
    case 1: // lineTo
      hasLineTo=true;
      pathPoints.push(c[1],c[2]);
      if(c[1]<minX)minX=c[1];if(c[1]>maxX)maxX=c[1];
      if(c[2]<minY)minY=c[2];if(c[2]>maxY)maxY=c[2];
      break;
    case 2: // curveTo
      hasCurve=true;
      if(c[3]<minX)minX=c[3];if(c[3]>maxX)maxX=c[3];
      if(c[4]<minY)minY=c[4];if(c[4]>maxY)maxY=c[4];
      break;
    case 3: // cubicCurveTo
      hasCurve=true;
      if(c[5]<minX)minX=c[5];if(c[5]>maxX)maxX=c[5];
      if(c[6]<minY)minY=c[6];if(c[6]>maxY)maxY=c[6];
      break;
    case 10: // lineStyle
      if(c[1]>0){hasStroke=true;result.strokeWidth=c[1];result.strokeColor=intToHex(c[2]);result.strokeAlpha=c[3]!=null?c[3]:1;}
      break;
    case 11: // beginFill
      hasFill=true;result.fillColor=intToHex(c[1]);result.fillAlpha=c[2]!=null?c[2]:1;
      break;
    case 12: // beginGradientFill - use first color as fill
      hasFill=true;
      if(c[2]&&c[2].length>0)result.fillColor=intToHex(c[2][0]);
      result.fillAlpha=c[3]&&c[3].length>0?c[3][0]:1;
      break;
    case 20: // drawRect
      hasRect=true;
      if(c[1]<minX)minX=c[1];if(c[2]<minY)minY=c[2];
      if(c[1]+c[3]>maxX)maxX=c[1]+c[3];if(c[2]+c[4]>maxY)maxY=c[2]+c[4];
      break;
    case 21: // drawRoundRect
      hasRoundRect=true;hasRect=true;
      if(c[1]<minX)minX=c[1];if(c[2]<minY)minY=c[2];
      if(c[1]+c[3]>maxX)maxX=c[1]+c[3];if(c[2]+c[4]>maxY)maxY=c[2]+c[4];
      break;
    case 22: // drawCircle
      hasCircle=true;
      if(c[1]-c[3]<minX)minX=c[1]-c[3];if(c[2]-c[3]<minY)minY=c[2]-c[3];
      if(c[1]+c[3]>maxX)maxX=c[1]+c[3];if(c[2]+c[3]>maxY)maxY=c[2]+c[3];
      break;
    case 23: // drawEllipse
      hasEllipse=true;
      if(c[1]<minX)minX=c[1];if(c[2]<minY)minY=c[2];
      if(c[1]+c[3]>maxX)maxX=c[1]+c[3];if(c[2]+c[4]>maxY)maxY=c[2]+c[4];
      break;
    case 24: // drawPolygon
      hasPolygon=true;
      var pts=c[1];
      for(var pi=0;pi<pts.length;pi+=2){
        if(pts[pi]<minX)minX=pts[pi];if(pts[pi]>maxX)maxX=pts[pi];
        if(pts[pi+1]<minY)minY=pts[pi+1];if(pts[pi+1]>maxY)maxY=pts[pi+1];
      }
      break;
    case 25: // drawStar
      hasStar=true;
      var sr=c[4];// outerR
      if(c[1]-sr<minX)minX=c[1]-sr;if(c[2]-sr<minY)minY=c[2]-sr;
      if(c[1]+sr>maxX)maxX=c[1]+sr;if(c[2]+sr>maxY)maxY=c[2]+sr;
      break;
    }
  }

  if(minX===Infinity){minX=0;minY=0;maxX=50;maxY=50;}

  result.x=minX;result.y=minY;
  result.width=maxX-minX;result.height=maxY-minY;

  if(hasCircle||hasEllipse){
    result.type="oval";
  }else if(hasRect||hasRoundRect){
    result.type="rect";
  }else if(hasMoveTo&&hasLineTo&&!hasCurve&&pathPoints.length===4){
    result.type="line";
  }else if((hasMoveTo||hasLineTo||hasCurve)&&pathPoints.length>2){
    result.type="pencil";
    // make points relative to the shape's top-left (result.x/y)
    result.points=pathPoints.map(function(v,i){return i%2===0?v-minX:v-minY;});
  }else if(hasStar||hasPolygon){
    result.type="rect"; // approximate as rect bounding box
  }

  if(!hasFill&&!hasStroke){
    result.fillColor="#CCCCCC";
    result.strokeWidth=0;
  }
  if(!hasStroke){result.strokeWidth=0;}

  return result;
}

var _importSymCount=0;
function walkDisplayObject(dispObj,parentX,parentY,depth){
  depth=depth||0;
  var objects=[];
  var dx=(dispObj.x||0);
  var dy=(dispObj.y||0);

  // TextField
  if(dispObj.text!==undefined&&dispObj.font!==undefined){
    var tf=new EditorObject("text");
    tf.x=dx+parentX;tf.y=dy+parentY;
    tf.text=dispObj.text||"Text";
    tf.font=dispObj.font?dispObj.font.replace(/^.*?\d+px\s*/,"").replace(/['"]/g,"").trim()||"Arial":"Arial";
    var fontMatch=dispObj.font?dispObj.font.match(/(\d+)px/):null;
    tf.fontSize=fontMatch?parseInt(fontMatch[1]):24;
    tf.fillColor=intToHex(dispObj.color!=null?dispObj.color:0);
    tf.alpha=dispObj.alpha!=null?dispObj.alpha:1;
    tf.rotation=(dispObj.rotation||0)*180/Math.PI;
    tf.scaleX=dispObj.scaleX||1;tf.scaleY=dispObj.scaleY||1;
    tf.width=tf.fontSize*Math.max(1,tf.text.length)*0.6;
    tf.height=tf.fontSize*1.2;
    tf.name=dispObj.name||"";
    objects.push(tf);
    return objects;
  }

  // If this is a MovieClip with children at depth > 0, convert to a library symbol
  var isComplex=dispObj.children&&dispObj.children.length>0&&depth>0;
  if(isComplex){
    var symName=dispObj.name||("imported_mc_"+(++_importSymCount));
    // Collect all sub-objects inside this MC
    var subObjs=[];
    // Own graphics
    var sg=dispObj.graphics;
    if(sg&&sg._cmds&&sg._cmds.length>0){
      var sinfo=classifyGraphicsCmds(sg._cmds);
      var sobj=new EditorObject(sinfo.type);
      sobj.x=sinfo.x;sobj.y=sinfo.y;
      sobj.width=sinfo.width;sobj.height=sinfo.height;
      sobj.fillColor=sinfo.fillColor;sobj.fillAlpha=sinfo.fillAlpha;
      sobj.strokeColor=sinfo.strokeColor;sobj.strokeAlpha=sinfo.strokeAlpha;
      sobj.strokeWidth=sinfo.strokeWidth;
      if(sinfo.points)sobj.points=sinfo.points;
      subObjs.push(sobj);
    }
    // Children
    for(var ci=0;ci<dispObj.children.length;ci++){
      var childObjs=walkDisplayObject(dispObj.children[ci],0,0,depth+1);
      for(var j=0;j<childObjs.length;j++)subObjs.push(childObjs[j]);
    }
    // Store as library symbol
    if(subObjs.length>0){
      doc.library[symName]={objects:subObjs,layers:null};
      // Create a symbol instance
      var inst=new EditorObject("symbol");
      inst.x=dx+parentX;inst.y=dy+parentY;
      inst.symbolName=symName;
      inst.alpha=dispObj.alpha!=null?dispObj.alpha:1;
      inst.rotation=(dispObj.rotation||0)*180/Math.PI;
      inst.scaleX=dispObj.scaleX||1;inst.scaleY=dispObj.scaleY||1;
      inst.name=dispObj.name||"";
      // Compute bounds from sub-objects
      var bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
      for(var bi=0;bi<subObjs.length;bi++){
        var so=subObjs[bi];
        if(so.x<bx0)bx0=so.x;if(so.y<by0)by0=so.y;
        if(so.x+(so.width||0)>bx1)bx1=so.x+(so.width||0);
        if(so.y+(so.height||0)>by1)by1=so.y+(so.height||0);
      }
      inst.width=bx1-bx0||50;inst.height=by1-by0||50;
      objects.push(inst);
      return objects;
    }
  }

  // Simple shape with graphics
  var g=dispObj.graphics;
  if(g&&g._cmds&&g._cmds.length>0){
    var info=classifyGraphicsCmds(g._cmds);
    var obj=new EditorObject(info.type);
    obj.x=dx+parentX+info.x;obj.y=dy+parentY+info.y;
    obj.width=info.width;obj.height=info.height;
    obj.fillColor=info.fillColor;obj.fillAlpha=info.fillAlpha;
    obj.strokeColor=info.strokeColor;obj.strokeAlpha=info.strokeAlpha;
    obj.strokeWidth=info.strokeWidth;
    obj.alpha=dispObj.alpha!=null?dispObj.alpha:1;
    obj.rotation=(dispObj.rotation||0)*180/Math.PI;
    obj.scaleX=dispObj.scaleX||1;obj.scaleY=dispObj.scaleY||1;
    obj.name=dispObj.name||"";
    if(info.points)obj.points=info.points;
    objects.push(obj);
  }

  // Recurse children at this level (for containers without own graphics)
  if(dispObj.children&&dispObj.children.length>0&&!isComplex){
    for(var ci2=0;ci2<dispObj.children.length;ci2++){
      var childObjs2=walkDisplayObject(dispObj.children[ci2],dx+parentX,dy+parentY,depth+1);
      for(var j2=0;j2<childObjs2.length;j2++)objects.push(childObjs2[j2]);
    }
  }

  return objects;
}

function extractTimelineTweens(dispObj){
  // Extract tween info from a MovieClip's timeline for editor keyframes
  var tweenData=[];
  if(!dispObj.timeline||!dispObj.timeline.tweens)return tweenData;
  var tl=dispObj.timeline;
  for(var i=0;i<tl.tweens.length;i++){
    var tw=tl.tweens[i];
    tweenData.push({
      targetName:tw.target&&tw.target.name?tw.target.name:"",
      prop:tw.prop,
      from:tw.from,
      to:tw.to,
      startFrame:tw.startFrame,
      endFrame:tw.endFrame,
      ease:tw.ease||"linear"
    });
  }
  return tweenData;
}

function importFromStage(flashyStage){
  pushUndo();

  // Stop the source animation so we capture a stable state
  if(flashyStage.stop)flashyStage.stop();

  doc.width=flashyStage.width||550;
  doc.height=flashyStage.height||400;
  doc.fps=flashyStage.fps||24;
  doc.backgroundColor=flashyStage.backgroundColor!=null?intToHex(flashyStage.backgroundColor):"#FFFFFF";
  doc.layers=[];
  doc.library={};

  var root=flashyStage.root;
  if(!root||!root.children||root.children.length===0){
    doc.layers=[new Layer("Layer 1")];
    doc.totalFrames=60;
  }else{
    // Determine total frames from root timeline
    var maxFrames=1;
    if(root.timeline&&root.timeline.totalFrames>1){
      maxFrames=root.timeline.totalFrames;
    }
    // Also check children for their timelines
    for(var ci=0;ci<root.children.length;ci++){
      var child=root.children[ci];
      if(child.timeline&&child.timeline.totalFrames>maxFrames){
        maxFrames=child.timeline.totalFrames;
      }
    }
    doc.totalFrames=Math.max(maxFrames,60);

    // Strategy: each top-level child becomes a layer
    // Walk each child and convert to editor objects
    for(var i=0;i<root.children.length;i++){
      var topChild=root.children[i];
      var layerName=topChild.name||("Layer "+(i+1));
      var layer=new Layer(layerName);

      // Get all objects from this child and its descendants
      var edObjs=walkDisplayObject(topChild,0,0);

      // Set up keyframe 1 with these objects
      layer.keyframes=[new KeyFrame(1)];
      layer.keyframes[0].objects=edObjs;
      layer.keyframes[0].duration=Math.max(1,doc.totalFrames);

      // Extract timeline tweens if the top child is a MovieClip
      if(topChild.timeline&&topChild.timeline.tweens&&topChild.timeline.tweens.length>0){
        var tweens=extractTimelineTweens(topChild);

        // Group tweens by startFrame to create keyframes with motion tweens
        var frameMap={};
        for(var ti=0;ti<tweens.length;ti++){
          var tw=tweens[ti];
          var sf=tw.startFrame;
          if(!frameMap[sf])frameMap[sf]={startFrame:sf,endFrame:tw.endFrame,ease:tw.ease,tweens:[]};
          frameMap[sf].tweens.push(tw);
          if(tw.endFrame>frameMap[sf].endFrame)frameMap[sf].endFrame=tw.endFrame;
        }

        // Create keyframes for tween start/end points
        var frameKeys=Object.keys(frameMap).sort(function(a,b){return parseInt(a)-parseInt(b);});
        if(frameKeys.length>0){
          layer.keyframes=[];
          var prevEnd=1;
          for(var fi=0;fi<frameKeys.length;fi++){
            var fd=frameMap[frameKeys[fi]];

            // Keyframe at tween start
            var startKF=new KeyFrame(fd.startFrame);
            var startObjs=[];
            for(var oi=0;oi<edObjs.length;oi++)startObjs.push(edObjs[oi].clone());

            // Apply "from" values from tweens to start objects
            for(var twi=0;twi<fd.tweens.length;twi++){
              var twd=fd.tweens[twi];
              // Apply to matching objects
              for(var si=0;si<startObjs.length;si++){
                if(twd.prop==="x")startObjs[si].x=twd.from;
                else if(twd.prop==="y")startObjs[si].y=twd.from;
                else if(twd.prop==="scaleX")startObjs[si].scaleX=twd.from;
                else if(twd.prop==="scaleY")startObjs[si].scaleY=twd.from;
                else if(twd.prop==="alpha")startObjs[si].alpha=twd.from;
                else if(twd.prop==="rotation")startObjs[si].rotation=twd.from*180/Math.PI;
              }
            }
            startKF.objects=startObjs;
            startKF.duration=fd.endFrame-fd.startFrame;
            startKF.tweenType="motion";
            // Keep the original easing name — the editor supports all Flashy easings
            startKF.easing=fd.ease||"linear";
            layer.keyframes.push(startKF);

            // Keyframe at tween end
            var endKF=new KeyFrame(fd.endFrame);
            var endObjs=[];
            for(var oei=0;oei<edObjs.length;oei++)endObjs.push(edObjs[oei].clone());

            // Apply "to" values from tweens to end objects
            for(var twj=0;twj<fd.tweens.length;twj++){
              var twe=fd.tweens[twj];
              for(var sei=0;sei<endObjs.length;sei++){
                if(twe.prop==="x")endObjs[sei].x=twe.to;
                else if(twe.prop==="y")endObjs[sei].y=twe.to;
                else if(twe.prop==="scaleX")endObjs[sei].scaleX=twe.to;
                else if(twe.prop==="scaleY")endObjs[sei].scaleY=twe.to;
                else if(twe.prop==="alpha")endObjs[sei].alpha=twe.to;
                else if(twe.prop==="rotation")endObjs[sei].rotation=twe.to*180/Math.PI;
              }
            }
            endKF.objects=endObjs;
            endKF.duration=1;
            endKF.tweenType="none";
            layer.keyframes.push(endKF);
          }

          // Sort keyframes by index
          layer.keyframes.sort(function(a,b){return a.index-b.index;});

          // Fill gap at frame 1 if no keyframe there
          if(layer.keyframes.length>0&&layer.keyframes[0].index>1){
            var gapKF=new KeyFrame(1);
            gapKF.objects=edObjs.slice();
            gapKF.duration=layer.keyframes[0].index-1;
            layer.keyframes.unshift(gapKF);
          }
        }
      }

      doc.layers.push(layer);
    }

    // If we ended up with no layers, add a default
    if(doc.layers.length===0){
      doc.layers=[new Layer("Layer 1")];
    }

    // Reverse layers so bottom-drawn items are at the bottom of the layer stack
    doc.layers.reverse();
  }

  curFrame=1;
  curLayer=0;
  selection=[];
  undoStack=[];
  redoStack=[];
  centerStage();
  fullRefresh();

  // Show summary
  var totalObjs=0;
  doc.layers.forEach(function(l){
    l.keyframes.forEach(function(kf){totalObjs+=kf.objects.length;});
  });
  var symCount=Object.keys(doc.library).length;
  var msg="Scene imported!\n\n"+
    "Stage: "+doc.width+"x"+doc.height+" @ "+doc.fps+"fps\n"+
    "Layers: "+doc.layers.length+"\n"+
    "Objects: "+totalObjs+"\n"+
    "Symbols in library: "+symCount+"\n"+
    "Frames: "+doc.totalFrames;
  if(symCount>0)msg+="\n\nNested MovieClips were converted to library symbols.\nDouble-click them to edit.";
  msg+="\n\nNote: Examples that use enterFrame scripting (like Solar System)\nimport as a static snapshot. Timeline tweens are preserved\nwhere they exist.";
  alert(msg);
}

function testMovie(){
  genHTML(function(html){
    var blob=new Blob([html],{type:"text/html"});
    var url=URL.createObjectURL(blob);
    window.open(url,"_blank");
  });
}

// === UI Wiring & Init ===
/* The bottom tab bar and the per-panel collapse arrows lived here. Both are
 * now the dockable workspace's job (workspace.js): panels carry their own
 * tab strips wherever they are docked, and collapse is per dock. */

/* ------------------------------------------------------------------ *
 * Actions panel
 *
 * The <textarea id="frame-script"> had no handler at all: you could type a
 * frame script into it and it went nowhere. It now edits the current
 * keyframe's script — the same field the Properties panel's "Frame Script"
 * box writes to.
 *
 * Scripts are NOT evaluated while scrubbing or playing in the editor — same as
 * Flash, where you had to Test Movie. The editor stays a document editor; the
 * export and Test Movie runtimes are where scripts run (see exportRuntime).
 * ------------------------------------------------------------------ */
function initActionsPanel(){
  var ta=document.getElementById("frame-script");
  if(!ta)return;
  ta.placeholder="// Frame script (JavaScript) — runs on entering this keyframe\n"+
                 "// in Test Movie and in exported files. Available: stop(), play(),\n"+
                 "// gotoAndPlay(f), gotoAndStop(f), root, stage, Flashy\n"+
                 "// e.g.  stop();";
  ta.addEventListener("change",function(){
    var kf=CKF();
    if(!kf){ta.value="";return;}
    if(kf.script===ta.value)return;
    pushUndo();
    kf.script=ta.value;
    updateTL();      // the timeline draws an 'a' marker on scripted keyframes
  });
}
function updateActionsPanel(){
  var ta=document.getElementById("frame-script");
  if(!ta)return;
  // Never overwrite what the user is in the middle of typing.
  if(document.activeElement===ta)return;
  var kf=CKF();
  ta.disabled=!kf;
  ta.value=kf?(kf.script||""):"";
}

/**
 * Keep the editor in step with the dockable workspace.
 *
 * Re-docking or resizing a panel changes how much room the stage has, and the
 * stage canvas is sized from its container — so the canvas has to be
 * re-measured and the timeline redrawn whenever the layout moves. Without
 * this, dragging the right dock wider leaves the canvas at its old width and
 * the drawing coordinates silently stop matching the cursor.
 */
function initWorkspaceSync(){
  // Fires on every pointermove of a splitter drag — keep it to the one thing
  // that must track the pointer.
  window.addEventListener("flashy:dockresize",function(){
    resizeCanvas();
  });
  window.addEventListener("flashy:layoutchange",function(){
    resizeCanvas();
    renderTLFrames();
    // A panel that has just been docked into view may never have been
    // populated (it was parked while hidden), so refresh its contents.
    updateProps();
    updateActionsPanel();
    updateColorUI();
    updateLib();
  });
}

/** Window-menu verbs. Absent in a page without workspace.js (e.g. a test harness). */
function workspace(){return window._flashyWorkspace||null;}

function fullRefresh(){
  render();
  updateTL();
  updateProps();
  updateActionsPanel();
  updateColorUI();
  updateLib();
}

/* ------------------------------------------------------------------ *
 * Unsaved-work guard
 *
 * Browsers only let a page object to being closed from a `beforeunload`
 * handler, and only by setting returnValue — the browser picks the wording.
 *
 * Electron is deliberately excluded: there, returning a value from
 * beforeunload cancels the close WITHOUT showing anything, so the window would
 * simply refuse to close with no explanation. The desktop build gets a real
 * three-way Save / Don't Save / Cancel dialog from the main process instead
 * (see electron/main.cjs), driven by the dirty state desktop.js forwards.
 * ------------------------------------------------------------------ */
function initUnloadGuard(){
  window.addEventListener("beforeunload",function(e){
    if(desktopHost||!isDirty())return;
    e.preventDefault();
    e.returnValue="";   // required by Chrome/Safari to trigger the prompt
    return "";
  });
}

// === Init ===
function init(){
  buildMenuBar();
  buildToolbar();
  buildToolbox();
  buildColorUI();
  resizeCanvas();
  centerStage();
  initMouse();
  initTLClicks();
  initKeys();
  initWorkspaceSync();
  // Audio seam — what File ▸ Import Sound, the timeline drop handler and the
  // tests all go through. Kept separate from _flashyAI so the assistant's
  // surface stays about drawing.
  window._flashyAudio={
    importSoundFile:importSoundFile,
    deleteSoundAsset:deleteSoundAsset,
    soundItems:soundItems,
    scrub:audioScrub,
    track:function(){return audioTrack;},
    lipSync:generateLipSync,
    mouthSetup:setupMouthShapes,
    visemes:LIPSYNC_VISEMES,
    mouthChart:mouthChartFor,
    classify:function(feat,o){return smoothVisemes(classifyVisemes(feat,o),o);},
    assets:function(){return doc.sounds;}
  };
  initActionsPanel();
  initUnloadGuard();
  initAIPanel();
  window._flashyAI = {
    doc: doc,
    currentLayers: currentLayers,
    pushUndo: pushUndo,
    fullRefresh: fullRefresh,
    Layer: Layer,
    KeyFrame: KeyFrame,
    EditorObject: EditorObject,
    centerStage: centerStage,
    render: render,
    updateTL: updateTL,
    updateProps: updateProps,
    selection: function(){ return selection; },
    setSelection: function(s){ selection = s; },
    curFrame: function(){ return curFrame; },
    setCurFrame: function(f){ curFrame = f; },
    curLayer: function(){ return curLayer; },
    setCurLayer: function(l){ curLayer = l; },
    /** Timeline pixels-per-frame — the timeline is zoomable. */
    tlFrameWidth: function(){ return TL_FW_(); }
  };
  fullRefresh();
  window.addEventListener("resize",function(){
    resizeCanvas();
    renderTLFrames();
  });
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",init);
}else{
  init();
}

// === AI Assistant Panel ===
/* ------------------------------------------------------------------ *
 * AI assistant configuration
 *
 * The assistant talks to the Messages API with `fetch` rather than the
 * Anthropic SDK: Flashy is a static app with no bundler, and the browser is
 * the only runtime here. The request shape below is the one the API documents
 * for current models.
 * ------------------------------------------------------------------ */
var AI_MODEL = "claude-opus-5";
// max_tokens caps thinking AND the reply together on models with adaptive
// thinking, so this has to leave room for both — 16K was enough for the reply
// alone and could truncate a thinking turn mid-sentence. Streaming is what
// makes a budget this large safe from request timeouts.
var AI_MAX_TOKENS = 32000;
var AI_TIMEOUT_MS = 300000;
// Turns of history to resend. The system prompt carries the project state, so
// this only needs to cover the recent back-and-forth.
var AI_HISTORY_TURNS = 8;

var aiMessages = [];
/** AbortController for the in-flight request, or null when idle. */
var aiAbort = null;
var aiApiKey = "";
// Reference image attached to the next message: {media_type, data (base64), name} or null
var aiPendingImage = null;
// Try to load API key from multiple sources:
// 1. Window global (set by server-side template or config script)
// 2. Meta tag <meta name="anthropic-api-key" content="sk-...">
// 3. localStorage (previously saved by user)
(function loadApiKey(){
  // Check window global (e.g. set from env var by a server)
  if(window.ANTHROPIC_API_KEY) { aiApiKey = window.ANTHROPIC_API_KEY; return; }
  if(window.FLASHY_API_KEY) { aiApiKey = window.FLASHY_API_KEY; return; }
  // Check meta tag
  var meta = document.querySelector('meta[name="anthropic-api-key"]');
  if(meta && meta.content) { aiApiKey = meta.content; return; }
  // Check localStorage
  var stored = localStorage.getItem("flashy_ai_key");
  if(stored) { aiApiKey = stored; return; }
  // Also try fetching from a local config endpoint (for dev servers)
  fetch("/api/config").then(function(r){
    if(r.ok) return r.json();
  }).then(function(data){
    if(data && data.anthropicApiKey) { aiApiKey = data.anthropicApiKey; }
  }).catch(function(){});
})();

/* ------------------------------------------------------------------ *
 * API key
 *
 * There used to be no way to find this: the key was only ever asked for by a
 * prompt() the first time you pressed Send — and prompt() throws in Electron,
 * so in the desktop app the assistant simply did nothing at all. There is now
 * a menu item (Edit > Preferences), a button in the panel itself when no key
 * is set, and this dialog behind both.
 * ------------------------------------------------------------------ */
function aiKeySource(){
  if(window.ANTHROPIC_API_KEY||window.FLASHY_API_KEY)return "a page global";
  if(document.querySelector('meta[name="anthropic-api-key"]'))return "a meta tag";
  if(localStorage.getItem("flashy_ai_key"))return "this browser";
  return null;
}

function showApiKeyDialog(onSaved){
  var stored=localStorage.getItem("flashy_ai_key")||"";
  var src=aiKeySource();
  showDialog({
    title:"AI Assistant — Anthropic API key",
    message:aiApiKey
      ? "A key is currently set"+(src?" from "+src:"")+". Replace or remove it below."
      : "The assistant needs your own Anthropic API key. Create one at console.anthropic.com.",
    fields:[{
      name:"key",
      label:"API key",
      type:"password",
      value:stored,
      placeholder:"sk-ant-...",
      hint:"Stored in this browser only and sent directly to api.anthropic.com. "+
           "Never put a key in a document you share."
    }],
    footnote:"Model: "+AI_MODEL+". The assistant writes code that runs inside the editor — "+
             "nothing changes your project until you press Apply.",
    okLabel:"Save key",
    extraButtons:[{
      label:"Remove key",
      onClick:function(v,close){
        localStorage.removeItem("flashy_ai_key");
        aiApiKey="";
        close();
        updateAIKeyNotice();
      }
    }],
    validate:function(v){
      var k=(v.key||"").trim();
      if(!k)return "Enter a key, or press Remove key.";
      // The common mistake is a pasted sentence or stray whitespace, not a
      // subtly wrong key — so check for that and let the API judge the rest.
      if(/\s/.test(k))return "That contains a space — paste just the key.";
      if(k.length<20)return "That looks too short to be an API key.";
      return null;
    },
    onOk:function(v){
      aiApiKey=v.key.trim();
      localStorage.setItem("flashy_ai_key",aiApiKey);
      updateAIKeyNotice();
      if(onSaved)onSaved();
    }
  });
}

/**
 * Show or hide the "no key yet" banner in the AI panel, so the assistant
 * explains itself instead of appearing broken.
 */
function updateAIKeyNotice(){
  var panel=document.getElementById("aiPanel");
  if(!panel)return;
  var notice=document.getElementById("ai-key-notice");
  if(aiApiKey){
    if(notice&&notice.parentNode)notice.parentNode.removeChild(notice);
    return;
  }
  if(notice)return;
  notice=document.createElement("div");
  notice.id="ai-key-notice";
  notice.className="ai-key-notice";
  var txt=document.createElement("span");
  txt.textContent="Add your Anthropic API key to use the assistant.";
  notice.appendChild(txt);
  var btn=document.createElement("button");
  btn.className="ai-key-btn";
  btn.textContent="Add API key";
  btn.addEventListener("click",function(){showApiKeyDialog();});
  notice.appendChild(btn);
  panel.insertBefore(notice,panel.firstChild);
}

function initAIPanel() {
  var panel = document.getElementById("aiPanel");
  if (!panel) return;

  var chat = document.createElement("div");
  chat.id = "ai-chat";
  panel.appendChild(chat);

  // Drag-and-drop zone for an optional reference image
  var drop = document.createElement("div");
  drop.id = "ai-drop";
  drop.className = "ai-drop";
  var dropLabel = document.createElement("span");
  dropLabel.className = "ai-drop-label";
  dropLabel.textContent = "🖼 Drop a reference image here, or click to browse";
  drop.appendChild(dropLabel);
  var fileInput = document.createElement("input");
  fileInput.id = "ai-file";
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/gif,image/webp";
  fileInput.style.display = "none";
  drop.appendChild(fileInput);
  // Preview (thumbnail + name + remove), hidden until an image is attached
  var preview = document.createElement("div");
  preview.id = "ai-img-preview";
  preview.className = "ai-img-preview";
  preview.style.display = "none";
  drop.appendChild(preview);

  drop.addEventListener("click", function(e) {
    if (e.target === fileInput) return;
    // clicking the remove button is handled separately; ignore clicks on it
    if (e.target.classList && e.target.classList.contains("ai-img-remove")) return;
    fileInput.click();
  });
  fileInput.addEventListener("change", function() {
    if (fileInput.files && fileInput.files[0]) aiHandleImageFile(fileInput.files[0]);
    fileInput.value = "";
  });
  drop.addEventListener("dragover", function(e) {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", function(e) {
    e.preventDefault(); e.stopPropagation();
    drop.classList.remove("dragover");
  });
  drop.addEventListener("drop", function(e) {
    e.preventDefault(); e.stopPropagation();
    drop.classList.remove("dragover");
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      aiHandleImageFile(dt.files[0]);
    }
  });
  panel.appendChild(drop);

  var inputRow = document.createElement("div");
  inputRow.id = "ai-input-row";
  var input = document.createElement("input");
  input.id = "ai-input";
  input.type = "text";
  input.placeholder = "Describe what you want to create...";
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aiSend(); }
  });
  inputRow.appendChild(input);
  var btn = document.createElement("button");
  btn.id = "ai-send";
  btn.textContent = "Send";
  btn.addEventListener("click", aiSend);
  inputRow.appendChild(btn);
  panel.appendChild(inputRow);

  updateAIKeyNotice();

  aiAddMsg("assistant", "I'm your Flash design assistant. I can create scenes, characters, animations, and interactive elements directly in your project.\n\nTry:\n\u2022 \"Create a sunset landscape with mountains and clouds\"\n\u2022 \"Add a bouncing red ball with motion tween\"\n\u2022 \"Build a button that glows on hover\"\n\u2022 \"Make a 30-frame walk cycle for a stick figure\"\n\u2022 \"Create a starfield background with parallax\"",
                 null, {history: false});
}

// Read a dropped/selected image file, downscale if oversized, and stage it.
function aiHandleImageFile(file) {
  var okTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!file || okTypes.indexOf(file.type) < 0) {
    aiAddMsg("system", "Unsupported image type. Use PNG, JPEG, GIF, or WebP.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function() {
    var dataUrl = reader.result;
    var img = new Image();
    img.onload = function() {
      var MAX = 1568; // long-edge cap keeps token cost reasonable
      var w = img.naturalWidth, h = img.naturalHeight;
      var longEdge = Math.max(w, h);
      var mediaType = file.type, outUrl = dataUrl;
      // Downscale large images (GIF is kept as-is to preserve animation frames the API reads)
      if (longEdge > MAX && file.type !== "image/gif") {
        var scale = MAX / longEdge;
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var cvs = document.createElement("canvas");
        cvs.width = cw; cvs.height = ch;
        cvs.getContext("2d").drawImage(img, 0, 0, cw, ch);
        // JPEG for opaque photos, PNG when transparency may matter
        if (file.type === "image/jpeg") {
          outUrl = cvs.toDataURL("image/jpeg", 0.85); mediaType = "image/jpeg";
        } else {
          outUrl = cvs.toDataURL("image/png"); mediaType = "image/png";
        }
      }
      var comma = outUrl.indexOf(",");
      aiPendingImage = {
        media_type: mediaType,
        data: outUrl.slice(comma + 1),
        name: file.name || "image"
      };
      aiRenderImagePreview(outUrl);
    };
    img.onerror = function() { aiAddMsg("system", "Could not read that image."); };
    img.src = dataUrl;
  };
  reader.onerror = function() { aiAddMsg("system", "Could not read that file."); };
  reader.readAsDataURL(file);
}

function aiRenderImagePreview(url) {
  var preview = document.getElementById("ai-img-preview");
  var label = document.querySelector("#ai-drop .ai-drop-label");
  if (!preview) return;
  preview.textContent = "";
  var thumb = document.createElement("img");
  thumb.className = "ai-img-thumb";
  thumb.src = url;
  preview.appendChild(thumb);
  var name = document.createElement("span");
  name.className = "ai-img-name";
  name.textContent = aiPendingImage ? aiPendingImage.name : "";
  preview.appendChild(name);
  var remove = document.createElement("span");
  remove.className = "ai-img-remove";
  remove.textContent = "×";
  remove.title = "Remove image";
  remove.addEventListener("click", function(e) {
    e.stopPropagation();
    aiClearPendingImage();
  });
  preview.appendChild(remove);
  preview.style.display = "flex";
  if (label) label.style.display = "none";
}

function aiClearPendingImage() {
  aiPendingImage = null;
  var preview = document.getElementById("ai-img-preview");
  var label = document.querySelector("#ai-drop .ai-drop-label");
  if (preview) { preview.textContent = ""; preview.style.display = "none"; }
  if (label) label.style.display = "";
}

/** Render plain text with newlines into a container, no HTML interpretation. */
function aiRenderText(container, text) {
  container.textContent = "";
  var lines = String(text == null ? "" : text).split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (i > 0) container.appendChild(document.createElement("br"));
    var span = document.createElement("span");
    span.textContent = lines[i];
    container.appendChild(span);
  }
}

function aiApplyButton(code) {
  var applyBtn = document.createElement("div");
  applyBtn.className = "ai-apply-btn";
  applyBtn.textContent = "▶ Apply to Project";
  applyBtn.addEventListener("click", function() {
    aiApplyCode(code);
    applyBtn.textContent = "✓ Applied";
    applyBtn.style.background = "#336633";
  });
  return applyBtn;
}

/**
 * Add a message bubble.
 *
 * opts.history — whether this message joins the conversation sent to the API.
 * The opening greeting must NOT: aiMessages is sent as the `messages` array,
 * and the Messages API requires the first message to use the "user" role. With
 * the greeting in there every request began with an assistant turn and came
 * back 400, so the panel could not complete a single call.
 *
 * opts.historyText — what the model should see, when that differs from what the
 * user sees. Assistant turns are displayed with the code block stripped out but
 * must be remembered WITH it, or a follow-up like "make it bigger" asks the
 * model to revise code it cannot see.
 */
function aiAddMsg(role, text, applyCode, opts) {
  opts = opts || {};
  var chat = document.getElementById("ai-chat");
  if (!chat) return null;
  var div = document.createElement("div");
  div.className = "ai-msg " + role;
  var body = document.createElement("span");
  aiRenderText(body, text);
  div.appendChild(body);
  if (applyCode) div.appendChild(aiApplyButton(applyCode));
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (role !== "system" && opts.history !== false) {
    aiMessages.push({ role: role, content: opts.historyText != null ? opts.historyText : text });
  }
  return div;
}

/**
 * An assistant bubble that fills in as the response streams.
 *
 * The API recommends streaming for anything with a long response or a high
 * max_tokens — it avoids request timeouts — and it is the difference between a
 * static "Creating..." and visible progress on a turn that can run for minutes
 * with adaptive thinking.
 */
function aiStreamBubble() {
  var chat = document.getElementById("ai-chat");
  var div = document.createElement("div");
  div.className = "ai-msg assistant";
  var body = document.createElement("span");
  div.appendChild(body);
  var status = document.createElement("div");
  status.className = "ai-typing";
  status.textContent = "Thinking…";
  div.appendChild(status);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return {
    el: div,
    // Follow the bottom only while the user is already at the bottom, so
    // scrolling back to read earlier output is not yanked away mid-stream.
    setText: function(t) {
      var pinned = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
      aiRenderText(body, t);
      if (pinned) chat.scrollTop = chat.scrollHeight;
    },
    setStatus: function(s) {
      if (s) { status.textContent = s; status.style.display = ""; }
      else status.style.display = "none";
    },
    finish: function(text, code) {
      aiRenderText(body, text);
      this.setStatus(null);
      if (code) div.appendChild(aiApplyButton(code));
      chat.scrollTop = chat.scrollHeight;
    },
    remove: function() { if (div.parentNode) div.parentNode.removeChild(div); }
  };
}

/** Flip the Send button between Send and Stop while a request is in flight. */
function aiSetBusy(busy) {
  var btn = document.getElementById("ai-send");
  if (!btn) return;
  btn.textContent = busy ? "Stop" : "Send";
  if (busy) btn.classList.add("busy"); else btn.classList.remove("busy");
}

function aiSend() {
  // While a request is in flight the button is a Stop button. An adaptive
  // thinking turn can run for minutes and there was previously no way out.
  if (aiAbort) { aiAbort.abort(); return; }

  var input = document.getElementById("ai-input");
  var text = input.value.trim();
  var image = aiPendingImage;
  if (!text && !image) return;
  input.value = "";

  if (!aiApiKey) {
    // Put the text back so it is not lost behind the dialog, and send it
    // automatically once a key exists.
    input.value = text;
    showApiKeyDialog(function () { aiSend(); });
    return;
  }

  var displayText = (image ? "🖼 " + image.name + "\n" : "") + (text || "(use the attached reference image)");
  aiAddMsg("user", displayText);
  aiClearPendingImage();

  var bubble = aiStreamBubble();
  aiSetBusy(true);

  aiCallAPI(text, image, {
    onDelta: function(sofar) { bubble.setStatus(null); bubble.setText(sofar); },
    onStatus: function(s) { bubble.setStatus(s); },
    onDone: function(display, code, historyText) {
      aiSetBusy(false);
      if (!display && !code) { bubble.remove(); return; }
      bubble.finish(display || "Here's what I created:", code);
      // Remembered WITH the code block, unlike what is displayed.
      aiMessages.push({ role: "assistant", content: historyText });
    },
    onError: function(message) {
      aiSetBusy(false);
      bubble.remove();
      aiAddMsg("system", message);
    }
  });
}

function aiCallAPI(userText, image, handlers) {
  var docState = JSON.stringify({
    width: doc.width, height: doc.height, fps: doc.fps,
    bg: doc.backgroundColor,
    layerCount: currentLayers().length,
    layerNames: currentLayers().map(function(l){return l.name;}),
    curFrame: curFrame, curLayer: curLayer,
    totalFrames: currentTotalFrames(),
    librarySymbols: Object.keys(doc.library),
    selectedObjects: selection.length
  });

  var systemPrompt = "You are an expert Flash designer embedded in Flashy Studio. Generate code that manipulates the editor's document model.\n\n" +
    "PROJECT: " + docState + "\n\n" +
    "ACCESS: var F = window._flashyAI;\n" +
    "- F.doc.width, F.doc.height, F.doc.fps, F.doc.backgroundColor\n" +
    "- F.doc.layers (array), F.doc.library (object)\n" +
    "- F.pushUndo(), F.fullRefresh(), F.currentLayers()\n" +
    "- new F.Layer(name), new F.KeyFrame(index), new F.EditorObject(type)\n" +
    "- F.setCurFrame(n), F.setCurLayer(n)\n\n" +
    "WORKING EXAMPLE — adds a red rectangle on a new layer:\n" +
    "```flashy-code\n" +
    "var F = window._flashyAI;\n" +
    "F.pushUndo();\n" +
    "var layer = new F.Layer('My Layer');\n" +
    "var rect = new F.EditorObject('rect');\n" +
    "rect.x = 100; rect.y = 100; rect.width = 200; rect.height = 150;\n" +
    "rect.fillColor = '#FF3333'; rect.fillAlpha = 1;\n" +
    "rect.strokeColor = '#990000'; rect.strokeWidth = 2;\n" +
    "layer.keyframes[0].objects.push(rect);\n" +
    "layer.keyframes[0].duration = F.doc.totalFrames || 60;\n" +
    "F.doc.layers.unshift(layer);\n" +
    "F.fullRefresh();\n" +
    "```\n\n" +
    "WORKING EXAMPLE — animated circle bouncing across with tween:\n" +
    "```flashy-code\n" +
    "var F = window._flashyAI;\n" +
    "F.pushUndo();\n" +
    "var layer = new F.Layer('Bouncing Ball');\n" +
    "// Keyframe 1: ball on the left\n" +
    "var kf1 = layer.keyframes[0];\n" +
    "kf1.duration = 30;\n" +
    "kf1.tweenType = 'motion';\n" +
    "kf1.easing = 'bounceOut';\n" +
    "var ball1 = new F.EditorObject('oval');\n" +
    "ball1.x = 50; ball1.y = 200; ball1.width = 60; ball1.height = 60;\n" +
    "ball1.fillColor = '#3399FF'; ball1.fillAlpha = 1;\n" +
    "kf1.objects.push(ball1);\n" +
    "// Keyframe 2: ball on the right (tween interpolates between kf1 and kf2)\n" +
    "var kf2 = new F.KeyFrame(31);\n" +
    "kf2.duration = 30;\n" +
    "kf2.tweenType = 'motion';\n" +
    "kf2.easing = 'bounceOut';\n" +
    "var ball2 = new F.EditorObject('oval');\n" +
    "ball2.x = 700; ball2.y = 200; ball2.width = 60; ball2.height = 60;\n" +
    "ball2.fillColor = '#3399FF'; ball2.fillAlpha = 1;\n" +
    "kf2.objects.push(ball2);\n" +
    "layer.keyframes.push(kf2);\n" +
    "// Keyframe 3: ball back on the left\n" +
    "var kf3 = new F.KeyFrame(61);\n" +
    "kf3.duration = 1;\n" +
    "var ball3 = new F.EditorObject('oval');\n" +
    "ball3.x = 50; ball3.y = 200; ball3.width = 60; ball3.height = 60;\n" +
    "ball3.fillColor = '#3399FF'; ball3.fillAlpha = 1;\n" +
    "kf3.objects.push(ball3);\n" +
    "layer.keyframes.push(kf3);\n" +
    "F.doc.layers.unshift(layer);\n" +
    "F.doc.totalFrames = Math.max(F.doc.totalFrames, 61);\n" +
    "F.fullRefresh();\n" +
    "```\n\n" +
    "RULES:\n" +
    "- ALWAYS start with: var F = window._flashyAI;\n" +
    "- ALWAYS call F.pushUndo() before changes and F.fullRefresh() after\n" +
    "- EditorObject types: 'rect', 'oval', 'line', 'pencil', 'text'\n" +
    "- Object properties: x, y, width, height, fillColor (hex string), fillAlpha (0-1), strokeColor, strokeWidth, strokeAlpha, rotation (degrees), alpha (0-1), scaleX, scaleY\n" +
    "- For text: set .text, .font, .fontSize, .fillColor\n" +
    "- For lines: set .points = [x1,y1,x2,y2,...] — coordinates are LOCAL to the object (relative to its x,y, so the first point is usually 0,0)\n" +
    "- Layer has keyframes[]. First keyframe is keyframes[0] at index 1\n" +
    "- For tweens: kf.tweenType='motion', kf.easing='bounceOut'|'elasticOut'|'sineInOut'|'cubicOut'|'linear'|etc\n" +
    "- EACH keyframe MUST have the SAME number of objects for tweening to work\n" +
    "- Objects in kf1 and kf2 are matched by array index — kf1.objects[0] tweens to kf2.objects[0]\n" +
    "- Add layers with: F.doc.layers.unshift(layer) (unshift = top, push = bottom)\n" +
    "- Set F.doc.totalFrames if your animation needs more frames\n" +
    "- Be visually rich — use multiple layers, colors, gradients aren't available but use multiple colored shapes\n" +
    "- Wrap code in ```flashy-code ... ``` block\n" +
    "- Brief description first (1-2 sentences), then the code block. Nothing else.\n" +
    (image ? "- The user attached a REFERENCE IMAGE. Recreate its composition, colors, shapes, and layout as closely as the editor's primitives allow.\n" : "");

  /* ---------------------------------------------------------------- *
   * Conversation history
   *
   * The API requires messages[0].role === "user". Two things used to break
   * that: the opening greeting was stored as an assistant turn (now excluded
   * at the source — see aiAddMsg), and a sliding window can still begin on an
   * assistant turn once the conversation is long enough. Drop leading
   * assistant turns rather than relying on the window landing well.
   * ---------------------------------------------------------------- */
  var recent = aiMessages.slice(-AI_HISTORY_TURNS);
  while (recent.length && recent[0].role !== "user") recent.shift();

  var messages = recent.map(function (m) {
    return { role: m.role, content: m.content };
  });

  // Attach the reference image to the current (last user) message.
  if (image && messages.length) {
    var last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content = [
        { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
        { type: "text", text: typeof last.content === "string" ? last.content : (userText || "") }
      ];
    }
  }

  if (!messages.length) {
    handlers.onError("Nothing to send.");
    return;
  }

  /** Pull the code block out of a response, and the prose that isn't it. */
  function splitResponse(text) {
    var FENCE = /```(?:flashy-code|javascript|js)?\s*\n([\s\S]*?)```/;
    var m = text.match(FENCE);
    var code = m ? m[1].trim() : null;
    // Unfenced fallback: a reply that is plainly editor code but forgot the fence.
    if (!code && text.indexOf("window._flashyAI") >= 0 && text.indexOf("F.pushUndo") >= 0) {
      var lines = text.split("\n");
      var codeLines = [];
      var inCode = false;
      for (var li = 0; li < lines.length; li++) {
        if (lines[li].indexOf("var F") >= 0 || inCode) { inCode = true; codeLines.push(lines[li]); }
      }
      if (codeLines.length > 2) code = codeLines.join("\n");
    }
    var display = text.replace(new RegExp(FENCE.source, "g"), "").trim();
    return { code: code, display: display };
  }

  aiAbort = new AbortController();
  // A hard ceiling, since a hung connection would otherwise leave the panel
  // stuck in its busy state with no way back.
  var timedOut = false;
  var settled = false;
  var timer = setTimeout(function () {
    timedOut = true;
    if (aiAbort) aiAbort.abort();
  }, AI_TIMEOUT_MS);

  function finish(fn, a, b, c) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    aiAbort = null;
    fn(a, b, c);
  }

  // Return the UI to idle the moment a stop is requested, rather than waiting
  // for the network layer to reject the read in flight. Without this, a
  // connection that goes quiet instead of erroring leaves the panel stuck
  // showing "Stop" with no way back.
  aiAbort.signal.addEventListener("abort", function () {
    finish(handlers.onError, timedOut
      ? "Timed out after " + Math.round(AI_TIMEOUT_MS / 1000) + "s."
      : "Stopped.");
  });

  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: aiAbort.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": aiApiKey,
      "anthropic-version": "2023-06-01",
      // Required to call the API directly from a browser. The key is the
      // user's own, held in this page — see ROADMAP.md §31 for the trust model.
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      // Adaptive thinking: the model decides how much to think per request.
      // On current models max_tokens caps thinking AND the reply together,
      // which is why AI_MAX_TOKENS is generous.
      thinking: { type: "adaptive" },
      stream: true,
      system: systemPrompt,
      messages: messages
    })
  }).then(function (res) {
    if (!res.ok) {
      if (res.status === 401) {
        aiApiKey = "";
        localStorage.removeItem("flashy_ai_key");
        updateAIKeyNotice();
        finish(handlers.onError, "API key rejected. Use Edit ▸ Preferences to enter a new one.");
        return;
      }
      return res.text().then(function (t) {
        finish(handlers.onError, "API error " + res.status + ": " + t);
      });
    }
    if (!res.body || typeof res.body.getReader !== "function") {
      finish(handlers.onError, "This browser cannot read a streaming response.");
      return;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var text = "";
    var stopReason = null;
    var apiError = null;

    /** One SSE `data:` payload. */
    function handleEvent(payload) {
      var evt;
      try { evt = JSON.parse(payload); } catch (e) { return; }
      if (evt.type === "content_block_delta" && evt.delta) {
        if (evt.delta.type === "text_delta") {
          text += evt.delta.text;
          // Show prose as it arrives; the code block is hidden behind the
          // Apply button, so strip it from the live preview too.
          handlers.onDelta(splitResponse(text).display || "…");
        } else if (evt.delta.type === "thinking_delta") {
          handlers.onStatus("Thinking…");
        }
      } else if (evt.type === "content_block_start" && evt.content_block) {
        if (evt.content_block.type === "thinking") handlers.onStatus("Thinking…");
        else if (evt.content_block.type === "text") handlers.onStatus("Writing…");
      } else if (evt.type === "message_delta" && evt.delta) {
        if (evt.delta.stop_reason) stopReason = evt.delta.stop_reason;
      } else if (evt.type === "error") {
        apiError = (evt.error && evt.error.message) || "stream error";
      }
    }

    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) {
          if (apiError) { finish(handlers.onError, "API error: " + apiError); return; }
          if (stopReason === "refusal") {
            finish(handlers.onError, "The model declined this request. Try rephrasing it.");
            return;
          }
          var parts = splitResponse(text);
          if (stopReason === "max_tokens" && !parts.code) {
            finish(handlers.onError, "The reply was cut off before any code was produced. Try a smaller request.");
            return;
          }
          // The model sees the full text including the code block; the user
          // sees the prose with the block replaced by the Apply button.
          finish(handlers.onDone, parts.display, parts.code, text);
          return;
        }
        buffer += decoder.decode(chunk.value, { stream: true });
        // SSE frames are separated by a blank line; a frame may carry several
        // fields, and only `data:` matters here.
        var frames = buffer.split("\n\n");
        buffer = frames.pop();
        for (var i = 0; i < frames.length; i++) {
          var fieldLines = frames[i].split("\n");
          for (var j = 0; j < fieldLines.length; j++) {
            if (fieldLines[j].indexOf("data:") === 0) handleEvent(fieldLines[j].slice(5).trim());
          }
        }
        return pump();
      });
    }
    return pump();
  }).catch(function (err) {
    if (err && err.name === "AbortError") {
      finish(handlers.onError, timedOut
        ? "Timed out after " + Math.round(AI_TIMEOUT_MS / 1000) + "s."
        : "Stopped.");
      return;
    }
    finish(handlers.onError, "Connection error: " + ((err && err.message) || err));
  });
}

function aiApplyCode(code) {
  // Wrap in try/catch so errors are reported
  var wrappedCode = "(function(){\ntry{\n" + code + "\n}catch(_e){" +
    "var _chat=document.getElementById('ai-chat');" +
    "if(_chat){var _d=document.createElement('div');_d.className='ai-msg system';" +
    "_d.textContent='Error: '+_e.message;_chat.appendChild(_d);_chat.scrollTop=_chat.scrollHeight;}" +
    "console.error('AI code error:',_e);" +
    "}\n})();";
  try {
    var script = document.createElement("script");
    script.textContent = wrappedCode;
    document.head.appendChild(script);
    document.head.removeChild(script);
  } catch(e) {
    aiAddMsg("system", "Script injection error: " + e.message);
  }
}

})();
