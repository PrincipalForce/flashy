// Flashy Studio Editor - generated
(function(){
"use strict";
var N=1;function uid(){return N++;}
function EditorObject(t){this.id=uid();this.type=t;this.x=0;this.y=0;this.width=0;this.height=0;this.rotation=0;this.scaleX=1;this.scaleY=1;this.skewX=0;this.skewY=0;this.alpha=1;this.name="";this.fillColor="#000000";this.fillAlpha=1;this.fillType="solid";this.strokeColor="#000000";this.strokeAlpha=1;this.strokeWidth=1;this.strokeStyle="solid";this.strokeCap="round";this.strokeJoin="round";this.points=null;this.text="";this.font="Arial";this.fontSize=24;this.fontBold=false;this.fontItalic=false;this.fontUnderline=false;this.textAlign="left";this.lineHeight=1.2;this.symbolName="";this.instanceName="";this.symbolBehavior="movieclip";this.blendMode="source-over";}
EditorObject.prototype.clone=function(){var c=new EditorObject(this.type);var s=this;Object.keys(s).forEach(function(k){var v=s[k];c[k]=Array.isArray(v)?v.slice():v;});c.id=uid();return c;};
function KeyFrame(i){this.index=i;this.duration=1;this.tweenType="none";this.easing="linear";this.objects=[];this.script="";}
KeyFrame.prototype.clone=function(){var c=new KeyFrame(this.index);c.duration=this.duration;c.tweenType=this.tweenType;c.easing=this.easing;c.objects=this.objects.map(function(o){return o.clone();});c.script=this.script;return c;};
function Layer(n){this.name=n;this.visible=true;this.locked=false;this.keyframes=[new KeyFrame(1)];}
Layer.prototype.getKeyframeAt=function(f){for(var i=this.keyframes.length-1;i>=0;i--){var k=this.keyframes[i];if(f>=k.index&&f<k.index+k.duration)return k;}return null;};
Layer.prototype.getFrameEnd=function(){var l=this.keyframes[this.keyframes.length-1];return l?l.index+l.duration-1:1;};
Layer.prototype.insertKeyframe=function(f){var e=this.getKeyframeAt(f);if(e&&e.index===f)return e;if(e){var nk=e.clone();nk.index=f;nk.duration=(e.index+e.duration)-f;e.duration=f-e.index;var i=this.keyframes.indexOf(e);this.keyframes.splice(i+1,0,nk);return nk;}var kf=new KeyFrame(f);this.keyframes.push(kf);this.keyframes.sort(function(a,b){return a.index-b.index;});return kf;};
Layer.prototype.insertBlankKeyframe=function(f){var k=this.insertKeyframe(f);k.objects=[];return k;};
Layer.prototype.extendToFrame=function(f){var l=this.keyframes[this.keyframes.length-1];if(l&&f>l.index+l.duration-1)l.duration=f-l.index+1;};
Layer.prototype.removeKeyframe=function(f){var i=-1;for(var j=0;j<this.keyframes.length;j++){if(this.keyframes[j].index===f){i=j;break;}}if(i<=0)return;this.keyframes[i-1].duration+=this.keyframes[i].duration;this.keyframes.splice(i,1);};
var doc={width:550,height:400,fps:24,backgroundColor:"#FFFFFF",layers:[new Layer("Layer 1")],library:{},totalFrames:60};
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
  return Math.max(m,currentTotalFrames());
}
var lastClickTime=0,lastClickTarget=null;
var fillColor="#000000",fillAlpha=1,strokeColor="#000000",strokeAlpha=1,strokeWidth=1;
var undoStack=[],redoStack=[];
function snap(){return JSON.stringify({d:serializeDoc(),f:curFrame,l:curLayer});}
function pushUndo(){undoStack.push(snap());if(undoStack.length>50)undoStack.shift();redoStack.length=0;}
function doUndo(){if(!undoStack.length)return;redoStack.push(snap());var s=JSON.parse(undoStack.pop());deserializeDoc(s.d);curFrame=s.f;curLayer=s.l;selection=[];fullRefresh();}
function doRedo(){if(!redoStack.length)return;undoStack.push(snap());var s=JSON.parse(redoStack.pop());deserializeDoc(s.d);curFrame=s.f;curLayer=s.l;selection=[];fullRefresh();}
function CL(){return currentLayers()[curLayer];}
function CKF(){var l=CL();return l?l.getKeyframeAt(curFrame):null;}

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
    {label:"Export as GIF...",action:"exportGIF"},
    {label:"Export as MP4...",action:"exportMP4"},
    {label:"Export as SVG...",action:"exportSVG"},
    {label:"Export Embed Snippet...",action:"exportEmbed"},
    {label:"Export as JS Module...",action:"exportModule"},
    {type:"sep"},
    {label:"Document Settings...",action:"docSettings"},
    {type:"sep"},
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
    {label:"Select All",action:"selectAll",shortcut:"Ctrl+A"}
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
  ]}
];

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
function resizeCanvas(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  var wrap=canvas.parentElement;
  canvas.width=wrap.clientWidth;
  canvas.height=wrap.clientHeight;
  ctx=canvas.getContext("2d");
  render();
}
function centerStage(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  panX=(canvas.width-doc.width*zoom)/2;
  panY=(canvas.height-doc.height*zoom)/2;
}
function s2s(x,y){return{x:(x-panX)/zoom,y:(y-panY)/zoom};}
function s2c(x,y){return{x:x*zoom+panX,y:y*zoom+panY};}

function render(){
  if(!ctx)return;
  var w=canvas.width,h=canvas.height;
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
  var _layers=currentLayers();
  for(var i=_layers.length-1;i>=0;i--){
    var l=_layers[i];
    if(!l.visible)continue;
    var kf=l.getKeyframeAt(curFrame);
    if(!kf)continue;
    // check for tween
    if(kf.tweenType!=="none"){
      var ki=l.keyframes.indexOf(kf);
      var nextKf=l.keyframes[ki+1];
      if(nextKf){
        var t=(curFrame-kf.index)/kf.duration;
        for(var oi=0;oi<kf.objects.length;oi++){
          var no=nextKf.objects[oi];
          if(no)renderTween(kf.objects[oi],no,t,kf.tweenType,kf.easing);
          else renderObj(kf.objects[oi]);
        }
        continue;
      }
    }
    kf.objects.forEach(function(o){renderObj(o);});
  }
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

// === renderObj ===
function renderObj(o){
  ctx.save();
  ctx.translate(o.x+o.width/2,o.y+o.height/2);
  ctx.rotate(o.rotation*Math.PI/180);
  ctx.scale(o.scaleX,o.scaleY);
  // Apply blend mode
  if(o.blendMode&&o.blendMode!=="source-over")ctx.globalCompositeOperation=o.blendMode;
  ctx.globalAlpha=o.alpha;
  // Apply stroke style helper
  var applyStroke=function(){
    ctx.lineCap=o.strokeCap||"round";
    ctx.lineJoin=o.strokeJoin||"round";
    if(o.strokeStyle==="dashed")ctx.setLineDash([6,4]);
    else if(o.strokeStyle==="dotted")ctx.setLineDash([2,3]);
    else ctx.setLineDash([]);
  };
  var hw=o.width/2,hh=o.height/2;
  if(o.type==="rect"){
    if((o.fillType||"solid")!=="none"){ctx.fillStyle=o.fillColor;ctx.globalAlpha=o.alpha*(o.fillAlpha!=null?o.fillAlpha:1);
    ctx.fillRect(-hw,-hh,o.width,o.height);}
    if(o.strokeWidth>0&&(o.strokeStyle||"solid")!=="none"){ctx.strokeStyle=o.strokeColor;ctx.lineWidth=o.strokeWidth;
      ctx.globalAlpha=o.alpha*(o.strokeAlpha!=null?o.strokeAlpha:1);applyStroke();ctx.strokeRect(-hw,-hh,o.width,o.height);}
  }else if(o.type==="oval"){
    ctx.beginPath();ctx.ellipse(0,0,Math.abs(hw),Math.abs(hh),0,0,Math.PI*2);
    if((o.fillType||"solid")!=="none"){ctx.fillStyle=o.fillColor;ctx.globalAlpha=o.alpha*(o.fillAlpha!=null?o.fillAlpha:1);ctx.fill();}
    if(o.strokeWidth>0&&(o.strokeStyle||"solid")!=="none"){ctx.strokeStyle=o.strokeColor;ctx.lineWidth=o.strokeWidth;
      ctx.globalAlpha=o.alpha*(o.strokeAlpha!=null?o.strokeAlpha:1);applyStroke();ctx.stroke();}
  }else if(o.type==="line"){
    ctx.beginPath();ctx.moveTo(-hw,-hh);ctx.lineTo(hw,hh);
    ctx.strokeStyle=o.strokeColor;ctx.lineWidth=o.strokeWidth;
    ctx.globalAlpha=o.alpha*(o.strokeAlpha!=null?o.strokeAlpha:1);applyStroke();ctx.stroke();
  }else if(o.type==="pencil"||o.type==="brush"){
    if(o.points&&o.points.length>1){
      ctx.beginPath();ctx.moveTo(o.points[0]-o.x,o.points[1]-o.y);
      for(var pi=2;pi<o.points.length;pi+=2){
        ctx.lineTo(o.points[pi]-o.x,o.points[pi+1]-o.y);
      }
      if(o.type==="brush"){ctx.strokeStyle=o.fillColor;ctx.lineWidth=o.strokeWidth*3;ctx.lineCap="round";ctx.lineJoin="round";}
      else{ctx.strokeStyle=o.strokeColor;ctx.lineWidth=o.strokeWidth;applyStroke();}
      ctx.globalAlpha=o.alpha*(o.strokeAlpha!=null?o.strokeAlpha:1);ctx.stroke();
    }
  }else if(o.type==="text"){
    var fontStr=(o.fontItalic?"italic ":"")+(o.fontBold?"bold ":"")+o.fontSize+"px "+o.font;
    ctx.font=fontStr;ctx.fillStyle=o.fillColor;
    ctx.globalAlpha=o.alpha*(o.fillAlpha!=null?o.fillAlpha:1);ctx.textBaseline="top";
    ctx.textAlign=o.textAlign||"left";
    var tx=-hw;if(o.textAlign==="center")tx=0;else if(o.textAlign==="right")tx=hw;
    var lines=(o.text||"Text").split("\n");
    var lh=(o.lineHeight||1.2)*o.fontSize;
    for(var li=0;li<lines.length;li++){
      ctx.fillText(lines[li],tx,-hh+li*lh);
      if(o.fontUnderline){
        var m=ctx.measureText(lines[li]);
        ctx.save();ctx.strokeStyle=o.fillColor;ctx.lineWidth=1;
        ctx.beginPath();
        var ux=tx;if(o.textAlign==="center")ux=tx-m.width/2;else if(o.textAlign==="right")ux=tx-m.width;
        ctx.moveTo(ux,-hh+li*lh+o.fontSize+1);ctx.lineTo(ux+m.width,-hh+li*lh+o.fontSize+1);
        ctx.stroke();ctx.restore();
      }
    }
    ctx.textAlign="start";
  }else if(o.type==="symbol"){
    var sym=doc.library[o.symbolName];
    if(sym){
      // Render the symbol's actual objects
      var symObjs=sym.objects;
      // If symbol has layers, render from the layers at frame 1
      if(sym.layers){
        symObjs=[];
        for(var sli=sym.layers.length-1;sli>=0;sli--){
          var sl=sym.layers[sli];
          if(!sl.visible)continue;
          var skf=sl.getKeyframeAt(1);
          if(skf){
            for(var soi=0;soi<skf.objects.length;soi++)symObjs.push(skf.objects[soi]);
          }
        }
      }
      if(symObjs&&symObjs.length>0){
        // We're currently at the symbol's center (x+w/2, y+h/2).
        // Symbol children are positioned relative to (0,0) in symbol space.
        // Shift back to top-left corner so children render correctly.
        ctx.translate(-hw,-hh);
        for(var si=0;si<symObjs.length;si++){
          renderObj(symObjs[si]);
        }
        ctx.translate(hw,hh); // restore for label below
      }else{
        // Empty symbol — show placeholder
        ctx.fillStyle="#CCCCFF";ctx.globalAlpha=o.alpha*0.3;
        ctx.fillRect(-hw,-hh,o.width,o.height);
        ctx.strokeStyle="#6666CC";ctx.lineWidth=1;ctx.globalAlpha=o.alpha;
        ctx.strokeRect(-hw,-hh,o.width,o.height);
      }
      // Draw symbol name label below
      ctx.globalAlpha=o.alpha*0.4;
      ctx.fillStyle="#88f";ctx.font="9px Arial";ctx.textBaseline="top";ctx.textAlign="center";
      ctx.fillText(o.symbolName||"Symbol",0,hh+2);
      ctx.textAlign="start";
    }else{
      // Missing symbol reference
      ctx.fillStyle="#FF6666";ctx.globalAlpha=o.alpha*0.5;
      ctx.fillRect(-hw,-hh,o.width,o.height);
      ctx.strokeStyle="#CC3333";ctx.lineWidth=1;ctx.globalAlpha=o.alpha;
      ctx.strokeRect(-hw,-hh,o.width,o.height);
      ctx.fillStyle="#fff";ctx.font="9px Arial";ctx.textBaseline="middle";ctx.textAlign="center";
      ctx.fillText("Missing: "+(o.symbolName||"?"),0,0);
      ctx.textAlign="start";
    }
  }
  ctx.restore();
}

// === renderTween ===
function renderTween(a,b,t,type,easing){
  var e=t;
  if(easing==="easeIn")e=t*t;
  else if(easing==="easeOut")e=1-(1-t)*(1-t);
  else if(easing==="easeInOut")e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  var tmp=a.clone();
  tmp.x=a.x+(b.x-a.x)*e;
  tmp.y=a.y+(b.y-a.y)*e;
  tmp.width=a.width+(b.width-a.width)*e;
  tmp.height=a.height+(b.height-a.height)*e;
  tmp.rotation=a.rotation+(b.rotation-a.rotation)*e;
  tmp.scaleX=a.scaleX+(b.scaleX-a.scaleX)*e;
  tmp.scaleY=a.scaleY+(b.scaleY-a.scaleY)*e;
  tmp.alpha=a.alpha+(b.alpha-a.alpha)*e;
  renderObj(tmp);
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
function initMouse(){
  canvas=document.getElementById("stageCanvas");
  if(!canvas)return;
  canvas.addEventListener("mousedown",onMouseDown);
  canvas.addEventListener("mousemove",onMouseMove);
  canvas.addEventListener("mouseup",onMouseUp);
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
    if(x>=o.x&&x<=o.x+o.width&&y>=o.y&&y<=o.y+o.height)return o;
  }
  return null;
}
var moveStartX=0,moveStartY=0,moveObjStarts=[];
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
          return o.x+o.width>x1&&o.x<x2&&o.y+o.height>y1&&o.y<y2;
        });
      }
      dragPreview=null;
    }else if(selection.length>0){pushUndo();}
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
        obj2.points=pts.slice();
        obj2.fillColor=fillColor;obj2.strokeColor=strokeColor;obj2.strokeWidth=strokeWidth;
        kf3.objects.push(obj2);selection=[obj2];
      }
    }
    dragPreview=null;
  }else if(curTool==="text"){
    if(dragPreview){
      var txt=prompt("Enter text:","Text");
      if(txt){
        pushUndo();
        var kf4=CKF();if(!kf4){var l3=CL();if(l3){kf4=l3.insertKeyframe(curFrame);}}
        if(kf4){
          var obj3=new EditorObject("text");
          obj3.x=Math.min(dragPreview.x1,dragPreview.x2);
          obj3.y=Math.min(dragPreview.y1,dragPreview.y2);
          obj3.width=Math.max(80,Math.abs(dragPreview.x2-dragPreview.x1));
          obj3.height=Math.max(30,Math.abs(dragPreview.y2-dragPreview.y1));
          obj3.text=txt;obj3.fillColor=fillColor;obj3.fontSize=24;
          kf4.objects.push(obj3);selection=[obj3];
        }
      }
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
      var nn=prompt("Layer name:",l.name);
      if(nn){pushUndo();l.name=nn;updateTL();}
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
var TL_FW=12,TL_FH=20,TL_HDR=16;
function renderTLFrames(){
  tlCanvas=document.getElementById("tlCanvas");
  if(!tlCanvas)return;
  var wrap=tlCanvas.parentElement;
  var layers=currentLayers();
  var maxF=currentMaxFrame()+10;
  var totalW=maxF*TL_FW;
  var totalH=TL_HDR+layers.length*TL_FH;
  tlCanvas.width=Math.max(wrap.clientWidth,totalW);
  tlCanvas.height=Math.max(wrap.clientHeight,totalH);
  tlCtx=tlCanvas.getContext("2d");
  var fw=TL_FW,fh=TL_FH;
  // header bar
  tlCtx.fillStyle="#3A3A3A";
  tlCtx.fillRect(0,0,tlCanvas.width,TL_HDR);
  tlCtx.fillStyle="#888";
  tlCtx.font="9px Tahoma,Arial,sans-serif";
  for(var f=1;f<=maxF;f++){
    var fx=(f-1)*fw;
    if(f%5===0||f===1){
      tlCtx.fillText(f,fx+2,11);
    }
    if(f%5===0){
      tlCtx.strokeStyle="#555";tlCtx.lineWidth=0.5;
      tlCtx.beginPath();tlCtx.moveTo(fx+fw,TL_HDR);tlCtx.lineTo(fx+fw,tlCanvas.height);tlCtx.stroke();
    }
  }
  tlCtx.strokeStyle="#444";tlCtx.lineWidth=1;
  tlCtx.beginPath();tlCtx.moveTo(0,TL_HDR);tlCtx.lineTo(tlCanvas.width,TL_HDR);tlCtx.stroke();
  // frames per layer
  layers.forEach(function(l,li){
    var y=TL_HDR+li*fh;
    // background for entire layer row
    tlCtx.fillStyle=li===curLayer?"#333":"#2C2C2C";
    tlCtx.fillRect(0,y,tlCanvas.width,fh);
    l.keyframes.forEach(function(kf){
      for(var d=0;d<kf.duration;d++){
        var x=(kf.index-1+d)*fw;
        var frameNum=kf.index+d;
        var isSelected=selectedKF&&selectedKF.layerIdx===li&&frameNum>=kf.index&&frameNum<kf.index+kf.duration&&d===0;
        if(d===0){
          // keyframe cell
          if(kf.objects.length>0){
            tlCtx.fillStyle=kf.tweenType!=="none"?"#445577":"#4A4A4A";
          }else{
            tlCtx.fillStyle="#3C3C3C";
          }
          tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
          // keyframe dot
          tlCtx.fillStyle=kf.objects.length>0?"#DDD":"#777";
          tlCtx.beginPath();tlCtx.arc(x+fw/2,y+fh/2,2.5,0,Math.PI*2);tlCtx.fill();
          // selected keyframe highlight
          if(isSelected){
            tlCtx.strokeStyle="#4488CC";tlCtx.lineWidth=2;
            tlCtx.strokeRect(x+1,y+1,fw-2,fh-2);
          }
        }else{
          // continuation frame
          if(kf.tweenType!=="none"){
            tlCtx.fillStyle="#3A4A5A";
            tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
            // tween arrow line
            tlCtx.strokeStyle="#5588AA";tlCtx.lineWidth=1;
            tlCtx.beginPath();tlCtx.moveTo(x,y+fh/2);tlCtx.lineTo(x+fw-1,y+fh/2);tlCtx.stroke();
          }else{
            tlCtx.fillStyle="#353535";
            tlCtx.fillRect(x+0.5,y+0.5,fw-1,fh-1);
          }
        }
        // cell border
        tlCtx.strokeStyle="#222";tlCtx.lineWidth=0.3;
        tlCtx.strokeRect(x+0.5,y+0.5,fw-1,fh-1);
      }
      // end-of-span marker
      if(kf.duration>1){
        var ex=(kf.index-1+kf.duration-1)*fw+fw-2;
        tlCtx.fillStyle="#888";
        tlCtx.fillRect(ex,y+3,1,fh-6);
      }
    });
    // layer separator line
    tlCtx.strokeStyle="#222";tlCtx.lineWidth=0.5;
    tlCtx.beginPath();tlCtx.moveTo(0,y+fh);tlCtx.lineTo(tlCanvas.width,y+fh);tlCtx.stroke();
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
  tlCtx.strokeStyle="rgba(255,50,50,0.7)";tlCtx.lineWidth=1.5;
  tlCtx.beginPath();tlCtx.moveTo(phx,0);tlCtx.lineTo(phx,tlCanvas.height);tlCtx.stroke();
  // playhead triangle
  tlCtx.fillStyle="#FF3333";
  tlCtx.beginPath();tlCtx.moveTo(phx-5,0);tlCtx.lineTo(phx+5,0);tlCtx.lineTo(phx,7);tlCtx.fill();
  // current frame highlight column
  tlCtx.fillStyle="rgba(255,50,50,0.06)";
  tlCtx.fillRect((curFrame-1)*fw,TL_HDR,fw,tlCanvas.height-TL_HDR);
}
function updatePH(){
  var ph=document.getElementById("playhead");
  if(ph)ph.style.left=((curFrame-1)*12)+'px';
}
var tlSelRange=null; // {layerIdx, startFrame, endFrame} for frame range selection
function initTLClicks(){
  var tc=document.getElementById("tlCanvas");
  if(!tc)return;
  var framesDiv=document.getElementById("tl-frames");
  var layersDiv=document.getElementById("tl-layers");
  if(framesDiv&&layersDiv){
    framesDiv.addEventListener("scroll",function(){
      layersDiv.scrollTop=framesDiv.scrollTop;
    });
  }
  tc.addEventListener("mousedown",function(e){
    if(e.button===2)return; // right-click handled by contextmenu
    var r=tc.getBoundingClientRect();
    var mx=e.clientX-r.left,my=e.clientY-r.top;
    var f=Math.max(1,Math.floor(mx/TL_FW)+1);
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
    // scrub/range-drag
    function scrub(ev){
      var smx=ev.clientX-r.left;
      var sf=Math.max(1,Math.floor(smx/TL_FW)+1);
      if(sf!==curFrame){
        curFrame=sf;
        if(tlSelRange)tlSelRange.endFrame=sf;
        var layer2=layers[curLayer];
        if(layer2){
          var kf2=layer2.getKeyframeAt(sf);
          if(kf2)selectedKF={layerIdx:curLayer,frameIdx:kf2.index,kf:kf2};
          else selectedKF=null;
        }
        fullRefresh();
      }
    }
    function stopScrub(){
      document.removeEventListener("mousemove",scrub);
      document.removeEventListener("mouseup",stopScrub);
    }
    document.addEventListener("mousemove",scrub);
    document.addEventListener("mouseup",stopScrub);
  });
  // Right-click context menu on timeline
  tc.addEventListener("contextmenu",function(e){
    e.preventDefault();
    var r=tc.getBoundingClientRect();
    var mx=e.clientX-r.left,my=e.clientY-r.top;
    var f=Math.max(1,Math.floor(mx/TL_FW)+1);
    var li=Math.floor((my-TL_HDR)/TL_FH);
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
      {label:"Insert Keyframe (F6)",action:function(){doAction("insertKF");}},
      {label:"Insert Blank Keyframe (F7)",action:function(){doAction("insertBlankKF");}},
      {label:"Insert Frame (F5)",action:function(){doAction("insertFrame");}},
      {sep:true},
      {label:"Insert Blank Frames"+rangeInfo,action:function(){
        pushUndo();var layer=layers[curLayer];if(!layer)return;
        if(tlSelRange){
          var s2=Math.min(tlSelRange.startFrame,tlSelRange.endFrame);
          var e2=Math.max(tlSelRange.startFrame,tlSelRange.endFrame);
          var count=e2-s2+1;
          for(var ff=0;ff<count;ff++){layer.extendToFrame(s2+ff);}
        }else{
          layer.extendToFrame(f);
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
      {label:"Clear Keyframe",action:function(){doAction("clearKF");}},
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
      if(bt.onClick)b.addEventListener("click",bt.onClick);
      r.appendChild(b);
    });
    pp.appendChild(r);return r;
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

    // ── Symbol Properties (additional for symbol instances) ──
    if(o.type==="symbol"){
      sect("Symbol Instance");
      row("Symbol",o.symbolName||"",function(){},{type:"readonly"});
      row("Instance",o.instanceName||"",function(v){pushUndo();o.instanceName=v;},{width:"90px"});
      row("Behavior",o.symbolBehavior||"movieclip",function(v){pushUndo();o.symbolBehavior=v;},{type:"select",width:"90px",options:[["movieclip","Movie Clip"],["graphic","Graphic"],["button","Button"]]});
      actionRow([
        {label:"Edit Symbol",onClick:function(){if(o.symbolName)enterSymbol(o.symbolName);}},
        {label:"Swap Symbol",disabled:true}
      ]);
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
  if(!sym.layers){
    sym.layers=[new Layer("Layer 1")];
    sym.layers[0].keyframes[0].objects=sym.objects.slice();
    sym.totalFrames=60;
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
    if(confirm("Create new document? Unsaved changes will be lost.")){
      doc.width=550;doc.height=400;doc.fps=24;doc.backgroundColor="#FFFFFF";
      doc.layers=[new Layer("Layer 1")];doc.library={};doc.totalFrames=60;
      curLayer=0;curFrame=1;selection=[];undoStack=[];redoStack=[];editStack=[];
      updateBreadcrumb();fullRefresh();
    }
    break;
  case "open":
    var inp=document.createElement("input");inp.type="file";inp.accept=".flashy,.json";
    inp.addEventListener("change",function(){
      if(!inp.files[0])return;
      var r=new FileReader();
      r.onload=function(){
        try{
          var d=JSON.parse(r.result);
          deserializeDoc(d);curFrame=1;curLayer=0;selection=[];
          undoStack=[];redoStack=[];editStack=[];updateBreadcrumb();fullRefresh();
        }catch(e){alert("Failed to open file: "+e.message);}
      };
      r.readAsText(inp.files[0]);
    });
    inp.click();
    break;
  case "save":
    dlFile(JSON.stringify(serializeDoc(),null,2),"animation.flashy","application/json");
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
    var nw=prompt("Document width:",doc.width);
    if(nw===null)break;
    var nh=prompt("Document height:",doc.height);
    if(nh===null)break;
    var nbg=prompt("Background color:",doc.backgroundColor);
    if(nbg===null)break;
    pushUndo();
    doc.width=parseInt(nw)||550;doc.height=parseInt(nh)||400;
    doc.backgroundColor=nbg||"#FFFFFF";
    centerStage();fullRefresh();
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
    var cw=canvas?canvas.width:800,ch=canvas?canvas.height:600;
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
    var l4=CL();if(l4){l4.extendToFrame(curFrame);fullRefresh();}
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
      if(kfr&&kfr.duration>1)kfr.duration--;
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
    var kft=CKF();
    if(kft){kft.tweenType=a==="motionTween"?"motion":"shape";fullRefresh();}
    break;
  case "removeTween":
    pushUndo();
    var kft2=CKF();
    if(kft2){kft2.tweenType="none";fullRefresh();}
    break;
  case "convertSym":
    if(selection.length>0){
      var sn=prompt("Symbol name:","Symbol "+(Object.keys(doc.library).length+1));
      if(sn){
        pushUndo();
        doc.library[sn]={objects:selection.map(function(o){return o.clone();}),layers:null};
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
      }
    }
    break;
  case "newSymbol":
    var nsn=prompt("New symbol name:","Symbol "+(Object.keys(doc.library).length+1));
    if(nsn){
      pushUndo();
      doc.library[nsn]={objects:[],layers:null};
      fullRefresh();
    }
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
  case "importURL":
    var importUrl=prompt("Enter URL of a running Flashy animation:\n(Must be same origin, e.g. http://localhost:8000/examples/solar-system.html)","http://localhost:8000/examples/solar-system.html");
    if(importUrl){
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
function startPlay(){
  if(playing)return;
  playing=true;
  playTimer=setInterval(function(){
    curFrame++;
    if(curFrame>currentMaxFrame())curFrame=1;
    render();updateTL();
  },1000/doc.fps);
}
function stopPlay(){
  if(!playing)return;
  playing=false;
  if(playTimer){clearInterval(playTimer);playTimer=null;}
  fullRefresh();
}

// === Keyboard Shortcuts ===
function initKeys(){
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
function serializeDoc(){
  return{
    width:doc.width,height:doc.height,fps:doc.fps,
    backgroundColor:doc.backgroundColor,
    totalFrames:doc.totalFrames,
    layers:doc.layers.map(function(l){
      return{
        name:l.name,visible:l.visible,locked:l.locked,
        keyframes:l.keyframes.map(function(kf){
          return{
            index:kf.index,duration:kf.duration,
            tweenType:kf.tweenType,easing:kf.easing,
            script:kf.script,
            objects:kf.objects.map(function(o){
              var r={};
              Object.keys(o).forEach(function(k){
                var v=o[k];r[k]=Array.isArray(v)?v.slice():v;
              });
              return r;
            })
          };
        })
      };
    }),
    library:doc.library
  };
}
function deserializeDoc(d){
  doc.width=d.width||550;doc.height=d.height||400;
  doc.fps=d.fps||24;doc.backgroundColor=d.backgroundColor||"#FFFFFF";
  doc.totalFrames=d.totalFrames||60;
  doc.library=d.library||{};
  doc.layers=d.layers.map(function(ld){
    var l=new Layer(ld.name);
    l.visible=ld.visible!==false;l.locked=!!ld.locked;
    l.keyframes=ld.keyframes.map(function(kd){
      var kf=new KeyFrame(kd.index);
      kf.duration=kd.duration||1;kf.tweenType=kd.tweenType||"none";
      kf.easing=kd.easing||"linear";kf.script=kd.script||"";
      kf.objects=kd.objects.map(function(od){
        var o=new EditorObject(od.type);
        Object.keys(od).forEach(function(k){
          var v=od[k];o[k]=Array.isArray(v)?v.slice():v;
        });
        return o;
      });
      return kf;
    });
    return l;
  });
}
function dlFile(content,name,mime){
  var blob=new Blob([content],{type:mime});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download=name;
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
    s+="</style>\n</head>\n<body>\n";
    s+="<canvas id=\"stage\"></canvas>\n";
    // Embed the full Flashy engine inline
    s+=sc+"\n"+engineSrc+"\n"+sce+"\n";
    // Build the scene using the Flashy API
    s+=sc+"\n";
    s+="(function(){\n";
    s+="var data="+JSON.stringify(d)+";\n";
    s+="var W=data.width,H=data.height;\n";
    s+="var canvas=document.getElementById('stage');\n";
    s+="var stage=new Flashy.Stage(canvas,{width:W,height:H,fps:data.fps,backgroundColor:parseInt((data.backgroundColor||'#ffffff').replace('#',''),16)});\n";
    s+="var root=stage.root;\n\n";
    // Helper to build a Flashy shape from an EditorObject
    s+="function buildObj(o){\n";
    s+="  var node;\n";
    s+="  if(o.type==='text'){\n";
    s+="    var style=(o.fontBold?'bold ':'')+(o.fontItalic?'italic ':'');\n";
    s+="    node=new Flashy.TextField(o.text||'',{font:style+(o.fontSize||24)+'px '+(o.font||'Arial'),";
    s+="color:parseInt((o.fillColor||'#000').replace('#',''),16),align:o.textAlign||'left'});\n";
    s+="  }else{\n";
    s+="    node=new Flashy.Shape();\n";
    s+="    var g=node.graphics;\n";
    s+="    var fc=parseInt((o.fillColor||'#000').replace('#',''),16);\n";
    s+="    var sc2=parseInt((o.strokeColor||'#000').replace('#',''),16);\n";
    s+="    var ft=o.fillType||'solid',ss=o.strokeStyle||'solid';\n";
    s+="    if(ft!=='none')g.beginFill(fc,o.fillAlpha!=null?o.fillAlpha:1);\n";
    s+="    if(ss!=='none'&&o.strokeWidth>0)g.lineStyle(o.strokeWidth,sc2,o.strokeAlpha!=null?o.strokeAlpha:1);\n";
    s+="    if(o.type==='rect')g.drawRect(0,0,o.width,o.height);\n";
    s+="    else if(o.type==='oval')g.drawEllipse(0,0,o.width,o.height);\n";
    s+="    else if(o.type==='line'&&o.points&&o.points.length>=4){\n";
    s+="      g.moveTo(o.points[0],o.points[1]);\n";
    s+="      for(var i=2;i<o.points.length;i+=2)g.lineTo(o.points[i],o.points[i+1]);\n";
    s+="    }else if((o.type==='pencil'||o.type==='brush')&&o.points&&o.points.length>=4){\n";
    s+="      g.moveTo(o.points[0],o.points[1]);\n";
    s+="      for(var i=2;i<o.points.length;i+=2)g.lineTo(o.points[i],o.points[i+1]);\n";
    s+="    }\n";
    s+="    if(ft!=='none')g.endFill();\n";
    s+="  }\n";
    s+="  node.x=o.x||0;node.y=o.y||0;\n";
    s+="  node.rotation=(o.rotation||0)*Math.PI/180;\n";
    s+="  node.scaleX=o.scaleX||1;node.scaleY=o.scaleY||1;\n";
    s+="  node.alpha=o.alpha!=null?o.alpha:1;\n";
    s+="  if(o.blendMode&&o.blendMode!=='source-over')node.blendMode=o.blendMode;\n";
    s+="  return node;\n";
    s+="}\n\n";
    // Build symbol definitions
    s+="var symbols={};\n";
    var libKeys=Object.keys(d.library||{});
    if(libKeys.length){
      s+="var libData=data.library;\n";
      s+="for(var sname in libData){\n";
      s+="  (function(name,sym){\n";
      s+="    symbols[name]=function(){\n";
      s+="      var mc=new Flashy.MovieClip();\n";
      s+="      var objs=sym.objects||[];\n";
      s+="      if(sym.layers){\n";
      s+="        objs=[];sym.layers.forEach(function(l){\n";
      s+="          if(l.visible===false)return;\n";
      s+="          var kf=null;for(var i=l.keyframes.length-1;i>=0;i--){\n";
      s+="            if(1>=l.keyframes[i].index&&1<l.keyframes[i].index+l.keyframes[i].duration){kf=l.keyframes[i];break;}\n";
      s+="          }\n";
      s+="          if(kf)objs=objs.concat(kf.objects);\n";
      s+="        });\n";
      s+="      }\n";
      s+="      objs.forEach(function(o){mc.addChild(buildObj(o));});\n";
      s+="      return mc;\n";
      s+="    };\n";
      s+="  })(sname,libData[sname]);\n";
      s+="}\n";
    }
    // Compute max frame across all layers
    s+="var maxF=1;\n";
    s+="data.layers.forEach(function(l){l.keyframes.forEach(function(k){var e=k.index+k.duration-1;if(e>maxF)maxF=e;});});\n";
    s+="root.timeline.setTotalFrames(maxF);\n";
    s+="root.loop=true;\n\n";
    // Build frame scripts that reconstruct display list each frame with tween interpolation
    s+="var easing=Flashy.Easing;\n";
    s+="for(var f=1;f<=maxF;f++){\n";
    s+="  (function(fr){\n";
    s+="    root.timeline.addFrameScript(fr,function(){\n";
    s+="      this.removeAllChildren();\n";
    s+="      for(var li=data.layers.length-1;li>=0;li--){\n";
    s+="        var la=data.layers[li];\n";
    s+="        if(la.visible===false)continue;\n";
    s+="        var kf=null;\n";
    s+="        for(var ki=la.keyframes.length-1;ki>=0;ki--){\n";
    s+="          var k=la.keyframes[ki];\n";
    s+="          if(fr>=k.index&&fr<k.index+k.duration){kf=k;break;}\n";
    s+="        }\n";
    s+="        if(!kf)continue;\n";
    // Tween interpolation
    s+="        if(kf.tweenType&&kf.tweenType!=='none'&&kf.duration>1){\n";
    s+="          var ki2=la.keyframes.indexOf(kf);\n";
    s+="          var nk=la.keyframes[ki2+1];\n";
    s+="          if(nk){\n";
    s+="            var raw=(fr-kf.index)/(kf.duration-1||1);\n";
    s+="            var ef=easing[kf.easing||'linear']||easing.linear;\n";
    s+="            var t=ef(Math.min(1,Math.max(0,raw)));\n";
    s+="            for(var oi=0;oi<kf.objects.length;oi++){\n";
    s+="              var a=kf.objects[oi],b=nk.objects[oi]||a;\n";
    s+="              var interp={};for(var p in a)interp[p]=a[p];\n";
    s+="              interp.x=a.x+(b.x-a.x)*t;\n";
    s+="              interp.y=a.y+(b.y-a.y)*t;\n";
    s+="              interp.width=a.width+(b.width-a.width)*t;\n";
    s+="              interp.height=a.height+(b.height-a.height)*t;\n";
    s+="              interp.rotation=(a.rotation||0)+((b.rotation||0)-(a.rotation||0))*t;\n";
    s+="              interp.alpha=(a.alpha!=null?a.alpha:1)+((b.alpha!=null?b.alpha:1)-(a.alpha!=null?a.alpha:1))*t;\n";
    s+="              interp.scaleX=(a.scaleX||1)+((b.scaleX||1)-(a.scaleX||1))*t;\n";
    s+="              interp.scaleY=(a.scaleY||1)+((b.scaleY||1)-(a.scaleY||1))*t;\n";
    s+="              var node=interp.type==='symbol'&&symbols[interp.symbolName]?symbols[interp.symbolName]():buildObj(interp);\n";
    s+="              this.addChild(node);\n";
    s+="            }\n";
    s+="            continue;\n";
    s+="          }\n";
    s+="        }\n";
    // Normal frame — no tween
    s+="        for(var oi2=0;oi2<kf.objects.length;oi2++){\n";
    s+="          var obj=kf.objects[oi2];\n";
    s+="          var node2=obj.type==='symbol'&&symbols[obj.symbolName]?symbols[obj.symbolName]():buildObj(obj);\n";
    s+="          this.addChild(node2);\n";
    s+="        }\n";
    s+="      }\n";
    s+="    });\n";
    s+="  })(f);\n";
    s+="}\n\n";
    s+="stage.start();\n";
    s+="})();\n";
    s+=sce+"\n</body>\n</html>";
    callback(s);
  });
}

// === Additional Export Formats ===

function renderFrameToCanvas(frameNum, w, h) {
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  var cx = c.getContext("2d");
  cx.fillStyle = doc.backgroundColor || "#FFFFFF";
  cx.fillRect(0, 0, w, h);
  var layers = currentLayers();
  for (var i = layers.length - 1; i >= 0; i--) {
    var layer = layers[i];
    if (!layer.visible) continue;
    var kf = layer.getKeyframeAt(frameNum);
    if (!kf) continue;
    if (kf.tweenType && kf.tweenType !== "none" && kf.duration > 1) {
      var ki = layer.keyframes.indexOf(kf);
      var nk = layer.keyframes[ki + 1];
      if (nk) {
        var raw = (frameNum - kf.index) / (kf.duration - 1 || 1);
        var ef = (typeof Flashy !== "undefined" && Flashy.Easing[kf.easing]) || function(t){return t;};
        var t = ef(Math.min(1, Math.max(0, raw)));
        for (var oi = 0; oi < kf.objects.length; oi++) {
          var a = kf.objects[oi], b = nk.objects[oi] || a;
          var interp = {}; for (var p in a) interp[p] = a[p];
          interp.x = a.x + (b.x - a.x) * t;
          interp.y = a.y + (b.y - a.y) * t;
          interp.width = a.width + (b.width - a.width) * t;
          interp.height = a.height + (b.height - a.height) * t;
          interp.rotation = (a.rotation||0) + ((b.rotation||0) - (a.rotation||0)) * t;
          interp.alpha = (a.alpha!=null?a.alpha:1) + ((b.alpha!=null?b.alpha:1) - (a.alpha!=null?a.alpha:1)) * t;
          _renderObjExport(cx, interp);
        }
        continue;
      }
    }
    for (var oi2 = 0; oi2 < kf.objects.length; oi2++) _renderObjExport(cx, kf.objects[oi2]);
  }
  return c;
}

function _renderObjExport(ctx, o) {
  ctx.save();
  ctx.translate(o.x||0, o.y||0);
  if (o.rotation) ctx.rotate(o.rotation * Math.PI / 180);
  ctx.scale(o.scaleX||1, o.scaleY||1);
  ctx.globalAlpha = o.alpha!=null ? o.alpha : 1;
  switch (o.type) {
    case "rect":
      if (o.fillAlpha > 0 && o.fillType !== "none") { ctx.fillStyle = o.fillColor||"#000"; ctx.fillRect(0,0,o.width,o.height); }
      if (o.strokeWidth > 0 && o.strokeStyle !== "none") { ctx.strokeStyle = o.strokeColor||"#000"; ctx.lineWidth = o.strokeWidth; ctx.strokeRect(0,0,o.width,o.height); }
      break;
    case "oval":
      ctx.beginPath(); ctx.ellipse(o.width/2, o.height/2, Math.abs(o.width/2), Math.abs(o.height/2), 0, 0, Math.PI*2);
      if (o.fillAlpha > 0 && o.fillType !== "none") { ctx.fillStyle = o.fillColor||"#000"; ctx.fill(); }
      if (o.strokeWidth > 0 && o.strokeStyle !== "none") { ctx.strokeStyle = o.strokeColor||"#000"; ctx.lineWidth = o.strokeWidth; ctx.stroke(); }
      break;
    case "line": case "pencil": case "brush":
      if (o.points && o.points.length >= 4) {
        ctx.beginPath(); ctx.moveTo(o.points[0], o.points[1]);
        for (var i = 2; i < o.points.length; i += 2) ctx.lineTo(o.points[i], o.points[i+1]);
        ctx.strokeStyle = o.type==="brush" ? (o.fillColor||"#000") : (o.strokeColor||"#000");
        ctx.lineWidth = o.type==="brush" ? (o.strokeWidth||1)*4 : (o.strokeWidth||1);
        ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      }
      break;
    case "text":
      ctx.font = (o.fontSize||24) + "px " + (o.font||"Arial");
      ctx.fillStyle = o.fillColor||"#000"; ctx.textBaseline = "top";
      ctx.fillText(o.text||"Text", 0, 0);
      break;
  }
  ctx.restore();
}

function exportAsGIF() {
  var maxF = currentMaxFrame(), w = doc.width, h = doc.height;
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
  var maxF = currentMaxFrame(), w = doc.width, h = doc.height;
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
  var rec = new MediaRecorder(stream, {mimeType: mime});
  rec.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = function() {
    var blob = new Blob(chunks, {type: mime});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url;
    a.download = "animation." + (mime.indexOf("webm") >= 0 ? "webm" : "mp4");
    a.click(); URL.revokeObjectURL(url);
    document.body.removeChild(st);
  };
  rec.start();
  var curF = 1;
  var iv = setInterval(function() {
    var fc = renderFrameToCanvas(curF, w, h);
    rCtx.clearRect(0, 0, w, h); rCtx.drawImage(fc, 0, 0);
    st.textContent = "Recording frame " + curF + " / " + maxF;
    curF++;
    if (curF > maxF) { clearInterval(iv); rec.stop(); }
  }, 1000 / doc.fps);
}

function exportAsSVG() {
  var w = doc.width, h = doc.height, layers = currentLayers();
  var s = '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">\n';
  s += '<rect width="'+w+'" height="'+h+'" fill="'+(doc.backgroundColor||"#fff")+'"/>\n';
  for (var i = layers.length - 1; i >= 0; i--) {
    var layer = layers[i]; if (!layer.visible) continue;
    var kf = layer.getKeyframeAt(1); if (!kf) continue;
    s += '<g id="'+layer.name.replace(/[^a-zA-Z0-9_]/g,"_")+'">\n';
    for (var j = 0; j < kf.objects.length; j++) s += _objToSVG(kf.objects[j]);
    s += '</g>\n';
  }
  s += '</svg>';
  dlFile(s, "animation.svg", "image/svg+xml");
}

function _objToSVG(o) {
  var tf = '';
  if (o.x||o.y) tf += 'translate('+(o.x||0)+','+(o.y||0)+') ';
  if (o.rotation) tf += 'rotate('+o.rotation+') ';
  if ((o.scaleX&&o.scaleX!==1)||(o.scaleY&&o.scaleY!==1)) tf += 'scale('+(o.scaleX||1)+','+(o.scaleY||1)+') ';
  var a = tf ? ' transform="'+tf.trim()+'"' : '';
  if (o.alpha!=null&&o.alpha<1) a += ' opacity="'+o.alpha+'"';
  var fl = o.fillType==="none" ? "none" : (o.fillColor||"#000");
  var st = (!o.strokeWidth||o.strokeStyle==="none") ? "none" : (o.strokeColor||"#000");
  var sw = o.strokeWidth||0;
  switch (o.type) {
    case "rect": return '<rect'+a+' width="'+o.width+'" height="'+o.height+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "oval": return '<ellipse'+a+' cx="'+o.width/2+'" cy="'+o.height/2+'" rx="'+Math.abs(o.width/2)+'" ry="'+Math.abs(o.height/2)+'" fill="'+fl+'" stroke="'+st+'" stroke-width="'+sw+'"/>\n';
    case "line": case "pencil": case "brush":
      if (!o.points||o.points.length<4) return '';
      var d = 'M'+o.points[0]+','+o.points[1];
      for (var i=2;i<o.points.length;i+=2) d+=' L'+o.points[i]+','+o.points[i+1];
      return '<path'+a+' d="'+d+'" fill="none" stroke="'+(o.type==="brush"?fl:st)+'" stroke-width="'+(o.type==="brush"?sw*4:sw)+'" stroke-linecap="round"/>\n';
    case "text":
      var txt = (o.text||"Text").replace(/&/g,"&amp;").replace(/</g,"&lt;");
      return '<text'+a+' font-size="'+(o.fontSize||24)+'" font-family="'+(o.font||"Arial")+'" fill="'+fl+'" dominant-baseline="hanging">'+txt+'</text>\n';
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
  var d = serializeDoc();
  var s = "// Flashy Animation Module\n";
  s += "// Usage: import { createAnimation } from './animation.js';\n";
  s += "//        createAnimation(document.getElementById('canvas'));\n\n";
  s += "export const sceneData = " + JSON.stringify(d, null, 2) + ";\n\n";
  s += "export function createAnimation(canvas, options) {\n";
  s += "  if (typeof Flashy === 'undefined') throw new Error('flashy.js must be loaded first');\n";
  s += "  options = options || {};\n";
  s += "  var stage = new Flashy.Stage(canvas, {\n";
  s += "    width: sceneData.width, height: sceneData.height,\n";
  s += "    fps: options.fps || sceneData.fps,\n";
  s += "    backgroundColor: parseInt((sceneData.backgroundColor||'#fff').replace('#',''),16)\n";
  s += "  });\n";
  s += "  var maxF = 1;\n";
  s += "  sceneData.layers.forEach(function(l){l.keyframes.forEach(function(k){var e=k.index+k.duration-1;if(e>maxF)maxF=e;});});\n";
  s += "  stage.root.timeline.setTotalFrames(maxF);\n";
  s += "  stage.root.loop = options.loop !== false;\n";
  s += "  function buildObj(o) {\n";
  s += "    var node;\n";
  s += "    if (o.type==='text') { node = new Flashy.TextField(o.text||'',{font:(o.fontSize||24)+'px '+(o.font||'Arial'),color:parseInt((o.fillColor||'#000').replace('#',''),16)}); }\n";
  s += "    else { node = new Flashy.Shape(); var g=node.graphics; var fc=parseInt((o.fillColor||'#000').replace('#',''),16);\n";
  s += "      if(o.fillType!=='none')g.beginFill(fc,o.fillAlpha!=null?o.fillAlpha:1);\n";
  s += "      if(o.strokeWidth>0&&o.strokeStyle!=='none')g.lineStyle(o.strokeWidth,parseInt((o.strokeColor||'#000').replace('#',''),16));\n";
  s += "      if(o.type==='rect')g.drawRect(0,0,o.width,o.height);\n";
  s += "      else if(o.type==='oval')g.drawEllipse(0,0,o.width,o.height);\n";
  s += "      else if(o.points&&o.points.length>=4){g.moveTo(o.points[0],o.points[1]);for(var i=2;i<o.points.length;i+=2)g.lineTo(o.points[i],o.points[i+1]);}\n";
  s += "      if(o.fillType!=='none')g.endFill();\n";
  s += "    }\n";
  s += "    node.x=o.x||0;node.y=o.y||0;node.rotation=(o.rotation||0)*Math.PI/180;\n";
  s += "    node.alpha=o.alpha!=null?o.alpha:1;node.scaleX=o.scaleX||1;node.scaleY=o.scaleY||1;\n";
  s += "    return node;\n";
  s += "  }\n";
  s += "  for(var f=1;f<=maxF;f++){(function(fr){stage.root.timeline.addFrameScript(fr,function(){\n";
  s += "    this.removeAllChildren();\n";
  s += "    for(var li=sceneData.layers.length-1;li>=0;li--){var la=sceneData.layers[li];if(la.visible===false)continue;\n";
  s += "      var kf=null;for(var ki=la.keyframes.length-1;ki>=0;ki--){var k=la.keyframes[ki];if(fr>=k.index&&fr<k.index+k.duration){kf=k;break;}}\n";
  s += "      if(!kf)continue;for(var oi=0;oi<kf.objects.length;oi++)this.addChild(buildObj(kf.objects[oi]));\n";
  s += "    }\n";
  s += "  });})(f);}\n";
  s += "  if (options.autoplay !== false) stage.start();\n";
  s += "  return stage;\n";
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
    result.points=pathPoints;
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
function initBottomTabs(){
  var tabs=document.querySelectorAll(".bottom-tab");
  var panels=document.querySelectorAll(".bottom-panel");
  for(var i=0;i<tabs.length;i++){
    (function(idx){
      tabs[idx].addEventListener("click",function(){
        for(var j=0;j<tabs.length;j++){
          tabs[j].className="bottom-tab"+(j===idx?" active":"");
          if(panels[j])panels[j].style.display=j===idx?"block":"none";
        }
      });
    })(i);
  }
}
function initPanelCollapse(){
  var headers=document.querySelectorAll(".panel-header");
  for(var i=0;i<headers.length;i++){
    (function(hdr){
      // Add collapse arrow indicator
      var arrow=document.createElement("span");
      arrow.className="panel-arrow";
      arrow.textContent="\u25BC";
      hdr.insertBefore(arrow,hdr.firstChild);
      hdr.addEventListener("click",function(){
        var body=hdr.nextElementSibling;
        var panel=hdr.parentElement;
        if(!body||!panel)return;
        var collapsed=body.style.display==="none";
        if(collapsed){
          body.style.display="";
          panel.style.flex="1";
          panel.style.minHeight="";
          arrow.textContent="\u25BC";
          arrow.style.transform="";
        }else{
          body.style.display="none";
          panel.style.flex="0 0 auto";
          panel.style.minHeight="0";
          arrow.textContent="\u25B6";
        }
      });
    })(headers[i]);
  }
}
function fullRefresh(){
  render();
  updateTL();
  updateProps();
  updateColorUI();
  updateLib();
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
  initBottomTabs();
  initPanelCollapse();
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
    setCurLayer: function(l){ curLayer = l; }
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
var aiMessages = [];
var aiApiKey = "";
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

function initAIPanel() {
  var panel = document.getElementById("aiPanel");
  if (!panel) return;

  var chat = document.createElement("div");
  chat.id = "ai-chat";
  panel.appendChild(chat);

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

  aiAddMsg("assistant", "I'm your Flash design assistant. I can create scenes, characters, animations, and interactive elements directly in your project.\n\nTry:\n\u2022 \"Create a sunset landscape with mountains and clouds\"\n\u2022 \"Add a bouncing red ball with motion tween\"\n\u2022 \"Build a button that glows on hover\"\n\u2022 \"Make a 30-frame walk cycle for a stick figure\"\n\u2022 \"Create a starfield background with parallax\"");
}

function aiAddMsg(role, text, applyCode) {
  var chat = document.getElementById("ai-chat");
  if (!chat) return;
  var div = document.createElement("div");
  div.className = "ai-msg " + role;
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (i > 0) div.appendChild(document.createElement("br"));
    var span = document.createElement("span");
    span.textContent = lines[i];
    div.appendChild(span);
  }
  if (applyCode) {
    var applyBtn = document.createElement("div");
    applyBtn.className = "ai-apply-btn";
    applyBtn.textContent = "\u25B6 Apply to Project";
    applyBtn.addEventListener("click", function() {
      aiApplyCode(applyCode);
      applyBtn.textContent = "\u2713 Applied";
      applyBtn.style.background = "#336633";
    });
    div.appendChild(applyBtn);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (role !== "system") {
    aiMessages.push({role: role, content: text});
  }
}

function aiSend() {
  var input = document.getElementById("ai-input");
  var text = input.value.trim();
  if (!text) return;
  input.value = "";

  if (!aiApiKey) {
    aiApiKey = prompt("Enter your Anthropic API key to use the AI assistant.\nGet one at console.anthropic.com\n\nYour key is stored in localStorage.\n\nTip: Set window.ANTHROPIC_API_KEY or add\n<meta name=\"anthropic-api-key\" content=\"sk-...\"> to skip this prompt.");
    if (!aiApiKey) return;
    localStorage.setItem("flashy_ai_key", aiApiKey);
  }

  aiAddMsg("user", text);

  var chat = document.getElementById("ai-chat");
  var typing = document.createElement("div");
  typing.className = "ai-typing";
  typing.textContent = "Creating...";
  chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  document.getElementById("ai-send").disabled = true;

  aiCallAPI(text, function(response, code) {
    if (typing.parentNode) typing.parentNode.removeChild(typing);
    document.getElementById("ai-send").disabled = false;
    if (response) {
      aiAddMsg("assistant", response, code || null);
    }
  });
}

function aiCallAPI(userText, callback) {
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

  var systemPrompt = "You are an expert Macromedia Flash 8 designer and ActionScript developer embedded in the Flashy Studio editor. You create intricate, elaborate, and visually stunning Flash-style vector animations and interactive content.\n\n" +
    "CURRENT PROJECT STATE:\n" + docState + "\n\n" +
    "EDITOR DATA MODEL:\n" +
    "- doc.width, doc.height, doc.fps, doc.backgroundColor (hex string like '#FFFFFF')\n" +
    "- doc.layers[] = array of Layer objects. doc.library = {} symbol definitions\n" +
    "- Layer has: name, visible, locked, keyframes[]\n" +
    "- KeyFrame has: index (1-based), duration, tweenType ('none'/'motion'/'shape'), easing (string), objects[], script\n" +
    "- EditorObject(type) where type = 'rect'|'oval'|'line'|'pencil'|'text'|'symbol'\n" +
    "  Properties: x, y, width, height, rotation, scaleX, scaleY, alpha,\n" +
    "  fillColor (hex), fillAlpha, strokeColor (hex), strokeAlpha, strokeWidth,\n" +
    "  points (array for line/pencil), text, font, fontSize, symbolName,\n" +
    "  blendMode, fillType, strokeStyle, strokeCap, strokeJoin\n\n" +
    "IMPORTANT: All code you generate runs as a <script> tag in the page. Access the editor through window._flashyAI (aliased as F).\n" +
    "Always start your code block with: var F = window._flashyAI;\n\n" +
    "AVAILABLE VIA F:\n" +
    "- F.doc — the document object (F.doc.width, F.doc.height, F.doc.fps, F.doc.backgroundColor, F.doc.layers, F.doc.library)\n" +
    "- F.pushUndo() — save undo state before changes\n" +
    "- F.fullRefresh() — redraw everything after changes\n" +
    "- F.currentLayers() — get the active layer array\n" +
    "- F.Layer(name) — constructor: new F.Layer(name)\n" +
    "- F.KeyFrame(index) — constructor: new F.KeyFrame(index)\n" +
    "- F.EditorObject(type) — constructor: new F.EditorObject(type)\n" +
    "- F.centerStage(), F.render(), F.updateTL(), F.updateProps()\n" +
    "- F.curFrame(), F.setCurFrame(n), F.curLayer(), F.setCurLayer(n)\n" +
    "- F.selection(), F.setSelection(arr)\n" +
    "- layer.insertKeyframe(frame), layer.extendToFrame(frame), layer.insertBlankKeyframe(frame)\n\n" +
    "INSTRUCTIONS:\n" +
    "When the user asks you to create something, respond with:\n" +
    "1. A brief description of what you'll create (2-3 sentences max)\n" +
    "2. Then a code block wrapped in ```flashy-code\\n ... ``` that manipulates the editor state\n\n" +
    "The code runs in the page scope via a script tag with access to window._flashyAI.\n" +
    "Always call F.pushUndo() first, then create layers/objects, then call F.fullRefresh().\n" +
    "To add layers: F.currentLayers().push(new F.Layer('name'));\n" +
    "To add objects to a keyframe: layer.keyframes[0].objects.push(obj);\n" +
    "Be creative and visually elaborate. Use rich colors, multiple layers, tweens with different easings.\n" +
    "For animations, create multiple keyframes with tweenType='motion' and set easing.\n" +
    "Position objects relative to F.doc.width and F.doc.height.\n" +
    "Use rich colors — avoid plain black on white unless specifically asked.\n" +
    "DO NOT explain the code. Just describe what you made and provide the code block.";

  var messages = [];
  var recent = aiMessages.slice(-6);
  for (var i = 0; i < recent.length; i++) {
    messages.push({role: recent[i].role, content: recent[i].content});
  }

  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": aiApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages
    })
  }).then(function(res) {
    if (!res.ok) {
      if (res.status === 401) {
        aiApiKey = "";
        localStorage.removeItem("flashy_ai_key");
        callback("API key invalid. Click Send again to enter a new key.");
        return;
      }
      return res.text().then(function(t) { callback("API error: " + t); });
    }
    return res.json();
  }).then(function(data) {
    if (!data) return;
    var text = "";
    if (data.content) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") text += data.content[i].text;
      }
    }
    var codeMatch = text.match(/```flashy-code\s*\n([\s\S]*?)```/);
    var code = codeMatch ? codeMatch[1].trim() : null;
    var displayText = text.replace(/```flashy-code\s*\n[\s\S]*?```/g, "").trim();
    if (!displayText && code) displayText = "Here's what I created:";
    callback(displayText, code);
  }).catch(function(err) {
    callback("Connection error: " + err.message);
  });
}

function aiApplyCode(code) {
  try {
    var script = document.createElement("script");
    script.textContent = code;
    document.head.appendChild(script);
    document.head.removeChild(script);
    fullRefresh();
  } catch(e) {
    aiAddMsg("system", "Error: " + e.message);
  }
}

})();
