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
function EditorObject(t){this.id=uid();this.type=t;this.x=0;this.y=0;this.width=0;this.height=0;this.rotation=0;this.scaleX=1;this.scaleY=1;this.skewX=0;this.skewY=0;this.alpha=1;this.name="";this.fillColor="#000000";this.fillAlpha=1;this.fillType="solid";this.fillStops=null;this.fillGrad=null;this.strokeColor="#000000";this.strokeAlpha=1;this.strokeWidth=1;this.strokeStyle="solid";this.strokeCap="round";this.strokeJoin="round";this.points=null;this.text="";this.font="Arial";this.fontSize=24;this.fontBold=false;this.fontItalic=false;this.fontUnderline=false;this.textAlign="left";this.lineHeight=1.2;this.symbolName="";this.instanceName="";this.symbolBehavior="movieclip";this.firstFrame=1;this.loopMode="loop";this.blendMode="source-over";this.bitmapAsset="";this.smoothing=true;this.clipScript="";this.path=null;this.pathW=0;this.pathH=0;this.eraseMask=null;this.maskW=0;this.maskH=0;/* Flash 8 filters and the Colour Effect. `filters` is an array of plain spec objects ({type, enabled, …}); `colorEffect` is {mode, …}. Both null by default, and when they are null nothing in the render path allocates. */this.filters=null;this.colorEffect=null;/* Text kinds and field options. `textType` is the big one: a STATIC field is
   drawn and forgotten, a DYNAMIC one has a name so a script can write to it,
   and an INPUT one can be typed into. Without the last two there is no score
   display, no form and no typed-in name. All default to the static behaviour
   every existing document means. */this.textType="static";this.variableName="";this.selectable=false;this.lineType="single";this.letterSpacing=0;this.maxChars=0;this.textBorder=false;this.textBackground=false;this.textBorderColor="#000000";this.textBackgroundColor="#FFFFFF";this.antiAlias="normal";this.renderAsHtml=false;}
EditorObject.prototype.clone=function(){var c=new EditorObject(this.type);var s=this;Object.keys(s).forEach(function(k){var v=s[k];c[k]=Array.isArray(v)?v.slice():v;});/* `children` (a group's contents) holds OBJECTS, so the shallow slice above would hand the copy the originals and every edit to one group would show up in the other. Deep-clone it, the way KeyFrame.clone deep-clones its own object list. */
if(Array.isArray(s.children))c.children=s.children.map(function(k){return k.clone?k.clone():k;});/* `filters` is an array of OBJECTS, so the shallow slice above would hand the copy the same filter specs and editing one object's blur would change the other's. Same bug class as `children`. */if(Array.isArray(s.filters))c.filters=s.filters.map(function(f){return f?JSON.parse(JSON.stringify(f)):f;});if(s.colorEffect)c.colorEffect=JSON.parse(JSON.stringify(s.colorEffect));c.id=uid();return c;};
// `sound` is Flash's model: a sound is attached to a keyframe, not to a layer.
// {asset, sync:"stream"|"event", volume, loop, offset} or null.
/* `labelType` is Flash's three kinds of frame label and they are not
   interchangeable: a NAME is a script target and reaches the export as a
   timeline label; a COMMENT is an authoring note and must not; an ANCHOR is a
   named browser-history point, which is a name with a different icon. Default
   "name", which is what every `label` written before this meant.
   `easeBezier` is a custom easing curve; `rotateDir`/`rotateTimes` make a
   tween spin instead of taking the short way round; `tweenScale` is Flash's
   Scale checkbox. All default to the behaviour documents already have. */
function KeyFrame(i){this.index=i;this.duration=1;this.tweenType="none";this.easing="linear";this.objects=[];this.script="";this.label="";this.labelType="name";this.sound=null;this.easeBezier=null;this.rotateDir="none";this.rotateTimes=1;this.tweenScale=true;this.orientToPath=false;this.shapeHints=null;}
KeyFrame.prototype.clone=function(){var c=new KeyFrame(this.index);c.duration=this.duration;c.tweenType=this.tweenType;c.easing=this.easing;c.objects=this.objects.map(function(o){return o.clone();});c.script=this.script;c.label=this.label;c.labelType=this.labelType||"name";c.sound=this.sound?cloneSound(this.sound):null;c.easeBezier=this.easeBezier?this.easeBezier.slice():null;c.rotateDir=this.rotateDir||"none";c.rotateTimes=this.rotateTimes||1;c.tweenScale=this.tweenScale!==false;c.orientToPath=!!this.orientToPath;c.shapeHints=this.shapeHints?this.shapeHints.map(function(h){return h.slice();}):null;return c;};
function cloneSound(s){
  return {
    asset:s.asset,sync:s.sync||"stream",
    volume:s.volume!=null?s.volume:1,
    loop:!!s.loop,offset:s.offset||0,
    /* The effect, its envelope and the repeat count. `envelope` is an array of
       ARRAYS, so it needs a real copy — a shallow one would have two keyframes
       sharing one curve, which is the trap group children and filter stacks
       each fell into. */
    effect:s.effect||"none",
    envelope:Array.isArray(s.envelope)?s.envelope.map(function(p){return p.slice();}):null,
    repeat:s.repeat!=null?(s.repeat|0):0
  };
}
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
/*
 * Layer visibility is an authoring aid, not a property of the movie: Flash
 * publishes hidden layers, and so does this. Everything that draws the
 * document for the author — the stage, the Library preview — asks
 * layerShows(); everything that produces output renders inside
 * withAllLayers(), which turns the eye off for the duration of one render.
 * The exported runtime does not consult visibility at all, because it has no
 * authoring view to be an aid to.
 *
 * Without this, soloing a layer and forgetting meant exporting one layer's
 * worth of movie, and the hidden state was invisible in the output.
 */
var showingAllLayers=false;

function layerShows(l){
  return !!l&&(showingAllLayers||l.visible!==false);
}

/** Render `fn` with every layer showing, whatever the eyes say. */
function withAllLayers(fn){
  var prev=showingAllLayers;
  showingAllLayers=true;
  try{return fn();}finally{showingAllLayers=prev;}
}

/**
 * Show one layer and hide the rest — of the timeline being edited, so inside
 * a symbol it solos within the symbol, which is where you are working.
 */
function soloLayer(idx){
  var layers=currentLayers();
  if(!layers.length)return;
  pushUndo();
  layers.forEach(function(l,i){l.visible=(i===idx);});
  fullRefresh();
}

function showAllLayers(){
  var layers=currentLayers();
  if(!layers.length)return;
  if(layers.every(function(l){return l.visible!==false;}))return;
  pushUndo();
  layers.forEach(function(l){l.visible=true;});
  fullRefresh();
}

/** True when `idx` is the only layer currently showing. */
function isSoloed(idx){
  var layers=currentLayers();
  return layers.length>1&&layers.every(function(l,i){
    return (i===idx)===(l.visible!==false);
  });
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
function pushUndoSnap(s){
  /* Name the step after whatever caused it. doAction() announces the command
     it is about to run and this picks the name up, so a command added later is
     labelled without anyone having to remember to label it. */
  if(!s.label)s.label=undoLabelFor();
  undoStack.push(s);
  if(undoStack.length>50)undoStack.shift();
  redoStack.length=0;
  touchDoc();
}
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
function doUndo(){
  if(!undoStack.length)return;
  var step=undoStack.pop();
  /* The snapshot pushed onto the redo stack describes the state we are LEAVING
     and must carry the name of the change being undone — otherwise redoing it
     shows a different label from undoing it. */
  var forward=snap();
  forward.label=step.label;
  redoStack.push(forward);
  restoreSnap(step);
  touchDoc();
}
function doRedo(){
  if(!redoStack.length)return;
  var step=redoStack.pop();
  var back=snap();
  back.label=step.label;
  undoStack.push(back);
  restoreSnap(step);
  touchDoc();
}
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
    {label:"Export as SWF...",action:"exportSWF"},
    {type:"sep"},
    {label:"Document Settings...",action:"docSettings"},
    {label:"Publish Settings...",action:"publishSettings"},
    {label:"Publish",action:"publish",shortcut:"Ctrl+F12"},
    {label:"Size Report...",action:"sizeReport"},
    {type:"sep"},
    // No accelerator: Ctrl+R and Ctrl+Shift+R are the browser's reload, which
    // a page cannot reliably intercept. (The Ctrl+R on Import Sound below has
    // never actually been bound for the same reason.)
    {label:"Import Image...",action:"importImage"},
    {label:"Import Sound...",action:"importSound",shortcut:"Ctrl+R"},
    {label:"Import Flash Movie (.swf/.fla)...",action:"importFlash"},
    {label:"Import XFL Folder...",action:"importXFL"},
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
    {label:"Reverse Frames",action:"reverseFrames"},
    {type:"sep"},
    {label:"Copy Motion",action:"copyMotion"},
    {label:"Paste Motion",action:"pasteMotion"},
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
    {label:"Show Rulers",action:"rulers",shortcut:"Ctrl+Alt+Shift+R"},
    {label:"Show Guides",action:"guidesShow"},
    {label:"Clear Guides",action:"guidesClear"},
    {type:"sep"},
    {label:"Snap to Grid",action:"snap"},
    {label:"Snap to Objects",action:"snapObjects"},
    {label:"Snap to Guides",action:"snapGuides"},
    {type:"sep"},
    {label:"Onion Skin",action:"onionToggle",shortcut:"Alt+O"},
    {label:"Onion Skin Outlines",action:"onionOutlines",shortcut:"Alt+Shift+O"},
    {label:"Edit Multiple Frames",action:"editMultiple",shortcut:"Alt+M"},
    {type:"sep"},
    {label:"Hide Other Layers",action:"hideOthers"},
    {label:"Show All Layers",action:"showAllLayers"}
  ]},
  {label:"Insert",items:[
    {label:"New Symbol...",action:"newSymbol",shortcut:"Ctrl+F8"},
    {label:"Keyframe",action:"insKF",shortcut:"F6"},
    {label:"Blank Keyframe",action:"insBlankKF",shortcut:"F7"},
    {label:"Frame",action:"insFrame",shortcut:"F5"},
    {type:"sep"},
    {label:"Layer",action:"addLayer"},
    {label:"Layer Folder",action:"addFolder"},
    {type:"sep"},
    {label:"Scene",action:"addSceneAction"},
    {label:"Duplicate Scene",action:"duplicateScene"},
    {label:"Rename Scene...",action:"renameScene"},
    {label:"Delete Scene...",action:"deleteSceneAction"},
    {label:"Delete Layer",action:"delLayer"},
    {type:"sep"},
    {label:"Collapse All Folders",action:"foldersCollapseAll"},
    {label:"Expand All Folders",action:"foldersExpandAll"}
  ]},
  {label:"Modify",items:[
    {label:"Convert to Symbol...",action:"convertSym",shortcut:"F8"},
    {label:"Convert Frames to Symbol...",action:"framesToSymbol"},
    {type:"sep"},
    {label:"Group",action:"group",shortcut:"Ctrl+G"},
    {label:"Ungroup",action:"ungroup",shortcut:"Ctrl+Shift+G"},
    {label:"Break Apart",action:"breakApart",shortcut:"Ctrl+B"},
    {type:"sep"},
    {label:"Bring to Front",action:"bringFront",shortcut:"Ctrl+Shift+Up"},
    {label:"Bring Forward",action:"bringForward",shortcut:"Ctrl+Up"},
    {label:"Send Backward",action:"sendBackward",shortcut:"Ctrl+Down"},
    {label:"Send to Back",action:"sendBack",shortcut:"Ctrl+Shift+Down"},
    {type:"sep"},
    {label:"Flip Horizontal",action:"flipH"},
    {label:"Flip Vertical",action:"flipV"},
    {label:"Rotate 90° CW",action:"rot90cw"},
    {label:"Rotate 90° CCW",action:"rot90ccw"},
    {label:"Scale and Rotate...",action:"scaleRotate",shortcut:"Ctrl+Alt+S"},
    {label:"Remove Transform",action:"transformReset",shortcut:"Ctrl+Shift+Z"},
    {type:"sep"},
    {label:"Distribute to Layers",action:"distributeToLayers",shortcut:"Ctrl+Shift+D"},
    {type:"sep"},
    {label:"Create Motion Tween",action:"motionTween"},
    {label:"Create Shape Tween",action:"shapeTween"},
    {label:"Remove Tween",action:"removeTween"},
    {type:"sep"},
    {label:"Smooth",action:"shapeSmooth"},
    {label:"Straighten",action:"shapeStraighten"},
    {label:"Optimize...",action:"shapeOptimize"},
    {label:"Convert Lines to Fills",action:"linesToFills"},
    {label:"Add Shape Hint",action:"addShapeHint",shortcut:"Ctrl+Shift+H"},
    {label:"Remove All Shape Hints",action:"removeShapeHints"},
    {label:"Expand Fill...",action:"expandFill"},
    {label:"Soften Fill Edges...",action:"softenEdges"},
    {type:"sep"},
    {label:"Combine: Union",action:"combineUnion"},
    {label:"Combine: Intersect",action:"combineIntersect"},
    {label:"Combine: Punch",action:"combinePunch"},
    {label:"Combine: Crop",action:"combineCrop"},
    {type:"sep"},
    {label:"Trace Bitmap...",action:"traceBitmap"},
    {label:"Swap Bitmap...",action:"swapBitmap"},
    {label:"Swap Symbol...",action:"swapSymbol"},
    {label:"Duplicate Symbol...",action:"duplicateSymbol"},
    {label:"Select Unused Items...",action:"libUnused"},
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
    {label:"Go to Last Frame",action:"gotoLast",shortcut:"End"},
    {type:"sep"},
    {label:"Previous Scene",action:"prevScene",shortcut:"Ctrl+PgUp"},
    {label:"Next Scene",action:"nextScene",shortcut:"Ctrl+PgDn"}
  ]},
  // Window — panel visibility and workspace arrangement. The shortcuts are
  // Flash's own (F9 Actions, Shift+F9 Color Mixer, Ctrl+L Library,
  // Ctrl+F3 Properties) because muscle memory is a migration feature.
  {label:"Window",items:[
    {label:"Properties",action:"winProps",shortcut:"Ctrl+F3"},
    {label:"Color Mixer",action:"winColor",shortcut:"Shift+F9"},
    {label:"Library",action:"winLibrary",shortcut:"Ctrl+L"},
    {label:"Actions",action:"winActions",shortcut:"F9"},
    {label:"Align",action:"winAlign",shortcut:"Ctrl+K"},
    {label:"Info",action:"winInfo",shortcut:"Ctrl+I"},
    {label:"Transform",action:"winTransform",shortcut:"Ctrl+T"},
    {label:"Scene",action:"winScene",shortcut:"Shift+F2"},
    {label:"Output",action:"winOutput",shortcut:"F2"},
    {label:"History",action:"winHistory",shortcut:"Ctrl+F10"},
    {label:"Movie Explorer",action:"winExplorer",shortcut:"Alt+F3"},
    {label:"Behaviors",action:"winBehaviors",shortcut:"Shift+F3"},
    {label:"Color Swatches",action:"winSwatches",shortcut:"Ctrl+F9"},
    {label:"Components...",action:"components",shortcut:"Ctrl+F7"},
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

/* Snapping, rulers and guides.
 *
 * Grid snap was the only snap the editor had, and a grid is the one thing an
 * animator turns off first — artwork lines up with other artwork, not with an
 * arbitrary lattice. `snapObjects` snaps a dragged object's edges and centre
 * to every other object's edges and centres; `snapGuides` snaps to the guides
 * dragged off the rulers. Both report what they matched so the stage can draw
 * the alignment line, which is most of what makes snapping trustworthy. */
var snapObjects=true,snapGuides=true,showRulers=false,showGuides=true;
var SNAP_TOL=6;              // screen pixels, so the feel is zoom-independent
var snapHints=[];            // [{axis:"x"|"y", at:stageCoord}] drawn this frame
var RULER_W=16;              // thickness of the ruler strips, in screen pixels
var guideDrag=null;          // {axis, at} while a guide is being dragged

/* Onion skinning.
 *
 * `onionBefore`/`onionAfter` are frame counts, not a marker range, because a
 * count is what an animator actually thinks in ("show me the last two
 * drawings"). Outline mode draws silhouettes rather than ghosts, which is the
 * only way to read more than two or three overlapping frames at once. */
var onionOn=false,onionOutlines=false,onionBefore=2,onionAfter=1;
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
  /* Subselection on A, which is where Flash put it. The Pose tool held that
     key and has moved to W: Pose is a Flashy invention, Subselection is a tool
     every Flash author's hands already know, and when the two collide the
     migrating hands win. */
  {id:"subselect",label:"Subselection Tool (A) \u2014 drag a point to reshape a drawing",key:"a",svg:'<path d="M3,1 L3,11 L5.5,8.5 L8,12.5 L10,11.5 L7.5,7.5 L11,6.5 Z" fill="none" stroke="currentColor" stroke-width="1"/><rect x="10" y="1" width="3" height="3" fill="currentColor"/>'},
  {id:"pose",label:"Pose Tool (W) \u2014 drag a limb to swing it",key:"w",svg:'<circle cx="4" cy="3" r="2" fill="currentColor"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><line x1="4" y1="3" x2="8" y2="8" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.4"/>'},
  {id:"lasso",label:"Lasso Tool (L) \u2014 select around overlapping artwork",key:"l",svg:'<path d="M7,2 Q12,2 12,5 Q12,8 7,8 Q2,8 2,5 Q2,2 7,2 Z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M4.5,7.6 Q4,11 6,13" fill="none" stroke="currentColor" stroke-width="1.1"/>'},
  {id:"transform",label:"Free Transform (Q)",key:"q",svg:'<rect x="2" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="12" cy="2" r="1.5" fill="currentColor"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'},
  {id:"gradient",label:"Gradient Transform (F) \u2014 drag a gradient's centre, angle and spread",key:"f",svg:'<rect x="2" y="3" width="10" height="8" fill="url(#fyGradIcon)" stroke="currentColor" stroke-width="1"/><defs><linearGradient id="fyGradIcon"><stop offset="0" stop-color="currentColor" stop-opacity="0.15"/><stop offset="1" stop-color="currentColor" stop-opacity="0.9"/></linearGradient></defs>'},
  {id:"text",label:"Text Tool (T)",key:"t",svg:'<text x="3" y="12" font-size="12" font-weight="bold" fill="currentColor">T</text>'},
  {id:"pen",label:"Pen Tool (P) \u2014 click for corners, drag for curves; on a finished path a click adds or removes an anchor, Alt converts one",key:"p",svg:'<path d="M7,1 L10,4 L5,12 L3,13 L4,11 Z" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="1" r="1.2" fill="currentColor"/>'},
  {id:"line",label:"Line Tool (N)",key:"n",svg:'<line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"rect",label:"Rectangle Tool (R)",key:"r",svg:'<rect x="2" y="3" width="10" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  {id:"oval",label:"Oval Tool (O)",key:"o",svg:'<ellipse cx="7" cy="7" rx="5" ry="4" fill="none" stroke="currentColor" stroke-width="1.5"/>'},
  /* No key: Flash stacked PolyStar under the Rectangle tool, so it never had
     one of its own, and P belongs to the Pen. */
  {id:"polystar",label:"PolyStar Tool \u2014 polygons and stars",svg:'<path d="M7,1 L8.8,5.2 L13,5.6 L9.8,8.5 L10.7,12.8 L7,10.6 L3.3,12.8 L4.2,8.5 L1,5.6 L5.2,5.2 Z" fill="none" stroke="currentColor" stroke-width="1"/>'},
  {id:"pencil",label:"Pencil Tool (Y)",key:"y",svg:'<path d="M2,12 L4,10 L10,4 L12,2 L11,3 L5,9 L3,11 Z" fill="none" stroke="currentColor" stroke-width="1"/>'},
  {id:"brush",label:"Brush Tool (B)",key:"b",svg:'<path d="M9,1 Q12,4 8,8 Q6,10 3,13 Q2,12 4,9 Q5,7 6,6 L9,1 Z" fill="currentColor"/>'},
  {id:"eraser",label:"Eraser Tool (E) — erases vector shapes and bitmaps alike",key:"e",svg:'<path d="M5.5,11.5 L1.5,7.5 L7.5,1.5 L11.5,5.5 Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><line x1="3.5" y1="9.5" x2="9.5" y2="3.5" stroke="currentColor" stroke-width="1"/><line x1="1" y1="12.5" x2="13" y2="12.5" stroke="currentColor" stroke-width="1.2"/>'},
  {id:"bucket",label:"Paint Bucket (K)",key:"k",svg:'<path d="M3,5 L7,1 L11,5 L7,9 Z" fill="currentColor" opacity="0.4"/><path d="M2,9 L2,13 L12,13 L12,9 L10,7 L7,10 L4,7 Z" fill="currentColor"/>'},
  {id:"inkbottle",label:"Ink Bottle (S) — click a shape to restyle its stroke",key:"s",svg:'<path d="M5,1 L9,1 L9,4 L11,7 L11,13 L3,13 L3,7 L5,4 Z" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="9" width="6" height="3.5" fill="currentColor"/>'},
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

  /* Tool options, under the tools — where Flash put them. Rebuilt whenever the
     active tool changes rather than built once and hidden: the eraser was the
     only tool with options when this strip arrived, and hard-coding its two
     controls here meant every tool added since had nowhere to put its own. */
  var opts=document.createElement("div");
  opts.id="tool-options";
  opts.className="tool-options";
  tb.appendChild(opts);
  updateToolOptions();
}

/* ------------------------------------------------------------------ *
 * Tool options
 *
 * One declarative spec per tool, rendered into the strip under the toolbox.
 * Every option is live — changing it changes the next stroke, never the
 * current one — which is why nothing here takes an undo snapshot.
 * ------------------------------------------------------------------ */

/** Per-tool settings, each one a plain object the tool reads at use time. */
var polyStar={shape:"polygon",sides:5,point:0.5};
/* Primitive-shape settings, sticky across draws the way Flash's Options panel
   was: set a corner radius once and every rectangle you drag comes out rounded
   until you set it back. The objects store their own copy, so changing the
   tool later does not reshape what is already on the stage. */
var rectPrim={cornerRadius:0};
var ovalPrim={start:0,end:360,inner:0};
var brushSize=12;
var pencilMode="smooth";          // smooth | straighten | ink
var lassoMode="freeform";         // freeform | polygon | wand

function toolOptionSpec(tool){
  if(tool==="eraser"){
    return [
      {type:"label",id:"eraserSizeLabel",text:function(){return eraserSize+" px";}},
      {type:"range",id:"eraserSizeRange",min:ERASER_MIN,max:120,step:1,
       title:"Eraser size — [ and ] change it too",
       get:function(){return Math.min(eraserSize,120);},
       set:function(v){setEraserSize(v);}},
      {type:"choice",title:"Eraser shape",
       options:[["round","●","Round"],["square","■","Square"]],
       get:function(){return eraserShape;},set:setEraserShape}
    ];
  }
  if(tool==="brush"){
    return [
      {type:"label",text:function(){return brushSize+" px";}},
      {type:"range",min:1,max:120,step:1,title:"Brush size — [ and ] change it too",
       get:function(){return brushSize;},
       set:function(v){brushSize=Math.max(1,Math.min(200,v));updateToolOptions();}}
    ];
  }
  if(tool==="pencil"){
    return [
      {type:"label",text:function(){return "Mode";}},
      {type:"choice",title:"What happens to a stroke when you let go",
       options:[["smooth","∿","Smooth — round the stroke out"],
                ["straighten","∧","Straighten — reduce it to straight runs"],
                ["ink","✐","Ink — leave it exactly as drawn"]],
       get:function(){return pencilMode;},
       set:function(v){pencilMode=v;updateToolOptions();}}
    ];
  }
  if(tool==="polystar"){
    return [
      {type:"choice",title:"Polygon or star",
       options:[["polygon","⬠","Polygon"],["star","★","Star"]],
       get:function(){return polyStar.shape;},
       set:function(v){polyStar.shape=v;updateToolOptions();}},
      {type:"label",text:function(){return polyStar.sides+" sides";}},
      {type:"range",min:3,max:32,step:1,title:"Number of sides or points",
       get:function(){return polyStar.sides;},
       set:function(v){polyStar.sides=v;updateToolOptions();}},
      {type:"label",text:function(){
        return polyStar.shape==="star"?"Point "+polyStar.point.toFixed(2):"";
      }},
      {type:"range",min:0.05,max:0.95,step:0.05,title:"Star point size",
       hidden:function(){return polyStar.shape!=="star";},
       get:function(){return polyStar.point;},
       set:function(v){polyStar.point=v;updateToolOptions();}}
    ];
  }
  if(tool==="rect"){
    return [
      {type:"label",text:function(){
        return rectPrim.cornerRadius>0?"Corner "+rectPrim.cornerRadius+" px":"Square corners";
      }},
      {type:"range",min:0,max:60,step:1,title:"Corner radius for new rectangles",
       get:function(){return rectPrim.cornerRadius;},
       set:function(v){rectPrim.cornerRadius=v;updateToolOptions();}}
    ];
  }
  if(tool==="oval"){
    return [
      {type:"label",text:function(){
        if(ovalPrim.start===0&&ovalPrim.end===360)
          return ovalPrim.inner>0?"Donut "+ovalPrim.inner+"%":"Full oval";
        return ovalPrim.start+"° to "+ovalPrim.end+"°";
      }},
      {type:"range",min:0,max:360,step:1,title:"Start angle for new ovals",
       get:function(){return ovalPrim.start;},
       set:function(v){ovalPrim.start=v;updateToolOptions();}},
      {type:"range",min:0,max:360,step:1,title:"End angle for new ovals",
       get:function(){return ovalPrim.end;},
       set:function(v){ovalPrim.end=v;updateToolOptions();}},
      {type:"range",min:0,max:99,step:1,title:"Inner radius, as a percentage",
       get:function(){return ovalPrim.inner;},
       set:function(v){ovalPrim.inner=v;updateToolOptions();}}
    ];
  }
  if(tool==="lasso"){
    return [
      {type:"choice",title:"Lasso mode",
       options:[["freeform","✎","Freeform — draw around what you want"],
                ["polygon","△","Polygon — click corner to corner, double-click to close"],
                ["wand","✨","Magic wand — click to select everything the same colour"]],
       get:function(){return lassoMode;},
       set:function(v){lassoMode=v;updateToolOptions();}}
    ];
  }
  if(tool==="inkbottle"){
    return [
      {type:"label",text:function(){return strokeWidth+" px"; }},
      {type:"range",min:0,max:40,step:0.5,title:"Stroke width the ink bottle applies",
       get:function(){return strokeWidth;},
       set:function(v){strokeWidth=v;updateColorUI();updateToolOptions();}}
    ];
  }
  return null;
}

function updateToolOptions(){
  var box=document.getElementById("tool-options");
  if(!box)return;
  var spec=toolOptionSpec(curTool);
  box.textContent="";
  if(!spec){box.style.display="none";return;}
  box.style.display="";
  spec.forEach(function(it){
    if(it.hidden&&it.hidden())return;
    if(it.type==="label"){
      var text=it.text();
      if(!text)return;
      var d=document.createElement("div");
      d.className="tool-opt-label";
      if(it.id)d.id=it.id;
      d.textContent=text;
      box.appendChild(d);
      return;
    }
    if(it.type==="range"){
      var r=document.createElement("input");
      r.type="range";r.className="tool-opt-range";
      if(it.id)r.id=it.id;
      r.min=it.min;r.max=it.max;r.step=it.step;
      r.value=it.get();
      if(it.title)r.title=it.title;
      r.addEventListener("input",function(){it.set(parseFloat(r.value));});
      box.appendChild(r);
      return;
    }
    if(it.type==="choice"){
      var g=document.createElement("div");
      g.className="tool-opt-shapes";
      var cur=it.get();
      it.options.forEach(function(op){
        var b=document.createElement("button");
        b.type="button";
        b.className="tool-opt-btn"+(op[0]===cur?" active":"");
        b.dataset.shape=op[0];
        b.textContent=op[1];
        b.title=op[2];
        b.addEventListener("click",function(){it.set(op[0]);});
        g.appendChild(b);
      });
      box.appendChild(g);
    }
  });
}

/** Kept for the eraser's bracket keys and setEraserShape, which call it. */
function updateEraserUI(){updateToolOptions();}
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
  updateToolOptions();
  // Leaving the eraser must take its ghost with it.
  if(id!=="eraser"&&eraserHover){eraserHover=null;}
  /* Leaving the Pen mid-path commits what has been drawn so far rather than
     throwing it away, and leaving Subselection drops its anchor handles. Both
     are states that only make sense while their tool is active, and leaving
     them behind would leave the stage drawing handles for a tool nobody is
     using. */
  if(id!=="pen")penCommit();
  if(id!=="subselect")subPoint=null;
  if(id!=="lasso")lassoPts=null;
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
  /* Edit Multiple Frames replaces onion skin while it is on: those frames are
     not references to work FROM any more, they are live and editable, so
     ghosting them would be a lie about what a click will hit. */
  if(editMultiple)drawEditMultiple();
  else if(onionOn)drawOnionSkin();
  // Render layers bottom to top, rigs composed through their hierarchy, and
  // each masked run clipped to the silhouette of the mask above it.
  var groups=maskGroups(currentLayers());
  for(var gi=groups.length-1;gi>=0;gi--){
    var group=groups[gi];
    if(!group.layers.length)continue;
    var clipped=!!group.mask;
    if(clipped){
      ctx.save();
      applyMaskClip(ctx,frameObjects([group.mask],curFrame));
    }
    /* Layer by layer rather than all at once, because a layer in outline
       view is painted differently. Bottom first, the order frameObjects uses
       for a whole group, so splitting it up cannot change what is in front. */
    for(var li=group.layers.length-1;li>=0;li--){
      var lay=group.layers[li];
      if(isFolderLayer(lay))continue;       // a folder holds no artwork
      // The whole layer list stays in scope so a guided layer can find the
      // motion guide above it; drawing one layer at a time is an outline-view
      // and onion-skin requirement, not a change of context.
      var objs=frameObjects([lay],curFrame,{allLayers:currentLayers()});
      if(!objs.length)continue;
      if(lay.outlines){
        drawLayerOutlines(ctx,objs,lay.outlineColor||"#4488CC");
        continue;
      }
      rigDrawPlan(objs).forEach(function(e){
        paintPlanned(ctx,e,{chrome:true});
      });
    }
    if(clipped)ctx.restore();
  }
  // Rig overlay sits above the artwork but inside the stage transform, so the
  // handles track the drawing at any zoom.
  if(curTool==="pose"||(selection.length===1&&isRigPart(selection[0])))drawRigOverlay(ctx);
  // Tool overlays live inside the stage transform so their handles track the
  // artwork at any zoom — the same reason the rig overlay is drawn here.
  if(curTool==="subselect")drawSubselectOverlay(ctx);
  if(curTool==="gradient")drawGradientOverlay(ctx);
  if(curTool==="pen")drawPenOverlay(ctx);
  drawShapeHints(ctx);
  if(lassoPts&&lassoPts.length>=4)drawLassoOverlay(ctx);
  /* Motion guides, stage guides and the snap feedback all draw in STAGE
     coordinates, so they belong inside the stage transform with the other
     overlays. They used to run after it was popped, which put them in screen
     space — at any normal pan they landed off the left of the stage and were
     clipped away entirely, which is why a motion guide layer looked empty. */
  drawMotionGuides();
  if(showGuides)drawGuides();
  drawSnapHints();
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
  if(showRulers)drawRulers();
  // selection handles
  selection.forEach(function(o){drawSel(o);});
  // tool preview
  if(dragging&&dragPreview)drawPrev();
  drawEraserGhost();
}

/* ------------------------------------------------------------------ *
 * Onion skinning
 *
 * Draws the frames around the current one, faded, under the live drawing.
 * Hidden and locked-out layers are skipped the same way the live render skips
 * them, so turning onion skin on never shows you something the stage does not.
 *
 * Ghost mode paints the real artwork through a reduced globalAlpha (which
 * composes with each object's own alpha, so a half-transparent shape ghosts
 * half as strongly — correct). Outline mode strokes silhouettes instead,
 * because past about three overlapping ghosts the stage turns to mud.
 * ------------------------------------------------------------------ */
function drawOnionSkin(){
  var layers=currentLayers().filter(layerShows).filter(function(l){
    // A guide layer is reference art that is already permanently visible;
    // ghosting it would double every line on the stage.
    return (l.layerType||"normal")!=="guide";
  });
  if(!layers.length)return;
  var frames=[];
  for(var d=onionBefore;d>=1;d--)if(curFrame-d>=1)frames.push({f:curFrame-d,d:d,past:true});
  for(var a=1;a<=onionAfter;a++)if(curFrame+a<=currentMaxFrame())frames.push({f:curFrame+a,d:a,past:false});
  frames.forEach(function(e){
    // Nearest neighbour is the one you are matching against, so it is the
    // strongest; each step out halves again.
    var strength=0.38/Math.pow(1.6,e.d-1);
    var objs=frameObjects(layers,e.f);
    if(!objs.length)return;
    ctx.save();
    if(onionOutlines){
      ctx.strokeStyle=e.past?"rgba(80,110,220,"+(strength+0.3)+")":"rgba(220,90,70,"+(strength+0.3)+")";
      ctx.lineWidth=1/zoom;
      objs.forEach(function(o){
        ctx.beginPath();
        addObjectOutline(ctx,o);
        ctx.stroke();
      });
    }else{
      ctx.globalAlpha=strength;
      rigDrawPlan(objs).forEach(function(en){paintPlanned(ctx,en,{});});
    }
    ctx.restore();
  });
}

/**
 * A layer drawn as outlines, in the layer's own colour.
 *
 * This is what `outlineColor` was always for. Seeing a layer as outlines is
 * how you work on what is underneath it without hiding it — and giving each
 * layer its own colour is how you tell three of them apart.
 */
function drawLayerOutlines(cx,objs,colour){
  cx.save();
  cx.strokeStyle=colour;
  cx.lineWidth=1/zoom;
  cx.setLineDash([]);
  for(var i=0;i<objs.length;i++){
    cx.beginPath();
    addObjectOutline(cx,objs[i]);
    cx.stroke();
  }
  cx.restore();
}

/**
 * Every editable keyframe in the Edit Multiple Frames span, drawn solid.
 *
 * Solid, not ghosted: these frames are live, and ghosting them would be a lie
 * about what a click is going to hit. The current frame is drawn last by the
 * normal render pass, so it still reads as the one you are on.
 */
function drawEditMultiple(){
  var span=editMultipleRange();
  var layers=currentLayers().filter(layerShows).filter(function(l){
    return !isFolderLayer(l)&&(l.layerType||"normal")!=="guide";
  });
  layers.forEach(function(l){
    l.keyframes.forEach(function(kf){
      if(kf.index<span.f0||kf.index>span.f1)return;
      if(kf.index===curFrame)return;        // the normal pass draws this one
      ctx.save();
      // Slightly down, so you can still tell which frame you are actually on
      // without it being a reference ghost.
      ctx.globalAlpha=0.75;
      rigDrawPlan(kf.objects).forEach(function(e){paintPlanned(ctx,e,{});});
      ctx.restore();
    });
  });
}

/** Keep the timeline header's onion-skin controls in step with the state. */
function updateOnionUI(){
  var b=document.getElementById("tlOnion");
  if(b)b.className="tl-zoom-btn wide"+(onionOn?" active":"");
  var o=document.getElementById("tlOnionOutline");
  if(o)o.className="tl-zoom-btn wide"+(onionOn&&onionOutlines?" active":"");
  var bef=document.getElementById("tlOnionBefore");
  if(bef&&String(onionBefore)!==bef.value)bef.value=onionBefore;
  var aft=document.getElementById("tlOnionAfter");
  if(aft&&String(onionAfter)!==aft.value)aft.value=onionAfter;
}

/**
 * Motion guide paths, drawn as authoring chrome.
 *
 * frameObjects() refuses to draw a motion guide layer — it is a path to
 * follow, not a line to draw, and it must never reach an export. Without
 * something here the layer would look empty and the feature invisible, so the
 * path is drawn as a dashed overlay, which is how Flash showed it too.
 */
function drawMotionGuides(){
  if(!window.Flashy||!Flashy.MotionGuide)return;
  var layers=currentLayers();
  layers.forEach(function(l){
    if((l.layerType||"normal")!=="motionguide"||!layerShows(l))return;
    var kf=typeof l.getKeyframeAt==="function"?l.getKeyframeAt(1):null;
    if(!kf)return;
    kf.objects.forEach(function(o){
      var pts=Flashy.MotionGuide.polyline(o);
      if(!pts||pts.length<4)return;
      ctx.save();
      ctx.strokeStyle="rgba(120,220,160,0.9)";
      ctx.lineWidth=1.5/zoom;
      ctx.setLineDash([6/zoom,4/zoom]);
      ctx.beginPath();
      ctx.moveTo(pts[0],pts[1]);
      for(var i=2;i<pts.length;i+=2)ctx.lineTo(pts[i],pts[i+1]);
      ctx.stroke();
      // The ends, so which way it runs is obvious.
      ctx.setLineDash([]);
      ctx.fillStyle="rgba(120,220,160,0.95)";
      ctx.beginPath();ctx.arc(pts[0],pts[1],3/zoom,0,Math.PI*2);ctx.fill();
      ctx.beginPath();
      ctx.arc(pts[pts.length-2],pts[pts.length-1],3/zoom,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    });
  });
}

/** Guides: `doc.guides` is {v:[x,…], h:[y,…]} in stage coordinates. */
function docGuides(){
  if(!doc.guides)doc.guides={v:[],h:[]};
  if(!doc.guides.v)doc.guides.v=[];
  if(!doc.guides.h)doc.guides.h=[];
  return doc.guides;
}

function drawGuides(){
  var g=docGuides();
  ctx.save();
  ctx.lineWidth=1/zoom;
  ctx.setLineDash([]);
  ctx.strokeStyle="rgba(0,190,90,0.85)";
  g.v.forEach(function(x){
    ctx.beginPath();ctx.moveTo(x,-10000);ctx.lineTo(x,10000);ctx.stroke();
  });
  g.h.forEach(function(y){
    ctx.beginPath();ctx.moveTo(-10000,y);ctx.lineTo(10000,y);ctx.stroke();
  });
  if(guideDrag){
    ctx.strokeStyle="rgba(0,190,90,0.45)";
    ctx.beginPath();
    if(guideDrag.axis==="v"){ctx.moveTo(guideDrag.at,-10000);ctx.lineTo(guideDrag.at,10000);}
    else{ctx.moveTo(-10000,guideDrag.at);ctx.lineTo(10000,guideDrag.at);}
    ctx.stroke();
  }
  ctx.restore();
}

/** The line a snap matched against, so the user can see why it moved. */
function drawSnapHints(){
  if(!snapHints.length)return;
  ctx.save();
  ctx.strokeStyle="rgba(255,60,160,0.9)";
  ctx.lineWidth=1/zoom;
  ctx.setLineDash([4/zoom,3/zoom]);
  snapHints.forEach(function(h){
    ctx.beginPath();
    if(h.axis==="x"){ctx.moveTo(h.at,-10000);ctx.lineTo(h.at,10000);}
    else{ctx.moveTo(-10000,h.at);ctx.lineTo(10000,h.at);}
    ctx.stroke();
  });
  ctx.restore();
}

/* Rulers, drawn on the stage canvas rather than as separate DOM strips.
 * One renderer means one coordinate system: the tick spacing has to follow
 * `zoom` and `panX/panY` exactly, and a DOM ruler would have to re-derive both.
 * Dragging out of a ruler creates a guide — see rulerHitAxis / onMouseDown. */
function rulerStep(){
  // Keep labelled ticks at least ~50 screen pixels apart, on 1-2-5 steps.
  var want=50/zoom,pow=Math.pow(10,Math.floor(Math.log(want)/Math.LN10));
  var mults=[1,2,5,10];
  for(var i=0;i<mults.length;i++)if(pow*mults[i]>=want)return pow*mults[i];
  return pow*10;
}

function drawRulers(){
  var step=rulerStep();
  ctx.save();
  ctx.fillStyle="#2A2A2A";
  ctx.fillRect(0,0,canvasW,RULER_W);
  ctx.fillRect(0,0,RULER_W,canvasH);
  ctx.strokeStyle="#4A4A4A";ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(0,RULER_W+0.5);ctx.lineTo(canvasW,RULER_W+0.5);
  ctx.moveTo(RULER_W+0.5,0);ctx.lineTo(RULER_W+0.5,canvasH);
  ctx.stroke();
  ctx.fillStyle="#AAA";
  ctx.font="8px sans-serif";
  ctx.strokeStyle="#777";
  // Horizontal ruler: stage units across the top.
  var first=Math.floor((-panX/zoom)/step)*step;
  ctx.textAlign="left";ctx.textBaseline="top";
  for(var x=first;x*zoom+panX<canvasW;x+=step){
    var sx=Math.round(x*zoom+panX)+0.5;
    if(sx<RULER_W)continue;
    ctx.beginPath();ctx.moveTo(sx,RULER_W-5);ctx.lineTo(sx,RULER_W);ctx.stroke();
    ctx.fillText(String(Math.round(x)),sx+2,2);
  }
  var firstY=Math.floor((-panY/zoom)/step)*step;
  for(var y=firstY;y*zoom+panY<canvasH;y+=step){
    var sy=Math.round(y*zoom+panY)+0.5;
    if(sy<RULER_W)continue;
    ctx.beginPath();ctx.moveTo(RULER_W-5,sy);ctx.lineTo(RULER_W,sy);ctx.stroke();
    ctx.save();
    ctx.translate(2,sy+2);
    ctx.fillText(String(Math.round(y)),0,0);
    ctx.restore();
  }
  // Where the pointer is, on both rulers — the readout the Info panel repeats
  // numerically. Flash drew this and it is how you hit a coordinate by eye.
  if(stageHover){
    ctx.fillStyle="rgba(255,120,60,0.9)";
    var hx=stageHover.x*zoom+panX,hy=stageHover.y*zoom+panY;
    ctx.fillRect(hx-0.5,0,1,RULER_W);
    ctx.fillRect(0,hy-0.5,RULER_W,1);
  }
  ctx.restore();
}

/** Which ruler, if any, a screen point is over. */
function rulerHitAxis(cx,cy){
  if(!showRulers)return null;
  if(cy<=RULER_W&&cx>RULER_W)return "h";   // top ruler drags a horizontal guide
  if(cx<=RULER_W&&cy>RULER_W)return "v";   // left ruler drags a vertical guide
  return null;
}

/* ------------------------------------------------------------------ *
 * Snapping
 *
 * Collects candidate lines — other objects' edges and centres, the stage's
 * own edges and centre, the guides — and pulls the dragged box onto the
 * nearest one within SNAP_TOL *screen* pixels. The tolerance is in screen
 * space on purpose: at 400% zoom a 6-stage-unit pull would feel like a magnet,
 * and at 25% it would feel like nothing.
 *
 * Returns {dx,dy} to add to the proposed position, and records what matched in
 * `snapHints` so render() can draw it.
 * ------------------------------------------------------------------ */
function snapCandidates(exclude){
  var xs=[],ys=[];
  if(snapObjects){
    xs.push(0,doc.width/2,doc.width);
    ys.push(0,doc.height/2,doc.height);
    currentLayers().filter(layerShows).forEach(function(l){
      frameObjects([l],curFrame).forEach(function(o){
        if(exclude&&exclude.indexOf(o)>=0)return;
        xs.push(o.x,o.x+(o.width||0)/2,o.x+(o.width||0));
        ys.push(o.y,o.y+(o.height||0)/2,o.y+(o.height||0));
      });
    });
  }
  if(snapGuides){
    var g=docGuides();
    g.v.forEach(function(v){xs.push(v);});
    g.h.forEach(function(h){ys.push(h);});
  }
  return {xs:xs,ys:ys};
}

/**
 * Snap a box. `box` is {x,y,w,h} in stage coordinates.
 * `exclude` is the objects being dragged, which must not snap to themselves.
 */
function snapBox(box,exclude){
  snapHints=[];
  if(!snapObjects&&!snapGuides)return {dx:0,dy:0};
  var cand=snapCandidates(exclude);
  var tol=SNAP_TOL/zoom;
  var best={dx:0,dy:0},bx=tol+1,by=tol+1,hx=null,hy=null;
  [box.x,box.x+box.w/2,box.x+box.w].forEach(function(edge){
    cand.xs.forEach(function(c){
      var d=c-edge;
      if(Math.abs(d)<Math.abs(bx)){bx=d;best.dx=d;hx=c;}
    });
  });
  [box.y,box.y+box.h/2,box.y+box.h].forEach(function(edge){
    cand.ys.forEach(function(c){
      var d=c-edge;
      if(Math.abs(d)<Math.abs(by)){by=d;best.dy=d;hy=c;}
    });
  });
  if(Math.abs(bx)>tol){best.dx=0;hx=null;}
  if(Math.abs(by)>tol){best.dy=0;hy=null;}
  if(hx!=null)snapHints.push({axis:"x",at:hx});
  if(hy!=null)snapHints.push({axis:"y",at:hy});
  return best;
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
    if(!layerShows(sl))continue;
    // Library layers are revived through reviveLayers(), so getKeyframeAt is
    // always present; guard anyway for documents hand-edited outside the app.
    var skf=typeof sl.getKeyframeAt==="function"?sl.getKeyframeAt(frame):null;
    if(skf)out=out.concat(skf.objects);
  }
  return out;
}

/**
 * A symbol's content at a frame, grouped by mask.
 *
 * Masks live inside symbols far more often than on the root — in the test
 * movie, all 43 of them do — so flattening a symbol's layers draws every
 * mask's own artwork as if it were a drawing, which is how a masked scene
 * ends up as flat coloured blobs over the top of itself.
 */
function symbolFrameGroups(sym,frame){
  if(!sym)return [];
  if(!sym.layers)return (sym.objects&&sym.objects.length)?[{mask:null,objects:sym.objects}]:[];
  var objectsAt=function(layer){
    if(!layerShows(layer))return [];
    var kf=typeof layer.getKeyframeAt==="function"?layer.getKeyframeAt(frame):null;
    return kf?kf.objects:[];
  };
  var groups=maskGroups(sym.layers);
  var out=[];
  for(var gi=groups.length-1;gi>=0;gi--){            // bottom layer first
    var g=groups[gi];
    var objs=[];
    for(var i=g.layers.length-1;i>=0;i--)objs=objs.concat(objectsAt(g.layers[i]));
    if(!objs.length)continue;
    var maskObjs=null;
    if(g.mask){
      maskObjs=objectsAt(g.mask);
      if(!maskObjs.length)continue;                  // nothing shows through
    }
    out.push({mask:maskObjs,objects:objs});
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
    tweenType:kf.tweenType,easing:kf.easing,script:kf.script,label:kf.label||"",
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
/* ------------------------------------------------------------------ *
 * Reverse Frames
 *
 * Reverses the keyframes in the selected span. It is how a walk cycle becomes
 * a walk-backwards cycle and how an opening animation becomes a closing one,
 * and the alternative is cutting and re-pasting every keyframe by hand.
 *
 * The SPANS are reversed, not merely the list: keyframe 1 lasting 5 frames
 * followed by keyframe 6 lasting 1 must come back as a 1-frame keyframe then a
 * 5-frame one, or the timing mirrors wrongly.
 * ------------------------------------------------------------------ */
function reverseFrames(opts){
  opts=opts||{};
  var r=opts.range||tlRange();
  var layers=currentLayers();
  if(!r)return {done:0};
  var done=0,pre=null;
  for(var li=r.l0;li<=r.l1;li++){
    var l=layers[li];
    if(!l||l.locked||isFolderLayer(l))continue;
    var inSpan=l.keyframes.filter(function(k){
      return k.index>=r.f0&&k.index<=r.f1;
    });
    if(inSpan.length<2)continue;
    if(!pre)pre=snap();
    var first=inSpan[0].index;
    var durations=inSpan.map(function(k){return k.duration;});
    var clones=inSpan.map(function(k){return k.clone();}).reverse();
    var at=first;
    clones.forEach(function(k,i){
      // Re-index with the durations also reversed, so the timing mirrors.
      k.index=at;
      k.duration=durations[durations.length-1-i];
      at+=k.duration;
    });
    /* A tween lives on the keyframe it starts FROM, so reversing the order
       leaves each tween attached to the wrong end — the last keyframe would
       sprout a tween into nothing. Shift the tween settings back one. */
    for(var ci=0;ci<clones.length;ci++){
      var src=clones[ci+1];
      clones[ci].tweenType=src?src.tweenType:"none";
      clones[ci].easing=src?src.easing:"linear";
      clones[ci].easeBezier=src&&src.easeBezier?src.easeBezier.slice():null;
      clones[ci].rotateDir=src?src.rotateDir:"none";
      clones[ci].rotateTimes=src?src.rotateTimes:1;
      clones[ci].tweenScale=src?src.tweenScale!==false:true;
    }
    var rest=l.keyframes.filter(function(k){
      return k.index<r.f0||k.index>r.f1;
    });
    l.keyframes=rest.concat(clones).sort(function(a,b){return a.index-b.index;});
    done++;
  }
  if(pre)pushUndoSnap(pre);
  return {done:done};
}

/* ------------------------------------------------------------------ *
 * Copy Motion / Paste Motion
 *
 * Copies the TRANSFORM TRACK of a span — where something was, how big, how
 * turned, how transparent, frame by frame — and applies it to something else.
 * It is how one object inherits another's animation without redoing it, and
 * it is the one copy operation that carries motion rather than artwork.
 * ------------------------------------------------------------------ */
var motionClipboard=null;

function copyMotion(opts){
  opts=opts||{};
  var l=currentLayers()[opts.layerIdx!=null?opts.layerIdx:curLayer];
  if(!l)return {ok:false,reason:"layer"};
  var r=opts.range||tlRange();
  var f0=r?r.f0:1,f1=r?r.f1:l.getFrameEnd();
  // The whole span frame by frame, resolved through the real interpolator, so
  // a pasted motion reproduces the easing as well as the positions.
  var track=[];
  for(var f=f0;f<=f1;f++){
    var objs=frameObjects([l],f);
    if(!objs.length){track.push(null);continue;}
    var o=objs[0];
    track.push({
      x:o.x,y:o.y,width:o.width,height:o.height,
      rotation:o.rotation||0,scaleX:o.scaleX||1,scaleY:o.scaleY||1,
      skewX:o.skewX||0,skewY:o.skewY||0,
      alpha:o.alpha!=null?o.alpha:1
    });
  }
  if(!track.some(Boolean))return {ok:false,reason:"empty"};
  motionClipboard={frames:track,startFrame:f0};
  return {ok:true,frames:track.length};
}

function hasMotionClipboard(){
  return !!(motionClipboard&&motionClipboard.frames&&motionClipboard.frames.length);
}

/**
 * Apply the copied motion to the current layer, starting at the current frame.
 *
 * One keyframe per copied frame, because a track sampled frame by frame has no
 * tweens left in it — it IS the tween, flattened. That is what makes the
 * result identical to what was copied rather than an approximation of it.
 */
function pasteMotion(opts){
  opts=opts||{};
  if(!hasMotionClipboard())return {ok:false,reason:"empty"};
  var l=currentLayers()[opts.layerIdx!=null?opts.layerIdx:curLayer];
  if(!l||l.locked||isFolderLayer(l))return {ok:false,reason:"layer"};
  var start=opts.frame!=null?opts.frame:curFrame;
  var base=l.getKeyframeAt(start);
  if(!base||!base.objects.length)return {ok:false,reason:"nothing"};
  // The object whose motion is being replaced: the selected one if it is on
  // this keyframe, otherwise the first.
  var model=base.objects.filter(function(o){return selection.indexOf(o)>=0;})[0]||base.objects[0];
  pushUndo();
  var track=motionClipboard.frames;
  for(var i=0;i<track.length;i++){
    var t=track[i];
    if(!t)continue;
    var kf=l.insertKeyframe(start+i);
    if(!kf)continue;
    kf.duration=1;
    kf.tweenType="none";
    var o=model.clone();
    o.x=t.x;o.y=t.y;o.width=t.width;o.height=t.height;
    o.rotation=t.rotation;o.scaleX=t.scaleX;o.scaleY=t.scaleY;
    o.skewX=t.skewX;o.skewY=t.skewY;o.alpha=t.alpha;
    kf.objects=[o];
  }
  // Durations are recomputed by insertKeyframe as it splits spans; the last
  // one is left holding whatever remained, which is correct.
  l.keyframes.sort(function(a,b){return a.index-b.index;});
  return {ok:true,frames:track.length};
}

/* ------------------------------------------------------------------ *
 * Edit Multiple Frames
 *
 * Normally the stage shows and edits ONE frame. With this on, every keyframe
 * in the onion-skin range is live: you can select across them and move them
 * together. It is how a whole animation gets repositioned without touching
 * forty keyframes one at a time.
 *
 * It works because selection is a list of object references and a drag writes
 * straight to `o.x`/`o.y` — so the only parts that need to know are hit
 * testing, marquee selection and what the stage draws.
 * ------------------------------------------------------------------ */
var editMultiple=false;

/** The frame span Edit Multiple Frames covers. */
function editMultipleRange(){
  var lo=Math.max(1,curFrame-(onionBefore||0));
  var hi=Math.min(currentMaxFrame(),curFrame+(onionAfter||0));
  // With the onion counts at zero the mode would cover one frame and appear
  // broken; a sensible span beats a no-op.
  if(hi<=lo){lo=1;hi=currentMaxFrame();}
  return {f0:lo,f1:hi};
}

/** Every keyframe in range on editable layers, as {layer, kf} pairs. */
function editMultipleKeyframes(){
  var span=editMultipleRange();
  var out=[];
  currentLayers().forEach(function(l){
    if(!layerShows(l)||l.locked||isFolderLayer(l))return;
    l.keyframes.forEach(function(kf){
      if(kf.index>=span.f0&&kf.index<=span.f1)out.push({layer:l,kf:kf});
    });
  });
  return out;
}

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



/* ------------------------------------------------------------------ *
 * Gradient fills
 *
 * `fillType` is "solid" | "none" | "linear" | "radial". A gradient carries
 * two flat arrays, because `EditorObject.clone()` copies arrays with a
 * shallow `.slice()` and anything nested would be shared between an object
 * and its copy:
 *
 *   fillStops  [ratio, colour, alpha, ratio, colour, alpha, …]
 *              ratio 0..1, colour as a 24-bit integer
 *   fillGrad   [x0, y0, x1, y1] as FRACTIONS of the object's box
 *
 * Fractions rather than pixels so the gradient scales with the shape, which
 * is also exactly what SVG's `objectBoundingBox` units mean — so the stage,
 * the exported engine and the SVG export can all be fed from one definition.
 * A radial gradient reads (x0,y0) as its centre and (x1,y1) as a point on
 * its edge.
 * ------------------------------------------------------------------ */
function isGradient(o){
  var t=o&&o.fillType;
  return (t==="linear"||t==="radial")&&o.fillStops&&o.fillStops.length>=3;
}
function gradStopColor(c,a,alphaMul){
  var n=c|0;
  return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+
         Math.max(0,Math.min(1,(a==null?1:a)*(alphaMul==null?1:alphaMul)))+")";
}
/**
 * Build the canvas gradient for `o` in the coordinate space the caller is
 * about to draw in. `map(fx, fy)` turns a box fraction into that space —
 * the centre-origin shapes and the path renderer sit in different ones.
 */
function gradientFill(cx,o,map,alphaMul){
  var g=o.fillGrad&&o.fillGrad.length>=4?o.fillGrad:[0,0,1,0];
  var p0=map(g[0],g[1]),p1=map(g[2],g[3]);
  var grad;
  if(o.fillType==="radial"){
    var r=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])||1;
    grad=cx.createRadialGradient(p0[0],p0[1],0,p0[0],p0[1],r);
  }else{
    if(p0[0]===p1[0]&&p0[1]===p1[1])p1=[p0[0]+1,p0[1]];
    grad=cx.createLinearGradient(p0[0],p0[1],p1[0],p1[1]);
  }
  var st=o.fillStops;
  for(var i=0;i+2<st.length;i+=3){
    grad.addColorStop(Math.max(0,Math.min(1,st[i])),gradStopColor(st[i+1],st[i+2],alphaMul));
  }
  return grad;
}
/** The fill style for a shape: a gradient if it has one, else its colour. */
function fillStyleFor(cx,o,map,alphaMul){
  return isGradient(o)?gradientFill(cx,o,map,alphaMul):o.fillColor;
}

/* ------------------------------------------------------------------ *
 * Mask layers
 *
 * Flash's model, and the one the document already had a field for: a layer
 * marked `mask` clips the layers beneath it that are marked `masked`, and
 * the mask's own artwork is never drawn — only its silhouette.
 *
 * Grouping is by position: a mask layer takes the run of `masked` layers
 * immediately below it. A `masked` layer with no mask above it is drawn
 * normally, because a half-applied mask is worse than none.
 * ------------------------------------------------------------------ */
function maskGroups(layers){
  var groups=[],i=0;
  while(i<layers.length){
    if((layers[i].layerType||"normal")==="mask"){
      var mask=layers[i],run=[],j=i+1;
      while(j<layers.length&&(layers[j].layerType||"normal")==="masked"){run.push(layers[j]);j++;}
      groups.push({mask:mask,layers:run});
      i=j;
    }else{
      var plain=[];
      while(i<layers.length&&(layers[i].layerType||"normal")!=="mask"){plain.push(layers[i]);i++;}
      groups.push({mask:null,layers:plain});
    }
  }
  return groups;
}

/**
 * Add one object's outline to the current path, in stage coordinates.
 *
 * Only the silhouette matters, so fills, strokes and colours are ignored —
 * and anything without an outline of its own (text, a bitmap, a symbol
 * instance) contributes its box, which is what Flash's own mask does with
 * a grouped object.
 */
function addObjectOutline(cx,o){
  var hw=(o.width||0)/2,hh=(o.height||0)/2;
  cx.save();
  cx.translate((o.x||0)+hw,(o.y||0)+hh);
  if(o.rotation)cx.rotate(o.rotation*Math.PI/180);
  cx.scale(o.scaleX||1,o.scaleY||1);
  if(o.type==="oval"){
    cx.moveTo(Math.abs(hw),0);
    cx.ellipse(0,0,Math.abs(hw),Math.abs(hh),0,0,Math.PI*2);
  }else if(o.type==="path"&&o.path&&o.path.length&&window.FlashyTrace){
    var psx=o.pathW?(o.width/o.pathW):1,psy=o.pathH?(o.height/o.pathH):1;
    cx.translate(-hw,-hh);
    if(psx!==1||psy!==1)cx.scale(psx,psy);
    FlashyTrace.pathToContext(o.path,cx);
  }else if((o.type==="pencil"||o.type==="brush")&&o.points&&o.points.length>3){
    cx.moveTo(o.points[0]-hw,o.points[1]-hh);
    for(var pi=2;pi<o.points.length;pi+=2)cx.lineTo(o.points[pi]-hw,o.points[pi+1]-hh);
    cx.closePath();
  }else{
    cx.rect(-hw,-hh,o.width,o.height);
  }
  cx.restore();
}

/** Clip to the silhouette of a mask layer's objects. */
function applyMaskClip(cx,objects){
  cx.beginPath();
  for(var i=0;i<objects.length;i++)addObjectOutline(cx,objects[i]);
  cx.clip();
}

/**
 * Does this object have anything a filter pass would change?
 *
 * Checked before the wrapper does any work, because every object in a document
 * that uses no filters must cost nothing — the pass allocates a stage-sized
 * scratch buffer.
 */
function objHasEffects(o){
  if(o.colorEffect&&o.colorEffect.mode&&o.colorEffect.mode!=="none")return true;
  if(!o.filters||!o.filters.length)return false;
  for(var i=0;i<o.filters.length;i++){
    if(o.filters[i]&&o.filters[i].enabled!==false)return true;
  }
  return false;
}

/** An object's Colour Effect as a channel transform, or null. */
function colorTransformOf(o){
  if(!window.Flashy||!Flashy.Filters)return null;
  return Flashy.Filters.colorEffect(o.colorEffect);
}

/**
 * paintObj — the one canvas painter, now with the filter stack wrapped round
 * it.
 *
 * The wrapper is separate from the painting because a filter has to see the
 * object's whole composite: a blur needs the shape's neighbourhood, and a
 * drop-shadow applied per drawing operation gives a stroked shape two shadows
 * with one of them printed over the fill. Flashy.Filters is the same module
 * the engine uses, so a glow on the stage is the glow in the export.
 */
function paintObj(cx,o,opts){
  if(objHasEffects(o)&&window.Flashy&&Flashy.Filters){
    Flashy.Filters.render(cx,o.filters,colorTransformOf(o),function(c){
      paintObj9(c,o,opts);
    });
    return;
  }
  paintObj9(cx,o,opts);
}

/**
 * The 9-slice fork.
 *
 * A symbol whose library entry carries guides stretches by cell rather than
 * uniformly, which means its scale has to be applied INSIDE the instance
 * instead of by the usual outer transform — so it cannot go through
 * paintObjRaw at all.
 */
function paintObj9(cx,o,opts){
  if(o.type==="symbol"&&window.Flashy&&Flashy.Slice9){
    var sym=doc.library[o.symbolName];
    var grid=sym&&sym.scale9;
    var sx=o.scaleX||1,sy=o.scaleY||1;
    if(Flashy.Slice9.active(grid)&&(Math.abs(sx)!==1||Math.abs(sy)!==1)){
      paintSymbolSliced(cx,o,sym,opts);
      return;
    }
  }
  paintObjRaw(cx,o,opts);
}

/** A symbol's content at its own frame, at natural size, origin at (0,0). */
function paintSymbolGroups(cx,symGroups,depth){
  // Through the rig plan, so a character rig nested inside a symbol composes
  // its hierarchy here exactly as addPlanned() does in the export. Painting
  // the flat list would drop every ancestor transform.
  for(var gp=0;gp<symGroups.length;gp++){
    var grp=symGroups[gp];
    if(grp.mask){
      cx.save();
      applyMaskClip(cx,grp.mask);
    }
    var gplan=rigDrawPlan(grp.objects);
    for(var gq=0;gq<gplan.length;gq++){
      paintPlanned(cx,gplan[gq],{chrome:false,depth:depth+1});
    }
    if(grp.mask)cx.restore();
  }
}

/** A 9-sliced symbol instance: nine clipped cells instead of one scale. */
function paintSymbolSliced(cx,o,sym,opts){
  opts=opts||{};
  var depth=opts.depth||0;
  if(depth>=SYMBOL_MAX_DEPTH)return;
  var natW=Math.abs(o.width)||1,natH=Math.abs(o.height)||1;
  var sx=o.scaleX||1,sy=o.scaleY||1;
  var dstW=natW*Math.abs(sx),dstH=natH*Math.abs(sy);
  var alpha=o.alpha!=null?o.alpha:1;
  var symGroups=symbolFrameGroups(sym,
    symbolDisplayFrame(o,sym,o._parentFrame||1,o._startFrame||1));

  cx.save();
  cx.translate((o.x||0)+natW/2,(o.y||0)+natH/2);
  if(o.rotation)cx.rotate(o.rotation*Math.PI/180);
  if(o.skewX||o.skewY){
    cx.transform(1,Math.tan((o.skewY||0)*Math.PI/180),
                   Math.tan((o.skewX||0)*Math.PI/180),1,0,0);
  }
  // A negative scale still mirrors; only its MAGNITUDE goes into the cells.
  cx.scale(sx<0?-1:1,sy<0?-1:1);
  if(o.blendMode&&o.blendMode!=="source-over")cx.globalCompositeOperation=o.blendMode;
  cx.globalAlpha*=alpha;
  // The instance grows from its centre, as every other transform here does.
  cx.translate(-dstW/2,-dstH/2);
  Flashy.Slice9.render(cx,sym.scale9,natW,natH,dstW,dstH,function(c){
    paintSymbolGroups(c,symGroups,depth);
  });
  cx.restore();

  if(opts.chrome){
    // The same label the ordinary symbol branch draws, so a 9-sliced instance
    // is still identifiable on the stage.
    cx.save();
    cx.globalAlpha=alpha*0.4;
    cx.fillStyle="#88f";cx.font="9px Arial";
    cx.textBaseline="top";cx.textAlign="center";
    cx.fillText(o.symbolName||"Symbol",
                (o.x||0)+dstW/2,(o.y||0)+dstH+2);
    cx.restore();
  }
}

function paintObjRaw(cx,o,opts){
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
    /* Skew, in the same slot and the same order as DisplayObject._applyTransform
       in flashy.js: rotate, then skew, then scale. `skewX`/`skewY` have been on
       every object since the beginning and were applied by nothing — stored,
       serialized, honoured by the engine, and invisible on the stage and in
       every export. The Transform panel is the first thing that sets them. */
    if(o.skewX||o.skewY){
      cx.transform(1,Math.tan((o.skewY||0)*Math.PI/180),
                     Math.tan((o.skewX||0)*Math.PI/180),1,0,0);
    }
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

  /* Box fractions -> the centre-origin space the shapes draw in. */
  var boxMap=function(fx,fy){return [(-hw)+fx*(o.width||0),(-hh)+fy*(o.height||0)];};

  var primPath=(window.Flashy&&Flashy.Primitives&&Flashy.Primitives.active(o))
    ? Flashy.Primitives.path(o) : null;
  if(primPath&&window.FlashyTrace){
    /* A rounded rectangle or an oval arc/pie/donut. The outline comes from
       Flashy.Primitives, which is also what the SVG export, the player, the
       morph and the eraser read — a rounded corner that is one shape on the
       stage and another in the export is worse than no rounded corner. */
    cx.save();
    cx.translate(-hw,-hh);
    cx.beginPath();
    FlashyTrace.pathToContext(primPath,cx);
    if(fillOn){
      cx.fillStyle=fillStyleFor(cx,o,function(fx,fy){
        return [fx*(o.width||0),fy*(o.height||0)];
      },fillA);
      cx.globalAlpha=fillA;
      // Even-odd, so a donut's inner loop is a hole rather than a second ring.
      cx.fill("evenodd");
    }
    if(strokeOn){
      cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth;
      cx.globalAlpha=strokeA;applyStroke();cx.stroke();
    }
    cx.restore();
  }else if(o.type==="rect"){
    if(fillOn){cx.fillStyle=fillStyleFor(cx,o,boxMap,fillA);cx.globalAlpha=fillA;cx.fillRect(-hw,-hh,o.width,o.height);}
    if(strokeOn){
      cx.strokeStyle=o.strokeColor;cx.lineWidth=o.strokeWidth;
      cx.globalAlpha=strokeA;applyStroke();cx.strokeRect(-hw,-hh,o.width,o.height);
    }
  }else if(o.type==="oval"){
    cx.beginPath();cx.ellipse(0,0,Math.abs(hw),Math.abs(hh),0,0,Math.PI*2);
    if(fillOn){cx.fillStyle=fillStyleFor(cx,o,boxMap,fillA);cx.globalAlpha=fillA;cx.fill();}
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
        /* The context is already translated to the box's top-left and scaled
           to pathW/pathH, so a fraction maps straight onto the stored path's
           own units. */
        cx.fillStyle=fillStyleFor(cx,o,function(fx,fy){
          return [fx*(o.pathW||Math.abs(o.width)||1),fy*(o.pathH||Math.abs(o.height)||1)];
        },fillA);
        cx.globalAlpha=fillA;
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
    /* Through the engine's own TextField, so the stage, the raster exports and
       the player draw text with ONE implementation. The editor had its own
       copy of this, and it knew nothing about wrapping, letter spacing,
       borders or the three text kinds — all of which an export would then
       have rendered differently. */
    if(window.Flashy&&Flashy.TextField&&Flashy.TextField.fromObject){
      var tf=Flashy.TextField.fromObject(o,{chrome:chrome});
      cx.save();
      cx.globalAlpha=fillA;
      // TextField draws from its box's top-left; the painter is at the centre.
      cx.translate(-hw,-hh);
      tf.render(cx);
      cx.restore();
      if(chrome&&(o.textType==="dynamic"||o.textType==="input")){
        /* A dashed box and a label, so a dynamic or input field is
           identifiable on the stage. They look exactly like static text
           otherwise, and which kind a field is changes everything about it. */
        var zz=zoom||1;
        cx.save();
        cx.globalAlpha=alpha*0.8;
        cx.strokeStyle=o.textType==="input"?"#6CC0FF":"#C58BE8";
        cx.lineWidth=1/zz;
        cx.setLineDash([4/zz,3/zz]);
        cx.strokeRect(-hw,-hh,o.width,o.height);
        cx.setLineDash([]);
        cx.fillStyle=cx.strokeStyle;
        cx.font="9px Arial";cx.textBaseline="bottom";cx.textAlign="right";
        cx.fillText(o.textType==="input"?"input":"dynamic",hw-1,-hh-1);
        cx.textAlign="start";
        cx.restore();
      }
    }
  }else if(o.type==="symbol"){
    var sym=doc.library[o.symbolName];
    if(sym&&depth<SYMBOL_MAX_DEPTH){
      // A Graphic instance tracks the parent playhead; frameObjects() stamps
      // the timing context onto the view object it hands us.
      var symGroups=symbolFrameGroups(sym,symbolDisplayFrame(o,sym,o._parentFrame||1,o._startFrame||1));
      var symObjs=[];
      for(var gq=0;gq<symGroups.length;gq++)symObjs=symObjs.concat(symGroups[gq].objects);
      if(symObjs.length){
        // Children are positioned in symbol space, whose origin is the
        // instance's top-left — shift there from the centre.
        cx.save();
        cx.translate(-hw,-hh);
        paintSymbolGroups(cx,symGroups,depth);
        cx.restore();
      }
      if(!symObjs.length&&chrome){
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
  }else if(o.type==="group"){
    /* A group is a transform plus a child list, drawn in group space — the
       same construction as a symbol instance, minus the library entry. That
       is exactly the distinction Flash drew: a group is artwork you want to
       handle as one piece, a symbol is artwork you want to reuse. Nesting is
       bounded by the same depth guard, since a group cannot contain itself
       but can contain symbols that contain groups. */
    if(depth<SYMBOL_MAX_DEPTH){
      cx.save();
      cx.translate(-hw,-hh);
      groupChildScale(cx,o);
      var gk=o.children||[];
      for(var gc=0;gc<gk.length;gc++)paintObj(cx,gk[gc],{chrome:false,depth:depth+1});
      cx.restore();
      if(chrome){
        // Flash drew a thin box around a group so you could tell at a glance
        // that clicking it would select the whole thing.
        cx.globalAlpha=alpha*0.55;
        cx.strokeStyle="#55DD88";cx.lineWidth=1/((zoom||1));
        cx.setLineDash([]);
        cx.strokeRect(-hw,-hh,o.width,o.height);
      }
    }
  }
  cx.restore();
}

/**
 * Scale a group's children from the box they were grouped in to the box the
 * group now occupies.
 *
 * `groupW`/`groupH` are the authored size, the same role `pathW`/`pathH` play
 * for a traced path: without them, resizing a group would move its children's
 * coordinates out from under it and the group would come apart.
 */
function groupChildScale(cx,o){
  var gw=o.groupW||Math.abs(o.width)||1,gh=o.groupH||Math.abs(o.height)||1;
  var sx=gw?Math.abs(o.width||gw)/gw:1,sy=gh?Math.abs(o.height||gh)/gh:1;
  if(sx!==1||sy!==1)cx.scale(sx,sy);
  return {sx:sx,sy:sy};
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
function easeAmount(t,easing,bezier){
  t=Math.max(0,Math.min(1,t));
  if(typeof Flashy!=="undefined"&&Flashy.Easing&&Flashy.Easing.resolve){
    // One resolver, shared with the exported player, so a custom curve cannot
    // ease one way while authoring and another way in the movie.
    return Flashy.Easing.resolve(easing,bezier)(t);
  }
  if(typeof Flashy!=="undefined"&&Flashy.Easing&&Flashy.Easing[easing])return Flashy.Easing[easing](t);
  if(easing==="easeIn"||easing==="quadIn")return t*t;
  if(easing==="easeOut"||easing==="quadOut")return 1-(1-t)*(1-t);
  if(easing==="easeInOut"||easing==="quadInOut")return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  return t;
}
/**
 * One tweened frame between two keyframes.
 *
 * `kf` is the keyframe the tween starts on, and it carries the options Flash
 * put on a motion tween: the easing curve, how many whole turns to spin
 * through, and whether to interpolate size at all.
 */
function interpObj(a,b,t,easing,kf){
  var e=easeAmount(t,easing,kf&&kf.easeBezier);
  var tmp=a.clone();
  var lerp=function(k,dflt){
    var av=a[k]!=null?a[k]:dflt,bv=b[k]!=null?b[k]:dflt;
    return av+(bv-av)*e;
  };
  tmp.x=lerp("x",0);tmp.y=lerp("y",0);
  tmp.width=lerp("width",0);tmp.height=lerp("height",0);
  /* Rotate CW/CCW x n. Without it a tween always takes the short way round,
     so a wheel cannot be made to turn: 0 to 350 degrees rolls backwards, and
     0 to 360 does not move at all. */
  var spin=kf&&kf.rotateDir&&kf.rotateDir!=="none"?kf.rotateDir:null;
  if(spin){
    var turns=Math.max(1,parseInt(kf.rotateTimes,10)||1);
    var from=a.rotation||0;
    var to=(b.rotation!=null?b.rotation:from);
    /* Unwrap so the tween really travels, then add the whole turns.
       `rotateTimes` is how many times it goes ROUND, counting a partial turn
       as part of the first — so 0 to 350 clockwise once is 350 degrees, and 0
       to 0 twice is 720. Equal endpoints have a zero delta, which has to
       become a full turn or "spin twice" travels 360. */
    if(spin==="cw"){
      while(to<from)to+=360;
      if(to===from)to+=360;
      to+=360*(turns-1);
    }else{
      while(to>from)to-=360;
      if(to===from)to-=360;
      to-=360*(turns-1);
    }
    tmp.rotation=from+(to-from)*e;
  }else{
    tmp.rotation=lerp("rotation",0);
  }
  /* Flash's "Scale" checkbox: off means the object keeps its own size through
     the tween and only moves. Default on, which is what every existing
     document means. */
  if(kf&&kf.tweenScale===false){
    tmp.width=a.width;tmp.height=a.height;
    tmp.scaleX=a.scaleX;tmp.scaleY=a.scaleY;
  }else{
    tmp.scaleX=lerp("scaleX",1);tmp.scaleY=lerp("scaleY",1);
  }
  // Skew tweens like every other transform channel. It did not before, so a
  // motion tween between two differently skewed keyframes snapped at the end.
  tmp.skewX=lerp("skewX",0);tmp.skewY=lerp("skewY",0);
  tmp.alpha=lerp("alpha",1);
  /* Primitive parameters tween as well — a pie wedge sweeping open, a corner
     rounding off, a donut's hole widening. These are the shape's dimensions,
     not decoration, so they belong with scale and skew rather than with the
     filter stack. */
  tmp.cornerRadius=lerp("cornerRadius",0);
  tmp.ovalStart=lerp("ovalStart",0);
  tmp.ovalEnd=lerp("ovalEnd",360);
  tmp.ovalInner=lerp("ovalInner",0);
  /* Filters and the Colour Effect tween too, which is how a glow pulses and
     a tint fades. Only when the two keyframes agree about the SHAPE of the
     stack — same filters, in the same order — because there is no sensible
     interpolation between "blur" and "drop shadow", and guessing one would
     produce a frame that is neither. */
  tmp.filters=lerpFilters(a.filters,b.filters,e);
  tmp.colorEffect=lerpColorEffect(a.colorEffect,b.colorEffect,e);
  return tmp;
}

/* Filter and colour-effect tweening lives in Flashy.Filters, not here: the
   exported player interpolates its own keyframes and would otherwise need a
   second copy of it — which is exactly how the four renderers drifted apart
   before paintObj was the only painter. */
function lerpFilters(a,b,t){
  if(!window.Flashy||!Flashy.Filters)return a?JSON.parse(JSON.stringify(a)):null;
  return Flashy.Filters.lerpFilters(a,b,t);
}
function lerpColorEffect(a,b,t){
  if(!window.Flashy||!Flashy.Filters)return a?JSON.parse(JSON.stringify(a)):null;
  return Flashy.Filters.lerpColorEffect(a,b,t);
}

/**
 * Every object visible at `frame`, bottom layer first, with tweens already
 * resolved. The stage, the raster exporter and the SVG exporter all read the
 * document through this one function, so they cannot disagree about what a
 * frame contains.
 */
function frameObjects(layers,frame,opts){
  var out=[];
  /* A guided layer's tween takes its position from the motion guide above it,
     so the whole layer list has to be in scope — `layers` here may be just one
     layer (the outline and onion-skin passes ask per-layer). `opts.allLayers`
     carries the full context when it is not the same array. */
  var context=(opts&&opts.allLayers)||layers;
  for(var i=(layers||[]).length-1;i>=0;i--){
    var l=layers[i];
    if(!layerShows(l))continue;
    /* A folder holds nothing and a motion guide is a path to follow, not a
       line to draw. Neither ever contributes artwork, on the stage or in an
       export — the stage draws the guide separately, as chrome. */
    var lt=(l.layerType||"normal");
    if(lt==="folder"||lt==="motionguide")continue;
    var kf=typeof l.getKeyframeAt==="function"?l.getKeyframeAt(frame):null;
    if(!kf)continue;
    if(kf.tweenType&&kf.tweenType!=="none"&&kf.duration>1){
      var nk=l.keyframes[l.keyframes.indexOf(kf)+1];
      if(nk){
        var t=(frame-kf.index)/kf.duration;
        var guide=motionGuideFor(context,l);
        var eased=easeAmount(t,kf.easing,kf.easeBezier);
        for(var oi=0;oi<kf.objects.length;oi++){
          var b=nk.objects[oi];
          var view;
          if(b&&kf.tweenType==="shape"){
            // A real outline morph, not an interpolated bounding box.
            view=shapeTweenObject(kf.objects[oi],b,eased,kf,oi)
              ||interpObj(kf.objects[oi],b,t,kf.easing,kf);
          }else{
            view=b?interpObj(kf.objects[oi],b,t,kf.easing,kf):kf.objects[oi];
          }
          if(b&&guide)view=applyMotionGuide(view,guide,eased,kf);
          out.push(withTiming(view,kf,frame));
        }
        continue;
      }
    }
    for(var oj=0;oj<kf.objects.length;oj++)out.push(withTiming(kf.objects[oj],kf,frame));
  }
  return out;
}

/** Blend two #RRGGBB colours, as a hex string. */
function blendHex(a,b,t){
  var n=function(v){
    return typeof v==="string"?parseInt(String(v).replace("#",""),16):(v|0);
  };
  var an=n(a==null?"#000000":a),bn=n(b==null?"#000000":b);
  var mix=function(sh){
    var av=(an>>sh)&0xff,bv=(bn>>sh)&0xff;
    return Math.max(0,Math.min(255,Math.round(av+(bv-av)*t)));
  };
  return "#"+[mix(16),mix(8),mix(0)].map(function(v){
    return ("0"+v.toString(16)).slice(-2);
  }).join("").toUpperCase();
}

/**
 * One frame of a REAL shape tween.
 *
 * A shape tween is supposed to morph one outline into another. What it did
 * was interpolate the two objects' boxes and transforms, exactly like a motion
 * tween with a different colour in the timeline — a rectangle tweened to an
 * oval stayed a rectangle the whole way and then snapped.
 *
 * Returns a path object in stage space, or null when there is nothing to morph
 * (a symbol, a bitmap) — in which case the caller falls back to the old
 * behaviour, which is still better than drawing nothing.
 */
function shapeTweenObject(a,b,eased,kf,objIndex){
  if(!window.Flashy||!Flashy.Morph)return null;
  // Hints belong to the first pair of objects on the keyframe: a shape tween
  // with several objects on it is already ambiguous, and hinting all of them
  // from one list would be worse than hinting none.
  var hints=(objIndex===0&&kf.shapeHints&&kf.shapeHints.length)?kf.shapeHints:null;
  var m=Flashy.Morph.between(a,b,eased,hints);
  if(!m)return null;
  var o=a.clone();
  o.type="path";
  o.path=m.path;
  o.pathW=m.pathW;o.pathH=m.pathH;
  o.x=m.x;o.y=m.y;o.width=m.width;o.height=m.height;
  // The morph is already in stage space, so the object's own transform has
  // been baked in and must not be applied a second time.
  o.rotation=0;o.scaleX=1;o.scaleY=1;o.skewX=0;o.skewY=0;
  o.points=null;
  // Colour crosses over with the shape, which is the other half of a shape
  // tween and the part people notice immediately.
  o.fillColor=blendHex(a.fillColor,b.fillColor,eased);
  o.strokeColor=blendHex(a.strokeColor,b.strokeColor,eased);
  var num=function(k,d){
    var av=a[k]!=null?a[k]:d,bv=b[k]!=null?b[k]:d;
    return av+(bv-av)*eased;
  };
  o.fillAlpha=num("fillAlpha",1);
  o.strokeAlpha=num("strokeAlpha",1);
  o.strokeWidth=num("strokeWidth",0);
  o.alpha=num("alpha",1);
  // A morph is a filled outline; a stroke-only source would otherwise vanish.
  if((a.fillType||"solid")==="none"&&(b.fillType||"solid")==="none"){
    o.fillType="none";
  }else{
    o.fillType="solid";
  }
  return o;
}

/* ------------------------------------------------------------------ *
 * Shape hints
 *
 * A hint is a pair of points: one on the start shape, one on the end shape,
 * saying "this bit becomes that bit". Without them the morph has to guess the
 * correspondence, and the wrong guess makes a shape turn inside out on its way
 * across — which is the entire reason Flash had them.
 *
 * Stored on the keyframe the tween starts from, in stage coordinates, lettered
 * a, b, c… on screen exactly as Flash lettered them.
 * ------------------------------------------------------------------ */
var hintDrag=null;      // {kf, index, end} while a hint marker is dragged

/** The keyframe a shape hint would attach to, with its destination. */
function shapeHintTarget(){
  var l=CL();
  if(!l)return null;
  var kf=l.getKeyframeAt(curFrame);
  if(!kf||kf.tweenType!=="shape")return null;
  var nk=l.keyframes[l.keyframes.indexOf(kf)+1];
  if(!nk||!kf.objects.length||!nk.objects.length)return null;
  return {layer:l,kf:kf,next:nk};
}

/**
 * Add a hint at the centre of each shape.
 *
 * At the centre rather than under the pointer because a new hint has to be
 * findable: Flash dropped them in a stack in the middle and you dragged them
 * where they belonged, and anything else means hunting for a 5px circle.
 */
function addShapeHint(){
  var t=shapeHintTarget();
  if(!t)return {ok:false,reason:"notshape"};
  pushUndo();
  if(!t.kf.shapeHints)t.kf.shapeHints=[];
  var a=t.kf.objects[0],b=t.next.objects[0];
  // Spread successive hints a little so they do not land exactly on top of
  // each other and become one undraggable pile.
  var n=t.kf.shapeHints.length;
  var off=n*9;
  t.kf.shapeHints.push([
    (a.x||0)+(a.width||0)/2+off,(a.y||0)+(a.height||0)/2,
    (b.x||0)+(b.width||0)/2+off,(b.y||0)+(b.height||0)/2
  ]);
  return {ok:true,count:t.kf.shapeHints.length};
}

function removeShapeHints(){
  var t=shapeHintTarget();
  if(!t||!t.kf.shapeHints||!t.kf.shapeHints.length)return {ok:false};
  pushUndo();
  t.kf.shapeHints=null;
  return {ok:true};
}

/** The hint marker nearest a stage point, or null. */
function hintHitTest(x,y){
  var t=shapeHintTarget();
  if(!t||!t.kf.shapeHints)return null;
  var tol=9/zoom;
  for(var i=t.kf.shapeHints.length-1;i>=0;i--){
    var h=t.kf.shapeHints[i];
    if(Math.hypot(h[0]-x,h[1]-y)<=tol)return {kf:t.kf,index:i,end:0};
    if(Math.hypot(h[2]-x,h[3]-y)<=tol)return {kf:t.kf,index:i,end:1};
  }
  return null;
}

/** Hint markers, lettered a, b, c… as Flash lettered them. */
function drawShapeHints(cx){
  var t=shapeHintTarget();
  if(!t||!t.kf.shapeHints||!t.kf.shapeHints.length)return;
  var r=6/zoom;
  cx.save();
  cx.lineWidth=1/zoom;
  cx.font=(9/zoom)+"px Tahoma,Arial,sans-serif";
  cx.textAlign="center";
  cx.textBaseline="middle";
  t.kf.shapeHints.forEach(function(h,i){
    var letter=String.fromCharCode(97+(i%26));
    // A faint tie between the pair, so which start goes with which end is
    // readable when there are six of them.
    cx.strokeStyle="rgba(255,220,80,0.35)";
    cx.setLineDash([3/zoom,3/zoom]);
    cx.beginPath();cx.moveTo(h[0],h[1]);cx.lineTo(h[2],h[3]);cx.stroke();
    cx.setLineDash([]);
    [[h[0],h[1],"#FFD24A","#5A4200"],[h[2],h[3],"#8CE08C","#0A3A0A"]].forEach(function(m){
      cx.beginPath();cx.arc(m[0],m[1],r,0,Math.PI*2);
      cx.fillStyle=m[2];cx.fill();
      cx.strokeStyle="rgba(0,0,0,0.7)";cx.stroke();
      cx.fillStyle=m[3];
      cx.fillText(letter,m[0],m[1]+0.5/zoom);
    });
  });
  cx.restore();
}

/** The motion-guide polyline governing `layer`, in stage space, or null. */
function motionGuideFor(layers,layer){
  if(!window.Flashy||!Flashy.MotionGuide)return null;
  var idx=(layers||[]).indexOf(layer);
  if(idx<0)return null;
  var gl=Flashy.MotionGuide.guideFor(layers,idx);
  if(!gl)return null;
  // The first object on the guide layer's own keyframe that flattens into a
  // line. A guide layer is one stroke; anything else on it is a note to self.
  var kf=typeof gl.getKeyframeAt==="function"?gl.getKeyframeAt(1):null;
  // The guide holds for the whole layer, so frame 1 is the right place to look
  // — a guide that moved frame by frame would not be a guide.
  var objs=kf?kf.objects:[];
  for(var i=0;i<objs.length;i++){
    var pts=Flashy.MotionGuide.polyline(objs[i]);
    if(pts&&pts.length>=4)return {points:pts,arc:Flashy.MotionGuide.arc(pts)};
  }
  return null;
}

/**
 * Put a tweened object on its motion guide.
 *
 * The object's CENTRE rides the path, which is what registration means for a
 * symbol dragged onto a guide. `orientToPath` turns it to face along the path
 * as well — the difference between a leaf blowing past and a leaf tumbling.
 */
function applyMotionGuide(view,guide,eased,kf){
  if(!window.Flashy||!Flashy.MotionGuide)return view;
  var p=Flashy.MotionGuide.sampleAt(guide.points,eased,guide.arc);
  if(!p)return view;
  // `view` is already a fresh object: this is only reached on a tweened
  // frame, and interpObj returns a clone. Mutating it cannot touch the
  // document.
  view.x=p.x-(view.width||0)/2;
  view.y=p.y-(view.height||0)/2;
  if(kf.orientToPath)view.rotation=p.angle;
  return view;
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
  /* A primitive in progress previews its real outline, not its box. A pie
     wedge or a rounded rectangle is impossible to place by eye from a
     rectangle, for the same reason a star is. */
  var prevPrim=null;
  if(p.type==="rect"&&rectPrim.cornerRadius>0){
    prevPrim={type:"rect",cornerRadius:rectPrim.cornerRadius};
  }else if(p.type==="oval"&&(ovalPrim.start!==0||ovalPrim.end!==360||ovalPrim.inner>0)){
    prevPrim={type:"oval",ovalStart:ovalPrim.start,ovalEnd:ovalPrim.end,ovalInner:ovalPrim.inner};
  }
  if(prevPrim&&window.Flashy&&Flashy.Primitives&&window.FlashyTrace){
    var bx=Math.min(p.x1,p.x2),by=Math.min(p.y1,p.y2);
    prevPrim.width=Math.abs(p.x2-p.x1);prevPrim.height=Math.abs(p.y2-p.y1);
    var pcmds=(prevPrim.width>1&&prevPrim.height>1)?Flashy.Primitives.path(prevPrim):null;
    if(pcmds){
      // Box coordinates to screen: offset to the drag origin, then s2c.
      var sorig=s2c(bx,by),sunit=s2c(bx+1,by+1);
      var kx=sunit.x-sorig.x,ky=sunit.y-sorig.y;
      ctx.beginPath();
      FlashyTrace.pathToContext(
        FlashyTrace.pathTransform(pcmds,kx,ky,sorig.x,sorig.y),ctx);
      ctx.strokeStyle="#0066FF";ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.stroke();ctx.setLineDash([]);
      ctx.restore();
      return;
    }
  }
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
  }else if(p.type==="polystar"){
    // The real geometry, previewed: a star is impossible to place by eye from
    // a bounding box alone, because the sides and point size change its shape
    // completely.
    var sx0=Math.min(p.x1,p.x2),sy0=Math.min(p.y1,p.y2);
    var sw0=Math.abs(p.x2-p.x1),sh0=Math.abs(p.y2-p.y1);
    if(sw0>1&&sh0>1){
      var loop=polyStarLoop(sx0+sw0/2,sy0+sh0/2,sw0/2,sh0/2,
                            polyStar.sides,polyStar.shape,polyStar.point);
      ctx.beginPath();
      var l0=s2c(loop[0],loop[1]);
      ctx.moveTo(l0.x,l0.y);
      for(var li2=2;li2<loop.length;li2+=2){
        var lp=s2c(loop[li2],loop[li2+1]);
        ctx.lineTo(lp.x,lp.y);
      }
      ctx.closePath();
      ctx.strokeStyle="#0066FF";ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.stroke();ctx.setLineDash([]);
    }
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
      ctx.lineWidth=(p.type==="brush"?brushSize:strokeWidth)*zoom;
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
/** Last pointer position in stage coordinates, for the rulers and Info panel. */
var stageHover=null;
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
  /* The pointer's stage position, for the Info panel's readout and the ruler
     tick markers. Tracked on every move, but it only forces a repaint when
     something is actually showing it. */
  canvas.addEventListener("pointermove",function(e){
    stageHover=getStagePos(e);
    updateInfoPanel();
    /* The Pen tool marks the segment or anchor under the pointer, so it needs
       the repaint whether or not the rulers are showing. */
    if((showRulers||curTool==="pen")&&!dragging)render();
    // Hovering a ruler is how a guide is discovered, so say so.
    var r=canvas.getBoundingClientRect();
    var ax=rulerHitAxis(e.clientX-r.left,e.clientY-r.top);
    if(ax&&!dragging)canvas.style.cursor=ax==="h"?"row-resize":"col-resize";
    else if(canvas.style.cursor==="row-resize"||canvas.style.cursor==="col-resize")canvas.style.cursor="";
  });
  canvas.addEventListener("pointerleave",function(){
    stageHover=null;updateInfoPanel();
    if(eraserHover){eraserHover=null;render();}
    else if(showRulers)render();
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
    /* A Library item dragged out of the panel: place it where it was dropped,
       which is the whole point of dragging it rather than pressing Place. */
    var lib=e.dataTransfer&&e.dataTransfer.getData(LIB_DRAG);
    if(lib){
      e.preventDefault();
      var cut=lib.indexOf(":");
      var p0=getStagePos(e);
      placeLibItem(lib.slice(0,cut),lib.slice(cut+1),{dropX:p0.x,dropY:p0.y});
      return;
    }
    var files=e.dataTransfer&&e.dataTransfer.files;
    if(!files||!files.length)return;
    e.preventDefault();
    if(String(files[0].type).indexOf("image/")!==0){
      // An audio file dropped here is a near miss, not a mistake worth a
      // dialog — send it where it was going to go. A .swf or .fla is a whole
      // document, so it goes through the import confirmation.
      if(isFlashFile(files[0]))importFlashFile(files[0]);
      else if(String(files[0].type).indexOf("audio/")===0)importSoundFile(files[0]);
      else showMessage("Drop","Drop an image to place it, an audio file to add it to "+
        "the timeline, or a .swf/.fla to import the whole movie.");
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
  /* Edit Multiple Frames: every keyframe in the onion range is live, so the
     hit test searches all of them. Topmost-and-latest first, which is what
     "the thing I can see under the pointer" means when several frames are on
     screen at once. */
  if(editMultiple){
    var pairs=editMultipleKeyframes();
    for(var pi=pairs.length-1;pi>=0;pi--){
      var pobjs=pairs[pi].kf.objects;
      for(var pj=pobjs.length-1;pj>=0;pj--){
        var po=pobjs[pj];
        var px0=Math.min(po.x,po.x+po.width),px1=Math.max(po.x,po.x+po.width);
        var py0=Math.min(po.y,po.y+po.height),py1=Math.max(po.y,po.y+po.height);
        if(x>=px0&&x<=px1&&y>=py0&&y<=py1)return po;
      }
    }
    return null;
  }
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
  var dp=getStagePos(e);
  // Polygon lasso: a double-click closes the outline and selects.
  if(curTool==="lasso"&&lassoMode==="polygon"&&lassoPts&&lassoPts.length>=6){
    lassoSelect(lassoPts);
    lassoPts=null;lassoPending=false;
    updateProps();render();
    return;
  }
  // Pen: a double-click finishes an OPEN path, which is how you draw a curve
  // that is a line rather than a shape. Clicking the first point closes it.
  if(curTool==="pen"&&penPts&&penPts.length>=2){
    penCommit(false);
    fullRefresh();
    return;
  }
  if(curTool!=="select")return;
  var p=dp;
  var hit=hitTest(p.x,p.y);
  if(hit&&hit.type==="symbol"&&hit.symbolName&&doc.library[hit.symbolName]){
    enterSymbol(hit.symbolName);
  }
}
function onMouseDown(e){
  if(e.button===2)return;
  var p=getStagePos(e);
  /* A press that starts on a ruler pulls out a guide, whatever tool is
     selected — the rulers are stage furniture, not a tool mode. */
  var rc=canvas.getBoundingClientRect();
  var rax=rulerHitAxis(e.clientX-rc.left,e.clientY-rc.top);
  if(rax){
    dragging=true;
    guideDrag={axis:rax==="h"?"h":"v",at:rax==="h"?p.y:p.x,created:true};
    render();
    return;
  }
  /* Dragging an existing guide moves it; dragging it back onto its ruler (or
     off the stage) deletes it, which is how Flash removed one. */
  if(showGuides&&curTool==="select"){
    var g=docGuides(),tol=SNAP_TOL/zoom;
    for(var gi=0;gi<g.v.length;gi++){
      if(Math.abs(g.v[gi]-p.x)<=tol){
        pushUndo();g.v.splice(gi,1);
        dragging=true;guideDrag={axis:"v",at:p.x};render();return;
      }
    }
    for(var gj=0;gj<g.h.length;gj++){
      if(Math.abs(g.h[gj]-p.y)<=tol){
        pushUndo();g.h.splice(gj,1);
        dragging=true;guideDrag={axis:"h",at:p.y};render();return;
      }
    }
  }
  /* A shape hint marker takes the press before any tool does. They are only
     on screen while a shape tween's keyframe is current, and when they are,
     moving one is almost certainly what the click meant. */
  var hh=hintHitTest(p.x,p.y);
  if(hh){
    dragging=true;
    hintDrag=hh;
    movePreSnap=snap();
    render();
    return;
  }
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
  }else if(curTool==="subselect"){
    /* Grab the nearest anchor. Missing every anchor selects whatever is under
       the pointer instead, so the tool can also be used to pick the drawing
       you are about to reshape. */
    var sn=nodeHitTest(p.x,p.y);
    if(sn){
      subPoint=sn;
      subPreSnap=snap();
    }else{
      subPoint=null;
      var sh=hitTest(p.x,p.y);
      selection=sh?[sh]:[];
      updateProps();
    }
    render();
  }else if(curTool==="gradient"){
    var gh=gradientHandleHit(p.x,p.y);
    if(gh){
      gradDrag=gh;
      movePreSnap=snap();
    }else{
      var go=hitTest(p.x,p.y);
      selection=go?[go]:[];
      if(go&&!isGradient(go)){
        // The commonest confusion with this tool by a distance: it does
        // nothing at all on a solid fill, and there is no way to tell from
        // the stage why.
        showMessage("Gradient Transform",
          "This shape has a solid fill, so there is no gradient to transform.\n\n"+
          "Set its fill to Linear or Radial in the Color Mixer first.");
      }
      updateProps();
    }
    render();
    if(!gradDrag)dragging=false;
  }else if(curTool==="pen"){
    if(penClosesAt(p.x,p.y)){
      penCommit(true);
      fullRefresh();
      dragging=false;
    }else if(!penPts||!penPts.length){
      /* Nothing in progress, so a click on an existing path EDITS it: on a
         segment it adds an anchor, on an anchor it removes one, and with Alt
         held it converts a corner to a curve and back. Flash put all three on
         this tool, and without them a drawn path is final. */
      var pe=penEditAt(p.x,p.y,e.altKey);
      if(pe){
        fullRefresh();
        dragging=false;
      }else{
        penStart(p.x,p.y);
        render();
      }
    }else{
      penStart(p.x,p.y);
      render();
    }
  }else if(curTool==="lasso"){
    if(lassoMode==="wand"){
      magicWandSelect(p.x,p.y);
      updateProps();render();
      dragging=false;
    }else if(lassoMode==="polygon"){
      // Click to place a corner; the drag handlers do nothing in this mode.
      if(!lassoPts)lassoPts=[];
      lassoPts.push(p.x,p.y);
      lassoPending=true;
      render();
      dragging=false;
    }else{
      lassoPts=[p.x,p.y];
      lassoPending=false;
    }
  }else if(curTool==="inkbottle"){
    var ih=hitTest(p.x,p.y);
    if(ih&&!isRigPart(ih)&&ih.type!=="symbol"&&ih.type!=="bitmap"){
      inkBottleApply(ih);
      selection=[ih];
      fullRefresh();
    }
    dragging=false;
  }else if(curTool==="rect"||curTool==="oval"||curTool==="line"||curTool==="polystar"){
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
  if(guideDrag){
    guideDrag.at=guideDrag.axis==="v"?p.x:p.y;
    render();
    return;
  }
  if(hintDrag){
    var h=hintDrag.kf.shapeHints[hintDrag.index];
    h[hintDrag.end*2]=p.x;
    h[hintDrag.end*2+1]=p.y;
    render();
    return;
  }
  dragCur={x:p.x,y:p.y};
  if(curTool==="pose"){
    poseMouseMove(e,p);
  }else if(curTool==="select"){
    if(dragPreview&&dragPreview.type==="select"){
      dragPreview.x2=p.x;dragPreview.y2=p.y;
    }else if(selection.length>0&&moveObjStarts.length>0){
      var dx=p.x-moveStartX,dy=p.y-moveStartY;
      if(snapGrid){
        /* Grid snap applies to the SELECTION, not to each object: snapping
           every object independently collapsed the spacing between them,
           so dragging two shapes a few pixels apart onto the grid stacked
           them on the same line. */
        var g0=getBounds(moveObjStarts.map(function(s,i){
          return {x:s.x,y:s.y,width:selection[i].width||0,height:selection[i].height||0};
        }));
        dx=Math.round((g0.x+dx)/gridSize)*gridSize-g0.x;
        dy=Math.round((g0.y+dy)/gridSize)*gridSize-g0.y;
      }
      /* Object and guide snapping, on the selection's bounding box. Alt
         suspends it, for the one time in ten you need to land between two
         things that want to capture you. */
      if(!e.altKey){
        var box=getBounds(moveObjStarts.map(function(s,i){
          return {x:s.x+dx,y:s.y+dy,width:selection[i].width||0,height:selection[i].height||0};
        }));
        var sn=snapBox({x:box.x,y:box.y,w:box.w,h:box.h},selection);
        dx+=sn.dx;dy+=sn.dy;
      }else{
        snapHints=[];
      }
      for(var i=0;i<selection.length;i++){
        selection[i].x=moveObjStarts[i].x+dx;
        selection[i].y=moveObjStarts[i].y+dy;
      }
    }
  }else if(curTool==="subselect"){
    if(subPoint){
      setObjectNode(subPoint.obj,subPoint.node,p.x,p.y);
      // The node moved in the object's own space, so its box no longer
      // describes it. Re-deriving on every pointer move keeps the selection
      // rectangle, the hit test and the eraser honest while dragging.
      if(subPoint.obj.type==="path")renormalizePath(subPoint.obj);
      else renormalizeStroke(subPoint.obj);
    }
  }else if(curTool==="gradient"){
    if(gradDrag)setGradientHandle(gradDrag.obj,gradDrag.which,p.x,p.y);
  }else if(curTool==="pen"){
    penDragTo(p.x,p.y);
  }else if(curTool==="lasso"){
    if(lassoMode==="freeform"&&lassoPts)lassoPts.push(p.x,p.y);
  }else if(curTool==="rect"||curTool==="oval"||curTool==="line"||
           curTool==="text"||curTool==="polystar"){
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
  if(guideDrag){
    var gp=getStagePos(e);
    var at=guideDrag.axis==="v"?gp.x:gp.y;
    var limit=guideDrag.axis==="v"?doc.width:doc.height;
    // Dropped outside the stage (or back on the ruler): the guide is thrown
    // away. Flash deleted a guide exactly this way.
    if(at>=-RULER_W/zoom&&at<=limit+RULER_W/zoom){
      if(guideDrag.created)pushUndo();
      var gg=docGuides();
      (guideDrag.axis==="v"?gg.v:gg.h).push(Math.round(at));
      touchDoc();
    }
    guideDrag=null;dragging=false;
    render();
    return;
  }
  if(hintDrag){
    hintDrag=null;dragging=false;
    if(movePreSnap){pushUndoSnap(movePreSnap);movePreSnap=null;}
    fullRefresh();
    return;
  }
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
      var x1=Math.min(dragPreview.x1,dragPreview.x2),y1=Math.min(dragPreview.y1,dragPreview.y2);
      var x2=Math.max(dragPreview.x1,dragPreview.x2),y2=Math.max(dragPreview.y1,dragPreview.y2);
      var inBox=function(o){
        var ox0=Math.min(o.x,o.x+o.width),ox1=Math.max(o.x,o.x+o.width);
        var oy0=Math.min(o.y,o.y+o.height),oy1=Math.max(o.y,o.y+o.height);
        return ox1>x1&&ox0<x2&&oy1>y1&&oy0<y2;
      };
      if(editMultiple){
        // Across every live keyframe, which is the whole point of the mode:
        // one marquee grabs the animation, not one frame of it.
        selection=[];
        editMultipleKeyframes().forEach(function(p){
          p.kf.objects.forEach(function(o){if(inBox(o))selection.push(o);});
        });
      }else{
        var kf=CKF();
        if(kf)selection=kf.objects.filter(inBox);
      }
      dragPreview=null;
    }else if(selection.length>0&&moveObjStarts.length>0){
      var movedAny=selection.some(function(o,i){
        return moveObjStarts[i]&&(o.x!==moveObjStarts[i].x||o.y!==moveObjStarts[i].y);
      });
      if(movedAny&&movePreSnap)pushUndoSnap(movePreSnap);
      moveObjStarts=[];movePreSnap=null;
      snapHints=[];
    }
    updateProps();
  }else if(curTool==="subselect"){
    if(subPoint){
      if(subPreSnap)pushUndoSnap(subPreSnap);
      subPoint=null;subPreSnap=null;
      updateProps();
    }
  }else if(curTool==="gradient"){
    if(gradDrag){
      if(movePreSnap)pushUndoSnap(movePreSnap);
      gradDrag=null;movePreSnap=null;
      updateProps();
    }
  }else if(curTool==="pen"){
    // The drag that shapes a point's handle ends here; the path stays open
    // until it is closed, finished or abandoned.
    penDrag=null;
  }else if(curTool==="lasso"){
    if(lassoMode==="freeform"&&lassoPts){
      lassoSelect(lassoPts);
      lassoPts=null;
      updateProps();
    }
  }else if(curTool==="polystar"){
    if(dragPreview){
      var ps=makePolyStar(dragPreview.x1,dragPreview.y1,dragPreview.x2,dragPreview.y2);
      if(ps){
        pushUndo();
        var kfp=CKF();if(!kfp){var lp=CL();if(lp){kfp=lp.insertKeyframe(curFrame);}}
        if(kfp){kfp.objects.push(ps);selection=[ps];}
      }
      dragPreview=null;
    }
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
        // Carry the tool's primitive settings onto the shape it just made.
        if(curTool==="rect"&&rectPrim.cornerRadius>0)obj.cornerRadius=rectPrim.cornerRadius;
        if(curTool==="oval"){
          if(ovalPrim.start!==0)obj.ovalStart=ovalPrim.start;
          if(ovalPrim.end!==360)obj.ovalEnd=ovalPrim.end;
          if(ovalPrim.inner>0)obj.ovalInner=ovalPrim.inner;
        }
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
        /* The brush's size is its own control, not the stroke width — but the
           painter draws a brush at three times `strokeWidth`, and so do the
           SVG and runtime exports. Storing size/3 keeps one number flowing
           through four render paths that already agree about it. */
        if(curTool==="brush")obj2.strokeWidth=Math.max(0.1,brushSize/3);
        /* Pencil modes, applied on release the way Flash applied them: Smooth
           rounds the stroke out, Straighten reduces it to its straight runs,
           Ink leaves it exactly as drawn. A hand-drawn stroke is jittery, and
           which of those three you want is a property of what you are drawing,
           not something to fix afterwards every time. */
        if(curTool==="pencil"&&obj2.points.length>=6){
          if(pencilMode==="smooth")obj2.points=smoothPoints(obj2.points,false,0.5,3);
          else if(pencilMode==="straighten")obj2.points=window.FlashyTrace
            ? FlashyTrace.douglasPeucker(obj2.points,2.5) : obj2.points;
          if(pencilMode!=="ink")renormalizeStroke(obj2);
        }
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
  // Over the ROWS, not the layer array: a collapsed folder's contents have no
  // row, and each row carries its own height.
  layerRowLayout(layers).rows.forEach(function(rowInfo){
    var l=rowInfo.layer,i=rowInfo.index;
    var row=document.createElement("div");
    row.className="layer-row"+(i===curLayer?" active":"")+(isFolderLayer(l)?" folder":"");
    row.style.height=rowInfo.h+"px";
    // Indentation is what makes a folder's contents read as its contents.
    if(l.indent)row.style.paddingLeft=(4+(l.indent*12))+"px";
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
    if(isFolderLayer(l)){
      /* The disclosure triangle. Collapsing a folder hides its rows from the
         list and nothing else — the artwork stays on the stage, which is the
         only reading that lets you tidy a twenty-part rig without changing
         what it looks like. */
      var tri=document.createElement("button");
      tri.className="layer-btn layer-disclose";
      tri.textContent=l.folderOpen===false?"▸":"▾";
      tri.title=l.folderOpen===false?"Expand folder":"Collapse folder";
      tri.addEventListener("click",function(e){
        e.stopPropagation();
        l.folderOpen=l.folderOpen===false;
        fullRefresh();
      });
      row.appendChild(tri);
    }
    var nameSpan=document.createElement("span");
    nameSpan.className="layer-name";
    nameSpan.textContent=l.name;
    if(isFolderLayer(l))nameSpan.style.fontStyle="italic";
    /* A guide layer's name says so: it is the only visible difference between
       reference art and art that will be in the movie, and getting that wrong
       means shipping your pencil test. */
    if((l.layerType||"normal")==="guide"){
      nameSpan.textContent=l.name+"  (guide)";
      nameSpan.style.color="#8ab";
    }
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
    visBtn.title="Toggle visibility \u2014 Alt-click to show this layer only";
    visBtn.addEventListener("click",function(e){
      e.stopPropagation();
      /* Alt-click solos, the way it does in Flash, and alt-clicking the
         layer that is already alone puts the others back — otherwise the
         gesture is a one-way trip through the menu. */
      if(e.altKey){
        if(isSoloed(i))showAllLayers();
        else soloLayer(i);
        return;
      }
      l.visible=!l.visible;
      fullRefresh();
    });
    row.appendChild(visBtn);
    var lockBtn=document.createElement("button");
    lockBtn.className="layer-btn";
    lockBtn.textContent=l.locked?"\u25A0":"\u25A1";
    lockBtn.title="Toggle lock";
    lockBtn.addEventListener("click",function(e){e.stopPropagation();l.locked=!l.locked;fullRefresh();});
    row.appendChild(lockBtn);
    if(!isFolderLayer(l)){
      /* View as outlines. `outlineColor` was in the inspector and in the save
         format and was read by no renderer at all — there was no outline mode
         to use it. Seeing a layer as outlines is how you work on what is
         underneath it without hiding it. */
      var outBtn=document.createElement("button");
      outBtn.className="layer-btn"+(l.outlines?" on":"");
      outBtn.textContent=l.outlines?"▣":"□";
      outBtn.title="View this layer as outlines";
      if(l.outlines)outBtn.style.color=l.outlineColor||"#4488CC";
      outBtn.addEventListener("click",function(e){
        e.stopPropagation();
        l.outlines=!l.outlines;
        fullRefresh();
      });
      row.appendChild(outBtn);
    }
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
  var folderBtn=document.createElement("button");
  folderBtn.style.cssText="width:22px;height:18px;background:linear-gradient(to bottom,#555,#444);border:1px solid #666;border-bottom-color:#333;color:#DDD;cursor:pointer;font-size:11px;border-radius:2px;display:flex;align-items:center;justify-content:center;";
  folderBtn.title="New Layer Folder — puts the current layer into it";
  folderBtn.textContent="▱";
  folderBtn.addEventListener("click",function(){doAction("addFolder");});
  btnBar.appendChild(folderBtn);
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
  /* The same thing as a button, because a feature only in a menu and an
     Alt-click is a feature most people never find. It reads as a toggle:
     solo this layer, or show them all again. */
  var soloBtn=document.createElement("button");
  soloBtn.style.cssText=dupBtn.style.cssText;
  var soloed=isSoloed(curLayer);
  soloBtn.textContent=soloed?"\u25C9":"\u25CE";
  soloBtn.title=soloed?"Show all layers":"Show this layer only";
  soloBtn.addEventListener("click",function(){
    doAction(isSoloed(curLayer)?"showAllLayers":"hideOthers");
  });
  btnBar.appendChild(soloBtn);
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

/* ------------------------------------------------------------------ *
 * Layer rows: height, folders, and the y geometry both halves share
 *
 * `layerHeight` and `outlineColor` have been on every layer since the
 * beginning, were serialized, and were read by nothing: the Property
 * inspector offered Short/Normal/Tall and an outline colour, and the layer
 * list drew every row at a fixed 20px with no outline mode anywhere. Both are
 * real now, which means the timeline can no longer assume `index * TL_FH`.
 *
 * Folders are the same flat-list-with-a-run idiom mask layers already use: a
 * layer of type "folder", and the layers beneath it with a greater `indent`
 * are its contents. There is no tree to keep consistent, reordering cannot
 * orphan anything, and a document written before folders existed loads with
 * every indent at zero.
 * ------------------------------------------------------------------ */
var LAYER_HEIGHTS={short:13,normal:20,tall:34};

function layerRowHeight(l){
  return LAYER_HEIGHTS[l&&l.layerHeight]||LAYER_HEIGHTS.normal;
}

function isFolderLayer(l){return (l&&l.layerType||"normal")==="folder";}

/** Layers inside a given folder: the run beneath it at a greater indent. */
function folderChildren(layers,folderIdx){
  var base=(layers[folderIdx]&&layers[folderIdx].indent)||0;
  var out=[];
  for(var i=folderIdx+1;i<layers.length;i++){
    if((layers[i].indent||0)<=base)break;
    out.push(i);
  }
  return out;
}

/**
 * The rows the timeline shows, in order, with their y offsets.
 *
 * A collapsed folder's contents are hidden from the LIST but still render on
 * the stage — collapsing a folder is an organisational act, not a visibility
 * one, which is how Flash's folders behaved and is the only reading that lets
 * you tidy a rig without changing what it looks like.
 */
function layerRowLayout(layersArg){
  var layers=layersArg||currentLayers();
  var rows=[],y=TL_HDR,hideAbove=-1;
  for(var i=0;i<layers.length;i++){
    var l=layers[i];
    var ind=l.indent||0;
    if(hideAbove>=0){
      if(ind>hideAbove)continue;
      hideAbove=-1;
    }
    var h=layerRowHeight(l);
    rows.push({index:i,layer:l,y:y,h:h});
    y+=h;
    if(isFolderLayer(l)&&l.folderOpen===false)hideAbove=ind;
  }
  return {rows:rows,total:y,layers:layers};
}

/** Which layer index a timeline y coordinate falls on, or -1. */
function layerAtY(y,layersArg){
  var lay=layerRowLayout(layersArg);
  for(var i=0;i<lay.rows.length;i++){
    var r=lay.rows[i];
    if(y>=r.y&&y<r.y+r.h)return r.index;
  }
  // Past the last row: clamp to it, so a drag that runs off the bottom
  // selects to the end rather than snapping back to nothing.
  if(lay.rows.length&&y>=lay.total)return lay.rows[lay.rows.length-1].index;
  return -1;
}

/* ================================================================== *
 * Scenes
 *
 * The breadcrumb has read "Scene 1" since the beginning and there was only
 * ever one. A scene is a whole timeline of its own, and scenes play in order —
 * which is how anyone storyboards something longer than a loop without
 * stacking every shot on one timeline and juggling frame numbers.
 *
 * `doc.scenes` is the list of {name, layers, totalFrames}; `doc.layers` is a
 * LIVE ALIAS of the current scene's layers, not a copy. Everything in the
 * editor reaches `doc.layers` directly and has done from the start, so making
 * the current scene the thing that array points at is the only change that
 * does not need all of it rewritten — and it cannot drift out of sync with a
 * copy, because there is no copy.
 * ================================================================== */

/** Normalise `doc.scenes`, creating one from `doc.layers` if there is none. */
function docScenes(){
  if(!Array.isArray(doc.scenes)||!doc.scenes.length){
    doc.scenes=[{name:"Scene 1",layers:doc.layers,totalFrames:doc.totalFrames||60}];
    doc.sceneIndex=0;
  }
  if(doc.sceneIndex==null||doc.sceneIndex<0||doc.sceneIndex>=doc.scenes.length){
    doc.sceneIndex=0;
  }
  // The alias. If something has replaced doc.layers wholesale — File ▸ New,
  // an import, the AI assistant — the scene record follows it rather than the
  // editor quietly reverting to the old array.
  var cur=doc.scenes[doc.sceneIndex];
  if(cur.layers!==doc.layers){
    if(doc.layers&&doc.layers.length)cur.layers=doc.layers;
    else doc.layers=cur.layers;
  }
  return doc.scenes;
}

function currentScene(){
  var scenes=docScenes();
  return scenes[doc.sceneIndex];
}

/**
 * Write the live editing state back onto the current scene's record.
 *
 * `doc.layers` is an alias so it needs no copying, but `doc.totalFrames`,
 * `curFrame` and `curLayer` live on `doc` — and anything that reads the stored
 * records (the panel, the export, the frame count) sees a stale number until
 * they are parked. Forgetting this made a two-scene movie 68 frames long
 * instead of 14, because the new scene's record still said 60.
 */
function parkCurrentScene(){
  var scenes=docScenes();
  var cur=scenes[doc.sceneIndex];
  if(!cur)return;
  cur.layers=doc.layers;
  cur.totalFrames=doc.totalFrames;
  cur._frame=curFrame;
  cur._layer=curLayer;
}

/** How many frames a scene runs for. */
function sceneLength(scene){
  var m=1;
  (scene.layers||[]).forEach(function(l){
    var e=(typeof l.getFrameEnd==="function")?l.getFrameEnd()
      :((l.keyframes||[]).reduce(function(a,k){return Math.max(a,k.index+k.duration-1);},1));
    if(e>m)m=e;
  });
  return Math.max(m,scene.totalFrames||1);
}

/** Switch scenes, parking the current one's frame and layer so it comes back. */
function gotoScene(idx){
  var scenes=docScenes();
  if(idx<0||idx>=scenes.length||idx===doc.sceneIndex)return false;
  // Leaving a symbol first: the edit stack belongs to the scene you were in.
  exitAllSymbols();
  parkCurrentScene();
  doc.sceneIndex=idx;
  var next=scenes[idx];
  doc.layers=next.layers;
  doc.totalFrames=next.totalFrames||60;
  curFrame=Math.max(1,next._frame||1);
  curLayer=Math.max(0,Math.min(next._layer||0,doc.layers.length-1));
  selection=[];selectedKF=null;tlSelRange=null;
  touchDoc();
  updateBreadcrumb();
  fullRefresh();
  return true;
}

function uniqueSceneName(base){
  var names={};
  docScenes().forEach(function(s){names[s.name]=true;});
  base=String(base||"Scene").trim()||"Scene";
  if(!names[base])return base;
  for(var i=2;i<999;i++)if(!names[base+" "+i])return base+" "+i;
  return base+" "+Date.now();
}

function addScene(opts){
  opts=opts||{};
  var scenes=docScenes();
  // Park the current scene before touching the list, or its edits — and the
  // frame you were on, which you expect to come back to — are lost.
  parkCurrentScene();
  var scene;
  if(opts.duplicate){
    var src=scenes[doc.sceneIndex];
    scene={
      name:uniqueSceneName(src.name+" copy"),
      layers:src.layers.map(function(l){
        var nl=new Layer(l.name);
        nl.visible=l.visible;nl.locked=l.locked;
        nl.layerType=l.layerType;nl.outlineColor=l.outlineColor;
        nl.layerHeight=l.layerHeight;nl.indent=l.indent||0;
        nl.folderOpen=l.folderOpen!==false;nl.outlines=!!l.outlines;
        nl.keyframes=l.keyframes.map(function(k){return k.clone();});
        return nl;
      }),
      totalFrames:src.totalFrames
    };
  }else{
    // "Scene 2", not "Scene": the default name has to carry its number, or
    // the breadcrumb reads "Scene" and the panel lists two things called
    // almost the same.
    scene={name:uniqueSceneName(opts.name||("Scene "+(scenes.length+1))),
           layers:[new Layer("Layer 1")],totalFrames:60};
  }
  scenes.splice(doc.sceneIndex+1,0,scene);
  // Switching to it is the point of making it.
  doc.sceneIndex=doc.sceneIndex+1;
  doc.layers=scene.layers;
  doc.totalFrames=scene.totalFrames;
  curFrame=1;curLayer=0;selection=[];selectedKF=null;tlSelRange=null;
  touchDoc();
  updateBreadcrumb();
  fullRefresh();
  return scene;
}

function deleteScene(idx){
  var scenes=docScenes();
  if(scenes.length<2)return false;
  if(idx<0||idx>=scenes.length)return false;
  scenes.splice(idx,1);
  var next=Math.max(0,Math.min(idx,scenes.length-1));
  doc.sceneIndex=-1;             // force gotoScene to do the work
  var target=scenes[next];
  doc.sceneIndex=next;
  doc.layers=target.layers;
  doc.totalFrames=target.totalFrames||60;
  curFrame=1;curLayer=0;selection=[];selectedKF=null;tlSelRange=null;
  touchDoc();
  updateBreadcrumb();
  fullRefresh();
  return true;
}

function moveScene(idx,dir){
  var scenes=docScenes();
  var to=idx+dir;
  if(idx<0||idx>=scenes.length||to<0||to>=scenes.length)return false;
  var moved=scenes.splice(idx,1)[0];
  scenes.splice(to,0,moved);
  // The current scene follows wherever it went.
  if(doc.sceneIndex===idx)doc.sceneIndex=to;
  else if(doc.sceneIndex===to)doc.sceneIndex=idx;
  touchDoc();
  updateBreadcrumb();
  fullRefresh();
  return true;
}

/**
 * Every scene concatenated into one timeline, for output.
 *
 * Scenes play in order, and a published movie is one timeline — which is
 * exactly what Flash's SWF did with them. Each scene's layers become their own
 * layers, offset to the scene's start, with blank keyframes either side so the
 * artwork exists only during its own scene. Scene names ride along as frame
 * labels, so `gotoAndPlay("Scene 2")` works in an export.
 *
 * A single-scene document returns its own layers untouched, so nothing about
 * the common case changes.
 */
function flattenScenes(){
  var scenes=docScenes();
  if(scenes.length<2)return outputLayers(doc.layers);
  // Park the current scene so its live edits are in the output.
  parkCurrentScene();

  var out=[],at=1;
  var labelLayer=new Layer("Scene labels");
  labelLayer.keyframes=[];
  scenes.forEach(function(scene){
    var len=sceneLength(scene);
    var lk=new KeyFrame(at);
    lk.duration=len;
    lk.label=scene.name;
    labelLayer.keyframes.push(lk);
    outputLayers(scene.layers).forEach(function(l){
      var nl=new Layer(scenes.length>1?(scene.name+" / "+l.name):l.name);
      nl.visible=l.visible;nl.locked=false;
      nl.layerType=l.layerType;
      nl.keyframes=[];
      // A blank span before the scene starts, so nothing shows early.
      if(at>1){
        var pre=new KeyFrame(1);
        pre.duration=at-1;
        nl.keyframes.push(pre);
      }
      l.keyframes.forEach(function(k){
        var c=k.clone();
        c.index=k.index+at-1;
        nl.keyframes.push(c);
      });
      // …and one after it ends, so it does not linger into the next scene.
      var tail=new KeyFrame(at+len);
      tail.duration=1;
      nl.keyframes.push(tail);
      out.push(nl);
    });
    at+=len;
  });
  // Labels last so they are the top layer and cannot be caught in a mask run.
  out.push(labelLayer);
  return out;
}

/** Total frames once the scenes are laid end to end. */
function moviesTotalFrames(){
  var scenes=docScenes();
  if(scenes.length<2)return Math.max(1,doc.totalFrames||1);
  // The live scene's length is on `doc`, not on its record.
  parkCurrentScene();
  var n=0;
  scenes.forEach(function(s){n+=sceneLength(s);});
  return Math.max(1,n);
}

/**
 * Layers that reach the OUTPUT.
 *
 * A guide layer is reference art — a traced photo, a motion path, a
 * registration cross — and the whole point of marking one is that it does not
 * appear in the movie. It was marked, saved, and exported anyway. A folder
 * holds no artwork of its own either.
 */
function outputLayers(layers){
  return (layers||[]).filter(function(l){
    var t=(l&&l.layerType)||"normal";
    /* A motion guide is KEPT here even though it never draws: a guided layer
       finds its guide by position in this list, so filtering it out before
       the interpolator runs would leave every guided tween travelling in a
       straight line in the export while curving on the stage. frameObjects()
       is what refuses to draw it. */
    return t!=="guide"&&t!=="folder";
  });
}
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
  var fw=TL_FW_();
  var rowLayout=layerRowLayout(layers);
  var maxF=currentMaxFrame()+10;
  var totalW=maxF*fw;
  var totalH=rowLayout.total;

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
  // frames per layer, over the ROWS rather than the layer array: a collapsed
  // folder's contents have no row, and rows are not all the same height.
  rowLayout.rows.forEach(function(rowInfo){
    var l=rowInfo.layer,li=rowInfo.index;
    var y=rowInfo.y,fh=rowInfo.h;
    // Rows scrolled out of view cost nothing.
    if(y+fh<sy||y>bottom)return;
    if(isFolderLayer(l)){
      // A folder has no keyframes of its own; its row is a band, so the
      // layers it holds read as belonging to it.
      tlCtx.fillStyle=li===curLayer?"#3A3A46":"#323238";
      tlCtx.fillRect(sx,y,vw,fh);
      tlCtx.strokeStyle="#4A4A52";tlCtx.lineWidth=1;
      tlCtx.beginPath();tlCtx.moveTo(sx,y+fh-0.5);tlCtx.lineTo(right,y+fh-0.5);tlCtx.stroke();
      return;
    }
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
      /* Frame labels, drawn as Flash drew them: a little flag at the keyframe
         and the name trailing after it. A label you cannot see is a label you
         forget you set — and the three kinds are coloured apart because a
         comment behaves completely differently from a name. */
      if(kf.label&&fw>=4){
        var lx=(kf.index-1)*fw;
        if(lx<=right&&lx+60>=sx){
          var kind=kf.labelType||"name";
          var col=kind==="comment"?"#7FD08A":(kind==="anchor"?"#C58BE8":"#E8C14A");
          tlCtx.save();
          tlCtx.fillStyle=col;
          if(kind==="comment"){
            // A comment gets a slash rather than a flag: it is not a target.
            tlCtx.beginPath();
            tlCtx.moveTo(lx+1,y+fh-3);tlCtx.lineTo(lx+5,y+3);
            tlCtx.lineWidth=1.5;tlCtx.strokeStyle=col;tlCtx.stroke();
          }else{
            tlCtx.beginPath();
            tlCtx.moveTo(lx+1.5,y+2);
            tlCtx.lineTo(lx+1.5,y+9);
            tlCtx.lineTo(lx+7,y+5.5);
            tlCtx.closePath();
            tlCtx.fill();
          }
          tlCtx.font="9px Tahoma,Arial,sans-serif";
          tlCtx.fillStyle=col;
          tlCtx.textBaseline="top";
          tlCtx.fillText(kf.label,lx+9,y+1);
          tlCtx.restore();
        }
      }
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
    // Row geometry, not index * height: rows differ in height and a collapsed
    // folder's children have none at all.
    var ry=TL_HDR,rh=0;
    for(var ri=0;ri<rowLayout.rows.length;ri++){
      var rr=rowLayout.rows[ri];
      if(rr.index===selR.l0)ry=rr.y;
      if(rr.index>=selR.l0&&rr.index<=selR.l1)rh+=rr.h;
    }
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

  var onBtn=document.getElementById("tlOnion");
  var onOut=document.getElementById("tlOnionOutline");
  var onBef=document.getElementById("tlOnionBefore");
  var onAft=document.getElementById("tlOnionAfter");
  if(onBtn)onBtn.addEventListener("click",function(){doAction("onionToggle");});
  if(onOut)onOut.addEventListener("click",function(){doAction("onionOutlines");});
  /* Typing a count turns onion skin ON: setting a range and seeing nothing
     happen because the master toggle was off is a dead end people do not
     recover from on their own. */
  if(onBef)onBef.addEventListener("change",function(){
    onionBefore=Math.max(0,Math.min(12,parseInt(onBef.value,10)||0));
    if(onionBefore||onionAfter)onionOn=true;
    updateOnionUI();render();
  });
  if(onAft)onAft.addEventListener("change",function(){
    onionAfter=Math.max(0,Math.min(12,parseInt(onAft.value,10)||0));
    if(onionBefore||onionAfter)onionOn=true;
    updateOnionUI();render();
  });
  updateOnionUI();

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
    var layers=currentLayers();
    var li=layerAtY(my,layers);
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
      var sl=layerAtY(sp.y,layers);
      if(sl<0)sl=Math.max(0,Math.min(layers.length-1,tlSelRange?tlSelRange.endLayerIdx:0));
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
    var layers=currentLayers();
    var li=layerAtY(pos.y,layers);
    if(li>=0&&li<layers.length)curLayer=li;
    curFrame=f;
    if(isFlashFile(files[0]))importFlashFile(files[0]);
    else if(String(files[0].type).indexOf("image/")===0)importImageFile(files[0]);
    else importSoundFile(files[0]);
  });
  // Right-click context menu on timeline
  tc.addEventListener("contextmenu",function(e){
    e.preventDefault();
    var pos=tlPos(e);
    var f=Math.max(1,Math.floor(pos.x/TL_FW_())+1);
    var layers=currentLayers();
    var li=layerAtY(pos.y,layers);
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

/* An angle typed into a field, kept inside 0..360. Out of range wraps rather
   than clamping, so typing -90 means 270 and 450 means 90 — which is what a
   rotating dial does and what Flash accepted. */
function clampDeg(v){
  var n=parseFloat(v);
  if(!isFinite(n))return 0;
  n=n%360;
  if(n<0)n+=360;
  // 360 typed in means a whole turn, not nothing.
  if(n===0&&parseFloat(v)>=360)return 360;
  return n;
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
      /* 9-slice lives on the LIBRARY entry, not the instance — it is a
         property of the artwork, and every instance of a button wants the
         same corners. The inspector says so and offers the way in rather than
         repeating the four fields per instance. */
      if(sym){
        var sliced9=window.Flashy&&Flashy.Slice9&&Flashy.Slice9.active(sym.scale9);
        row("9-slice",sliced9?"on":"off",function(){},{type:"readonly"});
        actionRow([{label:"Symbol Properties…",onClick:function(){
          showSymbolPropsDialog(o.symbolName);
        }}]);
        if(sliced9){
          note("Corners keep their size when this instance is scaled; only the "+
               "middles stretch. The guides are shared by every instance.");
        }
      }

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

    /* ── Rectangle corners ──
       Flash's Rectangle tool carried a corner-radius setting; the shape stayed
       a rectangle you could re-round at any time rather than becoming a frozen
       outline. Same here: the radius is a property, and every render path
       resolves it through Flashy.Primitives. */
    if(o.type==="rect"){
      sect("Rectangle");
      var maxR=Math.min(Math.abs(o.width||0),Math.abs(o.height||0))/2;
      sliderRow("Corner radius",Math.min(o.cornerRadius||0,maxR),0,Math.max(1,maxR),0.5,function(v){
        pushUndo();o.cornerRadius=v;render();
      },{unit:"px"});
      note("0 is a square corner. The radius is clamped to half the shorter "+
           "side, so a square at full radius is a circle.");
    }

    /* ── Oval start, end and inner radius ──
       Flash 8's Oval Primitive tool: an arc, a pie wedge or a donut without
       leaving the oval behind. ovalStart/ovalEnd are degrees clockwise from
       12 o'clock; ovalInner is a percentage of the radius. */
    if(o.type==="oval"){
      sect("Oval");
      row("Start angle",o.ovalStart||0,function(v){
        pushUndo();o.ovalStart=clampDeg(v);render();updateProps();
      },{width:"50px",unit:"°"});
      row("End angle",o.ovalEnd==null?360:o.ovalEnd,function(v){
        pushUndo();o.ovalEnd=clampDeg(v);render();updateProps();
      },{width:"50px",unit:"°"});
      sliderRow("Inner radius",o.ovalInner||0,0,99,1,function(v){
        pushUndo();o.ovalInner=v;render();
      },{unit:"%"});
      if((o.ovalStart||0)!==0||(o.ovalEnd==null?360:o.ovalEnd)!==360){
        note("A partial oval. With an inner radius it is an arc band; without "+
             "one it is a pie wedge closed through the centre.");
      }else if((o.ovalInner||0)>0){
        note("A donut: the inner loop is a hole, cut by the even-odd rule in "+
             "every render path including the export.");
      }
    }

    /* Fill and stroke belong to the artwork, not to a symbol instance —
       the shapes inside the symbol carry their own. A bitmap has neither: it
       is pixels. Showing dead controls above the frame picker is noise in
       exactly the workflow (lip sync, posing) where the frame picker gets
       used most. */
    if(o.type!=="symbol"&&o.type!=="bitmap"){
    // ── Fill ──
    sect("Fill");
    /* Linear and Radial are here because an imported movie brings them; there
       is no stop editor yet, so switching away from one is a one-way trip —
       it keeps the first stop's colour as the flat fill. */
    row("Type",o.fillType||"solid",function(v){
      pushUndo();
      if(isGradient(o)&&v!=="linear"&&v!=="radial"){
        o.fillColor="#"+("000000"+((o.fillStops[1]|0)&0xffffff).toString(16)).slice(-6);
        o.fillStops=null;o.fillGrad=null;
      }
      o.fillType=v;render();updateProps();
    },{type:"select",width:"80px",options:[["solid","Solid"],["none","None"],["linear","Linear"],["radial","Radial"]]});
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
      /* Which KIND of field this is, first — it changes what everything below
         means. A static field is drawn and forgotten; a dynamic one has a name
         so a script can write to it; an input one can be typed into. Without
         the last two there is no score display, no form and no typed-in
         name. */
      row("Text type",o.textType||"static",function(v){
        pushUndo();
        o.textType=v;
        // A field you can type into wants a box you can see; a caption does
        // not. Flash defaulted the same way.
        if(v==="input"&&!o.textBorder){o.textBorder=true;o.textBackground=true;}
        if(v!=="static"&&(o.lineType||"single")==="single"&&o.height>(o.fontSize||24)*2){
          o.lineType="multiline";
        }
        fullRefresh();
      },{type:"select",width:"90px",options:[
        ["static","Static"],["dynamic","Dynamic"],["input","Input"]
      ]});
      if(o.textType==="dynamic"||o.textType==="input"){
        row("Instance",o.instanceName||"",function(v){
          pushUndo();o.instanceName=String(v||"").trim();fullRefresh();
        },{width:"90px"});
        row("Variable",o.variableName||"",function(v){
          pushUndo();o.variableName=String(v||"").trim();fullRefresh();
        },{width:"90px"});
        /* `root.name`, not a bare `name`: a JavaScript frame script has no
           scope chain to resolve a bare identifier through, and quietly
           wrapping somebody's JavaScript in `with(root)` to fake one would
           change the meaning of every other name in their script. An imported
           movie's ActionScript does resolve bare names, because AS2 has the
           scope chain this does not. */
        note(o.instanceName
          ? "In a frame script: root."+o.instanceName+".text = \"…\" writes to this field"+
            (o.textType==="input"?", and reads what was typed.":".")
          : "Give it an instance name and a script can write to it.");
        row("Line type",o.lineType||"single",function(v){
          pushUndo();o.lineType=v;fullRefresh();
        },{type:"select",width:"110px",options:[
          ["single","Single line"],["multiline","Multiline"],
          ["multilineNoWrap","Multiline, no wrap"],["password","Password"]
        ]});
        if(o.textType==="input"){
          row("Max chars",o.maxChars||0,function(v){
            pushUndo();o.maxChars=Math.max(0,parseInt(v,10)||0);fullRefresh();
          },{type:"number",width:"50px",unit:"0 = no limit"});
        }
      }else{
        row("Line type",o.lineType||"single",function(v){
          pushUndo();o.lineType=v;fullRefresh();
        },{type:"select",width:"110px",options:[
          ["single","Single line"],["multiline","Multiline"],
          ["multilineNoWrap","Multiline, no wrap"]
        ]});
      }
      row("Selectable",!!o.selectable,function(v){
        pushUndo();o.selectable=v;fullRefresh();
      },{type:"checkbox"});
      row("Border",!!o.textBorder,function(v){
        pushUndo();o.textBorder=v;fullRefresh();
      },{type:"checkbox"});
      if(o.textBorder){
        colorRow("Border color",o.textBorderColor||"#000000",function(nc){
          pushUndo();o.textBorderColor=nc;render();
        });
      }
      row("Background",!!o.textBackground,function(v){
        pushUndo();o.textBackground=v;fullRefresh();
      },{type:"checkbox"});
      if(o.textBackground){
        colorRow("Background color",o.textBackgroundColor||"#FFFFFF",function(nc){
          pushUndo();o.textBackgroundColor=nc;render();
        });
      }
      row("Letter spacing",o.letterSpacing||0,function(v){
        pushUndo();o.letterSpacing=parseFloat(v)||0;render();
      },{width:"45px",unit:"px"});
      /* Anti-alias mode is a hint, not a renderer: the canvas has one text
         rasteriser and no way to pick another, so this records the intent for
         a future SWF export rather than pretending to change the pixels. */
      row("Anti-alias",o.antiAlias||"normal",function(v){
        pushUndo();o.antiAlias=v;fullRefresh();
      },{type:"select",width:"110px",options:[
        ["device","Use device fonts"],["normal","Anti-alias for animation"],
        ["readability","Anti-alias for readability"],["bitmap","Bitmap text (no anti-alias)"]
      ]});
      if((o.antiAlias||"normal")!=="normal"){
        note("Recorded with the field. The canvas has one text rasteriser, so "+
             "this does not change how it draws here.");
      }
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

    /* Colour Effect and Filters, at the bottom of the inspector where Flash 8
       put them — below everything that describes what the object IS, because
       these describe how it is PRESENTED. They apply to any object type,
       including a group or a symbol instance. */
    buildColorEffectSection(pp,o,sect,row,sliderRow,colorRow,note);
    buildFiltersSection(pp,o,sect,note);

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

      /* Frame label and its kind. `kf.label` has been stored, serialized and
         read by the exporter since frame scripts arrived, and there was no way
         to set one — which made `gotoAndPlay("menu")` unreachable from the
         authoring side. */
      row("Label",skf.label||"",function(v){
        pushUndo();skf.label=String(v||"").trim();fullRefresh();
      },{width:"90px"});
      if(skf.label){
        row("Label type",skf.labelType||"name",function(v){
          pushUndo();skf.labelType=v;fullRefresh();
        },{type:"select",width:"90px",options:[
          ["name","Name"],["comment","Comment"],["anchor","Anchor"]
        ]});
        note((skf.labelType||"name")==="comment"
          ? "A comment is an authoring note. It is not exported, so no script can jump to it."
          : "Exported as a timeline label, so gotoAndPlay(\""+skf.label+"\") works.");
      }

      if(skf.tweenType&&skf.tweenType!=="none"){
        row("Easing",skf.easing||"linear",function(v){
          pushUndo();
          skf.easing=v;
          // Switching to Custom needs a curve to edit; an ease-out-ish default
          // beats a straight line that looks like nothing happened.
          if(v==="custom"&&!skf.easeBezier)skf.easeBezier=[0.25,0.1,0.25,1];
          fullRefresh();
        },{type:"select",width:"100px",options:[
          ["linear","linear"],["quadIn","quadIn"],["quadOut","quadOut"],["quadInOut","quadInOut"],
          ["cubicIn","cubicIn"],["cubicOut","cubicOut"],["cubicInOut","cubicInOut"],
          ["sineIn","sineIn"],["sineOut","sineOut"],["sineInOut","sineInOut"],
          ["expoOut","expoOut"],["backOut","backOut"],["elasticOut","elasticOut"],["bounceOut","bounceOut"],
          ["custom","custom curve…"]
        ]});
        if(skf.easing==="custom")buildEasingEditor(pp,skf,note);

        /* Rotate CW/CCW x n. Without it a tween always takes the short way
           round, so a wheel cannot be made to turn: 0 to 350 degrees rolls
           backwards and 0 to 360 does not move at all. */
        row("Rotate",skf.rotateDir||"none",function(v){
          pushUndo();skf.rotateDir=v;fullRefresh();
        },{type:"select",width:"90px",options:[
          ["none","Auto (shortest)"],["cw","Clockwise"],["ccw","Counter-clockwise"]
        ]});
        if(skf.rotateDir&&skf.rotateDir!=="none"){
          row("Turns",skf.rotateTimes||1,function(v){
            pushUndo();skf.rotateTimes=Math.max(1,parseInt(v,10)||1);fullRefresh();
          },{type:"number",width:"45px"});
        }
        row("Scale",skf.tweenScale!==false,function(v){
          pushUndo();skf.tweenScale=v;fullRefresh();
        },{type:"checkbox"});
        /* Orient to Path only means anything on a guided layer, so it is only
           offered there — an always-visible checkbox that does nothing most of
           the time is worse than no checkbox. */
        var guidedLayer=currentLayers()[selectedKF.layerIdx];
        if(guidedLayer&&(guidedLayer.layerType||"normal")==="guided"){
          row("Orient to path",!!skf.orientToPath,function(v){
            pushUndo();skf.orientToPath=v;fullRefresh();
          },{type:"checkbox"});
          note("The difference between a leaf blowing past and a leaf tumbling.");
        }
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
        /* Sync, including STOP — which was in the save format and honoured by
           nothing, so "stop the music here" did nothing at all. Start is
           Flash's "play it unless it is already playing". */
        row("Sync",skf.sound.sync||"stream",function(v){
          pushUndo();skf.sound.sync=v;fullRefresh();
        },{type:"select",width:"90px",options:[
          ["stream","Stream"],["event","Event"],["start","Start"],["stop","Stop"]
        ]});
        if((skf.sound.sync||"stream")==="stop"){
          note("This keyframe silences “"+skf.sound.asset+"” — including a copy "+
               "of it started earlier as an Event sound. It plays nothing itself.");
        }
        row("Volume",Math.round((skf.sound.volume!=null?skf.sound.volume:1)*100),function(v){
          pushUndo();skf.sound.volume=Math.max(0,Math.min(100,parseFloat(v)||0))/100;
        },{type:"number",width:"60px"});
        if((skf.sound.sync||"stream")!=="stop"){
          row("Effect",skf.sound.effect||"none",function(v){
            pushUndo();
            setSoundEffect(skf.sound,v);
            fullRefresh();
          },{type:"select",width:"130px",options:SOUND_EFFECTS});
          /* Loop and a repeat count are different things, and Flash offered
             both: "loop" is forever, "repeat 3" is three times and then
             silence. A boolean alone cannot say the second. */
          row("Loop",!!skf.sound.loop,function(v){
            pushUndo();
            skf.sound.loop=!!v;
            if(v)skf.sound.repeat=0;
            fullRefresh();
          },{type:"checkbox"});
          if(!skf.sound.loop){
            row("Repeat",skf.sound.repeat||1,function(v){
              pushUndo();
              skf.sound.repeat=Math.max(1,Math.min(99,parseInt(v,10)||1));
              fullRefresh();
            },{type:"number",width:"50px",unit:"times"});
          }
          actionRow([
            {label:"Edit Envelope…",onClick:function(){showSoundEnvelopeDialog();}}
          ]);
        }
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
      /* "Masked" is the other half of a mask: the layer being clipped. Flash
         linked them by indentation; here the pair is a mask layer and the
         run of masked layers directly beneath it. */
      row("Type",curLayerObj.layerType||"normal",function(v){pushUndo();curLayerObj.layerType=v;fullRefresh();},
        {type:"select",width:"80px",options:[["normal","Normal"],["guide","Guide"],
          ["folder","Folder"],["mask","Mask"],["masked","Masked"],
          ["motionguide","Motion Guide"],["guided","Guided"]]});
      if((curLayerObj.layerType||"normal")==="motionguide"){
        note("Draw one stroke on this layer. The Guided layers directly beneath "+
             "it will follow it instead of moving in a straight line.");
      }else if((curLayerObj.layerType||"normal")==="guided"){
        var gl=motionGuideFor(currentLayers(),curLayerObj);
        note(gl?"Following the motion guide above. Turn on Orient to Path on the "+
                "keyframe to make it face along the path."
               :"No motion guide above this layer yet — set the layer above it to "+
                "Motion Guide and draw a stroke on it.");
      }
      if((curLayerObj.layerType||"normal")==="guide"){
        note("A guide layer is reference art: it shows on the stage and in "+
             "onion skin, and it is left out of every export.");
      }
      row("Outline view",!!curLayerObj.outlines,function(v){
        pushUndo();curLayerObj.outlines=v;fullRefresh();
      },{type:"checkbox"});
      row("Indent",curLayerObj.indent||0,function(v){
        pushUndo();
        curLayerObj.indent=Math.max(0,Math.min(8,parseInt(v,10)||0));
        fullRefresh();
      },{type:"number",width:"45px"});

      // Outline color
      colorRow("Outline",curLayerObj.outlineColor||"#4488CC",function(nc){
        pushUndo();curLayerObj.outlineColor=nc;fullRefresh();
      });

      // Layer height
      // fullRefresh, not nothing: the layer row and the timeline canvas both
      // read layerHeight now, and neither repaints on its own.
      row("Height",curLayerObj.layerHeight||"normal",function(v){
        pushUndo();curLayerObj.layerHeight=v;fullRefresh();
      },{type:"select",width:"80px",options:[["short","Short"],["normal","Normal"],["tall","Tall"]]});

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

/* ------------------------------------------------------------------ *
 * Colour Effect and Filters, in the Property inspector
 *
 * Flash 8's two presentation controls. They apply to any object — a shape, a
 * group, a symbol instance — and they are what made late-era Flash content
 * look the way it did.
 *
 * Both sections are rebuilt from the object on every refresh, like the rest of
 * the inspector, and every control takes its own undo snapshot, so dragging a
 * blur radius is one undoable change rather than forty.
 * ------------------------------------------------------------------ */

/** The filters a user can add, with the defaults Flash shipped. */
var FILTER_TYPES=[
  {type:"dropShadow",label:"Drop Shadow",
   make:function(){return {type:"dropShadow",enabled:true,distance:5,angle:45,
     blur:5,color:0x000000,alpha:0.5,strength:1};}},
  {type:"blur",label:"Blur",
   make:function(){return {type:"blur",enabled:true,blurX:5,blurY:5};}},
  {type:"glow",label:"Glow",
   make:function(){return {type:"glow",enabled:true,blur:6,color:0xFF3366,
     alpha:1,strength:2};}},
  {type:"bevel",label:"Bevel",
   make:function(){return {type:"bevel",enabled:true,distance:4,angle:45,blur:4,
     highlightColor:0xFFFFFF,shadowColor:0x000000,strength:1};}},
  {type:"gradientGlow",label:"Gradient Glow",
   make:function(){return {type:"gradientGlow",enabled:true,blur:10,angle:45,
     strength:1,stops:[{ratio:0,color:0xFFFFFF,alpha:0},
                       {ratio:255,color:0xFF3366,alpha:1}]};}},
  {type:"gradientBevel",label:"Gradient Bevel",
   make:function(){return {type:"gradientBevel",enabled:true,distance:5,angle:45,
     blur:6,strength:1,stops:[{ratio:0,color:0x000000,alpha:0.7},
                              {ratio:128,color:0x808080,alpha:0},
                              {ratio:255,color:0xFFFFFF,alpha:0.9}]};}},
  {type:"adjustColor",label:"Adjust Color",
   make:function(){return {type:"adjustColor",enabled:true,brightness:0,
     contrast:0,saturation:0,hue:0};}}
];

/** The editable fields of one filter: [key, label, min, max, step, kind]. */
var FILTER_FIELDS={
  dropShadow:[["distance","Distance",-100,100,1,"num"],["angle","Angle",0,360,1,"num"],
              ["blur","Blur",0,100,1,"num"],["alpha","Alpha",0,1,0.01,"pct"],
              ["color","Color",0,0,0,"color"]],
  blur:[["blurX","Blur X",0,100,1,"num"],["blurY","Blur Y",0,100,1,"num"]],
  glow:[["blur","Blur",0,100,1,"num"],["strength","Strength",1,4,1,"num"],
        ["alpha","Alpha",0,1,0.01,"pct"],["color","Color",0,0,0,"color"]],
  bevel:[["distance","Distance",-100,100,1,"num"],["angle","Angle",0,360,1,"num"],
         ["blur","Blur",0,100,1,"num"],
         ["highlightColor","Highlight",0,0,0,"color"],
         ["shadowColor","Shadow",0,0,0,"color"]],
  /* The gradient pair have no colour FIELD: their colour is the ramp, which
     gets its own editor below the numbers. */
  gradientGlow:[["blur","Blur",0,100,1,"num"],["angle","Angle",0,360,1,"num"],
                ["strength","Strength",0,4,0.1,"num"]],
  gradientBevel:[["distance","Distance",-100,100,1,"num"],["angle","Angle",0,360,1,"num"],
                 ["blur","Blur",0,100,1,"num"],["strength","Strength",0,4,0.1,"num"]],
  adjustColor:[["brightness","Brightness",-100,100,1,"num"],
               ["contrast","Contrast",-100,100,1,"num"],
               ["saturation","Saturation",-100,100,1,"num"],
               ["hue","Hue",-180,180,1,"num"]]
};

function hexFromFilterColor(v,dflt){
  if(typeof v==="string")return v;
  var n=v==null?dflt:(v|0);
  return "#"+("000000"+((n|0)&0xffffff).toString(16)).slice(-6).toUpperCase();
}
function filterColorFromHex(h){
  return parseInt(String(h).replace("#",""),16)|0;
}

function buildFiltersSection(pp,o,sect,note){
  sect("Filters");
  var filters=o.filters||[];

  var addRow=document.createElement("div");
  addRow.className="props-row";
  addRow.style.cssText="flex-wrap:wrap;gap:2px";
  var addSel=document.createElement("select");
  addSel.className="props-select";
  addSel.style.width="110px";
  var ph=document.createElement("option");
  ph.value="";ph.textContent="Add filter…";
  addSel.appendChild(ph);
  FILTER_TYPES.forEach(function(ft){
    var op=document.createElement("option");
    op.value=ft.type;op.textContent=ft.label;
    addSel.appendChild(op);
  });
  addSel.addEventListener("change",function(){
    var ft=FILTER_TYPES.filter(function(f){return f.type===addSel.value;})[0];
    addSel.value="";
    if(!ft)return;
    pushUndo();
    if(!o.filters)o.filters=[];
    o.filters.push(ft.make());
    fullRefresh();
  });
  addRow.appendChild(addSel);
  pp.appendChild(addRow);

  if(!filters.length){
    note("No filters. Drop Shadow, Blur, Glow, Bevel, Gradient Glow, Gradient "+
         "Bevel and Adjust Color apply to shapes, groups and symbol instances "+
         "alike, and tween between keyframes.");
    return;
  }

  filters.forEach(function(f,idx){
    var head=document.createElement("div");
    head.className="props-row filter-head";

    var en=document.createElement("input");
    en.type="checkbox";
    en.checked=f.enabled!==false;
    en.title="Turn this filter off without losing its settings";
    en.style.cssText="accent-color:#4488CC";
    en.addEventListener("change",function(){
      pushUndo();f.enabled=en.checked;fullRefresh();
    });
    head.appendChild(en);

    var name=document.createElement("span");
    name.className="props-label";
    name.style.cssText="flex:1;text-align:left";
    var label=FILTER_TYPES.filter(function(t){return t.type===f.type;})[0];
    name.textContent=label?label.label:f.type;
    head.appendChild(name);

    // Order matters for a filter stack — a glow on a blurred shape is not a
    // blurred glow — so it has to be reorderable.
    [["▲","Move up",-1],["▼","Move down",1]].forEach(function(b){
      var btn=document.createElement("button");
      btn.className="props-btn-action";
      btn.style.cssText="min-width:18px;padding:0 4px";
      btn.textContent=b[0];btn.title=b[1];
      btn.addEventListener("click",function(){
        var to=idx+b[2];
        if(to<0||to>=o.filters.length)return;
        pushUndo();
        var tmp=o.filters[idx];o.filters[idx]=o.filters[to];o.filters[to]=tmp;
        fullRefresh();
      });
      head.appendChild(btn);
    });
    var del=document.createElement("button");
    del.className="props-btn-action";
    del.style.cssText="min-width:18px;padding:0 4px";
    del.textContent="✕";del.title="Remove this filter";
    del.addEventListener("click",function(){
      pushUndo();
      o.filters.splice(idx,1);
      if(!o.filters.length)o.filters=null;
      fullRefresh();
    });
    head.appendChild(del);
    pp.appendChild(head);

    (FILTER_FIELDS[f.type]||[]).forEach(function(fd){
      var key=fd[0];
      if(fd[5]==="color"){
        var cr=document.createElement("div");
        cr.className="props-color-row";
        var cl=document.createElement("span");
        cl.className="props-label";cl.textContent=fd[1]+":";
        cr.appendChild(cl);
        var sw=document.createElement("span");
        sw.className="props-swatch";
        var hex=hexFromFilterColor(f[key],0);
        sw.style.backgroundColor=hex;
        sw.addEventListener("click",function(e){
          e.stopPropagation();
          showCP(hex,function(nc){
            pushUndo();f[key]=filterColorFromHex(nc);fullRefresh();
          });
        });
        cr.appendChild(sw);
        pp.appendChild(cr);
        return;
      }
      var r=document.createElement("div");
      r.className="props-slider-row";
      var lb=document.createElement("label");
      lb.className="props-label";lb.textContent=fd[1]+":";
      r.appendChild(lb);
      var sl=document.createElement("input");
      sl.type="range";sl.className="props-slider";
      sl.min=fd[2];sl.max=fd[3];sl.step=fd[4];
      sl.value=f[key]==null?0:f[key];
      r.appendChild(sl);
      var ni=document.createElement("input");
      ni.className="props-input";ni.type="text";
      var show=function(v){
        return fd[5]==="pct"?Math.round(v*100):Math.round(v*100)/100;
      };
      ni.value=show(f[key]==null?0:f[key]);
      r.appendChild(ni);
      /* One undo snapshot per DRAG, not per pointer move: a slider fires on
         every pixel, and forty undo steps for one blur adjustment makes undo
         useless. The snapshot is taken when the drag starts. */
      var pre=null;
      sl.addEventListener("pointerdown",function(){pre=snap();});
      sl.addEventListener("input",function(){
        f[key]=parseFloat(sl.value);
        ni.value=show(f[key]);
        render();
      });
      sl.addEventListener("change",function(){
        if(pre){pushUndoSnap(pre);pre=null;}
        else touchDoc();
        updateProps();
      });
      ni.addEventListener("change",function(){
        var v=parseFloat(ni.value);
        if(isNaN(v))return;
        if(fd[5]==="pct")v=v/100;
        pushUndo();
        f[key]=Math.max(fd[2],Math.min(fd[3],v));
        fullRefresh();
      });
      pp.appendChild(r);
    });

    /* ── The ramp ──
       Gradient Glow and Gradient Bevel have no single colour: their colour is
       a ramp, indexed by the blurred alpha of the object's own silhouette. The
       editor is a preview strip plus one row per stop, because a stop is three
       things (where, what colour, how opaque) and a strip alone can only drag
       the first. */
    if(f.type==="gradientGlow"||f.type==="gradientBevel"){
      var stops=f.stops&&f.stops.length?f.stops:(f.stops=[
        {ratio:0,color:0xFFFFFF,alpha:0},{ratio:255,color:0xFF3366,alpha:1}]);

      var strip=document.createElement("canvas");
      strip.className="props-ramp";
      strip.width=176;strip.height=14;
      strip.title="The glow's colour, from the faintest edge of the blur on the "+
                  "left to the solid silhouette on the right";
      strip.style.cssText="width:176px;height:14px;display:block;margin:2px auto;"+
                          "border:1px solid #1a1a1a;border-radius:2px";
      // The SAME ramp the painter uses, so the strip cannot lie about it.
      var rampData=Flashy.Filters.ramp(f);
      var sctx=strip.getContext("2d");
      // A checkerboard behind it, or a transparent stop looks like a white one.
      for(var cxk=0;cxk<strip.width;cxk+=7){
        for(var cyk=0;cyk<strip.height;cyk+=7){
          sctx.fillStyle=((cxk/7+cyk/7)%2)?"#3a3a3a":"#2a2a2a";
          sctx.fillRect(cxk,cyk,7,7);
        }
      }
      for(var sxk=0;sxk<strip.width;sxk++){
        var at=Math.round((sxk/(strip.width-1))*255)*4;
        sctx.fillStyle="rgba("+rampData[at]+","+rampData[at+1]+","+
                       rampData[at+2]+","+(rampData[at+3]/255)+")";
        sctx.fillRect(sxk,0,1,strip.height);
      }
      pp.appendChild(strip);

      stops.forEach(function(st,si){
        var sr=document.createElement("div");
        sr.className="props-row filter-stop";

        var sw2=document.createElement("span");
        sw2.className="props-swatch";
        var shex=hexFromFilterColor(st.color,0xFFFFFF);
        sw2.style.backgroundColor=shex;
        sw2.title="This stop's colour";
        sw2.addEventListener("click",function(ev){
          ev.stopPropagation();
          showCP(shex,function(nc){
            pushUndo();st.color=filterColorFromHex(nc);fullRefresh();
          });
        });
        sr.appendChild(sw2);

        // Where along the ramp, 0 to 255 — Flash's own units for a stop.
        var pos=document.createElement("input");
        pos.className="props-input";pos.type="text";
        pos.style.width="36px";
        pos.value=Math.round(st.ratio==null?0:st.ratio);
        pos.title="Position, 0 to 255";
        pos.addEventListener("change",function(){
          var v=parseFloat(pos.value);
          if(isNaN(v))return;
          pushUndo();
          st.ratio=Math.max(0,Math.min(255,v));
          fullRefresh();
        });
        sr.appendChild(pos);

        var al2=document.createElement("input");
        al2.type="range";al2.className="props-slider";
        al2.min=0;al2.max=1;al2.step=0.01;
        al2.value=st.alpha==null?1:st.alpha;
        al2.title="This stop's opacity";
        var pre2=null;
        al2.addEventListener("pointerdown",function(){pre2=snap();});
        al2.addEventListener("input",function(){
          st.alpha=parseFloat(al2.value);render();
        });
        al2.addEventListener("change",function(){
          if(pre2){pushUndoSnap(pre2);pre2=null;}else touchDoc();
          updateProps();
        });
        sr.appendChild(al2);

        var rm=document.createElement("button");
        rm.className="props-btn-action";
        rm.style.cssText="min-width:18px;padding:0 4px";
        rm.textContent="✕";
        // Two stops is the minimum a ramp can be; one is a flat colour, and a
        // flat-coloured gradient glow is just the Glow filter.
        rm.title=stops.length>2?"Remove this stop":"A ramp needs at least two stops";
        rm.disabled=stops.length<=2;
        rm.addEventListener("click",function(){
          if(stops.length<=2)return;
          pushUndo();
          f.stops.splice(si,1);
          fullRefresh();
        });
        sr.appendChild(rm);
        pp.appendChild(sr);
      });

      var addStop=document.createElement("div");
      addStop.className="props-row";
      var asb=document.createElement("button");
      asb.className="props-btn-action";
      asb.textContent="+ Stop";
      asb.title="Add a stop midway along the ramp";
      asb.addEventListener("click",function(){
        pushUndo();
        /* Midway between the two widest-apart neighbours, taking the colour
           the ramp already has there — so adding a stop does not change the
           glow, it just gives you somewhere to grab. */
        var sorted=f.stops.slice().sort(function(a,b){return a.ratio-b.ratio;});
        var gapAt=0,gap=-1;
        for(var gi=0;gi<sorted.length-1;gi++){
          var d=sorted[gi+1].ratio-sorted[gi].ratio;
          if(d>gap){gap=d;gapAt=gi;}
        }
        var mid=Math.round((sorted[gapAt].ratio+sorted[gapAt+1].ratio)/2);
        var rd=Flashy.Filters.ramp(f);
        f.stops.push({ratio:mid,
          color:(rd[mid*4]<<16)|(rd[mid*4+1]<<8)|rd[mid*4+2],
          alpha:rd[mid*4+3]/255});
        f.stops.sort(function(a,b){return a.ratio-b.ratio;});
        fullRefresh();
      });
      addStop.appendChild(asb);
      pp.appendChild(addStop);
    }
  });
}

function buildColorEffectSection(pp,o,sect,row,sliderRow,colorRow,note){
  sect("Color Effect");
  var ce=o.colorEffect||{mode:"none"};
  row("Style",ce.mode||"none",function(v){
    pushUndo();
    if(v==="none"){o.colorEffect=null;}
    else{
      // Each mode gets a sensible starting point, so picking Tint shows a
      // tint rather than an invisible no-op at zero strength.
      o.colorEffect=v==="brightness"?{mode:"brightness",brightness:0.2}
        :v==="tint"?{mode:"tint",color:0xFF3366,amount:0.5}
        :{mode:"advanced",rMul:1,gMul:1,bMul:1,aMul:1,rOff:0,gOff:0,bOff:0,aOff:0};
    }
    fullRefresh();
  },{type:"select",width:"100px",options:[
    ["none","None"],["brightness","Brightness"],["tint","Tint"],["advanced","Advanced"]
  ]});

  if(!o.colorEffect)return;
  var e=o.colorEffect;
  if(e.mode==="brightness"){
    sliderRow("Brightness",e.brightness||0,-1,1,0.01,function(v){
      e.brightness=v;touchDoc();render();
    },{percent:true,unit:"%"});
    note("Positive fades towards white, negative towards black — the same "+
         "multiply-and-offset Flash used, not a plain multiply.");
  }else if(e.mode==="tint"){
    colorRow("Tint",hexFromFilterColor(e.color,0xFF3366),function(nc){
      pushUndo();e.color=filterColorFromHex(nc);fullRefresh();
    });
    sliderRow("Amount",e.amount==null?1:e.amount,0,1,0.01,function(v){
      e.amount=v;touchDoc();render();
    },{percent:true,unit:"%"});
  }else if(e.mode==="advanced"){
    note("Per channel: the artwork's value times the multiplier, plus the offset. "+
         "This is Flash's real colour transform.");
    [["r","Red"],["g","Green"],["b","Blue"],["a","Alpha"]].forEach(function(ch){
      sliderRow(ch[1]+" ×",e[ch[0]+"Mul"]==null?1:e[ch[0]+"Mul"],-1,2,0.01,function(v){
        e[ch[0]+"Mul"]=v;touchDoc();render();
      });
      sliderRow(ch[1]+" +",e[ch[0]+"Off"]||0,-255,255,1,function(v){
        e[ch[0]+"Off"]=v;touchDoc();render();
      });
    });
  }
}

// === Color System ===
/* ------------------------------------------------------------------ *
 * Align, Info and Transform panels
 *
 * Three small panels that together replace a lot of arithmetic. Flash had all
 * three and they were the difference between "nudge it until it looks right"
 * and "put it at 240, 180, 90° — done".
 *
 * They are rebuilt on every refresh like the Properties panel. That is cheap
 * (a few dozen nodes) and it is the only way a readout stays true while you
 * drag something across the stage.
 * ------------------------------------------------------------------ */

/** A row of small square buttons, the Align panel's whole vocabulary. */
function iconBtnRow(host,items){
  var r=document.createElement("div");
  r.className="align-row";
  items.forEach(function(it){
    if(it.gap){
      var sp=document.createElement("span");
      sp.className="align-gap";
      r.appendChild(sp);
      return;
    }
    var b=document.createElement("button");
    b.type="button";
    b.className="align-btn"+(it.active?" active":"");
    b.title=it.title;
    b.appendChild(svgIcon(it.svg));
    b.addEventListener("click",it.onClick);
    r.appendChild(b);
  });
  host.appendChild(r);
  return r;
}

function alignSectionLabel(host,text){
  var d=document.createElement("div");
  d.className="props-section";
  d.textContent=text;
  host.appendChild(d);
  return d;
}

/* The icon vocabulary. Each is a 14x14 glyph: bars showing what moves where,
   which reads faster than words at this size — and is what Flash drew. */
var ALIGN_ICONS={
  left:'<rect x="1" y="1" width="1.4" height="12" fill="currentColor"/><rect x="3" y="3" width="9" height="3" fill="currentColor"/><rect x="3" y="8" width="5" height="3" fill="currentColor"/>',
  hcenter:'<rect x="6.3" y="1" width="1.4" height="12" fill="currentColor"/><rect x="2" y="3" width="10" height="3" fill="currentColor"/><rect x="4" y="8" width="6" height="3" fill="currentColor"/>',
  right:'<rect x="11.6" y="1" width="1.4" height="12" fill="currentColor"/><rect x="2" y="3" width="9" height="3" fill="currentColor"/><rect x="6" y="8" width="5" height="3" fill="currentColor"/>',
  top:'<rect x="1" y="1" width="12" height="1.4" fill="currentColor"/><rect x="3" y="3" width="3" height="9" fill="currentColor"/><rect x="8" y="3" width="3" height="5" fill="currentColor"/>',
  vcenter:'<rect x="1" y="6.3" width="12" height="1.4" fill="currentColor"/><rect x="3" y="2" width="3" height="10" fill="currentColor"/><rect x="8" y="4" width="3" height="6" fill="currentColor"/>',
  bottom:'<rect x="1" y="11.6" width="12" height="1.4" fill="currentColor"/><rect x="3" y="2" width="3" height="9" fill="currentColor"/><rect x="8" y="6" width="3" height="5" fill="currentColor"/>',
  distH:'<rect x="1" y="3" width="2.5" height="8" fill="currentColor"/><rect x="6" y="3" width="2.5" height="8" fill="currentColor"/><rect x="11" y="3" width="2.5" height="8" fill="currentColor"/>',
  distV:'<rect x="3" y="1" width="8" height="2.5" fill="currentColor"/><rect x="3" y="6" width="8" height="2.5" fill="currentColor"/><rect x="3" y="11" width="8" height="2.5" fill="currentColor"/>',
  spaceH:'<rect x="1" y="2" width="3" height="10" fill="currentColor"/><rect x="10" y="2" width="3" height="10" fill="currentColor"/><path d="M5,7 L9,7" stroke="currentColor" stroke-width="1.2"/><path d="M5,5 L5,9 M9,5 L9,9" stroke="currentColor" stroke-width="1"/>',
  spaceV:'<rect x="2" y="1" width="10" height="3" fill="currentColor"/><rect x="2" y="10" width="10" height="3" fill="currentColor"/><path d="M7,5 L7,9" stroke="currentColor" stroke-width="1.2"/><path d="M5,5 L9,5 M5,9 L9,9" stroke="currentColor" stroke-width="1"/>',
  matchW:'<rect x="1" y="3" width="12" height="3" fill="none" stroke="currentColor"/><rect x="1" y="8" width="12" height="3" fill="currentColor"/>',
  matchH:'<rect x="3" y="1" width="3" height="12" fill="none" stroke="currentColor"/><rect x="8" y="1" width="3" height="12" fill="currentColor"/>',
  matchWH:'<rect x="1" y="1" width="12" height="12" fill="none" stroke="currentColor"/><rect x="3" y="3" width="8" height="8" fill="currentColor"/>'
};

function updateAlignPanel(){
  var host=document.getElementById("alignPanel");
  if(!host)return;
  host.textContent="";

  var hint=document.createElement("div");
  hint.className="props-note";
  hint.textContent=alignToStage
    ? "Relative to the stage."
    : "Relative to the selection. Turn on To Stage to use the stage instead.";
  host.appendChild(hint);

  var stageRow=document.createElement("div");
  stageRow.className="align-row";
  var sb=document.createElement("button");
  sb.type="button";
  sb.className="align-wide"+(alignToStage?" active":"");
  sb.textContent="To Stage";
  sb.title="Align relative to the stage rather than to the selection";
  sb.addEventListener("click",function(){doAction("alignToStage");});
  stageRow.appendChild(sb);
  host.appendChild(stageRow);

  alignSectionLabel(host,"Align");
  iconBtnRow(host,[
    {title:"Align left edges",svg:ALIGN_ICONS.left,onClick:function(){doAction("alignLeft");}},
    {title:"Align horizontal centres",svg:ALIGN_ICONS.hcenter,onClick:function(){doAction("alignHCenter");}},
    {title:"Align right edges",svg:ALIGN_ICONS.right,onClick:function(){doAction("alignRight");}},
    {gap:true},
    {title:"Align top edges",svg:ALIGN_ICONS.top,onClick:function(){doAction("alignTop");}},
    {title:"Align vertical centres",svg:ALIGN_ICONS.vcenter,onClick:function(){doAction("alignVCenter");}},
    {title:"Align bottom edges",svg:ALIGN_ICONS.bottom,onClick:function(){doAction("alignBottom");}}
  ]);

  alignSectionLabel(host,"Distribute");
  iconBtnRow(host,[
    {title:"Distribute horizontal centres evenly",svg:ALIGN_ICONS.distH,onClick:function(){doAction("alignDistH");}},
    {title:"Distribute vertical centres evenly",svg:ALIGN_ICONS.distV,onClick:function(){doAction("alignDistV");}},
    {gap:true},
    {title:"Space evenly horizontally (equal gaps)",svg:ALIGN_ICONS.spaceH,onClick:function(){doAction("alignSpaceH");}},
    {title:"Space evenly vertically (equal gaps)",svg:ALIGN_ICONS.spaceV,onClick:function(){doAction("alignSpaceV");}}
  ]);

  alignSectionLabel(host,"Match size");
  iconBtnRow(host,[
    {title:"Match width",svg:ALIGN_ICONS.matchW,onClick:function(){doAction("alignMatchW");}},
    {title:"Match height",svg:ALIGN_ICONS.matchH,onClick:function(){doAction("alignMatchH");}},
    {title:"Match width and height",svg:ALIGN_ICONS.matchWH,onClick:function(){doAction("alignMatchWH");}}
  ]);

  var count=document.createElement("div");
  count.className="props-note";
  count.textContent=selection.length===0?"Nothing selected."
    :selection.length===1?"1 object selected."
    :selection.length+" objects selected.";
  host.appendChild(count);
}

/**
 * The Info panel: the selection's box, and the pointer's position.
 *
 * Rebuilt on pointer move, so it is deliberately tiny — six rows of text,
 * no inputs. Editing happens in Properties and Transform; this one is a
 * readout, which is what makes it safe to update constantly.
 */
function updateInfoPanel(){
  var host=document.getElementById("infoPanel");
  if(!host)return;
  host.textContent="";
  var pair=function(label,value){
    var r=document.createElement("div");
    r.className="info-row";
    var l=document.createElement("span");l.className="info-label";l.textContent=label;
    var v=document.createElement("span");v.className="info-value";v.textContent=value;
    r.appendChild(l);r.appendChild(v);
    host.appendChild(r);
  };
  var rnd=function(n){return Math.round(n*10)/10;};
  alignSectionLabel(host,"Selection");
  if(selection.length){
    var b=getBounds(selection);
    pair("W",rnd(b.w)+" px");
    pair("H",rnd(b.h)+" px");
    pair("X",rnd(b.x)+" px");
    pair("Y",rnd(b.y)+" px");
    pair("Objects",String(selection.length));
  }else{
    pair("W","—");pair("H","—");pair("X","—");pair("Y","—");
  }
  alignSectionLabel(host,"Pointer");
  if(stageHover){
    pair("X",rnd(stageHover.x)+" px");
    pair("Y",rnd(stageHover.y)+" px");
    // Inside or outside the stage matters: a lot of "where did my drawing go"
    // is artwork placed on the pasteboard.
    pair("On stage",(stageHover.x>=0&&stageHover.y>=0&&
      stageHover.x<=doc.width&&stageHover.y<=doc.height)?"yes":"no");
  }else{
    pair("X","—");pair("Y","—");
  }
  alignSectionLabel(host,"Document");
  pair("Stage",doc.width+" × "+doc.height);
  pair("Zoom",Math.round(zoom*100)+"%");
  pair("Frame",curFrame+" / "+currentMaxFrame());
}

/**
 * The Transform panel: numeric scale, rotate and skew for the selection.
 *
 * Properties already edits one object's position and size. This one edits the
 * TRANSFORM — and applies to a whole selection at once, which Properties does
 * not, so "rotate all of these 15°" is one action.
 */
function updateTransformPanel(){
  var host=document.getElementById("transformPanel");
  if(!host)return;
  host.textContent="";
  if(!selection.length){
    var n=document.createElement("div");
    n.className="props-note";
    n.textContent="Select one or more objects to transform them.";
    host.appendChild(n);
    return;
  }
  var one=selection.length===1?selection[0]:null;
  var numRow=function(label,value,onChange,unit){
    var r=document.createElement("div");
    r.className="props-row";
    var l=document.createElement("label");l.className="props-label";l.textContent=label+":";
    r.appendChild(l);
    var i=document.createElement("input");
    i.className="props-input";i.type="text";i.value=value;
    i.addEventListener("change",function(){
      var v=parseFloat(i.value);
      if(isNaN(v))return;
      pushUndo();onChange(v);fullRefresh();
    });
    r.appendChild(i);
    if(unit){
      var u=document.createElement("span");u.className="props-unit";u.textContent=unit;
      r.appendChild(u);
    }
    host.appendChild(r);
  };

  alignSectionLabel(host,"Scale");
  numRow("Width",one?Math.round((one.scaleX||1)*1000)/10:100,function(v){
    selection.forEach(function(o){o.scaleX=(o.scaleX||1)<0?-(v/100):(v/100);});
  },"%");
  numRow("Height",one?Math.round((one.scaleY||1)*1000)/10:100,function(v){
    selection.forEach(function(o){o.scaleY=(o.scaleY||1)<0?-(v/100):(v/100);});
  },"%");

  alignSectionLabel(host,"Rotate");
  numRow("Angle",one?Math.round((one.rotation||0)*10)/10:0,function(v){
    selection.forEach(function(o){o.rotation=v;});
  },"°");

  alignSectionLabel(host,"Skew");
  numRow("Horizontal",one?(one.skewX||0):0,function(v){
    selection.forEach(function(o){o.skewX=v;});
  },"°");
  numRow("Vertical",one?(one.skewY||0):0,function(v){
    selection.forEach(function(o){o.skewY=v;});
  },"°");

  var acts=document.createElement("div");
  acts.className="props-row";
  acts.style.cssText="flex-wrap:wrap;gap:2px";
  [["Flip H","flipH"],["Flip V","flipV"],["90° CW","rot90cw"],["90° CCW","rot90ccw"],
   ["Reset","transformReset"],["Scale & Rotate…","scaleRotate"]].forEach(function(p){
    var b=document.createElement("button");
    b.className="props-btn-action";
    b.textContent=p[0];
    b.addEventListener("click",function(){doAction(p[1]);});
    acts.appendChild(b);
  });
  host.appendChild(acts);

  if(selection.length>1){
    var m=document.createElement("div");
    m.className="props-note";
    m.textContent="Values shown are blank for a multiple selection; typing one applies it to all "+
      selection.length+" objects.";
    host.appendChild(m);
  }
}

/**
 * The custom easing editor: a draggable cubic-Bézier curve.
 *
 * Flash's Custom Ease In/Ease Out was exactly this — a curve you pulled about
 * rather than a name you picked off a list — and it is the difference between
 * an animation that moves and one that moves *well*. Four numbers, so a curve
 * survives a save and the exported player can evaluate it identically, which
 * a hand-drawn point list could not.
 */
function buildEasingEditor(pp,kf,note){
  var size=118;
  var wrap=document.createElement("div");
  wrap.className="props-row";
  wrap.style.cssText="justify-content:center;padding:4px 0";
  var cv=document.createElement("canvas");
  cv.className="ease-curve";
  cv.width=size;cv.height=size;
  cv.title="Drag either handle. The curve maps time (across) to progress (up).";
  wrap.appendChild(cv);
  pp.appendChild(wrap);

  var cx=cv.getContext("2d");
  var bez=function(){
    if(!kf.easeBezier||kf.easeBezier.length<4)kf.easeBezier=[0.25,0.1,0.25,1];
    return kf.easeBezier;
  };
  // Canvas y runs down, easing progress runs up.
  var toPx=function(x,y){return {x:x*size,y:size-y*size};};
  var draw=function(){
    var b=bez();
    cx.clearRect(0,0,size,size);
    cx.fillStyle="#1E1E1E";
    cx.fillRect(0,0,size,size);
    // A faint diagonal: linear, for comparison.
    cx.strokeStyle="#3A3A3A";cx.lineWidth=1;
    cx.beginPath();cx.moveTo(0,size);cx.lineTo(size,0);cx.stroke();
    var p1=toPx(b[0],b[1]),p2=toPx(b[2],b[3]);
    // Handle tethers.
    cx.strokeStyle="#55707F";
    cx.beginPath();cx.moveTo(0,size);cx.lineTo(p1.x,p1.y);cx.stroke();
    cx.beginPath();cx.moveTo(size,0);cx.lineTo(p2.x,p2.y);cx.stroke();
    // The curve itself.
    cx.strokeStyle="#6CC0FF";cx.lineWidth=2;
    cx.beginPath();cx.moveTo(0,size);
    cx.bezierCurveTo(p1.x,p1.y,p2.x,p2.y,size,0);
    cx.stroke();
    [[p1,"#FFD24A"],[p2,"#FF7FB0"]].forEach(function(h){
      cx.beginPath();cx.arc(h[0].x,h[0].y,4,0,Math.PI*2);
      cx.fillStyle=h[1];cx.fill();
      cx.strokeStyle="#111";cx.lineWidth=1;cx.stroke();
    });
  };
  draw();

  var dragging=null,pre=null;
  var at=function(e){
    var r=cv.getBoundingClientRect();
    return {
      // x is time and is clamped to 0..1; y is progress and is NOT, because
      // overshoot above 1 and undershoot below 0 are what make a curve snap
      // and settle — the whole reason to draw one by hand.
      x:Math.max(0,Math.min(1,(e.clientX-r.left)/size)),
      y:Math.max(-0.5,Math.min(1.5,(r.bottom-e.clientY)/size))
    };
  };
  cv.addEventListener("pointerdown",function(e){
    var b=bez(),p=at(e);
    var d1=Math.hypot(p.x-b[0],p.y-b[1]);
    var d2=Math.hypot(p.x-b[2],p.y-b[3]);
    dragging=d1<=d2?0:1;
    pre=snap();
    if(cv.setPointerCapture){try{cv.setPointerCapture(e.pointerId);}catch(err){}}
    e.preventDefault();
  });
  cv.addEventListener("pointermove",function(e){
    if(dragging==null)return;
    var b=bez(),p=at(e);
    b[dragging*2]=Math.round(p.x*1000)/1000;
    b[dragging*2+1]=Math.round(p.y*1000)/1000;
    draw();
    render();
  });
  var end=function(){
    if(dragging==null)return;
    dragging=null;
    // One undo per drag, not per pointer move.
    if(pre){pushUndoSnap(pre);pre=null;}
  };
  cv.addEventListener("pointerup",end);
  cv.addEventListener("pointercancel",end);

  var b0=bez();
  note("Curve "+b0.map(function(v){return Math.round(v*100)/100;}).join(", ")+
       " — drag the yellow and pink handles.");
}

/* ------------------------------------------------------------------ *
 * The Output panel
 *
 * Where trace() goes. It went to the browser console, which is to say nowhere
 * a user of this editor would ever look — and `trace()` is the primary
 * debugging affordance of Flash. An exported movie writes to Flashy.Output;
 * Test Movie runs in a window of its own, so that window forwards its lines
 * back here (see startPreview).
 *
 * Built once and appended to, unlike the inspector panels, because a log that
 * is rebuilt on every refresh loses its scroll position — and you read a log
 * while something else is happening.
 * ------------------------------------------------------------------ */
var outputWired=false;

function outputLog(text){
  if(window.Flashy&&Flashy.Output)Flashy.Output.write(text);
  else appendOutputLine(String(text));
}

function appendOutputLine(text){
  var log=document.getElementById("outputLog");
  if(!log)return;
  if(text===null){
    log.textContent="";
    updateOutputCount();
    return;
  }
  var line=document.createElement("div");
  line.className="output-line";
  line.textContent=text;
  log.appendChild(line);
  // Stay pinned to the newest line, which is the one you are waiting for —
  // unless the user has scrolled up to read something, in which case moving
  // the view out from under them would be worse.
  var atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<24;
  if(atBottom)log.scrollTop=log.scrollHeight;
  updateOutputCount();
}

function updateOutputCount(){
  var el=document.getElementById("outputCount");
  if(!el)return;
  var n=(window.Flashy&&Flashy.Output)?Flashy.Output.lines.length:0;
  el.textContent=n?(n+(n===1?" line":" lines")):"";
}

function initOutputPanel(){
  if(outputWired)return;
  outputWired=true;
  var clear=document.getElementById("outputClear");
  if(clear)clear.addEventListener("click",function(){
    if(window.Flashy&&Flashy.Output)Flashy.Output.clear();
    else appendOutputLine(null);
  });
  var copy=document.getElementById("outputCopy");
  if(copy)copy.addEventListener("click",function(){
    var text=(window.Flashy&&Flashy.Output)?Flashy.Output.text():"";
    if(navigator.clipboard&&text)navigator.clipboard.writeText(text);
    copy.textContent="Copied";
    setTimeout(function(){copy.textContent="Copy";},900);
  });
  if(window.Flashy&&Flashy.Output){
    Flashy.Output.onWrite(appendOutputLine);
    // Anything traced before the panel existed is still worth showing.
    Flashy.Output.lines.forEach(appendOutputLine);
  }
  /* Test Movie runs in its own window, so its traces arrive as messages.
     Only lines, and only strings — a message from anywhere else is ignored
     rather than trusted, because any page could post one. */
  window.addEventListener("message",function(e){
    var d=e.data;
    if(!d||d.type!=="flashy:trace")return;
    if(typeof d.line!=="string")return;
    appendOutputLine(d.line);
  });
  updateOutputCount();
}

/* ------------------------------------------------------------------ *
 * Undo step labels, and the History panel
 *
 * A 50-deep undo stack existed and was completely invisible: there was no way
 * to see what Ctrl+Z was about to undo, and no way to step back five changes
 * without pressing it five times and watching to see what happened.
 *
 * Labelling is done without touching the hundred-odd pushUndo() calls.
 * doAction() announces which command is running, and pushUndo() picks the name
 * up — so a step is named after the thing that caused it, and a command added
 * later is labelled automatically rather than being forgotten.
 * ------------------------------------------------------------------ */

/** Human names for the actions that produce an undo step. */
var ACTION_LABELS={
  group:"Group",ungroup:"Ungroup",breakApart:"Break Apart",
  bringFront:"Bring to Front",bringForward:"Bring Forward",
  sendBackward:"Send Backward",sendBack:"Send to Back",
  flipH:"Flip Horizontal",flipV:"Flip Vertical",
  rot90cw:"Rotate 90° CW",rot90ccw:"Rotate 90° CCW",
  transformReset:"Remove Transform",scaleRotate:"Scale and Rotate",
  distributeToLayers:"Distribute to Layers",
  alignLeft:"Align Left",alignHCenter:"Align Centre",alignRight:"Align Right",
  alignTop:"Align Top",alignVCenter:"Align Middle",alignBottom:"Align Bottom",
  alignMatchW:"Match Width",alignMatchH:"Match Height",alignMatchWH:"Match Size",
  alignDistH:"Distribute Horizontally",alignDistV:"Distribute Vertically",
  alignSpaceH:"Space Horizontally",alignSpaceV:"Space Vertically",
  shapeSmooth:"Smooth",shapeStraighten:"Straighten",shapeOptimize:"Optimize",
  linesToFills:"Convert Lines to Fills",expandFill:"Expand Fill",
  softenEdges:"Soften Fill Edges",
  combineUnion:"Union",combineIntersect:"Intersect",
  combinePunch:"Punch",combineCrop:"Crop",
  addShapeHint:"Add Shape Hint",removeShapeHints:"Remove Shape Hints",
  reverseFrames:"Reverse Frames",pasteMotion:"Paste Motion",
  insKF:"Insert Keyframe",insBlankKF:"Insert Blank Keyframe",
  insFrame:"Insert Frame",removeKF:"Remove Keyframe",removeFrames:"Remove Frames",
  addLayer:"New Layer",addFolder:"New Layer Folder",delLayer:"Delete Layer",
  motionTween:"Create Motion Tween",shapeTween:"Create Shape Tween",
  removeTween:"Remove Tween",
  convertSym:"Convert to Symbol",newSymbol:"New Symbol",
  framesToSymbol:"Convert Frames to Symbol",
  cut:"Cut",copy:"Copy",paste:"Paste",delete:"Delete",
  cutFrames:"Cut Frames",pasteFrames:"Paste Frames",
  addSceneAction:"Add Scene",duplicateScene:"Duplicate Scene",
  deleteSceneAction:"Delete Scene",renameScene:"Rename Scene",
  traceBitmap:"Trace Bitmap",swapBitmap:"Swap Bitmap",
  importImage:"Import Image",importSound:"Import Sound",
  guidesClear:"Clear Guides",docSettings:"Document Settings",
  lipSync:"Auto Lip Sync",mouthSetup:"Set Up Mouth Shapes",
  newBiped:"New Biped",newCharacter:"New Character",
  addCharacterPart:"Add Character Part",editCharacterPart:"Edit Character Part",
  saveCharacterPose:"Save Pose",animateCharacter:"Animate Poses",
  placeCharacter:"Place Character",deleteCharacter:"Delete Character"
};

/* What is being done right now, if anything. Set around a doAction() call and
   read by pushUndo(); a tool that commits a drag sets it directly. */
var currentActionLabel=null;

/** Name the next undo step. Tools call this before committing. */
function labelNextUndo(label){currentActionLabel=label;}

function undoLabelFor(){
  if(currentActionLabel)return currentActionLabel;
  // A step with no announced cause is almost always a tool commit; naming it
  // after the active tool beats calling everything "Edit".
  var t=TOOLS.filter(function(x){return x.id===curTool;})[0];
  if(t&&curTool!=="select")return t.label.replace(/\s*\(.*$/,"").replace(/\s*—.*$/,"");
  return "Edit";
}

function updateHistoryPanel(){
  var host=document.getElementById("historyPanel");
  if(!host)return;
  host.textContent="";

  var note=function(text){
    var d=document.createElement("div");
    d.className="props-note";
    d.textContent=text;
    host.appendChild(d);
  };

  if(!undoStack.length&&!redoStack.length){
    note("Nothing to undo yet. Every change you make is listed here, newest "+
         "last — click one to step back to it.");
    return;
  }

  var list=document.createElement("div");
  list.className="history-list";

  /* Oldest first, which is the order the steps happened in. The marker sits
     between the undo steps and the redo steps: everything above it has been
     applied, everything below it has been undone. */
  undoStack.forEach(function(s,i){
    var row=document.createElement("div");
    row.className="history-row";
    row.textContent=s.label||"Edit";
    row.title="Step back to just after this change";
    /* Clicking a step means "leave THAT change applied and undo everything
       after it", so the count is the number of later steps — not that plus
       one, which undid the clicked change as well and made the first row
       unreachable. */
    var steps=undoStack.length-i-1;
    row.addEventListener("click",function(){
      for(var k=0;k<steps;k++)doUndo();
      updateHistoryPanel();
    });
    list.appendChild(row);
  });

  var here=document.createElement("div");
  here.className="history-here";
  here.textContent="▸ you are here";
  list.appendChild(here);

  // Redo steps, newest first — the stack's top is the next one to come back.
  redoStack.slice().reverse().forEach(function(s,i){
    var row=document.createElement("div");
    row.className="history-row undone";
    row.textContent=s.label||"Edit";
    row.title="Step forward to this change";
    row.addEventListener("click",function(){
      for(var k=0;k<=i;k++)doRedo();
      updateHistoryPanel();
    });
    list.appendChild(row);
  });

  host.appendChild(list);

  var acts=document.createElement("div");
  acts.className="props-row";
  acts.style.cssText="gap:2px";
  [["Undo","undo"],["Redo","redo"]].forEach(function(p){
    var b=document.createElement("button");
    b.className="props-btn-action";
    b.textContent=p[0];
    b.disabled=p[1]==="undo"?!undoStack.length:!redoStack.length;
    b.addEventListener("click",function(){doAction(p[1]);updateHistoryPanel();});
    acts.appendChild(b);
  });
  host.appendChild(acts);
  note(undoStack.length+" of 50 steps kept. Older changes are dropped, which "+
       "is why the list has a ceiling rather than growing without limit.");
}

/* ------------------------------------------------------------------ *
 * Movie Explorer
 *
 * A structural view of the whole document: every scene, layer, frame and
 * object, plus the library. There was no way to answer "where is every
 * instance of this symbol", "which frames have scripts on them" or "where is
 * that text block I cannot find" short of clicking through the timeline.
 *
 * Filters rather than a search box first, because the question is almost
 * always "show me all the X" — Flash's own explorer led with the same five
 * toggles. The text search narrows whatever the filters left.
 * ------------------------------------------------------------------ */

var explorerFilters={text:true,scripts:true,symbols:true,bitmaps:true,sounds:true};
var explorerQuery="";

/** Everything in the document the explorer can list. */
function explorerItems(){
  var items=[];
  var q=explorerQuery.trim().toLowerCase();
  var matches=function(label){
    return !q||label.toLowerCase().indexOf(q)>=0;
  };
  /* With nothing filtered out and nothing searched for, the explorer is a
     STRUCTURAL view and shows every layer — including an empty one, because
     its being empty is part of the structure. Narrow a filter or type a
     search and it becomes a finder instead, where an empty layer is noise. */
  var showAll=!q&&Object.keys(explorerFilters).every(function(k){
    return explorerFilters[k];
  });

  docScenes().forEach(function(scene,si){
    // The live scene's layers are doc.layers; a parked one's are its own.
    var layers=(si===doc.sceneIndex)?doc.layers:scene.layers;
    items.push({kind:"scene",depth:0,label:scene.name,sceneIndex:si,always:true});
    (layers||[]).forEach(function(l,li){
      var rows=[];
      (l.keyframes||[]).forEach(function(kf){
        if(explorerFilters.scripts&&kf.script&&kf.script.trim()){
          rows.push({kind:"script",depth:2,label:"script @ frame "+kf.index,
            sceneIndex:si,layerIndex:li,frame:kf.index});
        }
        if(explorerFilters.scripts&&kf.label){
          rows.push({kind:"label",depth:2,
            label:"label “"+kf.label+"” @ "+kf.index,
            sceneIndex:si,layerIndex:li,frame:kf.index});
        }
        if(explorerFilters.sounds&&kf.sound&&kf.sound.asset){
          rows.push({kind:"sound",depth:2,
            label:"sound "+kf.sound.asset+" @ "+kf.index,
            sceneIndex:si,layerIndex:li,frame:kf.index});
        }
        (kf.objects||[]).forEach(function(o,oi){
          var r=explorerRowFor(o,si,li,kf.index,oi);
          if(r)rows.push(r);
        });
      });
      var keep=rows.filter(function(r){return matches(r.label);});
      /* A layer with nothing to show in it is noise, so it is left out. A
         layer whose own NAME matches the search is worth showing even when
         empty — but only when there IS a search: with an empty query every
         name "matches", which listed every layer however the filters were
         set. */
      if(keep.length||showAll||(q&&matches(l.name))){
        items.push({kind:"layer",depth:1,label:l.name,
          sceneIndex:si,layerIndex:li,
          meta:(l.layerType&&l.layerType!=="normal")?l.layerType:""});
        keep.forEach(function(r){items.push(r);});
      }
    });
  });

  // The library, which is where a symbol's definition lives rather than any
  // one of its instances.
  var libNames=Object.keys(doc.library||{});
  var bmpNames=Object.keys(doc.bitmaps||{});
  var sndNames=Object.keys(doc.sounds||{});
  var libRows=[];
  if(explorerFilters.symbols){
    libNames.forEach(function(n){
      libRows.push({kind:"libSymbol",depth:1,label:n,libName:n,libKind:"symbol"});
    });
  }
  if(explorerFilters.bitmaps){
    bmpNames.forEach(function(n){
      libRows.push({kind:"libBitmap",depth:1,label:n,libName:n,libKind:"bitmap"});
    });
  }
  if(explorerFilters.sounds){
    sndNames.forEach(function(n){
      libRows.push({kind:"libSound",depth:1,label:n,libName:n});
    });
  }
  libRows=libRows.filter(function(r){return matches(r.label);});
  if(libRows.length){
    items.push({kind:"libraryHeader",depth:0,label:"Library",always:true});
    libRows.forEach(function(r){items.push(r);});
  }
  return items;
}

/** One stage object as an explorer row, or null when a filter excludes it. */
function explorerRowFor(o,si,li,frame,oi){
  var base={depth:2,sceneIndex:si,layerIndex:li,frame:frame,objIndex:oi};
  if(o.type==="text"){
    if(!explorerFilters.text)return null;
    var t=String(o.text==null?"":o.text).replace(/\n/g," ").slice(0,28);
    return Object.assign(base,{
      kind:"text",
      label:(o.textType&&o.textType!=="static"?(o.textType+" text"):"text")+
            ": “"+t+"”"+(o.instanceName?"  ("+o.instanceName+")":"")
    });
  }
  if(o.type==="symbol"){
    if(!explorerFilters.symbols)return null;
    return Object.assign(base,{
      kind:"instance",
      label:(o.symbolName||"symbol")+(o.instanceName?"  ("+o.instanceName+")":"")+
            " @ frame "+frame,
      libName:o.symbolName
    });
  }
  if(o.type==="bitmap"){
    if(!explorerFilters.bitmaps)return null;
    return Object.assign(base,{kind:"bitmap",
      label:(o.bitmapAsset||"bitmap")+" @ frame "+frame,libName:o.bitmapAsset});
  }
  if(o.clipScript&&o.clipScript.trim()){
    if(!explorerFilters.scripts)return null;
    return Object.assign(base,{kind:"handler",
      label:"handlers on "+(o.instanceName||o.type)+" @ frame "+frame});
  }
  return null;
}

/** Jump to whatever a row points at. */
function explorerGoTo(row){
  if(row.sceneIndex!=null&&row.sceneIndex!==doc.sceneIndex)gotoScene(row.sceneIndex);
  if(row.libKind==="symbol"&&row.libName){
    selectLibItem("symbol",row.libName);
    return;
  }
  if(row.libKind==="bitmap"&&row.libName){
    selectLibItem("bitmap",row.libName);
    return;
  }
  if(row.layerIndex!=null){
    var layers=currentLayers();
    if(row.layerIndex<layers.length)curLayer=row.layerIndex;
  }
  if(row.frame)curFrame=row.frame;
  selection=[];
  if(row.objIndex!=null){
    var l=currentLayers()[curLayer];
    var kf=l&&l.getKeyframeAt(curFrame);
    if(kf&&kf.objects[row.objIndex])selection=[kf.objects[row.objIndex]];
  }
  var lay=currentLayers()[curLayer];
  var skf=lay&&lay.getKeyframeAt(curFrame);
  selectedKF=skf?{layerIdx:curLayer,frameIdx:skf.index,kf:skf}:null;
  fullRefresh();
}

var EXPLORER_ICONS={
  scene:"🎬",layer:"▤",text:"T",instance:"◆",bitmap:"▣",sound:"♪",
  script:"{}",handler:"{}",label:"⚑",libraryHeader:"📚",
  libSymbol:"◆",libBitmap:"▣",libSound:"♪"
};

function updateExplorerPanel(){
  var host=document.getElementById("explorerPanel");
  if(!host)return;
  host.textContent="";

  var bar=document.createElement("div");
  bar.className="explorer-bar";
  [["text","T","Text blocks"],["scripts","{}","Scripts, labels and handlers"],
   ["symbols","◆","Symbols and their instances"],["bitmaps","▣","Bitmaps"],
   ["sounds","♪","Sounds"]].forEach(function(f){
    var b=document.createElement("button");
    b.type="button";
    b.className="explorer-filter"+(explorerFilters[f[0]]?" active":"");
    b.textContent=f[1];
    b.title=f[2];
    b.addEventListener("click",function(){
      explorerFilters[f[0]]=!explorerFilters[f[0]];
      updateExplorerPanel();
    });
    bar.appendChild(b);
  });
  var q=document.createElement("input");
  q.type="text";
  q.className="explorer-search";
  q.placeholder="Find…";
  q.value=explorerQuery;
  q.addEventListener("input",function(){
    explorerQuery=q.value;
    updateExplorerPanel();
    // Rebuilding the panel destroys the field, so focus has to be put back or
    // the second keystroke goes nowhere.
    var again=document.querySelector(".explorer-search");
    if(again){again.focus();again.setSelectionRange(again.value.length,again.value.length);}
  });
  bar.appendChild(q);
  host.appendChild(bar);

  var items=explorerItems();
  var listed=items.filter(function(i){return !i.always;});
  if(!listed.length){
    var n=document.createElement("div");
    n.className="props-note";
    n.textContent=explorerQuery
      ? "Nothing matches “"+explorerQuery+"”."
      : "Nothing to list. Turn a filter back on, or put something on the stage.";
    host.appendChild(n);
    return;
  }

  var list=document.createElement("div");
  list.className="explorer-list";
  items.forEach(function(it){
    var row=document.createElement("div");
    row.className="explorer-row depth"+it.depth+
      ((it.kind==="scene"||it.kind==="libraryHeader")?" head":"");
    var icon=document.createElement("span");
    icon.className="explorer-icon";
    icon.textContent=EXPLORER_ICONS[it.kind]||"·";
    row.appendChild(icon);
    var label=document.createElement("span");
    label.className="explorer-label";
    label.textContent=it.label+(it.meta?("  ["+it.meta+"]"):"");
    row.appendChild(label);
    if(it.kind!=="libraryHeader"){
      row.title="Go to this";
      row.addEventListener("click",function(){explorerGoTo(it);});
    }
    list.appendChild(row);
  });
  host.appendChild(list);

  var count=document.createElement("div");
  count.className="props-note";
  count.textContent=listed.length+" item"+(listed.length===1?"":"s")+" listed.";
  host.appendChild(count);
}

/* ------------------------------------------------------------------ *
 * Behaviors
 *
 * Interactivity without writing code. Pick an event, pick what should happen,
 * and the panel writes the handler — in Flash's own `on(release) { … }` form,
 * which flashy-as2.js already runs in Test Movie and in exports.
 *
 * This is the shortest path from "I drew a button" to "the button does
 * something", and it was missing entirely: the only way to make anything
 * interactive was to know the handler syntax and type it.
 *
 * The generated handler is plain text in `clipScript`, deliberately: it is
 * editable afterwards in the Actions panel, so a behaviour is a starting point
 * rather than a black box that has to be deleted to be changed.
 * ------------------------------------------------------------------ */

var BEHAVIOR_EVENTS=[
  ["release","On release (click)"],
  ["press","On press"],
  ["rollOver","On roll over"],
  ["rollOut","On roll out"],
  ["load","On load (clip appears)"],
  ["enterFrame","Every frame"]
];

/* Each behaviour knows which fields it needs, and builds its own body. Keeping
   the two together is what stops a behaviour growing a field it never reads. */
var BEHAVIORS=[
  {id:"gotoAndPlay",label:"Go to frame and play",
   fields:[{name:"frame",label:"Frame",type:"text",value:"1"}],
   body:function(v){return "_root.gotoAndPlay("+behaviorFrameArg(v.frame)+");";}},
  {id:"gotoAndStop",label:"Go to frame and stop",
   fields:[{name:"frame",label:"Frame",type:"text",value:"1"}],
   body:function(v){return "_root.gotoAndStop("+behaviorFrameArg(v.frame)+");";}},
  {id:"play",label:"Play the movie",fields:[],
   body:function(){return "_root.play();";}},
  {id:"stop",label:"Stop the movie",fields:[],
   body:function(){return "_root.stop();";}},
  {id:"nextFrame",label:"Go to the next frame",fields:[],
   body:function(){return "_root.nextFrame();";}},
  {id:"prevFrame",label:"Go to the previous frame",fields:[],
   body:function(){return "_root.prevFrame();";}},
  {id:"getURL",label:"Open a web page",
   fields:[{name:"url",label:"URL",type:"text",value:"https://"},
           {name:"target",label:"Window",type:"select",value:"_blank",
            options:[["_blank","New window"],["_self","Same window"]]}],
   body:function(v){
     return "getURL(\""+behaviorEscape(v.url)+"\", \""+behaviorEscape(v.target)+"\");";
   }},
  {id:"trace",label:"Write to the Output panel",
   fields:[{name:"message",label:"Message",type:"text",value:"clicked"}],
   body:function(v){return "trace(\""+behaviorEscape(v.message)+"\");";}},
  {id:"setText",label:"Write to a text field",
   fields:[{name:"field",label:"Field name",type:"text",value:""},
           {name:"value",label:"Text",type:"text",value:""}],
   body:function(v){
     return "_root."+behaviorIdent(v.field)+".text = \""+behaviorEscape(v.value)+"\";";
   }},
  {id:"hide",label:"Hide this object",fields:[],
   body:function(){return "this._visible = false;";}},
  {id:"show",label:"Show this object",fields:[],
   body:function(){return "this._visible = true;";}},
  {id:"nudge",label:"Move this object",
   fields:[{name:"dx",label:"X by",type:"text",value:"10"},
           {name:"dy",label:"Y by",type:"text",value:"0"}],
   body:function(v){
     return "this._x += "+behaviorNum(v.dx)+"; this._y += "+behaviorNum(v.dy)+";";
   }}
];

/** A frame argument: a number stays a number, anything else becomes a label. */
function behaviorFrameArg(v){
  var s=String(v==null?"":v).trim();
  if(/^\d+$/.test(s))return s;
  return "\""+behaviorEscape(s)+"\"";
}

/** Text going into a double-quoted ActionScript string. */
function behaviorEscape(v){
  return String(v==null?"":v)
    .replace(/\\/g,"\\\\")
    .replace(/"/g,"\\\"")
    .replace(/\r?\n/g,"\\n");
}

/** A number, or zero — never an expression spliced into generated code. */
function behaviorNum(v){
  var s=String(v==null?"":v).trim();
  /* The WHOLE string has to be a number. parseFloat("1); evil(") returns 1 and
     silently drops the rest; nothing is injected either way, because only the
     parsed number is emitted — but a rule that depends on that is a rule that
     breaks the first time a field is used somewhere less careful. */
  if(!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s))return "0";
  var n=parseFloat(s);
  return isFinite(n)?String(n):"0";
}

/** An identifier, or a placeholder: generated code must still parse. */
function behaviorIdent(v){
  var s=String(v==null?"":v).trim();
  return /^[A-Za-z_$][\w$]*$/.test(s)?s:"field";
}

/**
 * Add a behaviour to the selected object.
 *
 * Appended to whatever handlers it already has rather than replacing them: an
 * object usually ends up with two or three, and a panel that silently
 * overwrote the last one would be unusable.
 */
function addBehavior(spec,event,values){
  if(!selection.length)return {ok:false,reason:"selection"};
  var o=selection[0];
  if(isRigPart(o))return {ok:false,reason:"rig"};
  var body=spec.body(values||{});
  var wrapper=(event==="load"||event==="enterFrame")?"onClipEvent":"on";
  var handler=wrapper+" ("+event+") {\n  "+body+"\n}";
  pushUndo();
  o.clipScript=(o.clipScript&&o.clipScript.trim())
    ? (o.clipScript.replace(/\s+$/,"")+"\n\n"+handler)
    : handler;
  return {ok:true,script:o.clipScript};
}

/** The handlers already on the selected object, as {event, body} rows. */
function behaviorsOn(o){
  if(!o||!o.clipScript)return [];
  var out=[];
  var re=/(on|onClipEvent)\s*\(\s*([A-Za-z]+)\s*\)\s*\{([\s\S]*?)\}/g;
  var m;
  while((m=re.exec(o.clipScript))){
    out.push({wrapper:m[1],event:m[2],body:m[3].trim(),at:m.index,text:m[0]});
  }
  return out;
}

function updateBehaviorsPanel(){
  var host=document.getElementById("behaviorsPanel");
  if(!host)return;
  host.textContent="";
  var note=function(text){
    var d=document.createElement("div");
    d.className="props-note";
    d.textContent=text;
    host.appendChild(d);
  };

  if(selection.length!==1){
    note(selection.length
      ? "Select one object. A behaviour attaches to a single object's handlers."
      : "Select an object on the stage to give it a behaviour — interactivity "+
        "without writing the handler yourself.");
    return;
  }
  var o=selection[0];
  if(isRigPart(o)){
    note("A character rig part is driven by its rig, so a behaviour on it "+
         "would fight the pose. Put the behaviour on the rig's symbol instead.");
    return;
  }

  alignSectionLabel(host,"Add a behaviour");

  var state=updateBehaviorsPanel._state||(updateBehaviorsPanel._state={
    event:"release",behavior:"gotoAndPlay",values:{}
  });

  var row=function(label,el){
    var r=document.createElement("div");
    r.className="props-row";
    var l=document.createElement("label");
    l.className="props-label";
    l.textContent=label+":";
    r.appendChild(l);
    r.appendChild(el);
    host.appendChild(r);
    return r;
  };

  var evSel=document.createElement("select");
  evSel.className="props-select";
  evSel.style.width="120px";
  BEHAVIOR_EVENTS.forEach(function(e){
    var op=document.createElement("option");
    op.value=e[0];op.textContent=e[1];
    if(state.event===e[0])op.selected=true;
    evSel.appendChild(op);
  });
  evSel.addEventListener("change",function(){
    state.event=evSel.value;updateBehaviorsPanel();
  });
  row("When",evSel);

  var bSel=document.createElement("select");
  bSel.className="props-select";
  bSel.style.width="140px";
  BEHAVIORS.forEach(function(b){
    var op=document.createElement("option");
    op.value=b.id;op.textContent=b.label;
    if(state.behavior===b.id)op.selected=true;
    bSel.appendChild(op);
  });
  bSel.addEventListener("change",function(){
    state.behavior=bSel.value;
    state.values={};
    updateBehaviorsPanel();
  });
  row("Do", bSel);

  var spec=BEHAVIORS.filter(function(b){return b.id===state.behavior;})[0]||BEHAVIORS[0];
  spec.fields.forEach(function(f){
    if(state.values[f.name]==null)state.values[f.name]=f.value;
    var el;
    if(f.type==="select"){
      el=document.createElement("select");
      el.className="props-select";
      el.style.width="110px";
      f.options.forEach(function(op){
        var o2=document.createElement("option");
        o2.value=op[0];o2.textContent=op[1];
        if(state.values[f.name]===op[0])o2.selected=true;
        el.appendChild(o2);
      });
      el.addEventListener("change",function(){state.values[f.name]=el.value;});
    }else{
      el=document.createElement("input");
      el.className="props-input";
      el.type="text";
      el.value=state.values[f.name];
      el.addEventListener("input",function(){state.values[f.name]=el.value;});
    }
    row(f.label,el);
  });

  var add=document.createElement("div");
  add.className="props-row";
  var addBtn=document.createElement("button");
  addBtn.className="props-btn-action";
  addBtn.textContent="Add behaviour";
  addBtn.addEventListener("click",function(){
    var r=addBehavior(spec,state.event,state.values);
    if(r.ok){
      fullRefresh();
      outputLog("Behaviour added: "+spec.label+" on "+state.event);
    }
  });
  add.appendChild(addBtn);
  host.appendChild(add);

  var existing=behaviorsOn(o);
  alignSectionLabel(host,"On this object");
  if(!existing.length){
    note("No handlers yet. They run in Test Movie and in exports, not on this "+
         "stage — the same split Flash had between authoring and playing.");
    return;
  }
  existing.forEach(function(h,i){
    var r=document.createElement("div");
    r.className="behavior-row";
    var t=document.createElement("span");
    t.className="behavior-event";
    t.textContent=h.event;
    r.appendChild(t);
    var b=document.createElement("span");
    b.className="behavior-body";
    b.textContent=h.body.replace(/\s+/g," ").slice(0,48);
    r.appendChild(b);
    var del=document.createElement("button");
    del.className="scene-btn";
    del.textContent="✕";
    del.title="Remove this handler";
    del.addEventListener("click",function(){
      pushUndo();
      // By text, not by index: the script may have been hand-edited since the
      // panel listed it, and an index would then remove the wrong one.
      o.clipScript=o.clipScript.replace(h.text,"").replace(/\n{3,}/g,"\n\n").trim();
      if(!o.clipScript)o.clipScript="";
      fullRefresh();
    });
    r.appendChild(del);
    host.appendChild(r);
    void i;
  });
  note("Edit them as code in the Actions panel — a behaviour is a starting "+
       "point, not a black box.");
}

/**
 * The Scene panel: the movie's scenes, in playing order.
 *
 * Reordering is the point as much as switching is — a storyboard gets
 * rearranged, and the alternative is cutting and pasting whole timelines.
 */
function updateScenePanel(){
  var host=document.getElementById("scenePanel");
  if(!host)return;
  host.textContent="";
  var scenes=docScenes();

  alignSectionLabel(host,"Scenes");
  scenes.forEach(function(sc,i){
    var row=document.createElement("div");
    row.className="scene-row"+(i===doc.sceneIndex?" active":"");

    var num=document.createElement("span");
    num.className="scene-num";
    num.textContent=(i+1)+".";
    row.appendChild(num);

    var name=document.createElement("span");
    name.className="scene-name";
    name.textContent=sc.name;
    name.title="Click to open · double-click to rename";
    name.addEventListener("click",function(){gotoScene(i);});
    name.addEventListener("dblclick",function(e){
      e.stopPropagation();
      askFor("Rename Scene","Name",sc.name,function(nn){
        if(!nn)return;
        pushUndo();
        sc.name=uniqueSceneName(nn)===nn?nn:uniqueSceneName(nn);
        updateBreadcrumb();fullRefresh();
      });
    });
    row.appendChild(name);

    var len=document.createElement("span");
    len.className="scene-len";
    // The length is what tells you where you are in a storyboard.
    if(i===doc.sceneIndex)parkCurrentScene();
    len.textContent=sceneLength(sc)+"f";
    row.appendChild(len);

    [["▲",-1,"Move earlier"],["▼",1,"Move later"]].forEach(function(b){
      var btn=document.createElement("button");
      btn.className="scene-btn";
      btn.textContent=b[0];btn.title=b[2];
      btn.addEventListener("click",function(e){
        e.stopPropagation();
        pushUndo();
        moveScene(i,b[1]);
      });
      row.appendChild(btn);
    });
    var del=document.createElement("button");
    del.className="scene-btn";
    del.textContent="✕";
    del.title=scenes.length>1?"Delete this scene":"A movie needs at least one scene";
    if(scenes.length<2)del.disabled=true;
    del.addEventListener("click",function(e){
      e.stopPropagation();
      if(scenes.length<2)return;
      showDialog({
        title:"Delete Scene",
        message:"Delete \""+sc.name+"\" and everything on its timeline?",
        okLabel:"Delete",
        onOk:function(){pushUndo();deleteScene(i);}
      });
    });
    row.appendChild(del);
    host.appendChild(row);
  });

  var acts=document.createElement("div");
  acts.className="props-row";
  acts.style.cssText="flex-wrap:wrap;gap:2px";
  [["Add Scene","addSceneAction"],["Duplicate","duplicateScene"]].forEach(function(p){
    var b=document.createElement("button");
    b.className="props-btn-action";
    b.textContent=p[0];
    b.addEventListener("click",function(){doAction(p[1]);});
    acts.appendChild(b);
  });
  host.appendChild(acts);

  var n=document.createElement("div");
  n.className="props-note";
  n.textContent=scenes.length>1
    ? "Scenes play in order. An export lays them end to end on one timeline, "+
      "with each scene's name as a frame label — so gotoAndPlay(\""+scenes[0].name+"\") works."
    : "A scene is a whole timeline of its own. Add one to storyboard a second shot "+
      "without stacking it on this one.";
  host.appendChild(n);
}

/* ------------------------------------------------------------------ *
 * Color Swatches
 *
 * A palette you click rather than a picker you open. Picking a colour was
 * always three actions — open the picker, find the colour, confirm — and for
 * the twenty colours a drawing actually uses that is twenty times too many.
 *
 * Two palettes: the web-safe 216, which is what Flash shipped, and the colours
 * THIS document already uses, gathered from the artwork. The second is the one
 * people want: a cartoon is drawn from its own palette, and finding a colour
 * you already used by eye is how it stays consistent.
 * ------------------------------------------------------------------ */

var swatchMode="document";        // document | websafe | custom
var customSwatches=null;          // user palette, or null until one is made

/** The web-safe 216, in Flash's own row order. */
function webSafePalette(){
  var steps=["00","33","66","99","CC","FF"];
  var out=[];
  for(var r=0;r<6;r++){
    for(var g=0;g<6;g++){
      for(var b=0;b<6;b++){
        out.push("#"+steps[r]+steps[g]+steps[b]);
      }
    }
  }
  return out;
}

/**
 * Every colour this document actually uses, most-used first.
 *
 * Gathered from fills, strokes, gradient stops, text and filter colours across
 * every scene and every symbol — a colour used only inside a symbol is still
 * one of the document's colours.
 */
function documentPalette(){
  var counts={};
  var add=function(c){
    if(c==null)return;
    var hex=typeof c==="string"
      ? c : ("#"+("000000"+((c|0)&0xffffff).toString(16)).slice(-6));
    if(!/^#[0-9a-fA-F]{6}$/.test(hex))return;
    hex=hex.toUpperCase();
    counts[hex]=(counts[hex]||0)+1;
  };
  var visit=function(objs){
    (objs||[]).forEach(function(o){
      add(o.fillColor);
      add(o.strokeColor);
      if(Array.isArray(o.fillStops)){
        for(var i=1;i<o.fillStops.length;i+=3)add(o.fillStops[i]);
      }
      if(o.textBorder)add(o.textBorderColor);
      if(o.textBackground)add(o.textBackgroundColor);
      (o.filters||[]).forEach(function(f){
        if(!f)return;
        add(f.color);add(f.highlightColor);add(f.shadowColor);
      });
      if(o.colorEffect&&o.colorEffect.mode==="tint")add(o.colorEffect.color);
      if(o.children)visit(o.children);
    });
  };
  docScenes().forEach(function(scene,si){
    var layers=(si===doc.sceneIndex)?doc.layers:scene.layers;
    (layers||[]).forEach(function(l){
      add(l.outlineColor);
      (l.keyframes||[]).forEach(function(kf){visit(kf.objects);});
    });
  });
  Object.keys(doc.library||{}).forEach(function(n){
    var sym=doc.library[n];
    if(!sym)return;
    visit(sym.objects);
    (sym.layers||[]).forEach(function(l){
      (l.keyframes||[]).forEach(function(kf){visit(kf.objects);});
    });
  });
  add(doc.backgroundColor);
  return Object.keys(counts).sort(function(a,b){
    return counts[b]-counts[a]||(a<b?-1:1);
  });
}

function currentSwatches(){
  if(swatchMode==="websafe")return webSafePalette();
  if(swatchMode==="custom")return (customSwatches||[]).slice();
  return documentPalette();
}

/** Add the current fill colour to the custom palette. */
function addCustomSwatch(hex){
  if(!customSwatches)customSwatches=[];
  var up=String(hex||fillColor).toUpperCase();
  // No duplicates: a palette with the same colour three times is a palette
  // three colours smaller than it looks.
  if(customSwatches.indexOf(up)<0)customSwatches.push(up);
  swatchMode="custom";
  return customSwatches.length;
}

function updateSwatchesPanel(){
  var host=document.getElementById("swatchesPanel");
  if(!host)return;
  host.textContent="";

  var bar=document.createElement("div");
  bar.className="swatch-bar";
  [["document","Document"],["websafe","Web safe"],["custom","Custom"]]
    .forEach(function(m){
      var b=document.createElement("button");
      b.type="button";
      b.className="swatch-tab"+(swatchMode===m[0]?" active":"");
      b.textContent=m[1];
      b.title=m[0]==="document"
        ? "The colours this document already uses, most-used first"
        : (m[0]==="websafe"?"The web-safe 216, as Flash shipped":"Your own palette");
      b.addEventListener("click",function(){
        swatchMode=m[0];
        updateSwatchesPanel();
      });
      bar.appendChild(b);
    });
  host.appendChild(bar);

  var list=currentSwatches();
  if(!list.length){
    var n=document.createElement("div");
    n.className="props-note";
    n.textContent=swatchMode==="custom"
      ? "No custom colours yet. Press “Add current” to start a palette."
      : "Nothing has been drawn yet, so the document has no colours of its own.";
    host.appendChild(n);
  }else{
    var grid=document.createElement("div");
    grid.className="swatch-grid";
    list.forEach(function(hex){
      var cell=document.createElement("button");
      cell.type="button";
      cell.className="swatch"+(String(fillColor).toUpperCase()===hex?" sel":"");
      cell.style.backgroundColor=hex;
      cell.dataset.color=hex;
      cell.title=hex+"  —  click for fill, Shift-click for stroke";
      cell.addEventListener("click",function(e){
        /* Click sets the fill, Shift-click the stroke. Two gestures rather
           than two palettes, because the colour you want is the same one
           either way and a second grid would double the panel. */
        if(e.shiftKey)strokeColor=hex; else fillColor=hex;
        updateColorUI();
        // A selected object takes the colour too: picking a swatch with
        // something selected and having nothing happen is the commonest
        // confusion with a palette.
        if(selection.length){
          pushUndo();
          selection.forEach(function(o){
            if(e.shiftKey)o.strokeColor=hex;
            else{o.fillColor=hex;if((o.fillType||"solid")==="none")o.fillType="solid";}
          });
          fullRefresh();
        }else{
          updateSwatchesPanel();
        }
      });
      grid.appendChild(cell);
    });
    host.appendChild(grid);
  }

  var acts=document.createElement("div");
  acts.className="props-row";
  acts.style.cssText="gap:2px;flex-wrap:wrap";
  var mk=function(label,fn,title){
    var b=document.createElement("button");
    b.className="props-btn-action";
    b.textContent=label;
    if(title)b.title=title;
    b.addEventListener("click",fn);
    acts.appendChild(b);
  };
  mk("Add current",function(){
    addCustomSwatch(fillColor);
    updateSwatchesPanel();
  },"Add the current fill colour to your own palette");
  mk("Save…",function(){
    /* A plain JSON list, not Flash's .act: an .act is 768 raw bytes with no
       room for a name or a comment, and nothing else can read one. */
    var pal=currentSwatches();
    dlFile(JSON.stringify({name:"Flashy palette",colors:pal},null,2),
           "palette.json","application/json");
    outputLog("Saved a palette of "+pal.length+" colours.");
  },"Save this palette as a file");
  mk("Load…",function(){
    var inp=document.createElement("input");
    inp.type="file";
    inp.accept=".json,application/json";
    inp.addEventListener("change",function(){
      if(!inp.files[0])return;
      var r=new FileReader();
      r.onload=function(){
        try{
          var parsed=JSON.parse(r.result);
          var cols=Array.isArray(parsed)?parsed:(parsed&&parsed.colors);
          if(!Array.isArray(cols))throw new Error("no colours in that file");
          customSwatches=cols.map(function(c){return String(c).toUpperCase();})
            .filter(function(c){return /^#[0-9A-F]{6}$/.test(c);});
          if(!customSwatches.length)throw new Error("no usable colours in that file");
          swatchMode="custom";
          updateSwatchesPanel();
          outputLog("Loaded a palette of "+customSwatches.length+" colours.");
        }catch(err){
          showMessage("Load Palette",
            "That file could not be read as a palette.\n\n"+
            ((err&&err.message)||err)+
            "\n\nA palette is a JSON list of #RRGGBB strings, or an object "+
            "with a `colors` array.");
        }
      };
      r.readAsText(inp.files[0]);
    });
    inp.click();
  },"Load a palette from a file");
  if(swatchMode==="custom"&&customSwatches&&customSwatches.length){
    mk("Clear",function(){
      customSwatches=[];
      updateSwatchesPanel();
    },"Empty your palette");
  }
  host.appendChild(acts);

  var hint=document.createElement("div");
  hint.className="props-note";
  hint.textContent=list.length
    ? list.length+" colour"+(list.length===1?"":"s")+
      ". Click for fill, Shift-click for stroke — and with something selected, "+
      "it is recoloured too."
    : "";
  host.appendChild(hint);
}

/* ------------------------------------------------------------------ *
 * Components
 *
 * Ready-made interactive pieces: a button, a checkbox, a radio button, a text
 * input, a slider, a progress bar. There were none, so anything with a user
 * interface in it had to be drawn from scratch and wired by hand every time.
 *
 * Built the way Flash's own components were built — as ordinary library
 * symbols made of ordinary shapes and text, with handlers on them. That
 * matters more than it sounds: a component is therefore editable (open it and
 * change the corner radius), exportable through the paths that already exist,
 * and needs no new runtime. A component implemented as a special object type
 * would have needed a branch in all four renderers and would resist being
 * restyled, which is the first thing anyone wants to do to one.
 * ------------------------------------------------------------------ */

/** A plain shape object, for building a component's artwork. */
function compShape(type,x,y,w,h,fill,stroke,strokeW){
  var o=new EditorObject(type);
  o.x=x;o.y=y;o.width=w;o.height=h;
  o.fillColor=fill||"#DDDDDD";
  o.fillType=fill?"solid":"none";
  o.fillAlpha=1;
  o.strokeColor=stroke||"#555555";
  o.strokeWidth=strokeW==null?1:strokeW;
  o.strokeStyle=o.strokeWidth>0?"solid":"none";
  return o;
}

/** A label, for a component's text. */
function compText(x,y,w,h,text,opts){
  opts=opts||{};
  var o=new EditorObject("text");
  o.x=x;o.y=y;o.width=w;o.height=h;
  o.text=text;
  o.font="Arial";
  o.fontSize=opts.size||12;
  o.fillColor=opts.color||"#222222";
  o.textAlign=opts.align||"center";
  o.lineHeight=1.2;
  if(opts.textType){
    o.textType=opts.textType;
    o.instanceName=opts.instanceName||"";
    o.lineType=opts.lineType||"single";
    o.selectable=true;
    if(opts.textType==="input"){o.textBorder=false;o.textBackground=false;}
  }
  return o;
}

/**
 * The component catalogue.
 *
 * Each entry builds a symbol as a list of keyframes, and says what handler to
 * put on the instance. The handler is ActionScript in Flash's own form,
 * because that is what flashy-as2.js runs — and because a user who opens the
 * Actions panel to change the behaviour finds something they can read.
 */
var COMPONENTS=[
  {
    id:"button",label:"Button",
    width:100,height:28,
    describe:"Up, Over and Down states on frames 1–3, as a Button symbol.",
    build:function(w,h,opts){
      var label=opts.label||"Button";
      var frame=function(face,text){
        return [
          compShape("rect",0,0,w,h,face,"#555555",1),
          compText(0,Math.round(h/2-8),w,16,text,{size:12})
        ];
      };
      return {
        behavior:"button",
        frames:[
          frame("#E4E4E4",label),      // up
          frame("#F2F2F2",label),      // over
          frame("#C8C8C8",label),      // down
          // The hit area: frame 4, as Flash's Button symbols had.
          [compShape("rect",0,0,w,h,"#000000",null,0)]
        ]
      };
    },
    script:function(opts){
      var target=opts.gotoFrame||"";
      return target
        ? "on (release) {\n  _root.gotoAndStop("+behaviorFrameArg(target)+");\n}"
        : "on (release) {\n  trace(\""+behaviorEscape(opts.label||"Button")+" clicked\");\n}";
    }
  },
  {
    id:"checkbox",label:"Check Box",
    width:120,height:20,
    describe:"A box that toggles, with its state on `checked`.",
    build:function(w,h,opts){
      var box=Math.min(h,16);
      var label=opts.label||"Check box";
      var base=function(ticked){
        var objs=[
          compShape("rect",0,Math.round((h-box)/2),box,box,"#FFFFFF","#555555",1),
          compText(box+6,Math.round(h/2-7),w-box-6,14,label,{size:11,align:"left"})
        ];
        if(ticked){
          // A tick drawn as two strokes, so it scales and recolours with the
          // rest of the artwork rather than being a glyph in a font.
          var a=compShape("line",3,Math.round((h-box)/2)+box/2,box/2-2,box/2-4,
                          null,"#226622",2);
          var b=compShape("line",box/2+1,Math.round((h-box)/2)+box-4,box/2-3,-(box-7),
                          null,"#226622",2);
          objs.push(a,b);
        }
        return objs;
      };
      return {behavior:"graphic",frames:[base(false),base(true)]};
    },
    script:function(){
      /* Frame 1 is off and frame 2 is on, so the state IS the frame — which
         means a script can read it without a variable to keep in step. */
      return "onClipEvent (load) {\n  checked = false;\n}\n\n"+
             "on (release) {\n  checked = !checked;\n  gotoAndStop(checked ? 2 : 1);\n}";
    }
  },
  {
    id:"radio",label:"Radio Button",
    width:120,height:20,
    describe:"A round one-of-many button, in a named group.",
    build:function(w,h,opts){
      var d=Math.min(h,16);
      var label=opts.label||"Option";
      var base=function(on){
        var objs=[
          compShape("oval",0,Math.round((h-d)/2),d,d,"#FFFFFF","#555555",1),
          compText(d+6,Math.round(h/2-7),w-d-6,14,label,{size:11,align:"left"})
        ];
        if(on){
          objs.push(compShape("oval",4,Math.round((h-d)/2)+4,d-8,d-8,"#226622",null,0));
        }
        return objs;
      };
      return {behavior:"graphic",frames:[base(false),base(true)]};
    },
    script:function(opts){
      var group=behaviorIdent(opts.group||"group1");
      /* One-of-many needs the OTHERS switched off, and the group is the only
         thing that knows which others those are. Kept on the root, where every
         member of the group can see it. */
      return "on (release) {\n"+
             "  _root."+group+" = this._name;\n"+
             "  gotoAndStop(2);\n"+
             "  for (var n in _root) {\n"+
             "    var other = _root[n];\n"+
             "    if (other != this && other._radioGroup == \""+group+"\") other.gotoAndStop(1);\n"+
             "  }\n"+
             "}\n\n"+
             "onClipEvent (load) {\n  _radioGroup = \""+group+"\";\n}";
    }
  },
  {
    id:"input",label:"Text Input",
    width:160,height:24,
    describe:"A field the reader types into, readable from script.",
    build:function(w,h,opts){
      var name=behaviorIdent(opts.instanceName||"field1");
      var t=compText(3,Math.round(h/2-8),w-6,16,"",{
        size:12,align:"left",textType:"input",instanceName:name
      });
      t.maxChars=opts.maxChars||0;
      return {
        behavior:"movieclip",
        frames:[[
          compShape("rect",0,0,w,h,"#FFFFFF","#555555",1),
          t
        ]]
      };
    },
    script:function(opts){
      var name=behaviorIdent(opts.instanceName||"field1");
      return "// The field inside is named \""+name+"\".\n"+
             "// In a frame script: trace(root."+name+".text)";
    }
  },
  {
    id:"slider",label:"Slider",
    width:160,height:20,
    describe:"A draggable handle reporting 0–100 on `value`.",
    build:function(w,h){
      var th=Math.min(h,14);
      return {
        behavior:"movieclip",
        frames:[[
          compShape("rect",0,Math.round(h/2-2),w,4,"#BBBBBB","#777777",1),
          (function(){
            var k=compShape("rect",0,Math.round((h-th)/2),12,th,"#E4E4E4","#555555",1);
            k.instanceName="knob";
            return k;
          })()
        ]]
      };
    },
    script:function(opts){
      var span=Math.max(1,(opts.width||160)-12);
      /* Dragged by hand rather than with startDrag, which is one of the calls
         flashy-as2.js still stubs. Clamped to the track, and `value` is
         published on the root so something else can read it. */
      return "onClipEvent (load) {\n  value = 0;\n  dragging = false;\n}\n\n"+
             "on (press) {\n  dragging = true;\n}\n\n"+
             "on (release) {\n  dragging = false;\n}\n\n"+
             "on (releaseOutside) {\n  dragging = false;\n}\n\n"+
             "onClipEvent (mouseMove) {\n"+
             "  if (!dragging) return;\n"+
             "  var x = _xmouse - 6;\n"+
             "  if (x < 0) x = 0;\n"+
             "  if (x > "+span+") x = "+span+";\n"+
             "  knob._x = x;\n"+
             "  value = Math.round((x / "+span+") * 100);\n"+
             "  _root.sliderValue = value;\n"+
             "  updateAfterEvent();\n"+
             "}";
    }
  },
  {
    id:"progress",label:"Progress Bar",
    width:160,height:14,
    describe:"A bar driven by `setProgress(0–100)`.",
    build:function(w,h){
      return {
        behavior:"movieclip",
        frames:[[
          compShape("rect",0,0,w,h,"#EEEEEE","#777777",1),
          (function(){
            var f=compShape("rect",1,1,w-2,h-2,"#4A7FB5",null,0);
            f.instanceName="fill";
            return f;
          })()
        ]]
      };
    },
    script:function(opts){
      var w=Math.max(2,(opts.width||160)-2);
      return "onClipEvent (load) {\n"+
             "  // Starts empty. Call setProgress from a frame script:\n"+
             "  //   root.bar1.setProgress(50)\n"+
             "  fill._xscale = 0;\n"+
             "  setProgress = function (pct) {\n"+
             "    if (pct < 0) pct = 0;\n"+
             "    if (pct > 100) pct = 100;\n"+
             "    fill._width = ("+w+" * pct) / 100;\n"+
             "  };\n"+
             "}";
    }
  }
];

/**
 * Put a component on the stage.
 *
 * It becomes a library symbol plus an instance, so a second one costs nothing
 * and editing the symbol changes both — which is what a component is for.
 */
function addComponent(id,opts){
  opts=opts||{};
  var spec=COMPONENTS.filter(function(c){return c.id===id;})[0];
  if(!spec)return {ok:false,reason:"unknown"};
  if(!layerEditable())return {ok:false,reason:"locked"};
  var w=Math.max(8,opts.width||spec.width);
  var h=Math.max(8,opts.height||spec.height);
  var built=spec.build(w,h,Object.assign({width:w,height:h},opts));

  pushUndo();
  var name=uniqueSymbolName(opts.name||spec.label);
  var layer=new Layer("Layer 1");
  layer.keyframes=built.frames.map(function(objs,i){
    var kf=new KeyFrame(i+1);
    kf.duration=1;
    kf.objects=objs;
    return kf;
  });
  doc.library[name]={
    objects:built.frames[0].map(function(o){return o.clone();}),
    layers:[layer],
    totalFrames:built.frames.length,
    behavior:built.behavior,
    folder:"Components",
    mouthChart:null,scale9:null,
    exportForAS:false,linkageName:""
  };

  var kf=CKF();
  if(!kf){var l=CL();if(l)kf=l.insertKeyframe(curFrame);}
  if(!kf)return {ok:false,reason:"frame"};
  var inst=new EditorObject("symbol");
  inst.symbolName=name;
  inst.symbolBehavior=built.behavior;
  inst.instanceName=behaviorIdent(opts.instanceName||(id+"1"));
  inst.width=w;inst.height=h;
  // Dropped in the middle of the stage, where it can be seen, rather than at
  // the origin under whatever is already there.
  inst.x=Math.round((doc.width-w)/2);
  inst.y=Math.round((doc.height-h)/2);
  inst.firstFrame=1;
  inst.loopMode="single";
  inst.clipScript=spec.script
    ? spec.script(Object.assign({width:w,height:h},opts))
    : "";
  kf.objects.push(inst);
  selection=[inst];
  return {ok:true,name:name,instance:inst};
}

function showComponentsDialog(){
  showDialog({
    title:"Components",
    message:"Ready-made pieces, added as ordinary library symbols with handlers "+
            "on them — so you can open one and change it, and it exports through "+
            "the paths that already exist.",
    fields:[
      {name:"id",label:"Component",type:"select",value:COMPONENTS[0].id,
       options:COMPONENTS.map(function(c){return [c.id,c.label];})},
      {name:"label",label:"Label",value:"Button"},
      {name:"instanceName",label:"Instance name",value:""},
      {name:"width",label:"Width",type:"number",value:COMPONENTS[0].width,min:8,max:2000},
      {name:"height",label:"Height",type:"number",value:COMPONENTS[0].height,min:8,max:2000},
      {name:"gotoFrame",label:"Button goes to frame",value:"",
       placeholder:"blank = trace instead"},
      {name:"group",label:"Radio group",value:"group1"}
    ],
    footnote:COMPONENTS.map(function(c){return c.label+" — "+c.describe;}).join("\n"),
    onOk:function(v){
      var r=addComponent(v.id,{
        label:v.label,
        instanceName:v.instanceName,
        width:parseInt(v.width,10)||0,
        height:parseInt(v.height,10)||0,
        gotoFrame:v.gotoFrame,
        group:v.group
      });
      if(r.ok){
        fullRefresh();
        outputLog("Added component “"+r.name+"”.");
      }else if(r.reason==="locked"){
        showMessage("Components","This layer is locked or hidden.");
      }
    }
  });
}

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
/*
 * The Library is for browsing at least as much as for placing, and it used to
 * be only the latter: one click on an item dropped an instance on the stage.
 * Looking through what an imported movie brought in — a thousand symbols, in
 * the case of a real Flash game — meant littering the timeline with every one
 * you glanced at, and then undoing it.
 *
 * So a click now selects, and the panel shows the thing: a preview of the
 * symbol's first frame, or of the bitmap, with its size. Placing is a
 * deliberate act — drag the item onto the stage where you want it, or press
 * Place on Stage. Opening it (double-click, Open, or the context menu) goes
 * into the item itself: a symbol opens for editing, a bitmap opens its own
 * window, where it can be traced.
 */
var libSel = null;         // {kind:"symbol"|"bitmap", name:string} — the browsed item
var libRows = [];          // rendered rows, so re-selecting one does not rebuild the panel
var libPreviewEls = null;  // the preview canvas, its caption and buttons
var LIB_DRAG = "application/x-flashy-lib";

/** The selection, if it still exists — a delete or an undo can strand it. */
function libSelected(){
  if(!libSel)return null;
  var live=libSel.kind==="symbol"?!!doc.library[libSel.name]
                                :!!(doc.bitmaps&&doc.bitmaps[libSel.name]);
  if(!live)libSel=null;
  return libSel;
}

/* ------------------------------------------------------------------ *
 * Library management
 *
 * The Library was a flat, unsorted, unsearchable list with Rename and Delete
 * on it. A document with thirty symbols — which is a short cartoon — was
 * unusable: no folders, no search, no way to duplicate a symbol to make a
 * variant, no way to swap an instance for another symbol, and no way to find
 * the ones nothing uses.
 *
 * Folders use the same idea the rest of the document uses for hierarchy: a
 * path on the item rather than a tree beside it. `sym.folder` is "Hands/Left"
 * or "", which cannot get out of step with the item it describes and needs no
 * migration for a document written before folders existed.
 * ------------------------------------------------------------------ */

var librarySort="name";        // name | kind | use | folder
var librarySearch="";
var libraryOpenFolders={};     // path -> false when collapsed

/** The folder an item is in: "" for the top level. */
function libFolderOf(kind,name){
  var item=kind==="symbol"?(doc.library||{})[name]:(doc.bitmaps||{})[name];
  var f=item&&item.folder;
  return typeof f==="string"?f.replace(/^\/+|\/+$/g,""):"";
}

function setLibFolder(kind,name,folder){
  var item=kind==="symbol"?(doc.library||{})[name]:(doc.bitmaps||{})[name];
  if(!item)return false;
  item.folder=String(folder||"").replace(/^\/+|\/+$/g,"");
  return true;
}

/** How many times a library item is used anywhere in the document. */
function libUseCount(kind,name){
  var n=0;
  var visit=function(objs){
    (objs||[]).forEach(function(o){
      if(kind==="symbol"&&o.type==="symbol"&&o.symbolName===name)n++;
      if(kind==="bitmap"&&o.type==="bitmap"&&o.bitmapAsset===name)n++;
      if(o.children)visit(o.children);
    });
  };
  docScenes().forEach(function(scene,si){
    var layers=(si===doc.sceneIndex)?doc.layers:scene.layers;
    (layers||[]).forEach(function(l){
      (l.keyframes||[]).forEach(function(kf){
        visit(kf.objects);
        if(kind==="sound"&&kf.sound&&kf.sound.asset===name)n++;
      });
    });
  });
  // Instances INSIDE other symbols count too: a symbol used only by another
  // symbol is still used, and reporting it as unused would invite deleting it.
  Object.keys(doc.library||{}).forEach(function(sn){
    var sym=doc.library[sn];
    if(!sym)return;
    visit(sym.objects);
    (sym.layers||[]).forEach(function(l){
      (l.keyframes||[]).forEach(function(kf){visit(kf.objects);});
    });
  });
  return n;
}

/** Library items nothing refers to. */
function unusedLibraryItems(){
  var out=[];
  Object.keys(doc.library||{}).forEach(function(n){
    if(!libUseCount("symbol",n))out.push({kind:"symbol",name:n});
  });
  Object.keys(doc.bitmaps||{}).forEach(function(n){
    if(!libUseCount("bitmap",n))out.push({kind:"bitmap",name:n});
  });
  Object.keys(doc.sounds||{}).forEach(function(n){
    if(!libUseCount("sound",n))out.push({kind:"sound",name:n});
  });
  return out;
}

/**
 * Duplicate a symbol.
 *
 * A deep copy through the serializer rather than a hand-written clone: a
 * symbol's layers hold keyframes which hold objects which may hold children
 * and filters, and anything shallower would leave the duplicate sharing
 * structure with the original — which is the bug group children and filter
 * stacks both had.
 */
function duplicateSymbol(name,newName){
  var sym=(doc.library||{})[name];
  if(!sym)return {ok:false,reason:"missing"};
  var target=uniqueSymbolName(newName||(name+" copy"));
  var plain=serializeLibrary({x:sym}).x;
  var copy=reviveLibrary({x:plain}).x;
  copy.folder=sym.folder||"";
  doc.library[target]=copy;
  return {ok:true,name:target};
}

/** Swap every selected instance for another symbol, keeping its box. */
function swapSymbolOnSelection(toName){
  if(!doc.library[toName])return {ok:false,reason:"missing"};
  var targets=selection.filter(function(o){return o.type==="symbol";});
  if(!targets.length)return {ok:false,reason:"selection"};
  pushUndo();
  targets.forEach(function(o){
    o.symbolName=toName;
    /* The instance keeps its position, size and transform — swapping a symbol
       is replacing what is drawn, not where it is. That is the whole point of
       the command: a walk cycle becomes a run cycle without re-placing it. */
    o.firstFrame=1;
  });
  return {ok:true,count:targets.length};
}

/** The rows the Library panel shows, grouped by folder and sorted. */
function libraryRows(){
  var q=librarySearch.trim().toLowerCase();
  var rows=[];
  var push=function(kind,name){
    if(q&&name.toLowerCase().indexOf(q)<0)return;
    rows.push({
      kind:kind,name:name,
      folder:libFolderOf(kind,name),
      uses:libUseCount(kind,name)
    });
  };
  Object.keys(doc.library||{}).forEach(function(n){push("symbol",n);});
  Object.keys(doc.bitmaps||{}).forEach(function(n){push("bitmap",n);});

  rows.sort(function(a,b){
    if(librarySort==="kind"&&a.kind!==b.kind)return a.kind<b.kind?-1:1;
    if(librarySort==="use"&&a.uses!==b.uses)return b.uses-a.uses;
    if(librarySort==="folder"&&a.folder!==b.folder)return a.folder<b.folder?-1:1;
    return a.name.toLowerCase()<b.name.toLowerCase()?-1:1;
  });

  /* Grouped by folder, with the top level first. A search flattens the
     grouping: when you are looking for one thing, which folder it is in is
     the answer rather than an obstacle. */
  if(q)return {flat:true,rows:rows,folders:[]};
  var byFolder={};
  rows.forEach(function(r){
    (byFolder[r.folder]||(byFolder[r.folder]=[])).push(r);
  });
  var folders=Object.keys(byFolder).sort();
  return {flat:false,rows:rows,folders:folders,byFolder:byFolder};
}

/** Every folder path in use, for the move-to dialog. */
function libraryFolders(){
  var set={};
  Object.keys(doc.library||{}).forEach(function(n){
    var f=libFolderOf("symbol",n);
    if(f)set[f]=true;
  });
  Object.keys(doc.bitmaps||{}).forEach(function(n){
    var f=libFolderOf("bitmap",n);
    if(f)set[f]=true;
  });
  return Object.keys(set).sort();
}

function showLibraryFolderDialog(kind,name){
  var current=libFolderOf(kind,name);
  var existing=libraryFolders();
  showDialog({
    title:"Move to Folder — "+name,
    message:"A folder is just a path on the item, so renaming or emptying one "+
            "cannot leave anything orphaned. Leave it blank for the top level.",
    fields:[
      {name:"folder",label:"Folder",value:current,
       placeholder:existing.length?existing[0]:"Hands/Left"},
      existing.length?{name:"pick",label:"Existing",type:"select",value:"",
        options:[["",""]].concat(existing.map(function(f){return [f,f];}))}:null
    ].filter(Boolean),
    onOk:function(v){
      pushUndo();
      setLibFolder(kind,name,v.pick||v.folder);
      fullRefresh();
    }
  });
}

/**
 * Symbol linkage — "export for ActionScript".
 *
 * A linkage name is what lets a script create an instance of a symbol that is
 * nowhere on any timeline: a bullet, a particle, a row of a list. Without it
 * everything that appears has to have been placed by hand first, which rules
 * out anything generated.
 *
 * The name has to DO something or it is just a field, so the exported player
 * registers linked symbols and `attachMovie(name, instance, depth)` — Flash's
 * own call, and until now a stub that logged a warning — builds one.
 */
function showLinkageDialog(name){
  var sym=(doc.library||{})[name];
  if(!sym){showMessage("Linkage","That symbol is no longer in the library.");return;}
  showDialog({
    title:"Linkage — "+name,
    message:"Give the symbol a name a script can use, then call "+
            "attachMovie(\"name\", \"instance\", depth) to create one at runtime. "+
            "This is how anything generated gets on screen: a bullet, a "+
            "particle, a row of a list.",
    fields:[
      {name:"exportForAS",label:"Export for ActionScript",type:"checkbox",
       value:!!sym.exportForAS},
      {name:"linkageName",label:"Identifier",
       value:sym.linkageName||name.replace(/[^\w$]/g,"")||"Symbol"}
    ],
    footnote:"Unexported symbols are still placed from the Library as usual; "+
             "linkage only adds the runtime route.",
    onOk:function(v){
      pushUndo();
      sym.exportForAS=!!v.exportForAS;
      sym.linkageName=String(v.linkageName||"").trim();
      if(sym.exportForAS&&!sym.linkageName){
        // An exported symbol with no identifier cannot be reached, which is
        // the one combination that means nothing.
        sym.linkageName=name.replace(/[^\w$]/g,"")||"Symbol";
      }
      fullRefresh();
      outputLog(sym.exportForAS
        ? ("Linkage: attachMovie(\""+sym.linkageName+"\", \"instance\", 1)")
        : ("Linkage removed from "+name));
    }
  });
}

function showDuplicateSymbolDialog(name){
  showDialog({
    title:"Duplicate Symbol",
    message:"A copy with its own timeline — edit one without changing the other. "+
            "This is how a variant is made: duplicate, then change the copy.",
    fields:[{name:"name",label:"Name",value:uniqueSymbolName(name+" copy")}],
    onOk:function(v){
      pushUndo();
      var r=duplicateSymbol(name,v.name);
      if(r.ok){
        selectLibItem("symbol",r.name);
        fullRefresh();
      }
    }
  });
}

function showSwapSymbolDialog(){
  var names=Object.keys(doc.library||{});
  var targets=selection.filter(function(o){return o.type==="symbol";});
  if(!targets.length){
    showMessage("Swap Symbol","Select one or more symbol instances on the stage first.");
    return;
  }
  var others=names.filter(function(n){return n!==targets[0].symbolName;});
  if(!others.length){
    showMessage("Swap Symbol","There is only one symbol in the library to swap to.");
    return;
  }
  showDialog({
    title:"Swap Symbol",
    message:"The instance keeps its position, size and transform — swapping is "+
            "replacing what is drawn, not where it is.",
    fields:[{name:"symbol",label:"Swap for",type:"select",value:others[0],
             options:others.map(function(n){return [n,n];})}],
    onOk:function(v){
      var r=swapSymbolOnSelection(v.symbol);
      if(r.ok)fullRefresh();
    }
  });
}

function showUnusedItemsDialog(){
  var unused=unusedLibraryItems();
  if(!unused.length){
    showMessage("Unused Library Items",
      "Everything in the library is used somewhere — including items used only "+
      "inside another symbol, which still count.");
    return;
  }
  var list=unused.map(function(u){return u.kind+": "+u.name;}).join("\n");
  showDialog({
    title:"Unused Library Items",
    message:unused.length+" item"+(unused.length===1?"":"s")+
            " nothing refers to:\n\n"+list+
            "\n\nDeleting them makes the document smaller. Nothing on any "+
            "timeline, in any scene or inside any other symbol uses them.",
    okLabel:"Delete them",
    onOk:function(){
      pushUndo();
      unused.forEach(function(u){
        if(u.kind==="symbol")delete doc.library[u.name];
        else if(u.kind==="bitmap")delete doc.bitmaps[u.name];
        else if(u.kind==="sound")delete doc.sounds[u.name];
      });
      outputLog("Deleted "+unused.length+" unused library item"+
                (unused.length===1?"":"s")+".");
      fullRefresh();
    }
  });
}

function updateLib(){
  var lp=document.getElementById("libPanel");
  if(!lp)return;
  lp.textContent="";
  libRows=[];libPreviewEls=null;
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

  lp.appendChild(libPreviewBox());

  /* Search and sort. A flat unsorted list is unusable at thirty symbols, and
     thirty is a short cartoon \u2014 the previous panel had no way to find
     anything, order anything, or see what was unused. */
  var bar=document.createElement("div");
  bar.className="lib-bar";
  var q=document.createElement("input");
  q.type="text";
  q.className="lib-search";
  q.placeholder="Find\u2026";
  q.value=librarySearch;
  q.addEventListener("input",function(){
    librarySearch=q.value;
    updateLib();
    /* The panel is rebuilt, so the field is a new element: focus has to be put
       back or the second keystroke goes nowhere. */
    var again=document.querySelector(".lib-search");
    if(again){again.focus();again.setSelectionRange(again.value.length,again.value.length);}
  });
  bar.appendChild(q);
  var sortSel=document.createElement("select");
  sortSel.className="lib-sort";
  [["name","Name"],["kind","Kind"],["use","Most used"],["folder","Folder"]]
    .forEach(function(p){
      var op=document.createElement("option");
      op.value=p[0];op.textContent=p[1];
      if(librarySort===p[0])op.selected=true;
      sortSel.appendChild(op);
    });
  sortSel.title="Sort the library";
  sortSel.addEventListener("change",function(){
    librarySort=sortSel.value;updateLib();
  });
  bar.appendChild(sortSel);
  lp.appendChild(bar);

  /* Bitmaps share the Library, because that is what they are: reusable assets
     referenced by name. The use count is on every row \u2014 "unused" is the one
     piece of information that decides whether an item can go. */
  var rowFor=function(r){
    if(r.kind==="symbol"){
      var sym=doc.library[r.name];
      return libRow("symbol",r.name,{
        icon:"\u25A3",
        dim:(sym&&sym.behavior&&sym.behavior!=="movieclip")?sym.behavior:"",
        use:r.uses,
        title:r.name+"\n"+
          (r.uses?(r.uses+" instance"+(r.uses===1?"":"s")):"Not used anywhere")+
          ((sym&&sym.exportForAS&&sym.linkageName)
            ? ("\nExported for ActionScript as \u201C"+sym.linkageName+"\u201D") : "")+
          "\nDrag onto the stage to place it. Double-click to open it."
      });
    }
    var a=doc.bitmaps[r.name];
    return libRow("bitmap",r.name,{
      icon:"\u25A6",
      dim:a&&a.width?a.width+"\u00D7"+a.height:"",
      use:r.uses,
      title:r.name+(a&&a.width?" \u2014 "+a.width+"\u00D7"+a.height+" px":"")+
        "\n"+(r.uses?(r.uses+" use"+(r.uses===1?"":"s")):"Not used anywhere")+
        "\nDrag onto the stage to place it. Double-click to open it."
    });
  };

  var listing=libraryRows();
  if(!listing.rows.length){
    var none=document.createElement("div");
    none.className="lib-empty";
    none.textContent="Nothing matches \u201C"+librarySearch+"\u201D";
    lp.appendChild(none);
  }else if(listing.flat){
    listing.rows.forEach(function(r){lp.appendChild(rowFor(r));});
  }else{
    listing.folders.forEach(function(folder){
      if(folder){
        var open=libraryOpenFolders[folder]!==false;
        var head=document.createElement("div");
        head.className="lib-folder"+(open?" open":"");
        head.textContent=(open?"\u25BE ":"\u25B8 ")+folder;
        head.title="Click to collapse or expand";
        head.addEventListener("click",function(){
          libraryOpenFolders[folder]=!open;
          updateLib();
        });
        lp.appendChild(head);
        if(!open)return;
      }
      listing.byFolder[folder].forEach(function(r){lp.appendChild(rowFor(r));});
    });
  }

  var acts=document.createElement("div");
  acts.className="props-row";
  acts.style.cssText="gap:2px;flex-wrap:wrap";
  [["Unused\u2026","libUnused"],["Swap\u2026","swapSymbol"]].forEach(function(p){
    var b=document.createElement("button");
    b.className="props-btn-action";
    b.textContent=p[0];
    b.addEventListener("click",function(){doAction(p[1]);});
    acts.appendChild(b);
  });
  lp.appendChild(acts);

  var hint=document.createElement("div");
  hint.className="lib-hint";
  hint.textContent="Drag an item onto the stage, or select it and press Place. "+
    "Right-click for folders, duplicate and linkage.";
  lp.appendChild(hint);

  paintLibPreview();
}

function libRow(kind,name,opts){
  var row=document.createElement("div");
  row.className="lib-item";
  row.draggable=true;
  row.dataset.libKind=kind;
  row.dataset.libName=name;
  var icon=document.createElement("span");
  icon.className="lib-icon";icon.textContent=opts.icon;
  row.appendChild(icon);
  var label=document.createElement("span");
  label.className="lib-name";
  label.textContent=name;
  row.appendChild(label);
  if(opts.dim){
    var dim=document.createElement("span");
    dim.className="lib-dim";dim.textContent=opts.dim;
    row.appendChild(dim);
  }
  /* The use count is its own element rather than part of `dim`: "unused" is
     the one piece of information that decides whether an item can go, and the
     dimensions are the one that says what it is. Crowding either out of the
     other's slot loses one of them. */
  if(opts.use!=null){
    var use=document.createElement("span");
    use.className="lib-use"+(opts.use?"":" unused");
    use.textContent=opts.use?(opts.use+"×"):"unused";
    use.title=opts.use
      ? (opts.use+" use"+(opts.use===1?"":"s")+" in this document")
      : "Nothing refers to this";
    row.appendChild(use);
  }
  row.title=opts.title;

  row.addEventListener("click",function(){selectLibItem(kind,name);});
  row.addEventListener("dblclick",function(e){
    e.stopPropagation();
    openLibItem(kind,name);
  });
  row.addEventListener("dragstart",function(e){
    selectLibItem(kind,name);
    if(!e.dataTransfer)return;
    e.dataTransfer.effectAllowed="copy";
    /* A type of its own, because the stage has to recognise the drag while it
       is still in flight — and a browser will not reveal a payload before the
       drop, only the list of types. */
    try{
      e.dataTransfer.setData(LIB_DRAG,kind+":"+name);
      e.dataTransfer.setData("text/plain",name);
    }catch(err){/* a browser that refuses custom types still has the type list */}
  });
  row.addEventListener("contextmenu",function(e){
    e.preventDefault();e.stopPropagation();
    selectLibItem(kind,name);
    showLibMenu(e,kind,name);
  });
  if(libSel&&libSel.kind===kind&&libSel.name===name)row.classList.add("sel");
  libRows.push({el:row,kind:kind,name:name});
  return row;
}

function selectLibItem(kind,name){
  libSel={kind:kind,name:name};
  libRows.forEach(function(r){
    r.el.classList.toggle("sel",r.kind===kind&&r.name===name);
  });
  paintLibPreview();
}

function libPreviewBox(){
  var wrap=document.createElement("div");
  wrap.className="lib-preview";
  var cv=document.createElement("canvas");
  cv.className="lib-preview-canvas";
  /* The buffer is sized to the box the panel gives it rather than scaled to
     fit: a fixed buffer stretched by CSS distorts everything drawn in it, and
     the Library panel is resizable. */
  cv.width=168;cv.height=LIB_PREVIEW_H;
  wrap.appendChild(cv);
  var meta=document.createElement("div");
  meta.className="lib-preview-meta";
  wrap.appendChild(meta);
  var btns=document.createElement("div");
  btns.className="lib-preview-btns";
  var place=document.createElement("button");
  place.className="lib-btn";place.type="button";place.textContent="Place on Stage";
  place.addEventListener("click",function(){
    var sel=libSelected();
    if(sel)placeLibItem(sel.kind,sel.name,{});
  });
  var open=document.createElement("button");
  open.className="lib-btn";open.type="button";open.textContent="Open";
  open.addEventListener("click",function(){
    var sel=libSelected();
    if(sel)openLibItem(sel.kind,sel.name);
  });
  btns.appendChild(place);btns.appendChild(open);
  wrap.appendChild(btns);
  libPreviewEls={wrap:wrap,canvas:cv,meta:meta,place:place,open:open};
  fitLibPreview();
  /* updateLib runs on every refresh, so the observer is replaced rather than
     added to — a few hundred refreshes with a thousand symbols in the library
     is a lot of observers watching elements that are no longer in the page. */
  if(typeof ResizeObserver!=="undefined"){
    if(libPreviewRO)libPreviewRO.disconnect();
    libPreviewRO=new ResizeObserver(function(){fitLibPreview();});
    libPreviewRO.observe(wrap);
    var panel=document.getElementById("libPanel");
    if(panel)libPreviewRO.observe(panel);
  }
  return wrap;
}

var LIB_PREVIEW_H=96;
var LIB_STICKY_MIN=220;   // below this the preview would cover the list
var libPreviewRO=null;

/**
 * Fit the preview to the panel.
 *
 * Three things have to hold however the Library is docked. Its buffer matches
 * its laid-out width, so nothing drawn in it is stretched. Its height is a
 * share of the panel, so a Library in a short space is still a list with a
 * preview on it rather than a preview with the list pushed out of sight — and
 * below the height where that share is worth anything, the picture goes and
 * the caption and buttons stay. And it only sticks to the top while the panel
 * is tall enough to scroll usefully underneath it; in a short one a sticky
 * preview would simply cover the rows it is meant to be describing.
 */
function fitLibPreview(){
  if(!libPreviewEls)return;
  var cv=libPreviewEls.canvas;
  var panel=document.getElementById("libPanel");
  var avail=panel?panel.clientHeight:0;
  libPreviewEls.wrap.classList.toggle("stuck",avail>=LIB_STICKY_MIN);
  var h=avail?Math.min(LIB_PREVIEW_H,Math.round(avail*0.42)):LIB_PREVIEW_H;
  var show=h>=40;
  cv.style.display=show?"":"none";
  if(!show)return;
  var w=Math.max(60,Math.round(cv.clientWidth||cv.width));
  cv.style.height=h+"px";
  if(cv.width===w&&cv.height===h)return;
  cv.width=w;cv.height=h;
  paintLibPreview();
}

/** Scale `w`x`h` of content to fit the preview, then draw it through `body`. */
function libFit(cx,cv,w,h,body){
  if(!(w>0)||!(h>0))return;
  var pad=8;
  var k=Math.min((cv.width-pad*2)/w,(cv.height-pad*2)/h,4);
  cx.save();
  cx.translate(cv.width/2-(w*k)/2,cv.height/2-(h*k)/2);
  cx.scale(k,k);
  body();
  cx.restore();
}

function paintLibPreview(){
  if(!libPreviewEls)return;
  var cv=libPreviewEls.canvas,cx=cv.getContext("2d");
  cx.clearRect(0,0,cv.width,cv.height);
  /* A chequer, so artwork with transparency reads as transparent instead of
     as whatever colour the panel happens to be. */
  var s=8;
  for(var y=0;y<cv.height;y+=s)for(var x=0;x<cv.width;x+=s){
    cx.fillStyle=((x/s+y/s)%2)?"#2f2f2f":"#383838";
    cx.fillRect(x,y,s,s);
  }
  var sel=libSelected();
  libPreviewEls.place.disabled=!sel;
  libPreviewEls.open.disabled=!sel;
  if(!sel){
    libPreviewEls.meta.textContent="Select an item to see it here.";
    libPreviewEls.open.textContent="Open";
    return;
  }
  if(sel.kind==="bitmap"){
    var a=doc.bitmaps[sel.name]||{};
    libPreviewEls.open.textContent="Open Bitmap";
    libPreviewEls.meta.textContent=sel.name+
      (a.width?" \u2014 "+a.width+"\u00D7"+a.height+" px":"");
    var img=bitmapImage(sel.name);
    if(!img){
      // Not decoded yet: decode it, then come back and draw it.
      decodeBitmap(sel.name).then(function(){paintLibPreview();});
      return;
    }
    var iw=img.naturalWidth||img.width||1,ih=img.naturalHeight||img.height||1;
    libFit(cx,cv,iw,ih,function(){cx.drawImage(img,0,0);});
    return;
  }
  var sym=doc.library[sel.name];
  libPreviewEls.open.textContent="Edit Symbol";
  var box=symbolContentBox(sym);
  libPreviewEls.meta.textContent=sel.name+" \u2014 "+box.w+"\u00D7"+box.h+
    ((sym&&sym.behavior)?" \u00B7 "+sym.behavior:"");
  libFit(cx,cv,box.w,box.h,function(){
    cx.translate(-box.x,-box.y);
    box.objects.forEach(function(o){paintObj(cx,o,{chrome:false});});
  });
}

/**
 * A symbol's first frame, and the box around it.
 *
 * Deliberately does not call ensureSymbolLayers: looking at a symbol must not
 * rewrite it, or browsing the Library would quietly edit the document.
 */
function symbolContentBox(sym){
  var objs=[];
  if(sym&&sym.layers&&sym.layers.length){
    for(var i=sym.layers.length-1;i>=0;i--){
      var l=sym.layers[i];
      if(!layerShows(l))continue;
      var kf=(typeof l.getKeyframeAt==="function")?l.getKeyframeAt(1):(l.keyframes||[])[0];
      if(kf)objs=objs.concat(kf.objects||[]);
    }
  }else if(sym)objs=(sym.objects||[]).slice();
  objs=objs.map(function(o){
    return (o&&typeof o.clone==="function")?o:reviveObject(o);
  });
  if(!objs.length)return {objects:[],x:0,y:0,w:80,h:80};
  var b=getBounds(objs);
  return {objects:objs,x:b.x,y:b.y,
          w:Math.max(1,Math.round(b.w)),h:Math.max(1,Math.round(b.h))};
}

/** Put an instance of a library item on the current frame. */
function placeLibItem(kind,name,opts){
  pushUndo();
  var placed=(kind==="bitmap")?placeBitmap(name,opts||{})
                              :placeSymbolInstance(name,opts||{});
  if(placed)selection=[placed];
  fullRefresh();
  return placed;
}

/**
 * An instance of a library symbol, at the size of its own artwork.
 *
 * It used to arrive as a 50x50 box whatever it contained, so every symbol
 * placed from the Library had to be resized by hand before it looked like
 * itself.
 */
function placeSymbolInstance(name,opts){
  opts=opts||{};
  var sym=doc.library[name];
  if(!sym)return null;
  var kf=CKF();
  if(!kf){var l=CL();if(l)kf=l.insertKeyframe(curFrame);}
  if(!kf)return null;
  var size=symbolBounds(sym);
  var o=new EditorObject("symbol");
  o.symbolName=name;
  o.width=size.width;o.height=size.height;
  if(opts.x!=null&&opts.y!=null){o.x=opts.x;o.y=opts.y;}
  else if(opts.dropX!=null&&opts.dropY!=null){
    o.x=Math.round(opts.dropX-size.width/2);
    o.y=Math.round(opts.dropY-size.height/2);
  }else{
    o.x=Math.round((doc.width-size.width)/2);
    o.y=Math.round((doc.height-size.height)/2);
  }
  kf.objects.push(o);
  return o;
}

/** Open the item itself: a symbol for editing, a bitmap in its own window. */
function openLibItem(kind,name){
  if(kind==="symbol"){
    if(doc.library[name])enterSymbol(name);
    return;
  }
  showBitmapWindow(name);
}

/**
 * Examine a bitmap: the image, what it is, and what can be done with it.
 * Double-clicking a bitmap used to place an instance and open the tracer on
 * it, which is a lot to happen to a document because somebody wanted to look
 * at the picture.
 */
function showBitmapWindow(name){
  var a=(doc.bitmaps||{})[name];
  if(!a)return;
  showDialog({
    title:name,
    message:(a.width?a.width+" \u00D7 "+a.height+" px":"")+
      (a.mediaType?"  \u00B7  "+a.mediaType:""),
    fields:[],
    okLabel:"Close",
    noCancel:true,
    build:function(body){
      var holder=document.createElement("div");
      holder.className="fy-bitmap-view";
      var img=document.createElement("img");
      img.alt=name;
      img.src=bitmapDataURL(name);
      holder.appendChild(img);
      body.appendChild(holder);
    },
    extraButtons:[
      {label:"Place on Stage",onClick:function(_v,close){
        close();
        placeLibItem("bitmap",name,{});
      }},
      {label:"Trace Bitmap...",onClick:function(_v,close){
        close();
        traceLibBitmap(name);
      }}
    ]
  });
}

/* The tracer works on a placed bitmap, so trace what is selected if it is
   this asset, and place one to work on if it is not. */
function traceLibBitmap(name){
  var placed=selectedBitmap();
  if(!placed||placed.bitmapAsset!==name)placed=placeLibItem("bitmap",name,{});
  if(placed)showTraceBitmapDialog();
}

function showLibMenu(e,kind,name){
  var items=[
    {label:"Place on Stage",onClick:function(){placeLibItem(kind,name,{});}},
    {label:kind==="symbol"?"Edit Symbol":"Open Bitmap",
     onClick:function(){openLibItem(kind,name);}}
  ];
  if(kind==="bitmap"){
    items.push({label:"Trace Bitmap...",onClick:function(){traceLibBitmap(name);}});
  }
  if(kind==="symbol"){
    items.push({label:"Symbol Properties...",onClick:function(){showSymbolPropsDialog(name);}});
    items.push({label:"Duplicate Symbol...",onClick:function(){showDuplicateSymbolDialog(name);}});
    items.push({label:"Linkage...",onClick:function(){showLinkageDialog(name);}});
  }
  items.push({label:"Move to Folder...",onClick:function(){showLibraryFolderDialog(kind,name);}});
  items.push({label:"Select Unused Items...",onClick:function(){showUnusedItemsDialog();}});
  items.push({type:"sep"});
  items.push({label:"Rename...",onClick:function(){renameLibItem(kind,name);}});
  items.push({label:"Delete",onClick:function(){confirmDeleteLibItem(kind,name);}});
  showMenuAt(e.clientX,e.clientY,items);
}

/**
 * Symbol Properties — behaviour and 9-slice guides.
 *
 * The guides are the reason this dialog exists. Without them, a button symbol
 * widened to fit a longer label has its rounded corners smeared; with them,
 * only the middles stretch. Flash drew the guides as dashed lines over the
 * symbol's own editing stage; here they are four numbers, which is the same
 * information and much less machinery.
 */
function showSymbolPropsDialog(name){
  var sym=doc.library[name];
  if(!sym){showMessage("Symbol Properties","That symbol is no longer in the library.");return;}
  var box=symbolContentBox(sym);
  // symbolContentBox reports {w,h}, not {width,height} — reading the wrong
  // pair gave a 1x1 symbol, and a 1x1 symbol's default guides round to zero,
  // which is a grid that does nothing.
  var natW=Math.max(1,Math.round(box.w||1)),natH=Math.max(1,Math.round(box.h||1));
  var g=sym.scale9||{left:0,right:0,top:0,bottom:0};
  showDialog({
    title:"Symbol Properties — "+name,
    message:"Content is "+natW+" × "+natH+" px. 9-slice guides are distances in "+
            "from each edge; leave them at 0 to scale uniformly.",
    fields:[
      {name:"behavior",label:"Behavior",type:"select",value:sym.behavior||"movieclip",
       options:[["movieclip","Movie Clip"],["graphic","Graphic"],["button","Button"]]},
      {name:"slice",label:"9-slice scaling",type:"checkbox",
       value:!!(window.Flashy&&Flashy.Slice9&&Flashy.Slice9.active(sym.scale9))},
      {name:"left",label:"Guide left (px)",type:"number",value:g.left||0,min:0,max:natW},
      {name:"right",label:"Guide right (px)",type:"number",value:g.right||0,min:0,max:natW},
      {name:"top",label:"Guide top (px)",type:"number",value:g.top||0,min:0,max:natH},
      {name:"bottom",label:"Guide bottom (px)",type:"number",value:g.bottom||0,min:0,max:natH}
    ],
    footnote:"Guides wider than the symbol are scaled down together rather than "+
             "overlapping, so a badly set guide degrades instead of breaking.",
    onOk:function(v){
      pushUndo();
      sym.behavior=v.behavior;
      if(v.slice){
        var l=Math.max(0,parseFloat(v.left)||0),r=Math.max(0,parseFloat(v.right)||0);
        var t=Math.max(0,parseFloat(v.top)||0),b=Math.max(0,parseFloat(v.bottom)||0);
        // All four at zero with the box ticked would be a grid that does
        // nothing; a sensible default beats a silent no-op.
        if(!l&&!r&&!t&&!b){
          l=r=Math.max(1,Math.round(natW/3));
          t=b=Math.max(1,Math.round(natH/3));
        }
        sym.scale9={left:l,right:r,top:t,bottom:b};
      }else{
        sym.scale9=null;
      }
      fullRefresh();
    }
  });
}

function renameLibItem(kind,name){
  var taken=kind==="symbol"?doc.library:(doc.bitmaps||{});
  askFor("Rename","Name",name,function(v){
    v=String(v||"").trim();
    if(!v||v===name)return;
    pushUndo();
    if(kind==="symbol")renameSymbolAsset(name,v);
    else renameBitmapAsset(name,v);
    libSel={kind:kind,name:v};
    fullRefresh();
  },{validate:function(v){
    v=String(v||"").trim();
    if(!v)return "Give it a name.";
    if(v!==name&&taken[v])return "\u201C"+v+"\u201D is already taken.";
    return null;
  }});
}

function confirmDeleteLibItem(kind,name){
  showDialog({
    title:kind==="symbol"?"Delete Symbol":"Delete Bitmap",
    message:"Delete \u201C"+name+"\u201D from the library?\n\n"+
            "Every instance of it on the timeline goes too. This can be undone.",
    fields:[],okLabel:"Delete",
    onOk:function(){
      if(kind==="symbol")deleteSymbolAsset(name);
      else deleteBitmapAsset(name);
    }
  });
}

/** Every keyframe in the document, including the ones inside symbols. */
function eachKeyframe(fn){
  var visit=function(layers){
    (layers||[]).forEach(function(l){(l.keyframes||[]).forEach(fn);});
  };
  visit(doc.layers);
  Object.keys(doc.library).forEach(function(k){
    if(doc.library[k]&&doc.library[k].layers)visit(doc.library[k].layers);
  });
}

function renameSymbolAsset(from,to){
  doc.library[to]=doc.library[from];
  delete doc.library[from];
  eachKeyframe(function(kf){
    (kf.objects||[]).forEach(function(o){
      if(o.type==="symbol"&&o.symbolName===from)o.symbolName=to;
    });
  });
  /* A symbol keeps a flat `objects` copy as well as its layers (that is what
     exitSymbol writes back), and instances hide in there too. */
  Object.keys(doc.library).forEach(function(k){
    (doc.library[k].objects||[]).forEach(function(o){
      if(o.type==="symbol"&&o.symbolName===from)o.symbolName=to;
    });
  });
  editStack.forEach(function(ctx){if(ctx.name===from)ctx.name=to;});
}

function renameBitmapAsset(from,to){
  doc.bitmaps[to]=doc.bitmaps[from];
  delete doc.bitmaps[from];
  eachKeyframe(function(kf){
    (kf.objects||[]).forEach(function(o){
      if(o.type==="bitmap"&&o.bitmapAsset===from)o.bitmapAsset=to;
    });
  });
  // The decoded image is cached under the old name; decode it under the new.
  if(typeof Flashy!=="undefined"&&Flashy.Bitmaps){
    Flashy.Bitmaps.remove(from);
    decodeBitmap(to);
  }
}

function deleteSymbolAsset(name){
  pushUndo();
  /* Leave the symbol first: editing the inside of something that no longer
     exists is a stack that cannot be unwound. */
  while(editStack.length&&editStack.some(function(c){return c.name===name;}))exitSymbol();
  delete doc.library[name];
  eachKeyframe(function(kf){
    kf.objects=(kf.objects||[]).filter(function(o){
      return !(o.type==="symbol"&&o.symbolName===name);
    });
  });
  selection=selection.filter(function(o){
    return !(o.type==="symbol"&&o.symbolName===name);
  });
  fullRefresh();
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
  var scenes=docScenes();
  var sceneLink=document.createElement("span");
  // The real scene's real name. This read "Scene 1" unconditionally, which was
  // the one visible hint that scenes existed and the one place they did not.
  sceneLink.textContent=currentScene().name;
  sceneLink.style.cursor="pointer";
  sceneLink.title=scenes.length>1
    ? "Scene "+(doc.sceneIndex+1)+" of "+scenes.length+" — Window ▸ Scene to switch"
    : "Insert ▸ Scene adds another";
  sceneLink.addEventListener("click",function(){exitAllSymbols();});
  bc.appendChild(sceneLink);
  if(scenes.length>1){
    var count=document.createElement("span");
    count.textContent=" ("+(doc.sceneIndex+1)+"/"+scenes.length+")";
    count.style.color="#888";
    bc.appendChild(count);
  }
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
  showMenuAt(e.clientX,e.clientY,items);
}

/**
 * A context menu at a point on screen.
 *
 * Entries are `{label, action}` for one of doAction's names, `{label,
 * onClick}` for anything else, or `{type:"sep"}`. The stage menu is all
 * actions; the Library's are callbacks, because "place this symbol" is about
 * a particular item rather than about the selection.
 */
function showMenuAt(x,y,items){
  var old=document.getElementById("ctxMenu");
  if(old)old.parentNode.removeChild(old);
  var menu=document.createElement("div");
  menu.id="ctxMenu";menu.className="ctx-menu";
  menu.style.left=x+"px";menu.style.top=y+"px";
  (items||[]).forEach(function(it){
    if(it.type==="sep"){
      var sep=document.createElement("div");sep.className="ctx-sep";
      menu.appendChild(sep);
      return;
    }
    var entry=document.createElement("div");entry.className="ctx-entry";
    entry.textContent=it.label;
    entry.addEventListener("click",function(){
      if(menu.parentNode)menu.parentNode.removeChild(menu);
      if(it.onClick)it.onClick();
      else if(it.action)doAction(it.action);
    });
    menu.appendChild(entry);
  });
  document.body.appendChild(menu);
  // Off the edge of the window is no use; pull it back on.
  var r=menu.getBoundingClientRect();
  if(r.right>window.innerWidth)menu.style.left=Math.max(0,window.innerWidth-r.width-4)+"px";
  if(r.bottom>window.innerHeight)menu.style.top=Math.max(0,window.innerHeight-r.height-4)+"px";
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
  /* Announce the command so pushUndo() can name the step after it. Restored
     afterwards rather than cleared, because a command can call another and the
     inner one must not leave the outer one anonymous. */
  var prevActionLabel=currentActionLabel;
  currentActionLabel=ACTION_LABELS[a]||null;
  try{
    return doActionInner(a);
  }finally{
    currentActionLabel=prevActionLabel;
    updateHistoryPanel();
  }
}

function doActionInner(a){
  switch(a){
  case "new":
    // Only interrupt when there is actually something to lose.
    if(!isDirty()||confirm("Create new document? Unsaved changes will be lost.")){
      doc.width=550;doc.height=400;doc.fps=24;doc.backgroundColor="#FFFFFF";
      doc.layers=[new Layer("Layer 1")];doc.library={};doc.sounds={};doc.bitmaps={};doc.totalFrames=60;
      doc.guides={v:[],h:[]};
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
  case "exportSWF":
    exportAsSWF();
    break;
  case "publishSettings":
    showPublishSettingsDialog();
    break;
  case "publish":
    publishAll();
    break;
  case "sizeReport":
    showSizeReportDialog();
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
  /* Working on one layer in a stack of fifty means looking at forty-nine
     you are not working on. Flash's answer, and now this one: solo the
     current layer, and put them all back when you are done. */
  case "hideOthers":
    soloLayer(curLayer);
    break;
  case "showAllLayers":
    showAllLayers();
    break;
  case "addLayer":
    pushUndo();
    var _cl=currentLayers();
    var _nl=new Layer(uniqueLayerName("Layer "+(_cl.length+1)));
    /* A new layer joins the folder you are in. Adding one while working inside
       a folder and having it land outside is the kind of small wrongness that
       makes folders not worth using. */
    var _host=_cl[curLayer];
    if(_host)_nl.indent=isFolderLayer(_host)?(_host.indent||0)+1:(_host.indent||0);
    _cl.splice(curLayer,0,_nl);
    fullRefresh();
    break;
  case "addFolder":
    pushUndo();
    var _fl=currentLayers();
    var _folder=new Layer(uniqueLayerName("Folder"));
    _folder.layerType="folder";
    _folder.folderOpen=true;
    // A folder has no artwork, so it has no keyframes to speak of; one empty
    // one keeps every "what is on this layer at this frame" path happy.
    _folder.keyframes=[new KeyFrame(1)];
    var _at=Math.max(0,Math.min(curLayer,_fl.length));
    var _base=_fl[_at]?(_fl[_at].indent||0):0;
    _folder.indent=_base;
    _fl.splice(_at,0,_folder);
    /* Fold the layer that was selected into the new folder. Creating an empty
       folder and then dragging things into it is two more steps than anybody
       does; folding the current layer in is what the gesture means. */
    var _child=_fl[_at+1];
    if(_child&&!isFolderLayer(_child))_child.indent=_base+1;
    curLayer=_at;
    fullRefresh();
    break;
  case "addSceneAction":
    pushUndo();addScene({});
    break;
  case "duplicateScene":
    pushUndo();addScene({duplicate:true});
    break;
  case "nextScene":
  case "prevScene":
    var _sn=doc.sceneIndex+(a==="nextScene"?1:-1);
    if(!gotoScene(_sn)){
      showMessage("Scene",a==="nextScene"
        ?"This is the last scene." : "This is the first scene.");
    }
    break;
  case "renameScene":
    var _cs=currentScene();
    askFor("Rename Scene","Name",_cs.name,function(nn){
      if(!nn)return;
      pushUndo();
      _cs.name=nn;
      updateBreadcrumb();fullRefresh();
    });
    break;
  case "deleteSceneAction":
    if(docScenes().length<2){
      showMessage("Delete Scene","A movie needs at least one scene.");break;
    }
    var _dsName=currentScene().name;
    var _dsIdx=doc.sceneIndex;
    showDialog({
      title:"Delete Scene",
      message:"Delete \""+_dsName+"\" and everything on its timeline?",
      onOk:function(){pushUndo();deleteScene(_dsIdx);}
    });
    break;
  case "foldersCollapseAll":
  case "foldersExpandAll":
    var _open=a==="foldersExpandAll";
    var _any=false;
    currentLayers().forEach(function(l){
      if(isFolderLayer(l)){l.folderOpen=_open;_any=true;}
    });
    if(_any)fullRefresh();
    else showMessage("Layer Folders","There are no folders in this timeline yet. "+
      "Insert ▸ Layer Folder puts the current layer into one.");
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
  case "bringForward":
    if(arrangeSelection("forward"))fullRefresh();
    break;
  case "sendBackward":
    if(arrangeSelection("backward"))fullRefresh();
    break;
  case "group":
    if(groupSelection())fullRefresh();
    else showMessage("Group","Select two or more shapes on an unlocked layer to group them.");
    break;
  case "ungroup":
    if(ungroupSelection())fullRefresh();
    else showMessage("Ungroup","Select a group first. (Modify ▸ Break Apart also takes a symbol instance or a text block apart.)");
    break;
  case "breakApart":
    var ba=breakApartSelection();
    if(ba.done)fullRefresh();
    else if(ba.skipped)showMessage("Break Apart",
      "Nothing here can be broken apart.\n\nBreak Apart works on a group, a "+
      "symbol instance, or a text block. A bitmap has no shape to break into — "+
      "use Modify ▸ Trace Bitmap to turn one into vectors.");
    else showMessage("Break Apart","Select a group, a symbol instance or a text block first.");
    break;
  case "flipH": if(transformSelection("flipH"))fullRefresh(); break;
  case "flipV": if(transformSelection("flipV"))fullRefresh(); break;
  case "rot90cw": if(transformSelection("rot90cw"))fullRefresh(); break;
  case "rot90ccw": if(transformSelection("rot90ccw"))fullRefresh(); break;
  case "transformReset": if(transformSelection("reset"))fullRefresh(); break;
  case "scaleRotate":
    if(!selection.length){showMessage("Scale and Rotate","Select something first.");break;}
    showDialog({
      title:"Scale and Rotate",
      fields:[
        {name:"scale",label:"Scale (%)",type:"number",value:100,min:1,max:2000},
        {name:"rotate",label:"Rotate (°)",type:"number",value:0,min:-360,max:360}
      ],
      onOk:function(v){
        transformSelection("scaleRotate",{
          scale:parseFloat(v.scale)||100,
          rotate:parseFloat(v.rotate)||0
        });
        fullRefresh();
      }
    });
    break;
  case "alignLeft": case "alignHCenter": case "alignRight":
  case "alignTop": case "alignVCenter": case "alignBottom":
  case "alignMatchW": case "alignMatchH": case "alignMatchWH":
  case "alignDistH": case "alignDistV": case "alignSpaceH": case "alignSpaceV":
    var amode={alignLeft:"left",alignHCenter:"hcenter",alignRight:"right",
      alignTop:"top",alignVCenter:"vcenter",alignBottom:"bottom",
      alignMatchW:"matchW",alignMatchH:"matchH",alignMatchWH:"matchWH",
      alignDistH:"distH",alignDistV:"distV",alignSpaceH:"spaceH",alignSpaceV:"spaceV"}[a];
    if(alignSelection(amode))fullRefresh();
    else showMessage("Align",alignToStage
      ?"Select something to align to the stage."
      :"Select at least two objects — or turn on \"To Stage\" to align one object to the stage. Distribute and Space need three.");
    break;
  case "alignToStage":
    alignToStage=!alignToStage;
    updateAlignPanel();
    break;
  case "distributeToLayers":
    if(distributeToLayers())fullRefresh();
    else showMessage("Distribute to Layers","Select two or more objects first.");
    break;
  case "addShapeHint":
    var ah=addShapeHint();
    if(ah.ok)fullRefresh();
    else showMessage("Add Shape Hint",
      "Put the playhead on a shape tween first.\n\nA hint says which bit of "+
      "the start shape becomes which bit of the end shape — without one the "+
      "morph has to guess, and the wrong guess turns the shape inside out.");
    break;
  case "removeShapeHints":
    // `.ok`, not the object: removeShapeHints() returns a result record, and
    // every object is truthy — so the "no hints" case never reported itself.
    if(removeShapeHints().ok)fullRefresh();
    else showMessage("Shape Hints","This shape tween has no hints on it.");
    break;
  case "reverseFrames":
    var rv=reverseFrames({});
    if(rv.done)fullRefresh();
    else showMessage("Reverse Frames",
      "Select a span of two or more keyframes in the timeline first — drag "+
      "across the frames you want reversed.");
    break;
  case "copyMotion":
    var cm=copyMotion({});
    if(cm.ok){
      showMessage("Copy Motion",cm.frames+" frames of motion copied. "+
        "Select another object and use Paste Motion to give it the same animation.");
    }else{
      showMessage("Copy Motion","Select a span on a layer that has something "+
        "animated on it. Copy Motion takes the movement, not the artwork.");
    }
    break;
  case "pasteMotion":
    var pm=pasteMotion({});
    if(pm.ok)fullRefresh();
    else if(pm.reason==="empty")showMessage("Paste Motion","Use Copy Motion first.");
    else if(pm.reason==="nothing")showMessage("Paste Motion",
      "There is nothing on this frame to animate. Put an object on it first.");
    else showMessage("Paste Motion","This layer is locked, or it is a folder.");
    break;
  case "editMultiple":
    editMultiple=!editMultiple;
    selection=[];
    if(editMultiple&&!onionBefore&&!onionAfter){
      // The mode's span comes from the onion counts; at zero it would cover
      // one frame and look broken.
      onionBefore=2;onionAfter=2;
      updateOnionUI();
    }
    fullRefresh();
    break;
  case "onionToggle":
    onionOn=!onionOn;
    // Turning it on with both counts at zero shows nothing, which reads as a
    // broken toggle — give it the one-frame-back default.
    if(onionOn&&!onionBefore&&!onionAfter)onionBefore=1;
    updateOnionUI();render();
    break;
  case "onionOutlines":
    onionOutlines=!onionOutlines;
    if(onionOutlines)onionOn=true;
    updateOnionUI();render();
    break;
  case "rulers":
    showRulers=!showRulers;
    render();
    break;
  case "guidesShow":
    showGuides=!showGuides;
    render();
    break;
  case "guidesClear":
    if(docGuides().v.length||docGuides().h.length){
      pushUndo();doc.guides={v:[],h:[]};render();
    }
    break;
  case "snapObjects":
    snapObjects=!snapObjects;
    break;
  case "snapGuides":
    snapGuides=!snapGuides;
    break;
  /* Shape cleanup. Each reports what it did, because "nothing happened" has
     three different causes here — nothing selected, a locked layer, or a
     selection of the wrong kind of object — and they need different fixes. */
  case "shapeSmooth": case "shapeStraighten":
    var cl=shapeCleanup(a==="shapeSmooth"?"smooth":"straighten",{tolerance:2.5});
    if(cl.done)fullRefresh();
    else reportShapeResult(a==="shapeSmooth"?"Smooth":"Straighten",cl);
    break;
  case "shapeOptimize":
    if(!shapeOperands().length){
      showMessage("Optimize","Select a drawn line or shape first.");break;
    }
    showDialog({
      title:"Optimize Curves",
      message:"Fewer points means a smaller file and a smoother shape; too few loses the drawing.",
      fields:[{name:"tolerance",label:"Smoothing",type:"number",value:3,min:0.2,max:30,step:0.2}],
      onOk:function(v){
        var r=shapeCleanup("straighten",{tolerance:parseFloat(v.tolerance)||3});
        if(r.done)fullRefresh();else reportShapeResult("Optimize",r);
      }
    });
    break;
  case "linesToFills":
    var lf=convertLinesToFills();
    if(lf.done)fullRefresh();
    else showMessage("Convert Lines to Fills",
      "Select a pencil, brush or line stroke first. A shape that is already a "+
      "fill has nothing to convert.");
    break;
  case "expandFill":
    if(!shapeOperands().length){
      showMessage("Expand Fill","Select a filled shape first.");break;
    }
    showDialog({
      title:"Expand Fill",
      fields:[
        {name:"distance",label:"Distance (px)",type:"number",value:4,min:0.5,max:200,step:0.5},
        {name:"direction",label:"Direction",type:"select",value:"expand",
         options:[["expand","Expand"],["inset","Inset"]]}
      ],
      onOk:function(v){
        var d=Math.abs(parseFloat(v.distance)||4);
        var r=expandFill(v.direction==="inset"?-d:d);
        if(r.done)fullRefresh();else reportShapeResult("Expand Fill",r);
      }
    });
    break;
  case "softenEdges":
    if(!shapeOperands().length){
      showMessage("Soften Fill Edges","Select a filled shape first.");break;
    }
    showDialog({
      title:"Soften Fill Edges",
      message:"A vector halo in steps — the same trick Flash used, and it stays a vector.",
      fields:[
        {name:"distance",label:"Distance (px)",type:"number",value:8,min:1,max:200,step:1},
        {name:"steps",label:"Number of steps",type:"number",value:4,min:1,max:20,step:1},
        {name:"direction",label:"Direction",type:"select",value:"expand",
         options:[["expand","Expand"],["inset","Inset"]]}
      ],
      onOk:function(v){
        var r=softenFillEdges(Math.abs(parseFloat(v.distance)||8),
                              parseInt(v.steps,10)||4,
                              v.direction==="inset");
        if(r.done)fullRefresh();else reportShapeResult("Soften Fill Edges",r);
      }
    });
    break;
  case "combineUnion": case "combineIntersect":
  case "combinePunch": case "combineCrop":
    var cmode={combineUnion:"union",combineIntersect:"intersect",
               combinePunch:"punch",combineCrop:"crop"}[a];
    var cr=combineSelection(cmode);
    if(cr.ok&&cr.made)fullRefresh();
    else if(cr.ok)showMessage("Combine Objects",
      "The result is empty — these shapes do not "+
      (cmode==="intersect"?"overlap":"leave anything behind")+".");
    else if(cr.reason==="need2")showMessage("Combine Objects",
      "Select two or more drawn shapes.\n\nPunch and Crop use the TOPMOST shape "+
      "as the tool and discard it; Union and Intersect merge everything.");
    else if(cr.reason==="shape")showMessage("Combine Objects",
      "Combine works on drawn shapes — rectangles, ovals, traced paths and brush "+
      "strokes. A symbol, a group, a bitmap or a text block has to be broken "+
      "apart first.");
    else if(cr.reason==="locked")showMessage("Combine Objects","This layer is locked or hidden.");
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
  case "winAlign":   if(workspace())workspace().toggle("align");break;
  case "winInfo":    if(workspace())workspace().toggle("info");break;
  case "winTransform":if(workspace())workspace().toggle("transform");break;
  case "winScene":   if(workspace())workspace().toggle("scene");break;
  case "winOutput":  if(workspace())workspace().toggle("output");break;
  case "winHistory": if(workspace())workspace().toggle("history");break;
  case "winExplorer":if(workspace())workspace().toggle("explorer");break;
  case "winBehaviors":if(workspace())workspace().toggle("behaviors");break;
  case "winSwatches":if(workspace())workspace().toggle("swatches");break;
  case "components":
    showComponentsDialog();
    break;
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
  case "swapSymbol":
    showSwapSymbolDialog();
    break;
  case "libUnused":
    showUnusedItemsDialog();
    break;
  case "duplicateSymbol":
    var dsSel=libSelected();
    if(dsSel&&dsSel.kind==="symbol")showDuplicateSymbolDialog(dsSel.name);
    else showMessage("Duplicate Symbol","Select a symbol in the Library first.");
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
  case "importFlash":
    var finp=document.createElement("input");
    finp.type="file";
    finp.accept=".swf,.fla,application/x-shockwave-flash";
    finp.addEventListener("change",function(){
      if(finp.files&&finp.files[0])importFlashFile(finp.files[0]);
    });
    finp.click();
    break;
  case "importXFL":
    var xinp=document.createElement("input");
    xinp.type="file";
    // An XFL "file" is a folder of XML; webkitdirectory is the only way to
    // hand one to a web page.
    xinp.webkitdirectory=true;
    xinp.setAttribute("webkitdirectory","");
    xinp.addEventListener("change",function(){
      if(xinp.files&&xinp.files.length)importXFLDirectory(xinp.files);
    });
    xinp.click();
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
/* ------------------------------------------------------------------ *
 * Group, Ungroup, Break Apart
 *
 * Flash drew a sharp line between a GROUP and a SYMBOL, and the line is worth
 * keeping: a group is artwork you want to handle as one piece *here*, a symbol
 * is artwork you want to reuse *everywhere*. Converting a one-off arrangement
 * of shapes to a symbol just to drag it around fills the library with entries
 * that mean nothing and will never be reused twice.
 *
 * A group is an EditorObject of type "group" carrying `children` in group-local
 * coordinates and `groupW`/`groupH` (the box they were authored in), so
 * resizing the group scales its contents instead of tearing them apart.
 * ------------------------------------------------------------------ */

/** The composite transform a group applies to its children, as plain scalars. */
function groupTransform(o,contentScaled){
  var gw=o.groupW||Math.abs(o.width)||1,gh=o.groupH||Math.abs(o.height)||1;
  // A symbol instance does NOT scale its contents to its box (the box follows
  // the content), so Break Apart passes contentScaled=false for one.
  var ks=contentScaled===false?1:(gw?Math.abs(o.width||gw)/gw:1);
  var kt=contentScaled===false?1:(gh?Math.abs(o.height||gh)/gh:1);
  return {
    ks:ks,kt:kt,
    hw:(o.width||0)/2,hh:(o.height||0)/2,
    sx:(o.scaleX||1),sy:(o.scaleY||1),
    rot:(o.rotation||0)*Math.PI/180,
    cx:(o.x||0)+(o.width||0)/2,cy:(o.y||0)+(o.height||0)/2
  };
}

/**
 * Lift one child out of its parent group (or symbol instance) into stage
 * coordinates, composing the parent's transform onto the child's own.
 *
 * Exact for the transform the painter actually applies: the painter translates
 * to a box centre, rotates, then scales, so rotations add, scales multiply,
 * and only the centre has to be pushed through the parent's matrix.
 */
function liftChild(parent,child,contentScaled){
  var t=groupTransform(parent,contentScaled);
  var c=child.clone();
  var lx=(child.x||0)+(child.width||0)/2;
  var ly=(child.y||0)+(child.height||0)/2;
  // group-content space -> parent centre space
  var px=(lx*t.ks-t.hw)*t.sx;
  var py=(ly*t.kt-t.hh)*t.sy;
  // parent centre space -> stage
  var ca=Math.cos(t.rot),sa=Math.sin(t.rot);
  var wx=t.cx+px*ca-py*sa;
  var wy=t.cy+px*sa+py*ca;
  c.rotation=(parent.rotation||0)+(child.rotation||0);
  c.scaleX=t.sx*t.ks*(child.scaleX||1);
  c.scaleY=t.sy*t.kt*(child.scaleY||1);
  c.alpha=(parent.alpha!=null?parent.alpha:1)*(child.alpha!=null?child.alpha:1);
  c.x=wx-(c.width||0)/2;
  c.y=wy-(c.height||0)/2;
  return c;
}

/** Group the selection into one object, preserving z-order. */
function groupSelection(){
  if(!selection.length)return false;
  var kf=CKF();
  if(!kf)return false;
  var l=CL();
  if(l&&(l.locked||!l.visible))return false;
  // Only objects that are actually on this keyframe can be grouped — a rig
  // part drawn through its hierarchy is not a free-standing object.
  var members=kf.objects.filter(function(o){return selection.indexOf(o)>=0;});
  if(!members.length)return false;
  if(members.some(isRigPart))return false;
  pushUndo();
  var b=getBounds(members);
  var g=new EditorObject("group");
  g.x=b.x;g.y=b.y;g.width=b.w||1;g.height=b.h||1;
  g.groupW=g.width;g.groupH=g.height;
  g.children=members.map(function(o){
    var c=o.clone();
    c.x=(o.x||0)-b.x;
    c.y=(o.y||0)-b.y;
    return c;
  });
  // Drop the originals, then put the group where the topmost of them was, so
  // grouping never changes what is in front of what.
  var topIdx=-1;
  members.forEach(function(o){
    var i=kf.objects.indexOf(o);
    if(i>topIdx)topIdx=i;
  });
  kf.objects=kf.objects.filter(function(o){return members.indexOf(o)<0;});
  var insertAt=Math.min(Math.max(0,topIdx-members.length+1),kf.objects.length);
  kf.objects.splice(insertAt,0,g);
  selection=[g];
  return true;
}

/** Explode the selected groups back into their contents. */
function ungroupSelection(){
  var kf=CKF();
  if(!kf)return 0;
  var groups=selection.filter(function(o){return o.type==="group"&&kf.objects.indexOf(o)>=0;});
  if(!groups.length)return 0;
  pushUndo();
  var freed=[];
  groups.forEach(function(g){
    var at=kf.objects.indexOf(g);
    var kids=(g.children||[]).map(function(c){return liftChild(g,c,true);});
    kf.objects.splice.apply(kf.objects,[at,1].concat(kids));
    freed=freed.concat(kids);
  });
  selection=freed;
  return groups.length;
}

/**
 * Break Apart, Flash's one command with four different meanings:
 *   group    -> its contents (same as Ungroup)
 *   symbol   -> the symbol's current frame, as free objects on the stage
 *   text     -> one text object per character
 *   bitmap   -> left alone, and said so, since there is no "fill" type to
 *               break a bitmap into here.
 * Returns a short report so the caller can tell the user what happened.
 */
function breakApartSelection(){
  var kf=CKF();
  if(!kf)return {done:0,skipped:0};
  var targets=selection.filter(function(o){return kf.objects.indexOf(o)>=0;});
  if(!targets.length)return {done:0,skipped:0};
  var done=0,skipped=0,freed=[];
  pushUndo();
  targets.forEach(function(o){
    var at=kf.objects.indexOf(o);
    if(at<0)return;
    var parts=null;
    if(o.type==="group"){
      parts=(o.children||[]).map(function(c){return liftChild(o,c,true);});
    }else if(o.type==="symbol"){
      var sym=doc.library[o.symbolName];
      if(sym){
        var frame=symbolDisplayFrame(o,sym,o._parentFrame||1,o._startFrame||1);
        parts=symbolFrameObjects(sym,frame).map(function(c){
          return liftChild(o,c,false);
        });
      }
    }else if(o.type==="text"){
      parts=textToCharacters(o);
    }
    if(!parts||!parts.length){skipped++;return;}
    kf.objects.splice.apply(kf.objects,[at,1].concat(parts));
    freed=freed.concat(parts);
    done++;
  });
  if(freed.length)selection=freed;
  return {done:done,skipped:skipped};
}

/**
 * One text object per character, laid out with the same measurements the
 * painter uses. The point of breaking text apart is animating letters
 * individually, so each piece has to land exactly where its glyph was.
 */
function textToCharacters(o){
  var size=o.fontSize||24;
  var font=(o.fontItalic?"italic ":"")+(o.fontBold?"bold ":"")+size+"px "+(o.font||"Arial");
  var meas=document.createElement("canvas").getContext("2d");
  meas.font=font;
  var lines=String(o.text==null?"":o.text).split("\n");
  var lh=(o.lineHeight||1.2)*size;
  var out=[];
  lines.forEach(function(line,li){
    var total=meas.measureText(line).width;
    // Mirror the painter's alignment: left from the box's left edge, centred
    // about its middle, right from its right edge.
    var startX=(o.x||0);
    if(o.textAlign==="center")startX=(o.x||0)+(o.width||0)/2-total/2;
    else if(o.textAlign==="right")startX=(o.x||0)+(o.width||0)-total;
    var pen=startX;
    for(var i=0;i<line.length;i++){
      var ch=line[i];
      var w=meas.measureText(ch).width;
      if(ch!==" "&&w>0){
        var c=o.clone();
        c.text=ch;
        c.textAlign="left";
        c.x=pen;
        c.y=(o.y||0)+li*lh;
        c.width=w;
        c.height=lh;
        out.push(c);
      }
      pen+=w;
    }
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Arrange
 *
 * Front and Back existed; Forward and Backward did not, and they are the two
 * you actually need — "front" is a blunt instrument when four things overlap.
 * Stepping is done in the right order (topmost first when moving up) so a
 * multiple selection keeps its internal stacking.
 * ------------------------------------------------------------------ */
function arrangeSelection(mode){
  var kf=CKF();
  if(!kf||!selection.length)return false;
  var idxs=selection.map(function(o){return kf.objects.indexOf(o);})
                    .filter(function(i){return i>=0;});
  if(!idxs.length)return false;
  pushUndo();
  if(mode==="forward"||mode==="front")idxs.sort(function(a,b){return b-a;});
  else idxs.sort(function(a,b){return a-b;});
  var objs=idxs.map(function(i){return kf.objects[i];});
  if(mode==="front"){
    objs.reverse().forEach(function(o){
      kf.objects.splice(kf.objects.indexOf(o),1);kf.objects.push(o);
    });
  }else if(mode==="back"){
    objs.reverse().forEach(function(o){
      kf.objects.splice(kf.objects.indexOf(o),1);kf.objects.unshift(o);
    });
  }else if(mode==="forward"){
    objs.forEach(function(o){
      var i=kf.objects.indexOf(o);
      if(i<kf.objects.length-1&&selection.indexOf(kf.objects[i+1])<0){
        kf.objects.splice(i,1);kf.objects.splice(i+1,0,o);
      }
    });
  }else if(mode==="backward"){
    objs.forEach(function(o){
      var i=kf.objects.indexOf(o);
      if(i>0&&selection.indexOf(kf.objects[i-1])<0){
        kf.objects.splice(i,1);kf.objects.splice(i-1,0,o);
      }
    });
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Transform commands
 *
 * All of these work on the painter's centre-origin convention, which is why
 * a flip is a negative scale and nothing has to move: the object mirrors about
 * its own middle and stays exactly where it was.
 * ------------------------------------------------------------------ */
function transformSelection(mode,arg){
  if(!selection.length)return false;
  pushUndo();
  selection.forEach(function(o){
    if(mode==="flipH")o.scaleX=-(o.scaleX||1);
    else if(mode==="flipV")o.scaleY=-(o.scaleY||1);
    else if(mode==="rot90cw")o.rotation=((o.rotation||0)+90)%360;
    else if(mode==="rot90ccw")o.rotation=((o.rotation||0)-90)%360;
    else if(mode==="rot180")o.rotation=((o.rotation||0)+180)%360;
    else if(mode==="reset"){
      o.rotation=0;o.scaleX=1;o.scaleY=1;o.skewX=0;o.skewY=0;
    }else if(mode==="scaleRotate"){
      var f=(arg&&arg.scale!=null?arg.scale:100)/100;
      o.scaleX=(o.scaleX||1)*f;
      o.scaleY=(o.scaleY||1)*f;
      o.rotation=(o.rotation||0)+(arg&&arg.rotate||0);
    }
  });
  return true;
}

/* ------------------------------------------------------------------ *
 * Align
 *
 * Flash's Align panel, including the part people forget it had: "To Stage",
 * which switches every button from "line these up with each other" to "line
 * these up with the stage". Without it, centring one object on the stage is
 * arithmetic in the Properties panel.
 * ------------------------------------------------------------------ */
var alignToStage=false;

/** The rectangle the align commands work relative to. */
function alignFrame(objs){
  if(alignToStage)return {x:0,y:0,w:doc.width,h:doc.height};
  var b=getBounds(objs);
  return {x:b.x,y:b.y,w:b.w,h:b.h};
}

function alignSelection(mode){
  var objs=selection.slice();
  // Aligning to each other needs two; aligning to the stage needs one.
  if(objs.length<(alignToStage?1:2))return false;
  var f=alignFrame(objs);
  pushUndo();
  var W=function(o){return Math.abs(o.width||0);};
  var H=function(o){return Math.abs(o.height||0);};
  if(mode==="left")objs.forEach(function(o){o.x=f.x;});
  else if(mode==="hcenter")objs.forEach(function(o){o.x=f.x+(f.w-W(o))/2;});
  else if(mode==="right")objs.forEach(function(o){o.x=f.x+f.w-W(o);});
  else if(mode==="top")objs.forEach(function(o){o.y=f.y;});
  else if(mode==="vcenter")objs.forEach(function(o){o.y=f.y+(f.h-H(o))/2;});
  else if(mode==="bottom")objs.forEach(function(o){o.y=f.y+f.h-H(o);});
  else if(mode==="matchW")objs.forEach(function(o){
    // Match size scales rather than resizing the box, so a rotated or traced
    // object keeps its proportions the way the Free Transform handles would.
    setObjWidth(o,alignToStage?f.w:maxDim(objs,"w"));
  });
  else if(mode==="matchH")objs.forEach(function(o){
    setObjHeight(o,alignToStage?f.h:maxDim(objs,"h"));
  });
  else if(mode==="matchWH")objs.forEach(function(o){
    setObjWidth(o,alignToStage?f.w:maxDim(objs,"w"));
    setObjHeight(o,alignToStage?f.h:maxDim(objs,"h"));
  });
  else if(mode==="distH"||mode==="distV"||mode==="spaceH"||mode==="spaceV"){
    return distributeSelection(mode,objs,f);
  }
  return true;
}

function maxDim(objs,which){
  var m=0;
  objs.forEach(function(o){
    var v=which==="w"?Math.abs(o.width||0):Math.abs(o.height||0);
    if(v>m)m=v;
  });
  return m;
}

/* Width and height on these objects are box dimensions, not scales, so
   "make this 120 wide" is a direct assignment — except for a group, whose
   children follow its box through groupW/groupH, and that is already handled
   by the painter. */
function setObjWidth(o,w){o.width=(o.width||0)<0?-w:w;}
function setObjHeight(o,h){o.height=(o.height||0)<0?-h:h;}

/**
 * Distribute spreads CENTRES evenly; Space spreads GAPS evenly. They are
 * different answers whenever the objects are different sizes, and Flash gave
 * you both for exactly that reason.
 */
function distributeSelection(mode,objs,f){
  var horiz=(mode==="distH"||mode==="spaceH");
  if(objs.length<3&&!alignToStage)return false;
  var sorted=objs.slice().sort(function(a,b){
    return horiz?(a.x||0)-(b.x||0):(a.y||0)-(b.y||0);
  });
  var size=function(o){return horiz?Math.abs(o.width||0):Math.abs(o.height||0);};
  var set=function(o,v){if(horiz)o.x=v;else o.y=v;};
  var lo=horiz?f.x:f.y,span=horiz?f.w:f.h;
  // No pushUndo() here: alignSelection() has already taken the snapshot, and
  // a second one would make Distribute cost two undos.
  if(mode==="distH"||mode==="distV"){
    // Centres on an even pitch between the first and last centres.
    var c0=lo+size(sorted[0])/2;
    var c1=lo+span-size(sorted[sorted.length-1])/2;
    var stepc=sorted.length>1?(c1-c0)/(sorted.length-1):0;
    sorted.forEach(function(o,i){set(o,c0+stepc*i-size(o)/2);});
  }else{
    // Equal gaps: whatever is left of the span once the objects are counted.
    var used=0;
    sorted.forEach(function(o){used+=size(o);});
    var gap=sorted.length>1?(span-used)/(sorted.length-1):0;
    var pen=lo;
    sorted.forEach(function(o){set(o,pen);pen+=size(o)+gap;});
  }
  return true;
}

/**
 * Distribute to Layers — one object per new layer, named after the object.
 *
 * This is the command that makes a pasted-in or broken-apart drawing
 * animatable: twelve letters on one layer cannot be animated separately, and
 * moving them by hand is twelve layer creations and twelve cut-and-pastes.
 */
function distributeToLayers(){
  var kf=CKF();
  if(!kf||selection.length<2)return false;
  var layers=currentLayers();
  var members=kf.objects.filter(function(o){return selection.indexOf(o)>=0;});
  if(members.length<2)return false;
  pushUndo();
  var nameFor=function(o){
    if(o.instanceName)return o.instanceName;
    if(o.type==="symbol"&&o.symbolName)return o.symbolName;
    if(o.type==="text"&&o.text)return String(o.text).slice(0,16);
    return o.type.charAt(0).toUpperCase()+o.type.slice(1);
  };
  var at=currentLayers().indexOf(CL());
  if(at<0)at=0;
  // Bottom-up, inserting each above the source layer, so the new layers end up
  // stacked in the same order the objects were.
  members.slice().reverse().forEach(function(o){
    var nl=new Layer(uniqueLayerName(nameFor(o)));
    nl.keyframes=[new KeyFrame(1)];
    // The object keeps the frame it was on: a blank span before it, then it.
    if(curFrame>1){
      nl.keyframes[0].duration=curFrame-1;
      var k=new KeyFrame(curFrame);
      k.duration=Math.max(1,kf.index+kf.duration-curFrame);
      k.objects=[o];
      nl.keyframes.push(k);
    }else{
      nl.keyframes[0].duration=Math.max(1,kf.duration);
      nl.keyframes[0].objects=[o];
    }
    layers.splice(at,0,nl);
  });
  kf.objects=kf.objects.filter(function(o){return members.indexOf(o)<0;});
  selection=[];
  curLayer=Math.min(at,layers.length-1);
  return true;
}

/**
 * Say why a shape command did nothing.
 *
 * "Nothing happened" has three causes here and they need different fixes, so
 * guessing wrong wastes the user's time twice.
 */
function reportShapeResult(title,r){
  if(r.locked){
    showMessage(title,"This layer is locked or hidden, so nothing on it can be changed.");
  }else if(r.skipped){
    showMessage(title,
      "Nothing here can be reshaped.\n\nThis works on drawn lines and shapes — "+
      "pencil and brush strokes, traced paths, and pen curves. A rectangle, "+
      "oval, symbol, bitmap or text block has to be broken apart first.");
  }else{
    showMessage(title,"Select a drawn line or shape first.");
  }
}

/** A layer name not already taken in this edit context. */
function uniqueLayerName(base){
  var names={};
  currentLayers().forEach(function(l){names[l.name]=true;});
  if(!names[base])return base;
  for(var i=2;i<500;i++)if(!names[base+" "+i])return base+" "+i;
  return base+" "+Date.now();
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

/* ------------------------------------------------------------------ *
 * Sound effects and the envelope editor
 *
 * There was no sound editing at all. A sound could be imported, attached to a
 * keyframe and given a volume, and that was the whole of it: no fade in, no
 * fade out, no pan, no repeat count — and `sync: "stop"`, which is how you
 * silence a music track, was stored in the file and honoured by nothing.
 *
 * The envelope is the general case and the presets are shorthand for it, which
 * is how Flash's Edit Envelope dialog worked: picking Fade In filled the curve
 * in, and dragging the curve afterwards turned the effect into Custom.
 * ------------------------------------------------------------------ */

var SOUND_EFFECTS=[
  ["none","None"],
  ["fadeIn","Fade In"],
  ["fadeOut","Fade Out"],
  ["fadeLR","Fade Left to Right"],
  ["fadeRL","Fade Right to Left"],
  ["left","Left Channel"],
  ["right","Right Channel"],
  ["custom","Custom"]
];

/** The envelope a keyframe's sound should play with, or null. */
function soundEnvelopeFor(snd){
  if(!snd)return null;
  if(snd.effect==="custom")return (snd.envelope&&snd.envelope.length)?snd.envelope:null;
  if(!window.Flashy||!Flashy.SoundTrack)return null;
  var asset=(doc.sounds||{})[snd.asset];
  return Flashy.SoundTrack.envelopeFor(snd.effect||"none",(asset&&asset.duration)||1);
}

/**
 * Apply an effect preset to a keyframe's sound.
 *
 * The preset's curve is written into `envelope` as well as recorded as
 * `effect`, so the envelope editor opens on the preset's own shape rather than
 * on a blank one — which is what makes "pick Fade In, then adjust it" work.
 */
function setSoundEffect(snd,effect){
  if(!snd)return;
  snd.effect=effect;
  if(effect==="none"){snd.envelope=null;return;}
  if(effect==="custom"){
    if(!snd.envelope||!snd.envelope.length){
      var asset=(doc.sounds||{})[snd.asset];
      var d=(asset&&asset.duration)||1;
      // A flat full-volume line is the honest starting point for a custom
      // curve: it sounds exactly like no effect until you move it.
      snd.envelope=[[0,1,1],[d,1,1]];
    }
    return;
  }
  var env=window.Flashy&&Flashy.SoundTrack
    ? Flashy.SoundTrack.envelopeFor(effect,((doc.sounds||{})[snd.asset]||{}).duration||1)
    : null;
  snd.envelope=env?env.map(function(p){return p.slice();}):null;
}

/**
 * The Edit Envelope dialog.
 *
 * Two lanes — left and right — over the sound's own waveform, with draggable
 * points. Over the waveform because an envelope is drawn against what you can
 * hear: "bring it down where he stops talking" is a shape you can only place
 * if you can see where that is.
 */
function showSoundEnvelopeDialog(){
  var kf=CKF();
  var snd=kf&&kf.sound;
  if(!snd||!snd.asset){
    showMessage("Edit Envelope",
      "Put the playhead on a keyframe that has a sound on it first.");
    return;
  }
  var asset=(doc.sounds||{})[snd.asset];
  var duration=(asset&&asset.duration)||1;
  // Editing always edits a CUSTOM envelope: a preset is a shape, and changing
  // it means you no longer have that preset.
  var working=(snd.envelope&&snd.envelope.length)
    ? snd.envelope.map(function(p){return p.slice();})
    : (soundEnvelopeFor(snd)||[[0,1,1],[duration,1,1]]).map(function(p){return p.slice();});

  var W=360,LANE=52,GAP=8,H=LANE*2+GAP;
  var cv=null,drag=null;

  var toX=function(t){return (t/duration)*W;};
  var toT=function(x){return Math.max(0,Math.min(duration,(x/W)*duration));};
  var laneY=function(lane,gain){
    var top=lane===0?0:LANE+GAP;
    return top+(1-Math.max(0,Math.min(1,gain)))*LANE;
  };
  var gainFromY=function(lane,y){
    var top=lane===0?0:LANE+GAP;
    return Math.max(0,Math.min(1,1-((y-top)/LANE)));
  };

  var draw=function(){
    if(!cv)return;
    var cx=cv.getContext("2d");
    cx.clearRect(0,0,W,H);
    [0,1].forEach(function(lane){
      var top=lane===0?0:LANE+GAP;
      cx.fillStyle="#1E1E1E";
      cx.fillRect(0,top,W,LANE);
      // The waveform, so the envelope is drawn against what you can hear.
      var peaks=window.Flashy&&Flashy.Sound&&Flashy.Sound.peaks
        ? Flashy.Sound.peaks(snd.asset,Math.floor(W/2)) : null;
      if(peaks&&peaks.length){
        cx.fillStyle="rgba(120,170,220,0.35)";
        for(var i=0;i<peaks.length;i++){
          var a=Math.max(0.02,peaks[i]);
          var h=a*(LANE/2-2);
          cx.fillRect(i*2,top+LANE/2-h,2,h*2);
        }
      }
      cx.strokeStyle="#3A3A3A";
      cx.strokeRect(0.5,top+0.5,W-1,LANE-1);
      cx.fillStyle="#777";
      cx.font="9px Tahoma,sans-serif";
      cx.textBaseline="top";
      cx.fillText(lane===0?"L":"R",3,top+2);

      cx.strokeStyle=lane===0?"#FFD24A":"#8CE08C";
      cx.lineWidth=1.5;
      cx.beginPath();
      working.forEach(function(p,i){
        var x=toX(p[0]),y=laneY(lane,lane===0?p[1]:(p[2]==null?p[1]:p[2]));
        if(i===0)cx.moveTo(x,y);else cx.lineTo(x,y);
      });
      cx.stroke();
      working.forEach(function(p){
        var x=toX(p[0]),y=laneY(lane,lane===0?p[1]:(p[2]==null?p[1]:p[2]));
        cx.beginPath();cx.arc(x,y,3.5,0,Math.PI*2);
        cx.fillStyle=lane===0?"#FFD24A":"#8CE08C";cx.fill();
        cx.strokeStyle="#111";cx.lineWidth=1;cx.stroke();
      });
    });
  };

  var nearest=function(x,y){
    var best=null,bestD=1e9;
    working.forEach(function(p,i){
      [0,1].forEach(function(lane){
        var px=toX(p[0]);
        var py=laneY(lane,lane===0?p[1]:(p[2]==null?p[1]:p[2]));
        var d=Math.hypot(px-x,py-y);
        if(d<bestD&&d<12){bestD=d;best={index:i,lane:lane};}
      });
    });
    return best;
  };

  showDialog({
    title:"Edit Envelope — "+snd.asset,
    message:"Drag a point to change the level; click an empty part of a lane to "+
            "add one. The left and right lanes are what make a pan: bring one "+
            "down and the sound moves to the other side.",
    fields:[
      {name:"effect",label:"Effect",type:"select",value:snd.effect||"none",
       options:SOUND_EFFECTS,
       onChange:function(v){
         // A preset replaces the curve, so you can start from one and adjust.
         var env=window.Flashy&&Flashy.SoundTrack
           ? Flashy.SoundTrack.envelopeFor(v,duration) : null;
         working=(env||[[0,1,1],[duration,1,1]]).map(function(p){return p.slice();});
         draw();
       }}
    ],
    build:function(body){
      cv=document.createElement("canvas");
      cv.width=W;cv.height=H;
      cv.className="sound-envelope";
      cv.title="Drag a point. Click an empty part of a lane to add one; "+
               "right-click a point to remove it.";
      body.appendChild(cv);
      var hint=document.createElement("div");
      hint.className="fy-dialog-hint";
      hint.textContent="Length "+(Math.round(duration*100)/100)+"s.";
      body.appendChild(hint);

      cv.addEventListener("pointerdown",function(e){
        var r=cv.getBoundingClientRect();
        var x=e.clientX-r.left,y=e.clientY-r.top;
        var hit=nearest(x,y);
        if(hit){drag=hit;return;}
        // Add a point, in time order so the curve never doubles back.
        var t=toT(x);
        var lane=y<LANE?0:1;
        var g=gainFromY(lane,y);
        var at=0;
        while(at<working.length&&working[at][0]<t)at++;
        var prev=working[Math.max(0,at-1)]||[0,1,1];
        var p=[t,prev[1],prev[2]==null?prev[1]:prev[2]];
        if(lane===0)p[1]=g;else p[2]=g;
        working.splice(at,0,p);
        drag={index:at,lane:lane};
        draw();
      });
      cv.addEventListener("pointermove",function(e){
        if(!drag)return;
        var r=cv.getBoundingClientRect();
        var y=e.clientY-r.top;
        var p=working[drag.index];
        if(!p)return;
        var g=gainFromY(drag.lane,y);
        if(drag.lane===0)p[1]=g;else p[2]=g;
        /* Time is NOT dragged for the first and last points: an envelope that
           no longer starts at zero or reach the end leaves the sound
           unscheduled at one end, which is silence nobody asked for. */
        if(drag.index>0&&drag.index<working.length-1){
          var t=toT(e.clientX-r.left);
          var lo=working[drag.index-1][0],hi=working[drag.index+1][0];
          p[0]=Math.max(lo,Math.min(hi,t));
        }
        draw();
      });
      var end=function(){drag=null;};
      cv.addEventListener("pointerup",end);
      cv.addEventListener("pointercancel",end);
      cv.addEventListener("contextmenu",function(e){
        e.preventDefault();
        var r=cv.getBoundingClientRect();
        var hit=nearest(e.clientX-r.left,e.clientY-r.top);
        // Two points is the minimum an envelope can be and still be a line.
        if(hit&&working.length>2){working.splice(hit.index,1);draw();}
      });
      draw();
    },
    onOk:function(v){
      pushUndo();
      snd.effect=v.effect;
      /* Whatever is on screen is what is kept, and it is kept as a custom
         curve unless it is still exactly the preset — otherwise reopening the
         dialog would silently throw the edit away and redraw the preset. */
      var preset=window.Flashy&&Flashy.SoundTrack
        ? Flashy.SoundTrack.envelopeFor(v.effect,duration) : null;
      var same=preset&&JSON.stringify(preset)===JSON.stringify(working);
      if(v.effect==="none"&&!working.some(function(p){
        return p[1]<0.999||((p[2]==null?p[1]:p[2])<0.999);
      })){
        snd.envelope=null;
      }else{
        snd.envelope=working.map(function(p){return p.slice();});
        if(!same)snd.effect="custom";
      }
      fullRefresh();
    }
  });
}

/** Timeline sounds in the current edit context, as SoundTrack items. */
function soundItems(){
  var items=[];
  currentLayers().forEach(function(l,li){
    /* Hiding a layer never silenced its sound in Flash, and it does not
       here: the eye is about what you can see. */
    if(!layerShows(l))return;
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
        offset:kf.sound.offset||0,
        // The envelope the effect resolves to, so the authoring preview and
        // the export hear the same thing.
        envelope:soundEnvelopeFor(kf.sound),
        repeat:kf.sound.repeat||0
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
  // Same rotate-skew-scale order as the painter, so the eraser's geometry
  // agrees with what is on screen for a skewed shape too.
  if(o.skewX||o.skewY){
    m=matMul(m,[1,Math.tan((o.skewY||0)*Math.PI/180),
                Math.tan((o.skewX||0)*Math.PI/180),1,0,0]);
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
  if(window.Flashy&&Flashy.Primitives&&Flashy.Primitives.active(o)){
    // A rounded rectangle is erased round its real corners, not its box.
    var pp=Flashy.Primitives.path(o);
    if(pp){
      var pm=matMul(objMatrix(o),[1,0,0,1,-hw,-hh]);
      var psc=Math.max(1e-6,Math.hypot(pm[0],pm[1]),Math.hypot(pm[2],pm[3]));
      return matApplyLoops(pm,G.normalize(G.pathToLoops(pp,ERASE_FLATTEN/psc)));
    }
  }
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
/* ================================================================== *
 * Shape editing — the drawing half of Flash parity
 *
 * Everything in here exists because a drawing used to be final. You could
 * move a stroke, scale it and erase bits out of it; you could not reshape it,
 * clean it up, combine it with another one, or draw a precise curve in the
 * first place. That is the single biggest gap between this and a drawing tool
 * people would choose.
 *
 * All of it is built on the two pure geometry modules the project already had:
 * flashy-geom.js (polygon booleans, swept stroke areas) and flashy-trace.js
 * (path command streams, Douglas–Peucker, curve emission). Nothing here
 * reimplements either — a second Douglas–Peucker would drift away from the
 * tested one.
 * ================================================================== */

/** One point through a 2x3 matrix. */
function matApplyPoint(m,x,y){
  return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};
}

/* ------------------------------------------------------------------ *
 * The shape operand set
 * ------------------------------------------------------------------ */

/** Selected objects on the current keyframe, in z-order, that are artwork. */
function shapeOperands(){
  var kf=CKF();
  if(!kf)return [];
  return kf.objects.filter(function(o){
    return selection.indexOf(o)>=0&&!isRigPart(o)&&
           o.type!=="symbol"&&o.type!=="group"&&o.type!=="bitmap"&&o.type!=="text";
  });
}

/** True when the active layer will accept an edit at all. */
function layerEditable(){
  var l=CL();
  return !!l&&!l.locked&&l.visible!==false;
}

/**
 * Swap objects out of the current keyframe in place.
 *
 * `pairs` is [{from: obj, to: [objs]}]. Order is preserved, which matters:
 * every one of these commands can turn one object into several, and dropping
 * them at the end of the list would silently bring them to the front.
 */
function replaceObjects(pairs){
  var kf=CKF();
  if(!kf)return [];
  var made=[];
  pairs.forEach(function(p){
    var at=kf.objects.indexOf(p.from);
    if(at<0)return;
    kf.objects.splice.apply(kf.objects,[at,1].concat(p.to));
    made=made.concat(p.to);
  });
  return made;
}

/* ------------------------------------------------------------------ *
 * Combine Objects — Union, Intersect, Punch, Crop
 *
 * flashy-geom.js has had polygon union, intersection and difference since the
 * eraser needed difference. Flash 8's Combine Objects menu is those three
 * operations with a convention about which shape is the operand and which is
 * the tool, and that convention is the whole feature:
 *
 *   Union      everything merges into one shape
 *   Intersect  only the area every shape shares survives
 *   Punch      the TOPMOST shape is a cookie cutter: it removes its area from
 *              the ones below and is itself discarded
 *   Crop       the TOPMOST shape is a window: the ones below are clipped to it
 *              and it is itself discarded
 *
 * `kf.objects` runs back to front, so "topmost" is the last one.
 * ------------------------------------------------------------------ */
function combineSelection(mode){
  var G=window.FlashyGeom;
  if(!G)return {ok:false,reason:"geom"};
  if(!layerEditable())return {ok:false,reason:"locked"};
  var members=shapeOperands();
  if(members.length<2)return {ok:false,reason:"need2"};
  var regions=members.map(objectRegion);
  if(regions.some(function(r){return !r||!r.length;}))return {ok:false,reason:"shape"};

  pushUndo();
  var top=members[members.length-1],topReg=regions[regions.length-1];
  var kf=CKF();
  var lowest=kf.objects.length;
  members.forEach(function(o){
    var i=kf.objects.indexOf(o);
    if(i>=0&&i<lowest)lowest=i;
  });

  var made=[];
  if(mode==="union"||mode==="intersect"){
    var acc=regions[0];
    for(var i=1;i<regions.length;i++){
      acc=mode==="union"?G.union(acc,regions[i]):G.intersection(acc,regions[i]);
      if(!acc.length)break;
    }
    // The result takes the topmost shape's style, which is the one whose
    // colour you were looking at when you ran the command.
    made=acc.length?regionToPathObjects(acc,top):[];
  }else{
    for(var j=0;j<members.length-1;j++){
      var r=mode==="punch"?G.difference(regions[j],topReg)
                          :G.intersection(regions[j],topReg);
      if(!r.length)continue;
      // Each cropped or punched shape keeps its OWN style — it is still that
      // shape, with a bite taken out of it.
      made=made.concat(regionToPathObjects(r,members[j]));
    }
  }

  kf.objects=kf.objects.filter(function(o){return members.indexOf(o)<0;});
  var at=Math.min(Math.max(0,lowest),kf.objects.length);
  kf.objects.splice.apply(kf.objects,[at,0].concat(made));
  selection=made;
  return {ok:true,made:made.length};
}

/* ------------------------------------------------------------------ *
 * Shape ▸ Smooth / Straighten / Optimize
 *
 * These act on the object's OWN coordinates, not on a stage-space region, so
 * an object keeps its identity, its transform and its place in the z-order.
 * Rebuilding it as a fresh path would lose all three — and would turn a
 * two-node pencil line into a filled polygon.
 * ------------------------------------------------------------------ */

/**
 * One smoothing pass over a coordinate list.
 *
 * A plain neighbour average, which is what Flash's Smooth did: it pulls each
 * point towards the midpoint of its neighbours. Repeated passes smooth
 * further, and that is the knob worth exposing, because one pass of a strong
 * average and ten passes of a weak one look quite different — the weak one
 * keeps the shape and loses the jitter, which is the point.
 */
function smoothPoints(pts,closed,strength,passes){
  var n=pts.length/2;
  if(n<3)return pts.slice();
  var cur=pts.slice();
  var s=Math.max(0,Math.min(1,strength==null?0.5:strength));
  for(var p=0;p<(passes||1);p++){
    var out=cur.slice();
    for(var i=0;i<n;i++){
      // An open polyline's endpoints are pinned: smoothing a line's ends
      // shortens it, and a shortened line no longer meets what it met.
      if(!closed&&(i===0||i===n-1))continue;
      var a=(i-1+n)%n,b=(i+1)%n;
      var mx=(cur[a*2]+cur[b*2])/2,my=(cur[a*2+1]+cur[b*2+1])/2;
      out[i*2]=cur[i*2]+(mx-cur[i*2])*s;
      out[i*2+1]=cur[i*2+1]+(my-cur[i*2+1])*s;
    }
    cur=out;
  }
  return cur;
}

/** Re-derive a stroke object's box from its points, keeping it where it is. */
function renormalizeStroke(o){
  if(!o.points||o.points.length<2)return;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(var i=0;i<o.points.length;i+=2){
    if(o.points[i]<minX)minX=o.points[i];
    if(o.points[i]>maxX)maxX=o.points[i];
    if(o.points[i+1]<minY)minY=o.points[i+1];
    if(o.points[i+1]>maxY)maxY=o.points[i+1];
  }
  // Points are stored relative to the object's top-left, so shrinking the
  // extent has to move x/y to compensate or the stroke jumps.
  o.x=(o.x||0)+minX;
  o.y=(o.y||0)+minY;
  o.width=(maxX-minX)||1;
  o.height=(maxY-minY)||1;
  for(var j=0;j<o.points.length;j+=2){
    o.points[j]-=minX;
    o.points[j+1]-=minY;
  }
}

/** Re-derive a path object's box from its command stream. */
function renormalizePath(o){
  var T=window.FlashyTrace;
  if(!T||!o.path||!o.path.length)return;
  var b=T.pathBounds(o.path);
  if(!(b.width>0)||!(b.height>0))return;
  var psx=o.pathW?(o.width/o.pathW):1,psy=o.pathH?(o.height/o.pathH):1;
  o.path=T.pathTransform(o.path,1,1,-b.minX,-b.minY);
  // Keep the on-stage size the command stream now implies, under the same
  // scale the object was already drawn at.
  o.x=(o.x||0)+b.minX*psx;
  o.y=(o.y||0)+b.minY*psy;
  o.pathW=b.width;o.pathH=b.height;
  o.width=b.width*psx;o.height=b.height*psy;
}

/**
 * Smooth, Straighten and Optimize, over whichever of the two artwork
 * representations an object uses.
 *
 * Returns {done, skipped}: a rectangle has nothing to smooth, and saying so
 * beats appearing to work.
 */
function shapeCleanup(mode,opts){
  opts=opts||{};
  var T=window.FlashyTrace,G=window.FlashyGeom;
  if(!T||!G)return {done:0,skipped:0};
  if(!layerEditable())return {done:0,skipped:0,locked:true};
  var targets=shapeOperands();
  if(!targets.length)return {done:0,skipped:0};
  var done=0,skipped=0,pre=null;
  var tol=opts.tolerance!=null?opts.tolerance:2;
  var strength=opts.strength!=null?opts.strength:0.5;
  var passes=opts.passes!=null?opts.passes:3;

  targets.forEach(function(o){
    if(o.type==="pencil"||o.type==="brush"){
      if(!o.points||o.points.length<6){skipped++;return;}
      if(!pre)pre=snap();
      // A stroke is an open polyline — the painter walks it point to point and
      // never closes it, so it must not be smoothed as a ring.
      if(mode==="smooth"){
        o.points=smoothPoints(o.points,false,strength,passes);
      }else{
        o.points=T.douglasPeucker(o.points,tol);
      }
      renormalizeStroke(o);
      done++;
      return;
    }
    if(o.type==="path"){
      if(!o.path||!o.path.length){skipped++;return;}
      if(!pre)pre=snap();
      var loops=G.pathToLoops(o.path,0.25);
      if(!loops.length){skipped++;return;}
      var out=loops.map(function(l){
        if(mode==="smooth")return smoothPoints(l,true,strength,passes);
        return T.simplifyLoop(l,tol);
      }).filter(function(l){return l.length>=6;});
      if(!out.length){skipped++;return;}
      /* Smooth re-emits with curve fitting, so the result is actually smooth
         rather than a polygon with more vertices. Straighten and Optimize
         emit straight segments, which is the whole point of them. */
      o.path=mode==="smooth"
        ? T.loopsToCurvyPath(out,60,1)
        : G.loopsToPath(out);
      renormalizePath(o);
      done++;
      return;
    }
    skipped++;
  });
  if(pre)pushUndoSnap(pre);
  return {done:done,skipped:skipped};
}

/* ------------------------------------------------------------------ *
 * Shape ▸ Convert Lines to Fills
 *
 * A stroke becomes the filled area it covered. That is what makes a line
 * scalable without its width changing, erasable with the eraser's own
 * geometry, and fillable with the paint bucket — three things a stroke is not.
 * ------------------------------------------------------------------ */
function convertLinesToFills(){
  var G=window.FlashyGeom;
  if(!G)return {done:0,skipped:0};
  if(!layerEditable())return {done:0,skipped:0,locked:true};
  var targets=shapeOperands().filter(function(o){
    return o.type==="pencil"||o.type==="brush"||o.type==="line";
  });
  if(!targets.length)return {done:0,skipped:0};
  pushUndo();
  var pairs=[],done=0;
  targets.forEach(function(o){
    var line=objectPolyline(o);
    if(!line||line.length<4)return;
    // A brush is already drawn three times its stroke width; the swept area
    // has to match what was on screen, not what the number says.
    var w=o.type==="brush"?(o.strokeWidth||1)*3:(o.strokeWidth||1);
    var region=G.strokeRegion(line,Math.max(0.25,w/2),false);
    if(!region.length)return;
    var made=regionToPathObjects(region,o);
    if(!made.length)return;
    // The fill takes the colour the line was drawn in, whichever field it
    // lived in: a pencil's is strokeColor, a brush's is fillColor.
    var colour=o.type==="brush"?o.fillColor:o.strokeColor;
    made.forEach(function(m){
      m.fillType="solid";
      m.fillColor=colour;
      m.fillAlpha=o.type==="brush"?(o.fillAlpha!=null?o.fillAlpha:1)
                                  :(o.strokeAlpha!=null?o.strokeAlpha:1);
      m.strokeStyle="none";m.strokeWidth=0;
    });
    pairs.push({from:o,to:made});
    done++;
  });
  var made2=replaceObjects(pairs);
  if(made2.length)selection=made2;
  return {done:done,skipped:targets.length-done};
}

/* ------------------------------------------------------------------ *
 * Shape ▸ Expand Fill / Soften Fill Edges
 *
 * Expand grows or shrinks a filled shape by a distance. Soften does the same
 * thing in steps and fades each ring out, which is how Flash faked a blurred
 * edge on a vector shape — and unlike a real blur it stays a vector.
 * ------------------------------------------------------------------ */

/** A region grown (or shrunk, for a negative distance) by `dist`. */
function offsetRegion(region,dist){
  var G=window.FlashyGeom;
  if(!G||!region.length||!dist)return region;
  // The band around the outline, as the swept area of every loop walked as a
  // closed polyline. Union it on to grow; subtract it to shrink.
  var band=[];
  region.forEach(function(loop){
    if(loop.length<6)return;
    var closed=loop.concat([loop[0],loop[1]]);
    var s=G.strokeRegion(closed,Math.abs(dist),false);
    band=band.length?G.union(band,s):s;
  });
  if(!band.length)return region;
  return dist>0?G.union(region,band):G.difference(region,band);
}

function expandFill(dist){
  var G=window.FlashyGeom;
  if(!G)return {done:0,skipped:0};
  if(!layerEditable())return {done:0,skipped:0,locked:true};
  var targets=shapeOperands();
  if(!targets.length)return {done:0,skipped:0};
  pushUndo();
  var pairs=[],done=0;
  targets.forEach(function(o){
    var reg=objectRegion(o);
    if(!reg||!reg.length)return;
    var out=offsetRegion(reg,dist);
    if(!out.length)return;
    var made=regionToPathObjects(out,o);
    if(!made.length)return;
    pairs.push({from:o,to:made});
    done++;
  });
  var made2=replaceObjects(pairs);
  if(made2.length)selection=made2;
  return {done:done,skipped:targets.length-done};
}

function softenFillEdges(dist,steps,inward){
  var G=window.FlashyGeom;
  if(!G)return {done:0,skipped:0};
  if(!layerEditable())return {done:0,skipped:0,locked:true};
  var targets=shapeOperands();
  if(!targets.length)return {done:0,skipped:0};
  steps=Math.max(1,Math.min(20,steps|0||4));
  pushUndo();
  var pairs=[],done=0;
  targets.forEach(function(o){
    var reg=objectRegion(o);
    if(!reg||!reg.length)return;
    var layersOut=[];
    var prev=reg;
    for(var i=1;i<=steps;i++){
      var d=(inward?-1:1)*dist*i/steps;
      var grown=offsetRegion(reg,d);
      if(!grown.length)continue;
      // The ring between this step and the last, so the bands do not stack
      // their alphas into a hard edge.
      var ring=inward?G.difference(prev,grown):G.difference(grown,prev);
      prev=grown;
      if(!ring.length)continue;
      var a=1-i/(steps+1);
      regionToPathObjects(ring,o).forEach(function(p){
        p.fillAlpha=(o.fillAlpha!=null?o.fillAlpha:1)*a;
        p.strokeStyle="none";p.strokeWidth=0;
        layersOut.push(p);
      });
    }
    // The core, drawn on top of its own halo.
    var core=inward?prev:reg;
    var coreObjs=regionToPathObjects(core,o);
    coreObjs.forEach(function(p){p.strokeStyle="none";p.strokeWidth=0;});
    if(!layersOut.length&&!coreObjs.length)return;
    pairs.push({from:o,to:layersOut.concat(coreObjs)});
    done++;
  });
  var made=replaceObjects(pairs);
  if(made.length)selection=made;
  return {done:done,skipped:targets.length-done};
}

/* ------------------------------------------------------------------ *
 * PolyStar
 *
 * Emitted as a `path` object rather than a new primitive type, which means it
 * inherits everything a traced path already has: gradient fills, resizing
 * through pathW/pathH, the eraser's geometry, and all four export paths. A
 * fifth primitive would have needed a branch in each of them.
 * ------------------------------------------------------------------ */
function polyStarLoop(cx,cy,rx,ry,sides,shape,point){
  sides=Math.max(3,Math.min(64,sides|0||5));
  var pts=[];
  // Start at the top, so a polygon sits the way one is drawn by hand.
  var base=-Math.PI/2;
  if(shape==="star"){
    var inner=Math.max(0.02,Math.min(0.98,point==null?0.5:point));
    for(var i=0;i<sides*2;i++){
      var a=base+i*Math.PI/sides;
      var r=(i%2===0)?1:inner;
      pts.push(cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r);
    }
  }else{
    for(var j=0;j<sides;j++){
      var b=base+j*2*Math.PI/sides;
      pts.push(cx+Math.cos(b)*rx,cy+Math.sin(b)*ry);
    }
  }
  return pts;
}

/** A finished PolyStar object for a drag from (x1,y1) to (x2,y2). */
function makePolyStar(x1,y1,x2,y2){
  var G=window.FlashyGeom;
  if(!G)return null;
  var x0=Math.min(x1,x2),y0=Math.min(y1,y2);
  var w=Math.abs(x2-x1),h=Math.abs(y2-y1);
  if(w<1||h<1)return null;
  // Built in a 0,0-origin box so the path stream needs no shifting afterwards.
  var loop=polyStarLoop(w/2,h/2,w/2,h/2,polyStar.sides,polyStar.shape,polyStar.point);
  var o=new EditorObject("path");
  o.path=G.loopsToPath([loop]);
  o.pathW=w;o.pathH=h;
  o.x=x0;o.y=y0;o.width=w;o.height=h;
  o.fillColor=fillColor;o.fillAlpha=fillAlpha;o.fillType="solid";
  o.strokeColor=strokeColor;o.strokeAlpha=strokeAlpha;o.strokeWidth=strokeWidth;
  o.strokeStyle=strokeWidth>0?"solid":"none";
  return o;
}

/* ------------------------------------------------------------------ *
 * Lasso
 *
 * Marquee selection cannot reach a shape that overlaps another one, and that
 * is most of a drawing. The lasso selects by what its outline encloses:
 * freeform, corner-to-corner polygon, or — the magic wand — everything the
 * same colour as what you clicked.
 * ------------------------------------------------------------------ */
var lassoPts=null;       // flat [x,y,…] while drawing
var lassoPending=false;  // polygon mode: a path is open between clicks

/** Select every object on the active layer the lasso outline encloses. */
function lassoSelect(pts){
  var G=window.FlashyGeom;
  var kf=CKF();
  if(!kf||!pts||pts.length<6)return 0;
  var region=G?G.normalize([pts.slice()]):null;
  selection=kf.objects.filter(function(o){
    if(isRigPart(o))return false;
    // Centre-inside is the test Flash's lasso effectively used: enclose a
    // shape's middle and you have selected it, without needing to trace it
    // exactly. Falls back to the bounding box when the geometry is missing.
    var cx=(o.x||0)+(o.width||0)/2,cy=(o.y||0)+(o.height||0)/2;
    if(region)return G.contains(region,cx,cy);
    return false;
  });
  return selection.length;
}

/** The lasso outline as it is being drawn. */
function drawLassoOverlay(cx){
  if(!lassoPts||lassoPts.length<4)return;
  cx.save();
  cx.lineWidth=1/zoom;
  cx.setLineDash([4/zoom,3/zoom]);
  cx.strokeStyle="rgba(0,120,255,0.95)";
  cx.beginPath();
  cx.moveTo(lassoPts[0],lassoPts[1]);
  for(var i=2;i<lassoPts.length;i+=2)cx.lineTo(lassoPts[i],lassoPts[i+1]);
  // Polygon mode rubber-bands the segment to the pointer, so you can see the
  // corner you are about to place before you click it.
  if(lassoPending&&stageHover)cx.lineTo(stageHover.x,stageHover.y);
  cx.stroke();
  // The closing segment, faint: the lasso always encloses, even mid-draw.
  cx.strokeStyle="rgba(0,120,255,0.35)";
  cx.beginPath();
  var lastX=lassoPending&&stageHover?stageHover.x:lassoPts[lassoPts.length-2];
  var lastY=lassoPending&&stageHover?stageHover.y:lassoPts[lassoPts.length-1];
  cx.moveTo(lastX,lastY);
  cx.lineTo(lassoPts[0],lassoPts[1]);
  cx.stroke();
  cx.setLineDash([]);
  cx.restore();
}

/** Magic wand: everything on the layer sharing the clicked shape's fill. */
function magicWandSelect(x,y){
  var kf=CKF();
  if(!kf)return 0;
  var hit=hitTest(x,y);
  if(!hit)return 0;
  var want=(hit.fillColor||"").toUpperCase();
  var type=hit.fillType||"solid";
  selection=kf.objects.filter(function(o){
    if(isRigPart(o)||o.type==="symbol"||o.type==="bitmap")return false;
    return (o.fillColor||"").toUpperCase()===want&&(o.fillType||"solid")===type;
  });
  return selection.length;
}

/* ------------------------------------------------------------------ *
 * Ink Bottle
 *
 * Click a shape and its stroke takes the current stroke settings. It is the
 * paint bucket's other half, and without it restyling an outline means
 * selecting the shape and retyping three numbers in the Properties panel.
 * ------------------------------------------------------------------ */
function inkBottleApply(o){
  if(!o)return false;
  pushUndo();
  o.strokeColor=strokeColor;
  o.strokeAlpha=strokeAlpha;
  o.strokeWidth=strokeWidth;
  o.strokeStyle=strokeWidth>0?(o.strokeStyle&&o.strokeStyle!=="none"?o.strokeStyle:"solid"):"none";
  // A brush stroke's colour lives in fillColor because it is painted as a
  // stroke; the ink bottle has to write where the painter reads.
  if(o.type==="brush")o.fillColor=strokeColor;
  return true;
}

/* ------------------------------------------------------------------ *
 * Subselection — the anchor points of a drawing
 *
 * Every drawn stroke used to be final. objectNodes() exposes an object's own
 * coordinates as draggable stage-space points, and setObjectNode() writes one
 * back through the inverse of the same matrix the painter uses, so a node
 * lands exactly under the pointer at any zoom, rotation or scale.
 *
 * Two representations, one interface:
 *   pencil / brush   a flat `points` list in top-left box space
 *   path             a command stream — every on-curve endpoint is an anchor,
 *                    every quadratic control point is a handle
 * ------------------------------------------------------------------ */

/** Which matrix maps an object's own artwork coordinates to the stage. */
function artworkMatrix(o){
  if(o.type==="path")return pathMatrix(o);
  return boxMatrix(o);
}

/**
 * An object's editable points, in stage coordinates.
 * Each is {x, y, i, kind} where `i` indexes into the object's own storage and
 * `kind` is "anchor" (on the curve) or "control" (a quadratic's handle).
 */
function objectNodes(o){
  var out=[];
  if(!o)return out;
  var m=artworkMatrix(o);
  if((o.type==="pencil"||o.type==="brush")&&o.points&&o.points.length>=4){
    for(var i=0;i<o.points.length;i+=2){
      var p=matApplyPoint(m,o.points[i],o.points[i+1]);
      out.push({x:p.x,y:p.y,i:i,kind:"anchor"});
    }
    return out;
  }
  if(o.type==="path"&&o.path&&o.path.length){
    var T=window.FlashyTrace;
    if(!T)return out;
    var path=o.path;
    var k=0;
    while(k<path.length){
      var cmd=path[k];
      if(cmd===T.CMD.MOVE||cmd===T.CMD.LINE){
        var q=matApplyPoint(m,path[k+1],path[k+2]);
        out.push({x:q.x,y:q.y,i:k+1,kind:"anchor"});
        k+=3;
      }else if(cmd===T.CMD.QUAD){
        var c=matApplyPoint(m,path[k+1],path[k+2]);
        out.push({x:c.x,y:c.y,i:k+1,kind:"control"});
        var e=matApplyPoint(m,path[k+3],path[k+4]);
        out.push({x:e.x,y:e.y,i:k+3,kind:"anchor"});
        k+=5;
      }else{
        k+=1;   // CLOSE carries no coordinates
      }
    }
    return out;
  }
  return out;
}

/** Move one node to a stage point, through the inverse of its own matrix. */
function setObjectNode(o,node,sx,sy){
  var m=artworkMatrix(o);
  var inv=matInvert(m);
  if(!inv)return false;
  var l=matApplyPoint(inv,sx,sy);
  if(o.type==="path"){
    if(!o.path||node.i+1>=o.path.length)return false;
    o.path[node.i]=l.x;
    o.path[node.i+1]=l.y;
    return true;
  }
  if(!o.points||node.i+1>=o.points.length)return false;
  o.points[node.i]=l.x;
  o.points[node.i+1]=l.y;
  return true;
}

/** The node nearest a stage point, within a screen-space tolerance. */
function nodeHitTest(x,y){
  var kf=CKF();
  if(!kf)return null;
  var tol=7/zoom;
  // Search the selection first when there is one — reshaping what you already
  // picked beats grabbing whatever happens to be nearest.
  var pool=selection.length?selection:kf.objects;
  var best=null,bestD=tol*tol;
  pool.forEach(function(o){
    objectNodes(o).forEach(function(n){
      var dx=n.x-x,dy=n.y-y,d=dx*dx+dy*dy;
      if(d<=bestD){bestD=d;best={obj:o,node:n};}
    });
  });
  return best;
}

var subPoint=null;   // {obj, node} while dragging a node
var subPreSnap=null;

/** The anchor handles, drawn inside the stage transform. */
function drawSubselectOverlay(cx){
  var kf=CKF();
  if(!kf)return;
  var pool=selection.length?selection:kf.objects;
  var r=3.2/zoom;
  cx.save();
  cx.lineWidth=1/zoom;
  pool.forEach(function(o){
    var nodes=objectNodes(o);
    if(!nodes.length)return;
    // Handle tethers first, so the squares sit on top of their lines.
    cx.strokeStyle="rgba(120,200,255,0.5)";
    for(var i=1;i<nodes.length;i++){
      if(nodes[i].kind!=="control"&&nodes[i-1].kind!=="control")continue;
      cx.beginPath();
      cx.moveTo(nodes[i-1].x,nodes[i-1].y);
      cx.lineTo(nodes[i].x,nodes[i].y);
      cx.stroke();
    }
    nodes.forEach(function(n){
      cx.beginPath();
      if(n.kind==="control"){
        // Round for a curve handle, square for an on-curve anchor — the same
        // distinction Flash drew, and the only way to tell them apart.
        cx.arc(n.x,n.y,r,0,Math.PI*2);
        cx.fillStyle="rgba(120,200,255,0.9)";
      }else{
        cx.rect(n.x-r,n.y-r,r*2,r*2);
        cx.fillStyle="rgba(255,255,255,0.95)";
      }
      cx.fill();
      cx.strokeStyle="rgba(20,60,120,0.9)";
      cx.stroke();
    });
  });
  cx.restore();
}

/* ------------------------------------------------------------------ *
 * Pen
 *
 * Bézier drawing. The path command stream carries quadratics, not cubics, so
 * one drag sets one control point — which is exactly what a quadratic needs,
 * and it is what the whole rest of the pipeline already understands.
 *
 * Click for a corner, drag for a curve, click the first point (or press Enter)
 * to close, Escape to abandon.
 * ------------------------------------------------------------------ */
var penPts=null;      // [{x,y,cx,cy,curved}] in stage space
var penDrag=null;     // the point currently being dragged out

function penStart(x,y){
  if(!penPts)penPts=[];
  penPts.push({x:x,y:y,cx:x,cy:y,curved:false});
  penDrag=penPts[penPts.length-1];
}

function penDragTo(x,y){
  if(!penDrag)return;
  penDrag.cx=x;penDrag.cy=y;
  // A drag of less than a pixel or two is a click, not a curve. Without the
  // threshold every click would produce a degenerate quadratic.
  penDrag.curved=Math.hypot(x-penDrag.x,y-penDrag.y)>2/zoom;
}

/** True when a click at (x,y) lands on the path's first point. */
function penClosesAt(x,y){
  if(!penPts||penPts.length<3)return false;
  var f=penPts[0];
  return Math.hypot(x-f.x,y-f.y)<=8/zoom;
}

/**
 * Turn the pen's points into a path object and put it on the stage.
 *
 * Each point carries its own control handle, so the segment arriving at a
 * point is the quadratic through that point's handle. A point with no handle
 * gets a straight segment — which is what a click, rather than a drag, means.
 */
function penCommit(close){
  var G=window.FlashyGeom,T=window.FlashyTrace;
  var pts=penPts;
  penPts=null;penDrag=null;
  if(!pts||pts.length<2||!G||!T)return false;
  if(!layerEditable())return false;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  var note=function(x,y){
    if(x<minX)minX=x;if(x>maxX)maxX=x;
    if(y<minY)minY=y;if(y>maxY)maxY=y;
  };
  pts.forEach(function(p){note(p.x,p.y);if(p.curved)note(p.cx,p.cy);});
  var w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);
  var path=[];
  path.push(T.CMD.MOVE,pts[0].x-minX,pts[0].y-minY);
  for(var i=1;i<pts.length;i++){
    var p=pts[i];
    if(p.curved){
      path.push(T.CMD.QUAD,p.cx-minX,p.cy-minY,p.x-minX,p.y-minY);
    }else{
      path.push(T.CMD.LINE,p.x-minX,p.y-minY);
    }
  }
  if(close)path.push(T.CMD.CLOSE);

  pushUndo();
  var kf=CKF();
  if(!kf){var l=CL();if(l)kf=l.insertKeyframe(curFrame);}
  if(!kf)return false;
  var o=new EditorObject("path");
  o.path=path;
  o.pathW=w;o.pathH=h;
  o.x=minX;o.y=minY;o.width=w;o.height=h;
  // An open pen path is a line, so it must not be filled: a closed one is a
  // shape, so it is. Getting this the wrong way round makes every drawn curve
  // look like a filled blob.
  o.fillType=close?"solid":"none";
  o.fillColor=fillColor;o.fillAlpha=fillAlpha;
  o.strokeColor=strokeColor;o.strokeAlpha=strokeAlpha;
  o.strokeWidth=strokeWidth>0?strokeWidth:1;
  o.strokeStyle="solid";
  kf.objects.push(o);
  selection=[o];
  return true;
}

/** The pen's path as it is being drawn, with its handles. */
function drawPenOverlay(cx){
  /* Nothing in progress: show what a click would EDIT instead. The anchors of
     the paths on this frame, and a marker on the segment under the pointer —
     without it, add-an-anchor is a click into the dark. */
  if(!penPts||!penPts.length){
    drawSubselectOverlay(cx);
    if(stageHover){
      var sh=pathSegHit(stageHover.x,stageHover.y);
      var nh=nodeHitTest(stageHover.x,stageHover.y);
      var onAnchor=nh&&nh.obj.type==="path"&&nh.node.kind==="anchor";
      if(sh&&!onAnchor){
        var rr=4/zoom;
        cx.save();
        cx.lineWidth=1.4/zoom;
        // A plus: this click ADDS a point here.
        cx.strokeStyle="rgba(80,200,120,0.95)";
        cx.beginPath();
        cx.moveTo(sh.x-rr,sh.y);cx.lineTo(sh.x+rr,sh.y);
        cx.moveTo(sh.x,sh.y-rr);cx.lineTo(sh.x,sh.y+rr);
        cx.stroke();
        cx.restore();
      }else if(onAnchor){
        var r2=5/zoom;
        cx.save();
        cx.lineWidth=1.4/zoom;
        // A ring: this click REMOVES this point.
        cx.strokeStyle="rgba(255,140,120,0.95)";
        cx.beginPath();
        cx.arc(nh.node.x,nh.node.y,r2,0,Math.PI*2);
        cx.stroke();
        cx.restore();
      }
    }
    return;
  }
  var T=window.FlashyTrace;
  cx.save();
  cx.lineWidth=1/zoom;
  cx.strokeStyle="rgba(80,170,255,0.95)";
  cx.beginPath();
  cx.moveTo(penPts[0].x,penPts[0].y);
  for(var i=1;i<penPts.length;i++){
    var p=penPts[i];
    if(p.curved)cx.quadraticCurveTo(p.cx,p.cy,p.x,p.y);
    else cx.lineTo(p.x,p.y);
  }
  cx.stroke();
  void T;
  // The segment that would be added if you clicked where the pointer is.
  if(stageHover){
    cx.strokeStyle="rgba(80,170,255,0.4)";
    cx.setLineDash([4/zoom,3/zoom]);
    cx.beginPath();
    var last=penPts[penPts.length-1];
    cx.moveTo(last.x,last.y);
    cx.lineTo(stageHover.x,stageHover.y);
    cx.stroke();
    cx.setLineDash([]);
  }
  var r=3.2/zoom;
  penPts.forEach(function(p,idx){
    if(p.curved){
      cx.strokeStyle="rgba(120,200,255,0.6)";
      cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(p.cx,p.cy);cx.stroke();
      cx.beginPath();cx.arc(p.cx,p.cy,r,0,Math.PI*2);
      cx.fillStyle="rgba(120,200,255,0.9)";cx.fill();
    }
    cx.beginPath();
    cx.rect(p.x-r,p.y-r,r*2,r*2);
    // The first point is the one a click closes on, so it is marked.
    cx.fillStyle=idx===0?"rgba(120,255,150,0.95)":"rgba(255,255,255,0.95)";
    cx.fill();
    cx.strokeStyle="rgba(20,60,120,0.9)";
    cx.stroke();
  });
  cx.restore();
}

/* ------------------------------------------------------------------ *
 * Anchor editing
 *
 * Flash's Pen tool did three more things than draw: over a segment it added
 * an anchor, over an anchor it removed one, and with Alt held it converted a
 * corner to a curve and back. Without them a drawn path is final — the only
 * repair is to delete it and draw again, which is the opposite of what a
 * Bézier tool is for.
 *
 * Everything here works on the command stream in the object's own local
 * coordinates, so an edited path keeps whatever transform it already had.
 * ------------------------------------------------------------------ */

/**
 * A path's segments, each with both endpoints resolved.
 *
 * `at` is the command's index in the stream, which is what the editing
 * functions splice against. A CLOSE segment carries the implicit line back to
 * the loop's start, because that line is clickable and a user who clicks it
 * expects an anchor there.
 */
function pathSegments(path){
  var T=window.FlashyTrace;
  if(!path||!path.length||!T)return [];
  var out=[],k=0,cx=0,cy=0,sx=0,sy=0;
  while(k<path.length){
    var cmd=path[k];
    if(cmd===T.CMD.MOVE){
      cx=sx=path[k+1];cy=sy=path[k+2];
      out.push({at:k,op:cmd,x0:cx,y0:cy,x1:cx,y1:cy});
      k+=3;
    }else if(cmd===T.CMD.LINE){
      out.push({at:k,op:cmd,x0:cx,y0:cy,x1:path[k+1],y1:path[k+2]});
      cx=path[k+1];cy=path[k+2];
      k+=3;
    }else if(cmd===T.CMD.QUAD){
      out.push({at:k,op:cmd,x0:cx,y0:cy,cx:path[k+1],cy:path[k+2],
                x1:path[k+3],y1:path[k+4]});
      cx=path[k+3];cy=path[k+4];
      k+=5;
    }else{
      out.push({at:k,op:cmd,x0:cx,y0:cy,x1:sx,y1:sy});
      cx=sx;cy=sy;
      k+=1;
    }
  }
  return out;
}

/** The point on one segment nearest (x,y), sampled rather than solved. */
function nearestOnSegment(seg,x,y){
  var T=window.FlashyTrace;
  var at=function(t){
    if(seg.op===T.CMD.QUAD){
      var u=1-t;
      return {x:u*u*seg.x0+2*u*t*seg.cx+t*t*seg.x1,
              y:u*u*seg.y0+2*u*t*seg.cy+t*t*seg.y1};
    }
    return {x:seg.x0+(seg.x1-seg.x0)*t,y:seg.y0+(seg.y1-seg.y0)*t};
  };
  /* A straight segment has a closed form; a quadratic's nearest point is a
     cubic root, and 24 samples plus a local refinement lands well inside the
     click tolerance for a fraction of the code. */
  if(seg.op!==T.CMD.QUAD){
    var dx=seg.x1-seg.x0,dy=seg.y1-seg.y0;
    var len2=dx*dx+dy*dy;
    var t0=len2?Math.max(0,Math.min(1,((x-seg.x0)*dx+(y-seg.y0)*dy)/len2)):0;
    var q=at(t0);
    return {t:t0,x:q.x,y:q.y,d2:(q.x-x)*(q.x-x)+(q.y-y)*(q.y-y)};
  }
  var best=null;
  for(var i=0;i<=24;i++){
    var t=i/24,pt=at(t);
    var d2=(pt.x-x)*(pt.x-x)+(pt.y-y)*(pt.y-y);
    if(!best||d2<best.d2)best={t:t,x:pt.x,y:pt.y,d2:d2};
  }
  var step=1/24;
  for(var r=0;r<3;r++){
    step/=3;
    [best.t-step,best.t+step].forEach(function(tt){
      if(tt<0||tt>1)return;
      var pt2=at(tt);
      var dd=(pt2.x-x)*(pt2.x-x)+(pt2.y-y)*(pt2.y-y);
      if(dd<best.d2)best={t:tt,x:pt2.x,y:pt2.y,d2:dd};
    });
  }
  return best;
}

/**
 * The path segment nearest a stage point, within a screen-space tolerance.
 *
 * Returns the hit in LOCAL coordinates plus the stage point it maps to, so the
 * caller can both edit the stream and mark where the click landed.
 */
function pathSegHit(x,y,tol){
  var kf=CKF();
  if(!kf)return null;
  tol=(tol||7)/zoom;
  var isPath=function(o){return o.type==="path"&&o.path&&o.path.length;};
  var pool=selection.length?selection.filter(isPath):kf.objects.filter(isPath);
  var best=null;
  pool.forEach(function(o){
    var m=artworkMatrix(o),inv=matInvert(m);
    if(!inv)return;
    var l=matApplyPoint(inv,x,y);
    pathSegments(o.path).forEach(function(seg){
      // A MOVE has no length, so there is nothing to click on.
      if(seg.op===window.FlashyTrace.CMD.MOVE)return;
      var n=nearestOnSegment(seg,l.x,l.y);
      var sp=matApplyPoint(m,n.x,n.y);
      var d2=(sp.x-x)*(sp.x-x)+(sp.y-y)*(sp.y-y);
      if(d2<=tol*tol&&(!best||d2<best.d2)){
        best={obj:o,seg:seg,t:n.t,lx:n.x,ly:n.y,x:sp.x,y:sp.y,d2:d2};
      }
    });
  });
  return best;
}

/**
 * Split a segment at `t`, putting a new anchor exactly on the existing curve.
 *
 * A line splits at the obvious point; a quadratic splits by de Casteljau into
 * two quadratics that trace the same curve. The shape must not change — the
 * point of adding an anchor is to get somewhere to pull from, not to nudge the
 * outline while you do it.
 */
function pathInsertAnchor(o,at,t){
  var T=window.FlashyTrace;
  if(!o||o.type!=="path"||!o.path||!T)return false;
  var seg=null;
  pathSegments(o.path).forEach(function(sg){if(sg.at===at)seg=sg;});
  if(!seg)return false;
  t=Math.max(0.02,Math.min(0.98,t==null?0.5:t));
  if(seg.op===T.CMD.LINE||seg.op===T.CMD.CLOSE){
    /* The closing line is implicit, so the new anchor goes in just BEFORE the
       CLOSE — which leaves the loop closed and one point longer. A plain line
       splices the same way, at its own command. */
    var mx=seg.x0+(seg.x1-seg.x0)*t,my=seg.y0+(seg.y1-seg.y0)*t;
    o.path.splice(seg.at,0,T.CMD.LINE,mx,my);
    return true;
  }
  if(seg.op===T.CMD.QUAD){
    var ax=seg.x0+(seg.cx-seg.x0)*t,ay=seg.y0+(seg.cy-seg.y0)*t;
    var bx=seg.cx+(seg.x1-seg.cx)*t,by=seg.cy+(seg.y1-seg.cy)*t;
    var px=ax+(bx-ax)*t,py=ay+(by-ay)*t;
    o.path.splice(seg.at,5,T.CMD.QUAD,ax,ay,px,py,T.CMD.QUAD,bx,by,seg.x1,seg.y1);
    return true;
  }
  return false;
}

/** The command that ENDS at the anchor whose coordinate index is `i`. */
function pathCommandAtNode(path,i){
  var T=window.FlashyTrace;
  var found=null;
  pathSegments(path).forEach(function(sg){
    var coord=sg.op===T.CMD.QUAD?sg.at+3:sg.at+1;
    if(coord===i)found=sg;
  });
  return found;
}

/** How many anchors the loop containing command `at` has. */
function pathLoopAnchorCount(path,at){
  var T=window.FlashyTrace;
  var segs=pathSegments(path);
  var start=0;
  for(var i=0;i<segs.length;i++){
    if(segs[i].op===T.CMD.MOVE&&segs[i].at<=at)start=i;
  }
  var n=0;
  for(var j=start;j<segs.length;j++){
    if(j>start&&segs[j].op===T.CMD.MOVE)break;
    if(segs[j].op!==T.CMD.CLOSE)n++;
  }
  return n;
}

/**
 * Remove an anchor, joining its neighbours.
 *
 * Refuses below three anchors in a loop, because two is a line and one is
 * nothing — deleting into that leaves an object on the stage that cannot be
 * seen or clicked, which is worse than refusing.
 */
function pathDeleteAnchor(o,i){
  var T=window.FlashyTrace;
  if(!o||o.type!=="path"||!o.path||!T)return {ok:false,why:"it is not a path"};
  var seg=pathCommandAtNode(o.path,i);
  if(!seg)return {ok:false,why:"there is no anchor there"};
  if(pathLoopAnchorCount(o.path,seg.at)<=2)
    return {ok:false,why:"a path needs at least two points"};
  if(seg.op===T.CMD.MOVE){
    /* The loop's first point. The segment after it becomes the new start, so
       its endpoint is promoted to the MOVE and its curve handle, which no
       longer has anything to curve away from, is dropped. */
    var segs=pathSegments(o.path);
    var next=null;
    for(var k=0;k<segs.length;k++)if(segs[k].at===seg.at)next=segs[k+1]||null;
    if(!next||next.op===T.CMD.CLOSE)return {ok:false,why:"nothing follows it"};
    var span=next.op===T.CMD.QUAD?5:3;
    o.path.splice(seg.at,3+span,T.CMD.MOVE,next.x1,next.y1);
    return {ok:true};
  }
  o.path.splice(seg.at,seg.op===T.CMD.QUAD?5:3);
  return {ok:true};
}

/**
 * Toggle an anchor between a corner and a smooth curve.
 *
 * Smoothing points the tangent along the line between the anchor's two
 * neighbours, which is what makes the join read as smooth rather than merely
 * curved. The segments are quadratics, so each carries one handle, and the two
 * handles go on opposite sides of the anchor.
 */
function pathConvertAnchor(o,i){
  var T=window.FlashyTrace;
  if(!o||o.type!=="path"||!o.path||!T)return {ok:false,why:"it is not a path"};
  var segs=pathSegments(o.path);
  var idx=-1;
  for(var k=0;k<segs.length;k++){
    var coord=segs[k].op===T.CMD.QUAD?segs[k].at+3:segs[k].at+1;
    if(coord===i)idx=k;
  }
  if(idx<0)return {ok:false,why:"there is no anchor there"};
  var inSeg=segs[idx],outSeg=segs[idx+1]||null;
  var curved=inSeg.op===T.CMD.QUAD||(outSeg&&outSeg.op===T.CMD.QUAD);
  if(curved){
    // Straighten. Later command first, so the earlier splice keeps its index.
    if(outSeg&&outSeg.op===T.CMD.QUAD)
      o.path.splice(outSeg.at,5,T.CMD.LINE,outSeg.x1,outSeg.y1);
    if(inSeg.op===T.CMD.QUAD)
      o.path.splice(inSeg.at,5,T.CMD.LINE,inSeg.x1,inSeg.y1);
    return {ok:true,kind:"corner"};
  }
  if(inSeg.op===T.CMD.MOVE||!outSeg||outSeg.op===T.CMD.CLOSE)
    return {ok:false,why:"an end point has only one side to curve"};
  var px=inSeg.x0,py=inSeg.y0;       // the previous anchor
  var ax=inSeg.x1,ay=inSeg.y1;       // this anchor
  var nx=outSeg.x1,ny=outSeg.y1;     // the next anchor
  /* A quarter of the neighbour-to-neighbour span. Much larger bulges past the
     neighbours and reads as a loop rather than a smoothed corner. */
  var dx=(nx-px)*0.25,dy=(ny-py)*0.25;
  o.path.splice(outSeg.at,3,T.CMD.QUAD,ax+dx,ay+dy,nx,ny);
  o.path.splice(inSeg.at,3,T.CMD.QUAD,ax-dx,ay-dy,ax,ay);
  return {ok:true,kind:"curve"};
}

/**
 * One Pen click on an existing path: add, delete or convert.
 *
 * Returns what it did, or null when the click was not on a path at all — in
 * which case the caller starts a new path, which is the Pen's other job.
 */
function penEditAt(x,y,alt){
  var hit=nodeHitTest(x,y);
  if(hit&&hit.obj.type==="path"&&hit.node.kind==="anchor"){
    if(!layerEditable())return {action:"none"};
    pushUndo();
    var r=alt?pathConvertAnchor(hit.obj,hit.node.i)
             :pathDeleteAnchor(hit.obj,hit.node.i);
    if(!r.ok){
      // Drop the snapshot nobody used, so the history has no empty step.
      undo();
      showMessage("Pen",(alt?"That point cannot be converted: "
                            :"That point cannot be deleted: ")+r.why+".");
      return {action:"none"};
    }
    selection=[hit.obj];
    return {action:alt?"convert":"delete",kind:r.kind,obj:hit.obj};
  }
  var seg=pathSegHit(x,y);
  if(seg){
    if(!layerEditable())return {action:"none"};
    pushUndo();
    if(!pathInsertAnchor(seg.obj,seg.seg.at,seg.t)){undo();return {action:"none"};}
    selection=[seg.obj];
    return {action:"add",obj:seg.obj};
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Gradient Transform
 *
 * `fillGrad` is [x1,y1,x2,y2] in objectBoundingBox units — fractions of the
 * object's own box — which is what the canvas painter, the SVG exporter and
 * the runtime all already read. The tool drags those two points, so a linear
 * gradient's angle and length and a radial one's centre and radius become
 * direct manipulation instead of four numbers nobody can picture.
 * ------------------------------------------------------------------ */
var gradDrag=null;   // {obj, which:0|1}

/** The gradient handles of an object, in stage coordinates. */
function gradientHandles(o){
  if(!isGradient(o))return null;
  var g=(o.fillGrad&&o.fillGrad.length>=4)?o.fillGrad:[0,0,1,0];
  var m=boxMatrix(o);
  var w=Math.abs(o.width||0),h=Math.abs(o.height||0);
  return [
    matApplyPoint(m,g[0]*w,g[1]*h),
    matApplyPoint(m,g[2]*w,g[3]*h)
  ];
}

function gradientHandleHit(x,y){
  var kf=CKF();
  if(!kf)return null;
  var tol=9/zoom;
  var pool=selection.length?selection:kf.objects;
  for(var i=pool.length-1;i>=0;i--){
    var hs=gradientHandles(pool[i]);
    if(!hs)continue;
    for(var k=0;k<2;k++){
      if(Math.hypot(hs[k].x-x,hs[k].y-y)<=tol)return {obj:pool[i],which:k};
    }
  }
  return null;
}

function setGradientHandle(o,which,sx,sy){
  var inv=matInvert(boxMatrix(o));
  if(!inv)return false;
  var l=matApplyPoint(inv,sx,sy);
  var w=Math.abs(o.width||0)||1,h=Math.abs(o.height||0)||1;
  if(!o.fillGrad||o.fillGrad.length<4)o.fillGrad=[0,0,1,0];
  o.fillGrad=o.fillGrad.slice();
  o.fillGrad[which*2]=l.x/w;
  o.fillGrad[which*2+1]=l.y/h;
  return true;
}

function drawGradientOverlay(cx){
  var kf=CKF();
  if(!kf)return;
  var pool=selection.length?selection:kf.objects;
  var r=4/zoom;
  cx.save();
  cx.lineWidth=1/zoom;
  pool.forEach(function(o){
    var hs=gradientHandles(o);
    if(!hs)return;
    cx.strokeStyle="rgba(255,220,80,0.9)";
    cx.beginPath();cx.moveTo(hs[0].x,hs[0].y);cx.lineTo(hs[1].x,hs[1].y);cx.stroke();
    // Round for the start (a radial gradient's centre), square for the end.
    cx.beginPath();cx.arc(hs[0].x,hs[0].y,r,0,Math.PI*2);
    cx.fillStyle="rgba(255,255,255,0.95)";cx.fill();
    cx.strokeStyle="rgba(120,80,0,0.9)";cx.stroke();
    cx.beginPath();cx.rect(hs[1].x-r,hs[1].y-r,r*2,r*2);
    cx.fillStyle="rgba(255,220,80,0.95)";cx.fill();cx.stroke();
  });
  cx.restore();
}

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
    // The brush gets the same brackets, for the same reason.
    if(!ctrl&&curTool==="brush"&&(e.key==="["||e.key==="]")){
      e.preventDefault();
      var bstep=Math.max(1,Math.round(brushSize*0.25));
      brushSize=Math.max(1,Math.min(200,brushSize+(e.key==="]"?bstep:-bstep)));
      updateToolOptions();
      return;
    }
    /* The pen owns Enter and Escape while it has a path open: Enter finishes
       it as an open curve, Escape abandons it. Tested before the global
       Enter (play) and Escape (exit symbol) so an unfinished path does not
       start the movie playing. */
    if(curTool==="pen"&&penPts&&penPts.length){
      if(e.key==="Enter"){
        e.preventDefault();
        penCommit(penPts.length>2&&e.shiftKey);
        fullRefresh();
        return;
      }
      if(e.key==="Escape"){
        e.preventDefault();
        penPts=null;penDrag=null;
        render();
        return;
      }
    }
    // An unfinished lasso polygon gives up on Escape rather than staying on
    // screen until the tool changes.
    if(curTool==="lasso"&&lassoPts&&e.key==="Escape"){
      e.preventDefault();
      lassoPts=null;lassoPending=false;
      render();
      return;
    }
    /* Flash's object-editing accelerators. Tested before the plain Ctrl
       shortcuts below because several of them differ only by Shift, and the
       looser test would swallow them — Ctrl+Shift+Z is Remove Transform here,
       not a second Redo. */
    if(ctrl&&e.shiftKey&&(e.key==="G"||e.key==="g")){e.preventDefault();doAction("ungroup");return;}
    if(ctrl&&!e.shiftKey&&(e.key==="g"||e.key==="G")){e.preventDefault();doAction("group");return;}
    if(ctrl&&(e.key==="b"||e.key==="B")){e.preventDefault();doAction("breakApart");return;}
    if(ctrl&&e.shiftKey&&(e.key==="z"||e.key==="Z")){e.preventDefault();doAction("transformReset");return;}
    if(ctrl&&e.shiftKey&&(e.key==="d"||e.key==="D")){e.preventDefault();doAction("distributeToLayers");return;}
    if(ctrl&&e.shiftKey&&(e.key==="h"||e.key==="H")){e.preventDefault();doAction("addShapeHint");return;}
    if(ctrl&&e.altKey&&(e.key==="s"||e.key==="S")){e.preventDefault();doAction("scaleRotate");return;}
    if(ctrl&&(e.key==="k"||e.key==="K")){e.preventDefault();doAction("winAlign");return;}
    if(ctrl&&(e.key==="i"||e.key==="I")){e.preventDefault();doAction("winInfo");return;}
    if(ctrl&&(e.key==="t"||e.key==="T")){e.preventDefault();doAction("winTransform");return;}
    if(e.shiftKey&&e.key==="F2"){e.preventDefault();doAction("winScene");return;}
    if(!ctrl&&!e.shiftKey&&e.key==="F2"){e.preventDefault();doAction("winOutput");return;}
    if(ctrl&&e.key==="F10"){e.preventDefault();doAction("winHistory");return;}
    if(ctrl&&e.key==="F12"){e.preventDefault();doAction("publish");return;}
    if(ctrl&&e.key==="F9"){e.preventDefault();doAction("winSwatches");return;}
    if(ctrl&&e.key==="F7"){e.preventDefault();doAction("components");return;}
    if(e.altKey&&e.key==="F3"){e.preventDefault();doAction("winExplorer");return;}
    if(e.shiftKey&&e.key==="F3"){e.preventDefault();doAction("winBehaviors");return;}
    if(ctrl&&e.key==="PageUp"){e.preventDefault();doAction("prevScene");return;}
    if(ctrl&&e.key==="PageDown"){e.preventDefault();doAction("nextScene");return;}
    if(ctrl&&e.altKey&&e.shiftKey&&(e.key==="r"||e.key==="R")){e.preventDefault();doAction("rulers");return;}
    /* Arrange on the arrow keys, as in Flash. These are tested before the
       plain-arrow nudge further down, which has no modifier. */
    if(ctrl&&e.key==="ArrowUp"){e.preventDefault();doAction(e.shiftKey?"bringFront":"bringForward");return;}
    if(ctrl&&e.key==="ArrowDown"){e.preventDefault();doAction(e.shiftKey?"sendBack":"sendBackward");return;}
    // Onion skin: Alt+O, and Alt+Shift+O for the outline variant.
    if(!ctrl&&e.altKey&&(e.key==="o"||e.key==="O")){
      e.preventDefault();doAction(e.shiftKey?"onionOutlines":"onionToggle");return;
    }
    if(!ctrl&&e.altKey&&(e.key==="m"||e.key==="M")){
      e.preventDefault();doAction("editMultiple");return;
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
  // A group's children are objects, not numbers: they go down the same
  // serializer so a nested group survives a save/open round trip.
  if(Array.isArray(o.children))r.children=o.children.map(plainObj);
  // Filters and the colour effect are plain data, but nested — a shallow copy
  // would share them between the document and its serialized form.
  if(Array.isArray(o.filters))r.filters=JSON.parse(JSON.stringify(o.filters));
  if(o.colorEffect)r.colorEffect=JSON.parse(JSON.stringify(o.colorEffect));
  return r;
}
function serializeLayers(layers){
  return (layers||[]).map(function(l){
    return{
      name:l.name,visible:l.visible,locked:l.locked,
      layerType:l.layerType,outlineColor:l.outlineColor,layerHeight:l.layerHeight,
      // Folder nesting and the outline-view toggle.
      indent:l.indent||0,folderOpen:l.folderOpen!==false,outlines:!!l.outlines,
      keyframes:l.keyframes.map(function(kf){
        return{
          index:kf.index,duration:kf.duration,
          tweenType:kf.tweenType,easing:kf.easing,
          script:kf.script,label:kf.label||"",labelType:kf.labelType||"name",
          sound:kf.sound?cloneSound(kf.sound):null,
          // Tween options. Written always, so a round trip is lossless even
          // for the defaults.
          easeBezier:kf.easeBezier?kf.easeBezier.slice():null,
          rotateDir:kf.rotateDir||"none",rotateTimes:kf.rotateTimes||1,
          tweenScale:kf.tweenScale!==false,orientToPath:!!kf.orientToPath,
          // Shape hints: [ax,ay,bx,by] in stage space, a point on the start
          // shape and the point it becomes on the end shape.
          shapeHints:kf.shapeHints?kf.shapeHints.map(function(h){return h.slice();}):null,
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
      mouthChart:sym.mouthChart||null,
      /* 9-slice guides, in the symbol's own pixels: distances in from each
         edge, which is how Flash specified them. Null when the symbol scales
         uniformly, which is almost all of them. */
      /* Folder path, and linkage. A folder is a path on the item rather than
         a tree beside it, so it cannot get out of step with what it describes
         and needs no migration for an older document. */
      folder:sym.folder||"",
      exportForAS:!!sym.exportForAS,
      linkageName:sym.linkageName||"",
      scale9:sym.scale9?{
        left:sym.scale9.left||0,right:sym.scale9.right||0,
        top:sym.scale9.top||0,bottom:sym.scale9.bottom||0
      }:null
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
               width:a.width||0,height:a.height||0,
               // Bitmaps live in the same Library and go in the same folders.
               folder:typeof a.folder==="string"?a.folder:""};
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
    /* "as2" marks a document that came from a .swf or .fla: its scripts are
       ActionScript and the exported player compiles them against the AS2
       scope rather than running them as plain JavaScript. */
    scriptDialect:doc.scriptDialect||"js",
    // Character rigs: the templates and pose libraries. The hierarchy and
    // current pose ride along on the keyframe objects themselves.
    characters:serializeCharacters(doc.characters),
    /* Guides are document furniture, not artwork: they are saved with the
       document (a layout you set up is worth keeping) but never exported. */
    guides:{v:docGuides().v.slice(),h:docGuides().h.slice()},
    /* Scenes. `layers` above is the CURRENT scene, which is what every older
       release wrote and what one reading this file expects to find; `scenes`
       carries all of them. A single-scene document therefore round-trips
       through an older build unchanged. */
    scenes:docScenes().map(function(sc){
      return {
        name:sc.name,
        layers:serializeLayers(sc.layers===doc.layers?doc.layers:sc.layers),
        totalFrames:(sc.layers===doc.layers?doc.totalFrames:sc.totalFrames)||60
      };
    }),
    sceneIndex:doc.sceneIndex||0,
    /* Publish settings: what this document produces, remembered with it.
       Publishing the same movie twice should not mean making the same
       decisions twice. */
    publish:JSON.parse(JSON.stringify(docPublish()))
  };
}

/**
 * The document as the EXPORTERS want it: scenes laid end to end.
 *
 * Saving must keep the scenes separate; publishing must not, because a movie
 * is one timeline. Keeping these apart is what stops a save from flattening
 * the document and a publish from showing only the first scene.
 */
function exportDocData(){
  var d=serializeDoc();
  var scenes=docScenes();
  if(scenes.length>1){
    d.layers=serializeLayers(flattenScenes());
    d.totalFrames=moviesTotalFrames();
  }else{
    /* Even with one scene, guide layers and folders are stripped here rather
       than only skipped by the player: reference art that travels inside a
       published file is still shipped, still downloaded, and still readable by
       anyone who opens it. */
    d.layers=serializeLayers(outputLayers(doc.layers));
  }
  // Scenes are already baked into `layers`; shipping them again would have the
  // player build every scene twice.
  delete d.scenes;
  delete d.sceneIndex;
  return d;
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
  // Group children come back as real EditorObjects. They used not to exist at
  // all; when they did not go through here, a reopened group's children had no
  // prototype and `clone()` threw on the next undo.
  if(Array.isArray(od.children))o.children=od.children.map(reviveObject);
  if(Array.isArray(od.filters))o.filters=JSON.parse(JSON.stringify(od.filters));
  if(od.colorEffect)o.colorEffect=JSON.parse(JSON.stringify(od.colorEffect));
  normalizeObjPoints(o);
  return o;
}
function reviveKeyframe(kd){
  var kf=new KeyFrame(kd.index||1);
  kf.duration=kd.duration||1;
  kf.tweenType=kd.tweenType||"none";
  kf.easing=kd.easing||"linear";
  kf.script=kd.script||"";
  kf.label=kd.label||"";
  kf.labelType=(kd.labelType==="comment"||kd.labelType==="anchor")?kd.labelType:"name";
  kf.sound=(kd.sound&&kd.sound.asset)?cloneSound(kd.sound):null;
  kf.easeBezier=(Array.isArray(kd.easeBezier)&&kd.easeBezier.length>=4)
    ? kd.easeBezier.slice(0,4).map(Number) : null;
  kf.rotateDir=(kd.rotateDir==="cw"||kd.rotateDir==="ccw")?kd.rotateDir:"none";
  kf.rotateTimes=Math.max(1,parseInt(kd.rotateTimes,10)||1);
  kf.tweenScale=kd.tweenScale!==false;
  kf.orientToPath=!!kd.orientToPath;
  kf.shapeHints=Array.isArray(kd.shapeHints)
    ? kd.shapeHints.filter(function(h){return Array.isArray(h)&&h.length>=4;})
        .map(function(h){return h.slice(0,4).map(Number);})
    : null;
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
    l.indent=Math.max(0,Math.min(8,parseInt(ld.indent,10)||0));
    l.folderOpen=ld.folderOpen!==false;
    l.outlines=!!ld.outlines;
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
      mouthChart:sd.mouthChart||null,
      folder:typeof sd.folder==="string"?sd.folder:"",
      exportForAS:!!sd.exportForAS,
      linkageName:typeof sd.linkageName==="string"?sd.linkageName:"",
      scale9:sd.scale9?{
        left:Number(sd.scale9.left)||0,right:Number(sd.scale9.right)||0,
        top:Number(sd.scale9.top)||0,bottom:Number(sd.scale9.bottom)||0
      }:null
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
  doc.scriptDialect=d.scriptDialect==="as2"?"as2":"js";
  doc.characters=reviveCharacters(d.characters);
  doc.guides={
    v:(d.guides&&Array.isArray(d.guides.v)?d.guides.v:[]).map(Number).filter(isFinite),
    h:(d.guides&&Array.isArray(d.guides.h)?d.guides.h:[]).map(Number).filter(isFinite)
  };
  doc.publish=(d.publish&&typeof d.publish==="object")
    ? JSON.parse(JSON.stringify(d.publish)) : null;
  docPublish();
  doc.layers=reviveLayers(d.layers);
  /* Scenes. A document without them gets one made from its layers, so every
     file written before scenes existed opens as a one-scene movie. */
  if(Array.isArray(d.scenes)&&d.scenes.length){
    doc.scenes=d.scenes.map(function(sc,i){
      return {
        name:String(sc&&sc.name||("Scene "+(i+1))),
        layers:reviveLayers(sc&&sc.layers),
        totalFrames:(sc&&sc.totalFrames)||60
      };
    });
    doc.sceneIndex=Math.max(0,Math.min(parseInt(d.sceneIndex,10)||0,doc.scenes.length-1));
    // `doc.layers` is a live alias of the current scene, never a copy.
    var liveScene=doc.scenes[doc.sceneIndex];
    if(!liveScene.layers.length)liveScene.layers=[new Layer("Layer 1")];
    doc.layers=liveScene.layers;
    doc.totalFrames=liveScene.totalFrames||doc.totalFrames;
  }else{
    doc.scenes=null;doc.sceneIndex=0;
    docScenes();
  }
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
var _cachedAS2Source=null;
/** True if the export needs the AS2 runtime: handlers, or imported scripts. */
function docHasClipScripts(d){
  if(d.scriptDialect==="as2")return true;
  var found=false;
  var scan=function(layers){
    (layers||[]).forEach(function(l){
      (l.keyframes||[]).forEach(function(k){
        (k.objects||[]).forEach(function(o){ if(o.clipScript&&o.clipScript.trim())found=true; });
      });
    });
  };
  scan(d.layers);
  Object.keys(d.library||{}).forEach(function(n){ scan(d.library[n].layers); });
  return found;
}
/* The AS2 handler runtime rides along only when the document uses it — most
   cartoons have no object handlers, and an export should not carry a
   scripting engine it never calls. */
function getAS2Source(need,callback){
  if(!need){callback("");return;}
  if(_cachedAS2Source){callback(_cachedAS2Source);return;}
  fetch("flashy-as2.js").then(function(r){return r.text();}).then(function(src){
    _cachedAS2Source=src;callback(src);
  }).catch(function(){
    callback("/* flashy-as2.js could not be loaded — object handlers will not run */");
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
  /**
   * A symbol's content at a frame, grouped by mask — the runtime's twin of
   * the editor's symbolFrameGroups() — except that nothing in here consults
   * `layer.visible`. Hiding a layer is an authoring aid, as it is in Flash:
   * the published movie has every layer in it.
   *
   * Masks live inside symbols far more
   * often than on the root, and a flattened symbol draws every mask's own
   * artwork over the scene it was supposed to be clipping.
   */
  function symbolGroups(sym, frame) {
    if (!sym) return [];
    if (!sym.layers) {
      return (sym.objects && sym.objects.length) ? [{ mask: null, objects: sym.objects }] : [];
    }
    var objectsAt = function (layer) {
      if (!layer) return [];
      for (var k = layer.keyframes.length - 1; k >= 0; k--) {
        var kf = layer.keyframes[k];
        if (frame >= kf.index && frame < kf.index + kf.duration) return kf.objects;
      }
      return [];
    };
    var groups = layerGroups(sym.layers);
    var out = [];
    for (var gi = groups.length - 1; gi >= 0; gi--) {
      var g = groups[gi];
      var objs = [];
      for (var i = g.layers.length - 1; i >= 0; i--) objs = objs.concat(objectsAt(g.layers[i]));
      if (!objs.length) continue;
      var maskObjs = null;
      if (g.mask) {
        maskObjs = objectsAt(g.mask);
        if (!maskObjs.length) continue;
      }
      out.push({ mask: maskObjs, objects: objs });
    }
    return out;
  }

  /** Build a symbol's frame into `host`, clipping each masked run. */
  function addSymbolFrame(host, sym, frame, depth, startFrame, keyPrefix) {
    var groups = symbolGroups(sym, frame);
    for (var gi = 0; gi < groups.length; gi++) {
      var target = host;
      if (groups[gi].mask) {
        target = maskedContainer(groups[gi].mask);
        host.addChild(target);
      }
      addPlanned(target, groups[gi].objects, depth, frame, startFrame,
        keyPrefix == null ? null : keyPrefix + ":g" + gi);
    }
  }

  function symbolObjects(sym, frame) {
    if (!sym) return [];
    if (!sym.layers) return sym.objects || [];
    frame = frame || 1;
    var out = [];
    for (var i = sym.layers.length - 1; i >= 0; i--) {
      var l = sym.layers[i];
      if (!l) continue;
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
  /* Every built clip gets an id, so the things inside it can be cached by a
     key that is stable for as long as that clip is. Without it a symbol
     rebuilds its contents on every tick: a button inside one never keeps
     its hover, and a scripted object inside one is replaced the instant
     after its handler moves it — which looks exactly like the handler not
     working. */
  var clipSeq = 0;
  var instanceCache = Object.create(null);
  /* Objects with handlers, kept for the same reason and keyed the same way,
     but separately: a scripted shape is not a symbol instance. */
  var scriptedCache = Object.create(null);
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
    var clipKey = "c" + (++clipSeq);
    var total = symFrames(sym);
    mc.timeline.setTotalFrames(total);
    mc.loop = (o.loopMode || "loop") !== "once";
    /* A symbol's own labels and scripts, which is where most of an imported
       movie's behaviour lives — the root is usually three frames of menu. */
    var symScripts = {};
    (sym.layers || []).forEach(function (la) {
      (la.keyframes || []).forEach(function (k) {
        if (k.label) mc.timeline.addLabel(k.label, k.index);
        if (k.script && k.script.trim()) {
          (symScripts[k.index] = symScripts[k.index] || []).push(k.script);
        }
      });
    });
    var symCompiled = {};
    for (var f = 1; f <= total; f++) {
      (function (fr) {
        mc.timeline.addFrameScript(fr, function () {
          this.removeAllChildren();
          addSymbolFrame(this, sym, fr, depth + 1, 1, clipKey + ":" + fr);
          var list = symScripts[fr];
          if (!list) return;
          for (var i = 0; i < list.length; i++) {
            var ck = fr + ":" + i;
            try {
              if (!(ck in symCompiled)) {
                symCompiled[ck] = as2
                  ? Flashy.AS2.frameScript(this, list[i], { stage: stage })
                  : new Function("stop", "play", "gotoAndPlay", "gotoAndStop", "stage", "root", "Flashy", "trace", list[i]);
              }
              var run = symCompiled[ck];
              if (!run) continue;
              if (as2) run();
              else {
                var self = this;
                run.call(self,
                  function () { self.stop(); },
                  function () { self.play(); },
                  function (fv) { self.gotoAndPlay(fv); },
                  function (fv) { self.gotoAndStop(fv); },
                  stage, root, Flashy,
                  function () { return Flashy.Output.write.apply(Flashy.Output, arguments); });
              }
            } catch (e) {
              if (typeof console !== "undefined") console.error("Flashy: symbol frame script failed", e);
            }
          }
        });
      })(f);
    }
    if ((o.loopMode || "loop") === "single") mc.gotoAndStop(Math.max(1, o.firstFrame || 1));
    else if (o.firstFrame > 1) mc.gotoAndPlay(o.firstFrame);
    else if (!mc._primed) {
      /* Build its first frame now rather than on its first tick. A clip
         created this frame should be drawn this frame — otherwise every
         nested symbol flashes in a frame late, which on a cartoon where
         clips are created constantly is a permanent one-frame lag. */
      mc._primed = true;
      mc.timeline.update(mc.currentFrame);
      var firstScript = mc.timeline.frameScripts[mc.currentFrame];
      if (firstScript) firstScript.call(mc);
    }
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
    var btnKey = "b" + (++clipSeq);
    var total = symFrames(sym);
    var states = {};
    BTN_ORDER.forEach(function (name, i) {
      var fr = Math.min(i + 1, total);
      var holder = new Flashy.MovieClip();
      addSymbolFrame(holder, sym, fr, depth + 1, 1, btnKey + ":" + name);
      /* The hit frame defines the clickable area but is never drawn, so it
         is visible (hit testing skips invisible children) at alpha 0. It
         has to start that way rather than wait for the first refresh, or a
         button is unclickable for the frame after it appears — which on a
         menu that has just faded in is exactly when it gets clicked. */
      holder.visible = (name === "up" || name === "hit");
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
  /* A gradient fill, if the object has one. `map` turns a box fraction into
     the node's own coordinates, the same contract the editor's painter uses —
     the two have to agree or an export looks different from the stage it was
     authored on. Returns false for a plain colour, so the caller falls
     through to beginFill. */
  function gradFill(g, o, map) {
    var t = o.fillType;
    if ((t !== "linear" && t !== "radial") || !o.fillStops || o.fillStops.length < 3) return false;
    var gd = o.fillGrad && o.fillGrad.length >= 4 ? o.fillGrad : [0, 0, 1, 0];
    var p0 = map(gd[0], gd[1]), p1 = map(gd[2], gd[3]);
    var colors = [], alphas = [], ratios = [];
    var mul = o.fillAlpha != null ? o.fillAlpha : 1;
    for (var i = 0; i + 2 < o.fillStops.length; i += 3) {
      ratios.push(Math.max(0, Math.min(1, o.fillStops[i])));
      colors.push(o.fillStops[i + 1] | 0);
      alphas.push((o.fillStops[i + 2] == null ? 1 : o.fillStops[i + 2]) * mul);
    }
    g.beginGradientFill(t, colors, alphas, ratios, p0[0], p0[1], p1[0], p1[1]);
    return true;
  }

  function buildObj(o, depth, parentFrame, startFrame, key) {
    depth = depth || 0;
    var hw = (o.width || 0) / 2, hh = (o.height || 0) / 2;
    var node;

    /* An object a script has touched owns itself from then on.
       The root rebuilds its display list every tick, so a node that a
       handler has just moved — or that code has just attached `onRelease`
       to — is otherwise thrown away and rebuilt from the document, which
       looks exactly like the script never ran. Scripts reach a node two
       ways, and both have to survive: handlers imported with the object
       (`__as2`) and handlers assigned in code (`__as2Dyn`). */
    var cached = key ? scriptedCache[key] : null;
    if (cached && cached.sig === objectSignature(o) &&
        (cached.node.__as2 || hasDynamicHandlers(cached.node))) {
      return cached.node;
    }

    /* Whether the timeline may overwrite this node's transform this frame.
       Flash applies a keyframe's values when it places an object, not on
       every tick it sits there — so a clip that a script has moved, hidden
       or faded stays that way until the timeline actually changes. This
       runtime rebuilds the display list every tick, so without the
       distinction every `_visible = false` is undone a sixtieth of a second
       later. A tween is the timeline driving the object on purpose, so it
       always wins. */
    var sticky = false;
    /* Whether this instance stretches by 9-slice cells. Declared out here
       because the transform block at the bottom has to know, and it is a long
       way from where the symbol branch works it out. */
    var sliced = false;

    if (o.type === "symbol") {
      var sym = data.library && data.library[o.symbolName];
      var behavior = behaviorOf(o, sym);
      var stateful = behavior === "movieclip" || behavior === "button";
      /* A stateful instance is cached WHOLE — wrapper and contents — not
         just its contents. Caching only the inside and rebuilding the
         wrapper around it every frame loses the wrapper's transform, which is
         where the instance's position lives. */
      var hit = (key && stateful) ? instanceCache[key] : null;
      if (hit && hit.symbolName === o.symbolName && hit.behavior === behavior) {
        node = hit.node;
        if (!o.__tween && hit.placedAt === startFrame) return node;
        hit.placedAt = startFrame;
        if (node.__inner) { node.__inner.x = -hw; node.__inner.y = -hh; }
      }
      if (!node) node = new Flashy.MovieClip();
      /* 9-slice: the guides live on the library entry, and the instance's
         scale has to be applied cell by cell INSIDE the node rather than by
         the outer transform — a parent's scale is already in the context by
         the time render() runs and would stretch every cell alike. */
      sliced = Flashy.Slice9 && Flashy.Slice9.active(sym && sym.scale9) &&
               (Math.abs(o.scaleX || 1) !== 1 || Math.abs(o.scaleY || 1) !== 1);
      if (!hit && sym && depth < SYM_MAX_DEPTH) {
        // Symbol space has its origin at the instance's top-left corner.
        var inner;
        if (stateful) {
          inner = behavior === "button" ? buildButton(sym, o, depth) : buildMovieClip(sym, o, depth);
          if (key) {
            instanceCache[key] = {
              node: node, symbolName: o.symbolName, behavior: behavior, placedAt: startFrame
            };
          }
        } else {
          // Graphic: parent-driven, so rebuilding each frame is the point.
          inner = new Flashy.MovieClip();
          var gf = graphicFrame(o, sym, parentFrame, startFrame);
          addSymbolFrame(inner, sym, gf, depth + 1, 1, (key || "g" + (++clipSeq)) + ":f" + gf);
        }
        inner.x = -hw; inner.y = -hh;
        if (sliced) {
          // A NineSlice wrapper between the instance and its contents, sized
          // to where the scale WOULD have put it.
          var ns = new Flashy.NineSlice(sym.scale9, Math.abs(o.width) || 1, Math.abs(o.height) || 1);
          ns.targetWidth = (Math.abs(o.width) || 1) * Math.abs(o.scaleX || 1);
          ns.targetHeight = (Math.abs(o.height) || 1) * Math.abs(o.scaleY || 1);
          ns.x = -ns.targetWidth / 2;
          ns.y = -ns.targetHeight / 2;
          inner.x = 0; inner.y = 0;
          ns.addChild(inner);
          node.__inner = ns;
          node.addChild(ns);
        } else {
          node.__inner = inner;
          node.addChild(inner);
        }
      }
    } else if (o.type === "group") {
      /* A group: a transform plus children, in group space. Built like a
         Graphic symbol instance — rebuilt each frame, no own playhead — but
         with the child list carried on the object instead of in the library.
         Without this branch a grouped drawing fell through to the `else` and
         exported as an empty Shape. */
      node = new Flashy.MovieClip();
      if (depth < SYM_MAX_DEPTH) {
        var ginner = new Flashy.MovieClip();
        ginner.x = -hw; ginner.y = -hh;
        var gw0 = o.groupW || Math.abs(o.width) || 1, gh0 = o.groupH || Math.abs(o.height) || 1;
        ginner.scaleX = Math.abs(o.width || gw0) / gw0;
        ginner.scaleY = Math.abs(o.height || gh0) / gh0;
        addPlanned(ginner, o.children || [], depth + 1, parentFrame, startFrame,
                   key != null ? key + ":gr" : null);
        node.addChild(ginner);
      }
    } else if (o.type === "text") {
      /* One text renderer, built from the document object by the engine
         itself — the same call the authoring stage makes, so a wrapped,
         letter-spaced, bordered field exports as what was on screen. The
         export passes no `chrome`, so an empty dynamic field stays empty
         instead of shipping the word "Text". */
      var tf = Flashy.TextField.fromObject(o, {});
      // The field draws from its box's top-left; the node sits at the centre.
      tf.x = -hw;
      tf.y = -hh;
      node = new Flashy.MovieClip();
      node.addChild(tf);
      /* A dynamic or input field is reachable from script, which is the whole
         point of it being one. `text` on the clip proxies the field, so
         `score.text = "10"` works the way an AS2 author expects, and an input
         field's typed value is readable the same way. */
      if (o.textType === "dynamic" || o.textType === "input") {
        node.__textField = tf;
        try {
          Object.defineProperty(node, "text", {
            configurable: true,
            get: function () { return tf.text; },
            set: function (v) { tf.text = v == null ? "" : String(v); }
          });
        } catch (e) { /* a sealed node: the field is still on __textField */ }
        // A variable-bound field publishes its value on the root, which is
        // where an AS2 script looks for it.
        if (o.variableName) {
          tf.variable = o.variableName;
          root[o.variableName] = tf.text;
        }
      }
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

      /* A parameterised primitive — a rounded rectangle, or an oval arc, pie
         or donut — resolves to a command stream from Flashy.Primitives, which
         IS shipped with the export, and is then replayed by the same code path
         a traced outline uses. One geometry, five consumers. */
      var primCmds = (Flashy.Primitives && Flashy.Primitives.active(o))
        ? Flashy.Primitives.path(o) : null;
      if (o.type === "path" || primCmds) {
        /* A traced outline. The command stream is replayed inline rather than
           through FlashyTrace, because this whole function is serialised into
           the export and the tracer is not shipped with it — the encoding is
           four opcodes, and duplicating the reader is cheaper than embedding
           an authoring-time module in every exported cartoon.
           0 moveTo x y · 1 lineTo x y · 2 quadTo cx cy x y · 3 closePath */
        var cmds = primCmds || o.path;
        if (cmds && cmds.length) {
          var psx = primCmds ? 1 : (o.pathW ? (o.width / o.pathW) : 1);
          var psy = primCmds ? 1 : (o.pathH ? (o.height / o.pathH) : 1);
          if (filled) {
            // Even-odd: holes ride along as extra loops in the same path.
            if (!gradFill(g, o, function (fx, fy) {
              return [fx * (o.pathW || Math.abs(o.width) || 1) * psx - hw,
                      fy * (o.pathH || Math.abs(o.height) || 1) * psy - hh];
            })) {
              g.beginFill(hex(o.fillColor, "#000"), o.fillAlpha != null ? o.fillAlpha : 1, "evenodd");
            }
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
        if (filled && !gradFill(g, o, function (fx, fy) {
          return [-hw + fx * (o.width || 0), -hh + fy * (o.height || 0)];
        })) {
          g.beginFill(hex(o.fillColor, "#000"), o.fillAlpha != null ? o.fillAlpha : 1);
        }
        if (stroked) g.lineStyle(o.strokeWidth, hex(o.strokeColor, "#000"), sa);
        if (o.type === "rect") g.drawRect(-hw, -hh, o.width, o.height);
        else if (o.type === "oval") g.drawEllipse(-hw, -hh, o.width, o.height);
        if (filled) g.endFill();
      }
    }

    if (sticky && node.__placed) {
      /* Reused, unchanged, and not tweening: leave it exactly as the movie
         left it. Returning the same node keeps its children, its playhead
         and whatever its scripts have done. */
      return node;
    }
    node.__placed = true;
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
      // The engine takes skew in radians, in the same rotate-skew-scale order.
      node.skewX = (o.skewX || 0) * Math.PI / 180;
      node.skewY = (o.skewY || 0) * Math.PI / 180;
      if (sliced) {
        // The magnitude is already inside the NineSlice; only the mirror is
        // left, or the stretch would be applied twice.
        node.scaleX = (o.scaleX || 1) < 0 ? -1 : 1;
        node.scaleY = (o.scaleY || 1) < 0 ? -1 : 1;
      } else {
        node.scaleX = o.scaleX || 1;
        node.scaleY = o.scaleY || 1;
      }
    }
    node.alpha = o.alpha != null ? o.alpha : 1;
    if (o.blendMode && o.blendMode !== "source-over") node.blendMode = o.blendMode;
    /* Filters and the Colour Effect, handed to the engine's own
       Flashy.Filters — the same module the authoring stage paints through, so
       an exported glow is the glow that was on screen. Assigned every rebuild
       rather than only when present, so clearing a filter in the document
       clears it on a cached node too. */
    node.filters = (o.filters && o.filters.length) ? o.filters : null;
    node.colorTransform = Flashy.Filters ? Flashy.Filters.colorEffect(o.colorEffect) : null;
    if (o.instanceName) {
      node.name = o.instanceName;
      /* …and published on the root, so a script can reach it by that name.
         AS2 resolved `score` through the scope chain; a JavaScript frame
         script has no scope chain to resolve it through, so the inspector's
         promise that `score.text = "…"` works needed this to be true.
         Existing properties are never overwritten — an instance called
         "stop" must not replace the root's stop(). */
      if (!(o.instanceName in root) || root.__named && root.__named[o.instanceName]) {
        (root.__named || (root.__named = {}))[o.instanceName] = true;
        root[o.instanceName] = node;
      }
    }
    /* Object handlers — `onClipEvent(load) { … }` and `on(release) { … }`,
       which is where Flash kept a clip's own behaviour and where an import
       puts it. They run here and in Test Movie, never on the authoring
       stage, exactly like frame scripts. */
    if (o.clipScript && Flashy.AS2) {
      /* Flash measures a clip from its registration point and this engine
         from the centre of its box; the importer records the gap so a
         handler with coordinates baked into it still lands. */
      node.__as2Reg = {
        x: o.regX != null ? o.regX : hw, y: o.regY != null ? o.regY : hh,
        hw: hw, hh: hh
      };
      var attached = Flashy.AS2.attach(node, o.clipScript, { stage: stage });
      if (attached) node.__as2 = attached;
    }
    if (key) {
      /* Handlers listen on the stage, so a node being replaced has to take
         its listeners with it — otherwise every rebuild leaves a set
         behind, firing at an object nobody can see. */
      if (cached && cached.node !== node && cached.node.__as2) cached.node.__as2.detach();
      scriptedCache[key] = { node: node, sig: objectSignature(o) };
    }
    return node;
  }

  /* What makes a rebuilt object "the same object" as the one before it:
     if any of this changed, the timeline has replaced it and the old node
     (and anything a script did to it) goes. */
  function objectSignature(o) {
    return (o.type || "") + "|" + (o.symbolName || "") + "|" +
      (o.bitmapAsset || "") + "|" + (o.clipScript ? o.clipScript.length : 0) + "|" +
      (o.instanceName || "");
  }

  function hasDynamicHandlers(node) {
    if (!node.__as2Dyn) return false;
    for (var k in node.__as2Dyn) if (Object.prototype.hasOwnProperty.call(node.__as2Dyn, k)) return true;
    return false;
  }

  /* Guide layers and folders never reach the output. A guide layer is
     reference art — a traced photo, a motion path, a registration cross — and
     the whole point of marking one is that it does not appear in the movie;
     it was marked, saved, and published anyway. A folder holds no artwork of
     its own. Filtered once here so every consumer below (sounds, scripts,
     labels, the display list) sees the same set. */
  var outLayers = (data.layers || []).filter(function (l) {
    var t = (l && l.layerType) || "normal";
    return t !== "guide" && t !== "folder" && t !== "motionguide";
  });
  /* The motion guides themselves, kept aside: a guided layer's tween reads
     its path, so the paths have to survive the filter above even though they
     are never drawn. Indexed by the guided layer, resolved once. */
  var guideFor = {};
  (function () {
    if (!Flashy.MotionGuide) return;
    var all = data.layers || [];
    for (var i = 0; i < all.length; i++) {
      var gl = Flashy.MotionGuide.guideFor(all, i);
      if (!gl) continue;
      var kf = (gl.keyframes || [])[0];
      var objs = kf ? (kf.objects || []) : [];
      for (var j = 0; j < objs.length; j++) {
        var pts = Flashy.MotionGuide.polyline(objs[j]);
        if (pts && pts.length >= 4) {
          guideFor[all[i].name] = { points: pts, arc: Flashy.MotionGuide.arc(pts) };
          break;
        }
      }
    }
  })();

  var maxF = 1;
  outLayers.forEach(function (l) {
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
  outLayers.forEach(function (la, li) {
    (la.keyframes || []).forEach(function (k) {
      if (!k.sound || !k.sound.asset) return;
      var asset = data.sounds && data.sounds[k.sound.asset];
      if (!asset) return;
      var frames = asset.duration
        ? Math.max(1, Math.ceil((asset.duration - (k.sound.offset || 0)) * data.fps))
        : k.duration;
      /* The effect's envelope, resolved through the engine's own preset table
         so the authoring preview and the published movie cannot disagree about
         what "Fade In" is. A custom curve travels on the document already. */
      var env = k.sound.effect === "custom"
        ? (k.sound.envelope && k.sound.envelope.length ? k.sound.envelope : null)
        : (Flashy.SoundTrack && Flashy.SoundTrack.envelopeFor
            ? Flashy.SoundTrack.envelopeFor(k.sound.effect || "none", asset.duration || 1)
            : null);
      soundItems.push({
        id: li + ":" + k.index,
        asset: k.sound.asset,
        startFrame: k.index,
        endFrame: k.index + (k.sound.loop ? k.duration : Math.min(k.duration, frames)) - 1,
        sync: k.sound.sync || "stream",
        volume: k.sound.volume != null ? k.sound.volume : 1,
        loop: !!k.sound.loop,
        offset: k.sound.offset || 0,
        envelope: env,
        repeat: k.sound.repeat || 0
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
  outLayers.forEach(function (la) {
    (la.keyframes || []).forEach(function (k) {
      if (k.script && k.script.trim()) (frameScripts[k.index] = frameScripts[k.index] || []).push(k.script);
    });
  });
  /* Frame labels, so `gotoAndPlay("menuLabel")` goes somewhere. An imported
     movie navigates by label almost exclusively — the frame numbers in its
     scripts are the exception. */
  outLayers.forEach(function (la) {
    (la.keyframes || []).forEach(function (k) {
      // A comment is an authoring note, not a script target: exporting it as a
      // label would make `gotoAndPlay("fix this bit")` a working instruction.
      if (k.label && (k.labelType || "name") !== "comment") root.timeline.addLabel(k.label, k.index);
    });
  });

  /* A document that came from a .swf or .fla carries ActionScript, not the
     editor's own JavaScript: it expects `_root`, `_parent`, `_quality`,
     `Mouse`, and variables that live on the timeline. Those scripts are
     compiled against the AS2 scope; anything authored here keeps the plain
     JavaScript it was written in. */
  var as2 = data.scriptDialect === "as2" && !!Flashy.AS2;

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
          compiled[key] = as2
            ? Flashy.AS2.frameScript(root, list[i], { stage: stage })
            : new Function("stop", "play", "gotoAndPlay", "gotoAndStop", "stage", "root", "Flashy", "trace", list[i]);
        }
        if (!compiled[key]) continue;
        if (as2) compiled[key]();
        else {
          compiled[key].call(root,
            function () { root.stop(); },
            function () { root.play(); },
            function (f) { root.gotoAndPlay(f); },
            function (f) { root.gotoAndStop(f); },
            stage, root, Flashy,
            /* trace() in scope for a JavaScript frame script too. It was in
               scope for an imported movie's ActionScript and not for a script
               written in this editor, which is backwards. */
            function () { return Flashy.Output.write.apply(Flashy.Output, arguments); });
        }
      } catch (e) {
        if (typeof console !== "undefined") console.error("Flashy: frame " + fr + " script failed", e);
      }
    }
  }

  function easeAt(t, name, bezier) {
    // Through the engine's resolver when it is there, so a custom curve eases
    // in the movie exactly as it did on the authoring stage.
    if (Flashy.Easing && Flashy.Easing.resolve) {
      return Flashy.Easing.resolve(name, bezier)(Math.min(1, Math.max(0, t)));
    }
    var ef = easing[name || "linear"] || easing.linear;
    return ef(Math.min(1, Math.max(0, t)));
  }

  /* ---- mask layers --------------------------------------------------- *
   * A layer marked `mask` clips the run of `masked` layers beneath it, and
   * its own artwork is never drawn. The clip is a canvas path built from
   * the mask objects' outlines, applied by a container that wraps the
   * layers it masks — the same silhouette the editor's stage uses, so an
   * export looks like what was authored.
   * -------------------------------------------------------------------- */
  function objectOutline(ctx2, o) {
    var hw = (o.width || 0) / 2, hh = (o.height || 0) / 2;
    ctx2.save();
    ctx2.translate((o.x || 0) + hw, (o.y || 0) + hh);
    if (o.rotation) ctx2.rotate(o.rotation * Math.PI / 180);
    ctx2.scale(o.scaleX || 1, o.scaleY || 1);
    if (o.type === "oval") {
      ctx2.moveTo(Math.abs(hw), 0);
      ctx2.ellipse(0, 0, Math.abs(hw), Math.abs(hh), 0, 0, Math.PI * 2);
    } else if (o.type === "path" && o.path && o.path.length) {
      var psx = o.pathW ? (o.width / o.pathW) : 1, psy = o.pathH ? (o.height / o.pathH) : 1;
      ctx2.translate(-hw, -hh);
      if (psx !== 1 || psy !== 1) ctx2.scale(psx, psy);
      var cmds = o.path;
      for (var pi = 0; pi < cmds.length;) {
        var op = cmds[pi];
        if (op === 0) { ctx2.moveTo(cmds[pi + 1], cmds[pi + 2]); pi += 3; }
        else if (op === 1) { ctx2.lineTo(cmds[pi + 1], cmds[pi + 2]); pi += 3; }
        else if (op === 2) { ctx2.quadraticCurveTo(cmds[pi + 1], cmds[pi + 2], cmds[pi + 3], cmds[pi + 4]); pi += 5; }
        else { ctx2.closePath(); pi += 1; }
      }
    } else if ((o.type === "pencil" || o.type === "brush") && o.points && o.points.length > 3) {
      ctx2.moveTo(o.points[0] - hw, o.points[1] - hh);
      for (var qi = 2; qi < o.points.length; qi += 2) ctx2.lineTo(o.points[qi] - hw, o.points[qi + 1] - hh);
      ctx2.closePath();
    } else {
      ctx2.rect(-hw, -hh, o.width, o.height);
    }
    ctx2.restore();
  }

  function maskedContainer(maskObjects) {
    var holder = new Flashy.MovieClip();
    holder.render = function (ctx2) {
      ctx2.save();
      ctx2.beginPath();
      for (var i = 0; i < maskObjects.length; i++) objectOutline(ctx2, maskObjects[i]);
      ctx2.clip();
      Flashy.MovieClip.prototype.render.call(this, ctx2);
      ctx2.restore();
    };
    return holder;
  }

  /** The layer runs: each either plain, or a mask plus what it masks. */
  function layerGroups(layers) {
    var groups = [], i = 0;
    while (i < layers.length) {
      if ((layers[i].layerType || "normal") === "mask") {
        var mask = layers[i], run = [], j = i + 1;
        while (j < layers.length && (layers[j].layerType || "normal") === "masked") { run.push(layers[j]); j++; }
        groups.push({ mask: mask, layers: run });
        i = j;
      } else {
        var plain = [];
        while (i < layers.length && (layers[i].layerType || "normal") !== "mask") { plain.push(layers[i]); i++; }
        groups.push({ mask: null, layers: plain });
      }
    }
    return groups;
  }
  var groups = layerGroups(outLayers);

  for (var f = 1; f <= maxF; f++) {
    (function (fr) {
      root.timeline.addFrameScript(fr, function () {
        /* Clips a script attached are not in the document, so the rebuild
           cannot put them back — they are lifted out, the display list is
           rebuilt from the timeline, and they go back on top. Without this
           every attachMovie() vanished on the next frame. */
        var attached = this.children.filter(function (c) { return c.__attached; });
        this.removeAllChildren();
        for (var gi = groups.length - 1; gi >= 0; gi--) {
          var group = groups[gi];
          var host = this;
          if (group.mask) {
            var maskObjs = layerObjects(group.mask, fr);
            if (!maskObjs.length) continue;      // nothing shown through it
            host = maskedContainer(maskObjs);
            this.addChild(host);
          }
          buildLayerRun(host, group.layers, fr, gi);
        }
        for (var ai = 0; ai < attached.length; ai++) this.addChild(attached[ai]);
        runFrameScripts(fr);
        refreshButtons();
        if (track) track.update(fr, false);
      });
    })(f);
  }

  function activeKeyframe(la, fr) {
    for (var ki = la.keyframes.length - 1; ki >= 0; ki--) {
      var k = la.keyframes[ki];
      if (fr >= k.index && fr < k.index + k.duration) return k;
    }
    return null;
  }

  /** The objects a layer shows on a frame, interpolated if it is tweening. */
  function layerObjects(la, fr) {
    var kf = activeKeyframe(la, fr);
    if (!kf) return [];
    var nk = kf.tweenType && kf.tweenType !== "none" && kf.duration > 1
      ? la.keyframes[la.keyframes.indexOf(kf) + 1] : null;
    // Divide by duration (not duration-1) so the frame holding the next
    // keyframe is the one that shows the destination — same as the stage.
    var t = nk ? easeAt((fr - kf.index) / kf.duration, kf.easing, kf.easeBezier) : 0;
    var out = [];
    for (var oi = 0; oi < kf.objects.length; oi++) {
      var a = kf.objects[oi];
      var o = a;
      var b = nk ? nk.objects[oi] : null;
      /* A shape tween is a real outline morph, not an interpolated box. The
         editor and the player both go through Flashy.Morph, so a morph in the
         movie is the morph that was on the authoring stage. */
      if (b && kf.tweenType === "shape" && Flashy.Morph) {
        var mh = (oi === 0 && kf.shapeHints && kf.shapeHints.length) ? kf.shapeHints : null;
        var mm = Flashy.Morph.between(a, b, t, mh);
        if (mm) {
          var mo = {};
          for (var mp in a) mo[mp] = a[mp];
          mo.type = "path";
          mo.path = mm.path; mo.pathW = mm.pathW; mo.pathH = mm.pathH;
          mo.x = mm.x; mo.y = mm.y; mo.width = mm.width; mo.height = mm.height;
          // Already in stage space: applying the object's transform again
          // would move the morph away from where it was drawn.
          mo.rotation = 0; mo.scaleX = 1; mo.scaleY = 1; mo.skewX = 0; mo.skewY = 0;
          mo.points = null;
          var mix = function (ca, cb) {
            var hx = function (v) {
              return typeof v === "string"
                ? parseInt(String(v).replace("#", ""), 16) : (v | 0);
            };
            var an = hx(ca == null ? "#000000" : ca), bn = hx(cb == null ? "#000000" : cb);
            var ch = function (sh) {
              var av = (an >> sh) & 0xff, bv = (bn >> sh) & 0xff;
              return Math.max(0, Math.min(255, Math.round(av + (bv - av) * t)));
            };
            return "#" + [ch(16), ch(8), ch(0)].map(function (v) {
              return ("0" + v.toString(16)).slice(-2);
            }).join("");
          };
          mo.fillColor = mix(a.fillColor, b.fillColor);
          mo.strokeColor = mix(a.strokeColor, b.strokeColor);
          var mn = function (k, d) {
            var av = a[k] != null ? a[k] : d, bv = b[k] != null ? b[k] : d;
            return av + (bv - av) * t;
          };
          mo.fillAlpha = mn("fillAlpha", 1);
          mo.strokeAlpha = mn("strokeAlpha", 1);
          mo.strokeWidth = mn("strokeWidth", 0);
          mo.alpha = mn("alpha", 1);
          mo.fillType = ((a.fillType || "solid") === "none" &&
                         (b.fillType || "solid") === "none") ? "none" : "solid";
          mo.__tween = true;
          out.push(mo);
          continue;
        }
      }
      if (b) {
        o = {};
        for (var prop in a) o[prop] = a[prop];
        o.x = a.x + (b.x - a.x) * t;
        o.y = a.y + (b.y - a.y) * t;
        /* Flash's "Scale" checkbox: off means the object keeps its own size
           through the tween and only moves. */
        if (kf.tweenScale === false) {
          o.width = a.width; o.height = a.height;
          o.scaleX = a.scaleX; o.scaleY = a.scaleY;
        } else {
          o.width = a.width + (b.width - a.width) * t;
          o.height = a.height + (b.height - a.height) * t;
          o.scaleX = (a.scaleX || 1) + ((b.scaleX || 1) - (a.scaleX || 1)) * t;
          o.scaleY = (a.scaleY || 1) + ((b.scaleY || 1) - (a.scaleY || 1)) * t;
        }
        /* Rotate CW/CCW x n: a tween otherwise always takes the short way
           round, so 0 to 350 degrees rolls backwards and 0 to 360 does not
           move at all. */
        if (kf.rotateDir && kf.rotateDir !== "none") {
          var turns = Math.max(1, parseInt(kf.rotateTimes, 10) || 1);
          var rf = a.rotation || 0;
          var rt = b.rotation != null ? b.rotation : rf;
          if (kf.rotateDir === "cw") {
            while (rt < rf) rt += 360;
            if (rt === rf) rt += 360;
            rt += 360 * (turns - 1);
          } else {
            while (rt > rf) rt -= 360;
            if (rt === rf) rt -= 360;
            rt -= 360 * (turns - 1);
          }
          o.rotation = rf + (rt - rf) * t;
        } else {
          o.rotation = (a.rotation || 0) + ((b.rotation || 0) - (a.rotation || 0)) * t;
        }
        /* Skew, filters and the colour effect tween here too. They did not,
           which meant a glow that pulsed on the authoring stage held still in
           the export — the exact divergence class paintObj exists to prevent,
           reappearing because this function is the runtime's own copy of the
           interpolator. */
        o.skewX = (a.skewX || 0) + ((b.skewX || 0) - (a.skewX || 0)) * t;
        o.skewY = (a.skewY || 0) + ((b.skewY || 0) - (a.skewY || 0)) * t;
        /* Primitive parameters, same as the authoring interpolator: a wedge
           sweeps open in the export too. */
        var num = function (key, dflt) {
          var av = a[key] == null ? dflt : a[key], bv = b[key] == null ? dflt : b[key];
          return av + (bv - av) * t;
        };
        o.cornerRadius = num("cornerRadius", 0);
        o.ovalStart = num("ovalStart", 0);
        o.ovalEnd = num("ovalEnd", 360);
        o.ovalInner = num("ovalInner", 0);
        if (Flashy.Filters) {
          o.filters = Flashy.Filters.lerpFilters(a.filters, b.filters, t);
          o.colorEffect = Flashy.Filters.lerpColorEffect(a.colorEffect, b.colorEffect, t);
        }
        var aa = a.alpha != null ? a.alpha : 1, ba = b.alpha != null ? b.alpha : 1;
        o.alpha = aa + (ba - aa) * t;
        /* A motion guide: the object's CENTRE rides the path instead of the
           straight line between its keyframes, and `orientToPath` turns it to
           face along the path as well. */
        var g = guideFor[la.name];
        if (g && Flashy.MotionGuide) {
          var gp = Flashy.MotionGuide.sampleAt(g.points, t, g.arc);
          if (gp) {
            o.x = gp.x - (o.width || 0) / 2;
            o.y = gp.y - (o.height || 0) / 2;
            if (kf.orientToPath) o.rotation = gp.angle;
          }
        }
        o.__tween = true;              // the timeline is driving this one
      }
      out.push(o);
    }
    return out;
  }

  /** Build one run of layers into `host`, bottom layer first. */
  function buildLayerRun(host, layers, fr, groupIndex) {
    for (var li = layers.length - 1; li >= 0; li--) {
      var la = layers[li];
      var kf = activeKeyframe(la, fr);
      if (!kf) continue;
      /* Stable identity for stateful instances — a MovieClip keeps its own
         playhead, a Button its hover, and a scripted object whatever its
         handlers did to it — across the root's per-frame rebuild. */
      addPlanned(host, layerObjects(la, fr), 0, fr, kf.index,
        groupIndex + ":" + li + ":" + kf.index);
    }
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

  /* ---- symbol linkage -------------------------------------------- *
   * Symbols marked "export for ActionScript" are registered under their
   * identifier so a script can create one that is nowhere on any timeline —
   * a bullet, a particle, a row of a list. Without this, everything that
   * appears has to have been placed by hand first, which rules out anything
   * generated, and `attachMovie` was a stub that logged a warning.
   * ---------------------------------------------------------------- */
  var linkage = {};
  Object.keys(data.library || {}).forEach(function (sn) {
    var sym = data.library[sn];
    if (sym && sym.exportForAS && sym.linkageName) linkage[sym.linkageName] = sn;
  });
  stage.linkage = linkage;
  /**
   * Flash's attachMovie: build an instance of a linked symbol and add it.
   *
   * Returns the new clip, or null when the identifier is not registered —
   * null rather than throwing, because a movie that spawns a missing symbol
   * should carry on without it rather than stop dead.
   */
  stage.attachSymbol = function (linkName, instanceName, depth, parent) {
    var symbolName = linkage[linkName];
    var sym = symbolName && data.library[symbolName];
    if (!sym) {
      Flashy.Output.write('attachMovie: no symbol exported as "' + linkName + '"');
      return null;
    }
    var host = parent || root;
    var clip = buildMovieClip(sym, { width: 0, height: 0 }, 0);
    if (instanceName) {
      clip.name = instanceName;
      host[instanceName] = clip;
    }
    if (depth != null && host.addChildAt) {
      host.addChildAt(clip, Math.max(0, Math.min(depth | 0, host.numChildren)));
    } else {
      host.addChild(clip);
    }
    /* Marked so the root's display-list rebuild leaves it alone: the rebuild
       clears every child each tick, and a clip a script created is not in the
       document for it to put back. */
    clip.__attached = true;
    return clip;
  };
  return stage;
}

/* ================================================================== *
 * Publish Settings, and the Size Report
 *
 * Publishing was six separate menu items, each with its own hard-coded
 * choices and none of them remembered. Export the same movie twice and you
 * made the same decisions twice; a project with a fixed set of outputs had no
 * way to say so.
 *
 * And there was no way at all to see what made a movie heavy. A 3MB export is
 * almost always one photograph or one music track, and without a breakdown the
 * only way to find it is to delete things until the number moves.
 * ================================================================== */

/** The publish settings, with the defaults the separate commands used. */
function docPublish(){
  if(!doc.publish)doc.publish={};
  var p=doc.publish;
  if(!p.targets){
    p.targets={html:true,sprite:false,video:false,svg:false,module:false,swf:false};
  }
  if(p.targets.swf==null)p.targets.swf=false;
  if(p.title==null)p.title="Flashy Animation";
  if(p.loop==null)p.loop=true;
  if(p.showAll==null)p.showAll=true;        // hidden layers publish, as in Flash
  if(p.scaleMode==null)p.scaleMode="movie"; // movie | fit | fill | percent
  if(p.scalePercent==null)p.scalePercent=100;
  if(p.background==null)p.background="";    // "" = the document's own colour
  if(p.spriteColumns==null)p.spriteColumns=8;
  if(p.videoFps==null)p.videoFps=doc.fps||24;
  return p;
}

var PUBLISH_TARGETS=[
  ["html","HTML page","export"],
  ["sprite","Sprite sheet","exportGIF"],
  ["video","Video (WebM/MP4)","exportMP4"],
  ["svg","SVG (current frame)","exportSVG"],
  ["module","JS module","exportModule"],
  ["swf","SWF (Flash movie)","exportSWF"]
];

function showPublishSettingsDialog(){
  var p=docPublish();
  showDialog({
    title:"Publish Settings",
    message:"What this document publishes, remembered with it. Publish (Ctrl+F12) "+
            "produces everything ticked here in one go.",
    fields:[
      {name:"html",label:"HTML page",type:"checkbox",value:!!p.targets.html},
      {name:"sprite",label:"Sprite sheet",type:"checkbox",value:!!p.targets.sprite},
      {name:"video",label:"Video (WebM/MP4)",type:"checkbox",value:!!p.targets.video},
      {name:"svg",label:"SVG (current frame)",type:"checkbox",value:!!p.targets.svg},
      {name:"module",label:"JS module",type:"checkbox",value:!!p.targets.module},
      {name:"swf",label:"SWF (Flash movie)",type:"checkbox",value:!!p.targets.swf},
      {name:"title",label:"Page title",value:p.title},
      {name:"loop",label:"Loop playback",type:"checkbox",value:!!p.loop},
      {name:"scaleMode",label:"Scale",type:"select",value:p.scaleMode,
       options:[["movie","Match movie size"],["fit","Fit in window"],
                ["fill","Fill window"],["percent","Percent"]]},
      {name:"scalePercent",label:"Percent",type:"number",value:p.scalePercent,
       min:10,max:400},
      {name:"background",label:"Page background",value:p.background,
       placeholder:"blank = the document's own colour"},
      // "Sheet columns", not "Sprite sheet columns": a label that contains
      // another control's label is ambiguous to read and to target.
      {name:"spriteColumns",label:"Sheet columns",type:"number",
       value:p.spriteColumns,min:1,max:32},
      {name:"videoFps",label:"Video fps",type:"number",value:p.videoFps,min:1,max:60}
    ],
    footnote:"Hidden layers are published, as they are in Flash: the eye is "+
             "about what you can see while working.",
    onOk:function(v){
      pushUndo();
      p.targets={
        html:!!v.html,sprite:!!v.sprite,video:!!v.video,
        svg:!!v.svg,module:!!v.module,swf:!!v.swf
      };
      p.title=String(v.title||"Flashy Animation");
      p.loop=!!v.loop;
      p.scaleMode=v.scaleMode;
      p.scalePercent=Math.max(10,Math.min(400,parseInt(v.scalePercent,10)||100));
      p.background=String(v.background||"").trim();
      p.spriteColumns=Math.max(1,Math.min(32,parseInt(v.spriteColumns,10)||8));
      p.videoFps=Math.max(1,Math.min(60,parseInt(v.videoFps,10)||24));
      touchDoc();
      outputLog("Publish settings saved.");
    }
  });
}

/**
 * Run every ticked target.
 *
 * In sequence rather than all at once: each one ends in a browser download,
 * and firing five at the same instant is how a browser decides to block four
 * of them.
 */
function publishAll(){
  var p=docPublish();
  var queue=PUBLISH_TARGETS.filter(function(t){return p.targets[t[0]];});
  if(!queue.length){
    showMessage("Publish",
      "Nothing is ticked in Publish Settings, so there is nothing to produce.");
    return {ok:false,count:0};
  }
  var i=0;
  var step=function(){
    if(i>=queue.length){
      outputLog("Published "+queue.length+" file"+(queue.length===1?"":"s")+".");
      return;
    }
    var t=queue[i++];
    doAction(t[2]);
    // A gap between downloads, for the reason above.
    setTimeout(step,400);
  };
  step();
  return {ok:true,count:queue.length};
}

/* ------------------------------------------------------------------ *
 * The Size Report
 *
 * What makes the movie heavy, by asset and by frame. A 3MB export is almost
 * always one photograph or one music track, and without a breakdown the only
 * way to find it is to delete things until the number moves.
 * ------------------------------------------------------------------ */

/** Bytes a base64 payload decodes to. */
function base64Bytes(data){
  if(!data)return 0;
  var s=String(data);
  var pad=(s.charAt(s.length-1)==="=")?((s.charAt(s.length-2)==="=")?2:1):0;
  return Math.max(0,Math.floor(s.length*3/4)-pad);
}

function formatBytes(n){
  if(n<1024)return n+" B";
  if(n<1024*1024)return (n/1024).toFixed(1)+" KB";
  return (n/(1024*1024)).toFixed(2)+" MB";
}

/**
 * A breakdown of what the published movie weighs.
 *
 * Measured from the EXPORT document, not the editing one: guides, scene
 * structure and undo history are not published, and reporting them would
 * mislead about what a viewer downloads.
 */
function sizeReport(){
  var data=exportDocData();
  var sounds=[],bitmaps=[];
  Object.keys(data.sounds||{}).forEach(function(n){
    sounds.push({name:n,bytes:base64Bytes(data.sounds[n].data),
                 duration:data.sounds[n].duration||0});
  });
  Object.keys(data.bitmaps||{}).forEach(function(n){
    var b=data.bitmaps[n];
    bitmaps.push({name:n,bytes:base64Bytes(b.data),
                  size:(b.width||0)+"×"+(b.height||0)});
  });
  sounds.sort(function(a,b){return b.bytes-a.bytes;});
  bitmaps.sort(function(a,b){return b.bytes-a.bytes;});

  // The document without its assets: the vectors, the timeline, the scripts.
  var stripped=JSON.parse(JSON.stringify(data));
  stripped.sounds={};stripped.bitmaps={};
  var vectorBytes=JSON.stringify(stripped).length;

  var soundBytes=sounds.reduce(function(a,s){return a+s.bytes;},0);
  var bitmapBytes=bitmaps.reduce(function(a,b){return a+b.bytes;},0);

  /* Per frame, so a heavy stretch can be found. Objects are counted through
     the real interpolator, which is what the player actually builds. */
  var frames=[];
  var total=data.totalFrames||1;
  var layers=reviveLayers(data.layers);
  for(var f=1;f<=total;f++){
    var objs=frameObjects(layers,f);
    var nodes=0;
    var count=function(list){
      (list||[]).forEach(function(o){
        nodes++;
        if(o.children)count(o.children);
      });
    };
    count(objs);
    frames.push({frame:f,objects:objs.length,nodes:nodes});
  }
  var heaviest=frames.slice().sort(function(a,b){return b.nodes-a.nodes;})[0]||
    {frame:1,objects:0,nodes:0};

  return {
    vectorBytes:vectorBytes,
    soundBytes:soundBytes,
    bitmapBytes:bitmapBytes,
    totalBytes:vectorBytes+soundBytes+bitmapBytes,
    sounds:sounds,bitmaps:bitmaps,
    frames:frames,heaviest:heaviest,
    fps:data.fps||24,totalFrames:total
  };
}

/** How long the movie takes to arrive, at the speeds people actually have. */
var BANDWIDTHS=[
  ["3G",400*1024/8],
  ["4G",12*1024*1024/8],
  ["Broadband",25*1024*1024/8]
];

function showSizeReportDialog(){
  var r=sizeReport();
  showDialog({
    title:"Size Report",
    message:"What the published movie weighs. Measured from the EXPORT "+
            "document, so guides, scene structure and undo history are not in "+
            "it — they are not published either.",
    build:function(body){
      var table=document.createElement("div");
      table.className="size-report";

      var section=function(label){
        var h=document.createElement("div");
        h.className="size-head";
        h.textContent=label;
        table.appendChild(h);
      };
      var line=function(label,value,share){
        var row=document.createElement("div");
        row.className="size-row";
        var l=document.createElement("span");
        l.className="size-label";l.textContent=label;
        var v=document.createElement("span");
        v.className="size-value";v.textContent=value;
        row.appendChild(l);
        if(share!=null){
          var barWrap=document.createElement("span");
          barWrap.className="size-bar";
          var bar=document.createElement("span");
          bar.style.width=Math.max(1,Math.round(share*100))+"%";
          barWrap.appendChild(bar);
          row.appendChild(barWrap);
        }
        row.appendChild(v);
        table.appendChild(row);
      };

      var total=Math.max(1,r.totalBytes);
      section("Total — "+formatBytes(r.totalBytes));
      line("Vectors, timeline and scripts",formatBytes(r.vectorBytes),
           r.vectorBytes/total);
      line("Sounds",formatBytes(r.soundBytes),r.soundBytes/total);
      line("Bitmaps",formatBytes(r.bitmapBytes),r.bitmapBytes/total);

      if(r.sounds.length){
        section("Sounds, heaviest first");
        r.sounds.forEach(function(s){
          line(s.name+(s.duration?("  "+s.duration.toFixed(1)+"s"):""),
               formatBytes(s.bytes),s.bytes/total);
        });
      }
      if(r.bitmaps.length){
        section("Bitmaps, heaviest first");
        r.bitmaps.forEach(function(b){
          line(b.name+"  "+b.size,formatBytes(b.bytes),b.bytes/total);
        });
      }

      section("Download time");
      BANDWIDTHS.forEach(function(b){
        var secs=r.totalBytes/b[1];
        line(b[0],secs<1?"under a second":(secs.toFixed(1)+" s"));
      });

      section("Frames");
      line("Length",r.totalFrames+" frames at "+r.fps+" fps  ("+
           (r.totalFrames/r.fps).toFixed(1)+"s)");
      line("Busiest frame","frame "+r.heaviest.frame+" — "+
           r.heaviest.nodes+" object"+(r.heaviest.nodes===1?"":"s"));

      body.appendChild(table);

      var note=document.createElement("div");
      note.className="fy-dialog-hint";
      note.textContent=r.bitmapBytes>r.vectorBytes*4
        ? "Bitmaps are most of this file. Trace Bitmap turns one into vectors, "+
          "which is usually far smaller — and scales."
        : (r.soundBytes>r.totalBytes*0.6
          ? "Audio is most of this file. A shorter or more compressed track is "+
            "the single biggest saving available."
          : "Nothing here dominates; the weight is spread across the movie.");
      body.appendChild(note);
    },
    okLabel:"Close",
    onOk:function(){}
  });
}

function genHTML(callback){
  getEngineSource(function(engineSrc){
    // The whole movie, scenes laid end to end — not just the one on screen.
    var d=exportDocData();
    getAS2Source(docHasClipScripts(d),function(as2Src){
    if(as2Src)engineSrc=engineSrc+"\n"+as2Src;
    var sc="<"+"script>",sce="</"+"script>";
    var s="<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n";
    /* The publish settings, where they land in the output: the page title, its
       background, how the canvas is scaled and whether the movie loops. Six
       separate export commands each had these hard-coded, and none of them
       remembered a choice. */
    var pub=docPublish();
    s+="<title>"+xmlText(pub.title||"Flashy Animation")+"</title>\n";
    s+="<style>\n";
    s+="*{margin:0;padding:0;box-sizing:border-box;}\n";
    s+="body{background:"+(pub.background||"#111")+
       ";display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}\n";
    /* Scale. "Match movie" is the historic behaviour and stays the default;
       Fit keeps the aspect ratio inside the window, Fill crops to cover it,
       and Percent is a flat multiplier. All of it in CSS, so the canvas keeps
       its own pixel size and the drawing stays sharp. */
    if(pub.scaleMode==="fit"){
      s+="canvas{display:block;max-width:100vw;max-height:100vh;object-fit:contain;}\n";
    }else if(pub.scaleMode==="fill"){
      s+="canvas{display:block;width:100vw;height:100vh;object-fit:cover;}\n";
    }else if(pub.scaleMode==="percent"){
      var pc=Math.max(10,Math.min(400,pub.scalePercent||100))/100;
      s+="canvas{display:block;width:"+Math.round(doc.width*pc)+"px;height:"+
         Math.round(doc.height*pc)+"px;}\n";
    }else{
      s+="canvas{display:block;}\n";
    }
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
      s+="window.__stage = __run(__data, __canvas, {autoplay:false, loop:"+
         (pub.loop?"true":"false")+"});\n";
      s+="__gate.addEventListener('click', function(){\n";
      s+="  __gate.remove();\n";
      s+="  Promise.resolve(Flashy.Sound.unlock()).then(function(){ window.__stage.start(); });\n";
      s+="});\n";
    }else{
      s+="window.__stage = __run(__data, __canvas, {loop:"+
         (pub.loop?"true":"false")+"});\n";
    }
    s+=sce+"\n</body>\n</html>";
    callback(s);
    });
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
  withAllLayers(function () {
    // flattenScenes() returns the current scene's output layers untouched when
    // there is only one, so nothing about the common case changes.
    frameObjects(flattenScenes(), frameNum).forEach(function (o) {
      paintObj(cx, o, { chrome: false });
    });
  });
  return c;
}
/**
 * Longest frame in the MOVIE — what the raster/video exporters cover.
 *
 * With several scenes that is the sum of their lengths, because an export is
 * one timeline; with one it is that scene's own length, exactly as before.
 */
function sceneMaxFrame() {
  var scenes = docScenes();
  if (scenes.length > 1) return moviesTotalFrames();
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
  // An export, so the eyes do not apply — see layerShows().
  var items = withAllLayers(soundItems);
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
  /* Mask layers become clipPaths. The mask's own objects are emitted inside
     one — their fills and strokes are ignored there, only the silhouette
     counts — and the layers it masks are wrapped in a group that references
     it, which is the same picture the stage and the HTML export draw. */
  var svgGroups = maskGroups(flattenScenes());
  // Hidden layers are in the output here too, as they are in every export.
  withAllLayers(function () {
    for (var gi = svgGroups.length - 1; gi >= 0; gi--) {
      var group = svgGroups[gi];
      if (!group.layers.length) continue;
      var objects = frameObjects(group.layers, frame);
      if (!group.mask) {
        objects.forEach(function (o) { s += _objToSVG(o, 0); });
        continue;
      }
      var maskObjects = frameObjects([group.mask], frame);
      if (!maskObjects.length) continue;
      var clipId = "fy-mask-" + gi;
      s += '<clipPath id="' + clipId + '">';
      maskObjects.forEach(function (o) { s += _objToSVG(o, 0); });
      s += '</clipPath>\n';
      s += '<g clip-path="url(#' + clipId + ')">\n';
      objects.forEach(function (o) { s += _objToSVG(o, 0); });
      s += '</g>\n';
    }
  });
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

/* A gradient as SVG defs, in objectBoundingBox units — which is the unit the
   document already stores, so nothing has to be converted. Returns
   `{defs, ref}`, or null when the object has no gradient. */
var _svgGradSeq = 0;
function _svgGradient(o) {
  var t = o.fillType;
  if ((t !== "linear" && t !== "radial") || !o.fillStops || o.fillStops.length < 3) return null;
  var g = o.fillGrad && o.fillGrad.length >= 4 ? o.fillGrad : [0, 0, 1, 0];
  var id = "fy-grad-" + (++_svgGradSeq);
  var stops = "";
  var mul = o.fillAlpha != null ? o.fillAlpha : 1;
  for (var i = 0; i + 2 < o.fillStops.length; i += 3) {
    var c = o.fillStops[i + 1] | 0;
    var hexc = "#" + ("000000" + (c & 0xffffff).toString(16)).slice(-6);
    var a = (o.fillStops[i + 2] == null ? 1 : o.fillStops[i + 2]) * mul;
    stops += '<stop offset="' + Math.max(0, Math.min(1, o.fillStops[i])) +
             '" stop-color="' + hexc + '" stop-opacity="' + a + '"/>';
  }
  var body;
  if (t === "radial") {
    var r = Math.hypot(g[2] - g[0], g[3] - g[1]) || 0.5;
    body = '<radialGradient id="' + id + '" cx="' + g[0] + '" cy="' + g[1] +
           '" r="' + r + '">' + stops + '</radialGradient>';
  } else {
    body = '<linearGradient id="' + id + '" x1="' + g[0] + '" y1="' + g[1] +
           '" x2="' + g[2] + '" y2="' + g[3] + '">' + stops + '</linearGradient>';
  }
  return { defs: '<defs>' + body + '</defs>', ref: 'url(#' + id + ')' };
}

/* ------------------------------------------------------------------ *
 * Filters in the SVG export
 *
 * SVG can express the whole stack exactly — more exactly than the canvas path
 * can, in fact: `feGaussianBlur` takes separate x and y deviations, so an
 * anisotropic blur that the canvas `filter` property has to average survives
 * here intact.
 *
 * Order matches the canvas path: the colour transform runs first (it is a
 * per-pixel recolour of the artwork), then the geometric filters, so a glow
 * takes its colour from the recoloured shape and not the original.
 * ------------------------------------------------------------------ */
var _svgFilterSeq = 0;
function _svgFilterFor(o) {
  if (!objHasEffects(o)) return null;
  var id = "fy-fx-" + (++_svgFilterSeq);
  var body = "";
  var src = "SourceGraphic";
  var hexOf = function (c, dflt) {
    var n = c == null ? dflt : c;
    if (typeof n === "string") return n;
    return "#" + ("000000" + ((n | 0) & 0xffffff).toString(16)).slice(-6);
  };

  var ct = colorTransformOf(o);
  if (ct && window.Flashy && Flashy.Filters.hasColor(ct)) {
    // A per-channel multiply + offset is exactly feComponentTransfer's linear
    // function, with the multiply as the slope and the offset as the
    // intercept. SVG's intercept is 0..1, so a 0..255 offset is scaled.
    var fn = function (tag, mul, off) {
      return '<' + tag + ' type="linear" slope="' + mul +
             '" intercept="' + (off / 255) + '"/>';
    };
    body += '<feComponentTransfer in="' + src + '" result="fyct">' +
            fn("feFuncR", ct.rMul, ct.rOff) +
            fn("feFuncG", ct.gMul, ct.gOff) +
            fn("feFuncB", ct.bMul, ct.bOff) +
            fn("feFuncA", ct.aMul, ct.aOff) +
            '</feComponentTransfer>';
    src = "fyct";
  }

  var step = 0;
  (o.filters || []).forEach(function (f) {
    if (!f || f.enabled === false) return;
    var out = "fyf" + (++step);
    if (f.type === "blur") {
      body += '<feGaussianBlur in="' + src + '" stdDeviation="' +
              (Math.abs(f.blurX == null ? 4 : f.blurX) / 2) + ' ' +
              (Math.abs(f.blurY == null ? 4 : f.blurY) / 2) +
              '" result="' + out + '"/>';
      src = out;
    } else if (f.type === "dropShadow" || f.type === "glow" || f.type === "bevel") {
      var d = f.type === "glow" ? 0 : (f.distance == null ? 4 : f.distance);
      var ang = ((f.angle == null ? 45 : f.angle) * Math.PI) / 180;
      var bl = Math.abs((f.blur == null ? (f.type === "glow" ? 6 : 4) : f.blur)) / 2;
      var col = f.type === "glow" ? hexOf(f.color, 0xff0000)
              : f.type === "bevel" ? hexOf(f.shadowColor, 0x000000)
              : hexOf(f.color, 0x000000);
      var al = f.alpha == null ? (f.type === "glow" ? 1 : 0.6) : f.alpha;
      var reps = f.type === "glow"
        ? Math.max(1, Math.min(4, Math.round(f.strength == null ? 2 : f.strength))) : 1;
      for (var r = 0; r < reps; r++) {
        var o2 = out + "_" + r;
        body += '<feDropShadow in="' + src + '" dx="' + (Math.cos(ang) * d) +
                '" dy="' + (Math.sin(ang) * d) + '" stdDeviation="' + bl +
                '" flood-color="' + xmlAttr(col) + '" flood-opacity="' + al +
                '" result="' + o2 + '"/>';
        src = o2;
      }
      if (f.type === "bevel") {
        // The highlight, on the opposite side — the second of the two offset
        // shadows Flash's bevel came down to.
        var hi = out + "_hi";
        body += '<feDropShadow in="' + src + '" dx="' + (-Math.cos(ang) * d) +
                '" dy="' + (-Math.sin(ang) * d) + '" stdDeviation="' + bl +
                '" flood-color="' + xmlAttr(hexOf(f.highlightColor, 0xffffff)) +
                '" flood-opacity="0.6" result="' + hi + '"/>';
        src = hi;
      }
    } else if (f.type === "gradientGlow" || f.type === "gradientBevel") {
      /* A halo whose colour is a RAMP. No filter primitive maps alpha to a
         colour directly, but three in a row do: blur the silhouette, copy the
         blurred ALPHA into R, G and B with a colour matrix, then run each
         channel through its own table. The tables come from
         Flashy.Filters.rampTable, so the SVG and the canvas read the same
         ramp rather than two approximations of it. */
      var gbl = Math.abs(f.blur == null ? 8 : f.blur) / 2;
      var gang = ((f.angle == null ? 45 : f.angle) * Math.PI) / 180;
      var gd = f.type === "gradientBevel" ? (f.distance == null ? 4 : f.distance) : 0;
      var tbl = Flashy.Filters.rampTable(f, 17);
      var tv = function (tag, arr) {
        return '<' + tag + ' type="table" tableValues="' + arr.join(" ") + '"/>';
      };
      body += '<feGaussianBlur in="SourceAlpha" stdDeviation="' + gbl +
              '" result="' + out + 'b"/>';
      if (gd) {
        /* A bevel is the silhouette offset both ways along the light angle.
           Two offsets and a merge, so the overlap in the middle lands on the
           ramp's transparent centre and the edge reads as an edge. */
        body += '<feOffset in="' + out + 'b" dx="' + (Math.cos(gang) * gd) +
                '" dy="' + (Math.sin(gang) * gd) + '" result="' + out + 'o1"/>';
        body += '<feOffset in="' + out + 'b" dx="' + (-Math.cos(gang) * gd) +
                '" dy="' + (-Math.sin(gang) * gd) + '" result="' + out + 'o2"/>';
        body += '<feMerge result="' + out + 'm"><feMergeNode in="' + out +
                'o1"/><feMergeNode in="' + out + 'o2"/></feMerge>';
      }
      // Alpha into every colour channel, so each table sees it as its input.
      body += '<feColorMatrix in="' + out + (gd ? 'm' : 'b') +
              '" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 1 0" result="' +
              out + 'a"/>';
      var gstr = Math.max(0, Math.min(4, f.strength == null ? 1 : f.strength));
      body += '<feComponentTransfer in="' + out + 'a" result="' + out + 'c">' +
              tv("feFuncR", tbl.r) + tv("feFuncG", tbl.g) + tv("feFuncB", tbl.b) +
              tv("feFuncA", tbl.a.map(function (v) {
                return +Math.min(1, v * gstr).toFixed(4);
              })) +
              '</feComponentTransfer>';
      // The halo goes UNDER the artwork, which is what makes it a glow.
      body += '<feMerge result="' + out + '"><feMergeNode in="' + out +
              'c"/><feMergeNode in="' + src + '"/></feMerge>';
      src = out;
    } else if (f.type === "adjustColor") {
      var sa = 1 + (f.saturation || 0) / 100;
      var hu = f.hue || 0;
      var br = 1 + (f.brightness || 0) / 100;
      var co = (f.contrast || 0) / 100;
      if (sa !== 1) {
        body += '<feColorMatrix in="' + src + '" type="saturate" values="' +
                sa + '" result="' + out + 's"/>';
        src = out + "s";
      }
      if (hu) {
        body += '<feColorMatrix in="' + src + '" type="hueRotate" values="' +
                hu + '" result="' + out + 'h"/>';
        src = out + "h";
      }
      if (br !== 1 || co) {
        // Contrast about the midpoint, as CSS defines it, so the two paths
        // agree: slope = 1 + c, intercept = -c/2.
        var slope = br * (1 + co), inter = -co / 2;
        var lin = function (tag) {
          return '<' + tag + ' type="linear" slope="' + slope +
                 '" intercept="' + inter + '"/>';
        };
        body += '<feComponentTransfer in="' + src + '" result="' + out + 'b">' +
                lin("feFuncR") + lin("feFuncG") + lin("feFuncB") +
                '</feComponentTransfer>';
        src = out + "b";
      }
    }
  });

  if (!body) return null;
  // Filters reach outside the box, so the region has to be enlarged or a glow
  // is clipped to the shape's own bounds and reads as a hard edge.
  var pad = Flashy.Filters ? Flashy.Filters.extent(o.filters) : 0;
  var ext = Math.max(20, pad * 2 + 20);
  var w = Math.abs(o.width || 1) || 1, h = Math.abs(o.height || 1) || 1;
  var fx = -(ext / w), fy = -(ext / h);
  return {
    defs: '<defs><filter id="' + id + '" x="' + fx + '" y="' + fy +
          '" width="' + (1 - 2 * fx) + '" height="' + (1 - 2 * fy) +
          '" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">' +
          body + '</filter></defs>',
    ref: 'url(#' + id + ')'
  };
}

/**
 * A 9-sliced symbol instance, as nine clipped groups.
 *
 * One `<clipPath>` and one `<g>` per cell, with the cell's own scale — the
 * same nine rectangles Flashy.Slice9 hands the canvas painter and the engine,
 * so all three agree to the pixel.
 */
var _svgSliceSeq = 0;
function _symbolSlicedSVG(o, sym, depth) {
  var natW = Math.abs(o.width) || 1, natH = Math.abs(o.height) || 1;
  var sx = o.scaleX || 1, sy = o.scaleY || 1;
  var dstW = natW * Math.abs(sx), dstH = natH * Math.abs(sy);
  var kids = symbolFrameObjects(sym,
    symbolDisplayFrame(o, sym, o._parentFrame || 1, o._startFrame || 1));
  if (!kids.length) return '';
  var content = '';
  for (var k = 0; k < kids.length; k++) content += _objToSVG(kids[k], depth + 1);

  // Outer transform: everything except the magnitude of the scale, which the
  // cells carry.
  var tf = 'translate(' + ((o.x || 0) + natW / 2) + ',' + ((o.y || 0) + natH / 2) + ')';
  if (o.rotation) tf += ' rotate(' + o.rotation + ')';
  if (o.skewX || o.skewY) {
    tf += ' matrix(1,' + Math.tan((o.skewY || 0) * Math.PI / 180) + ',' +
          Math.tan((o.skewX || 0) * Math.PI / 180) + ',1,0,0)';
  }
  if (sx < 0 || sy < 0) tf += ' scale(' + (sx < 0 ? -1 : 1) + ',' + (sy < 0 ? -1 : 1) + ')';
  tf += ' translate(' + (-dstW / 2) + ',' + (-dstH / 2) + ')';

  var out = '<g transform="' + xmlAttr(tf) + '"' +
            (o.alpha != null && o.alpha < 1 ? ' opacity="' + o.alpha + '"' : '') + '>\n';
  var cells = Flashy.Slice9.cells(sym.scale9, natW, natH, dstW, dstH);
  var seq = ++_svgSliceSeq;
  for (var i = 0; i < cells.length; i++) {
    var c = cells[i];
    var id = 'fy-s9-' + seq + '-' + i;
    out += '<clipPath id="' + id + '"><rect x="' + c.dx + '" y="' + c.dy +
           '" width="' + c.dw + '" height="' + c.dh + '"/></clipPath>';
    out += '<g clip-path="url(#' + id + ')"><g transform="translate(' + c.dx + ',' + c.dy +
           ') scale(' + (c.dw / c.sw) + ',' + (c.dh / c.sh) + ') translate(' +
           (-c.sx) + ',' + (-c.sy) + ')">\n' + content + '</g></g>\n';
  }
  return out + '</g>\n';
}

/** _objToSVGRaw, wrapped in this object's filter group. Mirrors paintObj. */
function _objToSVG(o, depth) {
  var fx = _svgFilterFor(o);
  if (!fx) return _objToSVGRaw(o, depth);
  return fx.defs + '<g filter="' + fx.ref + '">' +
         _objToSVGRaw(o, depth) + '</g>\n';
}

function _objToSVGRaw(o, depth) {
  depth = depth || 0;
  var hw = (o.width||0)/2, hh = (o.height||0)/2;
  // Same centre-origin convention as the stage and the canvas painter: move to
  // the object's centre, rotate/scale there, then draw around (0,0).
  var tf = 'translate('+((o.x||0)+hw)+','+((o.y||0)+hh)+')';
  if (o.rotation) tf += ' rotate('+o.rotation+')';
  // Skew as an explicit matrix rather than SVG's skewX/skewY, because the two
  // of them compose in sequence and the canvas painter applies ONE combined
  // shear. Keeping the matrix identical keeps the SVG identical to the stage.
  if (o.skewX||o.skewY) {
    tf += ' matrix(1,'+Math.tan((o.skewY||0)*Math.PI/180)+','+
          Math.tan((o.skewX||0)*Math.PI/180)+',1,0,0)';
  }
  if ((o.scaleX!=null&&o.scaleX!==1)||(o.scaleY!=null&&o.scaleY!==1)) {
    tf += ' scale('+(o.scaleX||1)+','+(o.scaleY||1)+')';
  }
  var a = ' transform="'+xmlAttr(tf)+'"';
  if (o.alpha!=null&&o.alpha<1) a += ' opacity="'+o.alpha+'"';
  var grad = _svgGradient(o);
  var fl = (o.fillType||"solid")==="none" ? "none"
         : grad ? grad.ref : xmlAttr(o.fillColor||"#000");
  var gdefs = grad ? grad.defs : "";
  var st = (!o.strokeWidth||(o.strokeStyle||"solid")==="none") ? "none" : xmlAttr(o.strokeColor||"#000");
  var sw = o.strokeWidth||0;
  /* A parameterised primitive — a rounded rectangle, or an oval arc, pie or
     donut — emits its own outline from the same geometry the painter uses, so
     the SVG and the stage cannot disagree about the shape. */
  if (window.Flashy && Flashy.Primitives && Flashy.Primitives.active(o) && window.FlashyTrace) {
    var prim = Flashy.Primitives.path(o);
    if (prim) {
      var pd = FlashyTrace.pathToSVG(FlashyTrace.pathTransform(prim, 1, 1, -hw, -hh));
      // Even-odd, so a donut's inner loop is a hole rather than a second ring.
      return gdefs + '<path' + a + ' d="' + pd + '" fill="' + fl +
             '" fill-rule="evenodd" stroke="' + st + '" stroke-width="' + sw + '"/>\n';
    }
  }
  switch (o.type) {
    case "rect":
      return gdefs+'<rect'+a+' x="'+(-hw)+'" y="'+(-hh)+'" width="'+Math.abs(o.width)+'" height="'+Math.abs(o.height)+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "oval":
      return gdefs+'<ellipse'+a+' cx="0" cy="0" rx="'+Math.abs(hw)+'" ry="'+Math.abs(hh)+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
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
      return gdefs+'<path'+a+' d="'+pd+'" fill="'+fl+'" fill-rule="evenodd" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
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
      /* The lines the engine's own field would draw, so wrapping and
         password masking reach the SVG rather than being a canvas-only
         effect. No `chrome`, so an empty field exports empty instead of
         shipping the word "Text". */
      var lines;
      if (window.Flashy && Flashy.TextField && Flashy.TextField.fromObject) {
        var svgTf = Flashy.TextField.fromObject(o, {});
        var meas = document.createElement("canvas").getContext("2d");
        meas.font = svgTf.font;
        lines = svgTf.lines(meas);
      } else {
        lines = String(o.text == null ? "" : o.text).split("\n");
      }
      var lh = (o.lineHeight||1.2)*size;
      var out = '<text'+a+' font-size="'+size+'" font-family="'+xmlAttr(o.font||"Arial")+'"'+
        (o.fontBold?' font-weight="bold"':'')+(o.fontItalic?' font-style="italic"':'')+
        (o.fontUnderline?' text-decoration="underline"':'')+
        (o.letterSpacing?' letter-spacing="'+o.letterSpacing+'"':'')+
        ' fill="'+fl+'" text-anchor="'+anchor+'" dominant-baseline="hanging">\n';
      for (var li=0;li<lines.length;li++) {
        out += '  <tspan x="'+tx+'" y="'+(-hh+li*lh)+'">'+xmlText(lines[li])+'</tspan>\n';
      }
      out += '</text>\n';
      /* Border and background are what make an input field look like one, so
         they travel into the SVG too. Drawn first, under the text. */
      var tChrome = '';
      if (o.textBackground) {
        tChrome += '<rect x="'+(-hw)+'" y="'+(-hh)+'" width="'+Math.abs(o.width)+
                   '" height="'+Math.abs(o.height)+'" fill="'+
                   xmlAttr(o.textBackgroundColor||'#FFFFFF')+'"/>';
      }
      if (o.textBorder) {
        tChrome += '<rect x="'+(-hw)+'" y="'+(-hh)+'" width="'+Math.abs(o.width)+
                   '" height="'+Math.abs(o.height)+'" fill="none" stroke="'+
                   xmlAttr(o.textBorderColor||'#000000')+'" stroke-width="1"/>';
      }
      return tChrome ? ('<g'+a+'>'+tChrome+'</g>\n'+out) : out;
    case "group":
      // Same shape as the symbol case below: a transform, then children in
      // group space. Without this a grouped drawing vanished from the SVG.
      if (depth >= SYMBOL_MAX_DEPTH) return '';
      var gkids = o.children || [];
      if (!gkids.length) return '';
      var ggw = o.groupW || Math.abs(o.width) || 1, ggh = o.groupH || Math.abs(o.height) || 1;
      var gsx = Math.abs(o.width || ggw) / ggw, gsy = Math.abs(o.height || ggh) / ggh;
      var ginner = 'translate('+(-hw)+','+(-hh)+')';
      if (gsx !== 1 || gsy !== 1) ginner += ' scale('+gsx+','+gsy+')';
      var gout = '<g'+a+'><g transform="'+xmlAttr(ginner)+'">\n';
      for (var gi2 = 0; gi2 < gkids.length; gi2++) gout += _objToSVG(gkids[gi2], depth+1);
      return gout+'</g></g>\n';
    case "symbol":
      // 9-slice first: the instance's scale goes into the cells rather than
      // into the group transform, so it cannot share the branch below.
      var sym9 = doc.library[o.symbolName];
      if (sym9 && window.Flashy && Flashy.Slice9 && Flashy.Slice9.active(sym9.scale9) &&
          (Math.abs(o.scaleX || 1) !== 1 || Math.abs(o.scaleY || 1) !== 1) &&
          depth < SYMBOL_MAX_DEPTH) {
        return _symbolSlicedSVG(o, sym9, depth);
      }
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

/* ------------------------------------------------------------------ *
 * Export as SWF
 *
 * Flashy has read `.swf` and `.fla` since early on and could not write
 * either, which made the import a one-way door: a movie could come in and
 * never go back out.
 *
 * The writer covers shapes, symbols, frames, labels, the stage and the
 * transforms. It cannot cover text, bitmaps, sounds, filters or scripts — each
 * needs a subsystem of its own — so it REPORTS what it left out rather than
 * handing over a file that quietly lost half the movie. The report is the
 * feature: a silent omission in an export is the worst kind.
 * ------------------------------------------------------------------ */
function buildSWF(){
  if(!window.FlashySWFWriter){
    return {ok:false,reason:"module"};
  }
  // The whole movie, scenes laid end to end — the same document every other
  // export path publishes.
  var data=exportDocData();
  var out=FlashySWFWriter.write(data,{});
  return {ok:true,bytes:out.bytes,report:out.report,
          missing:FlashySWFWriter.reportText(out.report)};
}

function exportAsSWF(){
  var r=buildSWF();
  if(!r.ok){
    showMessage("Export as SWF",
      "The SWF writer did not load. Reload the page and try again.");
    return;
  }
  var rep=r.report;
  var write=function(){
    // A Blob rather than a data URI: a SWF is binary, and a megabyte of
    // base64 in a URL is both slower and capped by the browser.
    var blob=new Blob([r.bytes],{type:"application/x-shockwave-flash"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;
    a.download="animation.swf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
    outputLog("Wrote animation.swf — "+rep.shapes+" shape"+(rep.shapes===1?"":"s")+", "+
              rep.sprites+" symbol"+(rep.sprites===1?"":"s")+", "+
              rep.totalFrames+" frame"+(rep.totalFrames===1?"":"s")+", "+
              Math.round(rep.bytes/1024)+" KB.");
  };

  if(r.missing){
    /* Said BEFORE the download, not after: the point of the warning is to
       stop somebody shipping a file they think is complete. */
    showDialog({
      title:"Export as SWF",
      message:"The SWF will contain "+rep.shapes+" shape"+(rep.shapes===1?"":"s")+
              ", "+rep.sprites+" symbol"+(rep.sprites===1?"":"s")+" and "+
              rep.totalFrames+" frame"+(rep.totalFrames===1?"":"s")+".\n\n"+
              "It will NOT contain: "+r.missing+".\n\n"+
              "SWF stores those in formats this writer does not produce — "+
              "glyph tables, JPEG and zlib streams, MP3 frames, filter tags "+
              "and ActionScript bytecode. The HTML export carries all of them.",
      okLabel:"Export anyway",
      onOk:write
    });
    return;
  }
  write();
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
  s += "export const sceneData = " + JSON.stringify(exportDocData(), null, 2) + ";\n\n";
  s += "const createStage = " + exportRuntime.toString() + ";\n\n";
  s += "export function createAnimation(canvas, options) {\n";
  s += "  if (typeof Flashy === 'undefined') throw new Error('flashy.js must be loaded first');\n";
  s += "  return createStage(sceneData, canvas, options);\n";
  s += "}\n";
  dlFile(s, "animation.js", "application/javascript");
}

/* ------------------------------------------------------------------ *
 * Flash import (.swf / .fla / XFL folder)
 *
 * The reading is all in `flashy-swf.js`, `flashy-fla.js`, `flashy-avm1.js`
 * and `flashy-import.js` — none of which know this editor exists. What is
 * here is the seam: pick a file, hand it to the right parser, convert the
 * model into a document, replace the open one, and say what came across and
 * what did not.
 *
 * An import REPLACES the document rather than merging into it. A SWF carries
 * its own stage size, frame rate and background, and a 823-frame movie
 * dropped on top of someone's drawing is not a merge anyone wants; the
 * confirmation below is the one guard.
 * ------------------------------------------------------------------ */
var lastFlashReport=null;

/** True for the file types File ▸ Import Flash Movie accepts. */
function isFlashFile(file){
  return !!file&&/\.(swf|fla)$/i.test(file.name||"");
}

/** Parse a .swf or .fla File into the shared Flash document model. */
function parseFlashFile(file){
  var name=(file&&file.name)||"";
  if(/\.fla$/i.test(name)){
    if(!Flashy.FLALoader)return Promise.reject(new Error("This build has no FLA support."));
    return new Flashy.FLALoader().parseFile(file);
  }
  if(!Flashy.SWF)return Promise.reject(new Error("This build has no SWF support."));
  return file.arrayBuffer().then(function(buf){return Flashy.SWF.parse(buf);});
}

/** Replace the open document with an imported one. */
function installImportedDoc(d){
  if(audioTrack)audioTrack.stopAll();
  deserializeDoc(d);
  curFrame=1;curLayer=0;selection=[];
  undoStack=[];redoStack=[];editStack=[];
  // The imported stage is rarely the size of the one that was open.
  centerStage();
  // An import has never been written to disk, so it starts dirty — unlike
  // File ▸ Open, which starts clean.
  touchDoc();
  updateBreadcrumb();fullRefresh();
}

function flashReportText(report){
  var lines=[
    "Stage: "+report.stage,
    "Frames: "+report.frames+"   Layers: "+report.layers+"   Keyframes: "+report.keyframes,
    "Library symbols: "+report.symbols+"   Motion tweens: "+report.tweens,
    "Artwork: "+report.shapes+" shapes, "+report.texts+" text objects, "+
      (report.gradients||0)+" gradients",
    "Sounds: "+report.sounds+"   Bitmaps: "+report.bitmaps
  ];
  /* Where the code went, in as many words. Most of a movie's ActionScript
     usually lives inside its symbols, so a bare count reads as "no code"
     to anyone looking at the main timeline. */
  if(report.scripts){
    lines.push("");
    lines.push("ActionScript: "+report.scripts+" scripts, decompiled onto Actions layers.");
    if(report.scriptsOnStage){
      lines.push("  • "+report.scriptsOnStage+" on the main timeline — the “Actions” layer, "+
        "shown in the Actions panel.");
    }
    if(report.scriptsInSymbols){
      lines.push("  • "+report.scriptsInSymbols+" inside symbols. Double-click a symbol to "+
        "open it; its scripts are on its own Actions layer.");
      var where=(report.scriptLocations||[]).filter(function(l){return l.where!=="Scene";});
      var names=[];
      where.forEach(function(l){if(names.indexOf(l.where)<0&&names.length<5)names.push(l.where);});
      if(names.length)lines.push("    e.g. "+names.join(", "));
    }
  }else{
    lines.push("");
    lines.push("ActionScript: none found"+(report.as3?" that this build can read — the movie "+
      "is ActionScript 3.":"."));
  }
  if(report.warnings&&report.warnings.length){
    lines.push("");
    lines.push("What did not come across:");
    report.warnings.slice(0,8).forEach(function(w){lines.push("  • "+w);});
    if(report.warnings.length>8){
      lines.push("  • …and "+(report.warnings.length-8)+" more.");
    }
  }
  return lines.join("\n");
}

/**
 * Import a Flash file, replacing the open document.
 *
 * Resolves with the report, or null if the user cancelled or it failed —
 * failure is reported in a dialog, not thrown, because every caller here is
 * a menu item or a file drop.
 */
function importFlashFile(file,opts){
  opts=opts||{};
  if(!window.FlashyImport||!Flashy.SWF){
    showMessage("Import Flash","This build has no Flash import support.");
    return Promise.resolve(null);
  }
  if(!isFlashFile(file)){
    showMessage("Import Flash","That is not a .swf or .fla file: "+
      ((file&&file.name)||"(none)"));
    return Promise.resolve(null);
  }
  var go=function(){return runFlashImport(file,opts);};
  if(opts.force||!isDirty())return go();
  return new Promise(function(resolve){
    showDialog({
      title:"Import Flash",
      message:"Importing “"+file.name+"” replaces the document you have open, "+
        "and the current one has unsaved changes.",
      fields:[],
      okLabel:"Import",
      onOk:function(){go().then(resolve);},
      onCancel:function(){resolve(null);}
    });
  });
}

function runFlashImport(file,opts){
  return parseFlashFile(file).then(function(model){
    var result=FlashyImport.toDocument(model,opts.convert||{});
    installImportedDoc(result.doc);
    lastFlashReport=result.report;
    revealImportedScripts(result.report);
    if(opts.quiet!==true){
      showMessage("Imported "+file.name,flashReportText(result.report));
    }
    return result.report;
  })["catch"](function(err){
    showMessage("Import Flash","Could not read "+((file&&file.name)||"the file")+":\n"+
      ((err&&err.message)||err));
    return null;
  });
}

/**
 * Put the cursor on the imported code.
 *
 * The Actions layer is layer 0 and `installImportedDoc` already selects it,
 * but the Actions panel may not be the visible tab in its dock — so an
 * import with a `stop();` on frame 1 can look like an import with no code at
 * all. Bring the panel forward when there is something to see.
 */
function revealImportedScripts(report){
  if(!report||!report.scriptsOnStage)return;
  try{
    if(window._flashyWorkspace&&window._flashyWorkspace.show){
      window._flashyWorkspace.show("actions");
    }
  }catch(e){/* a closed or re-docked panel is not worth failing an import over */}
}

/** An unzipped XFL folder, which is how Animate saves for source control. */
function importXFLDirectory(fileList,opts){
  opts=opts||{};
  if(!window.FlashyImport||!Flashy.FLALoader){
    showMessage("Import Flash","This build has no Flash import support.");
    return Promise.resolve(null);
  }
  return new Flashy.FLALoader().parseDirectory(fileList).then(function(model){
    var result=FlashyImport.toDocument(model,opts.convert||{});
    installImportedDoc(result.doc);
    lastFlashReport=result.report;
    revealImportedScripts(result.report);
    if(opts.quiet!==true)showMessage("Imported XFL folder",flashReportText(result.report));
    return result.report;
  })["catch"](function(err){
    showMessage("Import Flash","Could not read that folder:\n"+((err&&err.message)||err));
    return null;
  });
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

/**
 * Test Movie: play the document as it stands, in a window of its own.
 *
 * This used to generate the whole HTML export, turn it into a blob and open
 * that. For anything hand-drawn it is instant; for an imported Flash movie
 * it is not — serialising a 75MB document into one string is minutes of
 * work and a lot of memory for something nobody is going to save.
 *
 * So the window loads the same scripts from the same origin and is handed
 * the document **as an object**, then runs the very same player the export
 * ships. Nothing is serialised, so the cost no longer depends on how big
 * the movie is. The export itself is unchanged: that one has to be a file
 * you can send someone.
 */
function testMovie(){
  var w=window.open("","_blank");
  /* A blocked popup used to be the end of it — a message telling the user to
     go and change a browser setting, with the movie they asked to see
     nowhere. A pop-up blocker only stops a *window*, not the player, so
     fall back to running the same preview in an overlay on this page. */
  if(!w){startPreview(inlinePreviewWindow());return;}
  startPreview(w);
}

/**
 * Run the exported player inside `w`, which is either a preview window or
 * the iframe standing in for one. Nothing here is specific to a popup.
 */
function startPreview(w){
  if(!w)return;
  // Test Movie plays the movie, which means every scene in order.
  var data=exportDocData();
  var needsAS2=docHasClipScripts(data);
  var scripts=["flashy.js"];
  if(needsAS2)scripts.push("flashy-as2.js");
  var base=location.href.replace(/[^/]*$/,"");
  var html="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Test Movie</title>"+
    "<style>*{margin:0;padding:0}body{background:#111;display:flex;align-items:center;"+
    "justify-content:center;min-height:100vh;overflow:hidden}canvas{display:block}</style>"+
    "</head><body><canvas id=\"stage\"></canvas></body></html>";
  w.document.open();
  w.document.write(html);
  w.document.close();

  var loaded=0;
  var runWhenReady=function(){
    if(++loaded<scripts.length)return;
    try{
      w.__flashyData=data;
      /* Pipe the preview's traces back to the Output panel. The preview is a
         window of its own with its own engine, so its Flashy.Output is a
         different object — without this, Test Movie's traces land in a panel
         nobody is looking at. */
      try{
        if(w.Flashy&&w.Flashy.Output){
          w.Flashy.Output.onWrite(function(line){
            if(line===null)return;
            try{window.postMessage({type:"flashy:trace",line:String(line)},"*");}
            catch(e){/* a closed opener: the preview still runs */}
          });
        }
      }catch(e){/* cross-origin preview: traces stay in its own console */}
      // The player is compiled in the preview window, so its timers, input
      // and engine are all that window's own.
      var run=w.eval("("+exportRuntime.toString()+")");
      w.__stage=run(w.__flashyData,w.document.getElementById("stage"),{});
      outputLog("Test Movie started — "+(data.totalFrames||1)+" frames at "+
                (data.fps||24)+" fps.");
    }catch(err){
      if(window.console)console.error("Flashy: Test Movie failed",err);
      showMessage("Test Movie","The preview could not start:\n"+((err&&err.message)||err));
    }
  };
  scripts.forEach(function(src){
    var el=w.document.createElement("script");
    el.src=base+src;
    /* A script element added from code is async by default, so flashy-as2.js
       could run before the engine it extends and quietly fail to register —
       after which every imported script falls back to plain JavaScript and
       dies on `_root`. `async = false` keeps them in order. */
    el.async=false;
    el.onload=runWhenReady;
    el.onerror=function(){
      showMessage("Test Movie","Could not load "+src+" for the preview.");
    };
    w.document.head.appendChild(el);
  });
}

/**
 * A stand-in for the preview window, for when the browser will not open one.
 *
 * A same-origin iframe is the same kind of target: its contentWindow has its
 * own document, timers and engine, so the player runs in it unchanged — the
 * preview is the real thing in a smaller frame, not a second implementation.
 * Returns the window to run in, closing over the chrome that dismisses it.
 */
function inlinePreviewWindow(){
  var prev=document.getElementById("fy-preview");
  if(prev)prev.parentNode.removeChild(prev);

  var back=document.createElement("div");
  back.id="fy-preview";
  back.className="fy-dialog-backdrop";
  var box=document.createElement("div");
  box.className="fy-preview";
  back.appendChild(box);

  var bar=document.createElement("div");
  bar.className="fy-dialog-title";
  bar.textContent="Test Movie";
  var close=document.createElement("button");
  close.className="fy-preview-close";
  close.type="button";
  close.textContent="Close";
  bar.appendChild(close);
  box.appendChild(bar);

  var frame=document.createElement("iframe");
  frame.className="fy-preview-frame";
  frame.title="Test Movie";
  box.appendChild(frame);
  document.body.appendChild(back);

  var dismiss=function(){
    if(!back.parentNode)return;
    /* The player holds timers and input listeners of its own; they live in
       the frame, so taking the frame out stops the movie with it. */
    back.parentNode.removeChild(back);
    document.removeEventListener("keydown",onKey,true);
  };
  var onKey=function(ev){
    if(ev.key==="Escape"){ev.stopPropagation();dismiss();}
  };
  close.addEventListener("click",dismiss);
  back.addEventListener("mousedown",function(ev){if(ev.target===back)dismiss();});
  document.addEventListener("keydown",onKey,true);

  frame.style.width=doc.width+"px";
  frame.style.height=doc.height+"px";
  return frame.contentWindow;
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
/* ------------------------------------------------------------------ *
 * The Actions panel's code editor
 *
 * It was a bare <textarea>: no line numbers, no highlighting, nothing to say
 * where a syntax error was. A frame script is code, and writing code in a box
 * that cannot tell a string from a keyword is why people stop.
 *
 * The textarea is still the thing that HOLDS the text — the caret, selection,
 * undo, autoscroll and IME behaviour are the browser's own, which no
 * re-implemented editor gets right. A highlighted <pre> sits underneath it and
 * the textarea's own text is transparent. The two must share font, size,
 * padding and line-height exactly, which is why the CSS sets them together.
 * ------------------------------------------------------------------ */

/* The frame-script vocabulary. Listed here rather than discovered, so the
   chips, the highlighting and the hint text cannot drift apart. */
var SCRIPT_API=["stop","play","gotoAndPlay","gotoAndStop","trace","root","stage","Flashy"];
var SCRIPT_KEYWORDS=("var let const function return if else for while do break continue "+
  "new this typeof instanceof switch case default true false null undefined "+
  "try catch finally throw delete in of void").split(" ");

var SCRIPT_KEYWORD_SET={},SCRIPT_API_SET={};
SCRIPT_KEYWORDS.forEach(function(k){SCRIPT_KEYWORD_SET[k]=true;});
SCRIPT_API.forEach(function(k){SCRIPT_API_SET[k]=true;});

function escapeHtmlText(t){
  return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/**
 * Highlight a script as HTML.
 *
 * One pass, with comments and strings matched FIRST: they have to win over
 * everything inside them, or a `//` in a URL turns the rest of the line into a
 * comment and an apostrophe in a comment opens a string that never closes.
 * An unterminated string or comment still matches to the end of the line (or
 * the text), because a half-typed one is the normal state of a line being
 * written and it must not make the rest of the script flicker.
 */
/*
 * Written as a regex LITERAL, not assembled from strings.
 *
 * The first version joined an array of source fragments, and two of them began
 * with "|" so that the join inserted a second one — which created an empty
 * alternative. An empty alternative matches at every position, so nothing else
 * was ever tokenised and only strings came out highlighted. A literal cannot
 * develop that fault, and the escaping is readable rather than doubled.
 *
 * Group order matters: comments and strings are matched FIRST because they
 * have to win over everything inside them. Otherwise a "//" in a URL comments
 * out the rest of the line, and an apostrophe in a comment opens a string that
 * never closes.
 *
 *   1 comment      block (terminated or not) and line
 *   2 string       all three quotes; each may run unterminated to end of line,
 *                  because a half-typed string is the normal state of a line
 *                  being written and must not make the script flicker
 *   3 number
 *   4 word         keyword / API / plain identifier, decided below
 *   5 punctuation
 */
var SCRIPT_TOKEN_RE =
  /(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.=+\-*/<>!&|?:%])/g;

function highlightScript(src){
  var out="";
  var re=SCRIPT_TOKEN_RE;
  re.lastIndex=0;
  var last=0,m;
  while((m=re.exec(src))){
    if(m.index>last)out+=escapeHtmlText(src.slice(last,m.index));
    var text=escapeHtmlText(m[0]);
    if(m[1])out+='<span class="tok-com">'+text+"</span>";
    else if(m[2])out+='<span class="tok-str">'+text+"</span>";
    else if(m[3])out+='<span class="tok-num">'+text+"</span>";
    else if(m[4]){
      if(SCRIPT_KEYWORD_SET[m[0]])out+='<span class="tok-key">'+text+"</span>";
      else if(SCRIPT_API_SET[m[0]])out+='<span class="tok-api">'+text+"</span>";
      else out+=text;
    }
    else if(m[5])out+='<span class="tok-pun">'+text+"</span>";
    else out+=text;
    last=re.lastIndex;
    // A zero-length match would spin here; nothing in the pattern can produce
    // one, but a future edit to it could.
    if(re.lastIndex===m.index)re.lastIndex++;
  }
  if(last<src.length)out+=escapeHtmlText(src.slice(last));
  return out;
}

/**
 * Check a script and report where it is broken.
 *
 * `new Function` is the same compiler the exported player uses, so a script
 * that passes here is a script that will run there. The line number comes out
 * of the error's stack, where V8 reports it as `<anonymous>:LINE:COL` — one
 * line is added for the function wrapper, so it is subtracted back off.
 */
function checkScript(src,dialect){
  if(!src||!src.trim())return {ok:true};
  /* ActionScript is compiled by flashy-as2.js, not by the JavaScript parser —
     reporting `_root` as a syntax error would be both wrong and alarming. */
  if(dialect==="as2")return {ok:true,skipped:true};
  try{
    new Function("stop","play","gotoAndPlay","gotoAndStop","stage","root","Flashy","trace",src);
    return {ok:true};
  }catch(e){
    var line=null;
    var m=/<anonymous>:(\d+)/.exec(String(e.stack||""));
    if(m){
      line=Math.max(1,parseInt(m[1],10)-1);
      /* `new Function` wraps the body, so an error at the very end — an
         unclosed brace, say — is reported on the line AFTER the source. Clamp
         it: an error past the end belongs to the last line, and pointing the
         gutter at a line that does not exist marks nothing. */
      line=Math.min(line,src.split("\n").length);
    }
    return {ok:false,message:(e&&e.message)||String(e),line:line};
  }
}

/** Repaint the gutter, the highlight layer and the status line. */
function refreshCodeEditor(){
  var ta=document.getElementById("frame-script");
  var hl=document.getElementById("code-highlight");
  var gut=document.getElementById("code-gutter");
  var st=document.getElementById("code-status");
  if(!ta)return;
  var src=ta.value||"";
  var target=actionsTarget();
  var dialect=(target.obj||doc.scriptDialect==="as2")?"as2":"js";
  var res=checkScript(src,dialect);

  if(hl){
    /* The trailing newline keeps the <pre> as tall as the textarea: without
       it the two scroll out of step at the bottom by one line. */
    hl.innerHTML=highlightScript(src)+"\n";
  }
  if(gut){
    var lines=src.split("\n");
    var rows=[];
    for(var i=1;i<=lines.length;i++){
      rows.push(res.line===i?('<span class="err">'+i+"</span>"):String(i));
    }
    gut.innerHTML=rows.join("\n");
  }
  if(st){
    if(res.ok){
      st.className="code-status";
      st.textContent=src.trim()
        ? (res.skipped
            ? "ActionScript — compiled by the AS2 runtime, not checked here."
            : src.split("\n").length+" lines, no syntax errors.")
        : "";
    }else{
      st.className="code-status error";
      st.textContent=(res.line?("Line "+res.line+": "):"Syntax error: ")+res.message;
    }
  }
  syncCodeScroll();
}

/** Keep the highlight layer and the gutter aligned with the textarea. */
function syncCodeScroll(){
  var ta=document.getElementById("frame-script");
  var hl=document.getElementById("code-highlight");
  var gut=document.getElementById("code-gutter");
  if(!ta)return;
  if(hl){hl.scrollTop=ta.scrollTop;hl.scrollLeft=ta.scrollLeft;}
  if(gut)gut.scrollTop=ta.scrollTop;
}

/** The API chips — Flash called this Script Assist. */
function buildCodeHints(){
  var host=document.getElementById("code-hints");
  if(!host||host.childNodes.length)return;
  var ta=document.getElementById("frame-script");
  [["stop()","stop();"],["play()","play();"],
   ["gotoAndPlay()","gotoAndPlay(1);"],["gotoAndStop()","gotoAndStop(1);"],
   ["trace()","trace(\"\");"],["root","root"],["stage","stage"]].forEach(function(p){
    var b=document.createElement("button");
    b.type="button";
    b.className="code-chip";
    b.textContent=p[0];
    b.title="Insert "+p[1];
    b.addEventListener("click",function(){
      if(!ta||ta.disabled)return;
      /* At the caret, not appended: a chip that always writes to the end is
         no quicker than typing. */
      var at=ta.selectionStart==null?ta.value.length:ta.selectionStart;
      var end=ta.selectionEnd==null?at:ta.selectionEnd;
      ta.value=ta.value.slice(0,at)+p[1]+ta.value.slice(end);
      ta.selectionStart=ta.selectionEnd=at+p[1].length;
      ta.focus();
      /* A textarea's own `change` only fires on blur, and the point of a chip
         is that it takes effect now. */
      ta.dispatchEvent(new Event("change"));
      refreshCodeEditor();
    });
    host.appendChild(b);
  });
}

function initActionsPanel(){
  var ta=document.getElementById("frame-script");
  if(!ta)return;
  buildCodeHints();
  refreshCodeEditor();
  ta.addEventListener("input",refreshCodeEditor);
  ta.addEventListener("scroll",syncCodeScroll);
  /* Tab indents instead of leaving the field. In a code editor the field IS
     the thing you are in, and losing your place to the next focusable element
     mid-script is the most irritating thing a plain textarea does. */
  ta.addEventListener("keydown",function(e){
    if(e.key!=="Tab"||e.ctrlKey||e.metaKey||e.altKey)return;
    e.preventDefault();
    var at=ta.selectionStart,end=ta.selectionEnd;
    ta.value=ta.value.slice(0,at)+"  "+ta.value.slice(end);
    ta.selectionStart=ta.selectionEnd=at+2;
    refreshCodeEditor();
  });
  ta.addEventListener("change",function(){
    var target=actionsTarget();
    if(!target.kf&&!target.obj){ta.value="";return;}
    if(target.obj){
      if((target.obj.clipScript||"")===ta.value)return;
      pushUndo();
      target.obj.clipScript=ta.value;
      render();
      return;
    }
    if(target.kf.script===ta.value)return;
    pushUndo();
    target.kf.script=ta.value;
    updateTL();      // the timeline draws an 'a' marker on scripted keyframes
  });
}

/**
 * What the Actions panel is pointed at.
 *
 * Flash had one Actions panel for two things: the current keyframe, and the
 * handlers on whatever single object is selected. Selecting an object
 * switches to its handlers, which is where an imported `onClipEvent` lives.
 */
function actionsTarget(){
  if(selection&&selection.length===1)return {obj:selection[0],kf:null};
  return {obj:null,kf:CKF()};
}

var FRAME_SCRIPT_HINT=
  "// Frame script (JavaScript) — runs on entering this keyframe\n"+
  "// in Test Movie and in exported files. Available: stop(), play(),\n"+
  "// gotoAndPlay(f), gotoAndStop(f), root, stage, Flashy\n"+
  "// e.g.  stop();";
var OBJECT_SCRIPT_HINT=
  "// Handlers for this object, in Flash's own form:\n"+
  "//   onClipEvent(load)      { origin = {x: _x, y: _y}; }\n"+
  "//   onClipEvent(mouseMove) { _x = origin.x + _parent._xmouse / 8; }\n"+
  "//   on(release)            { gotoAndPlay(2); }\n"+
  "// They run in Test Movie and in exported files, not on this stage.";

function updateActionsPanel(){
  var ta=document.getElementById("frame-script");
  if(!ta)return;
  var label=document.getElementById("actions-target");
  // Never overwrite what the user is in the middle of typing.
  if(document.activeElement===ta)return;
  var target=actionsTarget();
  if(target.obj){
    ta.disabled=false;
    ta.placeholder=OBJECT_SCRIPT_HINT;
    ta.value=target.obj.clipScript||"";
    if(label){
      label.textContent="Object: "+
        (target.obj.instanceName||target.obj.name||target.obj.type)+
        "  —  onClipEvent / on handlers";
      label.className="actions-target object";
    }
    refreshCodeEditor();
    return;
  }
  ta.disabled=!target.kf;
  ta.placeholder=FRAME_SCRIPT_HINT;
  ta.value=target.kf?(target.kf.script||""):"";
  if(label){
    label.textContent="Frame script — layer “"+
      ((currentLayers()[curLayer]&&currentLayers()[curLayer].name)||"?")+
      "”, frame "+curFrame;
    label.className="actions-target";
  }
  var wrap=document.getElementById("code-wrap");
  if(wrap)wrap.className="code-wrap"+(ta.disabled?" disabled":"");
  refreshCodeEditor();
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

/* The toolbar's frame-rate box is a view of `doc.fps`, so it has to follow a
   document swap. It used to be written only at init and by Document Settings,
   which meant File ▸ Open — and now Import Flash, where the rate almost
   always differs — left the old number sitting in the toolbar. */
function syncDocFields(){
  var fi=document.getElementById("fpsInput");
  if(fi&&String(doc.fps)!==fi.value)fi.value=doc.fps;
}
function fullRefresh(){
  render();
  syncDocFields();
  updateTL();
  updateProps();
  updateActionsPanel();
  updateColorUI();
  updateLib();
  updateAlignPanel();
  updateInfoPanel();
  updateTransformPanel();
  updateScenePanel();
  updateOutputCount();
  updateHistoryPanel();
  updateExplorerPanel();
  updateBehaviorsPanel();
  updateSwatchesPanel();
  updateOnionUI();
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
  /* Flash import seam — File ▸ Import Flash Movie, the drop handlers and the
     specs all go through it. `parse` and `toDocument` are separate from
     `importFile` on purpose: a spec (and the assistant) can look at what a
     movie contains without replacing the open document. */
  window._flashyFlash={
    importFile:importFlashFile,
    importDirectory:importXFLDirectory,
    parse:parseFlashFile,
    toDocument:function(model,o){return FlashyImport.toDocument(model,o||{});},
    install:installImportedDoc,
    isFlashFile:isFlashFile,
    report:function(){return lastFlashReport;}
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
  initOutputPanel();
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
    /* One frame rasterised the way the GIF, sprite-sheet and video exports
       do it — the only way to check what those put in a file without
       decoding one. */
    renderFrameToCanvas: renderFrameToCanvas,
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
    /* The Rectangle and Oval tools' primitive settings, which are what the
       Options panel edits and what a newly dragged shape inherits. */
    rectPrim: function(){ return rectPrim; },
    ovalPrim: function(){ return ovalPrim; },
    /* Anchor editing: the Pen's other three jobs, and the stream surgery they
       perform. Exposed because a spec can aim at them far more precisely than
       it can point at a quadratic. */
    pathSegments: pathSegments,
    pathSegHit: pathSegHit,
    pathInsertAnchor: pathInsertAnchor,
    pathDeleteAnchor: pathDeleteAnchor,
    pathConvertAnchor: pathConvertAnchor,
    penEditAt: penEditAt,
    objectNodes: objectNodes,
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
    /**
     * Select a keyframe the way clicking its timeline cell does.
     *
     * tlSelect() sets the cell RANGE; this sets `selectedKF`, which is what
     * the Property inspector's keyframe section reads.
     */
    selectKeyframe: function(layerIdx,frame){
      var l=currentLayers()[layerIdx];
      if(!l)return null;
      curLayer=layerIdx;
      curFrame=frame;
      var kf=l.getKeyframeAt(frame);
      selectedKF=kf?{layerIdx:layerIdx,frameIdx:kf.index,kf:kf}:null;
      selection=[];
      fullRefresh();
      return kf;
    },
    framesToSymbol: createSymbolFromFrames,
    /** Frame clipboard, the same entry points the menu uses. */
    copyFrames: copyFrames,
    cutFrames: cutFrames,
    pasteFrames: pasteFrames,
    hasFrameClipboard: hasFrameClipboard,
    clearSpan: function(layerIndex,f0,f1){
      clearSpan(currentLayers()[layerIndex],f0,f1);
    },
    /* Wave-1 object editing, exposed so the specs can drive the real entry
       points the menus call rather than reimplementing them. */
    groupSelection: groupSelection,
    ungroupSelection: ungroupSelection,
    breakApart: breakApartSelection,
    arrange: arrangeSelection,
    transformSelection: transformSelection,
    alignSelection: alignSelection,
    distributeToLayers: distributeToLayers,
    /** Align's To Stage toggle, which changes what every align button means. */
    alignToStage: function(v){ if(v!=null)alignToStage=!!v; return alignToStage; },
    /** Onion skin state, for the specs and for anything scripting the editor. */
    onion: function(v){
      if(v){
        if(v.on!=null)onionOn=!!v.on;
        if(v.outlines!=null)onionOutlines=!!v.outlines;
        if(v.before!=null)onionBefore=v.before|0;
        if(v.after!=null)onionAfter=v.after|0;
        updateOnionUI();render();
      }
      return {on:onionOn,outlines:onionOutlines,before:onionBefore,after:onionAfter};
    },
    /** Guides and snapping. */
    guides: function(){ return docGuides(); },
    snapping: function(v){
      if(v){
        if(v.objects!=null)snapObjects=!!v.objects;
        if(v.guides!=null)snapGuides=!!v.guides;
        if(v.grid!=null)snapGrid=!!v.grid;
        if(v.rulers!=null){showRulers=!!v.rulers;render();}
      }
      return {objects:snapObjects,guides:snapGuides,grid:snapGrid,rulers:showRulers};
    },
    snapBox: snapBox,
    /* Tween control and the frame commands. */
    reverseFrames: reverseFrames,
    copyMotion: copyMotion,
    pasteMotion: pasteMotion,
    hasMotionClipboard: hasMotionClipboard,
    editMultiple: function(v){
      if(v!=null){editMultiple=!!v;selection=[];fullRefresh();}
      return editMultiple;
    },
    editMultipleRange: editMultipleRange,
    easeAmount: easeAmount,
    /** The one tween interpolator every render path reads. */
    interpObj: interpObj,
    /** The stage hit test, which Edit Multiple Frames widens. */
    hitTest: hitTest,
    editMultipleKeyframes: editMultipleKeyframes,
    /** The motion-guide polyline governing a layer, in stage space, or null. */
    addShapeHint: addShapeHint,
    removeShapeHints: removeShapeHints,
    shapeHintTarget: shapeHintTarget,
    motionGuideFor: function(layerIdx){
      var layers=currentLayers();
      return motionGuideFor(layers,layers[layerIdx]);
    },
    frameObjects: function(layers,frame,opts){ return frameObjects(layers,frame,opts); },
    /* Scenes. The alias discipline matters here: doc.layers IS the current
       scene's layer array, never a copy, so a spec that reaches doc.layers is
       reaching the live scene. */
    scenes: function(){ return docScenes(); },
    sceneIndex: function(){ return doc.sceneIndex||0; },
    gotoScene: gotoScene,
    addScene: addScene,
    deleteScene: deleteScene,
    moveScene: moveScene,
    sceneLength: sceneLength,
    /** Every scene laid end to end, the way the exporters see the movie. */
    flattenScenes: flattenScenes,
    moviesTotalFrames: moviesTotalFrames,
    exportDocData: exportDocData,
    /** Timeline row geometry, now that rows differ in height. */
    layerRows: function(){ return layerRowLayout().rows.map(function(r){
      return {index:r.index,name:r.layer.name,y:r.y,h:r.h};
    }); },
    outputLayers: outputLayers,
    /** The Output panel's sink, so a spec can see what a script traced. */
    outputLog: outputLog,
    /* The Actions panel's code editor. Exposed so the specs can drive the
       highlighter and the syntax check without screen-scraping spans. */
    highlightScript: highlightScript,
    checkScript: checkScript,
    refreshCodeEditor: refreshCodeEditor,
    /** The labelled undo stack, which the History panel lists. */
    historySteps: function(){
      return {
        undo:undoStack.map(function(x){return x.label||"Edit";}),
        redo:redoStack.map(function(x){return x.label||"Edit";})
      };
    },
    labelNextUndo: labelNextUndo,
    /** Movie Explorer: the document's structure, as rows. */
    explorerItems: explorerItems,
    explorerFilters: function(v){
      if(v)Object.keys(v).forEach(function(k){explorerFilters[k]=!!v[k];});
      return explorerFilters;
    },
    explorerSearch: function(q){
      if(q!=null){explorerQuery=String(q);updateExplorerPanel();}
      return explorerQuery;
    },
    /** Behaviors: the generated-handler entry points. */
    behaviors: function(){ return BEHAVIORS; },
    addBehavior: function(id,event,values){
      var spec=BEHAVIORS.filter(function(b){return b.id===id;})[0];
      if(!spec)return {ok:false,reason:"unknown"};
      return addBehavior(spec,event,values||{});
    },
    behaviorsOn: behaviorsOn,
    /* Sound effects. */
    soundEnvelopeFor: soundEnvelopeFor,
    setSoundEffect: setSoundEffect,
    soundItems: soundItems,
    /* Publishing. */
    publishSettings: function(v){
      var p=docPublish();
      if(v)Object.keys(v).forEach(function(k){p[k]=v[k];});
      return p;
    },
    publishAll: publishAll,
    sizeReport: sizeReport,
    /** Write the document as a SWF, and say what was left out. */
    exportSWF: function(){ return buildSWF(); },
    /* Swatches and components. */
    documentPalette: documentPalette,
    webSafePalette: webSafePalette,
    swatchMode: function(m){
      if(m){swatchMode=m;updateSwatchesPanel();}
      return swatchMode;
    },
    addCustomSwatch: addCustomSwatch,
    currentSwatches: currentSwatches,
    components: function(){ return COMPONENTS; },
    addComponent: addComponent,
    showSoundEnvelope: showSoundEnvelopeDialog,
    /* Library management. */
    libUseCount: libUseCount,
    unusedLibraryItems: unusedLibraryItems,
    duplicateSymbol: duplicateSymbol,
    swapSymbolOnSelection: swapSymbolOnSelection,
    libraryRows: libraryRows,
    libraryFolders: libraryFolders,
    setLibFolder: setLibFolder,
    librarySearch: function(q){
      if(q!=null){librarySearch=String(q);updateLib();}
      return librarySearch;
    },
    librarySort: function(k){
      if(k){librarySort=k;updateLib();}
      return librarySort;
    },
    /* Wave-2 shape editing. The specs drive these directly as well as through
       the pointer, because several are pure geometry and testing the geometry
       separately from the gesture is the only way to pin down what the
       gesture is supposed to produce. */
    combine: combineSelection,
    shapeCleanup: shapeCleanup,
    linesToFills: convertLinesToFills,
    expandFill: expandFill,
    softenFillEdges: softenFillEdges,
    /** An object's editable anchor points, in stage coordinates. */
    objectNodes: objectNodes,
    setObjectNode: setObjectNode,
    nodeHitTest: nodeHitTest,
    makePolyStar: makePolyStar,
    lassoSelect: lassoSelect,
    magicWandSelect: magicWandSelect,
    inkBottleApply: inkBottleApply,
    /* The current fill and stroke, which every drawing tool reads when it
       commits. The Color Mixer owns these; this is the seam for driving them
       without clicking through the colour picker. */
    /** The Symbol Properties dialog, where the 9-slice guides are set. */
    showSymbolProps: showSymbolPropsDialog,
    setStrokeStyle: function(v){
      if(v.color!=null)strokeColor=v.color;
      if(v.alpha!=null)strokeAlpha=v.alpha;
      if(v.width!=null)strokeWidth=v.width;
      updateColorUI();updateToolOptions();
    },
    setFillStyle: function(v){
      if(v.color!=null)fillColor=v.color;
      if(v.alpha!=null)fillAlpha=v.alpha;
      updateColorUI();
    },
    gradientHandles: gradientHandles,
    setGradientHandle: setGradientHandle,
    /** The pen, as its three gestures: place, shape the handle, finish. */
    pen: function(){
      return {start:penStart,dragTo:penDragTo,commit:penCommit,
              points:function(){return penPts;}};
    },
    /** Per-tool options, which the toolbox strip renders and the tools read. */
    toolOptions: function(v){
      if(v){
        if(v.polyStar)Object.keys(v.polyStar).forEach(function(k){polyStar[k]=v.polyStar[k];});
        if(v.brushSize!=null)brushSize=v.brushSize;
        if(v.pencilMode)pencilMode=v.pencilMode;
        if(v.lassoMode)lassoMode=v.lassoMode;
        updateToolOptions();
      }
      return {polyStar:polyStar,brushSize:brushSize,
              pencilMode:pencilMode,lassoMode:lassoMode};
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
  /* Into the chat log rather than above it: as a sibling it was a fixed band
     that, in a short dock, pushed the input box out of the panel entirely —
     so the assistant asked for a key and hid the way to carry on. In the log
     it scrolls like any other message. */
  var chat=document.getElementById("ai-chat");
  if(chat)chat.insertBefore(notice,chat.firstChild);
  else panel.insertBefore(notice,panel.firstChild);
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
