import {z} from 'zod';
export const focusOptions=['General English','Grammar & Vocabulary','Speaking & Listening','Reading & Writing','Business English','TOEIC / CLOE Preparation','Hospitality','Journalism','Assistant Commercial','Transport & Logistics','Custom'] as const;
export const modeOptions=['Complete lesson','Vocabulary bank','Grammar workshop','Exercises','Speaking activities','Assessment','Kahoot quiz'] as const;
export const requestSchema=z.object({focus:z.enum(focusOptions),mode:z.enum(modeOptions),level:z.enum(['A0','A1','A2','B1','B2','C1','C2','Mixed']),duration:z.number().int().min(30).max(240),learners:z.number().int().min(1).max(60),language:z.enum(['English','French','Bilingual']),format:z.enum(['In person','Online','Individual']),topic:z.string().trim().min(3).max(600),instructions:z.string().max(1200),questionCount:z.number().int().min(10).max(30),accessKey:z.string().max(200)});
export type GenerateRequest=z.infer<typeof requestSchema>;
const vocab=z.object({english:z.string().min(1),french:z.string().min(1),example:z.string().min(1)});
const question=z.object({question:z.string().min(1),options:z.array(z.string().min(1)).length(4),correctIndex:z.number().int().min(0).max(3),explanation:z.string().min(1)});
export const materialSchema=z.object({title:z.string().min(3),summary:z.string().min(10),objectives:z.array(z.string()).min(3),level:z.string(),focus:z.string(),mode:z.string(),duration:z.number().int(),warmup:z.object({minutes:z.number().int().nonnegative(),instructions:z.string()}),stages:z.array(z.object({title:z.string(),minutes:z.number().int().nonnegative(),instructions:z.string(),examples:z.array(z.string())})).min(2),vocabulary:z.array(vocab).min(20),questions:z.array(question).min(10),speaking:z.object({minutes:z.number().int().nonnegative(),instructions:z.string(),prompts:z.array(z.string()).min(5)}),teacherNotes:z.array(z.string()).min(3),homework:z.array(z.string()).min(2)});
export type Material=z.infer<typeof materialSchema>;
export function validateMaterial(m:Material,req:GenerateRequest):string[]{
 const errors:string[]=[];
 if(m.questions.length<req.questionCount)errors.push('Too few questions');
 if(m.duration!==req.duration)errors.push('Incorrect duration');
 if(m.warmup.minutes+m.speaking.minutes+m.stages.reduce((n,s)=>n+s.minutes,0)!==req.duration)errors.push('Lesson timings do not add up');
 const seen=new Set<string>();
 for(const [i,q] of m.questions.entries()){
 const key=q.question.trim().toLowerCase();if(seen.has(key))errors.push('Duplicate question '+(i+1));seen.add(key);
 if(new Set(q.options.map(o=>o.trim().toLowerCase())).size!==4)errors.push('Duplicate answer choices '+(i+1));
 if(q.question.trim().length<12||q.explanation.trim().length<12)errors.push('Question or explanation too short '+(i+1));
 }
 const vocabSeen=new Set<string>();
 for(const v of m.vocabulary){const key=v.english.trim().toLowerCase();if(vocabSeen.has(key))errors.push('Duplicate vocabulary '+key);vocabSeen.add(key);}
 return errors;
}
