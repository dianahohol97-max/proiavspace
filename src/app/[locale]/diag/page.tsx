import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n/config'
import { DiagReport } from './DiagReport'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * TEMP self-service forensic page: an inline pre-hydration MutationObserver
 * logs every DOM node/attribute change NOT made inside the report container,
 * then DiagReport displays the log. Lets a non-technical user identify which
 * extension/translator is rewriting pages with a single screenshot. Remove
 * once the gallery-crash investigation closes.
 */
export default function DiagPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()

  const observer = `(function(){try{window.__mut=[];var o=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];var t=m.target;try{if(t&&t.nodeType===1&&t.closest&&t.closest('#diag-out'))continue;}catch(_){}
if(m.type==='attributes'){window.__mut.push('ATTR <'+t.tagName.toLowerCase()+'> '+m.attributeName+'="'+String(t.getAttribute(m.attributeName)).slice(0,100)+'"');}
else{for(var j=0;j<m.addedNodes.length;j++){var n=m.addedNodes[j];if(n.nodeType!==1)continue;try{if(n.closest&&n.closest('#diag-out'))continue;}catch(_){}
var d='ADD <'+n.tagName.toLowerCase()+(n.id?' id='+n.id:'')+(n.className?' class='+String(n.className).slice(0,80):'')+'>';var s=(n.getAttribute&&(n.getAttribute('src')||n.getAttribute('href')))||'';if(s){d+=' src='+String(s).slice(0,140);}window.__mut.push(d);}}
if(window.__mut.length>500){o.disconnect();break;}}});o.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','translate']});}catch(e){window.__mut=['observer error: '+e.message];}})();`

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>
      <script dangerouslySetInnerHTML={{ __html: observer }} />
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 28 }}>
        Діагностика браузера
      </h1>
      <p style={{ color: '#666', maxWidth: '60ch', lineHeight: 1.6 }}>
        Ця сторінка 10 секунд спостерігає, чи змінює хтось сторонній (розширення,
        перекладач) сторінки проЯв у вашому браузері. Зачекайте, поки з’явиться звіт,
        і надішліть його скріншот.
      </p>
      <div id="diag-out">
        <DiagReport />
      </div>
      {/* Bait content resembling the app: text-dense spans and a password
          input, so translators / password managers reveal themselves here. */}
      <div style={{ marginTop: 24, fontSize: 14, color: '#444' }}>
        <span>
          Фотографій: 10 · Обраних: 3 · Переглядів: 5 · Завантажень: 0 ·{' '}
          Галерея, у якій клієнт одразу розуміє, як забрати фото — без Google Drive і
          питань «як завантажити».
        </span>
        <form style={{ marginTop: 12 }}>
          <label htmlFor="diag-pass" style={{ display: 'block', fontSize: 12, color: '#777' }}>
            Пароль для доступу (тестове поле)
          </label>
          <input
            id="diag-pass"
            type="password"
            autoComplete="new-password"
            style={{ border: '1px solid #ccc', padding: '8px 10px', marginTop: 4 }}
          />
        </form>
      </div>
    </main>
  )
}
