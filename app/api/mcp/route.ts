import {createMcpHandler} from 'mcp-handler';
import {z} from 'zod';

/** Public preview: no Google user data or credentials are exposed until OAuth is verified. */
const handler=createMcpHandler(server=>{
  server.registerTool('service_info',{
    title:'CamMicGo SEO Agent information',
    description:'Get supported capabilities and the current authentication status. No account data is accessed.',
    inputSchema:z.object({}),
  },async()=>({content:[{type:'text',text:JSON.stringify({name:'CamMicGo SEO Agent',version:'0.1.0',state:'public-preview',googleConnection:'not-enabled',planned:['Search Console read-only','GA4 read-only','keyword opportunities'],website:'https://www.cammicgo.com'})}]}));
});
export const runtime='nodejs';
export const GET=handler;
export const POST=handler;
