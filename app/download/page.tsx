import type {Metadata} from 'next';
import AndroidDownloadPage from './android/page';
export const metadata:Metadata={title:'Téléchargements CamMicGo SEO MCP',description:'Téléchargez et testez CamMicGo SEO MCP pour Android.'};
export default function DownloadPage(){return <AndroidDownloadPage/>}
