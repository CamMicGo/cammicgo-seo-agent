'use client';
import {useLang} from '@/app/lang-provider';
/** Same hook name as cammicgo.com, backed by this site's LangProvider. */
export function useSiteLanguage(){return useLang().lang;}
