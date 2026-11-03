import { SpeechPlayback } from './SpeechPlayback'
import { useState } from 'react'
import { z } from 'zod'
const translationSchema = z.object({ translation:z.string(), explanation:z.string() })
const riskSchema=z.object({risks:z.array(z.object({level:z.enum(['low','medium','high']),text:z.string(),evidence:z.string(),suggestion:z.string()}))})
const summarySchema = z.object({summary:z.string(),actions:z.array(z.object({text:z.string(),evidence:z.string(),deadline:z.string().nullable()})),decisions:z.array(z.object({text:z.string(),evidence:z.string()})),questions:z.array(z.object({text:z.string(),evidence:z.string()})),followUps:z.array(z.object({text:z.string(),evidence:z.string()})).default([])})
const repliesSchema = z.object({ replies:z.array(z.object({ style:z.enum(['simple','professional','friendly']), english:z.string().trim().min(1), vietnamese:z.string().trim().min(1), explanation:z.string().trim().min(1) })).length(3).refine(replies=>new Set(replies.map(reply=>reply.style)).size===3) })
const coachSchema = z.object({ meaning:z.string(), grammar:z.string(), ipa:z.string(), pronunciationHint:z.string(), stress:z.string(), alternatives:z.array(z.string()), commonMistakes:z.array(z.string()), vocabulary:z.array(z.object({term:z.string(),meaning:z.string()})) })
function Sentence({text}:{text:string}) {
  const [status,setStatus] = useState('')
  const copy = async () => {
    try { await window.lingua.writeClipboardText(text); setStatus('Đã sao chép') }
    catch { setStatus('Không sao chép được. Anh thử lại.') }
  }
  return <><p>{text}</p><button type="button" onClick={()=>void copy()}>Sao chép câu</button><SpeechPlayback text={text}/><small role="status">{status}</small></>
}
export function AiResult({result}:{result:unknown}) {
  const risks=riskSchema.safeParse(result)
  if(risks.success)return <article className="notice"><h4>Rà soát giao tiếp · gợi ý AI</h4>{risks.data.risks.length?risks.data.risks.map((risk,index)=><div key={index}><b>{{low:'Thấp',medium:'Trung bình',high:'Cao'}[risk.level]}</b><p>{risk.text}</p><blockquote>{risk.evidence}</blockquote><p>{risk.suggestion}</p></div>):<p>AI không tìm thấy rủi ro có dẫn chứng. Anh vẫn cần tự duyệt nội dung.</p>}</article>
  const summary=summarySchema.safeParse(result)
  if(summary.success)return <article className="notice"><h4>Tóm tắt</h4><p>{summary.data.summary}</p>{([['Việc cần làm',summary.data.actions],['Quyết định',summary.data.decisions],['Câu hỏi chưa trả lời',summary.data.questions],['Gợi ý theo dõi',summary.data.followUps]] as const).map(([label,items])=><div key={label}><h4>{label}</h4>{items.length?items.map((item,index)=><div key={index}><p>{item.text}</p><blockquote>{item.evidence}</blockquote>{'deadline' in item && item.deadline?<p>Hạn được nêu: {item.deadline}</p>:null}</div>):<p>Không có nội dung được xác nhận.</p>}</div>)}</article>
  const translation=translationSchema.safeParse(result)
  if(translation.success)return <article className="notice"><Sentence text={translation.data.translation}/><p>{translation.data.explanation}</p></article>
  const replies=repliesSchema.safeParse(result)
  if(replies.success)return <>{[...replies.data.replies].sort((a,b)=>['simple','professional','friendly'].indexOf(a.style)-['simple','professional','friendly'].indexOf(b.style)).map((reply,index)=><article className="notice" key={reply.style}><b>{index===0?'Mặc định · ':''}{{simple:'Đơn giản, tự nhiên',professional:'Chuyên nghiệp, lịch sự',friendly:'Thân thiện'}[reply.style]}</b><Sentence text={reply.english}/><p>{reply.vietnamese}</p><details><summary>Giải thích cách dùng</summary><p>{reply.explanation}</p></details></article>)}</>
  const coach=coachSchema.safeParse(result)
  if(coach.success)return <article className="notice"><h4>Nghĩa tiếng Việt</h4><p>{coach.data.meaning}</p><h4>Ngữ pháp</h4><p>{coach.data.grammar}</p><h4>Phát âm tham khảo</h4><p>{coach.data.ipa}</p><p>{coach.data.pronunciationHint}</p><h4>Nhấn giọng và ngữ điệu</h4><p>{coach.data.stress}</p><h4>Cách nói tự nhiên khác</h4>{coach.data.alternatives.map((sentence,index)=><Sentence key={index} text={sentence}/>)}<h4>Lỗi thường gặp</h4>{coach.data.commonMistakes.map((mistake,index)=><p key={index}>{mistake}</p>)}{coach.data.vocabulary.map(word=><p key={word.term}><b>{word.term}</b> — {word.meaning}<button onClick={()=>void window.lingua.addVocabulary(word)}>Lưu từ</button></p>)}</article>
  return <p role="alert">Kết quả không đúng định dạng. Anh thử lại.</p>
}
