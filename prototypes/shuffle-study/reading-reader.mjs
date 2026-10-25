import { readingDeck, selectedCardContent } from './reading-content.mjs';
import { readingCardImage } from './reading-art.mjs';

/** A stable side rail, never a modal or a trigger for camera movement. */
export function createReadingReader(root) {
  const $ = id => root.querySelector(`#${id}`);
  let shownKey = null;
  $('reader-credit').textContent = `${readingDeck.name} · ${readingDeck.creator} · ${readingDeck.publisher}`;
  $('reader-details').addEventListener('toggle', () => {
    $('reader-toggle-label').textContent = $('reader-details').open ? '收起详细牌义' : '展开牌义与画面线索';
  });
  $('reader-image').addEventListener('error', () => {
    $('reader-image').hidden = true;
    $('reader-image-error').hidden = false;
  });
  $('reader-image').addEventListener('load', () => {
    $('reader-image').hidden = false;
    $('reader-image-error').hidden = true;
  });
  return (state, { resetting = false, revealing = false, loading = false, failed = false } = {}) => {
    const card = selectedCardContent(state, resetting || revealing || failed);
    const key = card ? `${card.id}:${card.reversed}` : null;
    $('reader-empty').hidden = !!card;
    $('reader-content').hidden = !card;
    root.setAttribute('aria-busy', String(loading || revealing));
    if (!card) {
      $('reader-empty-title').textContent = resetting ? '留一点空白，再开始。' : loading ? '正在准备这张牌…' : revealing ? '慢慢揭晓。' : state.selectedId !== null ? '先看看这张牌。' : '从一张牌开始。';
      $('reader-empty-copy').textContent = failed ? '牌桌恢复后，可以继续阅读牌面。' : resetting ? '洗牌完成后，再挑选属于这一刻的牌。' : loading ? '图像准备好后会继续翻开。' : revealing ? '先让画面留下一个印象。' : state.selectedId !== null ? '双击桌上的牌，或点「翻开」。' : '翻开后，牌名与主题会留在这里。';
    }
    if (key === shownKey) return;
    shownKey = key;
    $('reader-details').open = false;
    $('reader-body').scrollTop = 0;
    if (!card) {
      $('reader-image').removeAttribute('src');
      $('reader-image').alt = '';
      for (const id of ['reader-name', 'reader-theme', 'reader-title', 'reader-meaning', 'reader-imagery']) $(id).textContent = '';
      return;
    }
    $('reader-family').textContent = card.family;
    $('reader-orientation').textContent = card.orientation;
    $('reader-image').hidden = false;
    $('reader-image-error').hidden = true;
    $('reader-image').src = readingCardImage(card.physicalId);
    $('reader-image').alt = `${card.name} · ${card.orientation}`;
    $('reader-image').classList.toggle('is-reversed', card.reversed);
    $('reader-name').textContent = card.name;
    $('reader-title').textContent = card.title || '';
    $('reader-title').hidden = !card.title;
    $('reader-theme').textContent = card.theme;
    $('reader-meaning').textContent = card.meaning;
    $('reader-imagery').textContent = card.urbanImagery;
    $('reader-reversed-note').hidden = !card.missingReversedMeaning;
  };
}
