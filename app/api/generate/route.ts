import OpenAI from 'openai';
import {timingSafeEqual} from 'node:crypto';
import {requestSchema,materialSchema,validateMaterial} from '../../../lib/schema';
import {timingPlan,shuffleQuestions} from '../../../lib/generator';
export const runtime='nodejs';export const maxDuration=60;
const attempts=new Map<string,{count:number,reset:number}>();
export async function POST(request:Request){
 try{
 if(!process.env.OPENAI_API_KEY||!process.env.APP_ACCESS_KEY)return Response.json({error:'Configure OPENAI_API_KEY and APP_ACCESS_KEY on the server.'},{status:503});
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>12000)return Response.json({error:'Request too large.'},{status:413});
 let payload:unknown;try{payload=JSON.parse(raw);}catch{return Response.json({error:'Invalid JSON.'},{status:400});}
 const parsed=requestSchema.safeParse(payload);if(!parsed.success)return Response.json({error:'Invalid form values.',details:parsed.error.issues.map(x=>x.message)},{status:400});
 const {accessKey,...settings}=parsed.data;
 const expected=Buffer.from(process.env.APP_ACCESS_KEY,'utf8'),received=Buffer.from(accessKey,'utf8');
 if(expected.length!==received.length||!timingSafeEqual(expected,received))return Response.json({error:'Incorrect access key.'},{status:401});
 const ip=(request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),now=Date.now(),entry=attempts.get(ip);
 if(entry&&entry.reset>now&&entry.count>=12)return Response.json({error:'Hourly generation limit reached.'},{status:429});
 attempts.set(ip,{count:entry&&entry.reset>now?entry.count+1:1,reset:entry&&entry.reset>now?entry.reset:now+3600000});
 const plan=timingPlan(settings.duration),client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:55000,maxRetries:0});
 const instructions=`You are an expert British English teacher of adults and bilingual English/French instructional designer. Return ONLY a valid JSON object with exactly these keys: title,summary,objectives (>=3 strings),level,focus,mode,duration,warmup {minutes,instructions},stages (>=2 objects {title,minutes,instructions,examples:string[]}),vocabulary (>=20 objects {english,french,example}),questions (>= ${settings.questionCount} objects {question,options:exactly four distinct strings,correctIndex:0-3,explanation}),speaking {minutes,instructions,prompts:>=5 strings},teacherNotes (>=3 strings),homework (>=2 strings). Every MCQ must have exactly one correct answer, with plausible distractors and useful explanations. Use British spelling and adult-appropriate examples. Vocabulary always has accurate English/French translations. Respect exact timing: warmup ${plan.warmup} minutes, stages ${JSON.stringify(plan.stages)}, speaking ${plan.speaking}, total ${settings.duration}. All content must be CEFR-appropriate, varied, factually sound and free of filler. Never invent sources.`;
 const completion=await client.chat.completions.create({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',response_format:{type:'json_object'},temperature:0.5,max_completion_tokens:10000,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(settings)}]});
 const content=completion.choices[0]?.message.content;if(!content)return Response.json({error:'AI returned no content.'},{status:502});
 const validated=materialSchema.safeParse(JSON.parse(content));if(!validated.success)return Response.json({error:'AI response failed schema checks. Please regenerate.'},{status:502});
 const material=shuffleQuestions(validated.data),issues=validateMaterial(material,parsed.data);
 if(issues.length)return Response.json({error:'Quality checks failed: '+issues.slice(0,3).join('; ')},{status:502});
 return Response.json({material});
 }catch(e){console.error('Generation error:',e instanceof Error?e.name:'unknown');return Response.json({error:'Generation failed. Check configuration or retry.'},{status:500});}
}
