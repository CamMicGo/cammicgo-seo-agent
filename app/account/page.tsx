import type {Metadata} from 'next';
import AccountView from './account-view';
export const metadata:Metadata={title:'My account | CamMicGo SEO MCP',description:'Sign in, save your own Google Cloud OAuth client, connect Google and check your daily usage.'};
export default function AccountPage(){return <AccountView/>;}
