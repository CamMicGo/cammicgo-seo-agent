import {z} from 'zod';
/**
 * Some chat apps keep an old copy of a tool's schema and send newer object/array arguments as JSON text.
 * Each object/array field then also accepts that text, parsed and validated against the same schema.
 */
export function lenientJson<T extends z.ZodRawShape>(o:z.ZodObject<T>){
 const parse=(v:string,ctx:z.RefinementCtx)=>{try{return JSON.parse(v) as unknown;}catch{ctx.addIssue({code:'custom',message:'Invalid JSON'});return z.NEVER;}};
 const shape:Record<string,z.ZodType>={};
 for(const [k,t] of Object.entries(o.shape) as Array<[string,z.ZodType]>){
  let base:z.ZodType=t;
  while(base instanceof z.ZodDefault||base instanceof z.ZodOptional)base=(base as unknown as {unwrap:()=>z.ZodType}).unwrap();
  shape[k]=base instanceof z.ZodArray||base instanceof z.ZodObject?z.union([t,z.string().max(60000).transform(parse).pipe(t)]):t;
 }
 return z.object(shape);
}
