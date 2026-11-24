import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Database,LockKeyhole,ArrowLeft,RefreshCw,LogOut,ExternalLink,ChevronLeft,ChevronRight,LoaderCircle,Trash2} from 'lucide-react';
import AdminDeleteDialog,{type DeleteTarget,type DeleteResult} from './AdminDeleteDialog';
import './admin.css';

type Column={name:string;type:string;nullable:boolean;primaryKey:boolean};
type Table={name:string;count:number;columns:Column[]};
type Overview={storage:string;mode:string;database:{name:string;version:string};tables:Table[];dashboardUrl:string|null;deletableTables:string[]};
type Page={table:string;total:number;limit:number;offset:number;rows:Record<string,unknown>[]};
const names:Record<string,string>={destinations:'景點',reviews:'共用評價',place_web_snapshots:'網路來源快照',app_meta:'資料版本',visitors:'匿名訪客',admin_sessions:'管理登入'};
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,init),data=await response.json();
 if(!response.ok)throw Object.assign(new Error(data.error||'讀取失敗。'),{status:response.status});
 return data as T;
}
function Cell({value}:{value:unknown}){
 if(value===null)return <span className="db-null">NULL</span>;
 if(value==='')return <span className="db-null">空字串</span>;
 const text=typeof value==='object'?JSON.stringify(value,null,2):String(value);
 if(text.length>100||typeof value==='object')return <details className="db-cell-detail"><summary>{text.replaceAll('\n',' ').slice(0,75)}…</summary><pre>{text}</pre></details>;
 return <>{text}</>;
}
export default function AdminDashboard(){
 const [overview,setOverview]=useState<Overview|null>(null),[status,setStatus]=useState<'loading'|'locked'|'ready'>('loading');
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState('destinations'),[offset,setOffset]=useState(0),[data,setData]=useState<Page|null>(null),[rowBusy,setRowBusy]=useState(false),[version,setVersion]=useState(0),[tab,setTab]=useState<'rows'|'schema'>('rows');
 const [deletion,setDeletion]=useState<DeleteTarget|null>(null);
 const table=overview?.tables.find(item=>item.name===selected);
 const canDelete=overview?.deletableTables?.includes(selected)??false;
 const lock=useCallback(()=>{setStatus('locked');setOverview(null);setData(null);setDeletion(null);setNotice('');},[]);
 async function loadOverview(){
  try{
   const next=await request<Overview>('/api/admin/overview');
   setOverview(next);setStatus('ready');setError('');setVersion(value=>value+1);
   const count=next.tables.find(item=>item.name===selected)?.count??0;
   setOffset(value=>Math.min(value,Math.max(0,Math.floor((count-1)/25)*25)));
  }catch(reason){const failure=reason as Error&{status?:number};if(failure.status===401)lock();else setError(failure.message);}
 }
 useEffect(()=>{void loadOverview();},[]);
 useEffect(()=>{
  if(status!=='ready')return;
  const abort=new AbortController();let current=true;setRowBusy(true);setData(null);
  request<Page>(`/api/admin/tables/${encodeURIComponent(selected)}?limit=25&offset=${offset}`,{signal:abort.signal})
   .then(next=>{
    if(!current)return;
    if(offset>0&&next.rows.length===0&&next.total<=offset)setOffset(Math.max(0,Math.floor((next.total-1)/25)*25));
    else setData(next);
   })
   .catch(reason=>{if(current&&reason.name!=='AbortError'){setError(reason.message);if(reason.status===401)lock();}})
   .finally(()=>{if(current)setRowBusy(false);});
  return()=>{current=false;abort.abort();};
 },[status,selected,offset,version,lock]);
 async function login(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{await request('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});setPassword('');await loadOverview();}
  catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 async function logout(){
  setBusy(true);try{await request('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});lock();}
  catch(reason){setError((reason as Error).message);}finally{setBusy(false);}
 }
 function deleted(result:DeleteResult){
  setDeletion(null);setData(null);setRowBusy(true);
  setNotice(result.table==='destinations'?`已刪除「${result.title}」，以及 ${result.counts.reviews} 筆評價與 ${result.counts.place_web_snapshots} 筆網路快照。`:`已刪除「${result.title}」，景點與其他評價仍保留。`);
  void loadOverview();
 }
 return <div className="db-app">
  <header className="db-header"><a href="/" className="db-back"><ArrowLeft size={18}/>回到旅評小站</a><span><Database size={19}/>資料庫管理</span>{status==='ready'&&<button onClick={logout} disabled={busy}><LogOut size={16}/>登出</button>}</header>
  <main className="db-main">
   <div className="db-heading"><div><p className="db-eyebrow">TRAVEL NOTES · DATABASE</p><h1>管理景點與共用評價</h1><p>查看資料表、欄位與筆數，並刪除需要移除的景點或評價。</p></div>{status==='ready'&&<button className="db-button" onClick={()=>void loadOverview()}><RefreshCw size={17}/>重新讀取</button>}</div>
   {notice&&<p className="db-notice" role="status">{notice}</p>}
   {error&&<p className="db-error" role="alert">{error}</p>}
   {status==='loading'&&<div className="db-login"><LoaderCircle className="spin"/><p>正在確認管理者登入狀態…</p>{error&&<button className="db-button" onClick={()=>void loadOverview()}>重試</button>}</div>}
   {status==='locked'&&<section className="db-login"><div className="db-lock"><LockKeyhole size={30}/></div><h2>登入資料庫管理</h2><p>使用主機環境變數 ADMIN_PASSWORD 設定的管理密碼。</p><form onSubmit={login}><label htmlFor="admin-password">管理密碼</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required maxLength={256}/><button className="db-button db-primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<LockKeyhole size={17}/>}登入管理頁</button></form><p className="db-help">正式雲端資料亦可在自己的 Supabase 專案中開啟 Table Editor 查看。</p></section>}
   {status==='ready'&&overview&&<>
    <div className={`db-location ${overview.mode==='local-demo'?'db-demo':''}`}><Database size={24}/><div><strong>{overview.mode==='local-demo'?'本機驗證資料庫 · PGlite':'線上共用資料庫 · PostgreSQL'}</strong><p>{overview.mode==='local-demo'?'此模式使用本機 PostgreSQL 測試引擎；部署並連接 Supabase 後才會顯示雲端共用資料。':`連線中的資料庫：${overview.database.name}。此頁直接讀取後端正在使用的資料庫。`}</p></div>{overview.dashboardUrl&&<a className="db-button" href={overview.dashboardUrl} target="_blank" rel="noreferrer">開啟 Supabase<ExternalLink size={16}/></a>}</div>
    <div className="db-stats">{['destinations','reviews','visitors'].map(name=><div key={name}><span>{names[name]}</span><strong>{overview.tables.find(item=>item.name===name)?.count??0}</strong><small>筆資料</small></div>)}</div>
    <div className="db-workspace">
     <aside className="db-sidebar"><h2>資料表</h2>{overview.tables.map(item=><button className={item.name===selected?'selected':''} key={item.name} onClick={()=>{setSelected(item.name);setOffset(0);setTab('rows');}}><span><strong>{names[item.name]||item.name}</strong><small>{item.name}</small></span><b>{item.count}</b></button>)}<p>景點與共用評價可刪除，其他系統表提供唯讀檢視。確認刪除前會顯示影響範圍。</p></aside>
     <section className="db-content">
      <div className="db-table-title"><div><h2>{names[selected]||selected}</h2><p>{selected} · {table?.count??0} 筆 · {table?.columns.length??0} 個欄位</p></div><div className="db-tabs"><button className={tab==='rows'?'selected':''} onClick={()=>setTab('rows')}>資料列</button><button className={tab==='schema'?'selected':''} onClick={()=>setTab('schema')}>欄位定義</button></div></div>
      {tab==='schema'?<div className="db-table-scroll"><table><thead><tr><th>欄位名稱</th><th>資料型別</th><th>允許 NULL</th><th>主鍵</th></tr></thead><tbody>{table?.columns.map(column=><tr key={column.name}><td>{column.name}</td><td>{column.type}</td><td>{column.nullable?'是':'否'}</td><td>{column.primaryKey?'PK':''}</td></tr>)}</tbody></table></div>:rowBusy?<div className="db-loading"><LoaderCircle className="spin"/>讀取資料中…</div>:<>
       <div className="db-table-scroll"><table><thead><tr>{canDelete&&<th className="db-row-action">操作</th>}{table?.columns.map(column=><th key={column.name}>{column.name}</th>)}</tr></thead><tbody>{data?.rows.map((row,index)=><tr key={String(row.id??row.place_id??row.key??index)}>
        {canDelete&&<td className="db-row-action"><button className="db-delete-row" type="button" aria-label={selected==='destinations'?`刪除景點 ${String(row.name)}`:`刪除評價 ${String(row.nickname)}`} onClick={()=>setDeletion({table:selected,id:String(row.id)})}><Trash2 size={15}/>刪除</button></td>}
        {table?.columns.map(column=><td key={column.name}><Cell value={row[column.name]}/></td>)}
       </tr>)}</tbody></table>{data?.rows.length===0&&<p className="db-empty">這張資料表目前沒有資料。</p>}</div>
       <div className="db-pagination"><span>{data&&data.total>0?`${data.offset+1}–${Math.min(data.offset+data.limit,data.total)} / ${data.total} 筆`:'0 筆資料'}</span><div><button aria-label="上一頁" disabled={offset===0||rowBusy} onClick={()=>setOffset(value=>Math.max(0,value-25))}><ChevronLeft size={19}/></button><button aria-label="下一頁" disabled={!data||offset+25>=data.total||rowBusy} onClick={()=>setOffset(value=>value+25)}><ChevronRight size={19}/></button></div></div>
      </>}
     </section>
    </div><p className="db-engine">{overview.database.version}</p>
   </>}
  </main>
  {deletion&&<AdminDeleteDialog target={deletion} onClose={()=>setDeletion(null)} onDeleted={deleted} onAuthExpired={lock}/>}
 </div>;
}
