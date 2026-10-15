// Flashy Studio Editor - generated
(function(){
"use strict";
var N=1;function uid(){return N++;}
// `bitmapAsset` names an entry in doc.bitmaps (type "bitmap"); `path` is a
// flat command stream for traced vector outlines (type "path") — see
// flashy-trace.js for the encoding, and `pathW`/`pathH` for how resizing one
// works. `eraseMask` is the same encoding again, holding the parts of a bitmap
// the eraser has taken out, in a `maskW` x `maskH` box.
//
// All three are FLAT arrays of numbers rather than arrays of loops, and that
// is deliberate: clone() below copies arrays with a shallow slice, so a nested
// structure would be shared between an object and its copy and every edit to
// one would show up in the other.
//
// All default empty, so every other object type is unchanged.
function EditorObject(t){this.id=uid();this.type=t;this.x=0;this.y=0;this.width=0;this.height=0;this.rotation=0;this.scaleX=1;this.scaleY=1;this.skewX=0;this.skewY=0;this.alpha=1;this.name="";this.fillColor="#000000";this.fillAlpha=1;this.fillType="solid";this.strokeColor="#000000";this.strokeAlpha=1;this.strokeWidth=1;this.strokeStyle="solid";this.strokeCap="round";this.strokeJoin="round";this.points=null;this.text="";this.font="Arial";this.fontSize=24;this.fontBold=false;this.fontItalic=false;this.fontUnderline=false;this.textAlign="left";this.lineHeight=1.2;this.symbolName="";this.instanceName="";this.symbolBehavior="movieclip";this.firstFrame=1;this.loopMode="loop";this.blendMode="source-over";this.bitmapAsset="";this.smoothing=true;this.path=null;this.pathW=0;this.pathH=0;this.eraseMask=null;this.maskW=0;this.maskH=0;}
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
// `bitmaps` is the raster asset library: name -> {name, mediaType, data
// (base64), width, height}. Objects of type "bitmap" reference assets by name,
// exactly as keyframes reference sounds and instances reference `library`, and
// the bytes travel inside the .flashy so a project with a photo background is
// still one self-contained file.
var doc={width:550,height:400,fps:24,backgroundColor:"#FFFFFF",layers:[new Layer("Layer 1")],library:{},sounds:{},bitmaps:{},characters:{},totalFrames:60};
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
//
// Asset payloads are carried by reference rather than serialised into the
// snapshot string. An asset record is immutable once imported — importing
// makes a new record, deleting removes the key, nothing edits one in place —
// so sharing them is safe, and `data` is a string, which JavaScript shares
// rather than copies.
//
// Stringifying them instead would materialise the base64 into every snapshot:
// one 2048px bitmap across fifty undo steps is a hundred megabytes of
// duplicated text, and audio had the same leak at MP3 scale.
function snap(){
  var d=serializeDoc();
  var sounds=d.sounds,bitmaps=d.bitmaps;
  d.sounds={};d.bitmaps={};
  return {
    json:JSON.stringify({
      d:d,f:curFrame,l:curLayer,
      path:editStack.map(function(c){
        return {name:c.name,savedFrame:c.savedFrame,savedLayer:c.savedLayer};
      })
    }),
    sounds:sounds,bitmaps:bitmaps
  };
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
  var st=JSON.parse(s.json);
  st.d.sounds=s.sounds;st.d.bitmaps=s.bitmaps;
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
/** A field's value — `.checked` for a checkbox, `.value` for everything else. */
function fieldValue(inp){
  return (inp&&inp.type==="checkbox")?!!inp.checked:(inp?inp.value:"");
}
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
      if(f.type==="checkbox")inp.checked=!!f.value;
      else inp.value=f.value!=null?String(f.value):"";
      if(f.placeholder)inp.placeholder=f.placeholder;
      if(f.type==="number"){
        if(f.min!=null)inp.min=f.min;
        if(f.max!=null)inp.max=f.max;
        if(f.step!=null)inp.step=f.step;
      }
      inp.spellcheck=false;
      // Live feedback needs every keystroke, not just blur — a dialog with a
      // preview is useless if the preview waits for focus to leave.
      if(f.onChange){
        inp.addEventListener("input",function(){f.onChange(fieldValue(inp));});
        inp.addEventListener("change",function(){f.onChange(fieldValue(inp));});
      }
    }
    if(f.type==="checkbox"){
      inp.classList.add("fy-dialog-check");
      row.classList.add("fy-dialog-row-check");
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

  /* A hook for dialogs that need more than labelled fields — Trace Bitmap's
     side-by-side preview, for one. It gets the body and the live inputs, so
     custom content can read and drive the standard fields instead of
     reimplementing the chrome, the Escape/Enter handling and the validation. */
  if(opts.build)opts.build(body,inputs,{values:values,setError:function(m){
    err.textContent=m||"";err.style.display=m?"":"none";
  }});

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
    Object.keys(inputs).forEach(function(k){v[k]=fieldValue(inputs[k]);});
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
    // No accelerator: Ctrl+R and Ctrl+Shift+R are the browser's reload, which
    // a page cannot reliably intercept. (The Ctrl+R on Import Sound below has
    // never actually been bound for the same reason.)
    {label:"Import Image...",action:"importImage"},
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
    {label:"Cut Frames",action:"cutFrames",shortcut:"Ctrl+Alt+X"},
    {label:"Copy Frames",action:"copyFrames",shortcut:"Ctrl+Alt+C"},
    {label:"Paste Frames",action:"pasteFrames",shortcut:"Ctrl+Alt+V"},
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
    {label:"Convert Frames to Symbol...",action:"framesToSymbol"},
    {type:"sep"},
    {label:"Create Motion Tween",action:"motionTween"},
    {label:"Create Shape Tween",action:"shapeTween"},
    {label:"Remove Tween",action:"removeTween"},
    {type:"sep"},
    {label:"Trace Bitmap...",action:"traceBitmap"},
    {label:"Swap Bitmap...",action:"swapBitmap"},
    {type:"sep"},
    {label:"Set Up Mouth Shapes...",action:"mouthSetup"},
    {label:"Auto Lip Sync...",action:"lipSync"},
    {type:"sep"},
    {label:"Remove Keyframe",action:"removeKF",shortcut:"Shift+F6"},
    {label:"Remove Frames",action:"removeFrames",shortcut:"Shift+F5"}
  ]},
  {label:"Character",items:[
    {label:"New Biped...",action:"newBiped"},
    {label:"New Character...",action:"newCharacter"},
    {label:"Add Part...",action:"addCharacterPart"},
    {label:"Edit Part...",action:"editCharacterPart"},
    {type:"sep"},
    {label:"Save Pose...",action:"saveCharacterPose"},
    {label:"Animate Poses...",action:"animateCharacter"},
    {type:"sep"},
    {label:"Place In Frame",action:"placeCharacter"},
    {label:"Delete Character...",action:"deleteCharacter"}
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
  {id:"pose",label:"Pose Tool (A) \u2014 drag a limb to swing it",key:"a",svg:'<circle cx="4" cy="3" r="2" fill="currentColor"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><line x1="4" y1="3" x2="8" y2="8" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.4"/>'},
  {id:"transform",label:"Free Transform (Q)",key:"q",svg:'<rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="12" cy="2" r="1.5" fill="currentColor"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'},
  {id:"text",label:"Text Tool (T)",key:"t",svg:'<text x="3" y="12" font-size="12" font-weight="bold" fill="currentColor">T</text>'},
  {id:"line",label:"Line Tool (N)",key:"n",svg:'<line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"rect",label:"Rectangle Tool (R)",key:"r",svg:'<rect x="2" y="3" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"oval",label:"Oval Tool (O)",key:"o",svg:'<ellipse cx="7" cy="7" rx="5" ry="4" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"pencil",label:"Pencil Tool (Y)",key:"y",svg:'<path d="M2,12 L4,10 L10,4 L12,2 L11,3 L5,9 L3,11 Z" fill="none" stroke="currentColor" stroke-width="1"/>'},
  {id:"brush",label:"Brush Tool (B)",key:"b",svg:'<path d="M9,1 Q12,4 8,8 Q6,10 3,13 Q2,12 4,9 Q5,7 6,6 L9,1 Z" fill="currentColor"/>'},
  {id:"eraser",label:"Eraser Tool (E) — erases vector shapes and bitmaps alike",key:"e",svg:'<path d="M5.5,11.5 L1.5,7.5 L7.5,1.5 L11.5,5.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><line x1="3.5" y1="9.5" x2="9.5" y2="3.5" stroke="currentColor" stroke-width="1"/><line x1="1" y1="12.5" x2="13" y2="12.5" stroke="currentColor" stroke-width="1.2"/>'},
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

  /* Tool options, under the tools — where Flash put them. Only the eraser has
     any for now, and they only appear when it is the active tool. */
  var opts=document.createElement("div");
  opts.id="tool-options";
  opts.className="tool-options";
  var sizeLabel=document.createElement("div");
  sizeLabel.className="tool-opt-label";
  sizeLabel.id="eraserSizeLabel";
  opts.appendChild(sizeLabel);
  var slider=document.createElement("input");
  slider.type="range";slider.className="tool-opt-range";slider.id="eraserSizeRange";
  slider.min=ERASER_MIN;slider.max=120;slider.step=1;
  slider.title="Eraser size — [ and ] change it too";
  slider.addEventListener("input",function(){setEraserSize(parseInt(slider.value,10));});
  opts.appendChild(slider);
  var shapes=document.createElement("div");
  shapes.className="tool-opt-shapes";
  [["round","●","Round"],["square","■","Square"]].forEach(function(s){
    var b=document.createElement("button");
    b.type="button";b.className="tool-opt-btn";b.dataset.shape=s[0];
    b.textContent=s[1];b.title=s[2]+" eraser";
    b.addEventListener("click",function(){setEraserShape(s[0]);});
    shapes.appendChild(b);
  });
  opts.appendChild(shapes);
  tb.appendChild(opts);
  updateEraserUI();
}

/** Keep the tool-options strip in step with the eraser's state. */
function updateEraserUI(){
  var box=document.getElementById("tool-options");
  if(box)box.style.display=curTool==="eraser"?"":"none";
  var lab=document.getElementById("eraserSizeLabel");
  if(lab)lab.textContent=eraserSize+" px";
  var rng=document.getElementById("eraserSizeRange");
  // The slider tops out well below ERASER_MAX; the brackets go all the way, so
  // the thumb is allowed to sit at the end rather than snapping the value back.
  if(rng&&String(eraserSize)!==rng.value)rng.value=Math.min(eraserSize,parseInt(rng.max,10));
  var btns=document.querySelectorAll(".tool-opt-btn");
  for(var i=0;i<btns.length;i++){
    btns[i].className="tool-opt-btn"+(btns[i].dataset.shape===eraserShape?" active":"");
  }
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
  // Pose — a joint with a rotation arrow, so the mode is obvious.
  toolCursors.pose=buildCursor('<path d="M3,12 A9,9 0 0 1 12,3" fill="none" stroke="#000" stroke-width="1.6"/><path d="M12,3 L9,1 L9,5 Z" fill="#000"/><circle cx="4" cy="13" r="3" fill="#FFD24A" stroke="#000" stroke-width="1"/>',4,13);
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
  updateEraserUI();
  // Leaving the eraser must take its ghost with it.
  if(id!=="eraser"&&eraserHover){eraserHover=null;}
  render();
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
  // render layers bottom to top, rigs composed through their hierarchy
  rigDrawPlan(frameObjects(currentLayers(),curFrame)).forEach(function(e){
    paintPlanned(ctx,e,{chrome:true});
  });
  // Rig overlay sits above the artwork but inside the stage transform, so the
  // handles track the drawing at any zoom.
  if(curTool==="pose"||(selection.length===1&&isRigPart(selection[0])))drawRigOverlay(ctx);
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
  drawEraserGhost();
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

/* ---- Frame clipboard ---------------------------------------------- *
 * Copy, cut and paste a block of the timeline — any number of layers, any
 * span of frames.
 * -------------------------------------------------------------------- */

/**
 * Empty frames [f0,f1] on a layer, keeping everything outside them.
 *
 * The subtlety is a keyframe that only partly overlaps. Dropping any keyframe
 * that touches the span is much simpler and silently destroys content either
 * side of it — if a keyframe runs frames 1-8 and you clear 3-6, frames 1-2 and
 * 7-8 must survive. So:
 *
 *   - entirely inside  → removed
 *   - starts before    → truncated to end at f0-1
 *   - ends after       → its tail is kept, starting at f1+1
 *   - spans both ends  → truncated, and a tail copy added after the span
 */
function clearSpan(layer,f0,f1){
  if(!layer)return;
  var out=[];
  (layer.keyframes||[]).forEach(function(kf){
    var start=kf.index,end=kf.index+kf.duration-1;
    if(end<f0||start>f1){out.push(kf);return;}      // untouched
    var keptHead=start<f0,keptTail=end>f1;
    if(keptHead){
      var head=kf;
      head.duration=f0-start;
      out.push(head);
    }
    if(keptTail){
      // The tail keeps the same artwork: clearing frames in the middle of a
      // held keyframe leaves the same drawing showing afterwards, which is
      // what the timeline looked like before.
      var tail=kf.clone();
      tail.index=f1+1;
      tail.duration=end-f1;
      // A sound belongs to the frame it was placed on, so it does not come
      // along to a new index.
      tail.sound=null;
      out.push(tail);
    }
  });
  out.sort(function(a,b){return a.index-b.index;});
  layer.keyframes=out;
}

/**
 * The frame clipboard: a deep copy, not references.
 *
 * It has to be plain data because undo/redo replaces every object in the
 * document (deserializeDoc rebuilds from a snapshot), so a clipboard holding
 * live objects would be pasting things that are no longer part of anything.
 */
var frameClipboard=null;

/** Plain, detached form of a keyframe. */
function plainKeyframe(kf){
  return {
    index:kf.index,duration:kf.duration,
    tweenType:kf.tweenType,easing:kf.easing,script:kf.script,
    sound:kf.sound?cloneSound(kf.sound):null,
    objects:(kf.objects||[]).map(plainObj)
  };
}

/**
 * Copy the selected block. Keyframes are clipped to the selection and
 * re-indexed so the block starts at frame 1, which is what makes it pastable
 * anywhere.
 */
function copyFrames(opts){
  opts=opts||{};
  var r=opts.range||tlRange();
  if(!r)return "Select some frames in the timeline first.";
  var layers=currentLayers();
  var span=r.f1-r.f0+1;
  var out=[];

  for(var li=r.l0;li<=r.l1;li++){
    var layer=layers[li];
    if(!layer){out.push({name:"Layer",keyframes:[]});continue;}
    var kfs=keyframesInSpan(layer,r.f0,r.f1).map(function(kf){
      var from=Math.max(kf.index,r.f0),to=Math.min(kf.index+kf.duration-1,r.f1);
      var c=kf.clone();
      c.index=from-r.f0+1;
      c.duration=to-from+1;
      // A tween with no destination inside the block has nothing to tween to.
      return c;
    });
    kfs.forEach(function(c,i){
      if(c.tweenType&&c.tweenType!=="none"&&i===kfs.length-1)c.tweenType="none";
    });
    out.push({name:layer.name,keyframes:kfs.map(plainKeyframe)});
  }

  frameClipboard={frames:span,layers:out};
  return {frames:span,layers:out.length};
}

/** Copy, then empty the frames. */
function cutFrames(opts){
  var res=copyFrames(opts);
  if(typeof res==="string")return res;
  var r=(opts&&opts.range)||tlRange();
  var layers=currentLayers();
  for(var li=r.l0;li<=r.l1;li++)clearSpan(layers[li],r.f0,r.f1);
  for(var ei=r.l0;ei<=r.l1;ei++){
    var lay=layers[ei];
    if(lay&&!lay.keyframes.length)lay.keyframes=[new KeyFrame(1)];
  }
  return res;
}

/**
 * Paste the clipboard at the playhead, starting on the current layer and
 * running down through as many layers as were copied.
 *
 * Overwrites the destination frames, which is what Flash's Paste Frames did
 * and what you want when replacing a section of a cycle. Layers are created if
 * the clipboard is deeper than what is below the current one — otherwise
 * pasting a six-layer block onto the bottom layer would quietly lose five of
 * them.
 */
function pasteFrames(opts){
  opts=opts||{};
  if(!frameClipboard||!frameClipboard.layers.length)return "Nothing has been copied yet.";
  var layers=currentLayers();
  var at=Math.max(1,opts.frame||curFrame||1);
  var top=Math.max(0,opts.layerIndex!=null?opts.layerIndex:curLayer);
  var span=frameClipboard.frames;
  var end=at+span-1;
  var made=0;

  frameClipboard.layers.forEach(function(src,i){
    var idx=top+i;
    var layer=layers[idx];
    if(!layer){
      layer=new Layer(src.name||("Layer "+(idx+1)));
      layer.keyframes=[];
      layers.push(layer);
      made++;
    }
    clearSpan(layer,at,end);
    src.keyframes.forEach(function(kd){
      var kf=reviveKeyframe(kd);
      kf.index=kd.index+at-1;
      layer.keyframes.push(kf);
    });
    layer.keyframes.sort(function(a,b){return a.index-b.index;});
    if(!layer.keyframes.length)layer.keyframes=[new KeyFrame(1)];
  });

  if(doc.totalFrames<end)doc.totalFrames=end;
  // Leave the pasted block selected: the next thing you do is usually paste it
  // again further along, or nudge it.
  tlSelRange={layerIdx:top,endLayerIdx:top+frameClipboard.layers.length-1,
              startFrame:at,endFrame:end};
  return {frames:span,layers:frameClipboard.layers.length,
          startFrame:at,endFrame:end,layersCreated:made};
}

/** Is there anything on the frame clipboard? */
function hasFrameClipboard(){
  return !!(frameClipboard&&frameClipboard.layers&&frameClipboard.layers.length);
}

/* ---- Frames to symbol --------------------------------------------- *
 * Select a block of the timeline — any number of layers, any span of frames —
 * and turn it into one symbol.
 *
 * Flash's answer to this was Copy Frames, make a symbol, Paste Frames: three
 * steps, and it dropped the content's position so you had to line the instance
 * up by eye afterwards. Here the instance lands exactly where the artwork
 * already was, which is the difference between a useful command and one you
 * stop trusting.
 * -------------------------------------------------------------------- */

/** Every keyframe of `layer` that overlaps frames [f0,f1]. */
function keyframesInSpan(layer,f0,f1){
  return (layer.keyframes||[]).filter(function(kf){
    var end=kf.index+kf.duration-1;
    return !(end<f0||kf.index>f1);
  });
}

/**
 * The bounding box of every object in the selected block.
 *
 * The instance is placed at this box and the symbol's contents are shifted to
 * be relative to it, because symbol space has its origin at the instance's
 * top-left. That is what makes the conversion visually invisible.
 */
function spanBounds(layers,r){
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,found=false;
  for(var li=r.l0;li<=r.l1;li++){
    var layer=layers[li];
    if(!layer)continue;
    keyframesInSpan(layer,r.f0,r.f1).forEach(function(kf){
      (kf.objects||[]).forEach(function(o){
        var x0=Math.min(o.x||0,(o.x||0)+(o.width||0));
        var x1=Math.max(o.x||0,(o.x||0)+(o.width||0));
        var y0=Math.min(o.y||0,(o.y||0)+(o.height||0));
        var y1=Math.max(o.y||0,(o.y||0)+(o.height||0));
        if(x0<minX)minX=x0;
        if(y0<minY)minY=y0;
        if(x1>maxX)maxX=x1;
        if(y1>maxY)maxY=y1;
        found=true;
      });
    });
  }
  if(!found)return null;
  return {x:minX,y:minY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
}

/**
 * Build a symbol from the selected block.
 *
 * opts: {name, behavior, replace, range}
 * Returns {name, layers, frames, bounds, sounds} or an error string.
 */
function createSymbolFromFrames(opts){
  opts=opts||{};
  var r=opts.range||tlRange();
  if(!r)return "Select some frames in the timeline first.";
  var name=String(opts.name||"").trim();
  if(!name)return "Give the symbol a name.";
  if(doc.library[name])return "There is already a symbol called \u201c"+name+"\u201d.";

  var layers=currentLayers();
  var bounds=spanBounds(layers,r);
  if(!bounds)return "Those frames are empty \u2014 there is nothing to put in a symbol.";

  var span=r.f1-r.f0+1;
  var symLayers=[],soundsFound=[];

  for(var li=r.l0;li<=r.l1;li++){
    var layer=layers[li];
    if(!layer)continue;
    var kfs=keyframesInSpan(layer,r.f0,r.f1);
    if(!kfs.length)continue;
    var newLayer=new Layer(layer.name);
    newLayer.visible=layer.visible!==false;
    newLayer.locked=false;      // a locked layer inside a new symbol is a trap
    newLayer.keyframes=[];

    kfs.forEach(function(kf){
      // Clip to the selection: a keyframe may start before it or run past it.
      var from=Math.max(kf.index,r.f0);
      var to=Math.min(kf.index+kf.duration-1,r.f1);
      var nk=kf.clone();
      nk.index=from-r.f0+1;
      nk.duration=to-from+1;
      // A sound belongs to the main timeline: the engine builds its soundtrack
      // from the root layers only, so carrying one in here would silently mute
      // it. Note it and leave it behind instead.
      if(nk.sound){
        soundsFound.push({index:kf.index,sound:kf.sound,layerIdx:li});
        nk.sound=null;
      }
      // A tween whose destination keyframe fell outside the selection has
      // nothing left to tween to.
      if(nk.tweenType&&nk.tweenType!=="none"){
        var hasNext=kfs.some(function(q){return q.index>kf.index&&q.index<=r.f1;});
        if(!hasNext)nk.tweenType="none";
      }
      nk.objects.forEach(function(o){
        o.x=(o.x||0)-bounds.x;
        o.y=(o.y||0)-bounds.y;
      });
      newLayer.keyframes.push(nk);
    });

    if(!newLayer.keyframes.length)newLayer.keyframes=[new KeyFrame(1)];
    newLayer.keyframes.sort(function(a,b){return a.index-b.index;});
    symLayers.push(newLayer);
  }

  if(!symLayers.length)return "Those frames are empty \u2014 there is nothing to put in a symbol.";

  doc.library[name]={
    objects:[],
    layers:symLayers,
    totalFrames:span,
    behavior:opts.behavior||"movieclip"
  };

  if(opts.replace!==false){
    // Clear the block, then drop one instance where the artwork was.
    for(var ri=r.l0;ri<=r.l1;ri++){
      // clearSpan trims and splits rather than dropping anything it touches,
      // so content either side of the selection survives.
      clearSpan(layers[ri],r.f0,r.f1);
    }
    var host=layers[r.l0];
    var inst=new EditorObject("symbol");
    inst.type="symbol";
    inst.symbolName=name;
    inst.symbolBehavior=opts.behavior||"movieclip";
    inst.firstFrame=1;
    inst.loopMode="loop";
    inst.x=bounds.x;inst.y=bounds.y;
    inst.width=bounds.width;inst.height=bounds.height;
    var kfNew=new KeyFrame(r.f0);
    kfNew.duration=span;
    kfNew.objects=[inst];
    host.keyframes.push(kfNew);
    host.keyframes.sort(function(a,b){return a.index-b.index;});

    // A Layer with no keyframes at all makes getKeyframeAt() return null
    // forever, so the layer would be permanently unusable. Done after the
    // instance is placed — doing it during the clear left the host layer with
    // a blank keyframe sitting on top of the instance at the same index.
    for(var ei=r.l0;ei<=r.l1;ei++){
      var lay3=layers[ei];
      if(lay3&&!lay3.keyframes.length)lay3.keyframes=[new KeyFrame(1)];
    }

    // Put the sounds back on the layers they came from, at their own frames.
    soundsFound.forEach(function(sv){
      var lay2=layers[sv.layerIdx];
      if(!lay2)return;
      var at=lay2.getKeyframeAt(sv.index);
      if(!at){
        at=new KeyFrame(sv.index);
        at.duration=1;
        lay2.keyframes.push(at);
        lay2.keyframes.sort(function(a,b){return a.index-b.index;});
      }
      if(!at.sound)at.sound=sv.sound;
    });
  }

  return {
    name:name,
    layers:symLayers.length,
    frames:span,
    bounds:bounds,
    sounds:soundsFound.length,
    replaced:opts.replace!==false
  };
}

function showFramesToSymbolDialog(){
  var r=tlRange();
  if(!r){
    showMessage("Convert Frames to Symbol",
      "Select some frames in the timeline first \u2014 drag across the frames and "+
      "layers you want, or shift-click to extend the block.");
    return;
  }
  var layers=currentLayers();
  if(!spanBounds(layers,r)){
    showMessage("Convert Frames to Symbol",
      "Those frames are empty, so there is nothing to put in a symbol.");
    return;
  }
  var span=r.f1-r.f0+1,lays=r.l1-r.l0+1;

  showDialog({
    title:"Convert Frames to Symbol",
    message:"Turns the selected "+span+" frame"+(span===1?"":"s")+" on "+lays+
            " layer"+(lays===1?"":"s")+" into one symbol. The instance is placed "+
            "exactly where the artwork is now, so nothing moves.",
    fields:[
      {name:"name",label:"Name",value:uniqueSymbolName("Symbol")},
      {name:"behavior",label:"Behaviour",type:"select",value:span>1?"movieclip":"graphic",
       options:[
         ["movieclip","Movie Clip \u2014 runs its own timeline"],
         ["graphic","Graphic \u2014 driven by the parent timeline"],
         ["button","Button \u2014 frames 1-4 are Up/Over/Down/Hit"]
       ]},
      {name:"replace",label:"The frames",type:"select",value:"1",options:[
        ["1","Replace them with an instance"],
        ["0","Leave them alone, just add the symbol"]
      ]}
    ],
    okLabel:"Convert",
    validate:function(v){
      var n=String(v.name||"").trim();
      if(!n)return "Give the symbol a name.";
      if(doc.library[n])return "There is already a symbol called \u201c"+n+"\u201d.";
      return null;
    },
    onOk:function(v){
      pushUndo();
      var res=createSymbolFromFrames({
        name:v.name,
        behavior:v.behavior,
        replace:v.replace==="1",
        range:r
      });
      if(typeof res==="string"){
        showMessage("Convert Frames to Symbol",res);
        return;
      }
      if(res.replaced)tlSelRange=null;
      fullRefresh();
      var note="\u201c"+res.name+"\u201d created from "+res.frames+" frame"+
               (res.frames===1?"":"s")+" on "+res.layers+" layer"+
               (res.layers===1?"":"s")+".";
      if(res.replaced)note+=" The frames are now one instance \u2014 double-click it to edit inside.";
      else note+=" The frames are untouched.";
      if(res.sounds){
        note+="\n\n"+res.sounds+" sound"+(res.sounds===1?" was":"s were")+
              " left on the main timeline: the engine builds its soundtrack from "+
              "the root layers, so a sound inside a symbol would not play.";
      }
      showMessage("Convert Frames to Symbol",note,{okLabel:"Done"});
    }
  });
}

/** A library name that is not taken yet. */
function uniqueSymbolName(base){
  base=String(base||"Symbol").trim()||"Symbol";
  if(!doc.library[base])return base;
  var n=2;
  while(doc.library[base+" "+n])n++;
  return base+" "+n;
}

/* ---- Biped template ----------------------------------------------- *
 * A whole rig in one step.
 *
 * Building the first character by hand is eleven Add Part dialogs, and the
 * part that actually needs judgement — where the joints go, what is parented
 * to what, which arm draws in front — is the part a beginner gets wrong. The
 * template encodes the answers: hips at the root, spine up through chest to
 * head, limbs hanging off the right places, joints at the top of each limb,
 * and the far arm and leg behind the body.
 *
 * Each part is still an ordinary symbol instance, so every piece of it can be
 * re-drawn, re-parented, re-pivoted or deleted afterwards. It is a starting
 * point, not a fixed skeleton.
 * -------------------------------------------------------------------- */

/**
 * The skeleton, in fractions of the figure's height and width.
 *
 * Proportions are roughly a stylised 7-heads-tall figure. `px/py` are the
 * joint's position within the part, as fractions of that part's own box —
 * 0.5,0 means top-centre, which is where a limb's joint belongs.
 *
 * `z` is draw order: the far arm and leg sit behind the torso, which is the
 * whole reason draw order is separate from the hierarchy.
 */
var BIPED_PARTS=[
  // id            label            parent      x     y     w     h     px   py   z
  ["hips",        "Hips",          "",        0.30, 0.52, 0.40, 0.12, 0.5, 0.5,  6],
  ["torso",       "Torso",         "hips",    0.28, 0.28, 0.44, 0.26, 0.5, 1.0,  7],
  ["head",        "Head",          "torso",   0.34, 0.06, 0.32, 0.22, 0.5, 1.0,  8],
  ["arm-far",     "Right Arm",     "torso",   0.17, 0.30, 0.12, 0.20, 0.5, 0.0,  2],
  ["forearm-far", "Right Forearm", "arm-far", 0.17, 0.49, 0.11, 0.19, 0.5, 0.0,  1],
  ["hand-far",    "Right Hand",    "forearm-far", 0.17, 0.67, 0.10, 0.08, 0.5, 0.0, 0],
  ["leg-far",     "Right Leg",     "hips",    0.34, 0.63, 0.13, 0.20, 0.5, 0.0,  4],
  ["shin-far",    "Right Shin",    "leg-far", 0.34, 0.82, 0.12, 0.18, 0.5, 0.0,  3],
  ["arm-near",    "Left Arm",      "torso",   0.71, 0.30, 0.12, 0.20, 0.5, 0.0, 10],
  ["forearm-near","Left Forearm",  "arm-near",0.71, 0.49, 0.11, 0.19, 0.5, 0.0, 11],
  ["hand-near",   "Left Hand",     "forearm-near",0.71,0.67,0.10,0.08,0.5, 0.0, 12],
  ["leg-near",    "Left Leg",      "hips",    0.53, 0.63, 0.13, 0.20, 0.5, 0.0,  5],
  ["shin-near",   "Left Shin",     "leg-near",0.53, 0.82, 0.12, 0.18, 0.5, 0.0,  9]
];

/** Joint limits that keep IK anatomically honest on a fresh rig. */
var BIPED_LIMITS={
  "forearm-far":[-150,0],  "forearm-near":[-150,0],   // elbows bend one way
  "shin-far":[0,150],      "shin-near":[0,150],       // so do knees
  "head":[-40,40]
};

/**
 * Placeholder artwork for a part, so a new rig is visible and posable
 * immediately. A rounded block reads as a limb well enough to animate with,
 * and every one is a normal symbol you can open and redraw.
 */
function bipedPlaceholderSymbol(name,label,w,h,colour){
  if(doc.library[name])return name;
  var o=new EditorObject("rect");
  o.x=0;o.y=0;o.width=w;o.height=h;
  o.fillColor=colour;
  o.fillAlpha=1;
  o.fillType="solid";
  o.strokeColor="#2B2B33";
  o.strokeWidth=2;
  o.strokeStyle="solid";
  o.name=label;
  var layer=new Layer("Layer 1");
  layer.keyframes=[new KeyFrame(1)];
  layer.keyframes[0].objects=[o];
  doc.library[name]={objects:[],layers:[layer],totalFrames:1,behavior:"graphic"};
  return name;
}

/**
 * Build a biped.
 *
 * opts: {character, height, x, y, symbols}
 * `symbols` optionally maps a part id to an existing library symbol, so the
 * template can be built straight onto artwork you have already drawn.
 */
function createBiped(opts){
  opts=opts||{};
  var name=String(opts.character||"").trim();
  if(!name)return "Give the character a name.";
  var cs=characters();
  if(cs[name])return "There is already a character called \u201c"+name+"\u201d.";
  var kf=CKF();
  if(!kf)return "Select a keyframe to build the character on.";

  var H=Math.max(60,opts.height||Math.round(doc.height*0.8));
  var W=Math.round(H*0.42);
  var ox=opts.x!=null?opts.x:Math.round((doc.width-W)/2);
  var oy=opts.y!=null?opts.y:Math.round((doc.height-H)/2);
  var supplied=opts.symbols||{};

  // Skin tones: torso and head darker, limbs lighter, so the hierarchy reads
  // at a glance before any artwork exists.
  var COLOURS={hips:"#6E7A8A",torso:"#7D8A9C",head:"#95A3B5"};
  var FAR="#5E6878",NEAR="#8795A8";

  cs[name]={name:name,parts:[],poses:{}};
  var made=[];

  BIPED_PARTS.forEach(function(spec){
    var id=spec[0],label=spec[1],parent=spec[2];
    var w=Math.max(4,Math.round(spec[5]*W)),h=Math.max(4,Math.round(spec[6]*H));
    var x=ox+Math.round(spec[3]*W),y=oy+Math.round(spec[4]*H);
    var colour=COLOURS[id]||(id.indexOf("-far")>=0?FAR:NEAR);
    var symName=supplied[id]||bipedPlaceholderSymbol(
      name+" "+label,label,w,h,colour);

    var o=new EditorObject("symbol");
    o.type="symbol";
    o.symbolName=symName;
    o.symbolBehavior="graphic";
    o.loopMode="single";
    o.firstFrame=1;
    o.x=x;o.y=y;o.width=w;o.height=h;
    o.name=label;
    o.instanceName=id;
    o.rigChar=name;
    o.rigPart=id;
    o.rigParent=parent;
    o.pivotX=Math.round(spec[7]*w);
    o.pivotY=Math.round(spec[8]*h);
    o.rigZ=spec[9];
    var lim=BIPED_LIMITS[id];
    if(lim){o.rigMin=lim[0];o.rigMax=lim[1];}
    kf.objects.push(o);
    made.push(o);
  });

  syncCharacterFromStage(name);
  // A rest pose straight away, so there is something to animate back to and
  // "Animate Poses" is usable without posing anything first.
  saveCharacterPose(name,"Rest");
  return {character:name,parts:made.length,width:W,height:H,x:ox,y:oy};
}

function showBipedDialog(){
  showDialog({
    title:"New Biped",
    message:"Builds a complete rig \u2014 hips, spine, head, two arms and two legs \u2014 "+
            "with the joints and draw order already right. Every part is an ordinary "+
            "symbol you can redraw, re-parent or delete.",
    fields:[
      {name:"name",label:"Name",value:"Hero"},
      {name:"height",label:"Height",type:"number",value:Math.round(doc.height*0.8),
       min:60,max:4000,
       hint:"In stage pixels, head to foot. Each part starts as a placeholder "+
            "block — double-click one to draw the real artwork in its place."}
    ],
    okLabel:"Build",
    validate:function(v){
      var n=String(v.name||"").trim();
      if(!n)return "Give the character a name.";
      if(characters()[n])return "There is already a character called \u201c"+n+"\u201d.";
      var h=parseInt(v.height,10);
      if(!(h>=60))return "Height must be at least 60 pixels.";
      return null;
    },
    onOk:function(v){
      pushUndo();
      var res=createBiped({
        character:String(v.name).trim(),
        height:parseInt(v.height,10)
      });
      if(typeof res==="string"){
        showMessage("New Biped",res);
        return;
      }
      if(window._flashyCharacterPanel)window._flashyCharacterPanel.select(res.character);
      setTool("pose");
      fullRefresh();
      showMessage("New Biped",
        "\u201c"+res.character+"\u201d built with "+res.parts+" parts and a \u201cRest\u201d pose.\n\n"+
        "The Pose tool is selected: drag a hand or a foot and the limb bends to "+
        "follow. Elbows and knees already have limits so they cannot bend "+
        "backwards. Double-click any part to redraw it.",
        {okLabel:"Start posing"});
    }
  });
}

/* ---- Character commands ------------------------------------------- *
 * The dialogs behind the Character panel and the Character menu. Each one is
 * thin: validate, push undo, call the model, refresh.
 * -------------------------------------------------------------------- */

function showNewCharacterDialog(){
  askFor("New Character","Name","Character",function(v){
    var name=String(v||"").trim();
    if(!name)return;
    pushUndo();
    if(!createCharacter(name)){
      showMessage("New Character","There is already a character called \u201c"+name+"\u201d.");
      return;
    }
    if(window._flashyCharacterPanel)window._flashyCharacterPanel.select(name);
    fullRefresh();
    if(!Object.keys(doc.library).length){
      showMessage("New Character",
        "Created \u201c"+name+"\u201d.\n\nIt has no parts yet, and there are no symbols to "+
        "build it from. Draw each body part, select it and press F8 to make it a "+
        "symbol \u2014 then use Character \u25b8 Add Part.");
    }else{
      showAddCharacterPartDialog(name);
    }
  },{okLabel:"Create",hint:"A character is a hierarchy of symbols you can pose."});
}

function currentCharacterName(){
  if(window._flashyCharacterPanel&&doc.characters){
    // Whatever the panel is showing, if it is still a real character.
    var shown=null;
    Object.keys(doc.characters).forEach(function(n){
      if(charPartsOnStage(n).length&&!shown)shown=n;
    });
    if(shown)return shown;
  }
  var all=Object.keys(doc.characters||{});
  return all.length?all[0]:null;
}

function showDeleteCharacterDialog(){
  var all=Object.keys(characters());
  if(!all.length){showMessage("Characters","There are no characters to delete.");return;}
  showDialog({
    title:"Delete Character",
    message:"Removes the character, its poses, and its parts from every frame. "+
            "The symbols it was built from stay in the Library.",
    fields:[{name:"name",label:"Character",type:"select",value:all[0],
             options:all.map(function(n){return [n,n];})}],
    okLabel:"Delete",
    onOk:function(v){
      pushUndo();
      deleteCharacter(v.name);
      fullRefresh();
    }
  });
}

function showAddCharacterPartDialog(name){
  name=name||currentCharacterName();
  var c=name&&characters()[name];
  if(!c){showMessage("Add Part","Create a character first \u2014 Character \u25b8 New Character.");return;}
  var syms=Object.keys(doc.library);
  if(!syms.length){
    showMessage("Add Part",
      "There are no symbols to use as a body part. Draw the part, select it and "+
      "press F8 to convert it to a symbol, then add it here.");
    return;
  }
  var parts=charPartsOnStage(name);
  var parentOpts=[["","(root \u2014 no parent)"]].concat(parts.map(function(o){
    return [o.rigPart,o.name||o.rigPart];
  }));
  // Parent defaults to the selected part, which is what makes building a limb
  // chain quick: add upper arm, keep it selected, add forearm.
  var sel=selection.length===1&&isRigPart(selection[0])&&selection[0].rigChar===name
    ?selection[0].rigPart:"";

  showDialog({
    title:"Add Part \u2014 "+name,
    message:"Each part is an instance of a library symbol. Its joint starts at the "+
            "top-centre, where a shoulder, hip or neck usually sits.",
    fields:[
      {name:"symbol",label:"Symbol",type:"select",value:syms[0],
       options:syms.map(function(n){return [n,n];})},
      {name:"partName",label:"Part name",value:"",
       placeholder:"Left Forearm",
       hint:"Naming parts \u201cLeft \u2026\u201d and \u201cRight \u2026\u201d lets poses be mirrored."},
      {name:"parent",label:"Attached to",type:"select",value:sel,options:parentOpts,
       hint:"Rotating the parent swings this part with it."}
    ],
    okLabel:"Add",
    validate:function(v){
      if(!v.symbol)return "Pick a symbol.";
      return null;
    },
    onOk:function(v){
      pushUndo();
      var sym=doc.library[v.symbol];
      var size=symbolBounds(sym);
      var o=addCharacterPart({
        character:name,
        symbolName:v.symbol,
        partName:String(v.partName||"").trim()||v.symbol,
        parent:v.parent||"",
        width:size.width,height:size.height
      });
      if(o){
        selection=[o];
        setTool("pose");
      }
      fullRefresh();
    }
  });
}

/**
 * A symbol's drawn size, so a new part arrives at the size of its artwork
 * rather than an arbitrary square the user has to fix every time.
 */
function symbolBounds(sym){
  var def={width:80,height:80};
  if(!sym)return def;
  var objs=[];
  if(sym.layers&&sym.layers.length){
    sym.layers.forEach(function(l){
      var kf=(l.keyframes||[])[0];
      if(kf)objs=objs.concat(kf.objects||[]);
    });
  }else objs=sym.objects||[];
  if(!objs.length)return def;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  objs.forEach(function(o){
    var x0=Math.min(o.x||0,(o.x||0)+(o.width||0)),x1=Math.max(o.x||0,(o.x||0)+(o.width||0));
    var y0=Math.min(o.y||0,(o.y||0)+(o.height||0)),y1=Math.max(o.y||0,(o.y||0)+(o.height||0));
    if(x0<minX)minX=x0;if(y0<minY)minY=y0;
    if(x1>maxX)maxX=x1;if(y1>maxY)maxY=y1;
  });
  if(!isFinite(minX))return def;
  return {width:Math.max(4,Math.round(maxX-minX)),height:Math.max(4,Math.round(maxY-minY))};
}

function showEditCharacterPartDialog(){
  var o=selection.length===1&&isRigPart(selection[0])?selection[0]:null;
  if(!o){showMessage("Edit Part","Select a character part first.");return;}
  var name=o.rigChar;
  var others=charPartsOnStage(name).filter(function(q){return q!==o;});
  var parentOpts=[["","(root \u2014 no parent)"]].concat(others.map(function(q){
    return [q.rigPart,q.name||q.rigPart];
  }));

  showDialog({
    title:"Part \u2014 "+(o.name||o.rigPart),
    message:"The joint is in the part's own coordinates. You can also drag it on "+
            "stage with Ctrl held and the Pose tool.",
    fields:[
      {name:"partName",label:"Name",value:o.name||o.rigPart},
      {name:"parent",label:"Attached to",type:"select",value:o.rigParent||"",options:parentOpts},
      {name:"pivotX",label:"Joint X",type:"number",
       value:o.pivotX!=null?o.pivotX:(o.width||0)/2},
      {name:"pivotY",label:"Joint Y",type:"number",
       value:o.pivotY!=null?o.pivotY:(o.height||0)/2},
      {name:"rotation",label:"Rotation",type:"number",value:o.rotation||0},
      {name:"minRot",label:"Limit from",value:o.rigMin!=null?String(o.rigMin):"",
       placeholder:"\u2014",
       hint:"Leave blank for no limit. Limits are what stop IK bending an elbow backwards."},
      {name:"maxRot",label:"Limit to",value:o.rigMax!=null?String(o.rigMax):"",
       placeholder:"\u2014"},
      {name:"locked",label:"Planted",type:"select",value:o.rigLocked?"1":"0",options:[
        ["0","No \u2014 IK may move this part"],
        ["1","Yes \u2014 hold it still"]
      ],hint:"A planted part stops the chain, so dragging a hand cannot shift it."}
    ],
    okLabel:"Apply",
    validate:function(v){
      var lo=String(v.minRot||"").trim(),hi=String(v.maxRot||"").trim();
      if(lo!==""&&isNaN(parseFloat(lo)))return "Limit from must be a number, or blank.";
      if(hi!==""&&isNaN(parseFloat(hi)))return "Limit to must be a number, or blank.";
      if(lo!==""&&hi!==""&&parseFloat(lo)>parseFloat(hi))
        return "Limit from must not be greater than Limit to.";
      return null;
    },
    extraButtons:[{
      label:"Remove part",
      onClick:function(){
        pushUndo();
        removeCharacterPart(name,o.rigPart);
        selection=[];
        fullRefresh();
      }
    }],
    onOk:function(v){
      pushUndo();
      var problem=reparentCharacterPart(name,o.rigPart,v.parent||"");
      if(problem){
        showMessage("Part",problem);
        return;
      }
      o.name=String(v.partName||"").trim()||o.rigPart;
      o.pivotX=parseFloat(v.pivotX)||0;
      o.pivotY=parseFloat(v.pivotY)||0;
      // Blank means "no limit", which is not the same as zero — hence the
      // string check rather than parseFloat's 0-for-junk.
      var lo=String(v.minRot==null?"":v.minRot).trim();
      var hi=String(v.maxRot==null?"":v.maxRot).trim();
      o.rigMin=lo===""||isNaN(parseFloat(lo))?null:parseFloat(lo);
      o.rigMax=hi===""||isNaN(parseFloat(hi))?null:parseFloat(hi);
      o.rigLocked=v.locked==="1";
      o.rotation=clampPartRotation(o,parseFloat(v.rotation)||0);
      syncCharacterFromStage(name);
      fullRefresh();
    }
  });
}

function showSavePoseDialog(){
  var name=currentCharacterName();
  if(!name||!charPartsOnStage(name).length){
    showMessage("Save Pose","Put a character in this frame first.");
    return;
  }
  askFor("Save Pose","Name","Pose",function(v){
    var pn=String(v||"").trim();
    if(!pn)return;
    pushUndo();
    if(!saveCharacterPose(name,pn)){
      showMessage("Save Pose","Could not read the character's parts.");
      return;
    }
    fullRefresh();
  },{okLabel:"Save",
     hint:"Poses store rotation, position and scale per part \u2014 never artwork."});
}

/**
 * Pose-to-pose animation.
 *
 * Fixed at six steps because the dialog cannot grow rows, and six is more than
 * a walk cycle needs — a cycle is usually four key poses. Leaving a step on
 * "(none)" ends the sequence.
 */
var RIG_ANIM_STEPS=6;

function showAnimateCharacterDialog(){
  var name=currentCharacterName();
  var c=name&&characters()[name];
  if(!c){showMessage("Animate Poses","Create a character first.");return;}
  var poses=Object.keys(c.poses||{}).sort();
  if(poses.length<1){
    showMessage("Animate Poses",
      "Save at least one pose first. Pose the character, then Character \u25b8 Save Pose.");
    return;
  }

  var poseOpts=[["","(none)"]].concat(poses.map(function(n){return [n,n];}));
  var fields=[];
  for(var i=0;i<RIG_ANIM_STEPS;i++){
    fields.push({name:"p"+i,label:(i===0?"Pose 1":"Pose "+(i+1)),type:"select",
                 value:i<poses.length?poses[i]:"",options:poseOpts});
    fields.push({name:"f"+i,label:"\u2193 hold",type:"number",value:4,min:1,max:240});
  }
  fields.push({name:"loop",label:"Loop",type:"select",value:"1",options:[
    ["1","Return to the first pose at the end"],
    ["0","Stop on the last pose"]
  ],hint:"A cycle has to come back round, or it jumps on repeat."});
  fields.push({name:"tween",label:"Between poses",type:"select",value:"motion",options:[
    ["motion","Tween (smooth)"],
    ["none","Hold (stepped)"]
  ]});
  fields.push({name:"start",label:"Start frame",type:"number",value:curFrame||1,min:1,max:9999});

  showDialog({
    title:"Animate Poses \u2014 "+name,
    message:"Writes the poses onto this layer as keyframes and tweens between them. "+
            "Frames in the range are replaced.",
    fields:fields,
    okLabel:"Animate",
    validate:function(v){
      for(var i=0;i<RIG_ANIM_STEPS;i++)if(v["p"+i])return null;
      return "Pick at least one pose.";
    },
    onOk:function(v){
      var steps=[];
      for(var i=0;i<RIG_ANIM_STEPS;i++){
        if(!v["p"+i])continue;
        steps.push({pose:v["p"+i],frames:Math.max(1,parseInt(v["f"+i],10)||4)});
      }
      pushUndo();
      var res=animateCharacterPoses({
        character:name,
        steps:steps,
        startFrame:Math.max(1,parseInt(v.start,10)||1),
        loop:v.loop==="1",
        tween:v.tween!=="none"
      });
      if(!res){
        showMessage("Animate Poses","Could not write the sequence.");
        return;
      }
      curLayer=res.layerIndex>=0?res.layerIndex:curLayer;
      fullRefresh();
      showMessage("Animate Poses",
        res.steps.length+" keyframes written across frames "+res.startFrame+
        "\u2013"+res.endFrame+". Press Enter to play it.\n\n"+
        "To adjust, drag a limb on any of those keyframes \u2014 they are ordinary "+
        "keyframes, so the tween follows.",
        {okLabel:"Done"});
    }
  });
}

/* ------------------------------------------------------------------ *
 * Characters — the stored side of a rig
 *
 * The objects in a keyframe ARE the rig: they hold the hierarchy, the pivots
 * and the current pose. That is deliberate — one source of truth means posing,
 * keyframing and tweening all work through machinery that already exists, and
 * a pose cannot drift out of step with what is on screen.
 *
 * `doc.characters[name]` holds the two things the stage cannot:
 *   parts  — a template, so the character can be placed on another frame or
 *            in another scene, and so the panel has something to show when the
 *            character is not in the current keyframe.
 *   poses  — named sets of per-part transforms. This is what makes re-use
 *            possible, and what pose-to-pose animation is built from.
 * -------------------------------------------------------------------- */

/**
 * Fields a pose captures. A pose is a transform, never artwork.
 *
 * Note there is deliberately no matching list of "structure" fields: a part's
 * structure is whatever else is on the object, and `plainObj` copies it
 * generically. That is why `rigMin`/`rigMax`/`rigLocked` needed no
 * serialization work — and why a spec pins their survival through a save, so
 * that a future explicit field list cannot drop them silently.
 */
var RIG_POSE_FIELDS=["x","y","rotation","scaleX","scaleY"];

function characters(){
  if(!doc.characters)doc.characters={};
  return doc.characters;
}

/** Every rig part of `name` in the current keyframe, in document order. */
function charPartsOnStage(name){
  var kf=CKF();
  if(!kf)return [];
  return kf.objects.filter(function(o){return isRigPart(o)&&o.rigChar===name;});
}

function charPartById(name,partId){
  var all=charPartsOnStage(name);
  for(var i=0;i<all.length;i++)if(all[i].rigPart===partId)return all[i];
  return null;
}

/** A short, stable, unique part id. */
function uniquePartId(name,base){
  var used={};
  charPartsOnStage(name).forEach(function(o){used[o.rigPart]=1;});
  var c=characters()[name];
  if(c)(c.parts||[]).forEach(function(pt){used[pt.rigPart]=1;});
  base=String(base||"part").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"part";
  if(!used[base])return base;
  var n=2;
  while(used[base+"-"+n])n++;
  return base+"-"+n;
}

/**
 * Refresh a character's stored template from what is on stage.
 *
 * Called after every structural edit, so the template cannot fall behind the
 * rig the user is actually looking at — the failure mode would be placing the
 * character again and getting last week's hierarchy.
 */
function syncCharacterFromStage(name){
  var c=characters()[name];
  if(!c)return null;
  var parts=charPartsOnStage(name);
  if(!parts.length)return c;
  c.parts=parts.map(function(o){
    var t=plainObj(o);
    delete t.id;
    delete t._startFrame;
    delete t._parentFrame;
    return t;
  });
  return c;
}

/** Create an empty character. */
function createCharacter(name){
  if(!name)return null;
  var cs=characters();
  if(cs[name])return null;
  cs[name]={name:name,parts:[],poses:{}};
  return cs[name];
}

function deleteCharacter(name){
  var cs=characters();
  if(!cs[name])return false;
  // Remove its parts from every keyframe, or the document keeps objects that
  // claim to belong to a rig that no longer exists.
  eachKeyframe(function(kf){
    kf.objects=kf.objects.filter(function(o){return !(isRigPart(o)&&o.rigChar===name);});
  });
  delete cs[name];
  return true;
}

/** Walk every keyframe in the document, including inside library symbols. */
function eachKeyframe(fn){
  doc.layers.forEach(function(l){(l.keyframes||[]).forEach(fn);});
  Object.keys(doc.library).forEach(function(n){
    var sym=doc.library[n];
    (sym.layers||[]).forEach(function(l){(l.keyframes||[]).forEach(fn);});
  });
}

/**
 * Add a part to a character, as an instance of a library symbol.
 *
 * The part lands at its symbol's natural size in the middle of the stage
 * unless told otherwise, with its pivot at the top-centre — where a limb's
 * joint usually is, which is a better default than the centre for a rig.
 */
function addCharacterPart(opts){
  opts=opts||{};
  var name=opts.character;
  var c=characters()[name];
  if(!c)return null;
  var kf=CKF();
  if(!kf)return null;

  var o=new EditorObject("symbol");
  o.type="symbol";
  o.symbolName=opts.symbolName||"";
  o.symbolBehavior="graphic";
  o.loopMode="single";
  o.firstFrame=1;
  o.width=opts.width||80;
  o.height=opts.height||80;
  o.x=opts.x!=null?opts.x:Math.round((doc.width-o.width)/2);
  o.y=opts.y!=null?opts.y:Math.round((doc.height-o.height)/2);
  o.rigChar=name;
  o.rigPart=uniquePartId(name,opts.partName||opts.symbolName||"part");
  o.rigParent=opts.parent||"";
  o.name=opts.partName||opts.symbolName||o.rigPart;
  // Top-centre: a shoulder, hip or neck sits at the top of the limb it drives.
  o.pivotX=opts.pivotX!=null?opts.pivotX:o.width/2;
  o.pivotY=opts.pivotY!=null?opts.pivotY:0;
  o.rigZ=opts.rigZ!=null?opts.rigZ:charPartsOnStage(name).length;

  kf.objects.push(o);
  syncCharacterFromStage(name);
  return o;
}

/** Remove a part, re-parenting its children to its own parent. */
function removeCharacterPart(name,partId){
  var kf=CKF();
  if(!kf)return false;
  var part=charPartById(name,partId);
  if(!part)return false;
  charPartsOnStage(name).forEach(function(o){
    if(o.rigParent===partId)o.rigParent=part.rigParent||"";
  });
  kf.objects=kf.objects.filter(function(o){return o!==part;});
  syncCharacterFromStage(name);
  return true;
}

/**
 * Re-parent a part. Refuses to create a cycle, which would otherwise make the
 * rig undrawable — the draw walk is guarded, but a rig that silently stops
 * composing is worse than a refused edit.
 */
function reparentCharacterPart(name,partId,newParent){
  var part=charPartById(name,partId);
  if(!part)return "No such part.";
  newParent=newParent||"";
  if(newParent===partId)return "A part cannot be its own parent.";
  if(newParent){
    var byId=rigIndex(charPartsOnStage(name));
    var cur=byId[name+"/"+newParent],guard=0;
    while(cur&&guard++<RIG_MAX_DEPTH){
      if(cur.rigPart===partId)return "That would make a loop in the hierarchy.";
      cur=cur.rigParent?byId[name+"/"+cur.rigParent]:null;
    }
  }
  part.rigParent=newParent;
  syncCharacterFromStage(name);
  return null;
}

/** Move a part in the draw order. `dir` is -1 (back) or +1 (front). */
function nudgeCharacterPartZ(name,partId,dir){
  var parts=charPartsOnStage(name).slice().sort(function(a,b){
    return (a.rigZ||0)-(b.rigZ||0);
  });
  var i=-1;
  parts.forEach(function(o,qi){if(o.rigPart===partId)i=qi;});
  if(i<0)return false;
  var j=i+(dir<0?-1:1);
  if(j<0||j>=parts.length)return false;
  var a=parts[i],b=parts[j];
  var az=a.rigZ!=null?a.rigZ:i,bz=b.rigZ!=null?b.rigZ:j;
  a.rigZ=bz;b.rigZ=az;
  // Renumber so the order is dense and stable for the next nudge.
  parts.slice().sort(function(x,y){return (x.rigZ||0)-(y.rigZ||0);})
    .forEach(function(o,qi){o.rigZ=qi;});
  syncCharacterFromStage(name);
  return true;
}

/** Place a character's stored template into the current keyframe. */
function instanceCharacter(name,opts){
  opts=opts||{};
  var c=characters()[name];
  var kf=CKF();
  if(!c||!kf||!(c.parts||[]).length)return null;
  // Replacing rather than stacking: two copies of one rig in a keyframe share
  // part ids, so the hierarchy would resolve to whichever came first.
  kf.objects=kf.objects.filter(function(o){return !(isRigPart(o)&&o.rigChar===name);});
  var dx=opts.dx||0,dy=opts.dy||0;
  var made=[];
  c.parts.forEach(function(t){
    var o=reviveObject(t);
    o.id=uid();
    o.x=(t.x||0)+dx;
    o.y=(t.y||0)+dy;
    o.rigChar=name;
    kf.objects.push(o);
    made.push(o);
  });
  return made;
}

/* ---- Poses ------------------------------------------------------- *
 * A pose is per-part transform only. It never carries artwork, so applying a
 * pose to a character you have since redrawn still works, and a pose saved
 * from one character can be applied to another with the same part ids.
 * ------------------------------------------------------------------- */

function saveCharacterPose(name,poseName){
  var c=characters()[name];
  if(!c||!poseName)return null;
  var parts=charPartsOnStage(name);
  if(!parts.length)return null;
  var pose={};
  parts.forEach(function(o){
    var t={};
    RIG_POSE_FIELDS.forEach(function(k){
      t[k]=o[k]!=null?o[k]:(k==="scaleX"||k==="scaleY"?1:0);
    });
    pose[o.rigPart]=t;
  });
  c.poses=c.poses||{};
  c.poses[poseName]=pose;
  return pose;
}

function applyCharacterPose(name,poseName,opts){
  opts=opts||{};
  var c=characters()[name];
  if(!c||!c.poses||!c.poses[poseName])return 0;
  var pose=c.poses[poseName];
  var n=0;
  charPartsOnStage(name).forEach(function(o){
    var t=pose[o.rigPart];
    if(!t)return;
    RIG_POSE_FIELDS.forEach(function(k){
      // Position is part of a pose, but holding it lets you re-use a pose on a
      // character that has walked somewhere else.
      if(opts.rotationOnly&&k!=="rotation"&&k!=="scaleX"&&k!=="scaleY")return;
      if(t[k]!=null)o[k]=t[k];
    });
    n++;
  });
  return n;
}

function deleteCharacterPose(name,poseName){
  var c=characters()[name];
  if(!c||!c.poses||!c.poses[poseName])return false;
  delete c.poses[poseName];
  return true;
}

/**
 * The matching left/right part for mirroring.
 *
 * Inferred from the part's name, because a rig built by a person names things
 * "Left Arm" and "Right Arm" and asking them to declare pairs as well would be
 * busywork. Returns null when there is no partner, which simply means that
 * part mirrors onto itself.
 */
function mirrorPartnerId(name,partId){
  var parts=charPartsOnStage(name);
  if(!parts.length)parts=(characters()[name]||{}).parts||[];
  var me=null;
  parts.forEach(function(o){if(o.rigPart===partId)me=o;});
  if(!me)return null;
  var label=String(me.name||me.rigPart);
  var flipped=label
    .replace(/\bLeft\b/g,"\u0000").replace(/\bRight\b/g,"Left").replace(/\u0000/g,"Right")
    .replace(/\bleft\b/g,"\u0000").replace(/\bright\b/g,"left").replace(/\u0000/g,"right")
    .replace(/^L[\s_-]/,"R ").replace(/^R[\s_-]/,"L ");
  if(flipped===label)return null;
  var hit=null;
  parts.forEach(function(o){
    if(o.rigPart===partId)return;
    if(String(o.name||o.rigPart).toLowerCase()===flipped.toLowerCase())hit=o;
  });
  return hit?hit.rigPart:null;
}

/**
 * Mirror a pose left-to-right.
 *
 * Indispensable for a walk: the second half of the cycle is the first half
 * mirrored, and doing it by hand is both tedious and where mistakes creep in.
 */
function mirrorCharacterPose(name,poseName,intoName){
  var c=characters()[name];
  if(!c||!c.poses||!c.poses[poseName])return null;
  var src=c.poses[poseName];
  var out={};
  Object.keys(src).forEach(function(pid){
    var partner=mirrorPartnerId(name,pid);
    var target=partner||pid;
    var t=src[pid];
    out[target]={
      x:t.x,y:t.y,
      // A mirrored limb swings the other way, and mirroring flips handedness.
      rotation:-(t.rotation||0),
      scaleX:t.scaleX!=null?t.scaleX:1,
      scaleY:t.scaleY!=null?t.scaleY:1
    };
  });
  c.poses[intoName||(poseName+" (mirrored)")]=out;
  return out;
}

/**
 * Write a sequence of poses onto the timeline as keyframes with tweens
 * between them — pose-to-pose animation, which is how a cycle is actually
 * built.
 *
 * opts: {character, steps:[{pose, frames}], startFrame, loop, tween}
 */
function animateCharacterPoses(opts){
  opts=opts||{};
  var name=opts.character;
  var c=characters()[name];
  var steps=(opts.steps||[]).filter(function(st){
    return st&&st.pose&&c&&c.poses&&c.poses[st.pose];
  });
  if(!c||!steps.length)return null;

  var layer=CL();
  if(!layer)return null;
  var start=Math.max(1,opts.startFrame||curFrame||1);
  var tween=opts.tween===false?"none":"motion";

  // A looping cycle returns to its first pose, so the last step tweens home
  // instead of snapping.
  var seq=steps.slice();
  if(opts.loop)seq.push({pose:steps[0].pose,frames:1});

  var total=seq.reduce(function(a,st){return a+Math.max(1,st.frames||1);},0);
  var end=start+total-1;

  // Replace the span this cycle covers; leave the rest of the layer alone.
  var rescued=[];
  layer.keyframes.forEach(function(kf){
    var covered=!(kf.index+kf.duration-1<start||kf.index>end);
    if(covered&&kf.sound)rescued.push({index:kf.index,sound:kf.sound});
  });
  layer.keyframes=layer.keyframes.filter(function(kf){
    return kf.index+kf.duration-1<start||kf.index>end;
  });

  // Each step needs the character present so a pose has something to pose.
  var frame=start,written=[];
  seq.forEach(function(st,si){
    var kf=new KeyFrame(frame);
    kf.duration=Math.max(1,st.frames||1);
    kf.tweenType=(si<seq.length-1)?tween:"none";
    kf.easing=opts.easing||"linear";
    kf.objects=(c.parts||[]).map(function(t){
      var o=reviveObject(t);
      o.id=uid();
      o.rigChar=name;
      return o;
    });
    layer.keyframes.push(kf);
    // Pose it by writing the transforms straight onto this keyframe's parts.
    var pose=c.poses[st.pose];
    kf.objects.forEach(function(o){
      var t=pose[o.rigPart];
      if(!t)return;
      RIG_POSE_FIELDS.forEach(function(k){if(t[k]!=null)o[k]=t[k];});
    });
    written.push({frame:frame,pose:st.pose,duration:kf.duration});
    frame+=kf.duration;
  });

  layer.keyframes.sort(function(a,b){return a.index-b.index;});
  rescued.forEach(function(r){
    var host=null;
    layer.keyframes.forEach(function(kf){
      if(r.index>=kf.index&&r.index<kf.index+kf.duration)host=kf;
    });
    if(host&&!host.sound)host.sound=r.sound;
  });
  if(doc.totalFrames<end)doc.totalFrames=end;

  return {character:name,startFrame:start,endFrame:end,steps:written,
          layerIndex:currentLayers().indexOf(layer)};
}

/* ------------------------------------------------------------------ *
 * Character rigs
 *
 * A rig is a flat list of parts that live together in one keyframe, each
 * carrying who its parent is and where its pivot is. Transforms compose as
 *
 *     translate(pivot) · rotate · scale · translate(-pivot)
 *
 * applied for every ancestor and then for the part itself, all in ONE shared
 * coordinate space. Two consequences make this the right model for a Flash
 * tool:
 *
 *  - Parts keep the coordinates you drew them at. Parenting an arm to a torso
 *    does not move it, so building a rig never disturbs the artwork.
 *  - Rotating the shoulder swings the whole arm, because the child inherits
 *    the ancestor transforms rather than being nested inside the parent's
 *    symbol. You pose the whole character on one stage instead of diving into
 *    a nested symbol per limb, which is the thing Flash animators hated.
 *
 * Draw order is `rigZ`, independent of the hierarchy — the far arm has to sit
 * behind the torso it is parented to, which nesting cannot express.
 *
 * The same formula maps onto two nested engine containers per part (an outer
 * one holding translate+rotate+scale, an inner one holding -pivot), so the
 * HTML export composes identically instead of approximating.
 * -------------------------------------------------------------------- */

/** Is this object part of a character rig? */
function isRigPart(o){return !!(o&&o.rigChar&&o.rigPart);}

/**
 * A part's pivot, in the rig's shared space.
 *
 * pivotX/pivotY are stored relative to the object's top-left so they survive
 * resizing, and default to the centre — which is what every non-rigged object
 * already rotates about, so adopting a rig changes nothing until you move a
 * pivot.
 */
function rigPivot(o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  return {
    x:(o.x||0)+(o.pivotX!=null?o.pivotX:hw),
    y:(o.y||0)+(o.pivotY!=null?o.pivotY:hh)
  };
}

/** Apply one part's pivot transform, without drawing it. */
function applyPivotTransform(cx,o){
  var pv=rigPivot(o);
  cx.translate(pv.x,pv.y);
  if(o.rotation)cx.rotate(o.rotation*Math.PI/180);
  if((o.scaleX!=null&&o.scaleX!==1)||(o.scaleY!=null&&o.scaleY!==1)){
    cx.scale(o.scaleX!=null?o.scaleX:1,o.scaleY!=null?o.scaleY:1);
  }
  cx.translate(-pv.x,-pv.y);
}

/** Index a list of objects by rig part id, per character. */
function rigIndex(objects){
  var byId={};
  (objects||[]).forEach(function(o){
    if(isRigPart(o))byId[o.rigChar+"/"+o.rigPart]=o;
  });
  return byId;
}

/**
 * A part's ancestors, outermost first.
 *
 * Guarded against a cycle: a rig edited by hand (or by the assistant) could
 * name itself its own ancestor, and an unguarded walk would hang the editor
 * rather than draw something wrong.
 */
function rigAncestors(o,byId){
  var out=[],seen={},cur=o,guard=0;
  while(cur&&cur.rigParent&&guard++<RIG_MAX_DEPTH){
    var key=cur.rigChar+"/"+cur.rigParent;
    if(seen[key])break;
    seen[key]=1;
    var par=byId[key];
    if(!par)break;
    out.unshift(par);
    cur=par;
  }
  return out;
}
var RIG_MAX_DEPTH=24;

/**
 * Turn a flat frame into a draw plan: `{obj, chain}` in paint order.
 *
 * Non-rig objects keep their existing order exactly, so nothing about an
 * unrigged document changes. A character's parts are drawn as one block at the
 * position of its first part, ordered by `rigZ`, so a rig cannot silently jump
 * in front of or behind the rest of the layer.
 */
function rigDrawPlan(objects){
  objects=objects||[];
  var byId=rigIndex(objects);
  var firstOf={},plan=[];
  objects.forEach(function(o,i){
    if(isRigPart(o)&&firstOf[o.rigChar]==null)firstOf[o.rigChar]=i;
  });
  var emitted={};
  objects.forEach(function(o,i){
    if(!isRigPart(o)){plan.push({obj:o,chain:[],key:i});return;}
    if(emitted[o.rigChar])return;
    emitted[o.rigChar]=1;
    // Every part of this character, in draw order.
    var parts=objects.filter(function(q){return isRigPart(q)&&q.rigChar===o.rigChar;});
    parts.map(function(q,qi){return {q:q,qi:objects.indexOf(q)};})
      .sort(function(a,b){
        var az=a.q.rigZ!=null?a.q.rigZ:a.qi,bz=b.q.rigZ!=null?b.q.rigZ:b.qi;
        if(az!==bz)return az-bz;
        return a.qi-b.qi;
      })
      .forEach(function(e){
        plan.push({obj:e.q,chain:rigAncestors(e.q,byId),key:firstOf[o.rigChar]});
      });
  });
  return plan;
}

/** Paint one entry of a draw plan, ancestors applied first. */
function paintPlanned(cx,entry,opts){
  if(!entry.chain.length){paintObj(cx,entry.obj,opts);return;}
  cx.save();
  for(var i=0;i<entry.chain.length;i++)applyPivotTransform(cx,entry.chain[i]);
  paintObj(cx,entry.obj,opts);
  cx.restore();
}

/**
 * Map a point outwards through a chain of parts (outermost first).
 *
 * Everything positional goes through this one function — the joint overlay,
 * hit-testing a rotated limb, and turning a mouse drag into a rotation — so
 * they cannot disagree with what the painter draws.
 */
function rigApplyChain(chain,lx,ly){
  var x=lx,y=ly;
  // Innermost first: each part maps its own space outwards into its parent's.
  for(var i=chain.length-1;i>=0;i--){
    var p=chain[i],pv=rigPivot(p);
    var dx=x-pv.x,dy=y-pv.y;
    dx*=(p.scaleX!=null?p.scaleX:1);
    dy*=(p.scaleY!=null?p.scaleY:1);
    if(p.rotation){
      var a=p.rotation*Math.PI/180,c=Math.cos(a),si=Math.sin(a);
      var nx=dx*c-dy*si,ny=dx*si+dy*c;
      dx=nx;dy=ny;
    }
    x=pv.x+dx;y=pv.y+dy;
  }
  return {x:x,y:y};
}

/** Invert `rigApplyChain`. */
function rigUnapplyChain(chain,wx,wy){
  var x=wx,y=wy;
  for(var i=0;i<chain.length;i++){
    var p=chain[i],pv=rigPivot(p);
    var dx=x-pv.x,dy=y-pv.y;
    if(p.rotation){
      var a=-p.rotation*Math.PI/180,c=Math.cos(a),si=Math.sin(a);
      var nx=dx*c-dy*si,ny=dx*si+dy*c;
      dx=nx;dy=ny;
    }
    var sx=p.scaleX!=null?p.scaleX:1,sy=p.scaleY!=null?p.scaleY:1;
    if(sx)dx/=sx;
    if(sy)dy/=sy;
    x=pv.x+dx;y=pv.y+dy;
  }
  return {x:x,y:y};
}

/** Where a point in a part's own space lands on the stage. */
function rigWorldPoint(o,byId,lx,ly){
  return rigApplyChain(rigAncestors(o,byId).concat([o]),lx,ly);
}

/** A stage point expressed in a part's own (untransformed) space. */
function rigLocalPoint(o,byId,wx,wy){
  return rigUnapplyChain(rigAncestors(o,byId).concat([o]),wx,wy);
}

/**
 * A part's pivot on the stage.
 *
 * Only the ancestors move it: a part rotates *about* its own pivot, so its own
 * rotation leaves that point exactly where it is. Getting this wrong makes a
 * limb crawl away from its joint as you drag it.
 */
function rigPivotWorld(o,byId){
  var pv=rigPivot(o);
  return rigApplyChain(rigAncestors(o,byId),pv.x,pv.y);
}

/**
 * The rig part under a stage point, topmost first.
 *
 * Unlike hitTest(), this undoes the hierarchy before testing, so a rotated
 * forearm is clickable where it is drawn rather than where its untransformed
 * box would be.
 */
function rigHitTest(x,y){
  var kf=CKF();
  if(!kf)return null;
  var plan=rigDrawPlan(kf.objects);
  var byId=rigIndex(kf.objects);
  for(var i=plan.length-1;i>=0;i--){
    var o=plan[i].obj;
    if(!isRigPart(o))continue;
    var lp=rigLocalPoint(o,byId,x,y);
    var x0=Math.min(o.x,o.x+o.width),x1=Math.max(o.x,o.x+o.width);
    var y0=Math.min(o.y,o.y+o.height),y1=Math.max(o.y,o.y+o.height);
    if(lp.x>=x0&&lp.x<=x1&&lp.y>=y0&&lp.y<=y1)return o;
  }
  return null;
}

/**
 * Draw the rig over the artwork: a line from each part's pivot to its
 * children's, and a handle on each pivot.
 *
 * Without this you are guessing where a joint is, and a pivot in the wrong
 * place is the single most common reason a rig animates badly.
 */
function drawRigOverlay(cx){
  var kf=CKF();
  if(!kf)return;
  var parts=kf.objects.filter(isRigPart);
  if(!parts.length)return;
  var byId=rigIndex(kf.objects);
  var sel=selection.length===1&&isRigPart(selection[0])?selection[0]:null;
  var k=1/(zoom||1);

  // Bones first, so handles sit on top of them.
  cx.save();
  cx.lineWidth=2*k;
  parts.forEach(function(o){
    if(!o.rigParent)return;
    var par=byId[o.rigChar+"/"+o.rigParent];
    if(!par)return;
    var a=rigPivotWorld(par,byId),b=rigPivotWorld(o,byId);
    cx.strokeStyle=(sel&&(o===sel||par===sel))?"rgba(90,170,255,0.95)":"rgba(90,170,255,0.45)";
    cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke();
  });

  parts.forEach(function(o){
    var pv=rigPivotWorld(o,byId);
    var on=o===sel;
    var r=(on?5:3.5)*k;
    cx.beginPath();cx.arc(pv.x,pv.y,r,0,Math.PI*2);
    // A locked joint is drawn differently, because "why won't this move" is
    // otherwise a genuinely baffling few minutes.
    cx.fillStyle=o.rigLocked?"#FF7A7A":(on?"#FFD24A":"#5AAAFF");
    cx.globalAlpha=on?1:0.8;
    cx.fill();
    cx.globalAlpha=1;
    cx.lineWidth=1.2*k;
    cx.strokeStyle="rgba(0,0,0,0.6)";
    cx.stroke();
    if(on){
      // A ring shows which joint a drag will turn.
      cx.beginPath();cx.arc(pv.x,pv.y,10*k,0,Math.PI*2);
      cx.strokeStyle="rgba(255,210,74,0.7)";
      cx.setLineDash([3*k,3*k]);
      cx.lineWidth=1.2*k;
      cx.stroke();
      cx.setLineDash([]);
    }
  });
  cx.restore();
}

/* ---- Inverse kinematics -------------------------------------------- *
 * Drag a hand and the elbow and shoulder bend to follow it.
 *
 * The solver writes nothing but `rotation` onto the parts it moves. That is
 * the whole design: IK is an authoring aid, not a runtime feature, so poses,
 * keyframes, tweens and the HTML export are completely untouched by it. A
 * keyframe produced by dragging a hand is indistinguishable from one posed
 * joint by joint.
 *
 * Cyclic Coordinate Descent rather than a closed-form two-bone solution:
 * closed form only handles exactly two bones, while a character wants three
 * (shoulder/elbow/wrist, hip/knee/ankle) and sometimes a spine. CCD handles
 * any length, honours per-joint limits and locked parts for free, and
 * converges in a handful of passes at these sizes.
 * -------------------------------------------------------------------- */

/** How far up the chain a drag reaches, and how hard the solver tries. */
var IK_DEFAULT_BONES=2;
var IK_ITERATIONS=16;
/** Stop once the effector is within this many stage pixels of the target. */
var IK_TOLERANCE=0.25;

/**
 * Clamp a part's rotation to its own limits, if it has any.
 *
 * Limits are what stop an elbow bending backwards — without them IK will
 * happily find the anatomically wrong solution, because it has no idea which
 * way a knee goes.
 */
function clampPartRotation(o,deg){
  var lo=o.rigMin,hi=o.rigMax;
  if(lo!=null&&deg<lo)deg=lo;
  if(hi!=null&&deg>hi)deg=hi;
  return deg;
}

/** A part the solver is allowed to turn. */
function ikMovable(o){return !!o&&!o.rigLocked;}

/**
 * The chain a drag on `leaf` should move: the leaf and up to `bones-1` of its
 * ancestors, nearest first. Stops at a locked part, because a locked part is
 * the animator saying "this is planted" — reaching past it would move the
 * thing they pinned down.
 */
function ikChain(leaf,byId,bones){
  bones=Math.max(1,bones||IK_DEFAULT_BONES);
  var chain=[],cur=leaf,guard=0;
  while(cur&&chain.length<bones&&guard++<RIG_MAX_DEPTH){
    if(!ikMovable(cur))break;
    chain.push(cur);
    cur=cur.rigParent?byId[cur.rigChar+"/"+cur.rigParent]:null;
  }
  return chain;
}

/**
 * Bend `leaf`'s chain so the point `grab` (in the leaf's own space) reaches
 * the stage point (tx, ty).
 *
 * Returns {bones, error, iterations} — `error` is the distance still left,
 * which will be non-zero whenever the target is simply out of reach or the
 * joint limits forbid it. That is not a failure: the limb straightens toward
 * the target and stops, which is what it should do.
 */
function ikSolve(leaf,byId,grab,tx,ty,opts){
  opts=opts||{};
  var chain=ikChain(leaf,byId,opts.bones);
  if(!chain.length)return null;

  var iters=0;
  var dist=function(){
    var e=rigApplyChain(rigAncestors(leaf,byId).concat([leaf]),grab.x,grab.y);
    var dx=tx-e.x,dy=ty-e.y;
    return {d:Math.sqrt(dx*dx+dy*dy),e:e};
  };

  var best=dist().d;
  for(var it=0;it<(opts.iterations||IK_ITERATIONS);it++){
    iters++;
    for(var i=0;i<chain.length;i++){
      var part=chain[i];
      var joint=rigPivotWorld(part,byId);
      var cur=dist().e;
      // Turn this joint so the effector swings onto the target. Both angles
      // are measured from the joint, so the difference is exactly the
      // correction this joint can contribute.
      var a=Math.atan2(cur.y-joint.y,cur.x-joint.x);
      var b=Math.atan2(ty-joint.y,tx-joint.x);
      var delta=(b-a)*180/Math.PI;
      if(!isFinite(delta))continue;
      var want=(part.rotation||0)+delta;
      // Damp the joints further up the chain. Undamped CCD throws the root
      // around on the first pass, which looks like the whole body lurching.
      if(i>0)want=(part.rotation||0)+delta*(1/(1+i));
      part.rotation=Math.round(clampPartRotation(part,want)*1000)/1000;
    }
    var now=dist().d;
    if(now<=IK_TOLERANCE)break;
    // Converged as far as it is going to (out of reach, or limits binding).
    if(Math.abs(best-now)<1e-4)break;
    best=now;
  }
  return {bones:chain.length,error:dist().d,iterations:iters};
}

/* ---- Posing ------------------------------------------------------- *
 * Drag a limb to swing it about its joint; children follow because they
 * inherit the transform rather than being copied. Ctrl drags the joint
 * itself, Alt moves the part, Shift snaps the angle.
 * -------------------------------------------------------------------- */
var poseDrag=null;
/**
 * Drag behaviour for the Pose tool.
 *
 * `ik` is the default because bending a limb to put a hand where you want it
 * is the common case; "single" is a straight one-joint swing. Tool state, not
 * document state, so it is not saved with the file.
 */
var poseMode="ik";
var poseBones=IK_DEFAULT_BONES;

function setPoseMode(m){poseMode=(m==="single")?"single":"ik";emitRigChange();}
function setPoseBones(n){
  poseBones=Math.max(1,Math.min(RIG_MAX_DEPTH,parseInt(n,10)||IK_DEFAULT_BONES));
  emitRigChange();
}

function poseMouseDown(e,p){
  var hit=rigHitTest(p.x,p.y);
  if(!hit){selection=[];poseDrag=null;updateProps();render();return;}
  selection=[hit];
  var kf=CKF();
  var byId=rigIndex(kf?kf.objects:[]);
  var pv=rigPivotWorld(hit,byId);

  var mode;
  if(e.ctrlKey||e.metaKey)mode="pivot";
  else if(e.altKey)mode="move";
  else if(poseMode==="ik"&&!hit.rigLocked&&ikChain(hit,byId,poseBones).length>1)mode="ik";
  else mode="rotate";

  poseDrag={
    part:hit,
    mode:mode,
    pivot:pv,
    startAngle:Math.atan2(p.y-pv.y,p.x-pv.x),
    startRot:hit.rotation||0,
    startX:hit.x||0,startY:hit.y||0,
    startPivotX:hit.pivotX!=null?hit.pivotX:(hit.width||0)/2,
    startPivotY:hit.pivotY!=null?hit.pivotY:(hit.height||0)/2,
    from:p,
    // Where on the limb the drag started, in the part's own space. The grab
    // point *is* the effector, so pulling a limb anywhere along its length
    // behaves the way grabbing a real arm does.
    grab:rigLocalPoint(hit,byId,p.x,p.y),
    // Every rotation in the chain, so one drag is one undo step and a
    // cancelled drag can put everything back.
    chainStart:ikChain(hit,byId,poseBones).map(function(q){
      return {part:q,rotation:q.rotation||0};
    }),
    pre:snap()
  };
  updateProps();render();
}

function poseMouseMove(e,p){
  if(!poseDrag)return;
  var o=poseDrag.part;
  if(poseDrag.mode==="ik"){
    var kfi=CKF();
    ikSolve(o,rigIndex(kfi?kfi.objects:[]),poseDrag.grab,p.x,p.y,{bones:poseBones});
    if(e.shiftKey){
      // Snapping an IK result means snapping the joints it produced, which is
      // what you want when a pose has to be exactly horizontal.
      poseDrag.chainStart.forEach(function(st){
        st.part.rotation=clampPartRotation(st.part,Math.round((st.part.rotation||0)/15)*15);
      });
    }
    render();
    return;
  }
  if(poseDrag.mode==="rotate"){
    var a=Math.atan2(p.y-poseDrag.pivot.y,p.x-poseDrag.pivot.x);
    var deg=poseDrag.startRot+(a-poseDrag.startAngle)*180/Math.PI;
    if(e.shiftKey)deg=Math.round(deg/15)*15;
    // The same limits IK respects, so a joint cannot be dragged somewhere the
    // solver would refuse to put it.
    o.rotation=Math.round(clampPartRotation(o,deg)*100)/100;
  }else if(poseDrag.mode==="move"){
    o.x=poseDrag.startX+(p.x-poseDrag.from.x);
    o.y=poseDrag.startY+(p.y-poseDrag.from.y);
  }else{
    // Dragging the joint: express the mouse in the part's own space so the
    // pivot lands under the cursor whatever the hierarchy is doing.
    var kf=CKF();
    var byId=rigIndex(kf?kf.objects:[]);
    var lp=rigUnapplyChain(rigAncestors(o,byId),p.x,p.y);
    o.pivotX=Math.round((lp.x-(o.x||0))*100)/100;
    o.pivotY=Math.round((lp.y-(o.y||0))*100)/100;
  }
  render();
}

function poseMouseUp(){
  if(!poseDrag)return;
  var o=poseDrag.part;
  // Only commit an undo step if something actually changed. An IK drag can
  // move joints other than the one grabbed, so the whole chain counts.
  var moved=(o.rotation||0)!==poseDrag.startRot||
            (o.x||0)!==poseDrag.startX||(o.y||0)!==poseDrag.startY||
            (o.pivotX!=null?o.pivotX:0)!==poseDrag.startPivotX||
            (o.pivotY!=null?o.pivotY:0)!==poseDrag.startPivotY;
  (poseDrag.chainStart||[]).forEach(function(st){
    if((st.part.rotation||0)!==st.rotation)moved=true;
  });
  if(moved){
    pushUndoSnap(poseDrag.pre);
    if(poseDrag.mode==="pivot")syncCharacterFromStage(o.rigChar);
    emitRigChange();
  }
  poseDrag=null;
  updateProps();
  render();
}

/** Let the Character panel know the rig changed under it. */
function emitRigChange(){
  try{window.dispatchEvent(new CustomEvent("flashy:rigchange"));}catch(err){}
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
  if(isRigPart(o)){
    // Rotate about the pivot, in the rig's shared space, then step into the
    // object's own frame so the shape code below is unchanged.
    applyPivotTransform(cx,o);
    cx.translate((o.x||0)+hw,(o.y||0)+hh);
  }else{
    cx.translate((o.x||0)+hw,(o.y||0)+hh);
    if(o.rotation)cx.rotate(o.rotation*Math.PI/180);
    cx.scale(o.scaleX||1,o.scaleY||1);
  }
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
  }else if(o.type==="bitmap"){
    var bimg=bitmapImage(o.bitmapAsset);
    if(bimg){
      var bnw=bimg.naturalWidth||bimg.width,bnh=bimg.naturalHeight||bimg.height;
      if(bnw&&bnh){
        var prevSmooth=cx.imageSmoothingEnabled;
        cx.imageSmoothingEnabled=o.smoothing!==false;
        cx.globalAlpha=alpha;
        var bmask=bitmapMaskPath(o);
        if(bmask){
          cx.save();
          cx.translate(-hw,-hh);
          // Nonzero, with every erased loop wound backwards against the box:
          // that subtracts them, and lets overlapping strokes union instead of
          // cancelling back into view.
          cx.clip(bmask,"nonzero");
          cx.translate(hw,hh);
        }
        cx.drawImage(bimg,0,0,bnw,bnh,-hw,-hh,o.width,o.height);
        if(bmask)cx.restore();
        cx.imageSmoothingEnabled=prevSmooth;
      }
    }else if(chrome){
      // Decoding is async and a missing asset is a real possibility; an
      // invisible rectangle you cannot find or select is worse than a frame
      // that says what it is waiting for.
      cx.save();
      cx.globalAlpha=alpha*0.6;
      cx.strokeStyle="#888";cx.lineWidth=1;cx.setLineDash([4,3]);
      cx.strokeRect(-hw,-hh,o.width,o.height);
      cx.setLineDash([]);
      cx.fillStyle="#888";cx.font="10px Tahoma, sans-serif";
      cx.textAlign="center";cx.textBaseline="middle";
      cx.fillText(o.bitmapAsset||"(no image)",0,0,Math.max(10,Math.abs(o.width)-6));
      cx.textAlign="start";
      cx.restore();
    }
  }else if(o.type==="path"){
    /* A traced outline. Coordinates are object-local with the bounding box at
       (0,0), like pencil points — but `pathW`/`pathH` record the size they
       were authored at, so editing W/H in the inspector actually rescales the
       artwork instead of silently doing nothing (which is what the pencil
       does, and the one thing you always want to do to a trace). */
    if(o.path&&o.path.length&&window.FlashyTrace){
      var psx=o.pathW?(o.width/o.pathW):1,psy=o.pathH?(o.height/o.pathH):1;
      cx.save();
      cx.translate(-hw,-hh);
      if(psx!==1||psy!==1)cx.scale(psx,psy);
      cx.beginPath();
      FlashyTrace.pathToContext(o.path,cx);
      if(fillOn){
        cx.fillStyle=o.fillColor;cx.globalAlpha=fillA;
        // Even-odd, because a traced region carries its holes as extra loops
        // in the same path and their winding is whatever the boundary walk
        // produced. Nonzero would fill the holes in.
        cx.fill("evenodd");
      }
      if(strokeOn){
        cx.strokeStyle=o.strokeColor;
        // Undo the shape scale on the pen so a scaled trace keeps an even
        // outline instead of a stretched one.
        cx.lineWidth=o.strokeWidth/Math.max(1e-6,(Math.abs(psx)+Math.abs(psy))/2);
        cx.globalAlpha=strokeA;applyStroke();cx.stroke();
      }
      cx.restore();
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
        // Through the rig plan, so a character rig nested inside a symbol
        // composes its hierarchy here exactly as addPlanned() does in the
        // export. Painting the flat list would drop every ancestor transform.
        var symPlan=rigDrawPlan(symObjs);
        for(var si=0;si<symPlan.length;si++){
          paintPlanned(cx,symPlan[si],{chrome:chrome,depth:depth+1});
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
  }else if(p.type==="eraser"){
    /* The stroke as it is being drawn, at its true width. Drawn as a plain
       thick line rather than by running the real swept-area geometry on every
       pointer move — the two agree to within a fraction of a pixel, and the
       geometry is for the one time it matters, on release. */
    if(p.points&&p.points.length>=2){
      ctx.save();
      ctx.beginPath();
      var ep=s2c(p.points[0],p.points[1]);
      ctx.moveTo(ep.x,ep.y);
      for(var ei=2;ei<p.points.length;ei+=2){
        var ec=s2c(p.points[ei],p.points[ei+1]);
        ctx.lineTo(ec.x,ec.y);
      }
      if(p.points.length===2)ctx.lineTo(ep.x+0.01,ep.y);
      ctx.strokeStyle="rgba(255,90,90,0.35)";
      ctx.lineWidth=eraserSize*zoom;
      ctx.lineCap=eraserShape==="square"?"butt":"round";
      ctx.lineJoin=eraserShape==="square"?"miter":"round";
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
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

/* The eraser's own cursor, drawn on the stage rather than as a CSS cursor.
   It has to show the real size at the current zoom, and a CSS cursor is both
   capped at about 128px and would need regenerating on every size and zoom
   change. Seeing exactly what the brush will take is most of the tool. */
var eraserHover=null;
function drawEraserGhost(){
  if(curTool!=="eraser"||!eraserHover)return;
  var c=s2c(eraserHover.x,eraserHover.y);
  var r=eraserSize*zoom/2;
  ctx.save();
  ctx.beginPath();
  if(eraserShape==="square")ctx.rect(c.x-r,c.y-r,r*2,r*2);
  else ctx.arc(c.x,c.y,r,0,Math.PI*2);
  ctx.strokeStyle="rgba(255,255,255,0.9)";ctx.lineWidth=1;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.strokeStyle="rgba(0,0,0,0.75)";ctx.lineWidth=1;
  ctx.setLineDash([3,3]);
  ctx.stroke();
  ctx.setLineDash([]);
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
  /* The eraser's ghost follows the pointer whether or not a button is down,
     so a repaint is needed on plain hover — but only for this one tool, since
     re-rendering the stage on every mouse move is not free. */
  canvas.addEventListener("pointermove",function(e){
    if(curTool!=="eraser")return;
    eraserHover=getStagePos(e);
    if(!dragging)render();
  });
  canvas.addEventListener("pointerleave",function(){
    if(eraserHover){eraserHover=null;render();}
  });
  canvas.addEventListener("pointerup",onMouseUp);
  // A cancelled pointer (OS gesture, palm rejection) must not leave `dragging`
  // stuck true — that would make the next click continue the abandoned drag.
  canvas.addEventListener("pointercancel",function(e){
    dragging=false;dragPreview=null;moveObjStarts=[];movePreSnap=null;poseDrag=null;
    render();
  });
  canvas.addEventListener("dblclick",onDblClick);
  canvas.addEventListener("wheel",onWheel,{passive:false});
  canvas.addEventListener("contextmenu",function(e){e.preventDefault();showCtx(e);});

  /* Drop an image onto the stage and it lands where you dropped it. This is
     the gesture for "use this photo as a background" and for "here is the
     pencil test I want to trace", and both are the first thing people try. */
  canvas.addEventListener("dragover",function(e){
    if(!e.dataTransfer)return;
    e.preventDefault();
    e.dataTransfer.dropEffect="copy";
    canvas.classList.add("drop-image");
  });
  canvas.addEventListener("dragleave",function(){canvas.classList.remove("drop-image");});
  canvas.addEventListener("drop",function(e){
    canvas.classList.remove("drop-image");
    var files=e.dataTransfer&&e.dataTransfer.files;
    if(!files||!files.length)return;
    e.preventDefault();
    if(String(files[0].type).indexOf("image/")!==0){
      // An audio file dropped here is a near miss, not a mistake worth a
      // dialog — send it where it was going to go.
      if(String(files[0].type).indexOf("audio/")===0)importSoundFile(files[0]);
      else showMessage("Drop","Drop an image to place it, or an audio file to add it to the timeline.");
      return;
    }
    var p=getStagePos(e);
    importImageFile(files[0],{dropX:p.x,dropY:p.y});
  });
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
  if(curTool==="pose"){
    poseMouseDown(e,p);
  }else if(curTool==="select"){
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
  }else if(curTool==="eraser"){
    dragPreview={type:"eraser",points:[p.x,p.y]};
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
  if(curTool==="pose"){
    poseMouseMove(e,p);
  }else if(curTool==="select"){
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
  }else if(curTool==="pencil"||curTool==="brush"||curTool==="eraser"){
    if(dragPreview&&dragPreview.points){dragPreview.points.push(p.x,p.y);}
  }else if(curTool==="hand"){
    panX+=e.clientX-moveStartX;panY+=e.clientY-moveStartY;
    moveStartX=e.clientX;moveStartY=e.clientY;
  }
  render();
}
function onMouseUp(e){
  if(curTool==="pose"){
    poseMouseUp();
    dragging=false;dragPreview=null;
    return;
  }
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
  }else if(curTool==="eraser"){
    if(dragPreview&&dragPreview.points&&dragPreview.points.length>=2){
      var res=eraseStroke(dragPreview.points.slice(),{});
      if(res.locked){
        showMessage("Eraser","This layer is locked or hidden, so nothing on it can be erased.");
      }else if(!res.erased&&!res.removed&&res.skipped){
        // The commonest confusion by far: dragging the eraser over a symbol
        // and watching nothing happen.
        showMessage("Eraser",
          "Nothing was erased.\n\nThe eraser works on shapes and bitmaps. "+
          "Symbols, text and character rig parts are left alone — "+
          "double-click a symbol to erase inside it, or use Modify ▸ Convert "+
          "to Symbol in reverse by editing its contents.");
      }
      fullRefresh();
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
  // Selected block of cells: one rectangle spanning layers and frames.
  var selR=tlRange();
  if(selR){
    var rx=(selR.f0-1)*fw;
    var rw=(selR.f1-selR.f0+1)*fw;
    var ry=TL_HDR+selR.l0*fh;
    var rh=(selR.l1-selR.l0+1)*fh;
    tlCtx.fillStyle="rgba(68,136,204,0.2)";
    tlCtx.fillRect(rx,ry,rw,rh);
    tlCtx.strokeStyle="rgba(68,136,204,0.6)";tlCtx.lineWidth=1;
    tlCtx.strokeRect(rx+0.5,ry+0.5,rw-1,rh-1);
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
/**
 * The selected block of timeline cells.
 *
 * `{layerIdx, endLayerIdx, startFrame, endFrame}` — a rectangle, because
 * anything you would want to do to a span of animation (convert it to a
 * symbol, remove it, copy it) applies across the layers that make it up, not
 * one at a time. Either corner may be the larger; use tlRange() to normalise.
 */
var tlSelRange=null;

/** The selection as {l0,l1,f0,f1}, clamped to the layers that exist. */
function tlRange(){
  if(!tlSelRange)return null;
  var layers=currentLayers();
  var a=tlSelRange.layerIdx,b=tlSelRange.endLayerIdx!=null?tlSelRange.endLayerIdx:a;
  var l0=Math.max(0,Math.min(a,b)),l1=Math.min(layers.length-1,Math.max(a,b));
  if(l1<l0)return null;
  return {
    l0:l0,l1:l1,
    f0:Math.max(1,Math.min(tlSelRange.startFrame,tlSelRange.endFrame)),
    f1:Math.max(1,Math.max(tlSelRange.startFrame,tlSelRange.endFrame))
  };
}

/** How many cells the selection covers, for labelling menu entries. */
function tlRangeLabel(){
  var r=tlRange();
  if(!r)return "";
  var frames=r.f1-r.f0+1,lays=r.l1-r.l0+1;
  if(frames<=1&&lays<=1)return "";
  return " ("+frames+" frame"+(frames===1?"":"s")+
         (lays>1?" \u00d7 "+lays+" layers":"")+")";
}
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
    // Shift-click extends the block from wherever it started, across layers as
    // well as frames — that is the whole point of a rectangle.
    if(e.shiftKey&&tlSelRange){
      tlSelRange.endFrame=f;
      tlSelRange.endLayerIdx=li;
    }else{
      tlSelRange={layerIdx:li,endLayerIdx:li,startFrame:f,endFrame:f};
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
      var sp=tlPos(ev);
      var sf=Math.max(1,Math.floor(sp.x/TL_FW_())+1);
      // Dragging up or down grows the block over those layers, so selecting a
      // span of an animation is one gesture rather than one per layer.
      var sl=Math.max(0,Math.min(layers.length-1,Math.floor((sp.y-TL_HDR)/TL_FH)));
      var changed=false;
      if(tlSelRange&&tlSelRange.endLayerIdx!==sl){tlSelRange.endLayerIdx=sl;changed=true;}
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
        changed=true;
      }
      if(changed)fullRefresh();
    }
    function stopScrub(){
      document.removeEventListener("mousemove",scrub);
      document.removeEventListener("mouseup",stopScrub);
      endScrub();
    }
    document.addEventListener("mousemove",scrub);
    document.addEventListener("mouseup",stopScrub);
  });

  /* Drop a file anywhere on the timeline to import it onto the frame and
     layer you dropped it on — the gesture people try first. Audio and images
     both land here; the file's type decides which. */
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
    if(String(files[0].type).indexOf("image/")===0)importImageFile(files[0]);
    else importSoundFile(files[0]);
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
    var rangeInfo=tlRangeLabel();
    showTLContextMenu(e.clientX,e.clientY,[
      {label:"Insert Keyframe (F6)",action:function(){doAction("insKF");}},
      {label:"Insert Blank Keyframe (F7)",action:function(){doAction("insBlankKF");}},
      {label:"Insert Frame (F5)",action:function(){doAction("insFrame");}},
      {sep:true},
      {label:"Insert Frames"+rangeInfo,action:function(){
        pushUndo();var layer=layers[curLayer];if(!layer)return;
        var count=1;
        var ri=tlRange();
        if(ri)count=ri.f1-ri.f0+1;
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
        pushUndo();
        var rr=tlRange();
        if(rr){
          // Across every selected layer, not just the current one.
          for(var rl=rr.l0;rl<=rr.l1;rl++){
            var lay=layers[rl];
            if(!lay)continue;
            for(var ff=0;ff<(rr.f1-rr.f0+1);ff++){
              var kfr=lay.getKeyframeAt(rr.f0);
              if(kfr&&kfr.duration>1)kfr.duration--;
            }
          }
        }else{
          var lay2=layers[curLayer];
          if(lay2){
            var kfr2=lay2.getKeyframeAt(f);
            if(kfr2&&kfr2.duration>1)kfr2.duration--;
          }
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
        tlSelRange={layerIdx:curLayer,endLayerIdx:curLayer,
                    startFrame:1,endFrame:layer.getFrameEnd()};
        fullRefresh();
      }},
      {label:"Select All Layers",action:function(){
        var end=1;
        layers.forEach(function(l){var e2=l.getFrameEnd();if(e2>end)end=e2;});
        tlSelRange={layerIdx:0,endLayerIdx:layers.length-1,startFrame:1,endFrame:end};
        fullRefresh();
      }},
      {sep:true},
      {label:"Convert Frames to Symbol\u2026"+rangeInfo,action:function(){
        doAction("framesToSymbol");
      }},
      {label:"Cut Frames"+rangeInfo,action:function(){doAction("cutFrames");}},
      {label:"Copy Frames"+rangeInfo,action:function(){doAction("copyFrames");}},
      {label:hasFrameClipboard()
        ? "Paste Frames ("+frameClipboard.frames+" × "+frameClipboard.layers.length+")"
        : "Paste Frames",
       action:function(){doAction("pasteFrames");}}
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

    // ── Bitmap Properties ──
    if(o.type==="bitmap"){
      var basset=doc.bitmaps[o.bitmapAsset];
      sect("Bitmap");
      row("Image",o.bitmapAsset||"(none)",function(){},{type:"readonly"});
      row("Source",basset&&basset.width?(basset.width+" × "+basset.height+" px"):"decoding…",
          function(){},{type:"readonly"});
      row("Smoothing",o.smoothing!==false,function(v){
        pushUndo();o.smoothing=!!v;render();
      },{type:"checkbox"});
      actionRow([
        {label:"Trace Bitmap...",onClick:function(){selection=[o];showTraceBitmapDialog();}},
        {label:"Swap Bitmap...",onClick:function(){selection=[o];showSwapBitmapDialog();}}
      ]);
      actionRow([
        {label:"Reset to Source Size",onClick:function(){
          if(!basset||!basset.width)return;
          pushUndo();o.width=basset.width;o.height=basset.height;
          render();updateProps();
        }}
      ]);
      if(o.eraseMask&&o.eraseMask.length){
        // Erasing a bitmap is a stencil over the original pixels, not a
        // rewrite of them, so it is always fully reversible.
        note("Parts of this image have been erased. The pixels are still there — "+
             "the erased areas are masked out, so this can be undone at any time.");
        actionRow([
          {label:"Restore Erased Areas",onClick:function(){
            pushUndo();o.eraseMask=null;o.maskW=0;o.maskH=0;
            render();updateProps();
          }}
        ]);
      }
      if(!bitmapImage(o.bitmapAsset)){
        note("This image has not finished decoding — the stage shows a labelled frame until it has.");
      }
    }

    // ── Traced Path Properties ──
    if(o.type==="path"){
      sect("Traced Path");
      var nodes=(o.path&&window.FlashyTrace)?FlashyTrace.pathNodeCount(o.path):0;
      row("Nodes",nodes,function(){},{type:"readonly"});
      note("A traced outline. Editing W and H rescales it, and the fill below is "+
           "the colour the trace assigned — change it like any other shape.");
    }

    /* Fill and stroke belong to the artwork, not to a symbol instance —
       the shapes inside the symbol carry their own. A bitmap has neither: it
       is pixels. Showing dead controls above the frame picker is noise in
       exactly the workflow (lip sync, posing) where the frame picker gets
       used most. */
    if(o.type!=="symbol"&&o.type!=="bitmap"){
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
  var bkeys=Object.keys(doc.bitmaps||{});
  if(keys.length===0&&bkeys.length===0){
    var empty=document.createElement("div");empty.className="lib-empty";
    empty.textContent="No symbols or bitmaps";lp.appendChild(empty);
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

  /* Bitmaps share the Library, because that is what they are: reusable assets
     referenced by name. Click places an instance; double-click goes straight
     to tracing it, which is the thing you most often imported it to do. */
  if(bkeys.length){
    var bt=document.createElement("div");
    bt.className="lib-title lib-subtitle";
    bt.textContent="Bitmaps";
    lp.appendChild(bt);
    bkeys.forEach(function(k){
      var a=doc.bitmaps[k];
      var row=document.createElement("div");row.className="lib-item";
      var icon=document.createElement("span");icon.className="lib-icon";icon.textContent="▦";
      row.appendChild(icon);
      var name=document.createElement("span");
      name.textContent=k;
      row.appendChild(name);
      var dim=document.createElement("span");
      dim.className="lib-dim";
      dim.textContent=a&&a.width?a.width+"×"+a.height:"";
      row.appendChild(dim);
      row.title=k+(a&&a.width?" — "+a.width+"×"+a.height+" px":"")+
        "\nClick to place, double-click to trace, right-click to delete.";
      row.addEventListener("click",function(){
        pushUndo();
        var placed=placeBitmap(k,{});
        if(placed)selection=[placed];
        fullRefresh();
      });
      row.addEventListener("dblclick",function(e){
        e.stopPropagation();
        var placed=selectedBitmap();
        if(!placed||placed.bitmapAsset!==k){
          pushUndo();
          placed=placeBitmap(k,{});
          if(placed)selection=[placed];
          fullRefresh();
        }
        if(placed)showTraceBitmapDialog();
      });
      row.addEventListener("contextmenu",function(e){
        e.preventDefault();e.stopPropagation();
        showDialog({
          title:"Delete Bitmap",
          message:"Delete “"+k+"” from the library?\n\n"+
                  "Every instance of it on the timeline goes too. This can be undone.",
          fields:[],okLabel:"Delete",
          onOk:function(){deleteBitmapAsset(k);}
        });
      });
      lp.appendChild(row);
    });
  }
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
      {label:"Convert to Symbol...",action:"convertSym"}
    ];
    // Tracing is reached from a bitmap you right-clicked far more often than
    // from the Modify menu, so it only appears when there is one selected.
    if(selectedBitmap()){
      items.push({type:"sep"});
      items.push({label:"Trace Bitmap...",action:"traceBitmap"});
      items.push({label:"Swap Bitmap...",action:"swapBitmap"});
    }
    items.push({type:"sep"});
    items.push({label:"Bring to Front",action:"bringFront"});
    items.push({label:"Send to Back",action:"sendBack"});
  }else{
    items=[
      {label:"Paste",action:"paste"},
      {type:"sep"},
      {label:"Insert Keyframe",action:"insKF"},
      {label:"Insert Blank Keyframe",action:"insBlankKF"},
      {type:"sep"},
      {label:"Import Image...",action:"importImage"},
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
      doc.layers=[new Layer("Layer 1")];doc.library={};doc.sounds={};doc.bitmaps={};doc.totalFrames=60;
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
  case "copyFrames": {
    var cres=copyFrames();
    if(typeof cres==="string")showMessage("Copy Frames",cres);
    else fullRefresh();
    break;
  }
  case "cutFrames": {
    if(!tlRange()){
      showMessage("Cut Frames","Select some frames in the timeline first.");
      break;
    }
    // Before the mutation, or undo would restore the already-cut state.
    pushUndo();
    var xres=cutFrames();
    if(typeof xres==="string")showMessage("Cut Frames",xres);
    fullRefresh();
    break;
  }
  case "pasteFrames": {
    if(!hasFrameClipboard()){
      showMessage("Paste Frames",
        "Nothing has been copied yet. Select a block of frames and use "+
        "Edit \u25b8 Copy Frames.");
      break;
    }
    pushUndo();
    var pres=pasteFrames();
    if(typeof pres==="string")showMessage("Paste Frames",pres);
    fullRefresh();
    break;
  }
  case "framesToSymbol":
    showFramesToSymbolDialog();
    break;
  case "newBiped":
    showBipedDialog();
    break;
  case "newCharacter":
    showNewCharacterDialog();
    break;
  case "addCharacterPart":
    showAddCharacterPartDialog();
    break;
  case "editCharacterPart":
    showEditCharacterPartDialog();
    break;
  case "saveCharacterPose":
    showSavePoseDialog();
    break;
  case "animateCharacter":
    showAnimateCharacterDialog();
    break;
  case "deleteCharacter":
    showDeleteCharacterDialog();
    break;
  case "placeCharacter": {
    var pcName=currentCharacterName();
    if(!pcName){showMessage("Characters","There are no characters yet.");break;}
    pushUndo();
    if(!instanceCharacter(pcName,{})){
      showMessage("Place In Frame",
        "\u201c"+pcName+"\u201d has no parts to place yet. Add a part first.");
    }
    fullRefresh();
    break;
  }
  case "mouthSetup":
    showMouthSetupDialog();
    break;
  case "lipSync":
    showLipSyncDialog();
    break;
  case "importImage":
    var iinp=document.createElement("input");
    iinp.type="file";
    iinp.accept="image/*,.png,.jpg,.jpeg,.gif,.webp,.bmp";
    iinp.addEventListener("change",function(){
      if(iinp.files&&iinp.files[0])importImageFile(iinp.files[0]);
    });
    iinp.click();
    break;
  case "traceBitmap":
    showTraceBitmapDialog();
    break;
  case "swapBitmap":
    showSwapBitmapDialog();
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
 * Bitmaps
 *
 * Until now nothing in the document model could hold an image, which made a
 * whole category of work impossible: a scanned pencil test, a photo
 * background, a texture, and — the reason this landed — anything to trace.
 *
 * The model mirrors audio exactly, because audio got it right: the document
 * carries encoded bytes under a name, the decoded image lives in
 * Flashy.Bitmaps, and an object of type "bitmap" refers to the asset by name.
 * So one image placed on forty frames is stored once and decoded once, a
 * .flashy stays a single self-contained file, and the exporters have one
 * place to look.
 * ------------------------------------------------------------------ */

/** Longest edge a stored bitmap may have. Beyond this the import downscales. */
var BITMAP_MAX_EDGE=2048;
/** Longest edge the tracer looks at. Above this it traces a downscaled copy
    and scales the result back up — a 12-megapixel photo is minutes of work
    for detail no vector outline is going to keep anyway. */
var TRACE_MAX_EDGE=900;

/* Erased bitmaps are redrawn on every frame and a mask can run to thousands of
   numbers, so the Path2D is cached against the mask array itself. A WeakMap
   rather than a field on the object: plainObj() serialises every own key, so a
   cache stashed on the object would end up inside the .flashy. */
var bitmapMaskCache=new WeakMap();

/** The clip for an erased bitmap — its box minus the erased loops — or null. */
function bitmapMaskPath(o){
  if(!o.eraseMask||!o.eraseMask.length||typeof Path2D==="undefined")return null;
  var w=Math.abs(o.width)||1,h=Math.abs(o.height)||1;
  var hit=bitmapMaskCache.get(o.eraseMask);
  if(hit&&hit.w===w&&hit.h===h)return hit.path;
  var G=window.FlashyGeom;
  if(!G)return null;
  var sx=o.maskW?w/o.maskW:1,sy=o.maskH?h/o.maskH:1;
  var loops=G.scaleLoops(G.pathToLoops(o.eraseMask,ERASE_FLATTEN),sx,sy);
  var p=new Path2D();
  p.rect(0,0,w,h);
  for(var i=0;i<loops.length;i++){
    var l=loops[i];
    if(l.length<6)continue;
    // Backwards, so it winds against the box.
    p.moveTo(l[l.length-2],l[l.length-1]);
    for(var k=l.length-4;k>=0;k-=2)p.lineTo(l[k],l[k+1]);
    p.closePath();
  }
  bitmapMaskCache.set(o.eraseMask,{w:w,h:h,path:p});
  return p;
}

/** The decoded image for an asset name, or null if it is not ready yet. */
function bitmapImage(name){
  if(!name||typeof Flashy==="undefined"||!Flashy.Bitmaps)return null;
  return Flashy.Bitmaps.get(name);
}

function bitmapDataURL(name){
  var a=doc.bitmaps&&doc.bitmaps[name];
  if(!a||!a.data)return "";
  return "data:"+(a.mediaType||"image/png")+";base64,"+a.data;
}

function uniqueBitmapName(base){
  base=(base||"Bitmap").trim()||"Bitmap";
  if(!doc.bitmaps[base])return base;
  var n=2;
  while(doc.bitmaps[base+" "+n])n++;
  return base+" "+n;
}

/**
 * Decode an asset so it can be drawn, then redraw.
 * Safe to call repeatedly — Flashy.Bitmaps caches by name.
 */
function decodeBitmap(name){
  var asset=doc.bitmaps&&doc.bitmaps[name];
  if(!asset||typeof Flashy==="undefined"||!Flashy.Bitmaps)return Promise.resolve(null);
  if(Flashy.Bitmaps.has(name))return Promise.resolve(Flashy.Bitmaps.get(name));
  return Flashy.Bitmaps.load(name,bitmapDataURL(name))
    .then(function(img){
      // Trust the decoded image over whatever the document claimed.
      asset.width=img.naturalWidth||img.width;
      asset.height=img.naturalHeight||img.height;
      render();
      return img;
    })
    .catch(function(err){
      if(window.console)console.warn("Flashy: could not decode bitmap "+name,err);
      return null;
    });
}
function decodeAllBitmaps(){
  Object.keys(doc.bitmaps||{}).forEach(decodeBitmap);
}

/** Place an instance of a bitmap asset on the current keyframe. */
function placeBitmap(assetName,opts){
  opts=opts||{};
  var asset=doc.bitmaps[assetName];
  if(!asset)return null;
  var kf=CKF();
  if(!kf){var l=CL();if(l)kf=l.insertKeyframe(curFrame);}
  if(!kf)return null;
  var w=asset.width||100,h=asset.height||100;
  // Shrink an oversized image to fit the stage on arrival. Importing a 4000px
  // photo and seeing one of its pixels fill the canvas is not a useful start.
  var fit=Math.min(1,doc.width/w,doc.height/h);
  if(fit<1){w=Math.round(w*fit);h=Math.round(h*fit);}
  var o=new EditorObject("bitmap");
  o.bitmapAsset=assetName;
  o.width=w;o.height=h;
  // `x`/`y` place the top-left; `dropX`/`dropY` centre it on a drop point,
  // which is only knowable here because the fit above decides the final size.
  if(opts.x!=null&&opts.y!=null){o.x=opts.x;o.y=opts.y;}
  else if(opts.dropX!=null&&opts.dropY!=null){
    o.x=Math.round(opts.dropX-w/2);o.y=Math.round(opts.dropY-h/2);
  }else{
    o.x=Math.round((doc.width-w)/2);o.y=Math.round((doc.height-h)/2);
  }
  o.fillType="none";o.strokeStyle="none";o.strokeWidth=0;
  kf.objects.push(o);
  return o;
}

/**
 * Import an image File into the document and place it on the current frame.
 *
 * The bytes are re-encoded through a canvas when the image is larger than
 * BITMAP_MAX_EDGE, and kept byte-for-byte otherwise — so a PNG you import and
 * never resize is the PNG you get back out, and a 6000px photo does not turn
 * a 40KB document into a 20MB one.
 */
function importImageFile(file,opts){
  opts=opts||{};
  var OK=["image/png","image/jpeg","image/gif","image/webp","image/bmp","image/svg+xml"];
  var looksImage=file&&(String(file.type).indexOf("image/")===0||OK.indexOf(file.type)>=0);
  if(!looksImage){
    showMessage("Import Image","That is not an image file: "+((file&&file.name)||"(none)")+
      "\n\nUse PNG, JPEG, GIF, WebP or BMP.");
    return Promise.resolve(null);
  }
  if(typeof Flashy==="undefined"||!Flashy.Bitmaps){
    showMessage("Import Image","This build has no bitmap support.");
    return Promise.resolve(null);
  }

  return new Promise(function(resolve){
    var reader=new FileReader();
    reader.onerror=function(){showMessage("Import Image","Could not read "+file.name);resolve(null);};
    reader.onload=function(){
      var dataURL=String(reader.result);
      var probe=new Image();
      probe.onerror=function(){
        showMessage("Import Image","Could not decode "+file.name+
          "\n\nTry PNG, JPEG, GIF or WebP.");
        resolve(null);
      };
      probe.onload=function(){
        var nw=probe.naturalWidth||probe.width,nh=probe.naturalHeight||probe.height;
        if(!nw||!nh){
          showMessage("Import Image",file.name+" has no pixels.");
          resolve(null);return;
        }
        var mediaType=file.type||"image/png";
        var url=dataURL,outW=nw,outH=nh;
        var longEdge=Math.max(nw,nh);
        if(longEdge>BITMAP_MAX_EDGE){
          var k=BITMAP_MAX_EDGE/longEdge;
          outW=Math.max(1,Math.round(nw*k));outH=Math.max(1,Math.round(nh*k));
          var cv=document.createElement("canvas");
          cv.width=outW;cv.height=outH;
          cv.getContext("2d").drawImage(probe,0,0,outW,outH);
          // JPEG stays JPEG (a photo re-encoded as PNG balloons); everything
          // else becomes PNG so transparency survives.
          if(mediaType==="image/jpeg"){url=cv.toDataURL("image/jpeg",0.9);}
          else{url=cv.toDataURL("image/png");mediaType="image/png";}
        }
        var name=uniqueBitmapName((file.name||"Bitmap").replace(/\.[^.]+$/,""));
        Flashy.Bitmaps.load(name,url).then(function(img){
          pushUndo();
          doc.bitmaps[name]={
            name:name,mediaType:mediaType,
            data:url.slice(url.indexOf(",")+1),
            width:img.naturalWidth||outW,height:img.naturalHeight||outH
          };
          var placed=opts.place===false?null:placeBitmap(name,opts);
          if(placed)selection=[placed];
          fullRefresh();
          resolve(name);
        })["catch"](function(err){
          showMessage("Import Image","Could not decode "+file.name+":\n"+
            ((err&&err.message)||err));
          resolve(null);
        });
      };
      probe.src=dataURL;
    };
    reader.readAsDataURL(file);
  });
}

/** Remove a bitmap asset and every object that referenced it. */
function deleteBitmapAsset(name){
  pushUndo();
  delete doc.bitmaps[name];
  var scrub=function(layers){
    (layers||[]).forEach(function(l){
      l.keyframes.forEach(function(kf){
        kf.objects=kf.objects.filter(function(o){
          return !(o.type==="bitmap"&&o.bitmapAsset===name);
        });
      });
    });
  };
  scrub(doc.layers);
  Object.keys(doc.library).forEach(function(k){
    if(doc.library[k]&&doc.library[k].layers)scrub(doc.library[k].layers);
  });
  selection=selection.filter(function(o){
    return !(o.type==="bitmap"&&o.bitmapAsset===name);
  });
  if(typeof Flashy!=="undefined"&&Flashy.Bitmaps)Flashy.Bitmaps.remove(name);
  fullRefresh();
}

/* ------------------------------------------------------------------ *
 * Trace Bitmap
 *
 * Converting a raster image into editable vector shapes. The work is in
 * flashy-trace.js (pure, no DOM, no editor); everything here is about getting
 * pixels out of a placed bitmap, turning the tracer's output into ordinary
 * EditorObjects, and putting them where the bitmap was.
 *
 * What lands is nothing special: plain filled `path` objects on the same
 * layer and frame, each with its own fill colour. Select one and recolour it,
 * delete the ones you did not want, convert the lot to a symbol. That is the
 * whole point of tracing rather than placing — the result has to be editable
 * art, not a different kind of image.
 * ------------------------------------------------------------------ */

/** Default trace settings, shared by the dialog and the seam. */
function traceDefaults(){
  var d=(window.FlashyTrace&&FlashyTrace.DEFAULTS)||{};
  return {
    colorThreshold:d.colorThreshold!=null?d.colorThreshold:100,
    minArea:d.minArea!=null?d.minArea:8,
    curveFit:d.curveFit||"normal",
    cornerThreshold:d.cornerThreshold||"normal"
  };
}

/** The bitmap object the trace commands act on: the selected one, if any. */
function selectedBitmap(){
  for(var i=0;i<selection.length;i++){
    if(selection[i].type==="bitmap"&&selection[i].bitmapAsset)return selection[i];
  }
  return null;
}

/**
 * Pixels for a bitmap object, at a size the tracer can work through.
 *
 * Returns `{imageData, scale}` where `scale` converts traced coordinates back
 * into the object's own space: the tracer may have seen a downscaled copy, and
 * the object may be displayed at a size other than the asset's natural one.
 */
function bitmapPixels(obj,maxEdge){
  var img=bitmapImage(obj.bitmapAsset);
  if(!img)return null;
  var nw=img.naturalWidth||img.width,nh=img.naturalHeight||img.height;
  if(!nw||!nh)return null;
  // Trace at the natural resolution, capped — but never above the size the
  // object is actually drawn at, since detail finer than that is invisible.
  var target=Math.min(nw,Math.max(1,Math.abs(obj.width)||nw));
  var k=Math.min(1,(maxEdge||TRACE_MAX_EDGE)/Math.max(nw,nh),target/nw);
  var w=Math.max(1,Math.round(nw*k)),h=Math.max(1,Math.round(nh*k));
  var cv=document.createElement("canvas");
  cv.width=w;cv.height=h;
  var cx=cv.getContext("2d",{willReadFrequently:true});
  cx.imageSmoothingEnabled=true;
  cx.drawImage(img,0,0,nw,nh,0,0,w,h);
  return {
    imageData:cx.getImageData(0,0,w,h),
    // Traced coords are in the downscaled copy's space; this maps them onto
    // the object's displayed box.
    scaleX:(obj.width||nw)/w,
    scaleY:(obj.height||nh)/h,
    width:w,height:h
  };
}

/** Run the tracer over a bitmap object. Returns the tracer's result, or null. */
function traceBitmapPixels(obj,opts,maxEdge){
  if(!window.FlashyTrace)return null;
  var px=bitmapPixels(obj,maxEdge);
  if(!px)return null;
  // The tracer scales uniformly, so trace in pixel space and stretch the
  // finished paths; a non-uniform object box would otherwise skew minArea.
  var res=FlashyTrace.trace(px.imageData,{
    colorThreshold:opts.colorThreshold,
    minArea:opts.minArea,
    curveFit:opts.curveFit,
    cornerThreshold:opts.cornerThreshold
  });
  res.scaleX=px.scaleX;res.scaleY=px.scaleY;
  res.traceWidth=px.width;res.traceHeight=px.height;
  return res;
}

/**
 * Trace a placed bitmap and put the vector shapes on the timeline.
 *
 * `replace` removes the bitmap object afterwards, which is what Flash does —
 * but it is a choice, because keeping the original underneath to compare
 * against is exactly what you want on the first few attempts.
 *
 * Returns `{shapes, regions, colors, objects}` so the dialog and the specs can
 * report what happened without re-deriving it.
 */
function traceBitmapObject(obj,opts){
  opts=opts||{};
  var settings=traceDefaults();
  ["colorThreshold","minArea","curveFit","cornerThreshold"].forEach(function(k){
    if(opts[k]!=null)settings[k]=opts[k];
  });
  if(!obj||obj.type!=="bitmap")return null;
  var res=traceBitmapPixels(obj,settings);
  if(!res||!res.shapes.length)return null;

  var kf=CKF();
  if(!kf){var l=CL();if(l)kf=l.insertKeyframe(curFrame);}
  if(!kf)return null;

  var idx=kf.objects.indexOf(obj);
  if(idx<0)idx=kf.objects.length;
  // The bitmap's own top-left in stage space. `width`/`height` may be
  // negative if it was flipped by a drag, so normalise.
  var ox=Math.min(obj.x,obj.x+obj.width),oy=Math.min(obj.y,obj.y+obj.height);

  var made=[];
  res.shapes.forEach(function(sh){
    // Tracer space -> object box -> stage.
    var p=FlashyTrace.pathTransform(sh.path,res.scaleX,res.scaleY,0,0);
    var b=FlashyTrace.pathBounds(p);
    if(!(b.width>0)&&!(b.height>0))return;
    // Store object-local, bounding box at (0,0) — the same convention the
    // pencil uses, so selection, moving and getBounds all work unchanged.
    var local=FlashyTrace.pathTransform(p,1,1,-b.x,-b.y);
    var o=new EditorObject("path");
    o.path=local;
    o.pathW=b.width;o.pathH=b.height;
    o.x=ox+b.x;o.y=oy+b.y;
    o.width=b.width;o.height=b.height;
    o.fillColor=sh.color;
    o.fillType="solid";o.fillAlpha=1;
    // Pure fills, no outline: Flash's trace produces filled regions, and a
    // default 1px black stroke on every one of two hundred shapes is a mess
    // you then have to undo by hand.
    o.strokeStyle="none";o.strokeWidth=0;
    o.name="Trace "+(made.length+1);
    made.push(o);
  });
  if(!made.length)return null;

  pushUndo();
  /* Splice in at the bitmap's own depth, so the trace inherits it instead of
     jumping to the front of the layer.
     When the bitmap is kept it has to end up BEHIND the trace — the whole
     reason to keep it is to compare the two, and later in the array means
     painted later, so inserting at `idx` would hide the trace under the image
     it came from. */
  var insertAt=opts.replace===false?idx+1:idx;
  Array.prototype.splice.apply(kf.objects,[insertAt,0].concat(made));
  if(opts.replace!==false){
    var at=kf.objects.indexOf(obj);
    if(at>=0)kf.objects.splice(at,1);
  }
  selection=made.slice();
  fullRefresh();
  return {
    shapes:made.length,regions:res.regions,colors:res.colors,
    objects:made
  };
}

/**
 * Trace Bitmap.
 *
 * The four settings do not have intuitions attached to them — nobody knows
 * what "Minimum Area 8" looks like — so the dialog traces as you type and
 * shows the result next to the original. In Flash you guessed, pressed OK,
 * looked, undid, and guessed again; the preview is the whole difference
 * between a usable feature and a lottery.
 *
 * The preview traces a smaller copy than OK will, so it stays responsive; the
 * shape and colour counts it reports are therefore close rather than exact,
 * and it says so.
 */
function showTraceBitmapDialog(){
  if(!window.FlashyTrace){
    showMessage("Trace Bitmap","This build is missing flashy-trace.js, so there is nothing to trace with.");
    return;
  }
  var obj=selectedBitmap();
  if(!obj){
    var any=Object.keys(doc.bitmaps||{}).length;
    showMessage("Trace Bitmap",
      any
        ? "Select a bitmap on the stage first.\n\nClick the image you want to trace — Trace Bitmap works on a placed bitmap, not on a library asset."
        : "There are no images in this document yet.\n\nFile ▸ Import Image…, or drop an image file onto the stage, then select it and try again.");
    return;
  }
  if(!bitmapImage(obj.bitmapAsset)){
    showMessage("Trace Bitmap","“"+obj.bitmapAsset+"” has not finished decoding yet. Try again in a moment.");
    return;
  }

  var d=traceDefaults();
  var preview=null,previewCtx=null,readout=null;
  var pending=null,lastRes=null;

  var read=function(vals){
    return {
      colorThreshold:Math.max(1,Math.min(500,parseInt(vals.ct,10)||d.colorThreshold)),
      minArea:Math.max(1,Math.min(1000,parseInt(vals.ma,10)||d.minArea)),
      curveFit:vals.cf,
      cornerThreshold:vals.cr
    };
  };

  /* Debounced: dragging a number field fires per keystroke and a trace is
     tens of milliseconds, which is long enough to make typing feel sticky. */
  var schedule=function(getVals){
    if(pending)clearTimeout(pending);
    pending=setTimeout(function(){pending=null;runPreview(getVals());},120);
  };

  var runPreview=function(vals){
    if(!preview)return;
    var opts=read(vals);
    var pw=preview.width,ph=preview.height;
    previewCtx.clearRect(0,0,pw,ph);
    var res;
    try{
      // Half the normal cap: this runs on every keystroke.
      res=traceBitmapPixels(obj,opts,Math.round(TRACE_MAX_EDGE/2));
    }catch(err){
      readout.textContent="Could not trace this image: "+((err&&err.message)||err);
      return;
    }
    lastRes=res;
    if(!res||!res.shapes.length){
      readout.textContent="Nothing to trace at these settings — try a lower Minimum Area.";
      return;
    }
    // Fit the traced artwork into the preview box.
    var k=Math.min(pw/res.traceWidth,ph/res.traceHeight);
    var dx=(pw-res.traceWidth*k)/2,dy=(ph-res.traceHeight*k)/2;
    previewCtx.save();
    previewCtx.translate(dx,dy);
    previewCtx.scale(k,k);
    for(var i=0;i<res.shapes.length;i++){
      previewCtx.beginPath();
      FlashyTrace.pathToContext(res.shapes[i].path,previewCtx);
      previewCtx.fillStyle=res.shapes[i].color;
      previewCtx.fill("evenodd");
    }
    previewCtx.restore();
    readout.textContent=res.shapes.length+" shape"+(res.shapes.length===1?"":"s")+
      ", "+res.colors+" colour"+(res.colors===1?"":"s")+
      " — preview is traced at reduced size, so the final count will differ a little.";
  };

  showDialog({
    title:"Trace Bitmap",
    message:"Converting “"+obj.bitmapAsset+"” into editable vector shapes.",
    okLabel:"Trace",
    fields:[
      {name:"ct",label:"Color threshold",type:"number",value:d.colorThreshold,min:1,max:500,
       hint:"1–500. How far apart two colours must be to stay separate. High lumps "+
            "broad ranges together for a simpler graphic; low (1–10) keeps fine "+
            "variation and stays closer to the original."},
      {name:"ma",label:"Minimum area",type:"number",value:d.minArea,min:1,max:1000,
       hint:"1–1000 pixels. The smallest region that keeps its own colour; anything "+
            "smaller is absorbed by its neighbour. Higher is cleaner and more "+
            "generalised; 1 captures fine, intricate detail."},
      {name:"cf",label:"Curve fit",type:"select",value:d.curveFit,
       options:FlashyTrace.CURVE_FITS,
       hint:"How smoothly outlines are drawn, from Pixels (the staircase, kept "+
            "exactly) to Very Smooth (clean flowing curves)."},
      {name:"cr",label:"Corner threshold",type:"select",value:d.cornerThreshold,
       options:FlashyTrace.CORNER_THRESHOLDS,
       hint:"Whether sharp corners are retained or rounded out. Many Corners keeps "+
            "them; Few Corners rounds all but the sharpest into the curve."},
      {name:"keep",label:"Keep bitmap",type:"checkbox",value:false,
       hint:"Leave the original image on the stage underneath the trace, to compare "+
            "against. Off replaces it, as Flash does."}
    ],
    build:function(body,inputs){
      var wrap=document.createElement("div");
      wrap.className="fy-trace-preview";

      var mk=function(label){
        var cell=document.createElement("div");
        cell.className="fy-trace-cell";
        var cap=document.createElement("div");
        cap.className="fy-trace-cap";
        cap.textContent=label;
        var cv=document.createElement("canvas");
        cv.width=200;cv.height=150;
        cell.appendChild(cap);cell.appendChild(cv);
        wrap.appendChild(cell);
        return cv;
      };

      var src=mk("Original");
      preview=mk("Traced");
      previewCtx=preview.getContext("2d");

      // The original, letterboxed the same way as the trace so the two line up.
      var img=bitmapImage(obj.bitmapAsset);
      if(img){
        var sc=src.getContext("2d");
        var nw=img.naturalWidth||img.width,nh=img.naturalHeight||img.height;
        var k=Math.min(src.width/nw,src.height/nh);
        sc.drawImage(img,0,0,nw,nh,(src.width-nw*k)/2,(src.height-nh*k)/2,nw*k,nh*k);
      }
      body.appendChild(wrap);

      readout=document.createElement("div");
      readout.className="fy-dialog-hint fy-trace-readout";
      readout.textContent="Tracing…";
      body.appendChild(readout);

      var vals=function(){
        var v={};
        Object.keys(inputs).forEach(function(k){v[k]=fieldValue(inputs[k]);});
        return v;
      };
      ["ct","ma","cf","cr"].forEach(function(k){
        inputs[k].addEventListener("input",function(){schedule(vals);});
        inputs[k].addEventListener("change",function(){schedule(vals);});
      });
      // First pass after the dialog is on screen, so it paints rather than
      // blocking the open.
      setTimeout(function(){runPreview(vals());},0);
    },
    onCancel:function(){if(pending)clearTimeout(pending);},
    onOk:function(v){
      if(pending)clearTimeout(pending);
      var opts=read(v);
      opts.replace=!v.keep;
      var res=traceBitmapObject(obj,opts);
      if(!res){
        showMessage("Trace Bitmap",
          "That produced no shapes.\n\nMinimum Area may be larger than anything in "+
          "the image — try a smaller value.");
        return;
      }
      showMessage("Trace Bitmap",
        "Traced into "+res.shapes+" shape"+(res.shapes===1?"":"s")+
        " across "+res.colors+" colour"+(res.colors===1?"":"s")+".\n\n"+
        "They are ordinary filled paths on this frame and are all selected: "+
        "recolour them, delete the ones you do not want, or Modify ▸ Convert "+
        "to Symbol to make the lot reusable.");
    }
  });
}

/**
 * Swap the image behind a placed bitmap, keeping its position and size — the
 * bitmap counterpart of Swap Symbol, and the reason an asset is referenced by
 * name rather than embedded in the object.
 */
function showSwapBitmapDialog(){
  var obj=selectedBitmap();
  if(!obj){
    showMessage("Swap Bitmap","Select a bitmap on the stage first.");
    return;
  }
  var names=Object.keys(doc.bitmaps||{});
  if(names.length<2){
    showMessage("Swap Bitmap",
      "There is only one image in this document.\n\nImport another with "+
      "File ▸ Import Image… first.");
    return;
  }
  showDialog({
    title:"Swap Bitmap",
    message:"Replace the image behind this instance. Position and size are kept.",
    okLabel:"Swap",
    fields:[
      {name:"asset",label:"Image",type:"select",value:obj.bitmapAsset,
       options:names.map(function(n){
         var a=doc.bitmaps[n];
         return [n,n+(a&&a.width?"  ("+a.width+"×"+a.height+")":"")];
       })},
      {name:"resize",label:"Reset size",type:"checkbox",value:false,
       hint:"Resize the instance to the new image's own dimensions instead of "+
            "stretching it into the current box."}
    ],
    onOk:function(v){
      var a=doc.bitmaps[v.asset];
      if(!a)return;
      pushUndo();
      obj.bitmapAsset=v.asset;
      if(v.resize&&a.width&&a.height){obj.width=a.width;obj.height=a.height;}
      decodeBitmap(v.asset);
      fullRefresh();
    }
  });
}

/* ------------------------------------------------------------------ *
 * Eraser
 *
 * Erasing vector art is a boolean subtraction and erasing a bitmap is a
 * stencil, and the tool hides that difference: you drag, and whatever is under
 * the brush on the current layer goes away.
 *
 * A shape comes back as a `path` — the same editable filled outline the
 * tracer produces — because that is what a rectangle with a bite out of it
 * *is*. Erasing through the middle of one splits it into two objects you can
 * then move apart. A drawn line is cut rather than subtracted, so the pieces
 * are still lines you can restyle. A bitmap keeps all its pixels and gains a
 * mask, so erasing it is reversible and costs no memory worth counting.
 *
 * The geometry is in flashy-geom.js; everything here is about getting each
 * object's artwork into stage space, handing it over, and turning what comes
 * back into objects again.
 * ------------------------------------------------------------------ */

var eraserSize=24;        // diameter, in stage units
var eraserShape="round";  // "round" | "square"
var ERASER_MIN=2,ERASER_MAX=400;
/* Curve flattening tolerance when a path is handed to the boolean, in stage
   units. A twentieth of a pixel is far below what any display resolves and
   keeps a traced outline's curves from visibly faceting when it is erased. */
var ERASE_FLATTEN=0.05;

function setEraserSize(v){
  eraserSize=Math.max(ERASER_MIN,Math.min(ERASER_MAX,Math.round(v)||ERASER_MIN));
  updateEraserUI();
  if(curTool==="eraser")render();
}
function setEraserShape(s){
  eraserShape=s==="square"?"square":"round";
  updateEraserUI();
  if(curTool==="eraser")render();
}

// --- transforms -----------------------------------------------------
// A 2D affine as [a,b,c,d,e,f]: x' = a·x + c·y + e, y' = b·x + d·y + f —
// the same six numbers ctx.setTransform takes, in the same order.

function matMul(m,n){
  return [
    m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1],
    m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3],
    m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]
  ];
}
function matInvert(m){
  var det=m[0]*m[3]-m[1]*m[2];
  if(!isFinite(det)||Math.abs(det)<1e-12)return null;
  var a=m[3]/det,b=-m[1]/det,c=-m[2]/det,d=m[0]/det;
  return [a,b,c,d,-(a*m[4]+c*m[5]),-(b*m[4]+d*m[5])];
}
function matApplyLoops(m,loops){
  return loops.map(function(l){
    var o=new Array(l.length);
    for(var i=0;i<l.length;i+=2){
      o[i]=m[0]*l[i]+m[2]*l[i+1]+m[4];
      o[i+1]=m[1]*l[i]+m[3]*l[i+1]+m[5];
    }
    return o;
  });
}

/**
 * Object-local artwork space -> stage.
 *
 * Mirrors paintObj exactly, including that it does NOT apply skew to ordinary
 * objects (only rig parts take the pivot path, and those are skipped here).
 * Local coordinates are centred: the artwork spans -w/2..w/2.
 */
function objMatrix(o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  var m=[1,0,0,1,(o.x||0)+hw,(o.y||0)+hh];
  if(o.rotation){
    var r=o.rotation*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);
    m=matMul(m,[cs,sn,-sn,cs,0,0]);
  }
  var sx=o.scaleX||1,sy=o.scaleY||1;
  if(sx!==1||sy!==1)m=matMul(m,[sx,0,0,sy,0,0]);
  return m;
}
/** Where a `path` object's own coordinates live: top-left origin, authored size. */
function pathMatrix(o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  var psx=o.pathW?(o.width/o.pathW):1,psy=o.pathH?(o.height/o.pathH):1;
  return matMul(matMul(objMatrix(o),[1,0,0,1,-hw,-hh]),[psx,0,0,psy,0,0]);
}
/** Where a bitmap's box lives: top-left origin, current displayed size. */
function boxMatrix(o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  return matMul(objMatrix(o),[1,0,0,1,-hw,-hh]);
}

// --- object artwork as polygons ------------------------------------

/** The filled region an object covers, in stage space — or null if it is not
    the kind of thing the eraser subtracts from. */
function objectRegion(o){
  var G=window.FlashyGeom;
  if(!G)return null;
  var hw=Math.abs((o.width||0)/2),hh=Math.abs((o.height||0)/2);
  if(o.type==="rect"){
    return matApplyLoops(objMatrix(o),G.normalize([G.rectLoop(-hw,-hh,hw*2,hh*2)]));
  }
  if(o.type==="oval"){
    return matApplyLoops(objMatrix(o),G.normalize([G.ellipseLoop(0,0,hw,hh)]));
  }
  if(o.type==="path"&&o.path&&o.path.length){
    var m=pathMatrix(o);
    // Flatten in the object's own space but at a tolerance meant for stage
    // space, so a path scaled up 10x is not flattened 10x too coarsely.
    var sc=Math.max(1e-6,Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3]));
    return matApplyLoops(m,G.normalize(G.pathToLoops(o.path,ERASE_FLATTEN/sc)));
  }
  if(o.type==="brush"&&o.points&&o.points.length>=4){
    // A brush stroke is drawn as a thick round-capped line, so the region it
    // covers is that line's own swept area.
    var pts=[];
    for(var i=0;i<o.points.length;i+=2)pts.push(o.points[i]-hw,o.points[i+1]-hh);
    var stage=matApplyLoops(objMatrix(o),[pts])[0];
    return G.strokeRegion(stage,Math.max(0.5,(o.strokeWidth||1)*3/2),false);
  }
  return null;
}

/** The polyline a stroke object draws, in stage space — or null. */
function objectPolyline(o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  var pts;
  if(o.type==="line"){
    pts=[-hw,-hh,hw,hh];
  }else if(o.type==="pencil"&&o.points&&o.points.length>=4){
    pts=[];
    for(var i=0;i<o.points.length;i+=2)pts.push(o.points[i]-Math.abs(hw),o.points[i+1]-Math.abs(hh));
  }else return null;
  return matApplyLoops(objMatrix(o),[pts])[0];
}

// --- making objects out of the result ------------------------------

/** Copy the look of `src` onto `dst` without copying its geometry or identity. */
function copyStyle(dst,src){
  ["fillColor","fillAlpha","fillType","strokeColor","strokeAlpha","strokeWidth",
   "strokeStyle","strokeCap","strokeJoin","alpha","blendMode","name"].forEach(function(k){
    dst[k]=src[k];
  });
}

/** One `path` object per connected piece of `region` (stage space). */
function regionToPathObjects(region,src){
  var G=window.FlashyGeom;
  var made=[];
  G.separate(region).forEach(function(piece){
    var b=G.bounds(piece);
    if(!(b.width>0)||!(b.height>0))return;
    var local=G.translateLoops(piece,-b.minX,-b.minY);
    var o=new EditorObject("path");
    copyStyle(o,src);
    // A brush stroke's colour lives in fillColor but it is painted as a
    // stroke; as a filled path it has to become the fill.
    if(src.type==="brush"){o.fillType="solid";o.strokeStyle="none";o.strokeWidth=0;}
    o.path=G.loopsToPath(local);
    o.pathW=b.width;o.pathH=b.height;
    o.x=b.minX;o.y=b.minY;o.width=b.width;o.height=b.height;
    made.push(o);
  });
  return made;
}

/** One `pencil` object per surviving piece of a cut line. */
function polylinesToObjects(pieces,src){
  var made=[];
  pieces.forEach(function(pts){
    if(pts.length<4)return;
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(var i=0;i<pts.length;i+=2){
      if(pts[i]<minX)minX=pts[i];if(pts[i]>maxX)maxX=pts[i];
      if(pts[i+1]<minY)minY=pts[i+1];if(pts[i+1]>maxY)maxY=pts[i+1];
    }
    var o=new EditorObject("pencil");
    copyStyle(o,src);
    o.x=minX;o.y=minY;
    o.width=(maxX-minX)||1;o.height=(maxY-minY)||1;
    o.points=pts.map(function(v,i){return i%2===0?v-minX:v-minY;});
    made.push(o);
  });
  return made;
}

/**
 * Add an erased region to a bitmap's mask.
 *
 * The new region is UNIONED into what is already there, and that is load
 * bearing. The mask is drawn as a clip — the bitmap's box with each erased
 * loop wound backwards — read under the nonzero rule. Simply appending the
 * loops looks like it should work, and does until two strokes overlap: the
 * box contributes +1 and each reversed loop -1, so an area covered twice
 * totals -1, which is nonzero, and the overlap comes back into view. Keeping
 * the stored loops non-overlapping is what makes the clip exact.
 *
 * Unioning also keeps the mask SMALL: twenty overlapping scrubs merge into one
 * blob rather than piling up twenty outlines.
 */
function addBitmapMask(o,stageRegion){
  var G=window.FlashyGeom;
  var inv=matInvert(boxMatrix(o));
  if(!inv)return false;
  var local=G.normalize(matApplyLoops(inv,stageRegion));
  var w=Math.abs(o.width)||1,h=Math.abs(o.height)||1;
  var existing=[];
  if(o.eraseMask&&o.eraseMask.length){
    var sx=o.maskW?w/o.maskW:1,sy=o.maskH?h/o.maskH:1;
    existing=G.normalize(G.scaleLoops(G.pathToLoops(o.eraseMask,ERASE_FLATTEN),sx,sy));
  }
  var merged;
  if(!existing.length){
    merged=local;
  }else{
    merged=G.union(existing,local);
    /* A union can only lie between "the bigger of the two" and "both added
       together". Anything outside that means the boolean tripped over the two
       freehand outlines, and showing the new stroke alone is a far better
       failure than showing a corrupted mask. */
    var ae=G.area(existing),al=G.area(local),am=G.area(merged);
    if(!merged.length||am<Math.max(ae,al)-1||am>ae+al+1)merged=local;
  }
  o.eraseMask=G.loopsToPath(merged);
  o.maskW=w;o.maskH=h;
  return true;
}

/** Is any of this bitmap still showing? */
function bitmapFullyErased(o){
  var G=window.FlashyGeom;
  if(!o.eraseMask||!o.eraseMask.length)return false;
  var w=Math.abs(o.width)||1,h=Math.abs(o.height)||1;
  var sx=o.maskW?w/o.maskW:1,sy=o.maskH?h/o.maskH:1;
  var mask=G.scaleLoops(G.pathToLoops(o.eraseMask,ERASE_FLATTEN),sx,sy);
  var left=G.difference([G.rectLoop(0,0,w,h)],mask);
  return G.area(left)<0.5;
}

/**
 * Erase along `points` (stage space). Returns what happened, so the caller can
 * say something useful rather than leaving a no-op unexplained.
 */
function eraseStroke(points,opts){
  opts=opts||{};
  var G=window.FlashyGeom;
  if(!G||!points||points.length<2)return {erased:0,skipped:0,removed:0};
  var radius=Math.max(0.5,(opts.size!=null?opts.size:eraserSize)/2);
  var region=G.strokeRegion(points,radius,(opts.shape||eraserShape)==="square");
  if(!region.length)return {erased:0,skipped:0,removed:0};

  var layer=CL();
  if(!layer||layer.locked||layer.visible===false){
    return {erased:0,skipped:0,removed:0,locked:true};
  }
  var kf=layer.getKeyframeAt(curFrame);
  if(!kf)return {erased:0,skipped:0,removed:0};

  var rb=G.bounds(region);
  var out=[],erased=0,skipped=0,removed=0,touched=false;
  /* The undo snapshot is taken lazily. snap() serialises the whole document,
     and a stroke that lands on empty stage must not pay for that — the eraser
     is dragged constantly and most of a drag is over nothing. Vector objects
     are rebuilt into `out` rather than edited, so the document still holds the
     pre-stroke state right up until `kf.objects` is replaced below; only a
     bitmap is changed in place, so that one path has to snapshot first. */
  var pre=null;
  var ensurePre=function(){ if(!pre)pre=snap(); };

  for(var i=0;i<kf.objects.length;i++){
    var o=kf.objects[i];
    // Cheap reject first: most of a drawing is nowhere near the brush.
    var ox0=Math.min(o.x,o.x+o.width),ox1=Math.max(o.x,o.x+o.width);
    var oy0=Math.min(o.y,o.y+o.height),oy1=Math.max(o.y,o.y+o.height);
    // A rotated or scaled object's box is bigger than x/y/w/h implies, so pad
    // generously rather than miss one.
    var pad=(o.rotation||(o.scaleX||1)!==1||(o.scaleY||1)!==1)
      ? Math.hypot(ox1-ox0,oy1-oy0) : 0;
    if(ox1+pad<rb.minX||ox0-pad>rb.maxX||oy1+pad<rb.minY||oy0-pad>rb.maxY){
      out.push(o);continue;
    }
    /* Symbols, text and rig parts are left alone, the way Flash leaves a group
       alone: there is a right way to erase inside one (open it, or break it
       apart) and silently rewriting it from out here is not it. */
    if(o.type==="symbol"||o.type==="text"||isRigPart(o)){
      out.push(o);skipped++;continue;
    }
    if(o.type==="bitmap"){
      ensurePre();
      if(addBitmapMask(o,region)){
        touched=true;
        if(bitmapFullyErased(o)){removed++;continue;}
        erased++;
      }
      out.push(o);continue;
    }
    if(o.type==="pencil"||o.type==="line"){
      var line=objectPolyline(o);
      if(!line){out.push(o);continue;}
      var pieces=G.cutPolyline(line,region);
      if(pieces.length===1&&pieces[0].length===line.length){out.push(o);continue;}
      touched=true;
      if(!pieces.length){removed++;continue;}
      erased++;
      polylinesToObjects(pieces,o).forEach(function(p){out.push(p);});
      continue;
    }
    var reg=objectRegion(o);
    if(!reg||!reg.length){out.push(o);continue;}
    var left=G.difference(reg,region);
    if(!left.length){touched=true;removed++;continue;}
    // Unchanged area means the brush passed by without overlapping.
    if(Math.abs(G.area(left)-G.area(reg))<0.01){out.push(o);continue;}
    touched=true;erased++;
    regionToPathObjects(left,o).forEach(function(p){out.push(p);});
  }

  if(!touched)return {erased:0,skipped:skipped,removed:0};
  // One undo step per stroke, holding the state from before it began.
  ensurePre();
  pushUndoSnap(pre);
  kf.objects=out;
  selection=[];
  return {erased:erased,skipped:skipped,removed:removed};
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
    /* Brush size on the bracket keys, as in every other drawing application.
       Only while the eraser is actually the active tool — jumping tools out
       from under someone who is mid-drawing would be worse than the keys
       doing nothing. Tested before the Ctrl shortcuts because neither key
       takes a modifier. */
    if(!ctrl&&curTool==="eraser"&&(e.key==="["||e.key==="]")){
      e.preventDefault();
      var step=Math.max(1,Math.round(eraserSize*0.25));
      setEraserSize(eraserSize+(e.key==="]"?step:-step));
      return;
    }
    if(ctrl&&e.key==="z"){e.preventDefault();doAction("undo");return;}
    if(ctrl&&e.key==="y"){e.preventDefault();doAction("redo");return;}
    if(ctrl&&e.key==="s"){e.preventDefault();doAction("save");return;}
    if(ctrl&&e.key==="a"){e.preventDefault();doAction("selectAll");return;}
    // Frame clipboard first: Ctrl+Alt+C would otherwise be caught by the
    // object Copy below and silently do the wrong thing.
    if(ctrl&&e.altKey&&(e.key==="x"||e.key==="X")){e.preventDefault();doAction("cutFrames");return;}
    if(ctrl&&e.altKey&&(e.key==="c"||e.key==="C")){e.preventDefault();doAction("copyFrames");return;}
    if(ctrl&&e.altKey&&(e.key==="v"||e.key==="V")){e.preventDefault();doAction("pasteFrames");return;}
    if(ctrl&&!e.altKey&&e.key==="x"){e.preventDefault();doAction("cut");return;}
    if(ctrl&&!e.altKey&&e.key==="c"){e.preventDefault();doAction("copy");return;}
    if(ctrl&&!e.altKey&&e.key==="v"){e.preventDefault();doAction("paste");return;}
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
/**
 * Raster assets. Encoded bytes and natural size only — the decoded image is
 * rebuilt by Flashy.Bitmaps on load, for the same reason sounds do not cache
 * their waveform.
 */
function serializeBitmaps(bitmaps){
  var out={};
  Object.keys(bitmaps||{}).forEach(function(name){
    var a=bitmaps[name];
    if(!a||!a.data)return;
    out[name]={name:name,mediaType:a.mediaType||"image/png",data:a.data,
               width:a.width||0,height:a.height||0};
  });
  return out;
}
/* Reviving is the same normalise-and-drop-the-junk pass as serialising: a
   bitmap asset is plain data with no prototype to restore, unlike a Layer or
   an EditorObject. Sounds have the same shape and keep two identical copies of
   it; one is enough. */
function reviveBitmaps(bitmaps){return serializeBitmaps(bitmaps);}
function serializeDoc(){
  return{
    width:doc.width,height:doc.height,fps:doc.fps,
    backgroundColor:doc.backgroundColor,
    totalFrames:doc.totalFrames,
    layers:serializeLayers(doc.layers),
    library:serializeLibrary(doc.library),
    // Audio travels inside the document, so a .flashy stays one file.
    sounds:serializeSounds(doc.sounds),
    // …and so do images, for the same reason.
    bitmaps:serializeBitmaps(doc.bitmaps),
    // Character rigs: the templates and pose libraries. The hierarchy and
    // current pose ride along on the keyframe objects themselves.
    characters:serializeCharacters(doc.characters)
  };
}
function serializeCharacters(cs){
  var out={};
  Object.keys(cs||{}).forEach(function(n){
    var c=cs[n];
    out[n]={
      name:c.name||n,
      parts:(c.parts||[]).map(plainObj),
      poses:JSON.parse(JSON.stringify(c.poses||{}))
    };
  });
  return out;
}
function reviveCharacters(cd){
  var out={};
  Object.keys(cd||{}).forEach(function(n){
    var c=cd[n]||{};
    out[n]={
      name:c.name||n,
      parts:(c.parts||[]).map(function(t){return plainObj(t||{});}),
      poses:c.poses&&typeof c.poses==="object"?c.poses:{}
    };
  });
  return out;
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
  doc.bitmaps=reviveBitmaps(d.bitmaps);
  doc.characters=reviveCharacters(d.characters);
  doc.layers=reviveLayers(d.layers);
  // Decoding is async; the timeline draws flat bars until the peaks land and
  // redraws itself when they do. Bitmaps are the same deal — a placed image
  // draws a labelled frame until its pixels arrive.
  decodeAllAssets();
  decodeAllBitmaps();
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

  /* ---- Character rigs -------------------------------------------- *
   * The same composition the editor uses:
   *   translate(pivot) · rotate · scale · translate(-pivot)
   * per ancestor and then per part, in one shared space. Expressed here as
   * two nested containers per part — an outer one carrying translate+rotate+
   * scale and an inner one carrying -pivot — so the export composes exactly
   * rather than approximating a baked matrix.
   * ----------------------------------------------------------------- */
  var RIG_MAX_DEPTH = 24;

  function isRigPart(o) { return !!(o && o.rigChar && o.rigPart); }

  function rigPivot(o) {
    var hw = (o.width || 0) / 2, hh = (o.height || 0) / 2;
    return {
      x: (o.x || 0) + (o.pivotX != null ? o.pivotX : hw),
      y: (o.y || 0) + (o.pivotY != null ? o.pivotY : hh)
    };
  }

  function rigIndexOf(objects) {
    var byId = {};
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (isRigPart(o)) byId[o.rigChar + "/" + o.rigPart] = o;
    }
    return byId;
  }

  function rigAncestorsOf(o, byId) {
    var out = [], seen = {}, cur = o, guard = 0;
    while (cur && cur.rigParent && guard++ < RIG_MAX_DEPTH) {
      var key = cur.rigChar + "/" + cur.rigParent;
      if (seen[key]) break;
      seen[key] = 1;
      var par = byId[key];
      if (!par) break;
      out.unshift(par);
      cur = par;
    }
    return out;
  }

  /** `{obj, chain, i}` in paint order; non-rig objects keep their order. */
  function rigPlan(objects) {
    var byId = rigIndexOf(objects), firstOf = {}, plan = [], emitted = {}, i;
    for (i = 0; i < objects.length; i++) {
      if (isRigPart(objects[i]) && firstOf[objects[i].rigChar] == null) firstOf[objects[i].rigChar] = i;
    }
    for (i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (!isRigPart(o)) { plan.push({ obj: o, chain: [], i: i }); continue; }
      if (emitted[o.rigChar]) continue;
      emitted[o.rigChar] = 1;
      var parts = [];
      for (var j = 0; j < objects.length; j++) {
        if (isRigPart(objects[j]) && objects[j].rigChar === o.rigChar) parts.push({ q: objects[j], qi: j });
      }
      parts.sort(function (a, b) {
        var az = a.q.rigZ != null ? a.q.rigZ : a.qi, bz = b.q.rigZ != null ? b.q.rigZ : b.qi;
        return az !== bz ? az - bz : a.qi - b.qi;
      });
      for (var k = 0; k < parts.length; k++) {
        plan.push({ obj: parts[k].q, chain: rigAncestorsOf(parts[k].q, byId), i: parts[k].qi });
      }
    }
    return plan;
  }

  /** One part's pivot transform as a container pair. */
  function pivotPair(o) {
    var pv = rigPivot(o);
    var outer = new Flashy.MovieClip();
    outer.x = pv.x; outer.y = pv.y;
    outer.rotation = (o.rotation || 0) * Math.PI / 180;
    outer.scaleX = o.scaleX != null ? o.scaleX : 1;
    outer.scaleY = o.scaleY != null ? o.scaleY : 1;
    var inner = new Flashy.MovieClip();
    inner.x = -pv.x; inner.y = -pv.y;
    outer.addChild(inner);
    return { top: outer, tip: inner };
  }

  /**
   * Add a frame's objects to `container`, composing any rig hierarchy.
   * Every place objects become children goes through this, so a rig works on
   * the root timeline and inside a symbol alike.
   */
  function addPlanned(container, objects, depth, parentFrame, startFrame, keyPrefix) {
    var plan = rigPlan(objects || []);
    for (var n = 0; n < plan.length; n++) {
      var e = plan[n];
      var key = keyPrefix != null ? keyPrefix + ":" + e.i : null;
      var node = buildObj(e.obj, depth, parentFrame, startFrame, key);
      if (!e.chain.length && !isRigPart(e.obj)) { container.addChild(node); continue; }
      // Ancestors outermost first, then the part's own pivot transform.
      var chain = e.chain.concat([e.obj]);
      var top = null, tip = null;
      for (var c = 0; c < chain.length; c++) {
        var pair = pivotPair(chain[c]);
        if (tip) tip.addChild(pair.top); else top = pair.top;
        tip = pair.tip;
      }
      tip.addChild(node);
      container.addChild(top);
    }
  }

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
          addPlanned(this, kids, depth + 1, fr, 1, null);
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
      addPlanned(holder, kids, depth + 1, fr, 1, null);
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
          addPlanned(inner, kids, depth + 1, gf, 1, null);
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
    } else if (o.type === "bitmap") {
      // Pixels are drawn from the shared asset cache, which the preload below
      // fills. An asset that has not landed yet draws nothing and appears when
      // it does, exactly as the soundtrack joins late.
      node = new Flashy.Bitmap(o.bitmapAsset, {
        width: o.width, height: o.height, smoothing: o.smoothing !== false,
        // Erased areas travel with the object; Flashy.Bitmap applies them as
        // a clip, so an erased photo exports erased.
        mask: o.eraseMask && o.eraseMask.length ? o.eraseMask : null,
        maskWidth: o.maskW, maskHeight: o.maskH
      });
      node.x = -hw; node.y = -hh;
      var bwrap = new Flashy.MovieClip();
      bwrap.addChild(node);
      node = bwrap;
    } else {
      node = new Flashy.Shape();
      var g = node.graphics;
      var filled = (o.fillType || "solid") !== "none";
      var stroked = (o.strokeStyle || "solid") !== "none" && (o.strokeWidth || 0) > 0;
      var sa = o.strokeAlpha != null ? o.strokeAlpha : 1;

      if (o.type === "path") {
        /* A traced outline. The command stream is replayed inline rather than
           through FlashyTrace, because this whole function is serialised into
           the export and the tracer is not shipped with it — the encoding is
           four opcodes, and duplicating the reader is cheaper than embedding
           an authoring-time module in every exported cartoon.
           0 moveTo x y · 1 lineTo x y · 2 quadTo cx cy x y · 3 closePath */
        var cmds = o.path;
        if (cmds && cmds.length) {
          var psx = o.pathW ? (o.width / o.pathW) : 1;
          var psy = o.pathH ? (o.height / o.pathH) : 1;
          if (filled) {
            // Even-odd: holes ride along as extra loops in the same path.
            g.beginFill(hex(o.fillColor, "#000"), o.fillAlpha != null ? o.fillAlpha : 1, "evenodd");
          }
          if (stroked) g.lineStyle(o.strokeWidth, hex(o.strokeColor, "#000"), sa);
          var X = function (v) { return v * psx - hw; };
          var Y = function (v) { return v * psy - hh; };
          for (var pi = 0; pi < cmds.length;) {
            var op = cmds[pi];
            if (op === 0) { g.moveTo(X(cmds[pi + 1]), Y(cmds[pi + 2])); pi += 3; }
            else if (op === 1) { g.lineTo(X(cmds[pi + 1]), Y(cmds[pi + 2])); pi += 3; }
            else if (op === 2) {
              g.curveTo(X(cmds[pi + 1]), Y(cmds[pi + 2]), X(cmds[pi + 3]), Y(cmds[pi + 4]));
              pi += 5;
            } else if (op === 3) { g.closePath(); pi += 1; }
            else break;
          }
          if (filled) g.endFill();
        }
      } else if (o.type === "pencil" || o.type === "brush") {
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
    if (isRigPart(o)) {
      // Rotation and scale live on this part's pivot container, exactly as the
      // editor applies applyPivotTransform() before stepping into the object's
      // own frame. Applying them here too would double them.
      node.rotation = 0;
      node.scaleX = 1;
      node.scaleY = 1;
    } else {
      node.rotation = (o.rotation || 0) * Math.PI / 180;
      node.scaleX = o.scaleX || 1;
      node.scaleY = o.scaleY || 1;
    }
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

  /* ---- bitmaps ------------------------------------------------------ *
   * Decode every raster asset the document carries. Like the soundtrack this
   * is async and nothing waits for it: the movie starts, and each image
   * appears on the next repaint after it lands. Holding frame one until a 2MB
   * photo decodes would be the wrong trade for a cartoon that mostly is not
   * the photo.
   * ------------------------------------------------------------------- */
  if (data.bitmaps && Flashy.Bitmaps) {
    Object.keys(data.bitmaps).forEach(function (bn) {
      var ba = data.bitmaps[bn];
      if (!ba || !ba.data) return;
      Flashy.Bitmaps.load(bn, "data:" + (ba.mediaType || "image/png") + ";base64," + ba.data)
        ["catch"](function () { /* one bad asset must not stop the movie */ });
    });
  }

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

          var frameObjs = [];
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
            frameObjs.push(o);
          }
          // Stable identity for stateful symbol instances, so a MovieClip
          // keeps its own playhead and a Button keeps its hover across the
          // root's per-frame rebuild. addPlanned appends the object's index to
          // the prefix, so the key is the same one this loop used to build.
          addPlanned(this, frameObjs, 0, fr, kf.index, li + ":" + kf.index);
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
  // xlink is declared unconditionally: embedded bitmaps carry both `href` and
  // the xlink form, because SVG 1.1 renderers only understand the latter.
  var s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'+
          ' width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">\n';
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
    case "path":
      // fill-rule="evenodd" for the same reason the stage and the export use
      // it: a traced region carries its holes as extra loops.
      if (!o.path||!o.path.length||!window.FlashyTrace) return '';
      var psx = o.pathW ? (o.width/o.pathW) : 1, psy = o.pathH ? (o.height/o.pathH) : 1;
      var pd = FlashyTrace.pathToSVG(FlashyTrace.pathTransform(o.path, psx, psy, -hw, -hh));
      return '<path'+a+' d="'+pd+'" fill="'+fl+'" fill-rule="evenodd" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "bitmap":
      // Embedded as a data URI, so the SVG is as self-contained as the HTML
      // export — a file that needs a sidecar PNG is not an export.
      var burl = bitmapDataURL(o.bitmapAsset);
      if (!burl) return '';
      var clipRef = '';
      var defs = '';
      if (o.eraseMask && o.eraseMask.length && window.FlashyGeom) {
        // A clipPath of the box with each erased loop wound backwards, read
        // under clip-rule nonzero — the same construction as the canvas and
        // the engine use, so all three agree about what is gone.
        var mw = Math.abs(o.width), mh = Math.abs(o.height);
        var msx = o.maskW ? mw / o.maskW : 1, msy = o.maskH ? mh / o.maskH : 1;
        var mloops = FlashyGeom.scaleLoops(FlashyGeom.pathToLoops(o.eraseMask, ERASE_FLATTEN), msx, msy);
        var d = 'M' + (-hw) + ',' + (-hh) + ' h' + mw + ' v' + mh + ' h' + (-mw) + ' Z';
        for (var mi = 0; mi < mloops.length; mi++) {
          var ml = mloops[mi];
          if (ml.length < 6) continue;
          d += ' M' + (ml[ml.length - 2] - hw) + ',' + (ml[ml.length - 1] - hh);
          for (var mk = ml.length - 4; mk >= 0; mk -= 2) d += ' L' + (ml[mk] - hw) + ',' + (ml[mk + 1] - hh);
          d += ' Z';
        }
        var cid = 'fyclip' + (o.id || 0) + '_' + depth;
        defs = '<defs><clipPath id="' + xmlAttr(cid) + '" clip-rule="nonzero">' +
               '<path d="' + xmlAttr(d) + '"/></clipPath></defs>';
        clipRef = ' clip-path="url(#' + xmlAttr(cid) + ')"';
      }
      return '<g'+a+'>'+defs+'<image'+clipRef+' x="'+(-hw)+'" y="'+(-hh)+'" width="'+Math.abs(o.width)+
             '" height="'+Math.abs(o.height)+'" preserveAspectRatio="none"'+
             (o.smoothing===false?' image-rendering="pixelated"':'')+
             ' xlink:href="'+xmlAttr(burl)+'" href="'+xmlAttr(burl)+'"/></g>\n';
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
  // The Character panel rebuilds from the document rather than tracking it, so
  // one notification after every refresh is all it needs. Note this is
  // fullRefresh, not render() — a pose drag calls render() per pointer move and
  // must not rebuild a DOM tree each time.
  emitRigChange();
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
  /* Bitmap and trace seam — what File ▸ Import Image, the drop handlers, the
     Trace Bitmap dialog and the specs all go through. Kept separate from
     _flashyAudio so each asset kind has one obvious entry point. */
  window._flashyBitmap={
    importImageFile:importImageFile,
    deleteBitmapAsset:deleteBitmapAsset,
    place:placeBitmap,
    decode:decodeBitmap,
    assets:function(){return doc.bitmaps;},
    image:bitmapImage,
    dataURL:bitmapDataURL,
    /** The bitmap the trace commands would act on. */
    selected:selectedBitmap,
    /** Trace settings the dialog opens with. */
    defaults:traceDefaults,
    /** Trace without touching the document — what the live preview uses. */
    preview:traceBitmapPixels,
    /** Trace and write the shapes onto the timeline. The menu's entry point. */
    trace:traceBitmapObject,
    maxEdge:function(){return {bitmap:BITMAP_MAX_EDGE,trace:TRACE_MAX_EDGE};}
  };
  /* Eraser seam. `stroke` is the same entry point a drag uses, so a spec
     exercises the real path rather than a parallel one. */
  window._flashyEraser={
    stroke:eraseStroke,
    size:function(){return eraserSize;},
    setSize:setEraserSize,
    shape:function(){return eraserShape;},
    setShape:setEraserShape,
    /** The swept area of a stroke, without touching the document. */
    region:function(points,size,shape){
      return FlashyGeom.strokeRegion(points,Math.max(0.5,(size!=null?size:eraserSize)/2),
        (shape||eraserShape)==="square");
    },
    /** The filled area an object covers, in stage space. */
    objectRegion:objectRegion,
    objectPolyline:objectPolyline,
    maskPath:bitmapMaskPath,
    fullyErased:bitmapFullyErased
  };
  initActionsPanel();
  initUnloadGuard();
  initAIPanel();
  // Character rigs — the panel in character.js drives the editor through this,
  // and the specs use the same entry points a click would.
  window._flashyRig = {
    characters:characters,
    create:createCharacter,
    biped:createBiped,
    bipedParts:function(){return BIPED_PARTS.map(function(p){return p[0];});},
    remove:deleteCharacter,
    addPart:addCharacterPart,
    removePart:removeCharacterPart,
    reparent:reparentCharacterPart,
    nudgeZ:nudgeCharacterPartZ,
    instance:instanceCharacter,
    partsOnStage:charPartsOnStage,
    partById:charPartById,
    sync:syncCharacterFromStage,
    savePose:saveCharacterPose,
    applyPose:applyCharacterPose,
    deletePose:deleteCharacterPose,
    mirrorPose:mirrorCharacterPose,
    mirrorPartner:mirrorPartnerId,
    animate:animateCharacterPoses,
    // Geometry, so the panel and the specs can ask where a joint actually is.
    pivotWorld:function(o){return rigPivotWorld(o,rigIndex((CKF()||{objects:[]}).objects));},
    worldPoint:function(o,lx,ly){return rigWorldPoint(o,rigIndex((CKF()||{objects:[]}).objects),lx,ly);},
    localPoint:function(o,wx,wy){return rigLocalPoint(o,rigIndex((CKF()||{objects:[]}).objects),wx,wy);},
    hitTest:rigHitTest,
    // IK. `solve` is the same entry point a drag uses.
    solve:function(leaf,grab,tx,ty,opts){
      return ikSolve(leaf,rigIndex((CKF()||{objects:[]}).objects),grab,tx,ty,opts);
    },
    chain:function(leaf,bones){
      return ikChain(leaf,rigIndex((CKF()||{objects:[]}).objects),bones)
        .map(function(o){return o.rigPart;});
    },
    poseMode:function(){return poseMode;},
    setPoseMode:setPoseMode,
    bones:function(){return poseBones;},
    setBones:setPoseBones,
    drawPlan:function(){return rigDrawPlan((CKF()||{objects:[]}).objects);},
    isPart:isRigPart,
    fields:RIG_POSE_FIELDS,
    setTool:setTool,
    refresh:function(){syncDirty();fullRefresh();emitRigChange();}
  };

  window._flashyAI = {
    doc: doc,
    currentLayers: currentLayers,
    pushUndo: pushUndo,
    /** An undo snapshot, so a spec can check what one does and does not hold. */
    snapshot: snap,
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
    /** The active tool — the same call a toolbox click makes. */
    curTool: function(){ return curTool; },
    setTool: setTool,
    /** Timeline pixels-per-frame — the timeline is zoomable. */
    tlFrameWidth: function(){ return TL_FW_(); },
    /** Timeline cell selection: a rectangle of layers x frames. */
    tlSelect: function(l0,f0,l1,f1){
      tlSelRange={layerIdx:l0,endLayerIdx:l1!=null?l1:l0,
                  startFrame:f0,endFrame:f1!=null?f1:f0};
      fullRefresh();
      return tlRange();
    },
    tlRange: function(){ return tlRange(); },
    framesToSymbol: createSymbolFromFrames,
    /** Frame clipboard, the same entry points the menu uses. */
    copyFrames: copyFrames,
    cutFrames: cutFrames,
    pasteFrames: pasteFrames,
    hasFrameClipboard: hasFrameClipboard,
    clearSpan: function(layerIndex,f0,f1){
      clearSpan(currentLayers()[layerIndex],f0,f1);
    }
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
