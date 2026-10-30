import {redirect} from 'next/navigation';
/** Google is now connected from the signed-in account page (own Google Cloud project). */
export default function Connect(){redirect('/account');}
