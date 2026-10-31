import type {Metadata} from 'next';
import LinkedInGuide from './linkedin-view';
export const metadata:Metadata={title:'Publish on LinkedIn | CamMicGo SEO MCP',description:'Connect your own LinkedIn app to CamMicGo and publish posts with images or videos on your profile from your AI assistant, always after your explicit confirmation.'};
export default function SetupLinkedIn(){return <LinkedInGuide/>;}
