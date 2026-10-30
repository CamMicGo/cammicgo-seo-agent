import type {Metadata} from 'next';
import AndroidView from './android-view';

export const metadata:Metadata={
 title:'CamMicGo SEO MCP for Android',
 description:'Download the CamMicGo SEO MCP Android app (test APK) to fetch YouTube transcripts from your phone.',
};
export default function AndroidDownloadPage(){return <AndroidView/>;}
