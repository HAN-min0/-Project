import {useEffect,useRef,useState,type FormEvent} from 'react';
import {LoaderCircle,Trash2} from 'lucide-react';

export type DeleteTarget={table:string;id:string};
type Counts={destinations:number;reviews:number;place_web_snapshots:number};
type Preview=DeleteTarget&{title:string;placeName:string;content:string|null;counts:Counts;revision:string};
export type DeleteResult=DeleteTarget&{deleted:true;title:string;counts:Counts};
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,init),data=await response.json();
 if(!response.ok)throw Object.assign(new Error(data.error||'資料處理失敗。'),{status:response.status});
 return data as T;
}
export default function AdminDeleteDialog({target,onClose,onDeleted,onAuthExpired}:{target:DeleteTarget;onClose:()=>void;onDeleted:(result:DeleteResult)=>void;onAuthExpired:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [preview,setPreview]=useState<Preview|null>(null),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const isPlace=target.table==='destinations';
 const endpoint=`/api/admin/records/${encodeURIComponent(target.table)}/${encodeURIComponent(target.id)}`;
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 useEffect(()=>{
  const controller=new AbortController();let current=true;setLoading(true);setPreview(null);
  request<Preview>(endpoint,{signal:controller.signal})
   .then(data=>{if(current)setPreview(data);})
   .catch((reason:Error&{status?:number})=>{if(!current||reason.name==='AbortError')return;if(reason.status===401)onAuthExpired();else setError(reason.message);})
   .finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;controller.abort();};
 },[endpoint,attempt,onAuthExpired]);
 async function remove(event:FormEvent){
  event.preventDefault();if(!preview||loading||deleting)return;
  setDeleting(true);setError('');
  try{onDeleted(await request<DeleteResult>(endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:preview.revision})}));}
  catch(reason){
   const failure=reason as Error&{status?:number};
   if(failure.status===401)onAuthExpired();
   else if(failure.status===409){setError('資料已更新，已重新讀取刪除範圍，請再次確認。');setAttempt(value=>value+1);}
   else{setError(failure.message);if(failure.status===404)setPreview(null);}
  }finally{setDeleting(false);}
 }
 return <dialog ref={dialog} className="db-delete-dialog" aria-labelledby="db-delete-title" aria-describedby="db-delete-description" onCancel={event=>{event.preventDefault();if(!deleting)onClose();}}>
  <form onSubmit={remove}>
   <h2 id="db-delete-title">{isPlace?'刪除景點':'刪除評價'}</h2>
   <p id="db-delete-description">請核對以下資料與影響範圍，再確認刪除。</p>
   {loading?<p className="db-delete-loading" role="status"><LoaderCircle size={18} className="spin"/>讀取刪除範圍中…</p>:preview&&<>
    <p className="db-delete-name">{preview.title}</p>
    {!isPlace&&<p>所屬景點：{preview.placeName}</p>}
    <p className="db-delete-id">資料編號：{preview.id}</p>
    {isPlace?<ul className="db-delete-counts"><li>景點：1 個</li><li>連同此景點的評價：{preview.counts.reviews} 筆</li><li>連同此景點的網路快照：{preview.counts.place_web_snapshots} 筆</li></ul>:<><blockquote className="db-delete-content">{preview.content||'這筆評價未填寫文字心得。'}</blockquote><p>僅刪除這 1 筆評價與其分數，景點及其他人的評價會保留。</p></>}
    <p className="db-delete-warning">刪除後無法從網站還原，其他使用者重新讀取後也會看到變更。</p>
   </>}
   {error&&<p className="db-error" role="alert">{error}</p>}
   <div className="db-delete-actions"><button type="button" className="db-button" onClick={onClose} disabled={deleting} autoFocus>取消</button><button type="submit" className="db-button db-danger" disabled={!preview||loading||deleting}>{deleting?<LoaderCircle size={17} className="spin"/>:<Trash2 size={17}/>}<span>{deleting?'刪除中…':'確認刪除'}</span></button></div>
  </form>
 </dialog>;
}
