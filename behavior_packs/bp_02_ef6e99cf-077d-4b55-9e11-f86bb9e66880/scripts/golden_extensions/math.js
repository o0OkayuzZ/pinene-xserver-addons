export const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const unit=a=>length(a)>1e-8?mul(a,1/length(a)):{x:0,y:0,z:0};
export const distance=(a,b)=>length(sub(a,b));
export const finite=p=>['x','y','z'].every(k=>Number.isFinite(p[k]));
export function turnToward(velocity,toward,maxAngle=Math.PI/30){
 const speed=length(velocity),a=unit(velocity),b=unit(toward);
 if(speed<1e-6||length(b)<1e-6)return velocity;
 const angle=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));
 if(angle<maxAngle)return mul(b,speed);
 // Antiparallel vectors have no unique turning plane: keep flying forward.
 if(Math.PI-angle<1e-5)return velocity;
 const t=maxAngle/angle,s=Math.sin(angle);
 return mul(add(mul(a,Math.sin((1-t)*angle)/s),mul(b,Math.sin(t*angle)/s)),speed);
}
export function selectTarget(origin,view,candidates,ownerId,visible=()=>true){
 let best,score=-1;
 for(const p of candidates){
  if(p.id===ownerId)continue;
  const v=sub(p.point,origin),d=length(v),alignment=dot(unit(v),unit(view));
  if(d>32||d<0.01||alignment<Math.cos(Math.PI/9)||!visible(p))continue;
  if(alignment>score){best=p;score=alignment;}
 }
 return best;
}
export function parseAxis(text,base){
 const s=String(text).trim();
 if(!/^(?:~(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+))?|[+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.test(s))throw Error('座標は数値または ~ 記法で入力してください。');
 const n=s.startsWith('~')?base+Number(s.slice(1)||0):Number(s);
 if(!Number.isFinite(n)||Math.abs(n)>30000000)throw Error('座標が範囲外です。');
 return n;
}
export function limits(dimension,enchanted){
 const end=dimension==='minecraft:the_end';
 return {blink:enchanted?(end?96:64):24,coordinate:end?1024:256};
}
