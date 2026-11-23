import type {Material} from './schema';
export function timingPlan(duration:number){
 const warmup=Math.round(duration*.1),speaking=Math.round(duration*.2),remaining=duration-warmup-speaking;
 const first=Math.floor(remaining*.32),second=Math.floor(remaining*.34);
 return {warmup,speaking,stages:[first,second,remaining-first-second]};
}
export function shuffleQuestions(material:Material):Material{
 return {...material,questions:material.questions.map(q=>{
 const a=q.options.map((option,i)=>({option,correct:i===q.correctIndex}));
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
 return {...q,options:a.map(x=>x.option),correctIndex:a.findIndex(x=>x.correct)};
 })};
}
