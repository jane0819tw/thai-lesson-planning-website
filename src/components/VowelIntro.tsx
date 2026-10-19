// 母音種類＋母音位置圖（對應講義第一頁）
export default function VowelIntro() {
  return (
    <article className="card vintro">
      <div className="vintro-text">
        <ul>
          <li className="hot">單母音：9 組 18 個</li>
          <li>複合母音：3 組 6 個</li>
          <li>特殊母音：4 個（只有短音）</li>
          <li>來自梵文的母音：2 組 4 個</li>
        </ul>
        <ul className="vintro-sub">
          <li>母音一組有<strong>長短音</strong>之分，長音的長度約是短音的兩倍。</li>
          <li>母音的位置可以在子音的<strong>上、下、左、右</strong>。</li>
        </ul>
      </div>
      <figure className="vpos" aria-label="母音可以出現在子音的上下左右">
        <div className="vp tone">聲調符號</div>
        <div className="vp vow top">母音</div>
        <div className="vp vow left">母音</div>
        <div className="vp cons">子音</div>
        <div className="vp vow right">母音</div>
        <div className="vp vow bottom">母音</div>
      </figure>
    </article>
  )
}
