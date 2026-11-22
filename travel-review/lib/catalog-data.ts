import type {Place,RegionId} from './travel-data';
export const CITIES_BY_REGION:Record<RegionId,string[]>={
  north:['臺北市','新北市','基隆市','桃園市','新竹市','新竹縣','宜蘭縣'],
  central:['苗栗縣','臺中市','彰化縣','南投縣','雲林縣'],
  south:['嘉義市','嘉義縣','臺南市','高雄市','屏東縣'],east:['花蓮縣','臺東縣'],
};
export const PLACE_CATEGORIES=['自然風景','水岸散步','老街文化','藝術街區','博物展館','城市公園','夜市美食'];
export function placeKey(name:string,city:string){return `${city.replace(/^台/,'臺')}|${name.normalize('NFKC').replace(/\s/g,'').replace(/台/g,'臺').toLocaleLowerCase('zh-TW')}`;}
export function validatePlace(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('景點格式不正確');
  const b=input as Record<string,unknown>;
  const field=(key:string,max:number,required=false)=>{const v=b[key];if((v===undefined||v===null)&&!required)return '';if(typeof v!=='string'||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v))throw new Error('景點欄位格式不正確');const s=v.trim();if((required&&!s)||s.length>max)throw new Error(`${key==='name'?'景點名稱':'景點資料'}長度不符合限制`);return s;};
  const name=field('name',60,true);if(name.length<2)throw new Error('景點名稱至少填寫 2 個字');
  const region=field('region',10,true) as RegionId;
  if(!Object.hasOwn(CITIES_BY_REGION,region))throw new Error('請選擇有效地區');
  const city=field('city',20,true).replace(/^台/,'臺');if(!CITIES_BY_REGION[region].includes(city))throw new Error('縣市與所選地區不符');
  const category=field('category',20,true);if(!PLACE_CATEGORIES.includes(category))throw new Error('請選擇有效景點類型');
  const list=(key:string)=>{const value=b[key];if(value===undefined||value===null||value==='')return [];if(typeof value!=='string'&&(!Array.isArray(value)||!value.every(x=>typeof x==='string')))throw new Error('特色與注意事項格式不正確');const a=(typeof value==='string'?value.split(/\r?\n/):value as string[]).map(x=>x.trim()).filter(Boolean);if(a.length>6||a.some(x=>x.length>100))throw new Error('特色或注意事項最多 6 點，每點最多 100 字');return [...new Set(a)];};
  const source=field('source',500);if(source){let u:URL;try{u=new URL(source)}catch{throw new Error('參考連結請使用完整網址')}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('參考連結必須是 http 或 https 網址');}
  return {name,region,city,district:field('district',40),address:field('address',200),category,description:field('description',600),features:list('features'),drawbacks:list('drawbacks'),source,tags:[] as string[],tone:({north:'mountain',central:'green',south:'clay',east:'sea'} as const)[region],dedupeKey:placeKey(name,city)};
}