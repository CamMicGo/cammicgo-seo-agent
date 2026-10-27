/** Optional modules: never request extra OAuth scopes during an SEO-only login. */
export type GoogleModule='seo'|'calendar'|'youtube'|'google_ads'|'workspace';
export const modules={
 seo:{label:'Search Console & Analytics',state:'web-dashboard' as const,scopes:['https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly'],api:['searchconsole.googleapis.com','analyticsdata.googleapis.com','analyticsadmin.googleapis.com'],risk:'read-only'},
 calendar:{label:'Google Calendar',state:'planned' as const,scopes:['https://www.googleapis.com/auth/calendar.events.readonly'],api:['calendar-json.googleapis.com'],risk:'personal-schedule'},
 youtube:{label:'YouTube Data',state:'planned' as const,scopes:['https://www.googleapis.com/auth/youtube.readonly'],api:['youtube.googleapis.com'],risk:'channel-data'},
 google_ads:{label:'Google Ads',state:'planned' as const,scopes:['https://www.googleapis.com/auth/adwords'],api:['googleads.googleapis.com'],risk:'advertiser-data'},
 workspace:{label:'Google Workspace',state:'planned' as const,scopes:[],api:[],risk:'requires-separate-scope-design'}
} satisfies Record<GoogleModule,{label:string;state:string;scopes:string[];api:string[];risk:string}>;
export const availableReadOnlyModules=Object.entries(modules).filter(([,module])=>module.state==='web-dashboard').map(([id])=>id);
