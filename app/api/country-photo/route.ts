import {NextRequest,NextResponse} from 'next/server';
export const runtime='nodejs';
const landmarks:Record<string,string>={JP:'Mount Fuji cherry blossom photograph',US:'Statue of Liberty New York photograph',FR:'Eiffel Tower Paris panorama photo',GB:'Big Ben London photograph',DE:'Brandenburg Gate Berlin photograph',CN:'Great Wall China photograph',KR:'Gyeongbokgung Palace Seoul photograph',IN:'Taj Mahal Agra photograph',CA:'Banff Lake Louise mountains photograph',AU:'Sydney Opera House photograph',BR:'Christ the Redeemer Rio photograph',RU:'Saint Basil Cathedral Moscow photograph',IT:'Colosseum Rome photograph',ES:'Sagrada Familia Barcelona photograph',MX:'Chichen Itza Yucatan photograph',ID:'Borobudur temple Indonesia photograph',NL:'Amsterdam canals photograph',BE:'Grand Place Brussels photograph',UA:'Saint Sophia Cathedral Kyiv photograph',PL:'Wawel Castle Krakow photograph',TR:'Hagia Sophia Istanbul photograph',ZA:'Table Mountain Cape Town photograph',NZ:'Milford Sound New Zealand photograph',AE:'Burj Khalifa Dubai photograph',EG:'Pyramids of Giza photograph',SG:'Marina Bay Sands Singapore photograph',TW:'Taipei 101 photograph',HK:'Victoria Harbour Hong Kong photograph',AR:'Iguazu falls Argentina photograph',VN:'Ha Long Bay Vietnam photograph',TH:'Wat Arun Bangkok photograph',SA:'Al Ula Saudi Arabia photograph',PT:'Lisbon Belem Tower photograph',CH:'Matterhorn Swiss Alps photograph'};
const verified:Record<string,{file:string;credit:string;license:string}>={
JP:{file:'Mount Fuji April Cherry Blossom.jpg',credit:'SRP1998',license:'CC BY-SA 4.0'},
FR:{file:'Eiffel tower, Paris, France.jpg',credit:'AMarmotNamedPhilX',license:'CC0'},
US:{file:'Statue of Liberty - New York City.jpg',credit:'Anthony DELANOIX',license:'CC0'},
GB:{file:'Big-Ben-London.jpg',credit:'Pinguinguy',license:'CC0'},
DE:{file:'Brandenburg Gate, Berlin Germany.jpg',credit:'Skepticalism',license:'CC0'},
CN:{file:'Great Wall of China at Juyong Pass7.jpg',credit:'Huangdan2060',license:'CC0'},
KR:{file:'Gyeongbokgung 20260909 113057.jpg',credit:'Endearing9721',license:'CC0'},
IT:{file:'Colosseum Rome 16.06.2025.jpg',credit:'Coccine',license:'CC0'}
};
function plain(html:string){return html.replace(/<[^>]+>/g,'').replace(/&[^;]+;/g,' ').trim().slice(0,120)}
export async function GET(request:NextRequest){
 const code=(request.nextUrl.searchParams.get('country')||'').toUpperCase();
 if(!/^[A-Z]{2}$/.test(code))return NextResponse.json({error:'Invalid country code'},{status:400});
 const curated=verified[code];if(curated){const uri='https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(curated.file)+'?width=1200';return NextResponse.json({country:code,available:true,imageUrl:uri,sourceUrl:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(curated.file.replace(/ /g,'_')),credit:curated.credit,license:curated.license,caption:curated.file},{headers:{'Cache-Control':'public,s-maxage=86400'}})}
 const label=new Intl.DisplayNames(['en'],{type:'region'}).of(code)||code;
 const search=landmarks[code]||label+' scenic landmark landscape photograph';
 const url=new URL('https://commons.wikimedia.org/w/api.php');
 for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:'filetype:bitmap '+search,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1200',format:'json',origin:'*'}))url.searchParams.set(k,v);
 try{
  const response=await fetch(url,{next:{revalidate:86400},headers:{'User-Agent':'CamMicGoSEOAgent/0.1 (https://seo.cammicgo.com)'}});
  if(!response.ok)throw Error('Photo search unavailable');
  const body=await response.json() as {query?:{pages?:Record<string,{title:string;imageinfo?:Array<{thumburl?:string;descriptionurl?:string;extmetadata?:Record<string,{value:string}>}>}>}};
  const matches=Object.values(body.query?.pages||{}).filter(page=>/\.(jpe?g|png|webp)$/i.test(page.title)).map(page=>({title:page.title,...page.imageinfo?.[0]}));
  const picture=matches.find(item=>{const license=item.extmetadata?.LicenseShortName?.value||'';return !!item.thumburl&&/^(CC0|CC BY|Public domain)/i.test(license)}) ;
  if(!picture)return NextResponse.json({country:code,available:false},{headers:{'Cache-Control':'public,max-age=3600'}});
  const meta=picture.extmetadata||{};
  return NextResponse.json({country:code,available:true,imageUrl:picture.thumburl,sourceUrl:picture.descriptionurl,credit:plain(meta.Artist?.value||'Wikimedia Commons contributor'),license:plain(meta.LicenseShortName?.value||'Creative Commons'),caption:plain(meta.ImageDescription?.value||picture.title)},{headers:{'Cache-Control':'public,s-maxage=86400,stale-while-revalidate=604800'}});
 }catch{return NextResponse.json({country:code,available:false},{headers:{'Cache-Control':'public,max-age=300'}})}
}
