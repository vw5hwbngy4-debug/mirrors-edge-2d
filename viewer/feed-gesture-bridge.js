(function(){
'use strict';
let start=null;
function begin(e){
  if(!e.touches||e.touches.length!==1){start=null;return;}
  const t=e.touches[0];
  start={x:t.clientX,y:t.clientY,t:performance.now()};
}
function end(e){
  if(!start)return;
  const t=e.changedTouches&&e.changedTouches[0];
  if(!t){start=null;return;}
  const dx=t.clientX-start.x,dy=t.clientY-start.y,dt=performance.now()-start.t;
  start=null;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  // "Swipe" is deliberately a fast, long flick. Normal drags stay with OrbitControls.
  if(dt>520||Math.max(ax,ay)<96)return;
  if(ax>ay*1.45){
    if(dx>0)parent.postMessage({type:'spawnmap:openIterations'},'*');
  }else if(ay>ax*1.45){
    parent.postMessage({type:'spawnmap:mapSwipe',delta:dy<0?1:-1},'*');
  }
}
addEventListener('touchstart',begin,{capture:true,passive:true});
addEventListener('touchend',end,{capture:true,passive:true});
addEventListener('touchcancel',()=>{start=null},{capture:true,passive:true});

addEventListener('keydown',e=>{
  if(e.key==='ArrowRight')parent.postMessage({type:'spawnmap:openIterations'},'*');
  else if(e.key==='ArrowUp')parent.postMessage({type:'spawnmap:mapSwipe',delta:-1},'*');
  else if(e.key==='ArrowDown')parent.postMessage({type:'spawnmap:mapSwipe',delta:1},'*');
});
})();