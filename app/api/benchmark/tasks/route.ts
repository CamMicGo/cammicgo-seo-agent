import {NextResponse} from 'next/server';
import {MODE_INSTRUCTIONS,TASKS} from '@/lib/benchmark';
export const runtime='nodejs';
/** Public list of benchmark tasks with the prompts for both modes. */
export function GET(){return NextResponse.json({tasks:TASKS,modes:MODE_INSTRUCTIONS},{headers:{'Cache-Control':'public, max-age=300'}});}
