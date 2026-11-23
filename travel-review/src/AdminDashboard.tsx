import {useEffect,useState,type FormEvent} from 'react';
import {Database,LockKeyhole,ArrowLeft,RefreshCw,LogOut,ExternalLink,ChevronLeft,ChevronRight,LoaderCircle} from 'lucide-react';
import './admin.css';

type Column={name:string;type:string;nullable:boolean;primaryKey:boolean};
type Table={name:string;count:number;columns:Column[]};
type Overview={storage:string;mode:string;database:{name:string;version:string};tables:Table[];dashboardUrl:string|null};
type Page={table:string;total:number;limit:number;offset:number;rows:Record<string,unknown>[]};
const names:Record<string,string>={destinations:'景點',reviews:'共用評價',place_web_snapshots:'網路來源快照',app_meta:'資料版本',visitors:'匿名訪客',admin_sessions:'管理登入'};
async function request<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,init);const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'讀取失敗。'),{status:response.status});return data as T;}
function Cell({value}:{value:unknown}){
 if(value===null)return <span className="db-null">NULL</span>;
 if(value==='')return <span className="db-null">空字串</span>;
 const text=typeof value==='object'?JSON.stringify(value,null,2):String(value);
 if(text.length>100||typeof value==='object')return <details className="db-cell-detail"><summary>{text.replaceAll('\n',' ').slice(0,75)}…</summary><pre>{text}</pre></details>;
 return <>{text}</>;
}
export default function AdminDashboard(){
 const [overview,setOverview]=useState<Overview|null>(null),[status,setStatus]=useState<'loading'|'locked'|'ready'>('loading');
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState('destinations'),[offset,setOffset]=useState(0),[data,setData]=useState<Page|null>(null),[rowBusy,setRowBusy]=useState(false),[version,setVersion]=useState(0),[tab,setTab]=useState<'rows'|'schema'>('rows');
 const table=overview?.tables.find(t=>t.name===selected);
 async function loadOverview(){
  try{const next=await request<Overview>('/api/admin/overview');setOverview(next);setStatus('ready');setError('');setVersion(v=>v+1);}
  catch(e){const err=e as Error&{status?:number};if(err.status===401){setStatus('locked');setOverview(null);}else setError(err.message);}
 }
 useEffect(()=>{void loadOverview();},[]);
 useEffect(()=>{
  if(status!=='ready')return;
  const abort=new AbortController();let current=true;setRowBusy(true);setData(null);
  request<Page>(`/api/admin/tables/${encodeURIComponent(selected)}?limit=25&offset=${offset}`,{signal:abort.signal})
   .then(next=>{if(current)setData(next);}).catch(e=>{if(current&&e.name!=='AbortError'){setError(e.message);if(e.status===401)setStatus('locked');}}).finally(()=>{if(current)setRowBusy(false);});
  return()=>{current=false;abort.abort();};
 },[status,selected,offset,version]);
 async function login(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await request('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});setPassword('');await loadOverview();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{await request('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});setStatus('locked');setOverview(null);setData(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="db-app">
  <header className="db-header"><a href="/" className="db-back"><ArrowLeft size={18}/>回到旅評小站</a><span><Database size={19}/>資料庫管理</span>{status==='ready'&&<button onClick={logout} disabled={busy}><LogOut size={16}/>登出</button>}</header>
  <main className="db-main">
   <div className="db-heading"><div><p className="db-eyebrow">TRAVEL NOTES · DATABASE</p><h1>看見資料的保存位置</h1><p>查看景點、共用評價、來源快照與資料表欄位。</p></div>{status==='ready'&&<button className="db-button" onClick={()=>{setOffset(0);void loadOverview();}}><RefreshCw size={17}/>重新讀取</button>}</div>
   {error&&<p className="db-error" role="alert">{error}</p>}
   {status==='loading'&&<div className="db-login"><LoaderCircle className="spin"/><p>正在確認管理者登入狀態…</p>{error&&<button className="db-button" onClick={()=>void loadOverview()}>重試</button>}</div>}
   {status==='locked'&&<section className="db-login"><div className="db-lock"><LockKeyhole size={30}/></div><h2>登入資料庫檢視</h2><p>使用主機環境變數 ADMIN_PASSWORD 設定的管理密碼。</p><form onSubmit={login}><label htmlFor="admin-password">管理密碼</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256}/><button className="db-button db-primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<LockKeyhole size={17}/>}登入管理頁</button></form><p className="db-help">正式雲端資料亦可在自己的 Supabase 專案中開啟 Table Editor 查看。</p></section>}
   {status==='ready'&&overview&&<>
    <div className={`db-location ${overview.mode==='local-demo'?'db-demo':''}`}><Database size={24}/><div><strong>{overview.mode==='local-demo'?'本機驗證資料庫 · PGlite':'線上共用資料庫 · PostgreSQL'}</strong><p>{overview.mode==='local-demo'?'此模式使用本機 PostgreSQL 測試引擎；部署並連接 Supabase 後才會顯示雲端共用資料。':`連線中的資料庫：${overview.database.name}。此頁直接讀取後端正在使用的資料庫。`}</p></div>{overview.dashboardUrl&&<a className="db-button" href={overview.dashboardUrl} target="_blank" rel="noreferrer">開啟 Supabase<ExternalLink size={16}/></a>}</div>
    <div className="db-stats">{['destinations','reviews','visitors'].map(name=><div key={name}><span>{names[name]}</span><strong>{overview.tables.find(t=>t.name===name)?.count??0}</strong><small>筆資料</small></div>)}</div>
    <div className="db-workspace"><aside className="db-sidebar"><h2>資料表</h2>{overview.tables.map(t=><button className={t.name===selected?'selected':''} key={t.name} onClick={()=>{setSelected(t.name);setOffset(0);setTab('rows');}}><span><strong>{names[t.name]||t.name}</strong><small>{t.name}</small></span><b>{t.count}</b></button>)}<p>檢視頁為唯讀。景點與個人評價請從網站操作，資料表維護可在 Supabase 進行。</p></aside>
     <section className="db-content"><div className="db-table-title"><div><h2>{names[selected]||selected}</h2><p>{selected} · {table?.count??0} 筆 · {table?.columns.length??0} 個欄位</p></div><div className="db-tabs"><button className={tab==='rows'?'selected':''} onClick={()=>setTab('rows')}>資料列</button><button className={tab==='schema'?'selected':''} onClick={()=>setTab('schema')}>欄位定義</button></div></div>
      {tab==='schema'?<div className="db-table-scroll"><table><thead><tr><th>欄位名稱</th><th>資料型別</th><th>允許 NULL</th><th>主鍵</th></tr></thead><tbody>{table?.columns.map(c=><tr key={c.name}><td>{c.name}</td><td>{c.type}</td><td>{c.nullable?'是':'否'}</td><td>{c.primaryKey?'PK':''}</td></tr>)}</tbody></table></div>:rowBusy?<div className="db-loading"><LoaderCircle className="spin"/>讀取資料中…</div>:<><div className="db-table-scroll"><table><thead><tr>{table?.columns.map(c=><th key={c.name}>{c.name}</th>)}</tr></thead><tbody>{data?.rows.map((row,i)=><tr key={i}>{table?.columns.map(c=><td key={c.name}><Cell value={row[c.name]}/></td>)}</tr>)}</tbody></table>{data?.rows.length===0&&<p className="db-empty">這張資料表目前沒有資料。</p>}</div><div className="db-pagination"><span>{data&&data.total>0?`${data.offset+1}–${Math.min(data.offset+data.limit,data.total)} / ${data.total} 筆`:'0 筆資料'}</span><div><button aria-label="上一頁" disabled={offset===0||rowBusy} onClick={()=>setOffset(o=>Math.max(0,o-25))}><ChevronLeft size={19}/></button><button aria-label="下一頁" disabled={!data||offset+25>=data.total||rowBusy} onClick={()=>setOffset(o=>o+25)}><ChevronRight size={19}/></button></div></div></>}
     </section></div><p className="db-engine">{overview.database.version}</p>
   </>}
  </main>
 </div>;
}
