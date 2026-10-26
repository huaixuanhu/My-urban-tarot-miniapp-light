import { CanvasTexture, SRGBColorSpace } from 'three';
let math:CanvasTexture | undefined;
/** Draw from the accepted formula source, never OCR from the concept image. */
export function createMathBoardTexture():CanvasTexture {
 if(math)return math;
 // Keep layout coordinates stable while giving the close camera a sharper source.
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2560;
 const c=canvas.getContext('2d')!;c.scale(canvas.width/1600,canvas.height/2000);
 c.fillStyle='#faf9f3';c.fillRect(0,0,1600,2000);
 const ink='#293b3b';
 const line=(points:number[][],color=ink,width=4)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 // A light marker outline preserves fine italic strokes after oblique minification.
 const text=(s:string,x:number,y:number,size=48,color=ink)=>{
  c.fillStyle=color;c.strokeStyle=color;c.lineWidth=.9;
  c.font=`italic ${size}px "Georgia", "Times New Roman", serif`;
  c.strokeText(s,x,y);c.fillText(s,x,y);
 };
 // Two small diagrams, with considerable whitespace around each.
 line([[140,580],[670,680]]);line([[140,580],[140,280]]);line([[140,580],[265,500]]);
 text('t',665,720,40);text('S',112,255,40);text('Ω',260,493,40);text('t₀',338,673,36);text('T',600,710,36);
 const past:number[][]=[];for(let i=0;i<=28;i++)past.push([140+i*7.6,476+Math.sin(i*.55)*12-i*.7]);line(past,'#b55448',7);
 line([[354,330],[354,625]],'#7e91a4',4);line([[610,310],[610,675]],'#7e91a4',4);
 for(let j=0;j<5;j++){const p:number[][]=[];for(let i=0;i<31;i++)p.push([354+i*8.5,457+(j-2)*i*1.9+Math.sin(i*.34+j)*i*.32]);line(p,['#8d78ad','#6774a1','#5e8397','#8b7ca9','#9583b0'][j],4.5);}
 const density:number[][]=[];for(let i=0;i<=40;i++){const y=340+i*7;density.push([610+80*Math.exp(-(((y-470)/87)**2)),y]);}line(density,'#b97840',6);
 c.fillStyle='#b55448';c.beginPath();c.arc(354,457,8,0,Math.PI*2);c.fill();
 // Illustrative call price surface: K rightwards, tau backwards, C vertical.
 const project=(k:number,t:number,value:number)=>[925+300*k+155*t,625+70*k-110*t-220*value];
 for(let j=0;j<=8;j++){const p:number[][]=[];for(let i=0;i<=24;i++){const k=i/24,t=j/8;p.push(project(k,t,.82*Math.exp(-k*2.3)+t*.27));}line(p,'#527d89',3.6);}
 for(let j=0;j<=9;j++){const p:number[][]=[];for(let i=0;i<=24;i++){const k=j/9,t=i/24;p.push(project(k,t,.82*Math.exp(-k*2.3)+t*.27));}line(p,'#527d89',3.6);}
 line([[925,625],[1245,703]]);line([[925,625],[1093,505]]);line([[925,625],[925,255]]);
 text('K',1265,733,40);text('τ',1095,508,40);text('C',904,228,40);
 // Measured token spacing keeps the handwritten-style formulae readable without
 // letting larger subscripts collide with neighbouring symbols.
 function run(s:string,x:number,y:number,size=66){text(s,x,y,size);return x+c.measureText(s).width;}
 const left=115;
 let x=left;const y=1010;
 x=run('𝔼[Y | 𝒢] = ',x,y);const argX=x;x=run('arg min',x,y,62)+30;
 run('Z ∈ L²(𝒢)',argX-6,y+58,40);run('𝔼[(Y − Z)²]',x,y);
 x=run('𝐗 ∼ E',180,1290,68);x=run('d',x-1,1309,42)+12;run('(𝝁, Σ, ψ),',x,1290,68);
 x=run('L = λ',180,1430,68);x=run('0',x-1,1449,42)+14;
 x=run('+ 𝝀',x,1430,68);x=run('⊤',x+1,1390,42)+8;run('𝐗.',x,1430,68);
 x=run('ES',left,1700);x=run('α',x-1,1724,42)+5;x=run('(L) =',x,1700)+24;
 run('1',x+47,1664,62);line([[x,1684],[x+154,1684]],ink,4.5);run('1 − α',x+1,1753,54);x+=182;
 run('∫',x,1724,108);run('1',x+46,1629,40);run('α',x+33,1767,40);x+=98;
 x=run('VaR',x,1700);x=run('u',x-1,1724,42)+4;run('(L) du.',x,1700);
 math=new CanvasTexture(canvas);math.colorSpace=SRGBColorSpace;math.anisotropy=16;return math;
}
